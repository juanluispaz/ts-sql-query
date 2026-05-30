# `test/` — wall-time benchmarks

Reference numbers for the `test/` matrix under each invocation regime, on a
12-logical-core reference machine. Use when picking a workflow and when comparing
bun vs vitest. Update after the matrix grows materially.

Companion to [`CLI.md`](./CLI.md) (how to run things) and
[`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md) (why docker is the bottleneck once
it's on).

- [Parallel timings under bun](#parallel-timings-under-bun)
- [Why is docker so much slower?](#why-is-docker-so-much-slower)
- [Bun vs vitest](#bun-vs-vitest)
- [Practical workflow](#practical-workflow)

## Parallel timings under bun

Wall time of the headline invocations under **bun**, warm reused containers when
docker is involved, matrix at ~14k tests / ~2.5k files:

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

- **The mocked loop is sub-10 s.** Even at ~14k tests, the parallel fan-out
  (12 worker processes) keeps wall time inside a tight feedback window.
  `--scope newest` brings it down further (~5 s) by skipping `<db>/oldest/*`
  cells outright.
- **Real WASM costs ~5 extra seconds** on top of mocked. Cheap. Compared to
  vitest the gap here is dramatic — see the matrix below.
- **Real docker is a step change.** Even with reused containers and the
  schema/seed memoised once per process, the docker matrix takes ~4:30. The
  bottleneck is the per-container DDL throughput when 12 workers reseed their
  own per-worker databases concurrently — see "Why is docker so much slower?".
- **`--scope newest` barely moves the docker wall time** under bun. The newest
  path is what already dominates wall time (the slowest container — usually
  sqlserver/oracle — pins the run); dropping oldest cells releases CPU but not
  wall time. The savings are real but small (~4 s out of 4:39).
- **`--docker --wasm` ≈ `--docker`.** The two-phase split tucks the real-WASM
  pass behind the docker matrix; bun's per-worker WASM bootstrap is cheap, so
  the WASM phase adds essentially nothing on top of the docker baseline. Vitest
  behaves very differently here — see the matrix below.

## Why is docker so much slower?

The expensive cooperation primitives (`withReseed`, `withCommit` — re-apply
schema + seed; see
[`TEST_LIB.md` § `testContext.ts` — mutation safety contract](./TEST_LIB.md#testcontextts--mutation-safety-contract))
only fire for tests that need post-commit visibility (transaction tests,
sequence tests, error attachments). In `postgres/newest/pg` that's
**26 out of 281** mutator wrappers (~9 %); the rest are `withRollback`, which
is just `BEGIN / ROLLBACK` and costs nothing.

But each of those 26 reseeds runs the full schema (~50 statements) inside the
container. With 12 worker processes hitting their own worker DB concurrently,
the **container engine** (a single process per container) becomes the
bottleneck — every worker queues for the container's CPU during DDL. Wall time
of the bun run tracks the slowest container's serialised DDL throughput, not
the JS-side test work.

That's also a reason **the runtime layer stops being the main cost once
`--docker` is on** (see the cross-runner matrix below): vitest defaults to
roughly half the workers, so it puts ~half the concurrent DDL pressure on
each container, but the raw cross-runtime comparison under `--docker` is too
contaminated by workload asymmetry and run-to-run variance to land a confident
"winner". The mocked and WASM gaps, on the other hand, are real runtime-level
wins for bun.

## Bun vs vitest

Same invocations under both runtimes. Raw single-run wall times below; the
cross-runtime comparison is **only robust for the mocked and real-WASM
regimes** — the docker rows are noisy enough and asymmetric enough (see caveats)
that the "winner" column is not a real claim.

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

1. **bun and vitest do not run identical test sets.** Some connectors are
   bun-only (`BunSqlPostgresQueryRunner`, `BunSqlMySqlQueryRunner`,
   `BunSqlSqliteQueryRunner`, `BunSqliteQueryRunner`); some are node-only
   (e.g. `NodeSqliteQueryRunner`). Concretely vitest visits ~10.5k tests vs
   bun's ~14k. So vitest is doing ~75% of bun's workload by raw test count,
   and the docker-heavy tests skew higher on bun's side. A naive
   workload-normalisation (`vitest_wall × 14 / 10.5`) brings the vitest
   `--docker` row from 2:20 to ~3:07 — close to the bun number.
2. **Multi-minute runs have ~30 % variance** invocation-to-invocation on this
   matrix. The vitest `--docker` row was measured at **2:20** and **3:01** in
   two back-to-back runs on the same machine state. Anything inside that
   envelope is noise, not signal.
3. **The matrix is not fully populated yet** — more compatibility versions and
   connectors are pending. Today's numbers are a point-in-time snapshot; the
   relative shape will shift as cells are added.

Combine all three and the apparent "vitest wins docker by ~2×" collapses to
"the two runtimes are roughly comparable under `--docker`, within noise and
workload asymmetry". The mocked and WASM gaps, by contrast, are far too large
to be explained by either variance (~30 %) or test-count asymmetry (~33 %) —
they're real runtime-level wins for bun.

**The robust takeaways:**

- **Mocked daily loop** — bun is **~7-10× faster** than vitest. Vitest pays
  per-worker node spin-up + vite's TS transpile of the dependency tree per
  worker per run; bun has none of that. The canonical "bun is fast" regime.
- **Real WASM (no docker)** — bun is **~20-30× faster** than vitest. Vitest's
  per-worker re-import of the pglite / sqlite-wasm WebAssembly modules
  dominates wall time; bun imports them once and amortises.
- **Real docker** — both runtimes land in the same minutes-long ballpark. The
  container engine itself is the bottleneck (a single process per container
  serialising every worker's DDL during reseeds); the runtime layer is no
  longer the dominant cost, so the raw bun-vs-vitest distinction matters
  much less.

**Default still stands: bun for daily development** — faster mocked loop,
dramatically faster WASM phase, comparable under docker. Reach for vitest when
you need its richer report / coverage stack (see [`CLI.md` § Coverage](./CLI.md#coverage));
the runtime cost trade-off is no longer a reason to switch on its own.

## Practical workflow

- **Daily iteration (mocked)**: `bun run tests` (~8 s) or
  `bun run tests --scope newest` (~5 s) if you only care about newest-version
  behaviour. `tests <coord>` for a single cell.
- **Validate one cell against real-DB cheaply**: `bun run tests <cell>` —
  if `<cell>` is a SQLite native connector (better-sqlite3, bun_sqlite,
  node_sqlite, sqlite3) you already get real-DB at mock-loop speed. See
  [`DESIGN.md` § Real-DB validation](./DESIGN.md#real-db-validation)
  for which connectors fall in each cost tier.
- **Pre-merge confidence**: `bun run tests --docker` (~4:30) — every test runs
  against its real engine. Add `--wasm` (~no extra cost under bun) for the
  full matrix.
- **WASM-touching changes**: `bun run tests --connections wasm --wasm` to
  verify only the pglite / sqlite-wasm-OO1 cells against the real module
  (parallel by default; add `--mode sequential` for the old serial recipe).
