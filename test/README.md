# `test/` — ts-sql-query test suite

The new ts-sql-query test suite. Designed to **eventually replace
[`src/examples/`](../src/examples)** without losing any of its existing
coverage. Both coexist until parity is reached; this folder is the future.

The full design is in [`DESIGN.md`](./DESIGN.md). Read it once if you are
going to add tests, change the layout, or wire a new database. The points
below are the minimum you need to run and extend the suite.

## What the suite guarantees, per test

Each test goes through a single connection (`ctx.conn`) backed by either
the real driver-backed runner or a `MockQueryRunner`, and asserts:

1. The SQL string the builder emitted (`ctx.lastSql`) — inline snapshot.
2. The bound params (`ctx.lastParams`) — inline snapshot.
3. The exact TypeScript type of the result (no widening, no narrowing).
4. The returned value — `expect(result).toEqual(expected)` covers both
   modes because the mock is pre-primed (`ctx.mockNext(expected)`) with
   the same data the real seed contains.

Everything tested by the suite (except the compile-time negatives) runs
through the **same** code path in both modes, so anything that passes the
suite has potentially gone through the real database.

## Layout in one screen

```
test/db/<database>/<compatibilityVersion>/<connector>/
                                              ├── setup.ts
                                              ├── select.basic.test.ts
                                              ├── insert.returning.test.ts
                                              └── docs.<page>.test.ts
test/db/<database>/                       ← runners.ts and types.negative/ folder
test/db/<database>/types.negative/        ← compile-time negatives, multi-file
```

- `<database>` = one of `docs/configuration/supported-databases/*.md`
  (`mariadb`, `mysql`, `oracle`, `postgres`, `sqlite`, `sqlserver`).
  The current pilot uses `pilot-postgres` so the `postgres` name stays
  free for the real set when it lands.
- `<compatibilityVersion>` = `newest` (default,
  `Number.POSITIVE_INFINITY`), the literal numeric value of any
  documented breakpoint (e.g. `13_000_001`, `10_005_000`), or `oldest`
  (the `< lowest-breakpoint` zone).
- `<connector>` = one of `docs/configuration/query-runners/recommended/*.md`
  for that database. Today, for postgres: `pg`, `postgres`, `pglite`
  (`bun_sql_postgres` pending).

Not every (version × connector) cell is valid — `pglite` bundles
PostgreSQL 17 so it only appears under `oldest/`. Folders for invalid
cells simply do not exist.

## Running

Two orthogonal flags control any run:

| Flag | What it does | Default |
|---|---|---|
| `TS_SQL_QUERY_DBS` | Comma list of database folder names under `test/db/` (or `all` / `none`). Narrows the SCOPE of the run. | `all` |
| `TS_SQL_QUERY_DOCKER` | `on` / `off`. Gates whether docker-backed connectors fire their real-DB branch. | `off` |

Crucially, **every test runs in both modes**. With Docker off, a
docker-backed connector's real-DB branch is skipped but its SQL,
params, type and mock round-trip assertions still execute — and
in-process connectors (pglite, sqlite, …) keep running their real DB
regardless. No code duplication.

The project follows the same `bun:`-prefix convention as
`bun:all-examples` and `bun:no-docker-examples`:

```bash
# Default development loop: Docker off (mocked real-DB for docker
# backends; in-process backends still hit their real engine)
bun run bun:no-docker-tests      # bun:test (preferred)
npm run no-docker-tests          # vitest / Node

# Full matrix, Docker on
bun run bun:all-tests            # bun:test (preferred)
npm run all-tests                # vitest / Node

# Hard off-switch: nothing is in scope, no real-DB branch fires; SQL +
# params + type + mock-round-trip assertions still run
TS_SQL_QUERY_DBS=none bun run bun:no-docker-tests
```

### Focused runs

When you are iterating on a single change and do not want to wait for
the full matrix, run a single coordinate via `focus-tests`. The argument
is the `database[/version[/connector]]` path under `test/db/`:

```bash
# Single (database × version × connector) cell
bun run bun:focus-tests pilot-postgres/newest/pg   # bun:test (preferred)
npm run focus-tests pilot-postgres/newest/pg       # vitest / Node

# Whole version (every connector)
bun run bun:focus-tests pilot-postgres/oldest

# Whole database
bun run bun:focus-tests pilot-postgres

# Pass extra args through (snapshot update, etc.)
bun run bun:focus-tests pilot-postgres/newest/pg --update-snapshots
npm run focus-tests pilot-postgres/newest/pg -- -u
```

Direct invocation works too if you want to scope to a single file or
prefer not to go through the script:

```bash
bun test test/db/pilot-postgres/newest/pg/select.basic.test.ts
npx vitest run test/db/pilot-postgres/newest/pg/select.basic.test.ts
```

Pass the flags explicitly if you need to override the script defaults:

```bash
TS_SQL_QUERY_DOCKER=on bun run bun:focus-tests pilot-postgres/newest/pg  # focus pilot, real DB on
TS_SQL_QUERY_DBS=mariadb bun run bun:no-docker-tests                     # focus mariadb only
```

The focused run is the primary tool for an agent iterating on a single
cell. After fixing emitted SQL or params, run `--update-snapshots` on
the focused coordinate to refresh just that cell's snapshots, then run
the full matrix once at the end to catch cross-cell regressions.

## Updating snapshots

SQL and params are kept in inline snapshots so they can be refreshed in
bulk whenever the SqlBuilder reshapes its output. Both runners support
auto-update:

```bash
bun test --update-snapshots          # bun:test (preferred)
npx vitest run -u                    # vitest / Node
```

Either runner produces compatible inline snapshot format, so updating
with one leaves the suite green under the other.

For a focused refresh, narrow the path:

```bash
bun test test/db/pilot-postgres/newest/ --update-snapshots
```

Review the diff before committing — a snapshot change is real signal
that the emitted SQL has changed.

## Typechecking

```bash
bun run bun:validate:tests       # tsc -p test/tsconfig.json --noEmit (preferred)
npm run validate:tests           # same, via npm

bun run bun:validate:tests:tsgo  # tsgo equivalent (preview)
npm run validate:tests:tsgo      # same, via npm
```

`tsc` / `tsgo` are runtime-independent, so the `bun:` and non-`bun:`
variants run the same compiler — the duplication is intentional so the
convention "every test script has a `bun:`-prefixed twin" stays
unbroken.

## Auditing symmetry

```bash
bun run bun:audit-tests      # bun
npm run audit-tests          # tsx
```

Walks `test/db/` and verifies the symmetry rule from
[`DESIGN.md` §4](./DESIGN.md#4-symmetry-rules--critical-maintainability-property):
every cell of a database must have the same `.test.ts` files with the
same test names (executed *or* commented-out) in the same order. Exit
code is `0` on a symmetric matrix, `1` on any divergence. Useful as a
pre-merge check.

The audit lives at [`test/lib/auditTestSymmetry.ts`](./lib/auditTestSymmetry.ts)
so it is type-checked by `npm run validate:tests`.

`validate:tests` is where the negative type tests
(`test/db/<database>/types.negative/`) are actually checked. If a
library change unintentionally weakens an API restriction, an
`@ts-expect-error` becomes "unused" and `tsc` fails the build —
exactly the signal we want.

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
   (`bun run bun:focus-tests <db>/<version>/<connector> --update-snapshots`
   is the focused variant).
4. Mutating tests wrap the body in
   `ctx.withRollback(async () => { … })` so the seed survives.

## Adding a database

Mirror the existing `test/db/pilot-postgres/` folder. See
[`DESIGN.md` §8](./DESIGN.md#8-adding-a-new-database) for the
step-by-step.

## Why the duplication between cells?

Because symmetry is the whole point and it is treated as a hard rule.
The test file for `pilot-postgres/newest/pg/` should diff cleanly
against `pilot-postgres/oldest/pg/` and against the mysql equivalent,
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
