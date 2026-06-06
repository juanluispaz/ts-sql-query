#!/usr/bin/env bun
// Walks `test/db/` and verifies the symmetry rule from `test/DESIGN.md §4`:
// for every database, all of its (version × connector) cells must contain
// the same `.test.ts` files with the same `test(...)` / `it(...)` names in
// the same order.
//
// "Tests" here means every `test('name', …)` / `it('name', …)` /
// `test.skip('name', …)` etc. that appears in the file text — whether it
// executes at runtime or sits inside a `/* … */` comment block. The whole
// point of commenting out a non-applicable test (§4) is that it still
// counts as a structural element of the cell.
//
// Usage:
//   bun run tests:audit
//
// Exit code 0 if the matrix is symmetric, 1 if any divergence is found.

import { appendFileSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const TEST_DB_DIR = 'test/db'

// Folder names that live directly under a database root but are NOT
// (version × connector) cells:
//   - `domain` holds the dialect's schema/seed/connection
//   - `types.negative` is the compile-time negatives folder
const NON_CELL_DIRS = new Set(['domain', 'types.negative'])

// The auto-generated documentation SQL tests live in a `documentation` connector
// (test/db/<db>/newest/documentation/) and a synthetic `general` database
// (test/db/general/…). They are NOT part of the per-db connector symmetry — they
// only exist under `newest`, carry db-specific generated files, and `general` is
// not a real database — so the audit ignores both.
const NON_CELL_CONNECTORS = new Set(['documentation'])
const NON_CELL_DATABASES = new Set(['general'])

interface Cell {
    label: string                    // e.g. "newest/pg"
    files: Map<string, string[]>     // file name → ordered test names
}

function isDir(p: string): boolean {
    try { return statSync(p).isDirectory() } catch { return false }
}
function isFile(p: string): boolean {
    try { return statSync(p).isFile() } catch { return false }
}
function dirs(p: string): string[] {
    return readdirSync(p).filter(n => isDir(join(p, n)))
}
function testFiles(p: string): string[] {
    if (!isDir(p)) return []
    return readdirSync(p).filter(n => isFile(join(p, n)) && n.endsWith('.test.ts'))
}

/**
 * Extract every test name that appears in the file text, in order.
 *
 * Matches `test(…)`, `it(…)`, and the standard variants `test.skip`,
 * `test.only`, `test.todo`, `test.fails`, `test.skipIf`, `test.runIf` (and
 * the same with `it.*`). String delimiters can be single, double or
 * backtick quotes — the regex captures everything between the first quote
 * pair after the open paren.
 *
 * The regex is intentionally context-insensitive: a `test('name', …)`
 * inside a `/* … * /` comment block is still matched, which is exactly
 * what the symmetry rule requires.
 */
function extractTestNames(content: string): string[] {
    const out: string[] = []
    const re = /\b(?:test|it)\s*(?:\.\s*(?:only|skip|todo|fails|skipIf|runIf|each|concurrent|sequential))?\s*\(\s*['"`]([^'"`]+)['"`]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
        out.push(m[1]!)
    }
    return out
}

function loadCells(databaseDir: string): Cell[] {
    const cells: Cell[] = []
    for (const version of dirs(databaseDir).sort()) {
        if (NON_CELL_DIRS.has(version)) continue
        const versionDir = join(databaseDir, version)
        for (const connector of dirs(versionDir).sort()) {
            if (NON_CELL_CONNECTORS.has(connector)) continue
            const cellDir = join(versionDir, connector)
            const files = new Map<string, string[]>()
            for (const fn of testFiles(cellDir).sort()) {
                files.set(fn, extractTestNames(readFileSync(join(cellDir, fn), 'utf8')))
            }
            cells.push({ label: `${version}/${connector}`, files })
        }
    }
    return cells
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
}

function checkDatabase(cells: Cell[]): string[] {
    if (cells.length < 2) return []
    const issues: string[] = []

    const allFiles = new Set<string>()
    for (const c of cells) for (const f of c.files.keys()) allFiles.add(f)

    for (const fileName of [...allFiles].sort()) {
        const missing = cells.filter(c => !c.files.has(fileName))
        if (missing.length > 0) {
            issues.push(`  [${fileName}] missing in: ${missing.map(m => m.label).join(', ')}`)
            continue
        }

        // All cells have the file — compare each non-reference cell against
        // the first cell that owns the file (the "reference").
        const present = cells.filter(c => c.files.has(fileName))
        const ref = present[0]!
        const refTests = ref.files.get(fileName)!

        for (let i = 1; i < present.length; i++) {
            const cell = present[i]!
            const tests = cell.files.get(fileName)!
            if (arraysEqual(refTests, tests)) continue

            const refSet = new Set(refTests)
            const testSet = new Set(tests)
            const missingHere = refTests.filter(t => !testSet.has(t))
            const extraHere = tests.filter(t => !refSet.has(t))

            if (missingHere.length === 0 && extraHere.length === 0) {
                issues.push(`  [${fileName}] order differs between ${ref.label} and ${cell.label}`)
                continue
            }
            issues.push(`  [${fileName}] ${ref.label} vs ${cell.label}:`)
            if (missingHere.length) issues.push(`      missing in ${cell.label}: ${missingHere.map(s => `"${s}"`).join(', ')}`)
            if (extraHere.length)   issues.push(`      extra in ${cell.label}:   ${extraHere.map(s => `"${s}"`).join(', ')}`)
        }
    }

    return issues
}

function describeSymmetric(cells: Cell[]): string {
    const fileNames = [...cells[0]!.files.keys()].sort()
    const total = fileNames.reduce((acc, f) => acc + (cells[0]!.files.get(f)?.length ?? 0), 0)
    return `${cells.length} cells, ${fileNames.length} test files, ${total} tests per cell`
}

// Markdown row emitted to $GITHUB_STEP_SUMMARY for one database.
// Mirrors the stdout marker (✓ / · / ✗) and free-form detail so the
// CI summary tells the same story as the terminal output. Detail
// for failures pre-joins issues with <br/> so the table cell renders
// the breakdown directly.
interface DbReportRow {
    marker: string
    database: string
    detail: string
}

function emitGithubSummary(rows: DbReportRow[], passed: boolean): void {
    const summaryFile = process.env['GITHUB_STEP_SUMMARY']
    if (!summaryFile) return

    const lines: string[] = []
    lines.push('## Test Symmetry Audit')
    lines.push('')
    if (passed) {
        lines.push('✅ Audit passed')
    } else {
        lines.push('❌ Audit FAILED — every cell of a database must contain the same files with the same test names in the same order (DESIGN §4). Comment out non-applicable tests rather than deleting them.')
    }
    lines.push('')
    lines.push('| | Database | Detail |')
    lines.push('| :-: | :-- | :-- |')
    for (const r of rows) {
        lines.push(`| ${r.marker} | \`${r.database}\` | ${r.detail} |`)
    }
    lines.push('')
    lines.push('### Round details')
    lines.push('')
    lines.push('- **Phase:** Symmetry audit')
    lines.push('- **Runner:** tsx')
    lines.push('- **Scope:** structural check of `test/db/` (no tests executed)')
    lines.push('')
    appendFileSync(summaryFile, lines.join('\n'))
}

function main(): number {
    if (!isDir(TEST_DB_DIR)) {
        console.log(`No ${TEST_DB_DIR}/ folder found; nothing to audit.`)
        return 0
    }

    const databases = dirs(TEST_DB_DIR).sort().filter(d => !NON_CELL_DATABASES.has(d))
    if (databases.length === 0) {
        console.log(`No databases under ${TEST_DB_DIR}/.`)
        return 0
    }

    console.log('Test symmetry audit')
    console.log(`Walking ${TEST_DB_DIR}/`)
    console.log()

    let failed = false
    const rows: DbReportRow[] = []
    for (const database of databases) {
        const dbDir = join(TEST_DB_DIR, database)
        const cells = loadCells(dbDir)
        const issues = checkDatabase(cells)

        if (issues.length > 0) {
            failed = true
            console.log(`✗ ${database} (${cells.length} cells):`)
            for (const m of issues) console.log(m)
            console.log()
            rows.push({
                marker: '❌',
                database,
                detail: `${cells.length} cells, ${issues.length} issue(s):<br/>` + issues.map(s => s.trim().replace(/\|/g, '\\|')).join('<br/>'),
            })
        } else if (cells.length === 0) {
            console.log(`· ${database}: no cells to compare`)
            rows.push({ marker: '·', database, detail: 'no cells to compare' })
        } else if (cells.length === 1) {
            console.log(`· ${database}: 1 cell only (${cells[0]!.label}), nothing to compare`)
            rows.push({ marker: '·', database, detail: `1 cell only (\`${cells[0]!.label}\`), nothing to compare` })
        } else {
            console.log(`✓ ${database}: ${describeSymmetric(cells)}`)
            rows.push({ marker: '✅', database, detail: describeSymmetric(cells) })
        }
    }

    console.log()
    const passed = !failed
    emitGithubSummary(rows, passed)
    if (failed) {
        console.log('Symmetry audit FAILED.')
        console.log('Apply DESIGN §4: every cell of a database must contain the same files with the same test names in the same order. Comment out non-applicable tests, do not delete them.')
        return 1
    }
    console.log('Symmetry audit passed.')
    return 0
}

process.exit(main())
