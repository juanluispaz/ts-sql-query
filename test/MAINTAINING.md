# `test/` — maintaining and extending the suite

Companion to [`README.md`](./README.md). Read this when you are adding a
test, adding a database, running the pre-merge typecheck / symmetry
audit, or touching the prisma / sync sub-trees.

- [Typechecking](#typechecking)
- [Auditing symmetry](#auditing-symmetry)
- [Adding a test](#adding-a-test)
  - [Test-context surface](#test-context-surface)
  - [If a new test surfaces a bug in `src/`](#if-a-new-test-surfaces-a-bug-in-src)
- [Adding a database](#adding-a-database)
- [Why the duplication between cells?](#why-the-duplication-between-cells)
  - [When the canonical cell can't compile the body](#when-the-canonical-cell-cant-compile-the-body)
  - [Imports used only from commented-out blocks](#imports-used-only-from-commented-out-blocks)
- [Prisma and sync runners](#prisma-and-sync-runners)

## Typechecking

```bash
bun run validate:tests:tsgo      # tsgo -p test/tsconfig.json --noEmit (preferred for dev)
bun run validate:tests           # tsc equivalent — authoritative check used by CI
```

`tsgo` is the Go-based TypeScript 7 compiler. It is roughly **~6× faster**
than `tsc` on this project, which makes it the right tool for the inner
edit-typecheck loop. Reach for the `tsc` variant before pushing — that
is the compiler CI runs and the one whose diagnostics are the ground
truth if `tsgo` and `tsc` ever disagree (today they don't, but `tsgo` is
still officially preview).

`tsc` / `tsgo` are runtime-independent — invoke with either `bun run`
or `npm run`, the entry is the same and runs the same compiler.

`validate:tests` is also where the negative type tests
(`test/db/<database>/types.negative/`) are actually checked. If a
library change unintentionally weakens an API restriction, an
`@ts-expect-error` becomes "unused" and `tsc` fails the build —
exactly the signal we want.

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
