# `test/` — docker containers, parallelism, timings

Companion to [`README.md`](./README.md). Read this when you are dealing with
docker-backed tests, container reuse, the data-mutation contract, per-worker
test databases, or comparing wall times across runners and scopes.

- [Container reuse](#container-reuse-speeding-up-docker-backed-runs)
- [Cross-invocation reuse](#cross-invocation-reuse)
- [What "reuse" actually does at process exit](#what-reuse-actually-does-at-process-exit)
- [Narrowing the docker scope (`--docker-scope newest`)](#narrowing-the-docker-scope---docker-scope-newest)
- [Path scope vs docker scope (`--scope newest`)](#path-scope-vs-docker-scope---scope-newest)
- [Data-mutation safety (cooperative contract)](#data-mutation-safety-cooperative-contract)
- [Schema / seed changes are revalidated automatically](#schema--seed-changes-are-revalidated-automatically)
- [Per-worker test databases (parallelism)](#per-worker-test-databases-parallelism)
- [Parallel timings](#parallel-timings)
- [Bun vs vitest](#bun-vs-vitest)
- [Stopping the reused containers](#stopping-the-reused-containers)

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

`--docker-mode reuse` (the default for `tests`) sets
`TESTCONTAINERS_REUSE_ENABLE=true`. `--docker-mode no-reuse` clears it,
giving the hermetic behaviour CI wants. CI itself just adds the flag
explicitly:

```bash
# Local iterative loop (default — reuse).
bun run tests --docker
bun run tests postgres/newest/pg --docker

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

### Narrowing the docker scope (`--docker-scope newest`)

Container reuse cuts the *startup* tax. `--docker-scope newest` cuts the
*matrix* tax: when `--docker` is on, only cells under `<db>/newest/*`
keep their real-DB branch — older versions transparently fall back to
the mock for that run.

```bash
# Real backends only on `newest`; older versions go through the mock.
bun run tests --docker --docker-scope newest
```

Same shape as `--wasm` (a narrower scope than the full matrix),
different motivation:

- `--wasm` exists because real WASM is CPU-bound and dominates wall
  time when imported under parallel workers.
- `--docker-scope newest` exists because most regressions surface on
  any recent version of an engine. Hitting `oldest` is only worth the
  wall-time cost when you're investigating something
  version-specific — backward-compatibility shims, deprecated SQL,
  fall-back code paths, etc.

The CLI flag exports `TS_SQL_QUERY_DOCKER_SCOPE=newest` for the
runner. The gate sits in [`test/lib/backends.ts`](./lib/backends.ts):
`isRealDbEnabled(db, 'docker', version)` returns `false` when the
scope is `newest` and the cell's version is not `newest`. The version
is derived from the cell's `spec.label` (the `<version> / <connector>`
prefix); no per-cell changes are needed when a new connector or
version is added.

Default is `all`, which preserves every existing invocation. The flag
is a no-op without `--docker`: the env var is not exported when docker
is off, so the legend in the Actions job summary reflects the real
behaviour rather than the flag's nominal value.

When mixing flags:

| Combination | What runs |
|---|---|
| `--docker` (default scope `all`) | every docker cell hits its real DB |
| `--docker --docker-scope newest` | only `<db>/newest/*` cells hit real DBs; older versions mock |
| `--docker-scope newest` (no `--docker`) | all docker cells fall back to mocks (scope is no-op) |
| `--docker --docker-scope newest --wasm` | newest docker cells real, WASM phase real, older docker cells mock |

Focused runs accept the same flag — handy when you want to debug
something on `<db>/oldest/<connector>` without the real container
spinning up (focus the cell with `tests <coord>`, drop the real-DB
cost by passing `--docker-scope newest`, and the assertions still
execute against the mock).

### Path scope vs docker scope (`--scope newest`)

`--docker-scope newest` flips the real/mock gate but keeps every test
running. `--scope newest` is one step further — it filters the **file
set** the runner walks, so older-version cells are not even
enumerated:

| Flag | Older-version cells |
|---|---|
| `--docker-scope newest` | run against the mock |
| `--scope newest` | not run at all |

Practical use: coverage runs. Older-version coverage is almost always a
subset of the newest cell's coverage (same SQL builder, same
expressions), so feeding the runner an extra ~570 file invocations only
pads the report. `--scope newest` skips them — `bun run tests` drops
from 14k tests / 8 s to 11k tests / 5 s on a typical box. Implies
`--docker-scope=newest` automatically (running real containers for
versions you don't even visit is wasted setup); pass `--docker-scope`
explicitly to override.

Focused runs (`tests <coord>`) accept `--scope newest` too, and
combine it with the multi-coord / glob / brace-expansion support to
address arbitrary slices of the matrix:

- Single-segment coord (`tests postgres --scope newest`): the run
  expands to `<db>/newest/` + `<db>/types.negative/`.
- Glob coord (`tests 'postgres/*/pg' --scope newest`): the script
  expands the glob, then drops paths matching `*/oldest/*` from the
  expansion. So `postgres/*/pg` resolves to just
  `postgres/newest/pg`.
- Brace expansion (`tests 'postgres/*/{pg,postgres}' --scope newest`):
  works whether you quote the coord or not — quoted, the script
  brace-expands internally via a vetted eval; unquoted, bash
  brace-expands at the shell level into two positional coords
  (`postgres/*/pg`, `postgres/*/postgres`). Same result either way.
- Multi-coord (`tests 'postgres/*/pg' sqlite/newest --scope newest`):
  combine literals, globs, and brace-expanded sets in a single
  invocation; the runner is invoked once on the union of all matches.
- Deeper coord (already specifying a version, e.g.
  `tests postgres/newest/pg/select.basic.test.ts --scope newest`):
  honoured verbatim — the user already narrowed the scope.
- A coord pointing at `*/oldest/*` combined with `--scope newest` is
  rejected outright as an explicit contradiction.

`tests --connections wasm --scope newest` drops the `oldest` WASM
entries from `WASM_PATHS` too.

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
on `tests` (the script sets `TSSQLQUERY_PARALLEL_DBS=false`,
the runner adapter then forces a serial pool and the per-worker DB infra
collapses to a single shared `tssqlquery` / `tsapp`). The CLI handles the
runner-specific flag — `--parallel` for `bun test` (serial out of the
box), `--no-file-parallelism` for vitest (parallel out of the box).
The dedicated WASM phase (full-matrix `--wasm` two-phase split) is
always sequential; WASM is CPU-bound and parallel buys nothing. A
focused / connection-typed WASM run (`tests --connections wasm
--wasm`) defaults to parallel because the cell set is tiny — pass
`--mode sequential` if you want the same shape as the old
`tests:wasm`.

`--wasm` controls the WASM second phase: off (default) leaves the
WASM modules unimported and the cells run against the mock; on adds a
sequential pass over the WASM cells with real pglite / sqlite-wasm-OO1
after the main pass succeeds.

## Parallel timings

Wall-time of the headline invocations under **bun**, reference machine
(12 logical cores), warm reused containers when docker is involved,
matrix at ~14k tests / ~2.5k files:

| Invocation | Wall | User+sys CPU | CPU% |
|---|---|---|---|
| **`bun run tests`** (mocked, no WASM) | **8.3 s** | ~95 s | 1142% |
| **`bun run tests --scope newest`** | **5.0 s** | ~55 s | 1094% |
| **`bun run tests --wasm`** (real pglite/sqlite-wasm) | **12.8 s** | ~103 s | 801% |
| **`bun run tests --wasm --scope newest`** | **7.7 s** | ~60 s | 785% |
| **`bun run tests --docker`** (warm containers) | **4:39** | ~1940 s | 694% |
| `bun run tests --docker` (cold start) | 4:20 | ~1845 s | 709% |
| **`bun run tests --docker --scope newest`** (warm) | **4:35** | ~1160 s | 420% |
| **`bun run tests --docker --wasm`** (warm) | **4:36** | ~1940 s | 701% |

A few things stand out:

- **The mocked loop is sub-10 s.** Even at ~14k tests, the parallel
  fan-out (12 worker processes) keeps the wall time inside a tight
  feedback window. `--scope newest` brings it down further (~5 s) by
  skipping `<db>/oldest/*` cells outright.
- **Real WASM costs ~5 extra seconds** on top of mocked. Cheap.
  Compared to vitest the gap here is dramatic — see the matrix below.
- **Real docker is a step change.** Even with reused containers and
  the schema/seed memoised once per process, the docker matrix takes
  ~4:30. The bottleneck is not our code (see "Why is docker so much
  slower?" below); it's the per-container DDL throughput when 12
  workers reseed their own per-worker databases concurrently.
- **`--scope newest` barely moves the docker wall time** under bun.
  The newest path is what already dominates wall time (the slowest
  container — usually sqlserver/oracle — pins the run); dropping
  oldest cells releases CPU but not wall time. The savings are real
  but small (~4 s out of 4:39).
- **`--docker --wasm` ≈ `--docker`.** The two-phase split tucks the
  real-WASM pass behind the docker matrix; bun's per-worker WASM
  bootstrap is cheap, so the WASM phase adds essentially nothing on
  top of the docker baseline. Vitest behaves very differently here —
  see the matrix below.

### Why is docker so much slower?

The expensive cooperation primitives (`withReseed`, `withCommit` —
re-apply schema + seed; see § Data-mutation safety above) only fire
for tests that need post-commit visibility (transaction tests,
sequence tests, error attachments). In `postgres/newest/pg` that's
**26 out of 281** mutator wrappers (~9 %); the rest are
`withRollback`, which is just `BEGIN / ROLLBACK` and costs nothing.

But each of those 26 reseeds runs the full schema (~50 statements)
inside the container. With 12 worker processes hitting their own
worker DB concurrently, the **container engine** (a single process per
container) becomes the bottleneck — every worker queues for the
container's CPU during DDL. Wall time of the bun run tracks the
slowest container's serialised DDL throughput, not the JS-side test
work.

That's also a reason **the runtime layer stops being the main cost
once `--docker` is on** (see the cross-runner matrix below): vitest
defaults to roughly half the workers, so it puts ~half the concurrent
DDL pressure on each container, but the raw cross-runtime comparison
under `--docker` is too contaminated by workload asymmetry and run-to-
run variance to land a confident "winner". The mocked and WASM gaps,
on the other hand, are real runtime-level wins for bun.

### Practical workflow

- **Daily iteration (mocked)**: `bun run tests` (~8 s) or
  `bun run tests --scope newest` (~5 s) if you only care about
  newest-version behaviour. `tests <coord>` for a single cell.
- **Pre-merge confidence**: `bun run tests --docker` (~4:30) — every
  test runs against its real engine. Add `--wasm` (~no extra cost
  under bun) for the full matrix.
- **WASM-touching changes**: `bun run tests --connections wasm --wasm`
  to verify only the pglite / sqlite-wasm-OO1 cells against the real
  module (parallel by default; add `--mode sequential` for the old
  serial recipe).

## Bun vs vitest

Same invocations under both runtimes. Reference machine. Raw single-
run wall times below; the cross-runtime comparison is **only robust
for the mocked and real-WASM regimes** — the docker rows are noisy
enough and asymmetric enough (see caveats) that the "winner" column
is not a real claim.

| Invocation | bun wall | vitest wall | Reading |
|---|---|---|---|
| `tests` (mocked) | **8.3 s** | 60.4 s | **bun ~7×** — robust |
| `tests --scope newest` | **5.0 s** | 40.8 s | **bun ~8×** — robust |
| `tests --wasm` | **12.8 s** | 5:02 | **bun ~24×** — robust |
| `tests --wasm --scope newest` | **7.7 s** | 2:51 | **bun ~22×** — robust |
| `tests --docker` (warm) | 4:39 | 2:20 / 3:01 | **inconclusive** (see below) |
| `tests --docker` (cold) | 4:20 | 3:11 | **inconclusive** |
| `tests --docker --scope newest` (warm) | 4:35 | 4:24 | **inconclusive** |
| `tests --docker --wasm` (warm) | 4:36 | 6:17 | **inconclusive** |
| `tests --docker --wasm --scope newest` | 4:54 | 4:50 | **inconclusive** |

**Why the docker rows are inconclusive:**

1. **bun and vitest do not run identical test sets.** Some connectors
   are bun-only (`BunSqlPostgresQueryRunner`, `BunSqlMySqlQueryRunner`,
   `BunSqlSqliteQueryRunner`, `BunSqliteQueryRunner`); some are
   node-only (e.g. `NodeSqliteQueryRunner`). Concretely vitest visits
   ~10.5k tests vs bun's ~14k. So vitest is doing ~75% of bun's
   workload by raw test count, and the docker-heavy tests skew higher
   on bun's side. A naive workload-normalisation
   (`vitest_wall × 14 / 10.5`) brings the vitest `--docker` row from
   2:20 to ~3:07 — close to the bun number.
2. **Multi-minute runs have ~30 % variance** invocation-to-invocation
   on this matrix. The vitest `--docker` row was measured at **2:20**
   and **3:01** in two back-to-back runs on the same machine state.
   Anything inside that envelope is noise, not signal.
3. **The matrix is not fully populated yet** — more compatibility
   versions and connectors are pending. Today's numbers are a
   point-in-time snapshot; the relative shape will shift as cells are
   added.

Combine all three and the apparent "vitest wins docker by ~2×"
collapses to "the two runtimes are roughly comparable under
`--docker`, within noise and workload asymmetry". The mocked and WASM
gaps, by contrast, are far too large to be explained by either
variance (~30 %) or test-count asymmetry (~33 %) — they're real
runtime-level wins for bun.

**The robust takeaways:**

- **Mocked daily loop** — bun is **~7-10× faster** than vitest. Vitest
  pays per-worker node spin-up + vite's TS transpile of the dependency
  tree per worker per run; bun has none of that. The canonical "bun
  is fast" regime.
- **Real WASM (no docker)** — bun is **~20-30× faster** than vitest.
  Vitest's per-worker re-import of the pglite / sqlite-wasm
  WebAssembly modules dominates wall time; bun imports them once and
  amortises.
- **Real docker** — both runtimes land in the same minutes-long
  ballpark. The container engine itself is the bottleneck (a single
  process per container serialising every worker's DDL during
  reseeds); the runtime layer is no longer the dominant cost, so the
  raw bun-vs-vitest distinction matters much less.

**Default still stands: bun for daily development** — faster mocked
loop, dramatically faster WASM phase, comparable under docker. Reach
for vitest when you need its richer report / coverage stack (see
[COVERAGE.md](./COVERAGE.md)); the runtime cost trade-off is no
longer a reason to switch on its own.

## Stopping the reused containers

There is **no obligation** to stop the reused containers between runs
— that is the whole point. They consume some RAM in the background
while you iterate, and the next `bun run tests --docker` (or
`tests <coord> --docker`) invocation attaches to them in ~1 s instead of
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
