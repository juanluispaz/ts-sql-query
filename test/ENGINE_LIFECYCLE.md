# `test/` — engine lifecycle: containers, WASM, schema/seed, per-worker DBs

Reference for the shared infrastructure that brings real databases up, keeps
them warm across runs, isolates them per-worker, and revalidates schema/seed
when they change. Covers both **docker-backed engines** (postgres, mysql,
mariadb, oracle, sqlserver) and **in-process WASM engines** (pglite,
sqlite-wasm-OO1). Native SQLite drivers (better-sqlite3, bun_sqlite,
node_sqlite, sqlite3) need no lifecycle — they're in-process and stateless
per-test by construction.

The corresponding code lives under [test/lib/containerLifecycle.ts](./lib/containerLifecycle.ts);
per-database wiring lives in `test/db/<db>/runners.ts`. See
[`PER_DATABASE_LAYOUT.md`](./PER_DATABASE_LAYOUT.md) for the per-DB convention.

For wall-time numbers see [`BENCHMARKS.md`](./BENCHMARKS.md). For the test
mutation safety contract that runs ON TOP of this infra see
[`TEST_LIB.md` § `testContext.ts` — mutation safety contract](./TEST_LIB.md#testcontextts--mutation-safety-contract).

- [Container reuse](#container-reuse)
- [Cross-invocation reuse](#cross-invocation-reuse)
- [Narrowing the docker scope](#narrowing-the-docker-scope)
- [Path scope vs docker scope](#path-scope-vs-docker-scope)
- [Schema / seed change revalidation](#schema--seed-change-revalidation)
- [Per-worker test databases](#per-worker-test-databases)
- [WASM lifecycle](#wasm-lifecycle)
- [Stopping the reused containers](#stopping-the-reused-containers)

## Container reuse

Each docker-backed runner (postgres, mariadb, mysql, oracle, sqlserver) starts
its testcontainer **lazily on the first `ctx.up()` and keeps it alive for the
entire test process**, then leaves cleanup to Ryuk on process exit. That alone
collapses a full `bun test test/db/mysql/` from ~3.5 min (one start/stop per
`.test.ts` file) to under 10 s.

The keep-alive lives in [`createContainerHandle()`](./lib/containerLifecycle.ts#L257)
and is wired by every `test/db/<db>/runners.ts` factory.

### Cross-invocation reuse

The next step is to share the container *across* `bun test` invocations via
testcontainers' standard `TESTCONTAINERS_REUSE_ENABLE` flag. The opt-in lives
in explicit `--docker-mode` flags:

`--docker-mode reuse` (the default for `tests`) sets
`TESTCONTAINERS_REUSE_ENABLE=true`. `--docker-mode no-reuse` clears it, giving
the hermetic behaviour CI wants:

```bash
# Local iterative loop (default — reuse).
bun run tests --docker
bun run tests postgres/newest/pg --docker

# Hermetic — fresh containers every run.
bun run tests --docker --docker-mode no-reuse
```

**Rule of thumb: locally, leave the default.** The hermetic mode is for the
few situations where you genuinely need a fresh container (debugging a
startup-side bug, confirming a fix in cold conditions). Leaving the containers
running between invocations is intentional and acceptable — the time saved on
every iteration is much larger than the cost of a few residual `docker ps`
entries.

On the mysql cell, the warm reuse path drops from ~6 s (cold, in-process
keep-alive only) to ~1.4 s (cross-process reuse). The pre-keep-alive behaviour
for comparison was ~228 s per run.

### What "reuse" actually does at process exit

- **Reuse on**: Ryuk leaves containers alive at process exit. They keep
  running on the docker host until you stop them. The next test invocation
  matches them by image+config hash (label `org.testcontainers.container-hash`)
  and attaches instead of starting fresh. Schema + seed are re-applied on
  every cell's `ctx.up()`, so stale data from a previous run is wiped.
- **Reuse off**: Ryuk kills containers as soon as the process exits. The next
  run pays the full cold start cost.

## Narrowing the docker scope

Container reuse cuts the *startup* tax. `--docker-scope newest` cuts the
*matrix* tax: when `--docker` is on, only cells under `<db>/newest/*` keep
their real-DB branch — older versions transparently fall back to the mock for
that run.

```bash
# Real backends only on `newest`; older versions go through the mock.
bun run tests --docker --docker-scope newest
```

Same shape as `--wasm` (a narrower scope than the full matrix), different
motivation:

- `--wasm` exists because real WASM is CPU-bound and dominates wall time when
  imported under parallel workers.
- `--docker-scope newest` exists because most regressions surface on any
  recent version of an engine. Hitting `oldest` is only worth the wall-time
  cost when you're investigating something version-specific —
  backward-compatibility shims, deprecated SQL, fall-back code paths, etc.

The CLI flag exports `TS_SQL_QUERY_DOCKER_SCOPE=newest` for the runner. The
gate sits in [`test/lib/backends.ts`](./lib/backends.ts):
[`isRealDbEnabled(db, 'docker', version)`](./lib/backends.ts#L105) returns
`false` when the scope is `newest` and the cell's version is not `newest`. The
version is derived from the cell's `spec.label` (the `<version> / <connector>`
prefix); no per-cell changes are needed when a new connector or version is
added.

Default is `all`. The flag is a no-op without `--docker`.

When mixing flags:

| Combination | What runs |
|---|---|
| `--docker` (default scope `all`) | every docker cell hits its real DB |
| `--docker --docker-scope newest` | only `<db>/newest/*` cells hit real DBs; older versions mock |
| `--docker-scope newest` (no `--docker`) | all docker cells fall back to mocks (scope is no-op) |
| `--docker --docker-scope newest --wasm` | newest docker cells real, WASM phase real, older docker cells mock |

## Path scope vs docker scope

`--docker-scope newest` flips the real/mock gate but keeps every test running.
`--scope newest` is one step further — it filters the **file set** the runner
walks, so older-version cells are not even enumerated:

| Flag | Older-version cells |
|---|---|
| `--docker-scope newest` | run against the mock |
| `--scope newest` | not run at all |

Practical use: coverage runs. Older-version coverage is almost always a
subset of the newest cell's coverage (same SQL builder, same expressions), so
feeding the runner an extra ~570 file invocations only pads the report.
`--scope newest` skips them — `bun run tests` drops from 14k tests / 8 s to
11k tests / 5 s on a typical box. Implies `--docker-scope=newest` automatically
(running real containers for versions you don't even visit is wasted setup);
pass `--docker-scope` explicitly to override.

Focused runs (`tests <coord>`) accept `--scope newest` too, and combine it
with the multi-coord / glob / brace-expansion support to address arbitrary
slices of the matrix:

- Single-segment coord (`tests postgres --scope newest`): the run expands to
  `<db>/newest/` + `<db>/types.negative/`.
- Glob coord (`tests 'postgres/*/pg' --scope newest`): the script expands the
  glob, then drops paths matching `*/oldest/*` from the expansion. So
  `postgres/*/pg` resolves to just `postgres/newest/pg`.
- Brace expansion (`tests 'postgres/*/{pg,postgres}' --scope newest`): works
  whether you quote the coord or not.
- Multi-coord (`tests 'postgres/*/pg' sqlite/newest --scope newest`): combine
  literals, globs, and brace-expanded sets in a single invocation.
- A coord pointing at `*/oldest/*` combined with `--scope newest` is rejected
  outright as an explicit contradiction.

`tests --connections wasm --scope newest` drops the `oldest` WASM entries from
the WASM path set too.

## Schema / seed change revalidation

The container reuse model could otherwise cause a footgun: edit `schema.sql`
or `seed.sql`, run the suite again, attach to the warm container with last
week's data. The infra protects against it.

Every docker runner hashes the **content** of `schema.sql` + `seed.sql` the
first time `acquireContainer` returns inside a process (so once per
`bun test` invocation, not once per test file). The hash lives in
[`hashSqlFiles()`](./lib/containerLifecycle.ts#L189) and the comparison
against the value stored in a small `tssqlquery_meta` table living in a
dedicated control database is per-engine logic in `test/db/<db>/runners.ts`
(see for instance [`validateOrResetForReuse` in postgres/runners.ts](./db/postgres/runners.ts#L127)).

Outcomes:

- **Hash matches** → the warm container is still in sync with the source
  files. Nothing to do; the per-file `applySchemaAndSeed` runs as usual.
- **Hash differs** → wipe every worker test database from scratch and
  recreate the control database with the new hash. The per-file
  `applySchemaAndSeed` then runs against the empty per-worker database and
  rebuilds everything.
- **Meta table missing** (fresh container, never validated) → same as
  "hash differs": create the control database and stamp the hash. No worker
  reset is needed since the container starts empty.

The reset is the idiomatic "throw away the database and start over" for each
engine (`DROP DATABASE … CREATE DATABASE …` for mysql/mariadb/sqlserver,
`DROP USER tsapp_w<N> CASCADE … CREATE USER …` for oracle,
`DROP DATABASE tssqlquery_w<N> WITH (FORCE) … CREATE DATABASE …` for
postgres) — no per-table enumeration, so removed/renamed/orphan objects from
a previous schema are simply gone.

Across parallel workers the validator holds an engine-native advisory lock
(`pg_advisory_lock`, `GET_LOCK`, `sp_getapplock`, `DBMS_LOCK`) so the reset
runs exactly once even when several worker processes attach simultaneously.
The cost is paid once per process when the schema actually changed; if it
didn't, the validator is a single `SELECT … LIMIT 1`.

The cross-process serialisation of the first acquire is in
[`withCrossProcessLock`](./lib/containerLifecycle.ts#L212) — a lockfile
under `os.tmpdir()` keyed by the docker image name. Without it, 12 bun
workers all calling `withReuse().start()` at the same instant race past
testcontainers' `fetchByLabel` (no container has the hash label visible
yet) and each create their own container.

You don't need to do anything to opt in — this runs automatically whenever
`TESTCONTAINERS_REUSE_ENABLE=true` (and harmlessly on cold containers too).

## Per-worker test databases

Every docker runner gives each worker process its own test database —
`tssqlquery_w1`, `tssqlquery_w2`, … (for Oracle: users `tsapp_w1`,
`tsapp_w2`, …). The worker id is read from `BUN_TEST_WORKER_ID` /
`VITEST_POOL_ID` / `JEST_WORKER_ID` by [`workerId()`](./lib/containerLifecycle.ts#L81);
when none is set (serial single-process invocation) everyone shares "worker 1"
and the database simply becomes `tssqlquery` / `tsapp`. The dedicated control
database `tssqlquery_meta` is disjoint from the worker databases so the reset
logic doesn't have to special-case "the database that owns the hash row".

Net effect: a worker's commit never leaks into another worker's view, so the
mutation safety contract (`withRollback` / `withCommit` / `withReseed` — see
[`TEST_LIB.md`](./TEST_LIB.md#testcontextts--mutation-safety-contract))
stays intra-worker and parallel test runs are safe by default.

The model is **parallel by default**; the opt-out is `--mode sequential` on
`tests` (the script sets `TSSQLQUERY_PARALLEL_DBS=false`, the runner adapter
then forces a serial pool and the per-worker DB infra collapses to a single
shared `tssqlquery` / `tsapp` — see
[`parallelDbsEnabled()`](./lib/containerLifecycle.ts#L102)). The CLI handles
the runner-specific flag — `--parallel` for `bun test` (serial out of the
box), `--no-file-parallelism` for vitest (parallel out of the box).

The dedicated WASM phase (full-matrix `--wasm` two-phase split) is always
sequential; WASM is CPU-bound and parallel buys nothing. A focused /
connection-typed WASM run (`tests --connections wasm --wasm`) defaults to
parallel because the cell set is tiny — pass `--mode sequential` if you want
the same shape as the old `tests:wasm`.

## WASM lifecycle

WASM connectors (pglite, sqlite-wasm-OO1) run in-process: the WebAssembly
heap loads inside the worker process and the engine answers queries from
there. The two costs that make them their own gating category:

1. **Per-worker bootstrap**. PGlite's `PGlite.create('memory://')` spins up
   a full WASM-hosted PostgreSQL on first call. Without amortisation the
   ~300 ms × 44 pglite cells dominated postgres-matrix wall time. Per-process
   memoisation (see [`getOrCreatePglite()` in postgres/runners.ts](./db/postgres/runners.ts#L386))
   drops that to a single startup per worker; per-file `up()` just re-applies
   schema + seed.
2. **CPU-bound under parallel workers**. Several workers bootstrapping WASM
   in parallel saturate the CPU; the docker pass overlapping them then
   doesn't get full parallel benefit. That's why the full-matrix `--wasm`
   flag triggers a **sequential second pass over WASM cells** after the
   parallel main pass finishes — the WASM cost lands serially at the end,
   not competing with the docker workers.

In focused mode (`tests <coord> --wasm`) the two-phase split doesn't fire
and `--wasm` is a single-pass override that sets `TS_SQL_QUERY_WASM=on`.

When `--wasm` is off, every WASM cell still runs — its SQL + params + type +
mock round-trip assertions all fire — but the WebAssembly module is never
imported. The cell falls back to the mock for its real-DB branch.

`process.on('beforeExit', ...)` closes the PGlite instance cleanly so
`bun test` doesn't exit with code 99 (pending-background-work).

## Stopping the reused containers

There is **no obligation** to stop the reused containers between runs — that
is the whole point. They consume some RAM in the background while you
iterate, and the next `bun run tests --docker` (or `tests <coord> --docker`)
invocation attaches to them in ~1 s instead of paying the full container
start-up. Agents in particular should not bother calling `tests:stop-containers`
as a clean-up step.

Stop them explicitly only when you actually want to start clean — to free
RAM at the end of a long session, recover from a wedged container, or rebuild
from scratch after editing a `test/db/<database>/domain/schema.sql` that
changes column types in ways the reused container hasn't yet picked up:

```bash
bun run tests:stop-containers
```

(`npm run tests:stop-containers` works the same — it's the same shell script
under the hood.)

The helper matches by image, so it only touches containers from this project —
it leaves unrelated testcontainers projects on your host alone.
