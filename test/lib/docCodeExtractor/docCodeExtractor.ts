// Documentation code extractor — a standalone codegen (see
// test/DOC_CODE_EXTRACTOR.md). Extracts
// compilable TypeScript from the documentation code snippets so the doc examples
// are type-checked together with the normal compilation (src + test). The
// resulting files can also be reference-resolved by downstream tooling (e.g. the
// symbol index) with a real type-checker, but this tool does not depend on it.
// Extraction is PURELY TEXTUAL — no snippet parsing, no code transformation
// beyond the simple rules below; the user owns the templates' imports and the
// final compilation, iterating on the docs until everything compiles.
//
// Output: test/documentation/generated/ (gitignored via the `generated` rule;
// compiled by test/tsconfig's `**/*.ts`; outside src/ so naturally excluded from
// the publishable build).
//
// ── Fence-language classification (the doc author re-tags fences) ────────────
//   ```ts             runnable example, canonical / postgresql-based. Emitted
//                     inside a function. Every value declared (const/let/var/
//                     function/class/enum) gets a trailing `void <name>`, and
//                     every pure type declared (type/interface) is consumed by a
//                     trailing noop function parameter, so noUnusedLocals is
//                     happy. A ```ts inside a mkdocs dialect tab (=== "MariaDB")
//                     is emitted into that db's template instead of postgresql.
//   ```tsx            query result-type annotation → NOT emitted.
//   ```typescript     simplified type declarations → emitted into the
//                     simplifiedDefinition template, at module level (no
//                     function wrapper), grouped per page in a namespace so
//                     cross-page duplicate type names don't collide while
//                     within-page references still resolve.
//   ```typescriptreact pseudocode illustration → NOT emitted.
//
// ── Templates ───────────────────────────────────────────────────────────────
// Each output file is built from an existing template under doc-code-templates/
// by replacing its `// Generated code here` marker. The template (and its
// imports) is used verbatim — the user maintains the imports there so the same
// template works in both places.
//
// ── Per-file template override ──────────────────────────────────────────────
// A doc page may pin ITSELF to a specific template with an invisible HTML
// comment (renders to nothing in markdown):
//     <!-- doc-code-template: my-template -->
// When present, ALL of that page's snippets are routed to
// doc-code-templates/<my-template>.ts instead of the default routing — `ts`
// blocks emitted wrapped in a function (as usual, ignoring any dialect tab),
// `typescript` blocks emitted at module level (as usual). This lets the user
// isolate doc sections that discuss very specific elements into their own
// self-contained template. Targets COMBINE: several pages may point at the same
// override template, and an override may name an existing db template (or
// simplifiedDefinition) to ADD its snippets to that template rather than replace
// it.
//
// ── Per-snippet template directive ──────────────────────────────────────────
// A SINGLE snippet can be re-routed (without affecting the rest of the page) by
// placing this comment on the line IMMEDIATELY before its fence:
//     <!-- doc-code-snippet-template: my-template -->
//     ```ts
// It routes just that snippet to the named template, keeping its emission style
// (ts → function, typescript → module level). Precedence (most specific wins):
// per-snippet directive › per-page override › default (dialect tab / postgresql
// for ts, simplifiedDefinition for typescript).
//
// ── Per-file substitution rules ─────────────────────────────────────────────
// SUBSTITUTIONS lets the user turn explanatory comments inside snippets into
// real code via plain text replacement (text → text), applied to each snippet
// before emission. Add entries as needed.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { walkFiles } from './walk.js'

const TEMPLATES_DIR = 'test/documentation/doc-code-templates'
const OUT_DIR = 'test/documentation/generated'
const MARKER = '// Generated code here'
const DEFAULT_DB = 'postgresql'                  // ts snippets with no dialect tab
const SIMPLIFIED_TEMPLATE = 'simplifiedDefinition' // default target for typescript snippets

// Invisible (post-render) per-file directive pinning a whole doc page to one
// template: `<!-- doc-code-template: my-template -->`. See header comment.
const TEMPLATE_DIRECTIVE = /<!--\s*doc-code-template:\s*([A-Za-z0-9_.-]+)\s*-->/

// Invisible per-SNIPPET directive: placed on the line IMMEDIATELY before a fence,
// it routes only THAT snippet to the named template (more specific than the
// per-page directive). Distinct token so it never matches TEMPLATE_DIRECTIVE.
const SNIPPET_DIRECTIVE = /<!--\s*doc-code-snippet-template:\s*([A-Za-z0-9_.-]+)\s*-->/

// mkdocs tab label → db template basename (a ```ts inside that tab is db-specific)
const LABEL_TO_DB: Record<string, string> = {
    MariaDB: 'mariadb',
    MySQL: 'mysql',
    Oracle: 'oracle',
    PostgreSQL: 'postgresql',
    SQLite: 'sqlite',
    'SQL Server': 'sqlserver',
}

// Simple comment→code text substitutions applied to every snippet body before
// emission (plain replaceAll, in order). Filled in by the doc author.
const SUBSTITUTIONS: { from: string; to: string }[] = [
    // Example:
    // { from: `// return a BooleanValueSource based on the value`, to: `return connection.true()` },
    { from: `// TsSqlError's constructor implementation ...`, to: `constructor(errorReason: TsSqlErrorReason, messageOrCause: any, cause?: any) { super(messageOrCause, cause); this.errorReason = errorReason; /* dummy implementation*/ }` },
    { from: `// TsSqlQueryExecutionError's constructor implementation ...`, to: `constructor(source: QueryExecutionSource, errorReason: TsSqlErrorReason, messageOrCause: any, cause?: any) { super(errorReason, messageOrCause, cause); this.source = source; /* dummy implementation*/ }` },
    { from: `// TsSqlQueryExecutionError's attachTransactionSource implementation ...`, to: `{ void source; return this; /* dummy implementation*/ }` },
    { from: `// TsSqlQueryExecutionError's attachRollbackError implementation ...`, to: `{ void error; return this; /* dummy implementation*/ }` },
    { from: `// TsSqlQueryExecutionError's attachTransactionError implementation ...`, to: `{ void error; return this; /* dummy implementation*/ }` },
    { from: `// TsSqlQueryExecutionError's attachAdditionalError implementation ...`, to: `{ void additional; void name; return this; /* dummy implementation*/ }` },
    { from: `// QueryExecutionSource's constructor implementation ...`, to: `{ super(message); /* dummy implementation*/ }` },
    { from: `// TsSqlProcessingError's constructor implementation ...`, to: `constructor(errorReason: TsSqlErrorReason, messageOrCause: any, cause?: any) { super(errorReason, messageOrCause, cause); /* dummy implementation*/ }` },
    { from: `// CustomBooleanTypeAdapter's constructor implementation ...`, to: `constructor(trueValue: any, falseValue: any) { this.trueValue = trueValue; this.falseValue = falseValue; /* dummy implementation*/ }` },
    { from: `// CustomBooleanTypeAdapter's transformValueFromDB implementation ...`, to: `{ return next.transformValueFromDB(value, type); /* dummy implementation*/ }` },
    { from: `// CustomBooleanTypeAdapter's transformValueToDB implementation ...`, to: `{ return next.transformValueToDB(value, type); /* dummy implementation*/ }` },
    { from: `// ForceTypeCast's transformValueFromDB implementation ...`, to: `{ return next.transformValueFromDB(value, type); /* dummy implementation*/ }` },
    { from: `// ForceTypeCast's transformValueToDB implementation ...`, to: `{ return next.transformValueToDB(value, type); /* dummy implementation*/ }` },
    { from: `// ForceTypeCast's transformPlaceholder implementation ...`, to: `{ return next.transformPlaceholder(placeholder, type, forceTypeCast, valueSentToDB); /* dummy implementation*/ }` },
    { from: `new NodeSqliteQueryRunner(db`, to: `new NodeSqliteQueryRunner(db as any` },
    { from: `new Sqlite3QueryRunner(db`, to: `new Sqlite3QueryRunner(db as any` },
    { from: `new BetterSqlite3QueryRunner(db`, to: `new BetterSqlite3QueryRunner(db as any` },
    { from: `new BunSqliteQueryRunner(db`, to: `new BunSqliteQueryRunner(db as any` },
    { from: `new Sqlite3WasmOO1QueryRunner(db`, to: `new Sqlite3WasmOO1QueryRunner(db as any` },
    { from: `const db: Database = new sqlite3.oo1.DB()`, to: `const db = new sqlite3.oo1.DB()` },
    { from: `// Your DurationLogginQueryRunner's onQueryResult implementation ...`, to: `void queryType; void query; void params; void result; void playload; /* dummy implementation*/` },
    { from: `// Your DurationLogginQueryRunner's onQueryError implementation ...`, to: `void queryType; void query; void params; void error; void playload; /* dummy implementation*/` },
    { from: `// Use customerForUpdate as a view in your query`, to: `void customerForUpdate; // Use customerForUpdate as a view in your query` },
    { from: `// MockQueryRunner: verify your queries here`, to: `void type; void query; void params; void index; // MockQueryRunner: verify your queries here` },
    { from: `test(`, to: `_test(` },
    { from: `expect(`, to: `_expect(` },
    { from: `beforeEach(`, to: `_beforeEach(` },
    // { from: `// return a BooleanValueSource based on the value`, to: `return connection.true()` },
]

// ── markdown fence scanner ───────────────────────────────────────────────────
// `tabLabel` is the mkdocs dialect tab a fenced block lives in (=== "MariaDB"),
// used only to attribute an indented ```ts to a specific db. A tab header at
// column 0 OPENS a tab group; any OTHER column-0 non-blank line (prose, a
// heading, an `!!! info` admonition, a column-0 fence) CLOSES it — so an
// indented ```ts inside an admonition is NOT mistaken for a dialect example.
// `startLine` is the 1-based source line of the opening fence (for navigation).
// `snippetTemplate` is the per-snippet template named by a `<!-- doc-code-
// snippet-template: NAME -->` comment on the line IMMEDIATELY before the fence.
interface Block { lang: string; body: string[]; tabLabel: string | null; startLine: number; snippetTemplate: string | null }

function scanBlocks(text: string): Block[] {
    const lines = text.split('\n')
    const blocks: Block[] = []
    let i = 0
    let lastTab: string | null = null
    while (i < lines.length) {
        const line = lines[i]!
        const tab = /^={3}\+?\s+"(.+?)"/.exec(line)
        if (tab) { lastTab = tab[1]!; i++; continue }
        const m = /^(\s*)```([\w-]+)\s*$/.exec(line)
        if (m) {
            const indent = m[1]!, lang = m[2]!
            const startLine = i + 1
            // a per-snippet directive on the immediately-preceding line wins
            const snippetTemplate = (i > 0 ? SNIPPET_DIRECTIVE.exec(lines[i - 1]!)?.[1] : null) ?? null
            const closer = new RegExp('^' + indent + '```\\s*$')
            const body: string[] = []
            i++
            while (i < lines.length && !closer.test(lines[i]!)) {
                body.push(indent && lines[i]!.startsWith(indent) ? lines[i]!.slice(indent.length) : lines[i]!)
                i++
            }
            i++
            blocks.push({ lang, body, tabLabel: indent ? lastTab : null, startLine, snippetTemplate })
            if (!indent) lastTab = null   // a column-0 fence ends the tab group
            continue
        }
        // any column-0 non-blank, non-tab line closes the current tab group
        if (line.trim() !== '' && !/^\s/.test(line)) lastTab = null
        i++
    }
    return blocks
}

// ── text-only snippet operations ─────────────────────────────────────────────

// Drop import statements (single or multi-line). The user maintains imports in
// the templates; snippets must not carry their own.
function stripImports(code: string): string {
    const lines = code.split('\n')
    const out: string[] = []
    for (let i = 0; i < lines.length; i++) {
        if (!/^\s*import\b/.test(lines[i]!)) { out.push(lines[i]!); continue }
        // consume until the line that closes the import statement
        while (i < lines.length && !/from\s+['"][^'"]+['"]|^\s*import\s+['"][^'"]+['"]/.test(lines[i]!)) i++
        // current line (with `from '…'`) is part of the import → skip it too
    }
    return out.join('\n')
}

function applySubstitutions(code: string): string {
    let out = code
    for (const { from, to } of SUBSTITUTIONS) out = out.split(from).join(to)
    return out
}

// Net nesting contribution of a string, counting `{([` as +1 and `}])` as -1.
// Used to gate detection to the snippet's FIRST level only: a declaration nested
// inside any block / group (an `if`/`for`/function body, an object literal, a
// `for (const …)` header) is block-scoped, so a trailing `void`/noop at the
// function's end couldn't reference it anyway — and the doc author handles those
// by hand. Text-only, so braces inside strings/comments may miscount (rare).
function netDepth(s: string): number {
    let d = 0
    for (const ch of s) {
        if (ch === '{' || ch === '(' || ch === '[') d++
        else if (ch === '}' || ch === ')' || ch === ']') d--
    }
    return d
}

// Detect FIRST-LEVEL VALUE declarations to mark used with a trailing `void NAME`.
// Text-only heuristic: matches `const|let|var NAME`, destructuring
// `const {a, b} = …` / `const [a, b] = …`, `function NAME` / `async function
// NAME`, and the value-and-type declarations `class NAME` / `enum NAME` (both
// have a runtime value, so `void NAME` references them without needing type
// arguments). Only declarations at depth 0 (not nested in any block) are taken.
function declaredNames(code: string): string[] {
    const names = new Set<string>()
    const lines = code.split('\n')
    let depth = 0
    for (const l of lines) {
        if (depth === 0) {
            let m = /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[=:;]/.exec(l)
            if (m) { names.add(m[1]!) }
            else if ((m = /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(l))) { names.add(m[1]!) }
            else if ((m = /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(l))) { names.add(m[1]!) }
            else if ((m = /^\s*(?:export\s+)?(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)/.exec(l))) { names.add(m[1]!) }
            // destructuring: const { a, b: c, d = 1 } = …   /   const [a, , b] = …
            else if ((m = /^\s*(?:export\s+)?(?:const|let|var)\s+([{[][^=]*[}\]])\s*=/.exec(l))) {
                const inner = m[1]!.slice(1, -1)
                for (const part of inner.split(',')) {
                    const id = /([A-Za-z_$][\w$]*)\s*(?::\s*([A-Za-z_$][\w$]*))?/.exec(part.trim())
                    if (id) names.add(id[2] ?? id[1]!)   // renamed → use the local (rhs) name
                }
            }
        }
        depth += netDepth(l)
        if (depth < 0) depth = 0   // tolerate unbalanced text
    }
    return [...names]
}

// Detect FIRST-LEVEL PURE-TYPE declarations (`type NAME` / `interface NAME`)
// that have no runtime value, so `void NAME` can't reference them. They are
// instead consumed in type position by a noop function parameter (see
// emitFunction). Only depth-0 declarations are taken (nested ones are the doc
// author's to handle). Returns a reference string per declaration, with
// `<any, …>` filled to the declared type-parameter count so generic
// declarations don't error on bare use.
function declaredTypeRefs(code: string): string[] {
    const refs: string[] = []
    const re = /(?:^|\n)[ \t]*(?:export[ \t]+)?(?:type|interface)[ \t]+([A-Za-z_$][\w$]*)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(code))) {
        if (netDepth(code.slice(0, m.index)) !== 0) continue   // first level only
        const name = m[1]!
        let idx = m.index + m[0].length
        while (idx < code.length && /\s/.test(code[idx]!)) idx++
        let typeParams = 0
        if (code[idx] === '<') {
            // balance angle brackets; count top-level commas (ignoring (), [], {})
            let angle = 0, other = 0, commas = 0, hasContent = false
            for (; idx < code.length; idx++) {
                const ch = code[idx]!
                if (ch === '<') { angle++; continue }
                if (ch === '>') { angle--; if (angle === 0) break; continue }
                if (ch === '(' || ch === '[' || ch === '{') other++
                else if (ch === ')' || ch === ']' || ch === '}') other--
                else if (ch === ',' && angle === 1 && other === 0) commas++
                if (!/\s/.test(ch)) hasContent = true
            }
            typeParams = hasContent ? commas + 1 : 0
        }
        const args = typeParams > 0 ? '<' + Array(typeParams).fill('any').join(', ') + '>' : ''
        refs.push(name + args)
    }
    return refs
}

// ── emission ─────────────────────────────────────────────────────────────────
// `line` is the snippet's 1-based source line in its .md page (used for both the
// comment and the generated identifier, so they point back to the exact fence).
interface Snippet { code: string; page: string; line: number }

// The statements that mark a snippet's FIRST-LEVEL declarations as used, so
// noUnusedLocals stays happy — used by BOTH emission paths (inside the function
// for `ts`, at module level for `typescript`). Returned WITHOUT indentation:
//   - each value (const/let/var/function/class/enum) → `void NAME;`
//   - all pure types (type/interface) → a single noop function consuming them in
//     parameter position; params are `_`-prefixed so noUnusedParameters ignores
//     them, and the function expression is `void`-ed so it counts as used itself.
function usageMarks(body: string): string[] {
    const marks = declaredNames(body).map(n => `void ${n};`)
    const typeRefs = declaredTypeRefs(body)
    if (typeRefs.length) {
        marks.push(`void function (${typeRefs.map((t, i) => `_${i}: ${t}`).join(', ')}) {};`)
    }
    return marks
}

// The extracted snippet body is wrapped in BEGIN/END markers (carrying the
// source page:line) so a reader can tell EXACTLY which lines are the extracted
// doc code and which are generated scaffolding — the function wrapper, the
// `void` usage marks, and the noop type function all sit OUTSIDE BEGIN…END.
function beginMark(s: Snippet): string { return `// BEGIN ${s.page}:${s.line}` }
function endMark(s: Snippet): string { return `// END ${s.page}:${s.line}` }

function emitFunction(s: Snippet, id: string): string {
    const body = applySubstitutions(stripImports(s.code))
    const tail = usageMarks(body).map(l => '    ' + l)
    const tailStr = tail.length ? tail.join('\n') + '\n' : ''
    // wrapper · BEGIN · body · END · usage marks · close · void id  (marks outside)
    return `async function ${id}() {\n${beginMark(s)}\n${body}\n${endMark(s)}\n${tailStr}}\nvoid ${id};`
}

// `typescript` (simplified type declarations) are emitted at module level, in
// the same order they appear. No namespace wrapper: the doc author keeps the
// declarations collision-free across pages. The same usage marks are appended at
// module level so unreferenced first-level decls don't trip noUnusedLocals —
// again kept OUTSIDE the BEGIN…END markers that fence the extracted body.
function emitModuleLevel(s: Snippet): string {
    const body = applySubstitutions(stripImports(s.code))
    const tail = usageMarks(body)
    const tailStr = tail.length ? '\n' + tail.join('\n') : ''
    return `${beginMark(s)}\n${body}\n${endMark(s)}${tailStr}`
}

function ident(page: string, line: number): string {
    return page.replace(/[^A-Za-z0-9]/g, '_') + '__L' + line
}

function renderTemplate(templateBasename: string, generated: string): string {
    const path = join(TEMPLATES_DIR, templateBasename + '.ts')
    const tpl = readFileSync(path, 'utf8')
    if (!tpl.includes(MARKER)) throw new Error(`Template ${path} is missing the "${MARKER}" marker`)
    return tpl.replace(MARKER, generated)
}

export interface DocCodeResult {
    // template basename → how many ts (function-wrapped) and typescript
    // (module-level) snippets landed in it
    perTemplate: Record<string, { ts: number; typescript: number }>
    skipped: { tsx: number; tsr: number }
    files: string[]
}

// One snippet routed to a template, tagged with how it must be emitted:
// 'ts' → wrapped in an async function; 'typescript' → module-level declarations.
interface TemplateEntry { kind: 'ts' | 'typescript'; snippet: Snippet }

export function extractDocCode(): DocCodeResult {
    // Collect every snippet against its TARGET TEMPLATE. Routing:
    //   ts          → the page's override template, else its dialect-tab db, else postgresql
    //   typescript  → the page's override template, else simplifiedDefinition
    // Several pages — and the default routing — can feed the SAME template; their
    // entries simply combine (so an override can point at an existing db template
    // to add to it). Entries are ordered by (page, line) at emission.
    const byTemplate = new Map<string, TemplateEntry[]>()
    let tsx = 0, tsr = 0

    const add = (tpl: string, entry: TemplateEntry): void => {
        const list = byTemplate.get(tpl) ?? []
        list.push(entry)
        byTemplate.set(tpl, list)
    }

    for (const f of walkFiles('docs', '.md')) {
        const text = readFileSync(f, 'utf8')
        const override = TEMPLATE_DIRECTIVE.exec(text)?.[1] ?? null
        for (const b of scanBlocks(text)) {
            if (b.lang === 'tsx') { tsx++; continue }
            if (b.lang === 'typescriptreact') { tsr++; continue }
            if (b.lang !== 'ts' && b.lang !== 'typescript') continue
            const snippet: Snippet = { code: b.body.join('\n'), page: f, line: b.startLine }
            // precedence: per-snippet directive › per-page override › default
            if (b.lang === 'ts') {
                add(b.snippetTemplate ?? override ?? ((b.tabLabel && LABEL_TO_DB[b.tabLabel]) || DEFAULT_DB), { kind: 'ts', snippet })
            } else {
                add(b.snippetTemplate ?? override ?? SIMPLIFIED_TEMPLATE, { kind: 'typescript', snippet })
            }
        }
    }

    if (existsSync(OUT_DIR)) for (const f of readdirSync(OUT_DIR)) rmSync(join(OUT_DIR, f))
    mkdirSync(OUT_DIR, { recursive: true })

    const files: string[] = []
    const perTemplate: Record<string, { ts: number; typescript: number }> = {}

    for (const tpl of [...byTemplate.keys()].sort()) {
        const entries = byTemplate.get(tpl)!.slice().sort((a, b) =>
            a.snippet.page === b.snippet.page
                ? a.snippet.line - b.snippet.line
                : a.snippet.page.localeCompare(b.snippet.page))
        const counts = { ts: 0, typescript: 0 }
        const safe = tpl.replace(/[^A-Za-z0-9]/g, '_')
        const generated = entries.map(e => {
            counts[e.kind]++
            return e.kind === 'ts'
                ? emitFunction(e.snippet, `ex_${safe}_${ident(e.snippet.page, e.snippet.line)}`)
                : emitModuleLevel(e.snippet)
        }).join('\n\n')
        perTemplate[tpl] = counts
        const out = join(OUT_DIR, tpl + '.ts')
        writeFileSync(out, renderTemplate(tpl, generated))
        files.push(out)
    }

    return { perTemplate, skipped: { tsx, tsr }, files }
}

// Standalone entry. `import.meta.main` covers bun (and Node ≥24); the argv
// fallback covers tsx / Node < 24, where `import.meta.main` is undefined.
const entryArg = process.argv[1]
const runDirectly = import.meta.main === true
    || (!!entryArg && import.meta.url === pathToFileURL(entryArg).href)
if (runDirectly) {
    const r = extractDocCode()
    console.log('documentation code extracted into ' + OUT_DIR)
    for (const [tpl, c] of Object.entries(r.perTemplate)) {
        const parts = [c.ts ? `${c.ts} ts` : '', c.typescript ? `${c.typescript} typescript` : ''].filter(Boolean).join(', ')
        console.log(`  ${tpl}.ts: ${parts}`)
    }
    console.log(`  skipped: ${r.skipped.tsx} tsx, ${r.skipped.tsr} typescriptreact`)
}
