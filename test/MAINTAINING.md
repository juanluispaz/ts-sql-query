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

The agent does **not** touch `src/` while writing or porting tests —
the test suite's job is to characterise current behaviour, not to fix
it. When a test surfaces what looks like a bug:

1. Mark the offending assertion with a `// TODO[BUG]` comment that
   names the symptom in one line.
2. Leave the test in a passing state — usually by asserting the
   current (wrong) behaviour, sometimes by commenting the failing
   assertion out per the symmetry rule.
3. Log the issue in [`BUGS.md`](./BUGS.md) with enough context to
   reproduce. The maintainer fixing `src/` will read that file,
   remove the `TODO[BUG]` and rewrite the assertion to the correct
   value as part of the fix PR.

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
