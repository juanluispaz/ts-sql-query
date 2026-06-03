# `test/` — documentation code extractor & SQL tests

This tool's **purpose is to TEST the documentation's code examples**. It turns the
doc snippets into ordinary matrix test cells that validate them **twice**:

1. **By the TypeScript compiler** — every ```ts / ```typescript snippet is
   extracted into compilable TypeScript and fed through the same `tsc`/`tsgo`
   compilation as the rest of `test/`. A doc example that no longer type-checks
   (API renamed, signature changed, typo) fails the build instead of rotting.
2. **By running the SQL** — every ```ts that is paired with a dialect SQL fence
   (the SQL the docs show for that query) becomes a **mock test** that runs the
   snippet and asserts the SQL the builder emits equals the SQL the docs show.
   So the documented SQL cannot drift from what the library actually emits.

The docs stay correct by construction, not by manual review. **These two
validations are the point** of the tool. The type-checked corpus it produces is
*also* reusable by downstream tooling — notably the code-index searcher — but
that is an **additional benefit layered on top**, not the primary goal.

The **extractor** is standalone, self-contained code under
[`lib/docCodeExtractor/`](./lib/docCodeExtractor/) (its own `walk.ts`, no
dependency on the rest of `test/lib/`). The **runtime mock** the SQL tests use is
[`lib/mockRunners/DocCodeMockRunner.ts`](./lib/mockRunners/DocCodeMockRunner.ts) (imports the test-runner shim + `src`).
For the navigation map see [`README.md`](./README.md); for `test/lib/` see
[`TEST_LIB.md`](./TEST_LIB.md).

- [Run it](#run-it)
- [Run the SQL tests](#run-the-sql-tests)
- [Fence-language routing](#fence-language-routing)
- [SQL tests — how a ```ts becomes a test](#sql-tests--how-a-ts-becomes-a-test)
- [Re-routing & escape-hatch directives](#re-routing--escape-hatch-directives)
- [Generated shape](#generated-shape)
- [Templates](#templates)
- [The documentation source files](#the-documentation-source-files)
- [Docs ↔ code feedback loop](#docs--code-feedback-loop)
- [Files](#files)

## Run it

```bash
bun run codegen:doc-code      # regenerate the test/db/<db>/newest/documentation/ cells
npm run codegen:doc-code      # same, via tsx
bun run codegen               # umbrella: codegen:prisma + codegen:doc-code (what CI runs)
```

Wrapper: [`scripts/codegen-doc-code.sh`](../scripts/codegen-doc-code.sh)
(`--help` prints the full behaviour). The generated files are type-checked by
`bun run validate:tests` (tsgo) and `bun run validate:tests:tsc` (tsc); the
non-v1 CI runs `codegen` before `validate:tests`.

## Run the SQL tests

The generated files are **ordinary matrix cells** — no runner special case. Each db
template lands in that db's `newest` version under a `documentation` connector
(`test/db/<db>/newest/documentation/doc-code.generated.test.ts`); the non-db
(general) templates land in a synthetic `general` db
(`test/db/general/newest/documentation/<name>.generated.test.ts`). They're addressed
with the same coords as any other cell:

```bash
bun run tests '*/newest/documentation'                                   # every doc test cell
bun run tests postgres/newest/documentation                              # one db's doc cell
bun run tests general/newest/documentation                               # the non-db (general) docs
bun run tests postgres/newest/documentation/doc-code.generated.test.ts   # one file
```

See [`CLI.md` § Documentation tests are ordinary matrix cells](./CLI.md#documentation-tests-are-ordinary-matrix-cells).
These tests never touch a real DB — they use [`DocCodeMockRunner`](./lib/mockRunners/DocCodeMockRunner.ts)
(self-contained), so `--docker`/`--wasm` don't apply even though they live in the
matrix. The synthetic `general` db and the `documentation` connector are excluded
from the symmetry audit ([`auditTestSymmetry.ts`](./lib/auditTestSymmetry.ts)).

## Fence-language routing

The doc author re-tags each fence so its language encodes intent:

| fence | meaning | becomes |
|---|---|---|
| ` ```ts ` **with** a dialect SQL fence after it | runnable query example | a **SQL test** in each db whose fence follows (see below) |
| ` ```ts ` **without** SQL | setup / illustrative code | a compile-only `async function` in its routed template |
| ` ```typescript ` | simplified type declarations | module-level decls in `simplifiedDefinition` |
| ` ```tsx ` | result-type annotation | skipped |
| ` ```typescriptreact ` | pseudocode | skipped |
| ` ```mariadb / mysql / oracle / postgresql / sqlite / sqlserver ` | the generated SQL per db | consumed as the **expected SQL** for the preceding ```ts (not emitted) |

A `=== "Label"` at column 0 opens a dialect tab group; any other column-0
non-blank line closes it (so a ` ```ts ` indented inside an `!!! info` admonition
isn't mis-attributed to a tab). Default db for a column-0 ```ts is **postgresql**.

## SQL tests — how a ```ts becomes a test

After a ```ts, the extractor collects the **dialect SQL fences** that follow it
(until the next code fence). For each db with a fence, it emits a `test()` into
**that db's** template: the test runs the snippet against the template's
`docCodeMock` connection and asserts the emitted SQL == the documented SQL.

- **One test per db** that shows SQL. A cross-database query (one ```ts, SQL for 6
  dbs) → up to 6 tests, one per db template (each supplies its own `connection`,
  so each emits its own dialect SQL).
- **A query that runs MORE THAN ONE statement** shows several fences per db (in
  document order). `executeSelectPage()` is the case: it emits a **data** query
  then a **count** query, and the doc shows both. The extractor collects the run
  of fences per db and asserts the **whole history in order** (`assertSqls` against
  `docCodeMock.history`, vs `assertSql` against the last SQL for a single fence).
  Doc snippets often DON'T `await` the result (they show the `Promise<…>` type),
  but the mock runs on `SynchronousPromise`, so every chained query executes inside
  the snippet body and the full history is recorded before the assertion runs.
- **`--`-only fences mean "not applicable"** → no test for that db. A fence whose
  body is only blank lines / SQL comments (`-- Oracle doesn't support …`) is
  skipped (`hasSql()` in the extractor).
- **Full-line `-- …` comments inside a real fence are stripped** (`stripSqlComments()`,
  applied once `hasSql()` confirms there's a query) — explanatory lines like
  `-- Last inserted ID returned by the database …` aren't emitted by the builder, so
  they'd break the assertion. Only WHOLE-LINE comments go; a `--` inside a string
  literal or trailing on a SQL line stays.
- **`//`-only ```ts blocks are "no query"** → dropped before routing (`hasTsCode()`),
  symmetrically to `--`-only SQL fences. A query-per-db tab that just says
  `// Oracle doesn't support …` becomes neither a test nor a function, and — crucially
  — does **not** absorb the SQL fences that follow it.
- **A real ```ts (not `//`-only) paired with SQL fences ALWAYS becomes a test**, even
  if it's a setup fragment that runs no query (`const fieldsToPick = { … }` followed
  by the SQL of a query stated elsewhere). The test then fails with an empty
  `lastSql` — surfacing the documentation error to fix, rather than silently dropping
  it. The SQL is still associated with the snippet it follows.
- **Per-db query tabs** — when the QUERY itself differs per db (`=== "MariaDB"` …
  `=== "SQLite"`, each with its own ```ts, because e.g. MariaDB uses
  `.onConflictDoUpdateSet` vs PostgreSQL/SQLite `.onConflictOn().doUpdateSet()`), a
  tabbed ```ts asserts **only its own db's SQL**: it skips its sibling query tabs to
  reach the matching fence in the following per-db SQL tab group. A column-0 ```ts
  (db-agnostic) still asserts EVERY following db's SQL. The tab db comes from the
  exact quoted label (`MariaDB`, `MySQL`, `Oracle`, `PostgreSQL`, `SQLite`,
  `SQL Server`) via `LABEL_TO_DB`; an unknown/absent label is tolerated.
- **SQL-only assertion** — only the SQL string is checked, not params, not result
  types/values.
- **Whitespace normalisation** — docs pretty-print SQL across lines, the builder
  emits one line. `normalizeSql` (in [`DocCodeMockRunner.ts`](./lib/mockRunners/DocCodeMockRunner.ts),
  mirrored by `collapseWs` at gen time) collapses whitespace runs and drops the
  spaces right after `(` / right before `)`. Both sides go through it at runtime.
- **The mock result is a heuristic** (`DocCodeMockRunner` returns `[]` for
  many-rows, `1` for affected-count/insert-id, `{}` for a single row, `null` for
  the rest, per `QueryType`) so the snippet runs far enough to emit the SQL. The
  SQL is captured *before* result projection, so even a required-single-row query
  that would throw has already recorded its SQL. When the heuristic is not enough
  (a single-row projection that reads a specific field, a multi-query snippet
  whose values matter), set the result with the **`doc-code-snippet-result`** escape hatch.
  - **Default seeds the extractor adds** (from the terminal method, when no
    `doc-code-snippet-result` is given) for cases the runtime heuristic can't get
    right from the `QueryType` alone:
    - `execute*NoneOrOne` shares `selectOneRow` with the REQUIRED variant the
      heuristic seeds `{}`; none-or-one is seeded `null` (no row, valid) instead.
    - `executeSelectPage` runs data + count: seeded `[]` then `0` (the count is an
      int — `{}` makes its transform throw), mirroring the matrix select-page tests.
    - a required `*One()` (`executeSelectOne`, `executeInsertOne`, …) projects a
      single value; the extractor reads the **```tsx result type** that follows
      the SQL fences and seeds a dummy row shaped by it — FLAT row keyed by dotted
      alias (`name: {firstName}` → `"name.firstName"`); aggregated list → `[]`;
      scalar defaults `0`, `'x'` (non-empty — `''` reads as null), `new Date(0)`;
      optional fields skipped. Override with `doc-code-snippet-result` when the
      type isn't enough.
- **The expected SQL literal is rendered in `toMatchInlineSnapshot` form** — a
  backtick template wrapping the double-quoted SQL (`` `"…"` ``), with `` ` `` /
  `${` / `\` escaped (`snapshotLiteral` in the extractor). This makes the asserted
  text read identically to the db-matrix snapshots of the same SQL, so one grep
  finds both; `assertSql`/`assertSqls` drop the wrapping `"` before comparing.

## Re-routing & escape-hatch directives

Invisible HTML comments (render to nothing in Markdown):

- `<!-- doc-code-template: NAME -->` — anywhere on a page, pins the **whole page**
  to template `NAME`.
- `<!-- doc-code-snippet-template: NAME -->` — on the line **immediately before**
  a fence, re-routes a snippet **WITHOUT SQL** (a compile-only ```ts, or a
  ```typescript). Accepts a **comma-separated list** (`mariadb, mysql, oracle`) to
  emit the same snippet into several templates — e.g. a db-specific example that
  only compiles in those connections. (A ```ts **with** dialect SQL is routed by
  its SQL fences, NOT by this directive.)
- `<!-- doc-code-snippet-result: <expr> -->` — on a comment line **just before** a ```ts,
  sets the mock's result for a query with `<expr>` (any JS), when the per-
  `QueryType` heuristic value isn't enough (a single-row projection that reads a
  specific field, …). Becomes `docCodeMock.next(<expr>)`. **Stack** several
  (document order) to seed successive queries of a multi-query snippet.

The per-snippet comments **stack**: the extractor reads the whole run of comment
lines immediately above the fence (any order), so `doc-code-snippet-result` and
`doc-code-snippet-template` may co-occur.

Precedence for the non-SQL routing (most specific wins): **per-snippet › per-page
› default**. Targets **combine** (several pages/snippets may feed the same
template; a directive may name an existing db template or a simplified-definition
template to *add* to it).

### In a docs page

The directives are plain HTML comments — invisible in the rendered page, anchored
to the fence that follows them. A representative slice of a `.md` file:

````markdown
<!-- doc-code-template: postgresql -->

# Postgres-only helpers

<!-- doc-code-snippet-template: postgresql, mariadb -->
```ts
type Row = { id: number, name: string }
```

<!-- doc-code-snippet-result: { id: 1, name: 'Acme' } -->
```ts
const row = connection.selectFrom(tCompany).where(tCompany.id.equals(1))
    .select({ id: tCompany.id, name: tCompany.name }).executeSelectOne()
```

```postgresql
select id as id, name as name from company where id = $1
```

<!-- doc-code-snippet-result: { id: 2, name: 'Beta' } -->
```ts
const next = connection.selectFrom(tCompany).where(tCompany.id.equals(2))
    .select({ id: tCompany.id, name: tCompany.name }).executeSelectOne()
```

```postgresql
select id as id, name as name from company where id = $1
```
````

What the extractor does with it:

1. The page-level `doc-code-template: postgresql` pins every routed-by-default
   snippet to the postgres template.
2. The first `ts` (a type-only setup snippet, no SQL fence after it) has a
   per-snippet `doc-code-snippet-template: postgresql, mariadb` and is emitted
   into BOTH templates as a compile-only function.
3. The two query `ts` snippets each get their own `doc-code-snippet-result`, so
   `docCodeMock.next({…})` is queued before each runs.
4. Each query is paired with the `postgresql` fence that immediately follows it,
   producing two `test()` calls in `postgres/newest/documentation/`.

Stack directives by writing them on separate comment lines above the fence (any
order). A snippet with `doc-code-snippet-template` *and* `doc-code-snippet-result`
on consecutive lines is valid — the extractor reads the whole run of comments
attached to the fence.

## Generated shape

- **Non-SQL ```ts** → `async function ex_<id>() { // BEGIN … body … // END …
  <void usage marks> } void ex_<id>;`. Every first-level value declaration gets
  `void NAME;`; pure types (`type/interface`) are consumed by a trailing noop
  `void function(_0: T…){}`. So a compile error **between** BEGIN/END is in the doc
  snippet; one on a `void`/wrapper line is an extractor bug. Nested declarations
  are left to the doc author.
- **SQL ```ts** → `test("<page>:<line>", async () => { docCodeMock.reset();
  [docCodeMock.next(<mock>);] // BEGIN … body … // END … <void marks>
  docCodeMock.assertSql("<expected sql>"); })`. The `test()` wrapper replaces the
  function wrapper; BEGIN/END + usage marks are kept.
- **```typescript** → module-level declarations (same usage marks).

Per-file comment→code substitutions live in the `SUBSTITUTIONS` array in
[`docCodeExtractor.ts`](./lib/docCodeExtractor/docCodeExtractor.ts).

## Templates

Templates live in
[`test/templates/doc-code/newest/documentation/`](./templates/doc-code/newest/documentation/),
one per target. **Db templates are named by their `test/db/` folder** (`postgres.ts`,
`mariadb.ts`, `mysql.ts`, `oracle.ts`, `sqlite.ts`, `sqlserver.ts` — note
`postgresql` → `postgres`); the non-db ones keep their name (`simplifiedDefinition.ts`,
`simplifiedDefinitionInQuery.ts`). They sit at the **same path depth** as the
generated files (`test/<a>/<b>/<c>/<d>/file`), so a template's relative imports are
valid verbatim once copied into the generated cell. **The doc author owns them and
keeps them compiling.** Each template:

- imports `{ describe, test }` from `../../../../lib/testRunner.js`, the connection +
  tables + helpers, and (for db templates) `{ DocCodeMockRunner }` from
  `../../../../lib/mockRunners/DocCodeMockRunner.js` and `{ MockQueryRunner }` from `src`;
- builds `const docCodeMock = new DocCodeMockRunner()` and
  `const connection = new DBConnection(docCodeMock)` (the SQL tests read
  `docCodeMock`);
- wraps its `// Generated code here` marker inside a
  `describe('<db> documentation', () => { test('snippets registered', () => {});
  /* marker */ })` — so the extractor's emitted content nests under the describe
  and the file always registers a test. (It doesn't matter that the template's
  always-pass test runs.)

The extractor emits **only the content** at the marker — no imports, no describe,
no always-pass test (the template owns those).

**Context parity (important):** because a cross-database query snippet is emitted
into every db template that shows its SQL, every db template must provide the
helpers/imports that snippet references (`extractColumnsFrom`, `dynamicPick`,
`getSubcompanies` stub, `Values`, `DynamicCondition`, …). Postgresql is the
richest; the others were brought to parity by the doc author.

## The documentation source files

Three similarly-named things, different roles, two locations:

- **[`src/examples/documentation/simplifiedQueryDefinition.ts`](../src/examples/documentation/simplifiedQueryDefinition.ts)**
  (stays under `src/`) — a hand-maintained, **valid `.ts`** view of the
  query-building API (formerly `src/simplifiedDefinition.txt`). An **authoring
  source**: the docs are written *from* it + real library files like
  [`src/TsSqlError.ts`](../src/TsSqlError.ts). NOT produced by the extractor.
- **[`test/templates/doc-code/newest/documentation/`](./templates/doc-code/newest/documentation/)**
  — the templates (above). Two simplified-definition templates exist:
  `simplifiedDefinition.ts` (general, mostly from the `typescript` fences in
  `docs/api/*`, the default ```typescript target) and `simplifiedDefinitionInQuery.ts`
  (a query-focused subset, reached via the directives).
- **`test/db/<db>/newest/documentation/` + `test/db/general/newest/documentation/`** —
  the extractor's output, as ordinary matrix cells (`doc-code.generated.test.ts` per
  db, `<name>.generated.test.ts` for the general ones). Gitignored
  (`*.generated.test.ts`); exists only to be type-checked + run as part of `test/db/`.

## Docs ↔ code feedback loop

Every SQL test is named after its source location (`<page>:<line>`), so a failure
points straight at the doc page and line that disagrees with what the builder
emits. A change in `src/` that alters emitted SQL surfaces as a failing test per
affected snippet — telling you *exactly which docs pages need updating in
tandem*; conversely, a docs edit that drifts from the library fails its own test.

Recurring failure patterns:

1. **Real SQL diff** — the documented SQL is stale → update the fence.
2. **`Received: ""`** — the ```ts is a *setup fragment* (e.g.
   `const fieldsToPick = { … }`) that doesn't execute a query, but a SQL fence
   follows it; the extractor pairs the fence with the *immediately-preceding*
   ```ts, which emits nothing. Left as a **visible failing test on purpose** so
   the doc error surfaces; restructure the doc so the fence follows the snippet
   that actually executes (only `//`-only ```ts blocks are auto-dropped).

## Files

| file | role |
|---|---|
| [`lib/docCodeExtractor/docCodeExtractor.ts`](./lib/docCodeExtractor/docCodeExtractor.ts) | the extractor + standalone entry point |
| [`lib/docCodeExtractor/walk.ts`](./lib/docCodeExtractor/walk.ts) | self-contained recursive file walk |
| [`lib/mockRunners/DocCodeMockRunner.ts`](./lib/mockRunners/DocCodeMockRunner.ts) | `DocCodeMockRunner` (capture + history + heuristic + `next()` + `assertSql`/`assertSqls`) + `normalizeSql` |
| [`scripts/codegen-doc-code.sh`](../scripts/codegen-doc-code.sh) | `codegen:doc-code` wrapper |
| [`templates/doc-code/newest/documentation/`](./templates/doc-code/newest/documentation/) | the per-target templates (db named by db folder; general by name) |
| [`lib/auditTestSymmetry.ts`](./lib/auditTestSymmetry.ts) → `NON_CELL_CONNECTORS` / `NON_CELL_DATABASES` | excludes the `documentation` connector + `general` db from the symmetry audit |
