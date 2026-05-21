# `test/` — maintaining and extending the suite

Companion to [`README.md`](./README.md). Read this when you are adding a
test, adding a database, running the pre-merge typecheck / symmetry
audit, or touching the prisma / sync sub-trees.

- [Typechecking](#typechecking)
- [Auditing symmetry](#auditing-symmetry)
- [Adding a test](#adding-a-test)
  - [Test-context surface](#test-context-surface)
  - [Testing a runtime guard that is also typed at compile time](#testing-a-runtime-guard-that-is-also-typed-at-compile-time)
  - [When the shared domain is missing what your test needs](#when-the-shared-domain-is-missing-what-your-test-needs)
  - [Mock-only is a smell — restructure before reaching for the guard](#mock-only-is-a-smell--restructure-before-reaching-for-the-guard)
  - [If a new test surfaces a bug in `src/`](#if-a-new-test-surfaces-a-bug-in-src)
- [Adding a database](#adding-a-database)
- [Why the duplication between cells?](#why-the-duplication-between-cells)
  - [When the canonical cell can't compile the body](#when-the-canonical-cell-cant-compile-the-body)
  - [Imports used only from commented-out blocks](#imports-used-only-from-commented-out-blocks)
- [Prisma and sync runners](#prisma-and-sync-runners)

## Typechecking

```bash
bun run validate:tests           # tsgo -p test/tsconfig.json --noEmit (authoritative)
bun run validate:tests:tsc       # tsc -p test/tsconfig.tsc.json --noEmit (sub-experience)
```

**`tsgo` is the authoritative compiler for the test matrix**, and the
canonical `validate:tests` command runs it against the full
[`test/tsconfig.json`](./tsconfig.json). tsgo is the Go-based
TypeScript 7 rewrite, roughly **~6× faster** than `tsc` on this
project, fast enough to live in the inner edit-typecheck loop. The
rationale for making it authoritative *only here* (`src/` still
treats `tsc` as authoritative because the published typings must
keep compiling for downstream consumers) is that tests do not ship,
so there is no tsc-compat obligation. The sub-experience
`validate:tests:tsc` exists as a secondary safety net while `tsgo`
is still officially preview. Both run in CI.

`tsc` / `tsgo` are runtime-independent — invoke with either `bun run`
or `npm run`, the entry is the same and runs the same compiler.

`validate:tests` is also where the negative type tests
(`test/db/<database>/types.negative/`) are actually checked. If a
library change unintentionally weakens an API restriction, an
`@ts-expect-error` becomes "unused" and the compiler fails the
build — exactly the signal we want.

### Handling tsgo / tsc divergences

Negative type tests are written **in tsgo style** — directives placed
where tsgo reports the error. When that placement also satisfies
`tsc` (the common case: single-statement assertions and call-site
errors), nothing else is needed.

Occasionally the two compilers disagree on where the error span
lands and a directive that works in tsgo looks "unused" to tsc (or
vice versa). The TypeScript core team explicitly leaves this
unspecified — see [microsoft/typescript-go#1088](https://github.com/microsoft/typescript-go/issues/1088)
(closed *not planned*): *"we don't provide any guarantees on error
spans when either error is valid"*. The two spans are equally valid
and neither compiler will rebase its choice.

When a divergence makes a file fail under `validate:tests:tsc` but
not under `validate:tests`, the recipe is:

1. Confirm the placement that tsgo wants is the one with semantic
   precision (the narrower span — what a future tsc release is most
   likely to converge towards).
2. Keep the directive in that position.
3. Add the file to the `exclude` list in
   [`test/tsconfig.tsc.json`](./tsconfig.tsc.json) so the
   sub-experience stops trying to validate it. The exclusion is
   per-file (not per-directive), so add the smallest path that
   isolates the divergence.
4. The file is still covered by the authoritative `validate:tests`
   (tsgo), so the negative remains protected.

When `tsc` aligns with `tsgo` in a future release — or when those
negatives are rewritten as type-level assertions per Ryan
Cavanaugh's recommendation — empty the `exclude` list and the two
compilers cover the same surface again. Eventually
`test/tsconfig.tsc.json` can disappear entirely and
`validate:tests:tsc` can point back at `test/tsconfig.json`.

## Auditing symmetry

```bash
bun run tests:audit
```

The script runs under `tsx` so it works identically under `bun run` or
`npm run`.

Walks `test/db/` and verifies the symmetry rule from
[`DESIGN.md` §4](./DESIGN.md#4-symmetry-rules--critical-maintainability-property):
every cell of a database must have the same `.test.ts` files with the
same test names (executed *or* commented-out) in the same order. Exit
code is `0` on a symmetric matrix, `1` on any divergence. Useful as a
pre-merge check.

The audit lives at [`test/lib/auditTestSymmetry.ts`](./lib/auditTestSymmetry.ts)
so it is type-checked by `validate:tests` like the rest of the suite.

## Adding a test

Short version. The full procedure is [`DESIGN.md` §9](./DESIGN.md#9-adding-a-new-test).

0. **Read the library docs first.** Tests encode behaviour the library
   documents — they do not invent it. Before writing anything, open
   the page for the feature you are testing (under
   [`docs/queries/`](../docs/queries/),
   [`docs/composition/`](../docs/composition/) or
   [`docs/configuration/`](../docs/configuration/)) and any
   `docs/configuration/supported-databases/<database>.md` /
   `docs/configuration/query-runners/<connector>.md` pages that affect
   the cells you will touch. The full reasoning is in
   [`DESIGN.md` §1.4](./DESIGN.md#1-principles).
1. Pick the file that already fits the scenario (`select.basic`,
   `insert.returning`, `update.basic`, …). Create the file in **every**
   valid `<connector>/` folder if it does not exist anywhere yet.
2. Use the same `describe` and `test` names across every cell. When the
   test does not apply to a cell, **comment out the entire `test(...)`
   block** with a one-line reason above (do **not** use `test.skip(...)`
   and do **not** delete). Full rule:
   [`DESIGN.md` §4](./DESIGN.md#4-symmetry-rules--critical-maintainability-property).
3. Write the SQL + params assertions with empty
   `toMatchInlineSnapshot()` and let
   `bun test … --update-snapshots` bake the actual values in
   (`bun run tests:focus <db>/<version>/<connector> --docker -- --update-snapshots`
   is the focused variant).
4. Mutating tests wrap the body in
   `ctx.withRollback(async () => { … })` so the seed survives. See
   [`CONTAINERS.md` § Data-mutation safety](./CONTAINERS.md#data-mutation-safety-cooperative-contract)
   for `withCommit` / `withReseed` and when each applies.

### Test-context surface

`ctx` (typed `TestContext<CONN>` in
[`test/lib/testContext.ts`](./lib/testContext.ts)) is the single
object every test file imports. Cheat sheet for what's available when
writing a new test — pick the narrowest tool for the job:

| Want to … | Use |
|---|---|
| Run a query | `ctx.conn` |
| Cell lifecycle | `ctx.up()` in `beforeAll`, `ctx.down()` in `afterAll`, `ctx.reset()` in `beforeEach` |
| Prime the mock's next return value | `ctx.mockNext(expected)` — ignored when the real DB is on, since the seed already contains the same value |
| Assert SQL / params of the most recent query | `ctx.lastSql` / `ctx.lastParams` (and `ctx.lastType` for `select` / `insert` / `update` / `delete` / `transaction` / …) |
| Assert SQL inside a `connection.transaction(...)` block | `ctx.lastNoTransactionSql` / `ctx.lastNoTransactionParams` / `ctx.lastNoTransactionType` — same triplet, but skips the synthetic `begin`/`commit`/`rollback` entries the interceptor records, so `lastNoTransactionSql` is the real `SELECT … FROM …` that ran inside |
| Assert multiple queries from one test body | `ctx.history` — `ReadonlyArray<{ type, sql, params }>` in emission order, includes begin/commit/rollback |
| Mutate state safely (default) | `ctx.withRollback(fn)` — wraps in a transaction and rolls back on exit |
| Mutate state when commit must persist (DDL on non-transactional-DDL engines, post-commit visibility, sequence advance) | `ctx.withCommit(fn)` |
| Mutate state when the test body opens its own `connection.transaction(...)` | `ctx.withReseed(fn)` — no outer tx, reseeds on exit |
| Branch only when mock vs real differ for legitimate reasons (autogen ids, FP precision, engine-specific function support) | `if (ctx.realDbEnabled) { … } else { … }` |
| Read cell metadata | `ctx.label`, `ctx.canonicalForDocs`, `ctx.compatibilityVersion`, `ctx.timeoutMs` |

The `lastNoTransaction*` triplet, `withCommit`, `withReseed` and the
`mockRunnerClass` factory option were added after the initial test
infrastructure — they cover scenarios `withRollback` alone doesn't:
`connection.transaction(...)` docs tests, DDL on engines without
transactional DDL, and observable param-shape divergences between
real and mock runners. Mutation primitives are documented end-to-end
in [`CONTAINERS.md` § Data-mutation safety](./CONTAINERS.md#data-mutation-safety-cooperative-contract);
the runner-divergence option is in
[`test/lib/mockRunners/README.md`](./lib/mockRunners/README.md).

### Testing a runtime guard that is also typed at compile time

A handful of `TsSqlProcessingError` paths fire from inside the SQL
builders when the user misuses the API. The typer is built to catch
the same misuses at compile time, so writing the offending code
directly does not compile:

```ts
// ✗ does not compile — `.executeDelete` is not on `DeleteExpression`
//   until `.where(...)` has been called.
connection.deleteFrom(tIssue).executeDelete()

// ✗ does not compile — `set(...)` returns `NotExecutableUpdateExpression`,
//   which lacks `executeUpdate`.
connection.update(tIssue).set({ title: 'x' }).executeUpdate()

// ✗ does not compile — the orderBy literal must be a selected alias.
connection.selectFrom(tProject).select({ id: tProject.id })
    .orderBy('notSelected')
    .executeSelectMany()

// ✗ does not compile on some dialects — `defaultValues()` resolves to
//   `never` when `RequiredColumnsForSetOf<TABLE>` is not `never`.
connection.insertInto(tDefaultsOnly).defaultValues()
```

These compile-time guards are deliberate (see
[`DESIGN.md`](./DESIGN.md)) and the typer does many contortions to
arrive at the `never` that fails the call site. The runtime
implementation is still there; the test of the runtime guard needs
to reach it.

**Rule for writing the test**: cast through `any` precisely at the
fluent step the typer blocks, and document why the cast is there.
Casting the whole chain to `any` hides too much; cast the narrowest
edge that escapes the type, then let the rest of the chain be
typed normally so a future regression (e.g. a method being removed
at runtime) still surfaces.

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
    expect(e instanceof TsSqlError ? e.errorReason.reason : undefined)
        .toBe('MISSING_WHERE')
})
```

Worked examples: see `test/db/*/*/*/errors.processing.test.ts` and
`test/db/*/*/*/insert.default-values.test.ts`.

Two anti-patterns to avoid:

- **Calling `.where(...)` first to satisfy the typer**: now the
  fluent chain compiles but the runtime never sees the guard you
  wanted to test. The test asserts something else.
- **Wrapping the whole chain in `as any`**: future runtime regressions
  (a method being renamed, a builder returning a different shape) go
  undetected. Cast at the smallest possible spot.

### When the shared domain is missing what your test needs

The shared "project management" domain
([`test/db/<db>/domain/connection.ts`](./db/sqlite/domain/connection.ts)
+ the matching `schema.sql` / `seed.sql`) is small on purpose. When a
new test needs a column, a column type, or even a whole table the
domain doesn't currently expose, **extending the shared domain is the
preferred path** over declaring a local stub `class TFoo extends
Table<...>` inside the test file. Tests should look like real
project-management queries; a local `TFlagA` / `TFlagB` reads as
"contrived test scaffolding" and the assertion stops landing on
something a reader can hold in their head.

Local stubs are still legitimate in two narrow cases:

- The feature being exercised has no natural home in
  organization/app_user/project/issue and a manufactured table is
  what reads best (e.g. the `TFlag` in
  `docs.advanced.custom-booleans-values.test.ts` exists to demonstrate
  the adapter in isolation, mirroring the docs page that uses the
  same name).
- The test is purely type-level and never executes against a real
  DB. The table name doesn't matter then; readability is what does.

Whenever a runtime assertion is involved — `expect(rows).toEqual(...)`,
`executeInsert()` returning a real id, a real-DB cell asserting
visibility after commit — the table needs to exist in the seed.
Reach for the shared-domain extension.

**Extending the shared domain — checklist**:

1. **Pick a name that fits the domain semantically.** "verified",
   "published", "archived", "billing_status", … not "flag1" / "col_x".
   The test reads better and the column actually says something about
   the entity.
2. **Default-friendly column.** Add a `DEFAULT` clause in the DDL and
   declare it as `columnWithDefaultValue(...)` (or
   `optionalColumn(...)`) in `connection.ts`. Existing INSERT tests
   that didn't enumerate the new column then keep working without
   surgery.
3. **Update every dialect in lockstep.** All six pairs need touching
   together — the symmetry audit walks the test files, not the
   schemas, so a missed dialect surfaces later as a real-DB failure
   in that cell. Files to touch per dialect:
   - `test/db/<db>/domain/schema.sql` — add the column with the
     dialect-appropriate type and `DEFAULT`.
   - `test/db/<db>/domain/seed.sql` — set explicit values per row so
     the test has something concrete to assert.
   - `test/db/<db>/domain/connection.ts` — declare the column on the
     `Table` subclass (and add the `CustomBooleanTypeAdapter` import
     etc. as needed).
4. **Fix the shape-asserting doc-tests.** Adding a column ripples to:
   - `docs.advanced.utility-types.test.ts` — `ColumnKeys`,
     `WritableColumnKeys`, `WritableShapeFor`,
     `AutogeneratedIdColumnKeys` unions need the new key.
   - `docs.advanced.columns-from-object.test.ts` —
     `extractColumnsFrom`, `extractColumnNamesFrom`,
     `extractWritableShapeFrom`, `extractWritableColumnNamesFrom`
     hardcoded shapes and `Object.keys(...).toEqual([...])` arrays.
   Update the canonical (`sqlite/newest/bun_sqlite/`) once, copy to
   the other 16 cells, re-bake the snapshot for
   `extract-columns-select-all` (it lists the full select clause).
5. **Re-run** `bun run tests:audit && bun run validate:tests:tsc &&
   bun run tests` end to end. If the new column has a
   `CustomBooleanTypeAdapter`, the select snapshot will surface as
   `(<col> = '<true-value>') as <col>` — sanity-check that, the
   adapter mapping was your call.

Worked example: the `verified` (organization, app_user) and
`published` (project) `CustomBooleanTypeAdapter` columns were added
this way to give `select.custom-boolean-remap.test.ts` real-domain
column-vs-column comparisons (same adapter and deliberately
different adapter) instead of three throwaway `TFlagA` / `TFlagB` /
`TFlagC` stubs. The diff against the prior schema is the template
for future extensions.

### Mock-only is a smell — restructure before reaching for the guard

`if (ctx.realDbEnabled) return` is the escape hatch that says "this
test only ever runs through the mock". The full normative rule is
[`DESIGN.md` §1 #18](./DESIGN.md#1-principles); the operational
summary is: **a test that asserts SQL no real database accepts is
almost always exercising something that does not make semantic
sense**. The guard is not just "skip the real DB" — it's a flag that
the test design probably needs to change.

Two real cases that surfaced in this suite. Both were initially
"fixed" by adding a per-cell mock-only guard; both should have
forced a redesign:

- `.orderBy('id').customizeQuery({ afterOrderByItems: rawFragment`${tIssue.id} desc` })`
  — a "tiebreaker" by the same unique PK that is already the primary
  sort key. SQL Server rejected it (error 169, "column specified more
  than once in the order by list"). The actual fix was to make a
  non-unique column (`priority`) the primary key and use `id` as the
  real tiebreaker — works on every dialect, real-DB everywhere.
- A scalar aggregate sub-query (`selectOneColumn(count(...))` → one
  row) whose customize hook emitted `order by (<scalar sub-query>)`.
  Oracle rejected it (`ORA-00907`). Ordering one row by a scalar
  expression is meaningless. The actual fix was to move the embedded
  sub-query into a comment in the `afterSelectKeyword` slot — a
  natural position for a tag-style annotation next to an aggregate.
  That hook position IS mock-only by design (some drivers strip
  comments and would mis-count placeholders, the same reason
  `customize-select-hook-fragment-with-bound-param` is mock-only),
  but the SQL the snapshot now pins is meaningful and the guard
  documents a real constraint instead of papering over a broken
  design.

Recipe before adding the guard:

1. **Read the snapshot.** Would you put that SQL in production code?
   If not, the test is hiding a design problem.
2. **Try restructuring.** Change the column, hook position or query
   shape until the emitted SQL is meaningful AND universally
   accepted. Real-DB coverage is the goal.
3. **Document the constraint.** Only if (1) and (2) leave you with
   no path forward — and the test's purpose is genuinely SQL-emission
   (forwarder behaviour, comment-position assertion, etc.) — reach
   for the guard with a comment naming the *specific* constraint
   (which drivers, which engines, what the constraint is). A
   reviewer reading the guard should learn why this SQL shape is
   the one the test wants to assert.

Per-cell guards (`if (ctx.realDbEnabled) return` in just the
dialect that rejects) deserve the same scrutiny. Silencing the real
DB on one cell of the matrix doesn't fix the design — it just hides
it from one column. If the SQL is sensible everywhere except one
engine, the engine's rejection is real signal: prefer restructuring
the test to a shape every engine accepts over silencing the
mismatch.

### If a new test surfaces a bug in `src/`

**Division of labor.** The agent writing or porting tests detects
bugs and hands them off; a separate fixing agent diagnoses and
patches `src/`. Mixing both roles breaks the test agent's
breadth-first momentum and produces shallow analysis. This split is
not optional — it is how the project author wants the work organised.

**Test author's checklist** (this is all you do when you find a
suspect):

1. Two-minute triage — three buckets:
   - **Dialect-specific limitation already documented** → comment-out
     the test on the affected cell with `// Not applicable on <DB>:
     <reason>` and, if the constraint is new, add an entry to
     [`FUTURE_CONNECTORS.md`](./FUTURE_CONNECTORS.md).
   - **Known library limitation per the author** →
     [`LIMITATIONS.md`](./LIMITATIONS.md) already covers it; wrap with
     `// TODO[LIMITATION]: see LIMITATIONS.md — <one-line>` and move
     on.
   - **Anything else** → `// TODO[BUG]` (on the assertion if the test
     stays live, or as the comment-out reason if you wrap the whole
     test). Add ONE paragraph in [`BUGS.md`](./BUGS.md) — enough to
     reproduce, no deeper.
2. Leave the suite green (assert current wrong behaviour, or
   block-comment per the symmetry rule).
3. Keep going with the next test. **Do not pause to read `src/`.**

**Not the test author's job — delegated to the fixing agent:**

- Root-cause diagnosis (reading `src/queryBuilders/...`, `src/sqlBuilders/...`, …).
- Categorising the bug shape (the common shapes are listed in
  [`BUGS.md` § Common bug shapes](./BUGS.md#common-bug-shapes-for-the-fixing-agent)
  as a template for the fixing agent — not as a triage form to fill
  in here).
- Writing the fix in `src/`.
- Writing the matching negative-type test under
  `test/db/<db>/types.negative/` that locks the new (narrower) public
  contract.
- Closing the `BUGS.md` entry.
- Rewriting the `// TODO[BUG]` comment to its final form (point to
  the negative test, or convert to "Not applicable" with citation).
- Deciding whether the wrapped test gets uncommented after the fix.

**Worked example.** Commit `9b5ab1c` shows the full cycle: this suite
flagged `PostgreSqlConnection.onConflictDoUpdateSet` accepting the
bare upsert form that PostgreSQL rejects → entry in `BUGS.md` plus
`TODO[BUG]` in the 8 postgres cells. The fixing agent removed the
methods from `PostgreSqlConnection` typing, added 5 negative-type
tests in `test/db/postgres/types.negative/insert.test.ts`, closed the
`BUGS.md` entry, and converted the wrap reasons in this suite to
"Not applicable … see test/db/postgres/types.negative/insert.test.ts
for the compile-time negative". The detect side did none of that
work; the fix side did none of the breadth-first test porting.

## Adding a database

Mirror the existing `test/db/postgres/` folder. See
[`DESIGN.md` §8](./DESIGN.md#8-adding-a-new-database) for the
step-by-step.

While you are wiring the new database's `runners.ts`, check
[`test/lib/mockRunners/`](./lib/mockRunners/) — one
`MockQueryRunner` subclass per real `QueryRunner` the matrix
exercises, so captured params come out identical in mock and real
modes. The trigger example: the four SQLite real runners coerce
`boolean → 0/1` before `params.push(value)` because their native
drivers reject JS booleans; the generic `MockQueryRunner` doesn't,
which would split every `.set({ active: true })` snapshot across
modes. The matching `MockBunSqliteQueryRunner` (and siblings)
applies the same coercion → one snapshot per test, no
`if (ctx.realDbEnabled)` branch.

Wiring is one line per cell in `test/db/<db>/runners.ts`:

```ts
createTestContext({
    /* … */
    mockRunnerClass: MockBunSqliteQueryRunner,
    /* … */
})
```

The type `MockRunnerClass` and the `mockRunnerClass` option live in
[`test/lib/testContext.ts`](./lib/testContext.ts); omit the option
to fall back to the generic `MockQueryRunner` (the right default
for any connector whose real runner doesn't transform anything —
postgres, mysql, mariadb, mssql, oracle all sit on that path
today).

Add a sibling mock when the new database has a driver whose
`addParam` (or any other capture-visible method) massages values
before forwarding — timezone shifts, BigInt → string, Buffer → hex,
booleans → integers, etc. Conventions (one class per real runner
even when passthrough, override via `super`, what NOT to put here,
when to reach for `realDbEnabled` instead) live in
[`test/lib/mockRunners/README.md`](./lib/mockRunners/README.md).

## Why the duplication between cells?

Because symmetry is the whole point and it is treated as a hard rule.
The test file for `postgres/newest/pg/` should diff cleanly
against `postgres/oldest/pg/` and against the mysql equivalent,
leaving only the real behavioural differences. Hiding the duplication
behind a shared abstraction hides the divergences as well, and
divergences are what these tests are here to catch.

When a test does not apply to a cell, **do not delete it and do not
`test.skip(…)` it** — comment out the entire `test(...)` block as a
`/* … */` and put a one-line reason above it. The body of the
commented test is documentation and does not need to compile against
the target cell's connection. Full rule: [`DESIGN.md` §4](./DESIGN.md#4-symmetry-rules--critical-maintainability-property).

### When the canonical cell can't compile the body

A test is normally developed in the cell with the fastest iteration
loop — `sqlite/newest/bun_sqlite/` for the docs.* files (it's also
`canonicalForDocs: true`), the closest equivalent for any other test
family. Sometimes the canonical can't compile the test body because
the feature is only typed on other dialects. Today's examples in the
docs.* tree: `tTable.oldValues()` is only typed on
PostgreSqlConnection, MariaDBConnection and SqlServerConnection;
`deleteFrom(...).using(...)` is not exposed on SqliteConnection;
`SqliteConnection` has no `isolationLevel(...)` method.

Recipe when the canonical can't host the body:

1. **Write the test directly into the canonical as a comment-out
   block** with a one-line reason on the line above, exactly like a
   regular not-applicable test:

   ```ts
   // Not applicable on SQLite: tTable.oldValues() is only typed on
   // PostgreSqlConnection, MariaDBConnection and SqlServerConnection.
   /*
   test('docs:update/update-returning-old-values', async () => {
       // … verbatim body the SUPPORTING dialect would run …
   })
   */
   ```

2. **Mirror via `cp`** to every other cell.
3. **Uncomment in the cells where the feature IS available.** The
   `tests:audit` walks comment blocks too, so the test name still
   counts toward symmetry; runtime executes only where uncommented.
   A small helper script is the easiest way to flip the comment in
   the supporting cells without re-typing:

   ```python
   # /tmp/uncomment-test.py — replaces "// reason\n/*\ntest('NAME', …)\n})\n*/\n"
   # with the bare test block, keeping all snapshots and bodies as-is.
   ```

4. **Bake snapshots** for the uncommented cells and run the audit.

Pattern applies to any test file, not just docs.* — the recipe is the
same when, for example, a `select.*.test.ts` exercises a feature only
typed on certain dialects.

### Imports used only from commented-out blocks

`noUnusedLocals` rejects an import that has no live use. When the only
use is inside a `/* … */` block (the regular not-applicable case OR
the canonical-can't-host case above), the cell where the test is
commented fails to compile unless you add a sentinel reference:

```ts
import { tIssue, tProject } from '../../domain/connection.js'

// tProject is referenced by the commented-out `docs:delete/delete-using`
// test below; the cells where that test is uncommented use it for real.
void tProject

describe(ctx.label, () => {
    // …
})
```

The `void identifier` is a zero-cost expression statement that
satisfies the unused-locals rule without affecting runtime. Drop it
when the test gets uncommented in that cell, or leave it — it is
harmless either way.

## Prisma and sync runners

Prisma support in ts-sql-query is experimental. It will live in its own
sub-tree (sketched as `test/db/<database>/<version>/prisma/`) with
deliberately minimal coverage — enough to verify the integration works,
not to exhaustively re-test the SQL surface (which the per-driver
connectors already cover).

Synchronous query runners (and the `extras/sync` helper) live in their
own tree for the same reason: their runtime semantics differ enough
that mixing them into the main matrix would force every async-shaped
test to grow conditional paths. A light mirror set proves the sync path
is wired correctly.

Do not block PRs on Prisma or sync parity unless the PR is
specifically about those subsystems.
