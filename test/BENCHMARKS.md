# `test/` — wall-time benchmarks

Reference numbers for the `test/` matrix (now **~258k tests / ~17k files**) under
each invocation regime, on a 12-logical-core reference machine (macOS, warm reused
containers when docker is involved), measured one run at a time. Use when picking
a workflow. The bun and vitest columns are **not** an identical-workload
comparison — each runtime runs its own native connectors real and mocks the
other's (see the ‡ caveat under [Cross-runtime timings](#cross-runtime-timings)).
Update after the matrix grows materially.

Companion to [`CLI.md`](./CLI.md) (how to run things) and
[`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md) (why docker is the bottleneck once
it's on).

- [The one lever that matters: vitest `isolate: false`](#the-one-lever-that-matters-vitest-isolate-false)
- [Cross-runtime timings](#cross-runtime-timings)
- [Why bun can't win the real-DB matrix](#why-bun-cant-win-the-real-db-matrix)
- [Sharding: the no-docker CI split](#sharding-the-no-docker-ci-split)
- [Practical workflow](#practical-workflow)

> **History note.** An earlier revision concluded "bun for daily development —
> faster mocked loop, dramatically faster WASM, comparable under docker". Two
> things changed since: the matrix grew ~7× (~14k tests / 2.5k files → ~258k
> tests / 17k files) and `test.isolate` was set to `false` in
> [`vitest.config.ts`](../vitest.config.ts). `isolate: false` is **decisive on the
> real docker matrix** — it amortises the DB pool per worker instead of rebuilding
> it per file, making vitest far faster there — which is why **node + vitest is the
> runner the matrix (and CI) run under.** On the *mocked* and *WASM* loops the two
> runtimes are now roughly tied at this scale (and not an identical-workload
> comparison — see the ‡ caveat under [Cross-runtime timings](#cross-runtime-timings));
> vitest's edge is specifically the real-DB matrix.

## The one lever that matters: vitest `isolate: false`

Almost the entire bun-vs-vitest story reduces to **per-file isolation**.

By default a test runner tears the environment down and re-imports every module
between files. At ~17k files that re-import is the dominant cost: the module
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

*(This A/B is the original controlled experiment, measured when the matrix was
~4.1k files; it's now ~17k, but the flag's effect is structural — pool/import
amortised per worker vs rebuilt per file — and holds at any size. Re-running the
`isolate:true` column at the current size is impractical: it's ~1.4 files/s.)*

The `import` phase is where it shows up: on that newest matrix it dropped from
a cumulative ~493 s to ~64 s. The mocked full matrix went 79 s → 9.5 s; the real
docker matrix from tens of minutes to ~2.5 min. (A concurrent vitest version
bump landed around the same time and may contribute a little, but the A/B above —
same version, flag-only — shows `isolate: false` is the dominant lever.)

## Cross-runtime timings

Same commands under both runtimes, vitest with `isolate: false`, re-measured on
the current ~17k-file matrix (12-core macOS, sequential — never two runs at once):

| Invocation | bun wall | vitest wall | Reading |
|---|---|---|---|
| `tests` (mocked, 258 345 tests / 16 972 files) | ~68 s | ~74 s† | not identical work‡ |
| `tests --run-versions newest` (mocked) | ~16 s | ~19 s | not identical work‡ |
| `tests --wasm` (real pglite/sqlite-wasm + mock main) | ~93 s | ~139 s | not identical work‡ |
| `tests --docker` (warm containers) | impractical § | ~7:07 | — |
| `tests --docker --wasm` (warm containers) | impractical § | ~9:00 | **vitest only viable** |
| one docker cell (`postgres/newest/pg`, 255 files) | ~26 s | ~5.3 s | **vitest ~5×** |

**† vitest's mocked run is variable (74–92 s across samples).** At ~17k files each
worker carries a large accumulated module graph — the same accumulation that
peaks ~15.9 GB and OOMs the 16 GB CI runner on Node 26 (see
[`CLI.md` § Sharding](./CLI.md#sharding)) — so its GC load swings run-to-run.

**‡ The `bun` and `vitest` columns are NOT the same workload.** For the embedded
SQLite cells each runtime runs *its own* native connector real and mocks the
other's: under vitest `better-sqlite3` / `node_sqlite` / `sqlite3` go real (and
`bun_sqlite` mocks); under bun `bun_sqlite` goes real (and the node-only drivers
mock). The docker connectors split the same way (`bun_sql_*` are bun-only,
`pg` / `mysql2` / `mariadb` / `oracledb` / `mssql` are node-only). So each column
is that runtime running its own connector mix — read them as "how long each
runtime takes", **not** "which runs the same tests faster".

**§ bun's full real-DB matrix is not timed — it's impractical.** It rebuilds the
DB pool per file (see the row below), so at this matrix size it runs for *hours*
(the old table's 56 min was at ~4.1k files / ~2.8× fewer docker cells). The vitest
numbers are warm, measured on the current matrix (12-core host; Docker VM 6 CPU /
12 GiB RAM). `--docker --wasm` = `--docker` + the sequential real-WASM phase
(~112 s here — CPU-bound, contends with the live engines for cores).

- **Real docker — vitest's decisive win.** Bun rebuilds the connection pool +
  schema bootstrap on every file (measured: 255 rebuilds for the 255-file
  `postgres/newest/pg` cell); on macOS, where every container connection crosses
  the Docker VM's userspace network proxy, that dominates. Vitest amortises the
  pool per worker (`isolate: false`), so it only pays the genuine DDL/reseed
  floor. This — not the mocked loop, where the runtimes are now ~tied — is why the
  matrix and CI run under vitest.

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

## Sharding: the no-docker CI split

The mocked matrix + real WASM run as one process peaks ~15.9 GB and OOMs the 16 GB
CI runner on Node 26 at the final aggregation. `--shard` splits it into four
mutually-exclusive groups (`Σ = 16 972 files / 258 345 tests`, no overlap), each a
separate runner invocation so memory frees between them — peak = biggest shard,
not the sum. CI runs one step per shard (node + bun). Partition + rationale:
[`CLI.md` § Sharding](./CLI.md#sharding).

| Shard | Files / tests | vitest wall † | peak RSS ‡ |
|---|---|---|---|
| 1 · wasm (real, **sequential**) | 3 034 / 46 545 | ~60 s | 4.8 GiB |
| 2 · sqlite native A | 5 060 / 76 840 | ~22 s | 8.8 GiB |
| 3 · sqlite native B | 3 795 / 57 615 | ~16 s | 6.3 GiB |
| 4 · rest (docker mocked + docs) | 5 083 / 77 345 | ~21 s | 8.4 GiB |
| **all four in sequence** | 16 972 / 258 345 | ~120 s | biggest shard |

† 12-core macOS, unconstrained. ‡ peak resident memory under the **CI limit**
(`--cpus=4 --memory=16g`, Node 26, Linux) — the number that matters here, ~7 GB
under the ~15.9 GB single-process peak. Shard 1 is sequential (the WASM module
bootstrap is per-worker; running it parallel is catastrophic) and gets
`--max-old-space-size=8192` on node.

## Practical workflow

> **Every number in this file assumes the machine is otherwise idle, and that is
> a requirement, not a caveat.** Never run two heavy jobs at once (whole matrix,
> any `tsgo`, `tests:audit`, `tests:index*`, the example suites): the whole-matrix
> vitest run peaks ~15.9 GB and the per-connector tsgo split ~7 GB, so together
> they exceed a 16 GB box and the OOM-killer takes one out (`EXIT=137`, usually
> with no summary printed). The survivor is worse than useless — CPU starvation
> pushes tests past the 60 s per-test timeout, and a contention timeout looks
> exactly like a real regression. Discard and re-run alone; never interpret.
> **The engines count against the same budget.** With `--docker`, the containers
> hold ~7.2 GB at rest (SQL Server ~3.1, Oracle ~2.6, MySQL ~0.8, MariaDB ~0.36,
> PostgreSQL ~0.32) inside a Docker VM provisioned ~11.7 GB of host RAM — and
> `--docker-mode reuse` (the default) keeps them up BETWEEN runs, so they compete
> with a later `tsgo` too. `npm run tests:stop-containers` releases them.
>
> Full rule: [`CLI.md` § One heavy job at a time](./CLI.md#one-heavy-job-at-a-time).

**Default runner: node + vitest** (`npm run tests …`) for the `test/` matrix —
decisive on the real docker matrix (DB pool amortised per worker, not rebuilt per
file) and one toolchain for CI + publish; on the mocked/WASM loops it's ~tied with
bun at the current scale.

- **Daily iteration (mocked)**: `npm run tests` (~74 s) or
  `npm run tests -- --run-versions newest` (~19 s) if you only care about
  newest-version behaviour. `tests <coord>` for a single cell — this is the real
  inner loop now that the full mocked sweep is ~74 s.
- **Validate one cell against real-DB cheaply**: `npm run tests -- <cell>` — if
  `<cell>` is a SQLite native connector (better-sqlite3, node_sqlite, sqlite3)
  you already get real-DB at mock-loop speed. See
  [`DESIGN.md` § Real-DB validation](./DESIGN.md#real-db-validation) for the cost
  tiers.
- **Pre-merge confidence**: `npm run tests -- --docker` — every test runs against
  its real engine. Add `--wasm` for the full matrix. (Docker wall-times are
  pending re-measurement on the current matrix — see the § note under
  [Cross-runtime timings](#cross-runtime-timings).)
- **WASM-touching changes**: `npm run tests -- --run-connectors wasm --wasm`.
- **No-docker CI (memory-bounded)**: `npm run tests -- --shard` runs the four CI
  shards in sequence; peak = biggest shard, not the sum. See
  [`CLI.md` § Sharding](./CLI.md#sharding).

**When to use bun:**

- **The bun-native connector cells** (`bun_sql_postgres`, `bun_sql_mysql`,
  `bun_sql_sqlite`, `bun_sqlite`) import `bun:sql` / `bun:sqlite` and can *only*
  run under bun — run those under bun (`bun run tests <coord> --docker`). They're
  a small slice of the matrix, so the per-file rebuild cost there is bounded.
- A quick mock check where you don't want to spin up node is fine under bun
  (~68 s full matrix, ~16 s newest) — ~tied with vitest there.

**Refreshing the docker rows** (macOS 12-core reference; one run at a time, never
two in parallel — same machine skews both):

```sh
# vitest, full real matrix — run once to warm the engines, time the second run
npm run tests -- --docker --wasm
/usr/bin/time -p npm run tests -- --docker --wasm   # "real" = wall
/usr/bin/time -p npm run tests -- --docker          # marginally less (no WASM phase)
# bun, full real matrix — SLOW (~1 h+, rebuilds the pool per file); optional
/usr/bin/time -p bun run tests --docker --wasm
npm run tests:stop-containers                        # tear the engines down after
```

Needs enough Docker VM disk for all five engines up at once (oracle + mssql are
the big ones); free space first if the run aborts with "no space left on device".

CI keeps both runtimes green (both jobs run `test:no-docker:shard`), and the
publish pipeline stays on npm/Node — see [`CLAUDE.md`](../CLAUDE.md).
