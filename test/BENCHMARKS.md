# `test/` — wall-time benchmarks

Reference numbers for the `test/` matrix under each invocation regime, on a
12-logical-core reference machine (macOS, warm reused containers when docker is
involved). Use when picking a workflow and when comparing bun vs vitest. Update
after the matrix grows materially.

Companion to [`CLI.md`](./CLI.md) (how to run things) and
[`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md) (why docker is the bottleneck once
it's on).

- [The one lever that matters: vitest `isolate: false`](#the-one-lever-that-matters-vitest-isolate-false)
- [Cross-runtime timings](#cross-runtime-timings)
- [Why bun can't win the real-DB matrix](#why-bun-cant-win-the-real-db-matrix)
- [Practical workflow](#practical-workflow)

> **History note.** An earlier revision of this file concluded "bun for daily
> development — faster mocked loop, dramatically faster WASM, comparable under
> docker". That is **no longer true.** Two things changed: the matrix roughly
> tripled (~14k tests / 2.5k files → ~44k tests / 4.1k files), and, decisively,
> `test.isolate` was set to `false` in [`vitest.config.ts`](../vitest.config.ts).
> With that one flag vitest went from being 7-24× *slower* than bun to being the
> faster runner on every regime it can run — and ~20× faster on the real docker
> matrix. **node + vitest is now the recommended runner for the `test/` matrix.**

## The one lever that matters: vitest `isolate: false`

Almost the entire bun-vs-vitest story reduces to **per-file isolation**.

By default a test runner tears the environment down and re-imports every module
between files. At ~4.1k files that re-import is the dominant cost: the module
graph — including [`lib/containerLifecycle.ts`](./lib/containerLifecycle.ts),
whose `memoizeSharedRunner` caches the real-DB connection pool + schema bootstrap
in a module-level closure — is rebuilt per file, so the memoisation is defeated
and the **pool + schema bootstrap is rebuilt once per file** instead of once per
worker.

`isolate: false` (set in `vitest.config.ts`) makes each vitest worker **reuse its
module graph across every file it runs**, so the memoisation holds: one pool per
worker, not one per file. Bun runs each file in a fresh global object with no
opt-out (see the next section), so it pays the per-file rebuild on every file.

Controlled A/B on the same machine and same vitest version (toggling only
`--no-isolate`), so it isolates the flag from everything else:

| Selection | vitest `isolate:true` (old default) | vitest `isolate:false` | Speed-up |
|---|---|---|---|
| `postgres/newest` (967 files, mocked) | 41.7 s | **3.4 s** | **~12×** |
| full `--run-versions newest` (3180 files, mocked) | 79 s | **9.5 s** | **~8×** |
| `postgres/newest/pg` (docker, real pool) | 243 pool builds | **12 pool builds** | one per file → one per worker |

The `import` phase is where it shows up: on the full newest matrix it drops from
a cumulative ~493 s to ~64 s. The mocked full matrix goes 79 s → 9.5 s; the real
docker matrix goes from tens of minutes to ~2.5 min. (A concurrent vitest version
bump landed around the same time and may contribute a little, but the A/B above —
same version, flag-only — shows `isolate: false` is the dominant lever.)

## Cross-runtime timings

Same invocations under both runtimes, vitest with `isolate: false`:

| Invocation | bun wall | vitest wall | Reading |
|---|---|---|---|
| `tests` (mocked, 44169 tests / 4144 files) | 19.2 s | **12.6 s** | **vitest ~1.5×** |
| `tests --run-versions newest` (mocked) | 11.6 s | **9.0 s** | **vitest ~1.3×** |
| `tests --wasm` (real pglite/sqlite-wasm + mock main) | 37.1 s | 36.4 s | ~tie |
| `tests --docker --wasm` (warm containers) | **56:23** | **~2:30** | **vitest ~22×** |
| one docker cell (`postgres/newest/pg`) | 25 s | 4.75 s | **vitest ~5×** |

Reading the rows:

- **Mocked loop — vitest is now faster.** At ~44k tests / 4.1k files, bun's
  per-file fresh-global teardown (drain microtasks, close sockets, reset the
  global object — every file) costs more than vitest's shared-graph reuse. The
  old "bun ~7× faster mocked" was measured at a third of today's file count and
  *before* `isolate: false`; both facts have since reversed the result.
- **Real WASM — now a tie.** The old table had bun ~24× faster here because
  vitest re-imported the pglite / sqlite-wasm WebAssembly modules per file. With
  `isolate: false` vitest imports them once per worker, so `--wasm` is 37.1 s
  (bun) vs 36.4 s (vitest) — bun's real-WASM phase is still marginally faster
  (18.7 s vs 23.6 s), but vitest's faster mock main phase cancels it out.
- **Real docker — vitest wins by ~20×.** This is the big one. Bun rebuilds the
  connection pool + schema bootstrap on every one of the ~4.1k files (measured:
  243 rebuilds for the 243-file `postgres/newest/pg` cell); on macOS, where every
  container connection crosses the Docker VM's userspace network proxy, that is
  ~56 min and ~14000 s of *system* time. Vitest amortises the pool per worker
  (`isolate: false`), so it only pays the genuine DDL/reseed floor: ~2.5 min.
  `--docker` alone is marginally less than `--docker --wasm` (the WASM phase adds
  ~20 s tucked in front).

Docker absolute numbers are machine-dependent — macOS Docker networking amplifies
bun's per-file reconnect cost; on Linux the gap is smaller — but the *direction*
holds everywhere: vitest amortises the per-worker DB setup, bun rebuilds per file.

## Why bun can't win the real-DB matrix

Bun's `--parallel` (which `scripts/tests.sh` passes for the parallel mode)
**implies `--isolate`**, and there is no parallel-without-isolate mode. Per Bun's
own v1.3.13 release notes, between files under `--isolate` Bun *"drains
microtasks, closes all sockets, cancels timers, kills subprocesses, and creates a
clean global object."* So:

- **No JS state survives across files** — not a module-level cache, not
  `globalThis`, not a `--preload`/global-`beforeAll` (which historically ran
  per-file too, oven-sh/bun#23066). The `memoizeSharedRunner` cache is wiped per
  file.
- **Live sockets are force-closed between files** — so even a hypothetical shared
  pool object couldn't keep its connections alive. Keeping a real-DB pool warm
  across files is impossible in bun parallel mode *by design* (it's their
  flaky-test-prevention model).
- **The only thing bun shares across files is the VM-level transpilation cache**
  (parse-once) — which is why the *mocked* loop stays fast, but it does nothing
  for runtime resources.

The one bun mode that preserves state is **serial** (`--mode sequential`, no
`--parallel` → no `--isolate` → shared global): the pool memoisation then holds,
but you lose all parallelism and per-worker databases, so it's still slower than
vitest parallel + `isolate: false`.

The sanctioned bun pattern for real DBs is per-worker resources keyed on
`BUN_TEST_WORKER_ID` (oven-sh/bun#23179) — which this repo already does
(`memoizeSharedRunner` + `workerName`); bun simply can't keep those resources
alive from one file to the next.

## Practical workflow

**Default runner: node + vitest** (`npm run tests …`) for the `test/` matrix —
faster mocked loop, ~tie on WASM, and ~20× faster on the real docker matrix.

- **Daily iteration (mocked)**: `npm run tests` (~13 s) or
  `npm run tests -- --run-versions newest` (~9 s) if you only care about
  newest-version behaviour. `tests <coord>` for a single cell.
- **Validate one cell against real-DB cheaply**: `npm run tests -- <cell>` — if
  `<cell>` is a SQLite native connector (better-sqlite3, node_sqlite, sqlite3)
  you already get real-DB at mock-loop speed. See
  [`DESIGN.md` § Real-DB validation](./DESIGN.md#real-db-validation) for the cost
  tiers.
- **Pre-merge confidence**: `npm run tests -- --docker` (~2:30) — every test runs
  against its real engine. Add `--wasm` for the full matrix (~no extra cost).
- **WASM-touching changes**: `npm run tests -- --run-connectors wasm --wasm`.

**When to use bun:**

- **The bun-native connector cells** (`bun_sql_postgres`, `bun_sql_mysql`,
  `bun_sql_sqlite`, `bun_sqlite`) import `bun:sql` / `bun:sqlite` and can *only*
  run under bun — run those under bun (`bun run tests <coord> --docker`). They're
  a small slice of the matrix, so the per-file rebuild cost there is bounded.
- A quick mock check where you don't want to spin up node is still fine under bun
  (~19 s full matrix, ~12 s newest); vitest is only marginally faster there.

CI keeps both runtimes green (both jobs run `test:no-docker`), and the publish
pipeline stays on npm/Node — see [`CLAUDE.md`](../CLAUDE.md).
