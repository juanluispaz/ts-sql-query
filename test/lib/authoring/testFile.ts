// Shared pieces of the test-authoring tools (`tests:propagate`, `tests:mark`,
// `tests:sync-transform`): the matrix cells, the reading of the tests of a cell
// file (live or commented out), their rendering back, the snapshots and the
// imports. See test/WRITING_TESTS.md § Adding a test.
//
// A cell file is read line by line, not with the compiler: a commented-out test
// is not in the syntax tree. A test is a `test(...)` at the indentation of the
// `describe` body (4 spaces) and ends at the first `    })` line; commented out,
// it is either a `/* … */` block (`    /*` … `    */`) or `//` lines (`    // ` in
// front of every line of the body), with its reason marker in the `//` lines
// above. That is the shape test/WRITING_TESTS.md describes and the audit reads.

import { existsSync, readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript6'

import { coordMatch } from '../coords.js'

/** The repository root, from the location of this file (test/lib/authoring/). */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Repository-relative path with `/` separators. */
export function repoRel(path: string): string {
    return relative(REPO_ROOT, resolve(REPO_ROOT, path)).split(sep).join('/')
}

export function abs(rel: string): string {
    return join(REPO_ROOT, rel)
}

/** Whether the module is the entry point (bun and Node ≥ 24 set `import.meta.main`; tsx needs the argv fallback). */
export function isEntryPoint(metaUrl: string, metaMain: boolean | undefined): boolean {
    const entryArg = process.argv[1]
    return metaMain === true || (!!entryArg && metaUrl === pathToFileURL(entryArg).href)
}

// ---------------------------------------------------------------------------
// Cells

export interface Cell {
    db: string
    version: string
    connector: string
    /** `test/db/<db>/<version>/<connector>` */
    dir: string
}

/** The reference cell of each database: the first cell of the database a change goes to. */
export const REFERENCE_CELLS: Readonly<Record<string, string>> = {
    postgres: 'postgres/newest/pg',
    mysql: 'mysql/newest/mysql2',
    mariadb: 'mariadb/newest/mariadb',
    sqlite: 'sqlite/newest/bun_sqlite',
    sqlserver: 'sqlserver/newest/mssql',
    oracle: 'oracle/newest/oracledb',
}

function isDir(p: string): boolean {
    try { return statSync(p).isDirectory() } catch { return false }
}

let cellsCache: Cell[] | undefined

/** Every matrix cell: a `test/db/<db>/<version>/<connector>` folder with a `setup.ts`
 *  (so `domain/`, `types.negative/` and the generated `documentation` cells are out). */
export function listCells(): Cell[] {
    if (cellsCache) return cellsCache
    const out: Cell[] = []
    const base = abs('test/db')
    for (const db of readdirSync(base).sort()) {
        if (!isDir(join(base, db))) continue
        for (const version of readdirSync(join(base, db)).sort()) {
            if (!isDir(join(base, db, version))) continue
            for (const connector of readdirSync(join(base, db, version)).sort()) {
                if (connector === 'documentation') continue
                const dir = join(base, db, version, connector)
                if (isDir(dir) && existsSync(join(dir, 'setup.ts'))) {
                    out.push({ db, version, connector, dir: `test/db/${db}/${version}/${connector}` })
                }
            }
        }
    }
    cellsCache = out
    return out
}

/** The cell a `<db>/<version>/<connector>` coord (or `test/db/…` path) names. */
export function cellOf(coord: string): Cell | undefined {
    const c = coord.replace(/^test\/db\//, '').replace(/\/$/, '')
    return listCells().find(x => cellCoord(x) === c)
}

export function cellCoord(c: Cell): string {
    return `${c.db}/${c.version}/${c.connector}`
}

/** The cell a repository-relative test file path is in. */
export function cellOfFile(rel: string): Cell | undefined {
    const p = rel.split('/')
    return p.length >= 6 ? cellOf(p.slice(2, 5).join('/')) : undefined
}

export function isSyncCell(c: Cell): boolean {
    return c.connector.endsWith('-sync')
}

/** `docs.select`, `docs.select.test.ts` or a path to it → `docs.select.test.ts`. */
export function testFileName(arg: string): string {
    const name = arg.split('/').pop() ?? arg
    return name.endsWith('.test.ts') ? name : name + '.test.ts'
}

/** The test files a list of arguments names: a path to a file, a path to a folder (its
 *  `*.test.ts`), or a coord `<db>/<version>/<connector>[/<file>]` with `*` and `{a,b}`
 *  (a file segment without `.ts` gets `.test.ts`). Repository-relative, sorted. */
export function resolveTestFiles(args: readonly string[]): string[] {
    const out = new Set<string>()
    for (const arg of args) {
        const p = resolve(process.cwd(), arg)
        if (existsSync(p) && !isDir(p)) { out.add(repoRel(p)); continue }
        if (isDir(p)) {
            for (const f of readdirSync(p)) if (f.endsWith('.test.ts')) out.add(repoRel(join(p, f)))
            continue
        }
        const segs = arg.replace(/^test\/db\//, '').split('/')
        if (segs.length === 4 && !segs[3]!.endsWith('.ts')) segs[3] = segs[3] + '.test.ts'
        const pattern = segs.join('/')
        let hit = false
        for (const c of listCells()) {
            if (!coordMatch(c, segs.slice(0, 3).join('/'))) continue
            for (const f of readdirSync(abs(c.dir)).sort()) {
                if (!f.endsWith('.test.ts')) continue
                if (segs.length === 4 && !coordMatch({ db: c.db, version: c.version, connector: c.connector, file: f }, pattern)) continue
                out.add(`${c.dir}/${f}`)
                hit = true
            }
        }
        if (!hit) throw new Error(`'${arg}' is neither a file nor a coord matching a test file`)
    }
    return [...out].sort()
}

// ---------------------------------------------------------------------------
// git

/** The file as it is in HEAD, or undefined when HEAD doesn't have it. */
export function gitHead(rel: string): string | undefined {
    const r = spawnSync('git', ['show', 'HEAD:' + rel], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    return r.status === 0 ? r.stdout : undefined
}

// ---------------------------------------------------------------------------
// Tests of a file

export const INDENT = '    '
/** `    // ` in front of each line of a test commented out with `//` lines. */
const LINE_PREFIX = INDENT + '// '
const TEST_LINE = /^ {4}test(?:\.\w+(?:\([^)]*\))?)?\((['"`])(.*?)\1/
const LINE_FORM_TEST = /^ {4}\/\/ ( {4}test(?:\.\w+(?:\([^)]*\))?)?\((['"`])(.*?)\2)/
const TEST_END = /^ {4}\}\)\s*;?\s*$/
const LINE_FORM_END = LINE_PREFIX + INDENT + '})'
/** The four reason markers of a disabled test (test/TESTS_AUDIT.md). */
export const MARKER_LINE = /^\s*\/\/\s*(TODO\[BUG\]|TODO\[LIMITATION\]|NOT-SUPPORTED|NOT-APPLICABLE):/

export type TestForm = 'live' | 'block' | 'line'

export interface TestBlock {
    name: string
    form: TestForm
    /** First line (its leading `//` comments included) and the line after the last. */
    start: number
    end: number
    /** The `//` comment lines right above the test (or above its `/*`); for a
     *  commented-out test, its reason marker. */
    pre: string[]
    /** The code of the test, uncommented, from its first line to its `    })` (for a
     *  commented-out test, also the comment lines inside the block before `test(`). */
    inner: string[]
}

export type TestShape = Pick<TestBlock, 'pre' | 'inner' | 'form'>

function isComment(line: string): boolean {
    return line.startsWith(INDENT + '//') && line !== LINE_FORM_END
}

function preStart(ls: readonly string[], from: number, allowGap: boolean): number {
    let s = from
    while (s > 0 && isComment(ls[s - 1]!)) s--
    // A test commented out with `//` lines has one blank line between its marker and its body.
    if (allowGap && s === from && s > 1 && ls[s - 1] === '' && isComment(ls[s - 2]!)) {
        s--
        while (s > 0 && isComment(ls[s - 1]!)) s--
    }
    return s
}

/** The tests of a file in order. A test that can't be delimited is left out (and reported). */
export function parseTests(text: string, warnings?: string[]): TestBlock[] {
    const ls = text.split('\n')
    const out: TestBlock[] = []
    for (let i = 0; i < ls.length; i++) {
        const line = ls[i]!
        if (line === INDENT + '/*') {
            const close = ls.findIndex((l, k) => k > i && l === INDENT + '*/')
            if (close < 0) continue
            const inner = ls.slice(i + 1, close)
            const names = inner.map(l => TEST_LINE.exec(l)?.[2]).filter((n): n is string => n !== undefined)
            if (names.length === 0) { i = close; continue }
            if (names.length > 1) warnings?.push(`one /* … */ block holds ${names.length} tests (${names.join(', ')}); read as '${names[0]}'`)
            const s = preStart(ls, i, false)
            out.push({ name: names[0]!, form: 'block', start: s, end: close + 1, pre: ls.slice(s, i), inner })
            i = close
            continue
        }
        const lm = LINE_FORM_TEST.exec(line)
        if (lm) {
            const close = ls.findIndex((l, k) => k > i && l === LINE_FORM_END)
            if (close < 0) { warnings?.push(`commented-out test '${lm[3]}' has no closing '${LINE_FORM_END}' line`); continue }
            const inner = ls.slice(i, close + 1).map(l => l.startsWith(LINE_PREFIX) ? l.slice(LINE_PREFIX.length) : l === INDENT + '//' ? '' : l)
            const s = preStart(ls, i, true)
            const pre = ls.slice(s, i)
            if (pre[pre.length - 1] === '') pre.pop()
            out.push({ name: lm[3]!, form: 'line', start: s, end: close + 1, pre, inner })
            i = close
            continue
        }
        const m = TEST_LINE.exec(line)
        if (m) {
            const close = ls.findIndex((l, k) => k > i && TEST_END.test(l))
            if (close < 0) { warnings?.push(`test '${m[2]}' has no closing '    })' line`); continue }
            const s = preStart(ls, i, false)
            out.push({ name: m[2]!, form: 'live', start: s, end: close + 1, pre: ls.slice(s, i), inner: ls.slice(i, close + 1) })
            i = close
        }
    }
    return out
}

export function testsByName(tests: readonly TestBlock[]): Map<string, TestBlock> {
    const m = new Map<string, TestBlock>()
    for (const t of tests) if (!m.has(t.name)) m.set(t.name, t)
    return m
}

/** The lines of a test: its `pre` comments, then the code, commented out per its form.
 *  A `/* … *\/` block is impossible when the code holds `*\/`: it is then written as `//`
 *  lines, with the one blank line after the marker test/WRITING_TESTS.md asks for. */
export function renderTest(t: TestShape): string[] {
    if (t.form === 'live') return [...t.pre, ...t.inner]
    if (t.form === 'block' && !t.inner.some(l => l.includes('*/'))) return [...t.pre, INDENT + '/*', ...t.inner, INDENT + '*/']
    return [...t.pre, ...(t.pre.length ? [''] : []), ...t.inner.map(l => l === '' ? INDENT + '//' : LINE_PREFIX + l)]
}

export function sameTest(a: TestShape, b: TestShape): boolean {
    return a.form === b.form && a.pre.join('\n') === b.pre.join('\n') && a.inner.join('\n') === b.inner.join('\n')
}

/** Rename a test in a file (its live or commented-out `test(` line); undefined when absent. */
export function renameTest(text: string, oldName: string, newName: string): string | undefined {
    let changed = false
    const out = text.split('\n').map(l => {
        const m = TEST_LINE.exec(l) ?? TEST_LINE.exec(l.replace(/^ {4}\/\/ /, ''))
        if (!m || m[2] !== oldName) return l
        const q = m[1]!
        const at = l.indexOf(q + oldName + q)
        changed = true
        return l.slice(0, at) + q + newName + q + l.slice(at + oldName.length + 2)
    })
    return changed ? out.join('\n') : undefined
}

// ---------------------------------------------------------------------------
// Snapshots

const SNAPSHOT = /\.toMatchInlineSnapshot\(\s*`(?:[^`\\]|\\.)*`\s*\)/gs

/** Empty every inline snapshot, so the next `--update-snapshots` bakes it. */
export function blankSnapshots(text: string): string {
    return text.replace(SNAPSHOT, '.toMatchInlineSnapshot()')
}

export function blankLines(lines: readonly string[]): string[] {
    return blankSnapshots(lines.join('\n')).split('\n')
}

// ---------------------------------------------------------------------------
// Imports (with the compiler, so multi-line imports are read too)

export interface NamedImport {
    spec: string
    typeOnly: boolean
    /** Element texts as written (`x`, `type X`, `a as b`). */
    elements: string[]
    start: number
    end: number
}

export function parseSource(text: string, fileName = 'file.ts'): ts.SourceFile {
    return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

export function namedImports(text: string): NamedImport[] {
    const sf = parseSource(text)
    const out: NamedImport[] = []
    for (const st of sf.statements) {
        if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue
        const clause = st.importClause
        if (!clause || clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue
        out.push({
            spec: st.moduleSpecifier.text,
            typeOnly: clause.isTypeOnly,
            elements: clause.namedBindings.elements.map(e => e.getText(sf)),
            start: st.getStart(sf),
            end: st.end,
        })
    }
    return out
}

/** The end offset of the last import declaration (0 without imports). */
export function lastImportEnd(text: string): number {
    const sf = parseSource(text)
    let end = 0
    for (const st of sf.statements) if (ts.isImportDeclaration(st)) end = st.end
    return end
}

export function localName(element: string): string {
    return element.replace(/^type\s+/, '').split(/\s+as\s+/).pop()!.trim()
}

/** The identifiers the live code of a file uses (imports, property names and declared
 *  member names left out; what is in a comment isn't code). */
export function usedIdentifiers(text: string): Set<string> {
    const sf = parseSource(text)
    const used = new Set<string>()
    const visit = (n: ts.Node): void => {
        if (ts.isImportDeclaration(n)) return
        if (ts.isIdentifier(n)) {
            const p = n.parent
            const skip = (ts.isPropertyAccessExpression(p) && p.name === n)
                || (ts.isPropertyAssignment(p) && p.name === n)
                || (ts.isQualifiedName(p) && p.right === n)
                || ((ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p) || ts.isMethodSignature(p)) && p.name === n)
            if (!skip) used.add(n.text)
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return used
}

function renderImport(typeOnly: boolean, elements: readonly string[], spec: string): string {
    return `import ${typeOnly ? 'type ' : ''}{ ${elements.join(', ')} } from '${spec}'`
}

export interface TextEdit { start: number, end: number, text: string }

/** Apply non-overlapping edits (any order). */
export function applyEdits(text: string, edits: readonly TextEdit[]): string {
    const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end)
    for (const e of sorted) text = text.slice(0, e.start) + e.text + text.slice(e.end)
    return text
}

/** Bring the named imports of `reference` that the live code of `text` uses and lacks,
 *  and drop the named-import elements its live code no longer uses (`noUnusedLocals`). */
export function mergeImports(text: string, reference: string): { text: string, added: string[], removed: string[] } {
    const added: string[] = []
    const removed: string[] = []
    let used = usedIdentifiers(text)
    let current = namedImports(text)
    const have = new Set(current.flatMap(d => d.elements.map(localName)))
    const additions = new Map<string, { typeOnly: boolean, spec: string, elements: string[] }>()
    for (const d of namedImports(reference)) {
        for (const e of d.elements) {
            const n = localName(e)
            if (!used.has(n) || have.has(n)) continue
            have.add(n)
            const key = (d.typeOnly ? 'type ' : '') + d.spec
            const a = additions.get(key) ?? { typeOnly: d.typeOnly, spec: d.spec, elements: [] }
            a.elements.push(e)
            additions.set(key, a)
            added.push(n)
        }
    }
    const edits: TextEdit[] = []
    const at = lastImportEnd(text)
    for (const a of additions.values()) {
        const target = current.find(d => d.spec === a.spec && d.typeOnly === a.typeOnly)
        if (target) edits.push({ start: target.start, end: target.end, text: renderImport(a.typeOnly, [...target.elements, ...a.elements], a.spec) })
        else edits.push({ start: at, end: at, text: (at ? '\n' : '') + renderImport(a.typeOnly, a.elements, a.spec) + (at ? '' : '\n') })
    }
    text = applyEdits(text, edits)
    used = usedIdentifiers(text)
    current = namedImports(text)
    const drops: TextEdit[] = []
    for (const d of current) {
        const kept = d.elements.filter(e => used.has(localName(e)))
        if (kept.length === d.elements.length) continue
        removed.push(...d.elements.filter(e => !used.has(localName(e))).map(localName))
        if (kept.length) drops.push({ start: d.start, end: d.end, text: renderImport(d.typeOnly, kept, d.spec) })
        else drops.push({ start: d.start, end: text[d.end] === '\n' ? d.end + 1 : d.end, text: '' })
    }
    return { text: applyEdits(text, drops), added, removed }
}

// ---------------------------------------------------------------------------
// Line diff (for the top-level declarations before `describe(`)

export interface Hunk {
    /** Lines of the old text the hunk replaces (empty for an insertion). */
    oldLines: string[]
    newLines: string[]
    /** The old line right before the hunk (undefined at the start). */
    before: string | undefined
}

export function diffLines(a: readonly string[], b: readonly string[]): Hunk[] {
    const n = a.length, m = b.length
    const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
        }
    }
    const hunks: Hunk[] = []
    let i = 0, j = 0
    let cur: Hunk | undefined
    while (i < n || j < m) {
        if (i < n && j < m && a[i] === b[j]) {
            if (cur) { hunks.push(cur); cur = undefined }
            i++; j++
            continue
        }
        cur ??= { oldLines: [], newLines: [], before: i > 0 ? a[i - 1] : undefined }
        if (j < m && (i >= n || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) { cur.newLines.push(b[j]!); j++ }
        else { cur.oldLines.push(a[i]!); i++ }
    }
    if (cur) hunks.push(cur)
    return hunks
}

/** The lines between the last import and the `describe(` line (line indexes `[from, to)`). */
export function topLevel(text: string): { from: number, to: number, lines: string[] } | undefined {
    const ls = text.split('\n')
    const d = ls.findIndex(l => l.startsWith('describe('))
    if (d < 0) return undefined
    const importEnd = lastImportEnd(text)
    const from = importEnd ? text.slice(0, importEnd).split('\n').length : 0
    return { from, to: d, lines: ls.slice(from, d) }
}

/** The lines of the `describe` body that are not tests (hooks, helpers), for a change warning. */
export function describeNonTestLines(text: string): string[] {
    const ls = text.split('\n')
    const d = ls.findIndex(l => l.startsWith('describe('))
    if (d < 0) return []
    const inTest = new Set<number>()
    for (const t of parseTests(text)) for (let k = t.start; k < t.end; k++) inTest.add(k)
    return ls.filter((l, k) => k > d && !inTest.has(k) && l.trim() !== '')
}
