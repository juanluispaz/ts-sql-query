# `test/` — wall-time benchmarks

Reference numbers for the `test/` matrix (now **~357k tests / ~22.5k files**) under
each invocation regime, on a 12-logical-core reference machine (macOS, warm reused
containers when docker is involved), measured one run at a time. Use when picking
a workflow. The bun and vitest columns are **not** an identical-workload
comparison — some connectors only run real under one runtime (see the ‡ caveat
under [Cross-runtime timings](#cross-runtime-timings)). Update after the matrix
grows materially or a runtime changes its isolation model.

Companion to [`CLI.md`](./CLI.md) (how to run things) and
[`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md) (why docker is the bottleneck once
it's on).

- [The one lever that matters: no per-file isolation](#the-one-lever-that-matters-no-per-file-isolation)
- [Cross-runtime timings](#cross-runtime-timings)
- [Bun: `--parallel --no-isolate`](#bun---parallel---no-isolate)
- [Sharding: the no-docker CI split](#sharding-the-no-docker-ci-split)
- [Practical workflow](#practical-workflow)

> **History note.** Up to Bun 1.3, `bun test --parallel` always implied
> `--isolate` (a fresh global per file) with no opt-out, so bun rebuilt every
> cell's DB pool on every file and the real-DB matrix took hours under it; the
> matrix ran under node + vitest (`isolate: false`). Bun 1.4.0 added
> `--no-isolate` for `--parallel`, which `scripts/_test-common.sh` now passes by
> default — and with it bun is the faster runtime on every loop measured below,
> mocked and real. The default runner is **bun** since then.

## The one lever that matters: no per-file isolation

Almost the entire runtime story reduces to **per-file isolation**.

By default a test runner tears the environment down and re-imports every module
between files. At ~22.5k files that re-import is the dominant cost: the module
graph — including [`lib/containerLifecycle.ts`](./lib/containerLifecycle.ts),
whose `memoizeSharedRunner` caches the real-DB connection pool + schema bootstrap
in a module-level closure — is rebuilt per file, so the memoisation is defeated
and the **pool + schema bootstrap is rebuilt once per file** instead of once per
worker.

Both runtimes are configured to skip it: vitest with `isolate: false` in
[`vitest.config.ts`](../vitest.config.ts), bun with `--parallel --no-isolate`
(passed by `run_phase` in [`scripts/_test-common.sh`](../scripts/_test-common.sh)).
Each worker then **reuses its module graph across every file it runs**, so the
memoisation holds: one pool per worker, not one per file.

Controlled A/B under bun 1.4.4 on the current matrix (toggling only the flag):

| Selection | bun `--parallel` (isolated) | bun `--parallel --no-isolate` | Speed-up |
|---|---|---|---|
| `tests --run-versions newest` (5 598 files, mocked) | 16.8 s | **2.1 s** | **~8×** |
| `tests` (22 530 files, mocked) | 62 s / 6.7 GB | **9.9 s / 3.8 GB** | **~6×** |
| 5 newest docker cells (oracledb, mssql, pg, mysql2, mariadb; 1 387 files, real) | 207 s | **114 s** | **~1.8×** |

The same lever was measured for vitest when the matrix was ~4.1k files
(`isolate: true` → `false`: mocked newest 79 s → 9.5 s, `postgres/newest/pg`
243 pool builds → 12). The effect is structural — pool/import amortised per
worker vs rebuilt per file — and holds at any size.

## Cross-runtime timings

Same commands under both runtimes, both without per-file isolation, on the
current ~22.5k-file matrix (12-core macOS, sequential — never two runs at once).
Peak RSS is the summed resident memory of the test processes (the docker engines
are on top — see [Practical workflow](#practical-workflow)):

| Invocation | bun wall / peak | vitest wall / peak | Reading |
|---|---|---|---|
| `tests --run-versions newest` (mocked) | **~2 s** | ~17 s | not identical work‡ |
| `tests` (mocked, 357 246 tests / 22 530 files) | **~10 s / 3.8 GB** | ~48 s / 4.0 GB† | not identical work‡ |
| 5 newest docker cells (1 387 files, warm) | **114 s / 1.8 GB** | 143 s / 3.0 GB | same docker cells |
| `tests --docker` (warm containers) | **670 s / 2.7 GB** | 729 s / 9.0 GB | bun runs MORE real cells‡ |
| `tests --docker --wasm` (warm containers) | **742 s / 3.7 GB** (WASM phase 27 s) | ~9:00 (17k-file matrix) | — |

**† vitest's mocked run is memory-heavy.** At this size each worker carries a
large accumulated module graph — the accumulation that peaks ~15.9 GB and OOMs
the 16 GB CI runner on Node 26 (see [`CLI.md` § Sharding](./CLI.md#sharding)).
The main vitest process, which collects every file's results, also outgrows
V8's ~4 GB default heap on the full matrix: `run_phase` in
[`scripts/_test-common.sh`](../scripts/_test-common.sh) starts it with
`--max-old-space-size=8192` (workers keep the default). Without it the run dies
with "heap out of memory", or crawls in GC just under the limit (~2.5× slower).

**‡ The `bun` and `vitest` columns are NOT the same workload.** The docker
connectors `pg` / `postgres` / `mysql2` / `mariadb` / `oracledb` / `mssql` and the
`sqlite3` driver run real under both runtimes. The rest split by runtime:

- **real only under bun**: `bun_sql_postgres`, `bun_sql_mysql` (docker) and
  `bun_sqlite(-sync)`, `bun_sql_sqlite` (embedded) — they import `bun` /
  `bun:sqlite`;
- **real only under node**: `better-sqlite3(-sync)` (a native addon that does not
  load under bun) and `node_sqlite(-sync)` (under bun `node:sqlite` is Bun's own
  reimplementation, so it would validate Bun, not Node).

Under `--docker`, bun therefore validates 11 more docker cells against their
engine than vitest does — and is still faster — while vitest validates the
node-only embedded SQLite cells, which are cheap.

## Bun: `--parallel --no-isolate`

`--no-isolate` (Bun 1.4+) lets each `--parallel` worker keep one global object and
module registry across the files it runs: the `memoizeSharedRunner` cache, the
per-worker databases keyed on `BUN_TEST_WORKER_ID` and their live pools survive
from one file to the next, exactly as under vitest's `isolate: false`. The price
is the same as vitest's: a file can see what an earlier file in the same worker
left behind (module-level state, unclosed handles). The suite is written for that
model — every cell resets its fixture per test (`ctx.reset()` / `onReseed`).

To debug a test that only fails after another file ran in the same worker, run
with `--isolate` (`bun run tests <coord> --isolate`): it restores bun's default
fresh-global-per-file mode for that run (slower — every file rebuilds its pool).
The flag is ignored under vitest.

Serial mode (`--mode sequential`, no `--parallel`) never isolated and is
unaffected.

## Sharding: the no-docker CI split

The mocked matrix + real WASM run as one **vitest** process peaks ~15.9 GB and
OOMs the 16 GB CI runner on Node 26 at the final aggregation. `--shard` splits it
into four mutually-exclusive groups (no overlap), each a separate runner
invocation so memory frees between them — peak = biggest shard, not the sum. CI
runs one step per shard (node + bun); bun's unsharded mocked run peaks far lower
(3.8 GB), but the shards keep both CI jobs on the same partition. Partition +
rationale: [`CLI.md` § Sharding](./CLI.md#sharding).

| Shard | vitest wall † | peak RSS ‡ |
|---|---|---|
| 1 · wasm (real, **sequential**) | ~53 s | 4.8 GiB |
| 2 · sqlite native A | ~8 s | 8.8 GiB |
| 3 · sqlite native B | ~8 s | 6.3 GiB |
| 4 · rest (docker mocked + docs) | ~10 s | 8.4 GiB |
| **all four in sequence** | ~83 s | biggest shard |

† 12-core macOS, unconstrained, vitest 5 on the 22.5k-file matrix. ‡ peak resident
memory under the **CI limit** (`--cpus=4 --memory=16g`, Node 26, Linux; measured
with vitest 4 on the 17k-file matrix) — the
number that matters here, ~7 GB under the ~15.9 GB single-process peak. Shard 1 is
sequential (the WASM module bootstrap is per-worker; running it parallel is
catastrophic) and gets `--max-old-space-size=8192` on node.

## Practical workflow

> **Every number in this file assumes the machine is otherwise idle, and that is
> a requirement, not a caveat.** Never run two heavy jobs at once (whole matrix,
> any `tsc`, `tests:audit`, `tests:index*`, the example suites): the whole-matrix
> vitest run peaks ~15.9 GB and the per-connector tsc split ~8 GB, so together
> they exceed a 16 GB box and the OOM-killer takes one out (`EXIT=137`, usually
> with no summary printed). The survivor is worse than useless — CPU starvation
> pushes tests past the 60 s per-test timeout, and a contention timeout looks
> exactly like a real regression. Discard and re-run alone; never interpret.
> **The engines count against the same budget.** With `--docker`, the containers
> hold ~7.2 GB at rest (SQL Server ~3.1, Oracle ~2.6, MySQL ~0.8, MariaDB ~0.36,
> PostgreSQL ~0.32) inside a Docker VM provisioned ~11.7 GB of host RAM — and
> `--docker-mode reuse` (the default) keeps them up BETWEEN runs, so they compete
> with a later `tsc` too. `bun run tests:stop-containers` releases them.
>
> Full rule: [`CLI.md` § One heavy job at a time](./CLI.md#one-heavy-job-at-a-time).

**Default runner: bun** (`bun run tests …`) for the `test/` matrix — fastest on
every loop and the lowest memory, and the only runtime that runs the Bun SQL cells
against their engines. vitest stays fully supported; CI runs both, and the publish
pipeline stays on npm/Node.

- **Daily iteration (mocked)**: `bun run tests` (~10 s) or
  `bun run tests --run-versions newest` (~2 s). `bun run tests <coord>` for a
  single cell.
- **Validate one cell against real-DB cheaply**: `bun run tests <cell>` — the
  embedded SQLite cells that run under bun (`bun_sqlite`, `bun_sql_sqlite`,
  `sqlite3`) are real at mock-loop speed. See
  [`DESIGN.md` § Real-DB validation](./DESIGN.md#real-db-validation) for the cost
  tiers.
- **Pre-merge confidence**: `bun run tests --docker --wasm` — every docker, WASM
  and bun-embedded cell runs against its real engine. **Then**
  `npm run tests -- --run-connectors native` for the node-only embedded cells
  (`better-sqlite3`, `node_sqlite` and their `-sync` twins), which bun mocks.
- **WASM-touching changes**: `bun run tests --run-connectors wasm --wasm`.
- **No-docker CI (memory-bounded)**: `bun run tests --shard` runs the four CI
  shards in sequence; peak = biggest shard, not the sum. See
  [`CLI.md` § Sharding](./CLI.md#sharding).

**Refreshing the docker rows** (macOS 12-core reference; one run at a time, never
two in parallel — same machine skews both):

```sh
# warm the engines once, then time the second run
bun run tests --docker --wasm
/usr/bin/time -p bun run tests --docker --wasm          # "real" = wall
/usr/bin/time -p npm run tests -- --docker --wasm       # the vitest column
bun run tests:stop-containers                           # tear the engines down after
```

Needs enough Docker VM disk for all five engines up at once (oracle + mssql are
the big ones); free space first if the run aborts with "no space left on device".

CI keeps both runtimes green (both jobs run `test:no-docker:shard`), and the
publish pipeline stays on npm/Node — see [`CLAUDE.md`](../CLAUDE.md).
