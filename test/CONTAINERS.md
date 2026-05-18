# `test/` — docker containers, parallelism, timings

Companion to [`README.md`](./README.md). Read this when you are dealing with
docker-backed tests, container reuse, the data-mutation contract, per-worker
test databases, or comparing wall times across runners and scopes.

- [Container reuse](#container-reuse-speeding-up-docker-backed-runs)
- [Cross-invocation reuse](#cross-invocation-reuse)
- [What "reuse" actually does at process exit](#what-reuse-actually-does-at-process-exit)
- [Data-mutation safety (cooperative contract)](#data-mutation-safety-cooperative-contract)
- [Schema / seed changes are revalidated automatically](#schema--seed-changes-are-revalidated-automatically)
- [Per-worker test databases (parallelism)](#per-worker-test-databases-parallelism)
- [Parallel timings](#parallel-timings)
- [Bun vs vitest (daily loop)](#bun-vs-vitest-daily-loop)
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

## Parallel timings

Per-engine and per-script timings under **bun** on a warm container
after the one-process-one-db memoisation, with `--parallel` defaulting
to CPU count (12 on the reference machine):

| Engine / scenario | Serial reuse | Parallel reuse | Notes |
|---|---|---|---|
| mariadb (24 files) | ~0.9 s | ~0.9 s | already fast either way |
| mysql (24 files) | ~1.3 s | ~1.0 s | small parallel win |
| oracle (24 files) | ~4.1 s | ~2.2 s | parallel ~1.8× |
| sqlserver (24 files) | ~11 s | ~7 s | parallel ~1.5× |
| postgres docker-backed (132 files) | ~3.6 s | ~6 s | parallel slightly worse (workers too cheap to amortise startup) |
| postgres including pglite (178 files) | ~19 s | ~30 s | parallel much worse — pglite WASM contention |
| **`tests --docker --wasm` (full)** | **~20 s** | **~21 s** | **parallel ~= serial.** Phase 1 runs the matrix WASM-mocked in parallel; phase 2 runs WASM cells sequentially in ~1.5 s. |
| **`tests --docker` (WASM mocked)** | **~20 s** | **~17 s** | **parallel ~1.2× — the recommended daily path** |
| **`tests` (no docker, no WASM)** | **~3 s** | **~3 s** | **default; mock-only, blazing fast. See "Bun vs vitest" below for the cross-runner comparison.** |
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
  CI splits naturally: `tests --docker --docker-mode no-reuse` and
  `tests:wasm` as two jobs if you prefer.

If you are iterating on a single light engine (mariadb / mysql /
postgres without pglite), `bun run tests:focus <coord> --docker
--mode sequential` is the fastest path. For broader scopes, plain
`bun run tests --docker` (WASM mocked) is the better default.

## Bun vs vitest (daily loop)

Same matrix (`tests`, no docker, no WASM, ~1281 tests across all
mocked cells) under both runners, on the reference machine:

| Runtime | Wall time | User CPU | System CPU | Speedup |
|---|---|---|---|---|
| `bun run tests` | **~3.2 s** | ~24 s | ~2.7 s | 1.0× (baseline) |
| `npm run tests` (vitest) | **~21.2 s** | ~145 s | ~44 s | ~7× slower |

Both saturate CPU around the same level (~850-890 % busy), so the gap
is **not** a parallelism difference. The breakdown:

- **User CPU**: vitest spends ~6× more wall-time inside JS. The cost is
  the per-worker startup tax — node has to spin up, vitest has to
  import its config + framework, and vite has to transpile the TS
  dependency tree once per worker. Bun runs in-process with native TS,
  so all three of those costs are zero.
- **System CPU**: vitest spends ~16× more time in syscalls than bun.
  That's the IPC channel between the vitest main process and each
  worker — every test result is serialised and shipped back over the
  pipe. Bun has no inter-process coordination because there's no
  inter-process anything.

For a 1.2 s test surface, vitest is paying ~20 s of overhead the user
never sees translate into work. Bun pays ~2 s. That's the headline
reason bun is the default runner for daily development. **Reach for
vitest only when you need its richer report / coverage stack** (see
[COVERAGE.md](./COVERAGE.md)) — the runtime cost is real and visible.

## Stopping the reused containers

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
