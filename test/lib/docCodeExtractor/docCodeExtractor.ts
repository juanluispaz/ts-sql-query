// Documentation code extractor — a standalone codegen (see
// test/DOC_CODE_EXTRACTOR.md). Its PURPOSE is to TEST the documentation's code
// examples: it turns the doc snippets into matrix test cells that (1) type-check
// every ```ts/```typescript example against the real library, and (2) run each
// query against a mock and assert the emitted SQL equals the SQL the docs show.
// So the docs can't drift from the library — compilation and SQL are both covered.
// (The type-checked corpus is ALSO reusable by downstream tooling such as the
// symbol-index searcher, but that is an ADDITIONAL benefit, not the goal, and this
// tool doesn't depend on it.)
// Extraction is PURELY TEXTUAL — no snippet parsing, no code transformation
// beyond the simple rules below; the user owns the templates' imports and the
// final compilation, iterating on the docs until everything compiles.
//
// Output: ORDINARY matrix cells (gitignored via `*.generated.test.ts`; compiled
// by test/tsconfig's `**/*.ts`; outside src/ so naturally excluded from the
// publishable build). Each db template → test/db/<db>/newest/documentation/
// doc-code.generated.test.ts; the non-db (general) templates → test/db/general/
// newest/documentation/<name>.generated.test.ts. So docs tests are normal matrix
// cells with no runner special-casing. Templates live at the SAME path depth
// (test/templates/doc-code/newest/documentation/<db-or-name>.ts), so a template's
// relative imports stay valid verbatim in the generated file.
//
// ── Two purposes ─────────────────────────────────────────────────────────────
// (1) COMPILE: every ```ts/```typescript snippet becomes compilable TypeScript,
//     type-checked with the rest of test/. (2) SQL TESTS: a ```ts paired with a
//     dialect SQL fence becomes a mock test asserting the emitted SQL == the
//     documented SQL. Full picture: test/DOC_CODE_EXTRACTOR.md.
//
// ── Fence-language classification (the doc author re-tags fences) ────────────
//   ```ts             runnable example. If a dialect SQL fence (```mariadb,
//                     ```postgresql, …) FOLLOWS it, it becomes a SQL test() in
//                     each such db (asserting that SQL); otherwise a compile-only
//                     async function in its routed template (postgresql default,
//                     or its mkdocs dialect tab). Every first-level value declared
//                     gets a trailing `void <name>`, every pure type a trailing
//                     noop function param, so noUnusedLocals is happy.
//                     A ```ts whose body is only `//` comments is "no query" and is
//                     DROPPED (no test/fn, no absorbing the following SQL fences),
//                     like a `--`-only SQL fence. A ```ts inside a db tab asserts
//                     only its OWN db's SQL (per-db query tabs); a column-0 ```ts
//                     asserts every following db's SQL.
//   ```<dialect>      generated SQL per db (mariadb|mysql|oracle|postgresql|
//                     sqlite|sqlserver) → consumed as the expected SQL for the
//                     preceding ```ts. A fence with only `-- comments` = the
//                     query doesn't apply to that db → no test.
//   ```tsx            query result-type annotation → NOT emitted, but read to
//                     shape the dummy mock row for a *One() query (see defaultSeeds).
//   ```typescript     simplified type declarations → emitted at module level into
//                     the simplifiedDefinition template (no function wrapper).
//   ```typescriptreact pseudocode illustration → NOT emitted.
//
// ── Templates ───────────────────────────────────────────────────────────────
// Each output file is built from an existing template under
// test/templates/doc-code/newest/documentation/ by replacing its `// Generated
// code here` marker. The template (and its imports) is used verbatim — the user
// maintains the imports there so the same template works in both places. Db
// templates are named by db folder (postgresql → postgres.ts); non-db ones keep
// their name (simplifiedDefinition.ts, …).
//
// ── Per-file template override ──────────────────────────────────────────────
// A doc page may pin ITSELF to a specific template with an invisible HTML
// comment (renders to nothing in markdown):
//     <!-- doc-code-template: my-template -->
// When present, ALL of that page's snippets are routed to the `my-template`
// template instead of the default routing — `ts`
// blocks emitted wrapped in a function (as usual, ignoring any dialect tab),
// `typescript` blocks emitted at module level (as usual). This lets the user
// isolate doc sections that discuss very specific elements into their own
// self-contained template. Targets COMBINE: several pages may point at the same
// override template, and an override may name an existing db template (or
// simplifiedDefinition) to ADD its snippets to that template rather than replace
// it.
//
// ── Per-snippet template directive (for snippets WITHOUT SQL) ────────────────
// On the line IMMEDIATELY before a fence, re-routes a compile-only ```ts or a
// ```typescript to the named template(s). Accepts a COMMA-SEPARATED list to emit
// into several at once (a db-specific example that only compiles in those):
//     <!-- doc-code-snippet-template: mariadb, mysql, oracle -->
//     ```typescript
// A ```ts WITH a dialect SQL fence is routed by its fences, NOT by this directive.
// Precedence (most specific wins): per-snippet › per-page override › default.
//
// ── Per-snippet mock result ──────────────────────────────────────────────────
// On a comment line just before a ```ts, set the mock's result for a query when
// the per-QueryType heuristic value isn't enough (→ docCodeMock.next):
//     <!-- doc-code-snippet-result: { id: 1, name: 'x' } -->
//     ```ts
// STACK several (document order) to seed successive queries of a multi-query
// snippet; combinable with doc-code-snippet-template (the run of comment lines
// just above the fence is read whole, any order). With NO doc-code-snippet-result, a
// snippet whose terminal call is `execute*NoneOrOne` is seeded `null` (no row) —
// the heuristic can't tell it from the required variant it shares a QueryType
// with, which it seeds `{}`.
//
// ── Per-file substitution rules ─────────────────────────────────────────────
// SUBSTITUTIONS lets the user turn explanatory comments inside snippets into
// real code via plain text replacement (text → text), applied to each snippet
// before emission. Add entries as needed.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { walkFiles } from './walk.js'

const TEMPLATES_DIR = 'test/templates/doc-code/newest/documentation'
// Generated docs tests are ORDINARY matrix cells (no runner special-casing): each
// db template lands in that db's `newest/documentation` cell as `doc-code.generated
// .test.ts`; the non-db (general) templates land in a synthetic `general` db,
// keeping their own name. Template files live at the SAME depth as the generated
// files (test/<a>/<b>/<c>/<d>/file), so their relative imports work verbatim once
// copied. See test/DOC_CODE_EXTRACTOR.md.
const DB_OUT_DIR = 'test/db'
// Routing key (a db DIALECT, or a non-db template name) → db folder under test/db.
// Only `postgresql` differs from its dialect name (folder `postgres`).
const DB_FOLDER: Record<string, string> = { postgresql: 'postgres' }
const MARKER = '// Generated code here'

// The template FILE basename for a routing key: a db dialect uses its db-folder
// name (so it matches test/db/<folder>), a non-db template keeps its own name.
function templateFileBase(tpl: string): string {
    return DIALECT_LANGS.has(tpl) ? (DB_FOLDER[tpl] ?? tpl) : tpl
}
// The generated-output path for a routing key.
function outputFor(tpl: string): string {
    return DIALECT_LANGS.has(tpl)
        ? join(DB_OUT_DIR, DB_FOLDER[tpl] ?? tpl, 'newest', 'documentation', 'doc-code.generated.test.ts')
        : join(DB_OUT_DIR, 'general', 'newest', 'documentation', tpl + '.generated.test.ts')
}
const DEFAULT_DB = 'postgresql'                  // ts snippets with no dialect tab
const SIMPLIFIED_TEMPLATE = 'simplifiedDefinition' // default target for typescript snippets

// Invisible (post-render) per-file directive pinning a whole doc page to one
// template: `<!-- doc-code-template: my-template -->`. See header comment.
const TEMPLATE_DIRECTIVE = /<!--\s*doc-code-template:\s*([A-Za-z0-9_.-]+)\s*-->/

// Invisible per-SNIPPET directive: placed on the line IMMEDIATELY before a fence,
// it routes a snippet WITHOUT SQL (a compile-only ```ts, or a ```typescript) to
// the named template(s). Accepts a COMMA-SEPARATED list (`mariadb, sqlite,
// oracle`) to emit the same snippet into several templates at once — e.g. a
// db-specific example that only compiles in those connections. A ```ts WITH
// dialect SQL is routed by its SQL fences, NOT by this directive. Distinct token
// so it never matches TEMPLATE_DIRECTIVE.
const SNIPPET_DIRECTIVE = /<!--\s*doc-code-snippet-template:\s*([^>]+?)\s*-->/

// Invisible per-snippet escape hatch: `<!-- doc-code-snippet-result: <expr> -->` on a
// comment line just before a ```ts fence sets the mock's result for a query in
// the snippet — when the per-`QueryType` heuristic value isn't enough (a single-
// row projection that reads a specific field, a multi-query snippet whose values
// matter). It becomes `docCodeMock.next(<expr>)`. STACK several (document order)
// to seed successive queries; combinable with doc-code-snippet-template. Matched
// globally so all occurrences in the directive run are collected.
const RESULT_DIRECTIVE = /<!--\s*doc-code-snippet-result:\s*(.+?)\s*-->/g

// Split a TS object-literal body (the text between `{` and `}`) into its
// first-level `key[?]: type` fields, respecting nested `{}` / `[]` / `<>` so a
// field's own braces don't end it. Fields are `;`-separated in the doc result
// types (a trailing `;` is tolerated).
function parseTsObjectFields(body: string): { key: string; optional: boolean; type: string }[] {
    const fields: { key: string; optional: boolean; type: string }[] = []
    let depth = 0, start = 0
    const push = (seg: string): void => {
        const m = /^\s*([A-Za-z_$][\w$]*)\s*(\??)\s*:\s*([\s\S]+?)\s*$/.exec(seg)
        if (m) fields.push({ key: m[1]!, optional: m[2] === '?', type: m[3]! })
    }
    for (let i = 0; i < body.length; i++) {
        const c = body[i]!
        if (c === '{' || c === '[' || c === '<') depth++
        else if (c === '}' || c === ']' || c === '>') depth--
        else if (c === ';' && depth === 0) { push(body.slice(start, i)); start = i + 1 }
    }
    push(body.slice(start))
    return fields
}

// A single JS literal value matching a leaf TS type (the value only has to pass
// the column's from-DB transform; these tests assert SQL, not values).
function leafDummy(type: string): string {
    if (/\bDate\b/.test(type)) return 'new Date(0)'
    if (/\bbigint\b/.test(type)) return '0n'
    if (/\bnumber\b/.test(type)) return '0'
    if (/\bboolean\b/.test(type)) return 'false'
    if (/\bstring\b/.test(type)) return "'x'"   // non-empty: an empty string reads as null and a required column would throw
    return 'null'
}

// Collect the FLAT row a `*One()` projection reads, from its documented result
// type. ts-sql-query reads inner-object projections from dotted column aliases
// (`customer.first_name as "name.firstName"`), so a nested `{ name: { firstName }}`
// becomes the flat key `"name.firstName"`; an aggregated array / list is a single
// column → `[]`; optional fields are skipped (their column may be absent/null).
function collectRow(type: string, path: string, out: [string, string][]): void {
    type = type.trim()
    if (/\[\]\s*$/.test(type) || /^readonly\b/.test(type) || /^Array\s*</.test(type)) { out.push([path, '[]']); return }
    if (type.startsWith('{')) {
        const body = type.slice(type.indexOf('{') + 1, type.lastIndexOf('}'))
        for (const f of parseTsObjectFields(body)) {
            if (f.optional) continue
            collectRow(f.type, path ? path + '.' + f.key : f.key, out)
        }
        return
    }
    out.push([path, leafDummy(type)])
}

// Build the dummy mock result for a `*One()` query from the ```tsx result type
// (`const v: Promise<T>`). An object T → a flat row keyed by dotted alias; a
// scalar T → that scalar; an array T → `[]`. Returns null when there's no usable
// result type, so the caller falls back to the heuristic.
function dummyFromResultType(resultType: string | null): string | null {
    if (!resultType) return null
    const m = /Promise\s*<([\s\S]*)>/.exec(resultType)
    if (!m) return null
    const inner = m[1]!.trim()
    if (inner.startsWith('{')) {
        const row: [string, string][] = []
        collectRow(inner, '', row)
        return '{ ' + row.map(([k, v]) => `${JSON.stringify(k)}: ${v}`).join(', ') + ' }'
    }
    if (/\[\]\s*$/.test(inner) || /^Array\s*</.test(inner)) return '[]'
    return leafDummy(inner)
}

// Default mock results for a snippet, derived from its TERMINAL execute call (and,
// for `*One()`, the documented result type) when the doc author gives no
// `doc-code-snippet-result` — for cases the runtime heuristic (which only sees the
// `QueryType`) can't get right:
//   - `execute*NoneOrOne` shares its `QueryType` with the REQUIRED variant the
//     heuristic seeds `{}` (a present row); none-or-one wants `null` (no row).
//   - `executeSelectPage` runs TWO queries (data then count, via executeCombined):
//     the data wants `[]` (rows) and the count an int — `{}` makes the int
//     transform throw. Seed `[]` then `0`, mirroring the matrix select-page tests.
//   - a required `*One()` (executeSelectOne, executeInsertOne, …) returns a single
//     object/value the heuristic seeds `{}`, whose required columns then throw when
//     projected; seed a dummy row shaped by the documented ```tsx result type.
// Returns the JS source for each seeded result, in execution order.
function defaultSeeds(body: string, resultType: string | null): string[] {
    const calls = body.match(/\.execute\w+/g)
    const last = calls?.[calls.length - 1]?.slice(1)
    if (!last) return []
    if (last === 'executeSelectPage') return ['[]', '0']
    if (/NoneOrOne$/.test(last)) return ['null']
    if (/One$/.test(last)) { const d = dummyFromResultType(resultType); if (d) return [d] }
    return []
}

// SQL dialect fence languages (the doc author tags the generated SQL per db). The
// fence language IS the db template basename, so a ```ts followed by these turns
// into one SQL test per named db.
const DIALECT_LANGS = new Set(['mariadb', 'mysql', 'oracle', 'postgresql', 'sqlite', 'sqlserver'])

// Code fence languages — any of these AFTER a ```ts ends its run of SQL fences.
const CODE_LANGS = new Set(['ts', 'tsx', 'typescript', 'typescriptreact'])

// Collapse the readability whitespace the docs add so the documented SQL compares
// equal to the single-line SQL the builder emits (mirror of normalizeSql in
// test/lib/mockRunners/DocCodeMockRunner.ts — the runtime assertion normalises both sides again).
function collapseWs(sql: string): string {
    return sql.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim()
}

// A dialect fence whose body is only blank lines / SQL comments (`-- …`) means
// the query does not apply to that db (so there is no SQL to test there).
function hasSql(body: string): boolean {
    return body.split('\n').some(l => { const t = l.trim(); return t !== '' && !t.startsWith('--') })
}

// Once a fence is known to contain SQL (hasSql), drop the full-line `-- …`
// explanatory comments the docs add inside it (e.g. `-- Last inserted ID returned
// by the database …`): the builder never emits them, so they would break the
// assertion. Only WHOLE-LINE comments are removed — a `--` inside a string literal
// stays, since it isn't line-leading.
function stripSqlComments(body: string): string {
    return body.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
}

// A ```ts whose body is only blank lines / `//` line comments (multiple allowed)
// documents "no query for this db" — e.g. an unsupported-feature tab that just
// says `// Oracle doesn't support …`. Like a `--`-only SQL fence, it must NOT
// become a test/function NOR absorb the SQL fences that follow it, so it's dropped
// before routing.
function hasTsCode(body: string): boolean {
    return body.split('\n').some(l => { const t = l.trim(); return t !== '' && !t.startsWith('//') })
}

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
    { from: `interface ValueSource<T, TYPE_NAME> {`, to: `interface ValueSource<_T, _TYPE_NAME> {` },
    // { from: `// return a BooleanValueSource based on the value`, to: `return connection.true()` },
]

// ── markdown fence scanner ───────────────────────────────────────────────────
// `tabLabel` is the mkdocs dialect tab a fenced block lives in (=== "MariaDB"),
// used only to attribute an indented ```ts to a specific db. A tab header at
// column 0 OPENS a tab group; any OTHER column-0 non-blank line (prose, a
// heading, an `!!! info` admonition, a column-0 fence) CLOSES it — so an
// indented ```ts inside an admonition is NOT mistaken for a dialect example.
// `startLine` is the 1-based source line of the opening fence (for navigation).
// `snippetTemplates` is the template list from a `<!-- doc-code-snippet-template:
// A, B -->` comment, and `resultExprs` the JS values from any
// `<!-- doc-code-snippet-result: <expr> -->` comments — both read from the run of comment
// lines IMMEDIATELY above the fence (they may stack, in any order). `resultExprs`
// is in DOCUMENT order (top → bottom), so successive entries seed successive
// queries of a multi-query snippet.
interface Block { lang: string; body: string[]; tabLabel: string | null; startLine: number; snippetTemplates: string[]; resultExprs: string[] }

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
            // per-snippet directives stack on the run of HTML-comment lines
            // immediately above the fence (any order). `.` doesn't cross newlines,
            // so each regex still matches its own single-line comment.
            let p = i - 1
            const directiveLines: string[] = []
            while (p >= 0 && /^\s*<!--.*-->\s*$/.test(lines[p]!)) { directiveLines.push(lines[p]!); p-- }
            directiveLines.reverse()   // scanned bottom-up → restore document order
            const directives = directiveLines.join('\n')
            const snip = SNIPPET_DIRECTIVE.exec(directives)?.[1]
            const snippetTemplates = snip ? snip.split(',').map(s => s.trim()).filter(Boolean) : []
            const resultExprs = [...directives.matchAll(RESULT_DIRECTIVE)].map(mm => mm[1]!)
            const closer = new RegExp('^' + indent + '```\\s*$')
            const body: string[] = []
            i++
            while (i < lines.length && !closer.test(lines[i]!)) {
                body.push(indent && lines[i]!.startsWith(indent) ? lines[i]!.slice(indent.length) : lines[i]!)
                i++
            }
            i++
            blocks.push({ lang, body, tabLabel: indent ? lastTab : null, startLine, snippetTemplates, resultExprs })
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

// Render `sql` exactly as `expect(sql).toMatchInlineSnapshot(...)` would: a
// BACKTICK template literal wrapping the DOUBLE-QUOTED SQL, with `\`, `` ` `` and
// `${` escaped for the backtick context. This unifies the TEXTUAL form of the
// asserted SQL with the db-matrix tests (which snapshot the same SQL), so a single
// grep finds both. assertSql/assertSqls strip the wrapping `"` before comparing.
function snapshotLiteral(sql: string): string {
    const inner = '"' + collapseWs(sql) + '"'
    const escaped = inner.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
    return '`' + escaped + '`'
}

// A ```ts snippet that is paired with dialect SQL fence(s) becomes a test: the
// body runs against the template's `docCodeMock`, and the emitted SQL is asserted
// equal to the documented SQL. Same BEGIN/END fence + usage marks as emitFunction;
// the test wrapper replaces the function wrapper. `expectedSqls` are whitespace-
// collapsed at gen time (the assertion normalises again at runtime) — one entry
// for a single-statement query (→ `assertSql`, against the last SQL), several for
// a multi-statement one like `executeSelectPage()` (→ `assertSqls`, against the
// full history in order). `resultExprs` (doc-code-snippet-result) seed the mock's
// successive results in document order; with none given, a terminal
// `execute*NoneOrOne` is seeded `null` (no row) so it doesn't get the heuristic's
// `{}` (which would break its projection).
function emitTest(s: Snippet, expectedSqls: string[], resultExprs: string[], resultType: string | null): string {
    const body = applySubstitutions(stripImports(s.code))
    const marks = usageMarks(body).map(l => '    ' + l)
    const seeds = resultExprs.length ? resultExprs : defaultSeeds(body, resultType)
    const multi = expectedSqls.length > 1
    const out: string[] = []
    out.push(`test(${JSON.stringify(s.page + ':' + s.line)}, async () => {`)
    out.push('    docCodeMock.reset();')
    for (const seed of seeds) out.push(`    docCodeMock.next(${seed});`)
    out.push(beginMark(s))
    out.push(body)
    out.push(endMark(s))
    if (marks.length) out.push(marks.join('\n'))
    if (multi) {
        // A multi-statement query (executeSelectPage's data + count) chains its
        // later queries through `.then`. The mock runs on SynchronousPromise, so
        // they all execute synchronously inside the snippet body — even when the
        // doc snippet doesn't await the result — and the full history is recorded
        // by the time this assertion runs.
        out.push(`    docCodeMock.assertSqls([${expectedSqls.map(snapshotLiteral).join(', ')}]);`)
    } else {
        out.push(`    docCodeMock.assertSql(${snapshotLiteral(expectedSqls[0]!)});`)
    }
    out.push('})')
    return out.join('\n')
}

function ident(page: string, line: number): string {
    return page.replace(/[^A-Za-z0-9]/g, '_') + '__L' + line
}

function renderTemplate(tpl: string, generated: string): string {
    const path = join(TEMPLATES_DIR, templateFileBase(tpl) + '.ts')
    const template = readFileSync(path, 'utf8')
    if (!template.includes(MARKER)) throw new Error(`Template ${path} is missing the "${MARKER}" marker`)
    return template.replace(MARKER, generated)
}

export interface DocCodeResult {
    // template basename → how many SQL tests, compile-only functions, and
    // module-level typescript declarations landed in it
    perTemplate: Record<string, { tests: number; fns: number; typescript: number }>
    skipped: { tsx: number; tsr: number }
    files: string[]
}

// One snippet routed to a template, tagged with how it must be emitted:
//   ts-fn      → ```ts with NO dialect SQL → compile-only async function
//   ts-test    → ```ts paired with this db's dialect SQL → a SQL test()
//   typescript → simplified type declarations → module level
type TemplateEntry =
    | { kind: 'ts-fn'; snippet: Snippet }
    | { kind: 'typescript'; snippet: Snippet }
    | { kind: 'ts-test'; snippet: Snippet; expectedSqls: string[]; resultExprs: string[]; resultType: string | null }

export function extractDocCode(): DocCodeResult {
    // Collect every snippet against its TARGET TEMPLATE. Routing:
    //   ```ts WITH dialect SQL → a SQL test in each db whose dialect fence follows
    //   ```ts WITHOUT SQL      → compile-only fn: per-snippet directive › per-page
    //                            override › dialect tab › postgresql
    //   ```typescript          → per-snippet directive › override › simplifiedDefinition
    // Several pages feed the SAME template; entries combine, ordered by (page,line).
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
        // Drop ```ts blocks that are only `//` comments (a "no query for this db"
        // tab): they must not become tests/functions NOR absorb the SQL fences that
        // follow. Removing them here also stops them acting as a lookahead boundary.
        const blocks = scanBlocks(text).filter(b => !(b.lang === 'ts' && !hasTsCode(b.body.join('\n'))))
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i]!
            if (b.lang === 'tsx') { tsx++; continue }
            if (b.lang === 'typescriptreact') { tsr++; continue }
            const snippet: Snippet = { code: b.body.join('\n'), page: f, line: b.startLine }
            if (b.lang === 'typescript') {
                const targets = b.snippetTemplates.length ? b.snippetTemplates : [override ?? SIMPLIFIED_TEMPLATE]
                for (const t of targets) add(t, { kind: 'typescript', snippet })
                continue
            }
            if (b.lang !== 'ts') continue   // dialect SQL fences are consumed via lookahead
            // Each dialect SQL fence that follows this ```ts (until the next code
            // fence) turns it into a SQL test in THAT db, asserting that db's SQL.
            // A db may show MORE THAN ONE fence (in document order) when the snippet
            // runs more than one statement — e.g. `executeSelectPage()` emits a data
            // query then a count; each fence is asserted against the matching query.
            // A fence whose body is only SQL comments (`-- …`) means the query does
            // NOT apply to that db → skipped. A ```ts with no applicable SQL at all
            // stays a compile-only function in its routed template.
            // A ```ts inside a db tab (`=== "SQLite"`) is one of several per-db query
            // tabs sitting before a per-db SQL tab group; it must assert ONLY its own
            // db's SQL (each tab's query is db-specific — MariaDB `.onConflictDoUpdateSet`
            // vs PostgreSQL/SQLite `.onConflictOn().doUpdateSet()`). A column-0 ```ts is
            // db-agnostic and asserts EVERY following db's SQL. `tsDb` is the tab's db
            // (null = column-0, or an unknown tab label tolerated as column-0).
            const tsDb = b.tabLabel ? (LABEL_TO_DB[b.tabLabel] ?? null) : null
            const sqlByDb = new Map<string, string[]>()
            for (let j = i + 1; j < blocks.length; j++) {
                const nb = blocks[j]!
                if (CODE_LANGS.has(nb.lang)) {
                    // For a tabbed ts, skip the SIBLING per-db query tabs so it reaches
                    // its own db's SQL; stop only at a column-0 ```ts / ```typescript /
                    // ```tsx. A column-0 ts stops at the first following code fence.
                    if (tsDb !== null && nb.lang === 'ts' && nb.tabLabel !== null) continue
                    break
                }
                if (DIALECT_LANGS.has(nb.lang)) {
                    if (tsDb !== null && nb.lang !== tsDb) continue   // tabbed ts → only its own db
                    const sql = nb.body.join('\n')
                    if (hasSql(sql)) (sqlByDb.get(nb.lang) ?? sqlByDb.set(nb.lang, []).get(nb.lang)!).push(stripSqlComments(sql))
                }
            }
            // The ```tsx that follows the SQL fences documents the result TYPE; used
            // to shape the dummy mock row for a `*One()` query (see defaultSeeds).
            let resultType: string | null = null
            for (let j = i + 1; j < blocks.length; j++) {
                const nb = blocks[j]!
                if (nb.lang === 'tsx') { resultType = nb.body.join('\n'); break }
                if (tsDb !== null && nb.lang === 'ts' && nb.tabLabel !== null) continue   // skip sibling query tabs
                if (nb.lang === 'ts' || nb.lang === 'typescript') break
            }
            if (sqlByDb.size > 0) {
                // ```ts WITH dialect SQL → routed by its fences (snippet directive
                // does not apply to SQL snippets). A ```ts paired with SQL becomes a
                // test even if the snippet is a setup fragment with no query: the
                // test then fails (empty `lastSql`), surfacing a documentation error
                // to fix rather than silently skipping it.
                for (const [db, sqls] of sqlByDb) add(db, { kind: 'ts-test', snippet, expectedSqls: sqls, resultExprs: b.resultExprs, resultType })
            } else {
                // compile-only ```ts → its snippet-directive template(s), else the
                // page override, else the dialect tab, else postgresql.
                const targets = b.snippetTemplates.length ? b.snippetTemplates : [override ?? ((b.tabLabel && LABEL_TO_DB[b.tabLabel]) || DEFAULT_DB)]
                for (const t of targets) add(t, { kind: 'ts-fn', snippet })
            }
        }
    }

    // Wipe the generated docs cells — a `documentation` connector in each db's
    // `newest` version plus the synthetic `general` db — then regenerate.
    const docCells = [...new Set([...DIALECT_LANGS].map(d => DB_FOLDER[d] ?? d)), 'general']
        .map(db => join(DB_OUT_DIR, db, 'newest', 'documentation'))
    for (const dir of docCells) rmSync(dir, { recursive: true, force: true })

    const files: string[] = []
    const perTemplate: Record<string, { tests: number; fns: number; typescript: number }> = {}

    for (const tpl of [...byTemplate.keys()].sort()) {
        const entries = byTemplate.get(tpl)!.slice().sort((a, b) =>
            a.snippet.page === b.snippet.page
                ? a.snippet.line - b.snippet.line
                : a.snippet.page.localeCompare(b.snippet.page))
        const counts = { tests: 0, fns: 0, typescript: 0 }
        const safe = tpl.replace(/[^A-Za-z0-9]/g, '_')
        // Only the snippet CONTENT is emitted; the template owns the surrounding
        // `describe()` + always-pass test + imports + `docCodeMock`, and ensures
        // the whole thing compiles. The marker sits inside that describe, so the
        // emitted test()/function/declaration content nests under it.
        const parts: string[] = []
        for (const e of entries) {
            if (e.kind === 'ts-test') { counts.tests++; parts.push(emitTest(e.snippet, e.expectedSqls, e.resultExprs, e.resultType)) }
            else if (e.kind === 'ts-fn') { counts.fns++; parts.push(emitFunction(e.snippet, `ex_${safe}_${ident(e.snippet.page, e.snippet.line)}`)) }
            else { counts.typescript++; parts.push(emitModuleLevel(e.snippet)) }
        }
        perTemplate[tpl] = counts
        const out = outputFor(tpl)
        mkdirSync(dirname(out), { recursive: true })
        writeFileSync(out, renderTemplate(tpl, parts.join('\n\n')))
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
    console.log('documentation code extracted into ' + DB_OUT_DIR + '/<db>/newest/documentation/')
    for (const [tpl, c] of Object.entries(r.perTemplate)) {
        const parts = [c.tests ? `${c.tests} sql tests` : '', c.fns ? `${c.fns} compile-only` : '', c.typescript ? `${c.typescript} typescript` : ''].filter(Boolean).join(', ')
        console.log(`  ${outputFor(tpl)}: ${parts || 'empty'}`)
    }
    console.log(`  skipped: ${r.skipped.tsx} tsx, ${r.skipped.tsr} typescriptreact`)
}
