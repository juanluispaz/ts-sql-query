# `test/` — writing tests

How to write, port, comment-out, and debug a test in this suite. Tutorial,
not normative — the rules live in [`DESIGN.md`](./DESIGN.md); this doc
shows how to apply them.

- [Anatomy of a test file](#anatomy-of-a-test-file)
- [Updating snapshots](#updating-snapshots)
- [Real-DB validation of one cell](#real-db-validation-of-one-cell)
- [Adding a test](#adding-a-test)
- [Negative type tests](#negative-type-tests)
- [Type-checking the test matrix](#type-checking-the-test-matrix)
- [Testing a runtime guard that is also typed at compile time](#testing-a-runtime-guard-that-is-also-typed-at-compile-time)
- [Extending the shared domain](#extending-the-shared-domain)
- [When the canonical cell can't compile the body](#when-the-canonical-cell-cant-compile-the-body)
- [Imports used only from commented-out blocks](#imports-used-only-from-commented-out-blocks)
- [When the canonical body contains `*/`](#when-the-canonical-body-contains-)
- [Docs snippets — `docs:` and `docs-extra:`](#docs-snippets)
- [When a test surfaces a bug in `src/`](#when-a-test-surfaces-a-bug-in-src)

## Anatomy of a test file

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('list-active-projects-of-org', async () => {
        const expected = [
            { id: 2, name: 'Internal tools', slug: 'tools' },
            { id: 1, name: 'Marketing site', slug: 'mktg-site' },
        ]
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tProject)
            .where(tProject.organizationId.equals(1))
              .and(tProject.archivedAt.isNull())
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderBy('name')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()       // baked by --update-snapshots
        expect(ctx.lastParams).toMatchInlineSnapshot()

        assertType<Exact<typeof result, Array<{
            id: number
            name: string
            slug: string
        }>>>()

        expect(result).toEqual(expected)
    })
})
```

The query is written once. `ctx.lastSql` and `ctx.lastParams` come from the
interceptor and work in both modes. `expected` is what the seed contains
AND what `mockNext` queued, so the value assertion is a single line.

`ctx.lastNoTransactionSql` is the right read after a
`connection.transaction(...)` block (skips `"commit"`/`"rollback"`
synthetic entries). `ctx.history` lets you assert several queries from one
test body in order. Full API surface in
[`TEST_LIB.md` § `testContext.ts` — `ctx` API surface](./TEST_LIB.md#testcontextts--ctx-api-surface).

For mutating tests (INSERT / UPDATE / DELETE), wrap the body in
`ctx.withRollback(async () => { … })`. For DDL or commit-required cases use
`ctx.withCommit`. For tests that manage their own
`connection.transaction(...)` use `ctx.withReseed`. Full contract in
[`TEST_LIB.md` § Mutation safety contract](./TEST_LIB.md#testcontextts--mutation-safety-contract).

## Updating snapshots

Whenever the library's emitted SQL or params change, refresh snapshots:

```bash
# Whole version
bun run tests postgres/newest --docker --update-snapshots

# One file
bun run tests postgres/newest/pg/select.basic.test.ts --docker --update-snapshots

# One test inside one file (composes with --test-name-pattern)
bun run tests postgres/newest/pg/select.basic.test.ts --docker \
              --test-name-pattern inner-join --update-snapshots
```

`--update-snapshots` and `--test-name-pattern <regex>` are first-class
script flags — same spelling under `bun run` and `npm run`; the script
translates to the active runner's wording (bun's `--update-snapshots` /
`--test-name-pattern` vs vitest's `--update` / `--testNamePattern`). Either
runner produces compatible inline snapshot format. Direct invocation also
works for the runner-side equivalents: `bun test test/db/postgres/newest/ --update-snapshots`
or `npx vitest run test/db/postgres/newest/ -u`.

Add `--bail` if a snapshot refresh that's expected to be small starts
breaking — the run stops at the first failure so you can inspect the diff
instead of churning every snapshot after it.

Review the diff before committing — a snapshot change is real signal that
the emitted SQL has changed.

## Real-DB validation of one cell

A test that has only ever passed mock is `mock-validated` — the `expected`
is the author's hypothesis. To promote to `real-validated` for one cell,
run the cell against its real engine:

```bash
# SQLite native — real-DB by default, no flag needed:
bun run tests sqlite/newest/bun_sqlite/<file>.test.ts

# Docker-backed — add --docker:
bun run tests postgres/newest/pg/<file>.test.ts --docker

# WASM — add --wasm:
bun run tests postgres/oldest/pglite/<file>.test.ts --wasm
```

If snapshots stay green, the test is `real-validated` in that cell. See
[`DESIGN.md` § Real-DB validation](./DESIGN.md#real-db-validation) for
the vocabulary; report it at the close of the round so the next agent (or
the user) knows what's still mock-validated only.

While iterating on a real-DB run that may fail, add `--bail` to abort at
the first failure instead of waiting for the rest of the cell — the docker
matrix is the slow lane and the inner "fix the canonical, re-bake,
re-validate" loop benefits the most. Full flag reference in
[`CLI.md` § Flags](./CLI.md#flags).

## Adding a test

1. **Read the library docs first.** Tests encode behaviour the library
   documents — they don't invent it. Open the page for the feature you're
   testing (under [`docs/queries/`](../docs/queries/),
   [`docs/dynamic/`](../docs/dynamic/),
   [`docs/advanced/`](../docs/advanced/) or
   [`docs/configuration/`](../docs/configuration/)) and any
   `docs/configuration/supported-databases/<database>.md` /
   `docs/configuration/query-runners/recommended/<connector>.md` pages that affect the
   cells you'll touch.

2. **Check whether the test would be redundant** — ask the searcher for the
   existing test inventory (see
   [`CODE_SEARCH.md`](./CODE_SEARCH.md#this-tool-vs-textual-search)):

   ```bash
   bun run tests:where-is --search <api-symbol> --for coverage-gap --tests detail
   ```

   If matches exist, read those tests in full. If they already cover the
   shape you wanted, the wave is "strengthen the existing test", not "add
   a new one".

3. **Pick the file that fits the scenario** (`select.basic`,
   `insert.returning`, `update.execute-variants`, …). If none fits, create it in
   **every** valid `<connector>/` folder in the same commit, with the test
   bodies that do not apply commented out per
   [`DESIGN.md` § Symmetry rule](./DESIGN.md#symmetry-rule) (never deleted,
   never `test.skip(...)`).

4. **Write the test in the canonical cell first.** Defaults:

   - `postgres/newest/pg/` for most families (`select.*`, `insert.*`,
     `update.*`, `delete.*`, `errors.*`, `transaction.*`, `fragments.*`,
     `raw-fragment.*`, `with-values.*`, `customize-query.*`,
     `dynamic-condition.*`).
   - `sqlite/newest/bun_sqlite/` for `docs.*` files — in-process, the fastest
     iteration loop.
   - The cell that owns the dialect-specific behaviour for tests that only
     run on one dialect (`select.postgres-const-force-type-cast.test.ts`
     under postgres, `config.datetime-formats.test.ts` under sqlite, etc.).

   PostgreSQL is the **superset** dialect (sequences, RETURNING, LATERAL,
   ON CONFLICT, JSON, MERGE on newer versions). Writing the canonical there
   first means the test exercises the fullest surface the lib supports.

   Use `expect(ctx.lastSql).toMatchInlineSnapshot()` and
   `expect(ctx.lastParams).toMatchInlineSnapshot()` with empty arguments;
   the runner will fill them.

5. **Bake snapshots** for the canonical:

   ```bash
   bun run tests <canonical-cell>/<slug>.test.ts --update-snapshots
   ```

6. **Real-validate the canonical** — see
   [Real-DB validation of one cell](#real-db-validation-of-one-cell). If
   the canonical is SQLite native, the bake above already did it.

7. **Port the same `describe` + `test` name to every other cell.** SQL
   differs when it must (the snapshot in each cell records its own
   version); comment out (do not delete) when the test does not apply.
   The commented body must be the **full canonical** per
   [`DESIGN.md` § Full-canonical-body discipline](./DESIGN.md#full-canonical-body).

8. **If the test is the suite's counterpart of a documentation example, prefix
   `docs:`** and mark that part with `// doc-start` / `// doc-end`. See
   [Docs snippets](#docs-snippets).

9. **Verify**:

   ```bash
   bun run tests:audit  -- # mechanical anti-cheat gate (symmetry + content rules)
   bun run validate:tests  # typecheck ✓ (tsc, per-connector split; use validate:tests:newest for the fast loop)
   bun run tests        -- # mock matrix ✓
   ```

   `tests:audit` walks `test/db/` statically and reports tests that have
   been weakened to pass dishonestly: `mirror-image`, `mock-only`,
   `as-any`, `weak-matcher`, `tautology`, `commented-test-reason`,
   `non-deterministic-input` and the rest of its rules
   ([`TESTS_AUDIT.md`](./TESTS_AUDIT.md) lists them with a fix hint each).
   Fix findings by making the test validate honestly; never silence them.
   The rare irreducible case takes a `// tests-audit-disable-next-line
   <rule> -- <reason>` with the reason mandatory — see
   [`TESTS_AUDIT.md` § Suppress a finding](./TESTS_AUDIT.md).

## Negative type tests

```
test/db/<database>/types.negative/
├── select.test.ts
└── …
```

```ts
function _typeNegatives() {
    // Rule: `.equals()` requires the same data type on both sides.
    void tAppUser.id.equals(1)
    // @ts-expect-error string passed where int is required
    void tAppUser.id.equals('1')
}

test('postgres-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
```

- One folder per database, at the **database root** (not per version).
  TS restrictions are dialect-wide.
- Multiple files (`select.test.ts`, `insert.test.ts`, …) split by area.
- Body of `_typeNegatives` is **never invoked**. Wrapping it in a function
  keeps `tsc` honest while preventing the throw paths inside ts-sql-query
  from firing.
- Each `// @ts-expect-error` MUST be paired with a one-line comment naming
  the rule it enforces.
- A `@ts-expect-error` is also satisfied by an unrelated error (a typo, a
  wrong import, a wrong arity), so keep the expression minimal and put a
  **positive control** next to it: the same expression with the valid
  variant, which compiles. When writing a batch, remove the directives once
  and read that tsc reports the intended error on each line.
- Something that should be refused but compiles is a bug: write it as a
  compiling line under a `// TODO[BUG]` comment, with its entry in
  [`BUGS.md`](./BUGS.md), and turn it into a `@ts-expect-error` once fixed.
- `bun run validate:tests` (or `validate:tests:newest` for the fast loop)
  is the real assertion. If a directive becomes "unused", the build fails —
  exactly the regression signal we want.
- The `types.negative/` folder is **not** part of the cell matrix. `tests:audit`
  skips it, except for the `ts-ignore` rule (`@ts-ignore` is forbidden everywhere).

When adding a new `@ts-expect-error` rule, look up the existing locks on
the symbol so the new one is **consistent with what's already there**
(rule-comment convention, snippet granularity, scope):

```bash
bun run tests:where-is --search <symbol> --neg-types full
```

`--neg-types full` returns each existing assertion's **rule comment +
rejected snippet + file:line** across every cell — what you model a
new lock on. The same view rides under `--for emission-bug` when the
negative test is the second step of fixing a typing bug (see
[`BUGS.md` § When the fix lands](./BUGS.md)).

### Which file a negative goes in

The six databases hold the same files; a new file goes in all six.

| File | What it refuses |
|---|---|
| `dialect-surface.test.ts` | A member the database **doesn't have at all**: a method of the connection, a protected member that configures it, a method of `Table`, a variant of a query builder. |
| `select.test.ts`, `select-construction.test.ts` | Misuse while building a SELECT: clause order, tables out of scope, group by / having, order by, limit, compound queries, the type of the rows. |
| `insert.test.ts`, `update.test.ts`, `delete.test.ts` | Misuse while building those statements: required columns, columns that can't be written, on conflict, the mandatory where, returning. |
| `expressions.test.ts` | Value expressions, by data type: operators, functions, `const`, optionality, aggregates. |
| `subqueries.test.ts`, `fragments.test.ts`, `with-values.test.ts`, `dynamic-condition*.test.ts` | Subqueries and recursive queries, fragments, `with` and `Values`, dynamic conditions. |
| `transaction.test.ts` | Transactions and isolation levels. |

Something the database lacks goes in `dialect-surface.test.ts`; misusing
something it has goes in the file of its area. A few older locks repeat a
`dialect-surface.test.ts` rule in an area file; both stay, since `tsc`
reports every copy when the rule changes.

### Adding negatives after a library change

When the library gains an API, a database-specific member or a restriction:

1. **Dialect surface.** Treat the six connections as if every member were on
   all of them. List what each database offers, from the `*Connection.ts`
   classes, the `this: OfDB<...>` overloads of `Table`, and the `OfDB<...>`
   gates in `src/expressions/{select,insert,update,delete}.ts`. Every member a
   database must not have gets a negative in its `dialect-surface.test.ts`, next
   to a control that compiles: the same chain up to the call, or the sibling
   member it does have. This is what catches a refactor that moves a member
   of one database to a shared base class.
2. **Construction.** For each state of the builder the change touches, list
   the transitions it doesn't offer and the constraints on each argument (data
   type, optionality, tables in scope, connection), then write one negative
   with its control for each, in the file of its area.
3. **Only what the library means to refuse.** Probe by compiling, never by
   reasoning. A refusal the database would do on its own is not, by itself, a
   reason for a negative; something that compiles and would go wrong is a
   `TODO[BUG]` (above).
4. **Check the reason**: remove the directives once, read that each line
   reports the intended error and no control reports any, then restore them.
   Several agents type-checking at once exhaust the memory: run one
   `validate:tests '<db>/types.negative'` at a time (several coords in one
   call are fine), and the full `validate:tests` at the end.

## Type-checking the test matrix

`bun run validate:tests` runs `bash scripts/validate-tests.sh` — one `tsc`
program **per connector** (TypeScript 7, the Go-based compiler) — and is the
**authoritative** check for the `test/` matrix. CI gates on it.

> **RAM.** A single tsc program over `test/tsconfig.json` + `src/` peaks
> **past 17 GB** as the suite grows, OOM-killing 16 GB CI runners and most dev
> boxes — so there is no whole-matrix command. Two RAM-safe paths:
> - **Full check → `bun run validate:tests`** — one tsc program per connector
>   (sqlite grew too large to split merely per-db, so every db is split the
>   same way; configs generated on the fly), so peak = the single largest
>   slice, not the sum (roughly 8 GB), which is what CI gates. Use it before pushing.
> - **Inner edit loop → `bun run validate:tests:newest`** — a SINGLE tsc
>   program (`test/tsconfig.newest.json`) narrowed to every db's `newest` +
>   `types.negative` cells (drops the older version tiers + `domain/`, mirroring
>   `--run-versions newest`). It peaks roughly 14 GB — more than any slice of the full split —
>   so on a 16 GB box run it alone; for a narrow change `validate:tests <coord>` is cheaper.
>   A green newest run says nothing about the older tiers, so run
>   the full `validate:tests` before pushing.
>
> The newest set is expressed by INCLUDE in `test/tsconfig.newest.json`, so a
> newly added version-tier folder is auto-excluded there with no edit.

Negative type tests place their `@ts-expect-error` directives where
TypeScript 7 reports the error span (the common case: single-statement
assertions and call-site errors). Error spans are unspecified when either error
is valid
([microsoft/typescript-go#1088](https://github.com/microsoft/typescript-go/issues/1088),
closed *not planned*), so follow what the current compiler reports — a
placement taken from a TypeScript 6 example may need moving.

## Testing a runtime guard that is also typed at compile time

A handful of `TsSqlProcessingError` paths fire from inside the SQL builders
when the user misuses the API. The typer is built to catch the same misuses
at compile time, so writing the offending code directly does not compile:

```ts
// ✗ does not compile — `.executeDelete` is not on `DeleteExpression`
//   until `.where(...)` has been called.
connection.deleteFrom(tIssue).executeDelete()

// ✗ does not compile — `set(...)` returns `NotExecutableUpdateExpression`,
//   which lacks `executeUpdate`.
connection.update(tIssue).set({ title: 'x' }).executeUpdate()

// ✗ does not compile on some dialects — `defaultValues()` resolves to
//   `never` when `RequiredColumnsForSetOf<TABLE>` is not `never`.
connection.insertInto(tDefaultsOnly).defaultValues()
```

These compile-time guards are deliberate and the typer does many contortions
to arrive at the `never` that fails the call site. The runtime
implementation is still there; the test of the runtime guard needs to reach
it.

**Rule**: cast through `any` precisely at the fluent step the typer blocks,
and document why the cast is there.

```ts
test('delete without where throws MISSING_WHERE', () => {
    let caught: unknown
    try {
        // Cast bypasses the compile-time guard so we can reach the
        // runtime guard. The typer rejects `.executeDelete` here on
        // purpose — see DeleteExpression in src/expressions/delete.ts.
        (ctx.conn.deleteFrom(tIssue) as any).executeDelete()
    } catch (e) {
        caught = e
    }
    expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined)
        .toBe('MISSING_WHERE')
})
```

Worked examples: see `test/db/*/*/*/errors.processing.test.ts` and
`test/db/*/*/*/insert.default-values.test.ts`.

This is the sanctioned `as any` in test bodies. Outside this use, `as any` is
forbidden, except for the bypass a `// TODO[BUG]:`-marked repro needs to compile
— see
[`DESIGN.md` § The `as any` runtime-guard exception](./DESIGN.md#as-any-runtime-guard)
for the full rule and the anti-patterns it's intended to prevent.

Two anti-patterns to avoid:

- **Calling `.where(...)` first to satisfy the typer**: now the fluent
  chain compiles but the runtime never sees the guard you wanted to test.
- **Wrapping the whole chain in `as any`**: future runtime regressions go
  undetected. Cast at the smallest possible spot.

## Extending the shared domain

The shared "project management" domain (`organization`, `app_user`,
`project`, `issue`, …) under `test/db/<db>/domain/` is small on purpose.
When a new test needs a column, a column type, or even a whole table the
domain doesn't currently expose, **extending the shared domain is the
preferred path** over declaring a local stub `class TFoo extends Table<...>`
inside the test file.

Local stubs are still legitimate in two narrow cases:

- The feature being exercised has no natural home in
  organization/app_user/project/issue and a manufactured table is what
  reads best (e.g. the `TDefaultsOnly` in `insert.default-values.test.ts`, whose
  only column is an autogenerated PK so that `.defaultValues()` compiles).
- The test is purely type-level and never executes against a real DB. The
  table name doesn't matter then; readability does.

Whenever a runtime assertion is involved — `expect(rows).toEqual(...)`,
`executeInsert()` returning a real id, a real-DB cell asserting visibility
after commit — the table needs to exist in the seed. Reach for the
shared-domain extension.

**Checklist**:

1. **Pick a name that fits the domain semantically.** "verified",
   "published", "archived", "billing_status", … not "flag1" / "col_x".
2. **Default-friendly column.** Add a `DEFAULT` clause in the DDL and
   declare it as `columnWithDefaultValue(...)` (or `optionalColumn(...)`)
   in `connection.ts`. Existing INSERT tests that didn't enumerate the new
   column then keep working without surgery.
3. **Update every dialect in lockstep.** All six domains need touching
   together — the symmetry audit walks the test files, not the schemas, so
   a missed dialect surfaces later as a real-DB failure in that cell.
   Files to touch per dialect:
   - `test/db/<db>/domain/schema.sql` — add the column with the
     dialect-appropriate type and `DEFAULT`.
   - `test/db/<db>/domain/seed.sql` — set explicit values per row so the
     test has something concrete to assert.
   - `test/db/<db>/domain/reset.sql` (every db but sqlite) — a new table goes in
     the data-only reset, or the per-test reseed leaves its rows behind.
   - `test/db/<db>/domain/connection.ts` — declare the column on the
     `Table` subclass (and add the `CustomBooleanTypeAdapter` import etc.
     as needed).
4. **Fix the shape-asserting doc-tests.** Adding a column ripples to
   `docs.advanced.utility-types.test.ts` (`ColumnKeys`, `WritableColumnKeys`,
   `WritableShapeFor`, `AutogeneratedIdColumnKeys` unions need the new key)
   and `docs.advanced.columns-from-object.test.ts` (`extractColumnsFrom`,
   `extractColumnNamesFrom`, `extractWritableShapeFrom`,
   `extractWritableColumnNamesFrom` hardcoded shapes and
   `Object.keys(...).toEqual([...])` arrays). Update the canonical
   (`sqlite/newest/bun_sqlite/`) once, copy to the other cells, re-bake the
   snapshot for `extract-columns-select-all` (it lists the full select
   clause).
5. **Re-run** `bun run tests:audit && bun run validate:tests &&
   bun run tests` end to end. If the new column has a
   `CustomBooleanTypeAdapter`, the select snapshot will surface as
   `(<col> = '<true-value>') as <col>` — sanity-check that, the adapter
   mapping was your call.

Worked example: the `verified` (organization, app_user) and `published`
(project) `CustomBooleanTypeAdapter` columns were added this way to give
`select.custom-boolean-remap.test.ts` real-domain column-vs-column
comparisons (same adapter and deliberately different adapter) instead of
three throwaway `TFlagA` / `TFlagB` / `TFlagC` stubs.

## When the canonical cell can't compile the body

A test is normally developed in its canonical cell — `postgres/newest/pg/` for
most families, `sqlite/newest/bun_sqlite/` for `docs.*` files (see
[Adding a test](#adding-a-test)). Sometimes the canonical can't compile the test
body because the feature is only typed on other dialects:

- `tTable.oldValues()` is only typed on PostgreSqlConnection,
  MariaDBConnection and SqlServerConnection.
- `deleteFrom(...).using(...)` is not exposed on SqliteConnection.
- `SqliteConnection` has no `isolationLevel(...)` method.

Recipe:

1. **Write the test directly into the canonical as a comment-out block**
   with a one-line reason on the line above, exactly like a regular
   not-applicable test:

   ```ts
   // NOT-APPLICABLE: tTable.oldValues() is only typed on PostgreSqlConnection,
   //                 MariaDBConnection and SqlServerConnection.
   /*
   test('docs-extra:update/update-returning-old-values', async () => {
       // … FULL canonical body the SUPPORTING dialect would run, verbatim …
   })
   */
   ```

2. **Mirror via `cp`** to every other cell.
3. **Uncomment in the cells where the feature IS available.** The
   `tests:audit` walks comment blocks too, so the test name counts toward
   symmetry; runtime executes only where uncommented. A small helper
   script is the easiest way to flip the comment in supporting cells
   without re-typing.
4. **Bake snapshots** for the uncommented cells and run the audit.

Pattern applies to any test file, not just docs.* — the recipe is the same
when, for example, a `select.*.test.ts` exercises a feature only typed on
certain dialects. The body inside `/* */` must be the **full canonical**
that the supporting dialect would run — never a stub. See
[`DESIGN.md` § Full-canonical-body discipline](./DESIGN.md#full-canonical-body).

## Imports used only from commented-out blocks

`noUnusedLocals` rejects an import that has no live use. When the only use
is inside a `/* … */` block (the regular not-applicable case OR the
canonical-can't-host case above), the cell where the test is commented
fails to compile unless you add a sentinel reference:

```ts
import { tIssue, tProject } from '../../domain/connection.js'

// tProject is referenced by the commented-out `docs:delete/delete-using`
// test below; the cells where that test is uncommented use it for real.
void tProject

describe(ctx.label, () => {
    // …
})
```

The `void identifier` is a zero-cost expression statement that satisfies
the unused-locals rule without affecting runtime. Drop it when the test
gets uncommented in that cell, or leave it — it is harmless either way.

## When the canonical body contains `*/`

A body that itself holds `*/` (a `rawFragment` emitting a SQL comment, for
instance) cannot be wrapped in `/* … */` — the block would end early. Keep
it as `//` line comments instead, in this exact shape:

```ts
    // NOT-SUPPORTED: <reason>. Canonical body kept as line comments below — it contains `*/`, so a /* … */ wrap is impossible.

    //     test('the-test-name', async () => {
    //         // … full canonical body, verbatim, one `//` per line …
    //     })
```

The **blank line between the marker and the body is load-bearing**: the
indexer reads a marker's reason as the marker line plus the `//` lines that
follow it, so without the gap the whole test body is absorbed into the
reason and `tests:where-is` prints an unreadable wall of code instead of a
one-line caveat. (The indexer also stops at a line that starts a
`test(`/`it(`/`describe(` call, as a second line of defence — do not rely on
it.) Keep the gap to **one** blank line: the audit splits comment runs on a
gap of more than one, and a wider gap detaches the marker from the test,
tripping `misplaced-marker`.

The name still counts for symmetry: the audit detects a commented-out test
in `//` lines exactly as it does inside a `/* … */` block.

## Docs snippets

The `docs.*.test.ts` files are tests that **try to be similar to the
documentation's examples**, written with this suite's testing model: SQL +
params + result type + value, in every cell, against real databases. They are not
a copy of the docs, they are not exhaustive, and they are not where the docs get
their code: the source of the documentation's examples is `docs/`. Testing the
examples as they stand on the page is the job of the tests generated by
[`DOC_CODE_EXTRACTOR.md`](./DOC_CODE_EXTRACTOR.md), which go from docs to tests.

A docs test pins:

- the **SQL + params** the usage emits, per dialect, via inline
  snapshot,
- the **TypeScript result type** via `assertType<Exact|Extends<…>>()`,
- the **runtime value** through `ctx.mockNext(expected)` +
  `expect(result).toEqual(expected)` so mock and real-DB paths agree.

If a snapshot moves, somebody changed the behaviour the docs advertise — that is
real signal.

### Where docs tests live

| Docs page | Test file (per cell) |
|---|---|
| `docs/queries/<slug>.md` | `test/db/<db>/<version>/<connector>/docs.<slug>.test.ts` |
| `docs/advanced/<slug>.md` | `test/db/<db>/<version>/<connector>/docs.advanced.<slug>.test.ts` |
| `docs/dynamic/<slug>.md` | `test/db/<db>/<version>/<connector>/docs.dynamic.<slug>.test.ts` |
| `docs/dynamic/utilities/<slug>.md` | `test/db/<db>/<version>/<connector>/docs.dynamic.utilities.<slug>.test.ts` |
| `docs/configuration/<slug>.md` | `test/db/<db>/<version>/<connector>/docs.configuration.<slug>.test.ts` |

**One file per page** — the snippet-backed `docs:` tests and the
prose-backed `docs-extra:` tests for a given docs page live together in a
single file. That file is mirrored to every `(database × version × connector)`
cell per the [Symmetry rule](./DESIGN.md#symmetry-rule). The audit
enforces the mirror.

### Two test-name prefixes: `docs:` and `docs-extra:`

| Prefix | Origin on the page | `doc-start` / `doc-end` |
|---|---|---|
| `docs:<page-slug>/<anchor>` | a fenced code block on the page | expected |
| `docs-extra:<page-slug>/<anchor>` | behaviour the page **describes in prose** (bullet lists, notes, "the result type also accepts …", method-list options) but does NOT illustrate with code | optional |

Rule of thumb when covering a docs page:

- Every fenced block that **uses** the API with a concrete example, whether it
  calls a method or applies a type (`type Paths = DeepPickPaths<Customer>`) → one
  `docs:` test, even when another file of the suite covers the behaviour: the
  point is to resemble the page.
- A fenced block that only **declares** the surface (a TypeScript
  `interface { … }` / `type X = ...` block listing methods or members for
  reference) → treat as **prose** and split into `docs-extra:` tests, one per
  individually testable member.
- A sentence, admonition or bullet that promises behaviour that is not backed
  by a fenced block → one `docs-extra:` test, only when no other test of the
  suite covers it. These files are not exhaustive.

Both prefixes are equally first-class — the `docs:` ones follow an example of
the page; the `docs-extra:` ones are the regression net for
behaviour the page promises without showing. Mix them in the same
`describe(ctx.label, () => { ... })` block, sharing imports and fixtures.

### The `doc-start` / `doc-end` block

`docs:` tests bracket the part that corresponds to the page's example with
`// doc-start` on the line **above** it and `// doc-end` on the line **below**.
Everything outside (mock seeding, `expect`, `assertType`, fixture imports) is the
test's own machinery. The markers are a reading aid: nothing reads them.

Conventions:

- At most one `doc-start` / `doc-end` pair per `test(...)` block.
- Keep the marked part small — if it sprawls past a screenful, the docs page is
  probably trying to explain two things; split into two tests with their
  own anchors.

`docs-extra:` tests **may** include a `doc-start` / `doc-end` block if the
implementation happens to demonstrate a useful idiom, but it's optional.

### Domain translation

Docs pages use the legacy `tCustomer` / `tCompany` / `tOrder` schema. The
test matrix uses the project-management domain declared in
`test/db/<db>/domain/connection.ts`:

| Test domain | Stand-in for the docs domain |
|---|---|
| `tOrganization` | `tCompany` |
| `tAppUser` | `tCustomer` |
| `tProject` | top-level grouping owned by an organisation |
| `tIssue` | child of a project, has priority, status, assignee |

When porting a snippet, preserve **structure** (operators, method calls,
fluent chain shape, presence/absence of `where`/`groupBy`/`orderBy`/etc.)
and substitute **identifiers**. The SQL the test emits is NOT lexically
identical to the SQL shown on the docs page; the inline snapshot records
what the test actually emits.

### Canonical cell for `docs.*` files

When adding a new docs.* test file, write it first in
`sqlite/newest/bun_sqlite/` — in-process, bun-native, fastest iteration
loop. Mirror to the rest after the file is green there.

### Cross-page borrowing

Sometimes the prose on page **A** describes behaviour that conceptually
belongs to feature **B** — `executeSelectPage`'s `EXTRAS` argument, for
example, is documented in `docs/queries/basic-query-structure.md` (a
trailing bullet list under "Other options") even though the feature itself
is the `executeSelectPage` API.

Rule: **the test goes in the file that owns the feature** (here,
`docs.select-page.test.ts`), not in the file mirrored from the page that
mentions it. Leave a one-line comment in the test body citing the page the
behaviour was documented on.

### Adding coverage for a new docs page

1. **Read the page top-to-bottom.** Enumerate every fenced ```ts/```tsx
   block that calls the API (one `docs:` test) and every prose-only
   feature/promise (one `docs-extra:` test).
2. **Create the file in the sqlite canonical cell**:
   `test/db/sqlite/newest/bun_sqlite/docs.<slug>.test.ts`.
3. **Write each test.** Translate identifiers per the table above; preserve
   structure. Mark the example's part of `docs:` tests with `// doc-start` /
   `// doc-end`. Prime
   `ctx.mockNext(expected)`, assert SQL+params with empty
   `toMatchInlineSnapshot()`, assert types with `assertType<...>()`, assert
   value with `expect(result).toEqual(expected)`.
4. **Bake snapshots** in the sqlite cell:
   ```bash
   bun run tests sqlite/newest/bun_sqlite/docs.<slug>.test.ts --update-snapshots
   ```
5. **Mirror to every other cell.** For each `(db, version, connector)`
   under `test/db/`, copy the file and re-bake snapshots.
6. **Comment out (do not delete)** any test that does not apply to a cell,
   with a one-line reason above the `/* … */` block. The body stays
   verbatim per the [Full-canonical-body discipline](./DESIGN.md#full-canonical-body).
7. **Verify**: `tests:audit`, `validate:tests`, `tests`.

## When a test surfaces a bug in `src/`

**Division of labor.** The agent writing or porting tests detects bugs and
hands them off; a separate fixing agent diagnoses and patches `src/`.
Mixing both roles breaks the test agent's breadth-first momentum and
produces shallow analysis. This split is not optional.

Before triaging, **ask the index, not `grep`**. The same lookup answers
three different questions in one report — paste the output into the
entry as the verifiable artifact:

```bash
bun run tests:where-is --search <api> --bugs summary --limitation summary --not-supported summary --not-applicable summary --declared full
```

- `--bugs / --limitation / --not-supported / --not-applicable` → if any of
  the four first-class reason markers (`// TODO[BUG]`, `// TODO[LIMITATION]`,
  `// NOT-SUPPORTED`, `// NOT-APPLICABLE`) already names the API, reuse the
  existing reason header instead of opening a duplicate. The four categories
  are distinct (see [`LIMITATIONS.md` § The decision
  rule](./LIMITATIONS.md#the-decision-rule) for the comparison).
- `--declared full` → every declaration site of the symbol. Do **not**
  trust a previously-opened entry's "Where:" line as exhaustive — that
  field reflects what the original author saw. Recent miss: an entry on
  `virtualColumnFromFragment` named `View.ts` and `Values.ts`; the
  symbol also lives in `Table.ts`. A grep of the two listed files
  would have left `Table.ts` regressed.

If the bug is in the type system (overload, variance, assignability),
swap the preset: `--for type-bug` bundles `declared full · signature
full · ref-type-arg full · neg-types full · bugs summary · limitation
summary · not-supported summary · not-applicable summary · mock-only summary · chain none` — the route is the
signature, not the call-chain, and a `never` typing often means
`NOT-APPLICABLE` (a deliberate dialect boundary, not a bug). Before
inventing a new helper or type alias to work around the bug, check
that the shape doesn't already exist under a different name:

```bash
bun run tests:where-is --search-pattern-summary '<shared-token>'
```

(Past near-miss: nearly re-introduced `AllowsNoTableOrViewRequired` by
hand.) Full guide in [`CODE_SEARCH.md` § "This tool vs. textual search"](./CODE_SEARCH.md#this-tool-vs-textual-search).

**Test author's checklist** (this is all you do when you find a suspect):

1. Two-minute triage — four buckets, four first-class reason markers
   (full distinction in [`LIMITATIONS.md` § The decision
   rule](./LIMITATIONS.md#the-decision-rule)):
   - **Dialect boundary by design** (the TYPE SURFACE doesn't expose the
     call here, so it can't be written; the same test runs live in the
     cells whose dialect supports it) → block-comment with
     `// NOT-APPLICABLE: <reason>` and, if the constraint is new in the
     matrix, add an entry to [`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md).
     A paired `types.negative/` assertion on the unsupported dialect is
     usually warranted.
   - **The RUNTIME can't run it** (the call compiles and the library emits
     SQL, but this engine — or this engine *version*, or its build, or the
     driver — rejects, lacks or mis-evaluates it) → block-comment with
     `// NOT-SUPPORTED: see ENGINE_SUPPORT.md — <one-line>` and, if the fact
     is new, add an entry to [`ENGINE_SUPPORT.md`](./ENGINE_SUPPORT.md).
     **Not a TODO**: nothing in this repo re-enables it.
   - **Known library limitation per the author** (lib hasn't covered the
     path yet, or this harness can't drive it — and a change HERE would
     close it, on every connector of the dialect) →
     [`LIMITATIONS.md`](./LIMITATIONS.md) already covers it; block-comment
     with `// TODO[LIMITATION]: see LIMITATIONS.md — <one-line>` and move on.
   - **Anything else** (the lib *should* support the call and is broken)
     → `// TODO[BUG]: <reason>` (on the assertion if the test stays live,
     or as the comment-out reason if you wrap the whole test). Add ONE
     paragraph in [`BUGS.md`](./BUGS.md) — enough to reproduce, no deeper.
2. Leave the suite green (assert current wrong behaviour, or block-comment
   per the symmetry rule with the full canonical body).
3. Keep going with the next test. **Do not pause to read `src/`.**

**Not the test author's job — delegated to the fixing agent:**

- Root-cause diagnosis (reading `src/queryBuilders/...`, `src/sqlBuilders/...`).
- Categorising the bug shape (the common shapes are listed in
  [`BUGS.md` § Common bug shapes](./BUGS.md#common-bug-shapes-for-the-fixing-agent)).
- Writing the fix in `src/`.
- Writing the matching negative-type test under
  `test/db/<db>/types.negative/` that locks the new (narrower) public
  contract.
- Closing the `BUGS.md` entry.
- Rewriting the `// TODO[BUG]` comment to its final form.
- Deciding whether the wrapped test gets uncommented after the fix.

**Worked example.** This suite
flagged `PostgreSqlConnection.onConflictDoUpdateSet` accepting the bare
upsert form that PostgreSQL rejects → entry in `BUGS.md` plus `TODO[BUG]`
in the postgres cells. The fixing agent removed the methods from
`PostgreSqlConnection` typing, added negative-type tests in
`test/db/postgres/types.negative/insert.test.ts`, closed the `BUGS.md`
entry, and converted the wrap reasons in this suite to `// NOT-APPLICABLE: …`
pointing at that compile-time negative.
