// `tests:propagate` — carry the tests added or changed in a file of one cell to
// the same file of other cells (test/WRITING_TESTS.md § Adding a test, step 7).
// Run `tests:propagate --help` for the commands and the pitfalls.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import { coordMatch } from '../coords.js'
import {
    REFERENCE_CELLS, abs, blankLines, blankSnapshots, cellOf, cellOfFile, describeNonTestLines, diffLines,
    gitHead, isEntryPoint, isSyncCell, listCells, mergeImports, parseTests, renameTest, renderTest, repoRel, sameTest,
    testFileName, testsByName, topLevel, type Cell, type TestBlock, type TestShape,
} from './testFile.js'
import { ensureSyncImport, syncFile, toSyncCode } from './syncTransform.js'

const HELP = `Usage:
  tests:propagate seed <file> [--from <cell>] [--coord <c>]… [--dry-run]
  tests:propagate all <file> [--coord <c>]… [--dry-run]
  tests:propagate from <path/to/cell/file.test.ts> [<coord>…] [--dry-run]
  tests:propagate rename <file> <old test name> <new test name> [<coord>…] [--dry-run]

Carry the tests added or changed in a file of one cell to the same file of other
cells. <file> is the file name, with or without .test.ts (docs.select,
select.basic.test.ts); any test file works, not only docs.*.

  seed    from the source cell (--from, default postgres/newest/pg) to the
          reference cell of every other database: mysql/newest/mysql2,
          mariadb/newest/mariadb, sqlite/newest/bun_sqlite, sqlserver/newest/mssql,
          oracle/newest/oracledb (and postgres/newest/pg when --from is another).
  all     from each reference cell to every other cell of its database (older
          versions, other connectors, the -sync cells). Run it after seed, once
          the reference cells are adapted and baked.
  from    from the given file to the cells the coords match (default: every
          other cell that has the file).
  rename  rename a test in the file of every cell (the coords narrow it); the
          body is untouched.

What "changed" means: a test of the source that differs from the source file in
HEAD (git show HEAD:<file>), or is not in HEAD. For each such test, in each target:
  - a test the target doesn't have is inserted after the test that precedes it
    in the source, live or commented out as in the source;
  - a test the target has gets the new body, and keeps its state: commented out
    with its reason marker stays commented out (the new body inside), live stays
    live;
  - its inline snapshots are emptied, to be baked; a target whose test already
    equals the new body except for its snapshots is left as it is, so running
    the command again doesn't undo a bake;
  - in a -sync cell, \`await <query>.execute…()\` becomes \`sync(…)\` (as
    tests:sync-transform does).
Tests of HEAD the source no longer has are removed from the targets. New named
imports the moved code uses are added, and imports no longer used are dropped.
Top-level declarations added or changed between the imports and \`describe(\`
are applied to the targets (a change whose old lines the target doesn't have is
reported, not applied). A target file that doesn't exist is created from the
source, with every snapshot emptied. The tests keep the source's order.

At the end it prints the coords whose snapshots must be baked:
  bun run tests <coord>… --update-snapshots
then validate as test/WRITING_TESTS.md says (the -sync cells, the real engines).

Pitfalls:
  - It compares with HEAD. A test added and then deleted before committing was
    never in HEAD: it isn't removed from the cells it already reached. Remove it
    there by hand (or rename it there first).
  - A test renamed in the source alone reads as a deleted test plus a new one:
    the old one is removed from every target, losing its marker and its baked
    snapshots there. Run \`rename\` first, then propagate.
  - It doesn't adapt the code to the dialect: the body is the source's. Commenting
    out under a marker where it doesn't apply is \`tests:mark\`.
  - Code of the describe body outside the tests (hooks, helpers) is not
    propagated; a change there is reported.

Options:
  --from <cell>    seed: the source cell (default postgres/newest/pg)
  --coord <c>      seed/all: only targets matching the coord (repeatable,
                   <db>[/<version>[/<connector>]] with * and {a,b})
  --dry-run        print what would change, write nothing
`

interface Options {
    dryRun: boolean
    coords: string[]
    from: string
}

interface Report {
    changed: string[]
    bake: Set<string>
    warnings: string[]
}

function read(rel: string): string {
    return readFileSync(abs(rel), 'utf8')
}

function blankShape(t: TestShape): TestShape {
    return { pre: t.pre, inner: blankLines(t.inner), form: t.form }
}

function fileCoord(rel: string): string {
    return rel.replace(/^test\/db\//, '')
}

/** The shape a changed source test takes in a target. */
function targetShape(src: TestBlock, existing: TestBlock | undefined, cell: Cell, note: (m: string) => void): TestShape {
    let shape: TestShape
    if (!existing) shape = { pre: src.pre, inner: src.inner, form: src.form }
    else if (existing.form === 'live') {
        if (src.form !== 'live') note(`'${src.name}' is commented out in the source but live here: kept live with the new body`)
        shape = src.form === 'live' ? { pre: src.pre, inner: src.inner, form: 'live' } : { pre: existing.pre, inner: src.inner, form: 'live' }
    } else {
        if (src.form === 'live') note(`'${src.name}' is commented out here: kept commented out under its marker, with the new body`)
        shape = { pre: existing.pre, inner: src.form === 'live' ? [...src.pre, ...src.inner] : src.inner, form: existing.form }
    }
    let inner = shape.inner
    if (isSyncCell(cell)) inner = toSyncCode(inner.join('\n')).text.split('\n')
    return { ...shape, inner: blankLines(inner) }
}

function applyTopLevel(lines: string[], srcText: string, headText: string, warn: (m: string) => void): string[] {
    const srcTop = topLevel(srcText)
    const headTop = topLevel(headText)
    if (!srcTop || !headTop) return lines
    for (const h of diffLines(headTop.lines, srcTop.lines)) {
        const top = topLevel(lines.join('\n'))
        if (!top) return lines
        const region = top.lines
        const code = (ls: readonly string[]): string[] => ls.filter(l => l.trim() !== '')
        if (h.oldLines.length) {
            const at = region.findIndex((_, k) => h.oldLines.every((l, j) => region[k + j] === l))
            if (at >= 0) { lines.splice(top.from + at, h.oldLines.length, ...h.newLines); continue }
            if (code(h.newLines).every(l => region.includes(l))) continue
            if (code(h.oldLines).length || code(h.newLines).length) warn(`top-level change not applied (the target doesn't have the old lines): ${code(h.oldLines)[0] ?? ''} → ${code(h.newLines)[0] ?? ''}`)
            continue
        }
        if (!code(h.newLines).length || code(h.newLines).every(l => region.includes(l))) continue
        const after = h.before === undefined ? -1 : region.lastIndexOf(h.before)
        const at = after >= 0 ? top.from + after + 1 : top.to
        lines.splice(at, 0, ...h.newLines)
    }
    return lines
}

function removeTest(lines: string[], t: TestBlock): void {
    let end = t.end
    if (lines[end] === '' && (t.start === 0 || lines[t.start - 1] === '')) end++
    lines.splice(t.start, end - t.start)
}

function insertTest(lines: string[], rendered: string[], name: string, srcOrder: readonly string[]): void {
    const tb = testsByName(parseTests(lines.join('\n')))
    const idx = srcOrder.indexOf(name)
    const prev = srcOrder.slice(0, idx).reverse().find(n => tb.has(n))
    if (prev) { lines.splice(tb.get(prev)!.end, 0, '', ...rendered); return }
    const next = srcOrder.slice(idx + 1).find(n => tb.has(n))
    if (next) { lines.splice(tb.get(next)!.start, 0, ...rendered, ''); return }
    let close = lines.length - 1
    while (close >= 0 && lines[close] !== '})') close--
    if (close < 0) throw new Error('no closing `})` of the describe')
    lines.splice(close, 0, '', ...rendered)
}

function reorder(lines: string[], srcOrder: readonly string[], warn: (m: string) => void): string[] {
    const tests = parseTests(lines.join('\n'))
    if (!tests.length) return lines
    const inSrc = tests.filter(t => srcOrder.includes(t.name))
    const want = [...inSrc].sort((a, b) => srcOrder.indexOf(a.name) - srcOrder.indexOf(b.name))
    if (want.every((t, k) => t === inSrc[k])) return lines
    const first = tests[0]!.start, last = tests[tests.length - 1]!.end
    const covered = new Set<number>()
    for (const t of tests) for (let k = t.start; k < t.end; k++) covered.add(k)
    for (let k = first; k < last; k++) {
        if (!covered.has(k) && lines[k]!.trim() !== '') { warn(`tests not in the source's order, and not reordered: line ${k + 1} is outside any test`); return lines }
    }
    const ordered = [...want, ...tests.filter(t => !srcOrder.includes(t.name))]
    const body = ordered.map(t => lines.slice(t.start, t.end).join('\n')).join('\n\n').split('\n')
    return [...lines.slice(0, first), ...body, ...lines.slice(last)]
}

function propagateTo(srcRel: string, srcText: string, headText: string | undefined, cell: Cell, opts: Options, report: Report): void {
    const rel = `${cell.dir}/${srcRel.split('/').pop()}`
    const tag = fileCoord(rel)
    const warn = (m: string): void => { report.warnings.push(`${tag}: ${m}`) }
    if (!existsSync(abs(rel))) {
        let text = blankSnapshots(srcText)
        if (isSyncCell(cell)) text = syncFile(text, rel).text
        if (!opts.dryRun) writeFileSync(abs(rel), text)
        report.changed.push(`${opts.dryRun ? 'would create' : 'created'} ${tag}`)
        report.bake.add(tag)
        return
    }
    const original = read(rel)
    const srcWarnings: string[] = []
    const srcTests = parseTests(srcText, srcWarnings)
    const srcOrder = srcTests.map(t => t.name)
    const headTests = headText === undefined ? new Map<string, TestBlock>() : testsByName(parseTests(headText))
    const srcByName = testsByName(srcTests)
    const changed = srcTests.filter(t => { const h = headTests.get(t.name); return !h || !sameTest(h, t) })
    const deleted = [...headTests.keys()].filter(n => !srcByName.has(n))

    let lines = original.split('\n')
    if (headText !== undefined) {
        lines = applyTopLevel(lines, srcText, headText, warn)
        if (describeNonTestLines(headText).join('\n') !== describeNonTestLines(srcText).join('\n')) warn('the describe body outside the tests changed in the source; not propagated')
    }
    const touched: string[] = []
    let live = false
    for (const n of deleted) {
        const t = testsByName(parseTests(lines.join('\n'))).get(n)
        if (t) { removeTest(lines, t); touched.push(`-${n}`) }
    }
    for (const s of changed) {
        const existing = testsByName(parseTests(lines.join('\n'))).get(s.name)
        const notes: string[] = []
        const shape = targetShape(s, existing, cell, m => { notes.push(m) })
        if (existing && sameTest(blankShape(existing), shape)) continue
        notes.forEach(warn)
        const rendered = renderTest(shape)
        if (existing) lines.splice(existing.start, existing.end - existing.start, ...rendered)
        else insertTest(lines, rendered, s.name, srcOrder)
        touched.push((existing ? '~' : '+') + s.name)
        if (shape.form === 'live') live = true
    }
    const reordered = reorder(lines, srcOrder, warn)
    if (reordered !== lines) { touched.push('reordered'); lines = reordered }
    let text = lines.join('\n')
    const merged = mergeImports(text, srcText)
    text = merged.text
    if (isSyncCell(cell)) text = ensureSyncImport(text, rel)
    if (text === original) return
    if (!opts.dryRun) writeFileSync(abs(rel), text)
    const imports = [...merged.added.map(n => '+' + n), ...merged.removed.map(n => '-' + n)]
    report.changed.push(`${opts.dryRun ? 'would change' : 'changed'} ${tag}: ${touched.join(', ') || 'top level'}${imports.length ? ` (imports ${imports.join(' ')})` : ''}`)
    if (live) report.bake.add(tag)
}

function matchesCoords(c: Cell, coords: readonly string[]): boolean {
    return coords.length === 0 || coords.some(p => coordMatch(c, p))
}

function propagateFrom(srcRel: string, targets: readonly Cell[], opts: Options, report: Report): void {
    if (!existsSync(abs(srcRel))) throw new Error(`${srcRel} doesn't exist`)
    const srcText = read(srcRel)
    const headText = gitHead(srcRel)
    if (headText === undefined) report.warnings.push(`${fileCoord(srcRel)} is not in HEAD: every test of it counts as new`)
    else if (headText === srcText) { report.warnings.push(`${fileCoord(srcRel)} doesn't differ from HEAD: nothing to propagate from it`); return }
    const warnings: string[] = []
    parseTests(srcText, warnings)
    report.warnings.push(...warnings.map(w => `${fileCoord(srcRel)}: ${w}`))
    for (const c of targets) propagateTo(srcRel, srcText, headText, c, opts, report)
}

function printReport(report: Report): void {
    for (const l of report.changed) console.log(l)
    for (const w of report.warnings) console.log('warning ' + w)
    console.log(`${report.changed.length} files`)
    if (report.bake.size) {
        // One coord per database and file when every cell of the database that has
        // the file is to bake, else the coords one by one.
        const groups = new Map<string, string[]>()
        for (const c of [...report.bake].sort()) {
            const [db, , , file] = c.split('/')
            const key = `${db}/*/*/${file}`
            groups.set(key, [...(groups.get(key) ?? []), c])
        }
        const coords: string[] = []
        for (const [key, list] of groups) {
            const [db, , , file] = key.split('/')
            const all = listCells().filter(c => c.db === db && existsSync(abs(`${c.dir}/${file}`))).length
            coords.push(...(list.length === all && list.length > 1 ? [key] : list))
        }
        console.log(`\nto bake (${report.bake.size} files):`)
        console.log(`  bun run tests ${coords.map(c => `'${c}'`).join(' ')} --update-snapshots`)
    }
}

function parseArgs(argv: readonly string[]): { positional: string[], opts: Options } {
    const positional: string[] = []
    const opts: Options = { dryRun: false, coords: [], from: REFERENCE_CELLS['postgres']! }
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!
        if (a === '--dry-run') opts.dryRun = true
        else if (a === '--coord' || a === '--from') {
            const v = argv[++i]
            if (v === undefined) throw new Error(`${a} needs a value`)
            if (a === '--coord') opts.coords.push(v)
            else opts.from = v.replace(/^test\/db\//, '').replace(/\/$/, '')
        } else if (a.startsWith('--')) throw new Error(`unknown option ${a}`)
        else positional.push(a)
    }
    return { positional, opts }
}

function main(argv: readonly string[]): number {
    if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) { process.stdout.write(HELP); return argv.length ? 0 : 2 }
    const { positional, opts } = parseArgs(argv)
    const [cmd, ...rest] = positional
    const report: Report = { changed: [], bake: new Set(), warnings: [] }
    const cells = listCells()
    if (cmd === 'seed' || cmd === 'all') {
        if (rest.length !== 1) throw new Error(`${cmd} takes one file`)
        const file = testFileName(rest[0]!)
        if (cmd === 'seed') {
            const src = cellOf(opts.from)
            if (!src) throw new Error(`--from ${opts.from} is not a cell`)
            const targets = Object.values(REFERENCE_CELLS).map(c => cellOf(c)!).filter(c => c.db !== src.db && matchesCoords(c, opts.coords))
            propagateFrom(`${src.dir}/${file}`, targets, opts, report)
        } else {
            for (const ref of Object.values(REFERENCE_CELLS)) {
                const src = cellOf(ref)!
                if (!existsSync(abs(`${src.dir}/${file}`))) continue
                const targets = cells.filter(c => c.db === src.db && c !== src && matchesCoords(c, opts.coords))
                propagateFrom(`${src.dir}/${file}`, targets, opts, report)
            }
        }
    } else if (cmd === 'from') {
        if (rest.length < 1) throw new Error('from takes the source file')
        const srcRel = repoRel(rest[0]!)
        const src = cellOfFile(srcRel)
        if (!src) throw new Error(`${srcRel} is not a file of a cell`)
        const coords = rest.slice(1)
        const name = srcRel.split('/').pop()!
        const targets = cells.filter(c => c !== src && (coords.length ? matchesCoords(c, coords) : existsSync(abs(`${c.dir}/${name}`))))
        if (!targets.length) throw new Error('no target cell: give the coords of the cells to propagate to')
        propagateFrom(srcRel, targets, opts, report)
    } else if (cmd === 'rename') {
        if (rest.length < 3) throw new Error('rename takes <file> <old name> <new name>')
        const [f, oldName, newName, ...coords] = rest as [string, string, string, ...string[]]
        const file = testFileName(f)
        for (const c of cells.filter(x => matchesCoords(x, coords))) {
            const rel = `${c.dir}/${file}`
            if (!existsSync(abs(rel))) continue
            const text = read(rel)
            if (testsByName(parseTests(text)).has(newName)) report.warnings.push(`${fileCoord(rel)} already has a test '${newName}'`)
            const out = renameTest(text, oldName, newName)
            if (out === undefined) continue
            if (!opts.dryRun) writeFileSync(abs(rel), out)
            report.changed.push(`${opts.dryRun ? 'would rename' : 'renamed'} in ${fileCoord(rel)}`)
        }
    } else {
        throw new Error(`unknown command '${cmd}' (seed, all, from, rename; --help)`)
    }
    printReport(report)
    return 0
}

if (isEntryPoint(import.meta.url, import.meta.main)) {
    try {
        process.exit(main(process.argv.slice(2)))
    } catch (e) {
        console.error('tests:propagate: ' + (e instanceof Error ? e.message : String(e)))
        process.exit(2)
    }
}
