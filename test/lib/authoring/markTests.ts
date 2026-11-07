// `tests:mark` — comment out named tests of cell files under one of the four
// reason markers (test/TESTS_AUDIT.md § Disabling a test), or bring them back.
// Run `tests:mark --help`.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import {
    REFERENCE_CELLS, abs, blankLines, cellOfFile, gitHead, isEntryPoint, isSyncCell, mergeImports, parseTests, renderTest,
    resolveTestFiles, testsByName, MARKER_LINE, INDENT, type TestBlock,
} from './testFile.js'
import { ensureSyncImport, toSyncCode } from './syncTransform.js'

const HELP = `Usage:
  tests:mark <file|folder|coord>… <marker> <reason> --test <name>… [--keep-imports] [--dry-run]
  tests:mark <file|folder|coord>… --unmark --test <name>… [--keep-snapshots] [--dry-run]

Comment out the named tests of each file under a reason marker, in the shape the
audit accepts (test/TESTS_AUDIT.md § Disabling a test — the four reason markers):

    // NOT-APPLICABLE: <reason>
    /*
    test('<name>', async () => {
        … the whole body, unchanged, with the comments it had above …
    })
    */

A body that holds \`*/\` can't go in a /* … */ block: it is written as \`//\` lines,
with one blank line between the marker and the body (test/WRITING_TESTS.md § When
the canonical body contains \`*/\`). A test already commented out is left as it is
and reported with its marker.

<marker> is one of:
  --not-applicable <reason>   a dialect boundary: the type surface doesn't expose it here
  --not-supported <reason>    the engine / version / build / driver can't run it
  --todo-bug <reason>         a defect in src/ (with its entry in test/BUGS.md)
  --todo-limitation <reason>  not covered yet, or this harness can't drive it
The reason names the boundary (which dialect / engine version / driver, which
feature) in one line.

Imports the live code no longer uses are removed (noUnusedLocals); with
--keep-imports they stay, kept used by a \`void <name>\` line before describe(
(test/WRITING_TESTS.md § Imports used only from commented-out blocks).

--unmark does the reverse: it uncomments the test, removes its marker line and
the comment lines after it (the marker's continuation), keeps the comments above
the marker, adds the imports the body needs (from the same file of the
database's reference cell, of postgres/newest/pg and of HEAD), rewrites it for a -sync
cell, and empties its snapshots to be baked (--keep-snapshots to keep them).

Arguments: a file, a folder (its *.test.ts), or a coord
<db>/<version>/<connector>[/<file>] with * and {a,b}, e.g.
'mysql/*/*/docs.delete' marks the test in every MySQL cell.

  --test <name>     the test to mark or unmark (repeatable)
  --dry-run         print what would change, write nothing
`

const MARKERS: Readonly<Record<string, string>> = {
    '--not-applicable': 'NOT-APPLICABLE',
    '--not-supported': 'NOT-SUPPORTED',
    '--todo-bug': 'TODO[BUG]',
    '--todo-limitation': 'TODO[LIMITATION]',
}

interface Args {
    targets: string[]
    names: string[]
    marker: string | undefined
    reason: string | undefined
    unmark: boolean
    keepImports: boolean
    keepSnapshots: boolean
    dryRun: boolean
}

function parseArgs(argv: readonly string[]): Args {
    const a: Args = { targets: [], names: [], marker: undefined, reason: undefined, unmark: false, keepImports: false, keepSnapshots: false, dryRun: false }
    for (let i = 0; i < argv.length; i++) {
        const x = argv[i]!
        const marker = MARKERS[x]
        if (marker) {
            if (a.marker) throw new Error('give one marker')
            a.marker = marker
            a.reason = argv[++i]
            if (!a.reason?.trim()) throw new Error(`${x} needs a reason`)
        } else if (x === '--test') {
            const n = argv[++i]
            if (n === undefined) throw new Error('--test needs a name')
            a.names.push(n)
        } else if (x === '--unmark') a.unmark = true
        else if (x === '--keep-imports') a.keepImports = true
        else if (x === '--keep-snapshots') a.keepSnapshots = true
        else if (x === '--dry-run') a.dryRun = true
        else if (x.startsWith('--')) throw new Error(`unknown option ${x}`)
        else a.targets.push(x)
    }
    if (!a.targets.length) throw new Error('give the files or coords')
    if (!a.names.length) throw new Error('give the tests with --test <name>')
    if (a.unmark === (a.marker !== undefined)) throw new Error('give either a marker or --unmark')
    return a
}

function markerOf(t: TestBlock): string {
    return t.pre.find(l => MARKER_LINE.test(l))?.trim() ?? '(no marker)'
}

/** `void <name>` before describe( for each import the commented code still names. */
function keepImportsUsed(text: string, dropped: readonly string[]): string {
    if (!dropped.length) return text
    const ls = text.split('\n')
    const d = ls.findIndex(l => l.startsWith('describe('))
    ls.splice(d, 0, `// Used by the commented-out tests below; the cells where they run use them for real.`, ...dropped.map(n => `void ${n}`), '')
    return ls.join('\n')
}

function mark(text: string, a: Args, log: (m: string) => void): string {
    const lines = text.split('\n')
    for (const name of a.names) {
        const t = testsByName(parseTests(lines.join('\n'))).get(name)
        if (!t) { log(`no test '${name}'`); continue }
        if (t.form !== 'live') { log(`'${name}' is already commented out: ${markerOf(t)}`); continue }
        const rendered = renderTest({ pre: [`${INDENT}// ${a.marker}: ${a.reason}`], inner: [...t.pre, ...t.inner], form: 'block' })
        lines.splice(t.start, t.end - t.start, ...rendered)
        log(`marked '${name}'`)
    }
    let out = lines.join('\n')
    if (out === text) return text
    const merged = mergeImports(out, '')
    if (a.keepImports) out = keepImportsUsed(out, merged.removed)
    else {
        out = merged.text
        if (merged.removed.length) log(`imports removed: ${merged.removed.join(', ')}`)
    }
    return out
}

function unmark(text: string, rel: string, a: Args, log: (m: string) => void): string {
    const cell = cellOfFile(rel)
    const lines = text.split('\n')
    for (const name of a.names) {
        const t = testsByName(parseTests(lines.join('\n'))).get(name)
        if (!t) { log(`no test '${name}'`); continue }
        if (t.form === 'live') { log(`'${name}' is live already`); continue }
        const k = t.pre.findIndex(l => MARKER_LINE.test(l))
        const pre = k >= 0 ? t.pre.slice(0, k) : t.pre
        let inner = t.inner
        if (cell && isSyncCell(cell)) inner = toSyncCode(inner.join('\n')).text.split('\n')
        if (!a.keepSnapshots) inner = blankLines(inner)
        lines.splice(t.start, t.end - t.start, ...renderTest({ pre, inner, form: 'live' }))
        log(`unmarked '${name}' (was ${markerOf(t)})`)
    }
    let out = lines.join('\n')
    if (out === text) return text
    const file = rel.split('/').pop()!
    const refs = [cell ? REFERENCE_CELLS[cell.db] : undefined, REFERENCE_CELLS['postgres']]
        .filter((c): c is string => c !== undefined)
        .map(c => `test/db/${c}/${file}`)
        .filter(r => r !== rel && existsSync(abs(r)))
    const head = gitHead(rel)
    for (const r of [...refs.map(x => readFileSync(abs(x), 'utf8')), ...(head === undefined ? [] : [head])]) {
        const merged = mergeImports(out, r)
        out = merged.text
        if (merged.added.length) log(`imports added: ${merged.added.join(', ')}`)
    }
    if (cell && isSyncCell(cell)) out = ensureSyncImport(out, rel)
    return out
}

function main(argv: readonly string[]): number {
    if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) { process.stdout.write(HELP); return argv.length ? 0 : 2 }
    const a = parseArgs(argv)
    const bake: string[] = []
    let changed = 0
    for (const rel of resolveTestFiles(a.targets)) {
        const text = readFileSync(abs(rel), 'utf8')
        const tag = rel.replace(/^test\/db\//, '')
        const log = (m: string): void => { console.log(`${tag}: ${m}`) }
        const out = a.unmark ? unmark(text, rel, a, log) : mark(text, a, log)
        if (out === text) continue
        changed++
        if (a.unmark && !a.keepSnapshots) bake.push(tag)
        if (!a.dryRun) writeFileSync(abs(rel), out)
    }
    console.log(`${changed} files ${a.dryRun ? 'to change' : 'changed'}`)
    if (bake.length) console.log(`to bake:\n  bun run tests ${bake.map(c => `'${c}'`).join(' ')} --update-snapshots`)
    return 0
}

if (isEntryPoint(import.meta.url, import.meta.main)) {
    try {
        process.exit(main(process.argv.slice(2)))
    } catch (e) {
        console.error('tests:mark: ' + (e instanceof Error ? e.message : String(e)))
        process.exit(2)
    }
}
