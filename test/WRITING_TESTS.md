# `test/` — writing tests

How to write, port, comment-out, and debug a test in this suite. Tutorial,
not normative — the rules live in [`DESIGN.md`](./DESIGN.md); this doc
shows how to apply them.

- [Anatomy of a test file](#anatomy-of-a-test-file)
- [Updating snapshots](#updating-snapshots)
- [Real-DB validation of one cell](#real-db-validation-of-one-cell)
- [Adding a test](#adding-a-test)
- [Negative type tests](#negative-type-tests)
- [Handling tsgo / tsc divergences](#handling-tsgo--tsc-divergences)
- [Testing a runtime guard that is also typed at compile time](#testing-a-runtime-guard-that-is-also-typed-at-compile-time)
- [Extending the shared domain](#extending-the-shared-domain)
- [When the canonical cell can't compile the body](#when-the-canonical-cell-cant-compile-the-body)
- [Imports used only from commented-out blocks](#imports-used-only-from-commented-out-blocks)
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
   [`docs/composition/`](../docs/composition/) or
   [`docs/configuration/`](../docs/configuration/)) and any
   `docs/configuration/supported-databases/<database>.md` /
   `docs/configuration/query-runners/<connector>.md` pages that affect the
   cells you'll touch.

2. **Check whether the test would be redundant** — grep the existing test
   inventory:

   ```bash
   grep -rln "<api-symbol>" test/db/postgres/newest/pg/ | head
   grep -rln "<api-symbol>" test/db/sqlite/newest/bun_sqlite/ | head
   ```

   If matches exist, read those tests in full. If they already cover the
   shape you wanted, the wave is "strengthen the existing test", not "add
   a new one".

3. **Pick the file that fits the scenario** (`select.basic`,
   `insert.returning`, `update.basic`, …). If none fits, create it in
   **every** valid `<connector>/` folder in the same commit, with the test
   bodies that do not apply commented out per
   [`DESIGN.md` § Symmetry rule](./DESIGN.md#symmetry-rule) (never deleted,
   never `test.skip(...)`).

4. **Write the test in the canonical cell first.** Defaults:

   - `postgres/newest/pg/` for most families (`select.*`, `insert.*`,
     `update.*`, `delete.*`, `errors.*`, `transaction.*`, `fragments.*`,
     `raw-fragment.*`, `with-values.*`, `customize-query.*`,
     `dynamic-condition.*`).
   - `sqlite/newest/bun_sqlite/` for `docs.*` files — the cell flagged
     `canonicalForDocs: true`.
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
   bun run tests sqlite/newest/bun_sqlite/<slug>.test.ts --update-snapshots
   ```

6. **Real-validate the canonical** — see
   [Real-DB validation of one cell](#real-db-validation-of-one-cell). If
   the canonical is SQLite native, the bake above already did it.

7. **Port the same `describe` + `test` name to every other cell.** SQL
   differs when it must (the snapshot in each cell records its own
   version); comment out (do not delete) when the test does not apply.
   The commented body must be the **full canonical** per
   [`DESIGN.md` § Full-canonical-body discipline](./DESIGN.md#full-canonical-body).

8. **If the test should appear in documentation, prefix `docs:`** and add
   the `// doc-start` / `// doc-end` block. See [Docs snippets](#docs-snippets).

9. **Verify**:

   ```bash
   bun run tests:audit         # symmetry ✓
   bun run validate:tests      # typecheck ✓ (tsgo)
   bun run tests               # mock matrix ✓
   ```

## Negative type tests

```
test/db/<database>/types.negative/
├── select.test.ts
└── …
```

```ts
function _typeNegatives() {
    // Rule: GREATEST between a localDate and a string must not compile.
    // @ts-expect-error type mismatch
    connection.greatest(tIssue.createdAt, 'foo')
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
- `bun run validate:tests` (or `validate:tests:tsgo`) is the real
  assertion. If a directive becomes "unused", the build fails — exactly the
  regression signal we want.
- The `types.negative/` folder is **not** part of the cell matrix and is
  skipped by `tests:audit`.

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

## Handling tsgo / tsc divergences

`bun run validate:tests` runs `tsgo -p test/tsconfig.json --noEmit` (the
TypeScript 7 Go-based compiler) and is the **authoritative** check for the
`test/` matrix. `bun run validate:tests:tsc` runs `tsc -p test/tsconfig.tsc.json --noEmit`
as a sub-experience.

The role split applies only to tests because tests don't ship — there's no
downstream tsc-compat obligation, so the agent's default loop gets tsgo's
speed and stricter span behaviour. CI runs both.

Negative type tests are written **in tsgo style** — directives placed where
tsgo reports the error. When that placement also satisfies `tsc` (the
common case: single-statement assertions and call-site errors), nothing
else is needed.

Occasionally the two compilers disagree on where the error span lands and a
directive that works in tsgo looks "unused" to tsc (or vice versa). The
TypeScript core team explicitly leaves this unspecified —
[microsoft/typescript-go#1088](https://github.com/microsoft/typescript-go/issues/1088)
(closed *not planned*): *"we don't provide any guarantees on error spans
when either error is valid"*. The two spans are equally valid and neither
compiler will rebase its choice.

When a divergence makes a file fail under `validate:tests:tsc` but not
under `validate:tests`:

1. Confirm the placement tsgo wants is the one with semantic precision (the
   narrower span — what a future tsc release is most likely to converge
   towards).
2. Keep the directive in that position.
3. Add the file to the `exclude` list in
   [`test/tsconfig.tsc.json`](./tsconfig.tsc.json) so the sub-experience
   stops trying to validate it. The exclusion is per-file (not per-directive),
   so add the smallest path that isolates the divergence.
4. The file is still covered by the authoritative `validate:tests` (tsgo),
   so the negative remains protected.

When `tsc` aligns with `tsgo` in a future release — or when those
negatives are rewritten as type-level assertions per Ryan Cavanaugh's
recommendation — empty the `exclude` list and the two compilers cover the
same surface again. Eventually `test/tsconfig.tsc.json` can disappear
entirely and `validate:tests:tsc` can point back at `test/tsconfig.json`.

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

This is the **only** sanctioned `as any` in test bodies. Outside this exact
use, `as any` is forbidden — see
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
  reads best (e.g. the `TFlag` in
  `docs.advanced.custom-booleans-values.test.ts` exists to demonstrate the
  adapter in isolation, mirroring the docs page that uses the same name).
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
3. **Update every dialect in lockstep.** All six pairs need touching
   together — the symmetry audit walks the test files, not the schemas, so
   a missed dialect surfaces later as a real-DB failure in that cell.
   Files to touch per dialect:
   - `test/db/<db>/domain/schema.sql` — add the column with the
     dialect-appropriate type and `DEFAULT`.
   - `test/db/<db>/domain/seed.sql` — set explicit values per row so the
     test has something concrete to assert.
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
5. **Re-run** `bun run tests:audit && bun run validate:tests:tsc &&
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

A test is normally developed in the cell with the fastest iteration loop
— `sqlite/newest/bun_sqlite/` for `docs.*` files (it's also
`canonicalForDocs: true`), the closest equivalent for any other test
family. Sometimes the canonical can't compile the test body because the
feature is only typed on other dialects:

- `tTable.oldValues()` is only typed on PostgreSqlConnection,
  MariaDBConnection and SqlServerConnection.
- `deleteFrom(...).using(...)` is not exposed on SqliteConnection.
- `SqliteConnection` has no `isolationLevel(...)` method.

Recipe:

1. **Write the test directly into the canonical as a comment-out block**
   with a one-line reason on the line above, exactly like a regular
   not-applicable test:

   ```ts
   // Not applicable on SQLite: tTable.oldValues() is only typed on
   // PostgreSqlConnection, MariaDBConnection and SqlServerConnection.
   /*
   test('docs:update/update-returning-old-values', async () => {
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

## Docs snippets

Every public feature shown or described in a `docs/queries/*.md` or
`docs/advanced/*.md` page must have a test that pins:

- the **SQL + params** the documented usage emits, per dialect, via inline
  snapshot,
- the **TypeScript result type** via `assertType<Exact|Extends<…>>()`,
- the **runtime value** through `ctx.mockNext(expected)` +
  `expect(result).toEqual(expected)` so mock and real-DB paths agree.

Locking the public API the docs advertise against drift; if a snapshot
moves, somebody changed the public surface — that is real signal.

### Where docs tests live

| Docs page | Test file (per cell) |
|---|---|
| `docs/queries/<slug>.md` | `test/db/<db>/<version>/<connector>/docs.<slug>.test.ts` |
| `docs/advanced/<slug>.md` | `test/db/<db>/<version>/<connector>/docs.advanced.<slug>.test.ts` |

**One file per page** — the snippet-backed `docs:` tests and the
prose-backed `docs-extra:` tests for a given docs page live together in a
single file. That file is mirrored to every `(database × version × connector)`
cell per the [Symmetry rule](./DESIGN.md#symmetry-rule). The audit
enforces the mirror.

### Two test-name prefixes: `docs:` and `docs-extra:`

| Prefix | Origin on the page | `doc-start` / `doc-end` |
|---|---|---|
| `docs:<page-slug>/<anchor>` | a literal fenced code block on the page | **required** |
| `docs-extra:<page-slug>/<anchor>` | behaviour the page **describes in prose** (bullet lists, notes, "the result type also accepts …", method-list options) but does NOT illustrate with code | optional |

Rule of thumb when reading a docs page:

- Every fenced ```ts/```tsx block that **calls** the API → one `docs:` test.
- A fenced block that **declares** the surface (a TypeScript `interface { … }`
  / `type X = ...` block listing methods or members for reference) → treat
  as **prose** and split into `docs-extra:` tests, one per individually
  testable member.
- Every sentence, admonition or bullet that promises behaviour that is not
  backed by a fenced block → one `docs-extra:` test.

Both prefixes are equally first-class — the `docs:` ones double as
publishable snippets; the `docs-extra:` ones are the regression net for
behaviour the page promises without showing. Mix them in the same
`describe(ctx.label, () => { ... })` block, sharing imports and fixtures.

### The `doc-start` / `doc-end` block

`docs:` tests must bracket the user-facing snippet with `// doc-start` on
the line **above** the snippet and `// doc-end` on the line **below**. Only
the lines between those markers represent the snippet a docs reader sees;
everything outside (mock seeding, `expect`, `assertType`, fixture imports)
stays in the file but is not part of the documented example.

Constraints:

- At most one `doc-start` / `doc-end` pair per `test(...)` block.
- The block must be valid TypeScript on its own.
- Keep the snippet small — if it sprawls past ~25 lines, the docs page is
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

### Canonical setup per database

Exactly one cell per database flags its `setup.ts` with
`canonicalForDocs: true`. Today:

| Database | Canonical cell |
|---|---|
| mariadb | `newest/mariadb` |
| mysql | `newest/mysql2` |
| oracle | `newest/oracledb` |
| postgres | `newest/pg` |
| sqlite | `newest/bun_sqlite` |
| sqlserver | `newest/mssql` |

When adding a new docs.* test file, write it first in the sqlite canonical
(`sqlite/newest/bun_sqlite/`) — in-process, bun-native, fastest iteration
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
   structure. Wrap `docs:` snippets in `// doc-start` / `// doc-end`. Prime
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
bun run tests:where-is --search <api> --bugs summary --limitation summary --declared full
```

- `--bugs / --limitation` → if a `// TODO[BUG]` or `// TODO[LIMITATION]`
  already names the API, reuse the existing reason header instead of
  opening a duplicate.
- `--declared full` → every declaration site of the symbol. Do **not**
  trust a previously-opened entry's "Where:" line as exhaustive — that
  field reflects what the original author saw. Recent miss: an entry on
  `virtualColumnFromFragment` named `View.ts` and `Values.ts`; the
  symbol also lives in `Table.ts`. A grep of the two listed files
  would have left `Table.ts` regressed.

If the bug is in the type system (overload, variance, assignability),
swap the preset: `--for type-bug` bundles `declared full · signature
full · ref-type-arg full · neg-types full · bugs summary · limitation
summary · chain none` — the route is the signature, not the
call-chain. And before inventing a new helper or type alias to work
around the bug, check that the shape doesn't already exist under a
different name:

```bash
bun run tests:where-is --search-pattern-summary '<shared-token>'
```

(Past near-miss: nearly re-introduced `AllowsNoTableOrViewRequired` by
hand.) Full guide in [`CODE_SEARCH.md` § "This tool vs. textual search"](./CODE_SEARCH.md#this-tool-vs-textual-search).

**Test author's checklist** (this is all you do when you find a suspect):

1. Two-minute triage — three buckets:
   - **Dialect-specific limitation already documented** → comment-out the
     test on the affected cell with `// Not applicable on <DB>: <reason>`
     and, if the constraint is new, add an entry to
     [`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md).
   - **Known library limitation per the author** →
     [`LIMITATIONS.md`](./LIMITATIONS.md) already covers it; wrap with
     `// TODO[LIMITATION]: see LIMITATIONS.md — <one-line>` and move on.
   - **Anything else** → `// TODO[BUG]` (on the assertion if the test stays
     live, or as the comment-out reason if you wrap the whole test). Add
     ONE paragraph in [`BUGS.md`](./BUGS.md) — enough to reproduce, no
     deeper.
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

**Worked example.** Commit `9b5ab1c` shows the full cycle: this suite
flagged `PostgreSqlConnection.onConflictDoUpdateSet` accepting the bare
upsert form that PostgreSQL rejects → entry in `BUGS.md` plus `TODO[BUG]`
in the 8 postgres cells. The fixing agent removed the methods from
`PostgreSqlConnection` typing, added 5 negative-type tests in
`test/db/postgres/types.negative/insert.test.ts`, closed the `BUGS.md`
entry, and converted the wrap reasons in this suite to "Not applicable …
see test/db/postgres/types.negative/insert.test.ts for the compile-time
negative".
