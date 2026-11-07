// `tests:sync-transform` — turn the asynchronous form of a test into the form of
// the `-sync` cells, where the queries run on SynchronousPromise and `sync()`
// unwraps them (see docs/advanced/synchronous-query-runners.md):
//
//   await <query>.execute…()                    → sync(<query>.execute…())
//   return <query>.execute…() / () => <…>()      → wrapped in sync(…) as well
//   await expect(<p>).rejects.toThrow(<e>)       → expect(() => sync(<p>)).toThrow(<e>)
//   await expect(<p>).resolves.<matcher>(<v>)    → expect(sync(<p>)).<matcher>(<v>)
//
// and add `import { sync } from '…/src/extras/sync.js'`. The code is read with the
// compiler (`typescript6`); the body of a commented-out test is transformed too.
// `propagate.ts` uses it on what it writes to a `-sync` cell.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, sep } from 'node:path'
import ts from 'typescript6'

import {
    abs, applyEdits, cellOfFile, isEntryPoint, isSyncCell, lastImportEnd, localName, namedImports, parseSource,
    parseTests, renderTest, resolveTestFiles, usedIdentifiers, type TextEdit,
} from './testFile.js'

/** Execute methods that don't return the promise of a query: the transaction hooks,
 *  and `queryRunner.execute(fn)`, which runs a function on the driver's client. */
const NOT_A_QUERY = new Set(['execute', 'executeBeforeNextCommit', 'executeAfterNextCommit', 'executeAfterNextRollback'])

function isExecuteCall(n: ts.Node): n is ts.CallExpression {
    return ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text.startsWith('execute') && !NOT_A_QUERY.has(n.expression.name.text)
}

function isSyncCall(n: ts.Node): boolean {
    return ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'sync'
}

/** `expect(<p>).rejects|resolves.<matcher>(…)` → its parts. */
function promiseExpectation(n: ts.Expression): { promise: ts.Expression, kind: 'rejects' | 'resolves', matcher: string, args: readonly ts.Expression[] } | undefined {
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return undefined
    const mid = n.expression.expression
    if (!ts.isPropertyAccessExpression(mid) || (mid.name.text !== 'rejects' && mid.name.text !== 'resolves')) return undefined
    const exp = mid.expression
    if (!ts.isCallExpression(exp) || !ts.isIdentifier(exp.expression) || exp.expression.text !== 'expect' || exp.arguments.length !== 1) return undefined
    return { promise: exp.arguments[0]!, kind: mid.name.text === 'rejects' ? 'rejects' : 'resolves', matcher: n.expression.name.text, args: n.arguments }
}

export interface SyncResult {
    text: string
    /** How many expressions were rewritten. */
    rewrites: number
    warnings: string[]
}

/** Rewrite the live code of `text` (comments untouched). */
export function toSyncCode(text: string): SyncResult {
    const sf = parseSource(text)
    const edits: TextEdit[] = []
    const warnings: string[] = []
    const lineOf = (n: ts.Node): number => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
    const visit = (n: ts.Node): void => {
        if (ts.isAwaitExpression(n)) {
            const pe = promiseExpectation(n.expression)
            if (pe) {
                const promise = pe.promise.getText(sf)
                const args = pe.args.map(a => a.getText(sf)).join(', ')
                if (pe.kind === 'rejects' && (pe.matcher === 'toThrow' || pe.matcher === 'toThrowError')) {
                    edits.push({ start: n.getStart(sf), end: n.end, text: `expect(() => sync(${promise})).${pe.matcher}(${args})` })
                    return
                }
                if (pe.kind === 'resolves') {
                    edits.push({ start: n.getStart(sf), end: n.end, text: `expect(sync(${promise})).${pe.matcher}(${args})` })
                    return
                }
                warnings.push(`line ${lineOf(n)}: \`.rejects.${pe.matcher}\` left as it is (only toThrow/toThrowError have a sync form)`)
            } else if (isExecuteCall(n.expression)) {
                edits.push({ start: n.getStart(sf), end: n.expression.getStart(sf), text: 'sync(' }, { start: n.end, end: n.end, text: ')' })
                ts.forEachChild(n.expression, visit)
                return
            }
        } else if (isExecuteCall(n) && !isSyncCall(n.parent)
            && (ts.isReturnStatement(n.parent) || (ts.isArrowFunction(n.parent) && n.parent.body === n))) {
            edits.push({ start: n.getStart(sf), end: n.getStart(sf), text: 'sync(' }, { start: n.end, end: n.end, text: ')' })
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    // Each await/return rewrite is two edits; an expectation rewrite one.
    const rewrites = edits.filter(e => e.text !== ')').length
    return { text: applyEdits(text, edits), rewrites, warnings }
}

/** The import of `sync` for a file at `rel` (repository-relative). */
export function syncImportLine(rel: string): string {
    let p = relative(dirname(abs(rel)), abs('src/extras/sync.js')).split(sep).join('/')
    if (!p.startsWith('.')) p = './' + p
    return `import { sync } from '${p}'`
}

/** Add the import of `sync` when the live code uses it and nothing imports it. */
export function ensureSyncImport(text: string, rel: string): string {
    if (!usedIdentifiers(text).has('sync')) return text
    if (namedImports(text).some(d => d.elements.some(e => localName(e) === 'sync'))) return text
    const at = lastImportEnd(text)
    return at ? text.slice(0, at) + '\n' + syncImportLine(rel) + text.slice(at) : syncImportLine(rel) + '\n' + text
}

/** Rewrite a whole cell file: its live code, the bodies of its commented-out tests, the import. */
export function syncFile(text: string, rel: string): SyncResult {
    const live = toSyncCode(text)
    let rewrites = live.rewrites
    const warnings = [...live.warnings]
    const ls = live.text.split('\n')
    for (const t of parseTests(live.text).filter(x => x.form !== 'live').reverse()) {
        const r = toSyncCode(t.inner.join('\n'))
        if (!r.rewrites) continue
        rewrites += r.rewrites
        warnings.push(...r.warnings.map(w => `commented-out test '${t.name}', ${w}`))
        ls.splice(t.start, t.end - t.start, ...renderTest({ ...t, inner: r.text.split('\n') }))
    }
    return { text: ensureSyncImport(ls.join('\n'), rel), rewrites, warnings }
}

const HELP = `Usage:
  tests:sync-transform <file|folder|coord>… [--dry-run] [--any-cell]

Rewrite test files of the \`-sync\` cells (sqlite/*/<connector>-sync) from the
asynchronous form to the synchronous one:

  await <query>.execute…()                  → sync(<query>.execute…())
  return <query>.execute…()  /  () => …()    → wrapped in sync(…)
  await expect(p).rejects.toThrow(e)        → expect(() => sync(p)).toThrow(e)
  await expect(p).resolves.toEqual(v)       → expect(sync(p)).toEqual(v)

and add \`import { sync } from '…/src/extras/sync.js'\` when it is used. The
bodies of commented-out tests are rewritten too. Running it twice changes
nothing the second time. \`tests:propagate\` already does this for what it writes
into a -sync cell.

Arguments: a file, a folder (its *.test.ts), or a coord
<db>/<version>/<connector>[/<file>] with * and {a,b} (a file segment without
.ts gets .test.ts), e.g. 'sqlite/*/*-sync/docs.select'.

  --dry-run    print what would change, write nothing
  --any-cell   also rewrite files outside a -sync cell (skipped by default)

Left as they are, with a warning: \`.rejects.<matcher>\` other than toThrow /
toThrowError. Not rewritten: a promise kept in a variable and awaited later
(\`const p = q.executeSelectOne(); await p\`), and \`await ctx.withRollback(...)\`
and other helpers, which work unchanged on a synchronous promise.
`

function main(argv: readonly string[]): number {
    if (argv.includes('-h') || argv.includes('--help') || argv.length === 0) { process.stdout.write(HELP); return argv.length ? 0 : 2 }
    const dryRun = argv.includes('--dry-run')
    const anyCell = argv.includes('--any-cell')
    const unknown = argv.filter(a => a.startsWith('--') && a !== '--dry-run' && a !== '--any-cell')
    if (unknown.length) { console.error('unknown option ' + unknown.join(' ')); return 2 }
    const files = resolveTestFiles(argv.filter(a => !a.startsWith('--')))
    let changed = 0, rewrites = 0, skipped = 0
    for (const rel of files) {
        const cell = cellOfFile(rel)
        if (!anyCell && !(cell && isSyncCell(cell))) { skipped++; continue }
        const text = readFileSync(abs(rel), 'utf8')
        const r = syncFile(text, rel)
        for (const w of r.warnings) console.log(`warning ${rel}: ${w}`)
        if (r.text === text) continue
        changed++
        rewrites += r.rewrites
        console.log(`${dryRun ? 'would change' : 'changed'} ${rel} (${r.rewrites} rewrites)`)
        if (!dryRun) writeFileSync(abs(rel), r.text)
    }
    console.log(`${files.length} files, ${changed} ${dryRun ? 'to change' : 'changed'}, ${rewrites} rewrites${skipped ? `, ${skipped} skipped (not in a -sync cell; --any-cell to include them)` : ''}`)
    return 0
}

if (isEntryPoint(import.meta.url, import.meta.main)) process.exit(main(process.argv.slice(2)))
