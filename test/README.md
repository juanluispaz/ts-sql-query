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

There are exactly **three CLIs**:

| CLI | What it runs |
|---|---|
| `tests` | The full matrix under `test/`. Defaults: parallel, no docker, no real WASM. Add flags to widen scope. `--help` for all options. |
| `tests:focus <coord>` | One coordinate — `<db>/<version>/<connector>/<file>` at any depth. Same flags as `tests`. |
| `tests:wasm` | Just the in-process WASM cells (pglite, sqlite-wasm-OO1), serially, with real WASM. No flags. |
| `tests:audit` | Symmetry audit — verifies every cell of a database declares the same test files and test names. Pre-merge check. |
| `tests:stop-containers` | Stops the warm docker containers `--docker --docker-mode reuse` left running. |

Each CLI has `--help`. Each is a single shell script that detects
runtime via `npm_config_user_agent` — `bun run X` dispatches to
`bun test`, `npm run X` to `vitest run`. Same entry under either
runtime.

Two orthogonal flags scope what the runner sees:

| Flag | What it does | Default |
|---|---|---|
| `--docker` | Docker-backed connectors hit their real DB. Without it they fall through to the mock. | off (mock) |
| `--wasm` | After the main pass, runs a second sequential pass over the WASM cells against real pglite / sqlite-wasm-OO1. Without it, **the WASM modules are not even imported**. | off (mock) |

The split keeps the parallel main pass fast — WASM is CPU-bound and
tanks parallel throughput. When you do need real WASM, the two-phase
split runs it once at the end, sequentially, in ~1.5 s.

There's also a third env-level knob:

| Flag | What it does | Default |
|---|---|---|
| `TS_SQL_QUERY_DBS` | Comma list of database folder names under `test/db/` (or `all` / `none`). Narrows the SCOPE of the run. | `all` |

Crucially, **every test runs in both modes**. With `--docker` off, a
docker-backed connector's real-DB branch is skipped but its SQL,
params, type and mock round-trip assertions still execute. With
`--wasm` off, the same applies to pglite / sqlite-wasm-OO1. The
native in-process connectors (better-sqlite3, bun:sqlite, node:sqlite,
sqlite3) ignore both flags and keep running their real DB. No code
duplication.

```bash
# Daily loop: no docker, no real WASM. ~1.5 s for 1281 tests.
bun run tests

# + real docker backends.
bun run tests --docker

# Full matrix (docker + real WASM second phase). ~21 s.
bun run tests --docker --wasm

# Hermetic — fresh containers every run. CI baseline.
bun run tests --docker --docker-mode no-reuse

# Sequential for debugging. Single shared DB, no parallel noise.
bun run tests --mode sequential

# Narrow to one database.
TS_SQL_QUERY_DBS=mariadb bun run tests --docker

# Hard off-switch: nothing in scope, no real-DB branch anywhere.
TS_SQL_QUERY_DBS=none bun run tests
```

### Focused runs

When you are iterating on a single change and do not want to wait for
the full matrix, run a single coordinate via `tests:focus`. The first
argument is a path under `test/db/`; it can resolve to any of the four
levels — database, version, connector, or a single test file.

!!! tip "Container reuse is the default"

    Both `tests` and `tests:focus` default to `--docker-mode reuse`,
    which keeps docker containers alive between invocations
    (`TESTCONTAINERS_REUSE_ENABLE=true`) and collapses the feedback
    loop from ~6 s per focused run to ~1.4 s on the mysql cell. Same
    effect on every docker-backed cell.

    The containers stay alive on the host between runs. That is
    intentional and acceptable: the time saved on every iteration is
    worth the residual `docker ps`. There is no need to call
    `tests:stop-containers` between runs — only when you actually
    want to start clean (see [§ Stopping the reused containers](#stopping-the-reused-containers)).
    Override with `--docker-mode no-reuse` when you need a hermetic
    container.

Examples use `bun run` (preferred); swap in `npm run` for the vitest
path — the script entry is the same, the underlying runner switches.
When forwarding extra args under `npm run`, prefix them with `--`
(npm strips its own arg parser without it).

```bash
# Default: parallel, no docker, no real WASM, reuse (if --docker is added).
bun run tests:focus postgres/newest/pg

# + real docker. Container is reused across runs by default.
bun run tests:focus postgres/newest/pg --docker

# Whole version (every connector)
bun run tests:focus postgres/oldest --docker

# Whole database
bun run tests:focus postgres --docker

# Single test file
bun run tests:focus postgres/newest/pg/select.basic.test.ts

# Pass extra args through to the runner (snapshot update, etc.).
bun run tests:focus postgres/newest/pg --docker -- --update-snapshots
npm  run tests:focus postgres/newest/pg --docker -- -- -u    # vitest

# Real WASM on a wasm cell — single pass (no two-phase split here).
bun run tests:focus postgres/oldest/pglite --wasm --mode sequential
```

#### Narrowing inside a coordinate

Both runners accept a test-name regex (`-t` / `--test-name-pattern` on
`bun:test`, `-t` / `--testNamePattern` on vitest) which composes with
the path filter. Pass it after `--`:

```bash
# Run only the test(s) whose name matches the regex in this cell
bun run tests:focus postgres/newest/pg --docker -- -t inner-join

# File + test-name regex
bun run tests:focus postgres/newest/pg/select.basic.test.ts --docker -- -t inner-join

# File + test-name regex + snapshot refresh — the canonical
# "update one test's snapshot" recipe
bun run tests:focus postgres/newest/pg/select.basic.test.ts --docker -- -t inner-join --update-snapshots

# Same recipe under vitest (use `-u`, prefix extras with `-- --`):
npm run tests:focus postgres/newest/pg/select.basic.test.ts --docker -- -- -t inner-join -u
```

`--update-snapshots` (or `-u`) only refreshes the snapshots of the
tests the runner actually executed, so combining it with `-t <regex>`
is a safe way to fix one test's inline snapshot without churning
every other snapshot in the file or in the cell.

The focused run is the primary tool for an agent iterating on a
single cell. Standard recipe: `tests:focus <coord> --docker` (or
narrower with `<coord>/<file>.test.ts` + `-t <regex>`), optionally
with `--update-snapshots` to refresh just what changed, followed by
`test --docker --wasm` at the end to catch cross-cell regressions.

## Updating snapshots

SQL and params are kept in inline snapshots so they can be refreshed
in bulk whenever the SqlBuilder reshapes its output. Pass the runner's
update flag after `--`:

```bash
# Whole version
bun run tests:focus postgres/newest --docker -- --update-snapshots

# One file
bun run tests:focus postgres/newest/pg/select.basic.test.ts --docker -- --update-snapshots

# One test inside one file
bun run tests:focus postgres/newest/pg/select.basic.test.ts --docker -- -t inner-join --update-snapshots
```

Either runner produces compatible inline snapshot format, so updating
under one leaves the suite green under the other.

Direct invocation also works if you do not want to go through the
script (`bun test test/db/postgres/newest/ --update-snapshots`,
`npx vitest run test/db/postgres/newest/ -u`).

Review the diff before committing — a snapshot change is real signal
that the emitted SQL has changed.

## Container reuse (speeding up docker-backed runs)

Each docker-backed runner (postgres, mariadb, mysql, oracle, sqlserver)
starts its testcontainer **lazily on the first `ctx.up()` and keeps it
alive for the entire test process**, then leaves cleanup to Ryuk on
process exit. That alone collapses a full `bun test test/db/mysql/`
from ~3.5 min (one start/stop per `.test.ts` file) to under 10 s.

### Cross-invocation reuse

The next step is to share the container *across* `bun test` invocations
via testcontainers' standard `TESTCONTAINERS_REUSE_ENABLE` flag. The
opt-in lives in explicit `*-reuse` siblings of every docker-backed
script:

`--docker-mode reuse` (the default for `tests` and `tests:focus`) sets
`TESTCONTAINERS_REUSE_ENABLE=true`. `--docker-mode no-reuse` clears it,
giving the hermetic behaviour CI wants. CI itself just adds the flag
explicitly:

```bash
# Local iterative loop (default — reuse).
bun run tests --docker
bun run tests:focus postgres/newest/pg --docker

# Hermetic — fresh containers every run.
bun run tests --docker --docker-mode no-reuse
```

**Rule of thumb: locally, leave the default.** The hermetic mode is for
the few situations where you genuinely need a fresh container
(debugging a startup-side bug, confirming a fix in cold conditions).
Leaving the containers running between invocations is intentional and
acceptable — the time saved on every iteration is much larger than the
cost of a few residual `docker ps` entries.

On the mysql cell, the warm reuse path drops from ~6 s (cold,
in-process keep-alive only) to ~1.4 s (cross-process reuse). The
pre-keep-alive behaviour for comparison was ~228 s per run.

### What "reuse" actually does at process exit

- **Reuse on**: Ryuk leaves containers alive at process exit. They keep
  running on the docker host until you stop them. The next test
  invocation matches them by image+config hash (label
  `org.testcontainers.container-hash`) and attaches instead of starting
  fresh. Schema + seed are re-applied on every cell's `ctx.up()`, so
  stale data from a previous run is wiped.
- **Reuse off**: Ryuk kills containers as soon as the process exits.
  The next run pays the full cold start cost.

### Data-mutation safety (cooperative contract)

Container reuse does not weaken per-file isolation, but it does turn
any leak from "vanishes at process exit" into "visible across runs".
The infra offers two cooperation primitives on `ctx` so the contract
stays out of individual tests:

| Primitive | Use it when … | What the infra does |
|---|---|---|
| `await ctx.withRollback(async () => { … })` | the body mutates state the next test must not see (the common case) | wraps the body in `connection.transaction(...)` and forces a `ROLLBACK` at the end — even on failure — so the seed is intact |
| `await ctx.withCommit(async () => { … })` | the body needs the mutation to commit (DDL on engines without transactional DDL, post-commit visibility, sequence counters that must really advance) | wraps the body in a real transaction that **commits**, then calls `ctx.reseed()` in a `finally` to re-apply the schema + seed |
| `await ctx.withReseed(async () => { … })` | the body itself manages a transaction (`connection.transaction(...)`) — wrapping it in a second tx would nest and most engines reject that | runs the body as-is (no outer tx), then calls `ctx.reseed()` in a `finally` so any commit the body issued is undone for the next test |

**Rule:** any test that mutates anything must go through one of these.
Read-only tests use `ctx.conn` directly without a wrapper. Test bodies
stay free of cleanup logic — the wrapper owns it.

```ts
test('reading is fine outside a wrapper', async () => {
    const rows = await ctx.conn.selectFrom(tSomeTable).select({ /* … */ }).executeSelectMany()
    expect(rows).toEqual(/* … */)
})

test('mutating uses withRollback (default)', async () => {
    await ctx.withRollback(async () => {
        await ctx.conn.update(tSomeTable).set({ /* … */ }).where(/* … */).executeUpdate()
        // Rolled back after the body — seed survives for the next test.
    })
})

test('DDL on engines without transactional DDL needs withCommit', async () => {
    await ctx.withCommit(async () => {
        await ctx.conn.queryRunner.executeDatabaseSchemaModification(
            'CREATE TABLE leftover (id int)',
        )
        // … assertions about server-side state …
        await ctx.conn.queryRunner.executeDatabaseSchemaModification(
            'DROP TABLE leftover',
        )
    })
    // ctx.reseed() has already run — the seeded tables are back at
    // baseline. The body dropped its own `leftover` table because the
    // schema reset only knows about the declared seed.
})
```

`withCommit` only resets what the seed declares. If a test creates
schema objects that fall outside that declaration (extra tables,
sequences, functions, …), the **body of the `withCommit` callback**
should drop them before returning. Keep that local cleanup to a single
block at the bottom of the callback so it is impossible to miss when
reading the test.

**When in doubt** → fall back to a fresh container by passing
`--docker-mode no-reuse` once, or by stopping the warm containers
(`bun run tests:stop-containers`). A run against a fresh container is
ground truth; if a test passes there and fails under reuse, that is
the signal some test in the suite is leaking state through a path the
contract above does not cover.

The current suite stays inside `withRollback` — every test exercises
the fluent API against the seeded tables. The contract above is what
you need when adding a test that goes beyond that.

### Schema / seed changes are revalidated automatically

The container reuse model could otherwise cause a real footgun: edit
`schema.sql` or `seed.sql`, run the suite again, attach to the warm
container with last week's data. The infra protects against it.

Every docker runner hashes the **content** of `schema.sql` + `seed.sql`
the first time `acquireContainer` returns inside a process (so once per
`bun test` invocation, not once per test file), compares the hash with
the value stored in a small `tssqlquery_meta` table living in a
dedicated control database (`tssqlquery_meta`, kept separate from the
per-worker test databases — see § Per-worker test databases below),
and:

- **Hash matches** → the warm container is still in sync with the
  source files. Nothing to do; the per-file `applySchemaAndSeed` runs
  as usual.
- **Hash differs** → wipe every worker test database from scratch and
  recreate the control database with the new hash. The per-file
  `applySchemaAndSeed` then runs against the empty per-worker database
  and rebuilds everything.
- **Meta table missing** (fresh container, never validated) → same as
  "hash differs": create the control database and stamp the hash. No
  worker reset is needed since the container starts empty.

The reset is the idiomatic "throw away the database and start over"
for each engine (`DROP DATABASE … CREATE DATABASE …` for
mysql/mariadb/sqlserver, `DROP USER tsapp_w<N> CASCADE … CREATE USER …`
for oracle, `DROP DATABASE tssqlquery_w<N> WITH (FORCE) … CREATE
DATABASE …` for postgres) — no per-table enumeration, so
removed/renamed/orphan objects from a previous schema are simply gone.
Across parallel workers the validator holds an engine-native advisory
lock (`pg_advisory_lock`, `GET_LOCK`, `sp_getapplock`, `DBMS_LOCK`) so
the reset runs exactly once even when several worker processes attach
simultaneously. The cost is paid once per process when the schema
actually changed; if it didn't, the validator is a single
`SELECT … LIMIT 1`.

You don't need to do anything to opt in — this runs automatically
whenever `TESTCONTAINERS_REUSE_ENABLE=true` (and harmlessly on cold
containers too).

### Per-worker test databases (parallelism)

Every docker runner gives each worker process its own test database —
`tssqlquery_w1`, `tssqlquery_w2`, … (for Oracle: users `tsapp_w1`,
`tsapp_w2`, …). The worker id is read from `BUN_TEST_WORKER_ID` /
`VITEST_POOL_ID` / `JEST_WORKER_ID`; when none is set (serial
single-process invocation) everyone shares "worker 1" and the
database simply becomes `tssqlquery` / `tsapp`. The dedicated control
database `tssqlquery_meta` is disjoint from the worker databases so
the reset logic doesn't have to special-case "the database that owns
the hash row".

Net effect: a worker's commit never leaks into another worker's view,
so the cooperation contract above (`withRollback` / `withCommit` /
`withReseed`) stays intra-worker and parallel test runs are safe by
default.

The model is **parallel by default**; the opt-out is `--mode sequential`
on `tests` / `tests:focus` (the script sets `TSSQLQUERY_PARALLEL_DBS=false`,
the runner adapter then forces a serial pool and the per-worker DB infra
collapses to a single shared `tssqlquery` / `tsapp`). The CLI handles the
runner-specific flag — `--parallel` for `bun test` (serial out of the
box), `--no-file-parallelism` for vitest (parallel out of the box).
`tests:wasm` is always sequential; WASM is CPU-bound and parallel buys
nothing.

`--wasm` controls the WASM second phase: off (default) leaves the
WASM modules unimported and the cells run against the mock; on adds a
sequential pass over the WASM cells with real pglite / sqlite-wasm-OO1
after the main pass succeeds.

#### Parallel timings

Per-engine and per-script timings on a warm container after the
one-process-one-db memoisation, with `--parallel` defaulting to CPU
count (12 on the reference machine):

| Engine / scenario | Serial reuse | Parallel reuse | Notes |
|---|---|---|---|
| mariadb (24 files) | ~0.9 s | ~0.9 s | already fast either way |
| mysql (24 files) | ~1.3 s | ~1.0 s | small parallel win |
| oracle (24 files) | ~4.1 s | ~2.2 s | parallel ~1.8× |
| sqlserver (24 files) | ~11 s | ~7 s | parallel ~1.5× |
| postgres docker-backed (132 files) | ~3.6 s | ~6 s | parallel slightly worse (workers too cheap to amortise startup) |
| postgres including pglite (178 files) | ~19 s | ~30 s | parallel much worse — pglite WASM contention |
| **`test --docker --wasm` (full)** | **~20 s** | **~21 s** | **parallel ~= serial.** Phase 1 runs the matrix WASM-mocked in parallel; phase 2 runs WASM cells sequentially in ~1.5 s. |
| **`test --docker` (WASM mocked)** | **~20 s** | **~17 s** | **parallel ~1.2× — the recommended daily path** |
| **`tests` (no docker, no WASM)** | **~1.5 s** | **~1.5 s** | **default; mock-only, blazing fast** |
| `tests:wasm` (66 WASM files only) | ~1.5 s | — | always serial; parallel adds CPU contention |

Reading the table:

- The heavy docker engines (sqlserver, oracle) earn the parallel
  speedup on their own. Per-test cost is high enough that splitting
  across worker processes pays back the worker startup overhead.
- The fast docker engines (mariadb, mysql, the docker-backed postgres
  connectors) are too small to benefit on their own — the worker
  startup cost of `bun test --parallel` (forking N processes,
  re-importing the dependency tree) exceeds the savings on a few
  seconds of test work.
- **The full matrix is the headline number.** Without the two-phase
  WASM split, parallel would be *worse* than serial because pglite's
  per-worker WebAssembly bootstrap serialises 12 workers behind CPU
  contention. The split runs WASM as a single sequential pass at the
  end, leaving the parallel main pass unencumbered.

The practical workflow:

- **Daily iteration**: `bun run tests --docker` covers every test in
  the matrix in ~17 s. WASM connectors run their assertions against
  the mock; the real WASM path is verified separately.
- **Targeted WASM check**: `bun run tests:wasm` runs the 66 WASM files
  in ~1.5 s. Use after touching anything that affects pglite /
  sqlite-wasm-OO1 specifically.
- **Pre-merge / CI**: `bun run tests --docker --wasm` covers
  everything in ~21 s (parallel main pass + sequential WASM pass).
  CI splits naturally: `test --docker --docker-mode no-reuse` and
  `tests:wasm` as two jobs if you prefer.

If you are iterating on a single light engine (mariadb / mysql /
postgres without pglite), `bun run tests:focus <coord> --docker
--mode sequential` is the fastest path. For broader scopes, plain
`bun run tests --docker` (WASM mocked) is the better default.

### Stopping the reused containers

There is **no obligation** to stop the reused containers between runs
— that is the whole point. They consume some RAM in the background
while you iterate, and the next `bun run tests --docker` (or
`tests:focus --docker`) invocation attaches to them in ~1 s instead of
paying the full container start-up. Agents in particular should not
bother calling
`tests:stop-containers` as a clean-up step; the manual cleanup is
cheap, the per-iteration savings are not.

Stop them explicitly only when you actually want to start clean — to
free RAM at the end of a long session, recover from a wedged
container, or rebuild from scratch after editing a
`test/db/<database>/domain/schema.sql` that changes column types in
ways the reused container hasn't yet picked up:

```bash
bun run tests:stop-containers
```

(`npm run tests:stop-containers` works the same — it's the same shell
script under the hood.)

The helper matches by image, so it only touches containers from this
project — it leaves unrelated testcontainers projects on your host
alone.

## Typechecking

```bash
bun run validate:tests           # tsc -p test/tsconfig.json --noEmit (preferred)
bun run validate:tests:tsgo      # tsgo equivalent (preview)
```

`tsc` / `tsgo` are runtime-independent — invoke with either `bun run`
or `npm run`, the entry is the same and runs the same compiler.

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
   (`bun run tests:focus <db>/<version>/<connector> --docker -- --update-snapshots`
   is the focused variant).
4. Mutating tests wrap the body in
   `ctx.withRollback(async () => { … })` so the seed survives.

## Adding a database

Mirror the existing `test/db/postgres/` folder. See
[`DESIGN.md` §8](./DESIGN.md#8-adding-a-new-database) for the
step-by-step.

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
