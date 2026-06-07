#!/usr/bin/env bun
// Walks `test/db/` and verifies the symmetry rule from `test/DESIGN.md §4`:
// EVERY (database × version × connector) cell — across the WHOLE matrix, not
// just within one database — must contain the same `.test.ts` files with the
// same `test(...)` / `it(...)` names in the same order. A test that does not
// apply to a dialect is COMMENTED OUT (with a NOT-APPLICABLE / TODO marker) but
// stays present, so it keeps counting as a structural element of every cell.
//
// "Tests" here means every `test('name', …)` / `it('name', …)` /
// `test.skip('name', …)` etc. that appears in the file text — whether it
// executes at runtime or sits inside a `/* … */` comment block. The whole
// point of commenting out a non-applicable test (§4) is that it still
// counts as a structural element of the cell.
//
// EXCLUDED from the comparison (not compared cross-cell):
//   - `*.generated.test.ts` — emitted, not authored (exempt from every check);
//   - the `types.negative/` and `domain/` dirs, the `documentation` connector,
//     and the synthetic `general` db (NON_CELL_* below);
//   - `config.*.test.ts` — connection-configuration tests that are legitimately
//     specific to a connector / database (e.g. sqlite's uuid strategy), so they
//     need not exist in every cell;
//   - a file whose name embeds a database name as a `.`/`-`-delimited token
//     (e.g. `select.postgres-const-force-type-cast.test.ts`) — inherently
//     dialect-specific, so it need not exist in the other cells.
//
// Usage:
//   bun run tests:audit
//
// Exit code 0 if the matrix is symmetric, 1 if any divergence is found.

import { appendFileSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import type { Finding, Severity } from './types.js'
import { RULE_SEVERITY } from './rules.js'

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
// A file whose name embeds a database name as a `.`/`-`-delimited token (e.g.
// `select.postgres-const-force-type-cast.test.ts` → `postgres`) is inherently
// dialect-specific and excluded from the symmetry comparison — it need not exist
// in the other cells. Whole-token match (split on `.` and `-`), so `postgresql`
// or a substring never trips it. `dbNames` is the set of real database dirs.
function embedsDatabaseName(fileName: string, dbNames: ReadonlySet<string>): boolean {
    return fileName.split(/[.-]/).some(tok => dbNames.has(tok))
}

function testFiles(p: string, dbNames: ReadonlySet<string>): string[] {
    if (!isDir(p)) return []
    // Excluded from the symmetry set:
    //   - `*.generated.test.ts` — emitted, not authored (exempt from ALL checks);
    //   - `config.*` — connection-configuration tests, legitimately connector-/db-
    //     specific (project decision), so not required in every cell;
    //   - a name embedding a database name (e.g. `select.postgres-…`) — inherently
    //     dialect-specific (see embedsDatabaseName).
    return readdirSync(p).filter(n =>
        isFile(join(p, n))
        && n.endsWith('.test.ts')
        && !n.endsWith('.generated.test.ts')
        && !n.startsWith('config.')
        && !embedsDatabaseName(n, dbNames))
}

/**
 * Extract every test name that appears in the file text, in order.
 *
 * Matches `test(…)`, `it(…)`, and the standard variants `test.skip`,
 * `test.only`, `test.todo`, `test.fails`, `test.skipIf`, `test.runIf` (and
 * the same with `it.*`). The name string may be single-, double- or
 * backtick-quoted; the CLOSING quote is matched to the opener via a
 * backreference, so a name containing the OTHER quote char
 * (`'… (no "alias")'`) is captured whole, not truncated at the inner quote.
 *
 * The regex is intentionally context-insensitive: a `test('name', …)`
 * inside a `/* … * /` comment block is still matched, which is exactly
 * what the symmetry rule requires. To avoid matching ordinary comment prose
 * that happens to contain `it (…)` — e.g. a markdown code span
 * "… used to silence it (`isMocked()` skipping …)" — the name string must be
 * followed by `,` or `)` (a real call passes the callback / closes the args);
 * prose continues with other words and is rejected. (test/BUGS.md documented
 * the `isMocked()` phantom this guards against.)
 */
function extractTestNames(content: string): string[] {
    const out: string[] = []
    const re = /\b(?:test|it)\s*(?:\.\s*(?:only|skip|todo|fails|skipIf|runIf|each|concurrent|sequential))?\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1\s*[,)]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
        out.push(m[2]!)
    }
    return out
}

// Load every cell of the WHOLE matrix (all databases), each labelled
// `db/version/connector` so a cross-database divergence names the offending cell.
function loadAllCells(): Cell[] {
    const cells: Cell[] = []
    // The real database names (top-level dirs minus the synthetic `general`) —
    // used both to iterate and to spot a database name embedded in a file name.
    const databaseNames = new Set(dirs(TEST_DB_DIR).filter(d => !NON_CELL_DATABASES.has(d)))
    for (const database of [...databaseNames].sort()) {
        const databaseDir = join(TEST_DB_DIR, database)
        for (const version of dirs(databaseDir).sort()) {
            if (NON_CELL_DIRS.has(version)) continue
            const versionDir = join(databaseDir, version)
            for (const connector of dirs(versionDir).sort()) {
                if (NON_CELL_CONNECTORS.has(connector)) continue
                const cellDir = join(versionDir, connector)
                const files = new Map<string, string[]>()
                for (const fn of testFiles(cellDir, databaseNames).sort()) {
                    files.set(fn, extractTestNames(readFileSync(join(cellDir, fn), 'utf8')))
                }
                cells.push({ label: `${database}/${version}/${connector}`, files })
            }
        }
    }
    return cells
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
}

// The path of `fileName` inside the cell labelled `db/version/connector`, so a
// symmetry finding points at a concrete cell file (clickable, and grouped with
// that file's content findings in the unified report).
function pathOf(label: string, fileName: string): string {
    return join(TEST_DB_DIR, label, fileName)
}

// Join cell labels, capped so a "missing in 20 cells" line stays readable.
function labelList(cells: Cell[]): string {
    const max = 12
    const ls = cells.map(c => c.label)
    return ls.length <= max ? ls.join(', ') : `${ls.slice(0, max).join(', ')}, +${ls.length - max} more`
}

function symFinding(file: string, message: string): Finding {
    return { rule: 'symmetry', file, line: 1, message }
}

// Compare every cell of the WHOLE matrix and emit a `symmetry` Finding per
// divergence, anchored on a concrete cell file. Findings flow through the same
// report + severity pipeline as the content rules.
function checkAllCells(cells: Cell[]): Finding[] {
    if (cells.length < 2) return []
    const out: Finding[] = []

    const allFiles = new Set<string>()
    for (const c of cells) for (const f of c.files.keys()) allFiles.add(f)

    for (const fileName of [...allFiles].sort()) {
        const present = cells.filter(c => c.files.has(fileName))
        const missing = cells.filter(c => !c.files.has(fileName))

        if (missing.length > 0) {
            // A file must exist in EVERY cell. Anchor on a present cell (a real
            // file) and report the shorter side so a db-specific straggler reads
            // as "present only in …" rather than a wall of cell labels.
            const anchor = pathOf(present[0]!.label, fileName)
            const msg = present.length <= missing.length
                ? `present only in ${present.length} cell(s) (${labelList(present)}) but every cell must declare it — missing from ${missing.length} other(s). Add a commented-out stub with a NOT-APPLICABLE/TODO marker to the rest, or exclude it (rename to config.* if it is connection-config-specific).`
                : `present in ${present.length} cells but missing from: ${labelList(missing)}. Every cell must declare it — add a commented-out stub with a NOT-APPLICABLE/TODO marker where it does not apply.`
            out.push(symFinding(anchor, msg))
            continue
        }

        // All cells have the file — compare test names + order against the
        // first cell (the reference).
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
            const anchor = pathOf(cell.label, fileName)

            if (missingHere.length === 0 && extraHere.length === 0) {
                out.push(symFinding(anchor, `test order differs from the reference cell ${ref.label} (same names, different order) — every cell must list the tests in the same order.`))
                continue
            }
            const parts: string[] = []
            if (missingHere.length) parts.push(`missing vs ${ref.label}: ${missingHere.map(s => `"${s}"`).join(', ')}`)
            if (extraHere.length) parts.push(`extra vs ${ref.label}: ${extraHere.map(s => `"${s}"`).join(', ')}`)
            out.push(symFinding(anchor, `test set differs from the reference cell ${ref.label} — ${parts.join('; ')}. Every cell must declare the same tests (comment out non-applicable ones, do not drop them).`))
        }
    }

    return out
}

function describeSymmetric(cells: Cell[]): string {
    const fileNames = [...cells[0]!.files.keys()].sort()
    const total = fileNames.reduce((acc, f) => acc + (cells[0]!.files.get(f)?.length ?? 0), 0)
    return `${cells.length} cells, ${fileNames.length} test files, ${total} tests per cell`
}

// Emit the symmetry verdict to $GITHUB_STEP_SUMMARY — just the COUNT, not the
// per-divergence breakdown: those are printed to stdout alongside the other
// warnings by the unified report. Wording follows the rule's current severity: a
// `warn` symmetry does not fail the build (it is a migration backlog), an
// `error` one does.
function emitGithubSummary(findings: Finding[], cellCount: number, sev: Severity): void {
    const summaryFile = process.env['GITHUB_STEP_SUMMARY']
    if (!summaryFile) return

    const lines: string[] = []
    lines.push('## Test Symmetry Audit')
    lines.push('')
    if (findings.length === 0) {
        lines.push(`✅ Symmetric — ${cellCount} cells across the whole matrix declare the same files and tests in the same order.`)
    } else if (sev === 'error') {
        lines.push(`❌ FAILED — ${findings.length} divergence(s) across ${cellCount} cells. See the audit log for the breakdown.`)
    } else {
        lines.push(`⚠️ ${findings.length} symmetry warning(s) across ${cellCount} cells (migration backlog — not blocking). See the audit log for the breakdown.`)
    }
    lines.push('')
    lines.push('### Round details')
    lines.push('')
    lines.push('- **Phase:** Symmetry audit')
    lines.push('- **Runner:** tsx')
    lines.push('- **Scope:** whole-matrix structural check of `test/db/` (no tests executed)')
    lines.push('')
    appendFileSync(summaryFile, lines.join('\n'))
}

// Symmetry is a WHOLE-MATRIX invariant (every cell of every database must match),
// so it always runs over the full matrix — positional coords do not scope it (a
// subset of cells cannot establish the cross-cell canon). It returns `symmetry`
// Findings that the caller folds into the unified report; their severity (and
// thus whether they block) comes from RULE_SEVERITY['symmetry'] like any rule.
export function runSymmetryCheck(): Finding[] {
    if (!isDir(TEST_DB_DIR)) {
        console.log(`Symmetry: no ${TEST_DB_DIR}/ folder — nothing to audit.`)
        return []
    }

    const cells = loadAllCells()
    if (cells.length < 2) {
        console.log(`Symmetry: ${cells.length} cell(s) — nothing to compare.`)
        return []
    }

    const findings = checkAllCells(cells)
    const sev = RULE_SEVERITY['symmetry'] ?? 'error'
    emitGithubSummary(findings, cells.length, sev)

    if (findings.length === 0) {
        console.log(`Symmetry: ✓ ${describeSymmetric(cells)} — whole matrix symmetric.`)
    } else {
        console.log(`Symmetry: ${findings.length} divergence(s) across ${cells.length} cells [${sev}] — listed below with the content findings.`)
    }
    return findings
}
