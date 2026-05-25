# `test/` — ts-sql-query test suite

The new ts-sql-query test suite. Designed to **eventually replace
[`src/examples/`](../src/examples)** without losing any of its existing
coverage. Both coexist until parity is reached; this folder is the future.

The full design is in [`DESIGN.md`](./DESIGN.md). Read it once if you are
going to add tests, change the layout, or wire a new database. The points
below are the minimum you need to run and extend the suite.

> **Where each topic lives** — agents should jump straight to the file
> that matches the task at hand rather than scroll this one:
>
> | Topic | File |
> |---|---|
> | Daily-loop running, focused runs, snapshots | This file |
> | Docker container reuse, mutation safety, per-worker DBs, parallel timings, bun-vs-vitest cost | [`CONTAINERS.md`](./CONTAINERS.md) |
> | Coverage flags, report flags, monocart, scope, aliases | [`COVERAGE.md`](./COVERAGE.md) |
> | Typecheck, symmetry audit, adding a test, adding a database, prisma + sync | [`MAINTAINING.md`](./MAINTAINING.md) |
> | Tests derived from `docs/queries/*` and `docs/advanced/*` (`docs.*.test.ts` files, `docs:` / `docs-extra:` prefixes) | [`DOCS.md`](./DOCS.md) |
> | Notes for adding new connectors / compatibility versions (dialect commented-outs, deferred connector subtrees) | [`FUTURE_CONNECTORS.md`](./FUTURE_CONNECTORS.md) |
> | Architecture decisions and rationale | [`DESIGN.md`](./DESIGN.md) |
> | Known library limitations that affect tests (only the project author can add entries) | [`LIMITATIONS.md`](./LIMITATIONS.md) |
> | Known issues / bugs the suite has surfaced (anyone can add entries) | [`BUGS.md`](./BUGS.md) |

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

A handful of CLIs cover every workflow:

| CLI | What it runs |
|---|---|
| `tests [<coord>…]` | No args: the full matrix under `test/` (parallel, no docker, no real WASM by default; widen with flags). One or more positional coords: focused run on those paths only — globs (`'postgres/*/pg'`) and brace expansion (`postgres/*/{pg,postgres}`) supported, quoted or not (see § Focused runs). Same flag set either way; only what paths the runner visits differs. `--help` for all options. |
| `tests:wasm` | Just the in-process WASM cells (pglite, sqlite-wasm-OO1), serially, with real WASM. No flags. |
| `tests:audit` | Symmetry audit — verifies every cell of a database declares the same test files and test names. Pre-merge check. |
| `tests:stop-containers` | Stops the warm docker containers `--docker --docker-mode reuse` left running. |
| `tests:reopen` | Re-open the previously generated `--report` / `--coverage` HTML without re-running tests. |

Each CLI has `--help`. Each is a single shell script that detects
runtime via `npm_config_user_agent` — `bun run X` dispatches to
`bun test`, `npm run X` to `vitest run`. Same entry under either
runtime.

Orthogonal flags scope what the runner sees:

| Flag | What it does | Default |
|---|---|---|
| `--docker` | Docker-backed connectors hit their real DB. Without it they fall through to the mock. | off (mock) |
| `--docker-scope <all\|newest>` | When `newest`, only cells under `<db>/newest/*` keep the real-DB branch; older versions fall back to the mock. No-op without `--docker`. Same shape as `--wasm` (narrower scope), motivation is speed. Defaults to `newest` when `--scope newest` is set (and `--docker-scope` was not given explicitly). | `all` |
| `--scope <all\|newest>` | When `newest`, the runner only visits `<db>/newest/*` and `<db>/types.negative/*` cells — older versions are **not executed at all** (different from `--docker-scope`, which keeps them running against the mock). Implies `--docker-scope=newest` unless overridden. Main use: shorter coverage runs when older-version coverage is redundant with the matching newest cell. | `all` |
| `--wasm` | After the main pass, runs a second sequential pass over the WASM cells against real pglite / sqlite-wasm-OO1. Without it, **the WASM modules are not even imported**. | off (mock) |

The split keeps the parallel main pass fast — WASM is CPU-bound and
tanks parallel throughput. When you do need real WASM, the two-phase
split runs it once at the end, sequentially, in ~1.5 s.

There's also a third env-level knob:

| Flag | What it does | Default |
|---|---|---|
| `TS_SQL_QUERY_DBS` | Comma list of database folder names under `test/db/` (or `all` / `none`). Narrows the SCOPE of the run. | `all` |

The CLI flags above set env vars consumed at runtime by
[`test/lib/backends.ts`](./lib/backends.ts):
`TS_SQL_QUERY_DOCKER`, `TS_SQL_QUERY_DOCKER_SCOPE`, `TS_SQL_QUERY_WASM`,
and `TS_SQL_QUERY_DBS`. The setup files in each cell read those gates
via `isRealDbEnabled(db, kind, version?)`; if any of the gates says
"off" the real-DB branch falls back to the mock without duplicating
the test body.

Crucially, **every test runs in both modes**. With `--docker` off, a
docker-backed connector's real-DB branch is skipped but its SQL,
params, type and mock round-trip assertions still execute. With
`--wasm` off, the same applies to pglite / sqlite-wasm-OO1. The
native in-process connectors (better-sqlite3, bun:sqlite, node:sqlite,
sqlite3) ignore both flags and keep running their real DB. No code
duplication.

```bash
# Full matrix, mocked, no real WASM. ~8 s for ~14k tests under bun
# (~60 s under vitest). Use as a pre-push sweep, NOT the inner loop —
# see the tip block below.
bun run tests

# + real docker backends. ~4:30 with warm containers (the docker
# engine is the bottleneck once you're past the runtime layer).
# Vitest lands in a similar minutes-long ballpark for this regime —
# see CONTAINERS.md § Bun vs vitest for the full matrix + caveats.
bun run tests --docker

# Smoke against real DBs but only on the newest version of each engine.
# Older versions still run (assertions, params, mock round-trip) — they
# just don't pay the docker cost.
bun run tests --docker --docker-scope newest

# Skip older-version cells entirely (paths AND docker gate). Useful for
# coverage runs where the older version doesn't add reachable code.
bun run tests --scope newest

# Full matrix (docker + real WASM second phase). ~4:36 under bun;
# the WASM phase tucks behind the docker matrix at essentially no
# extra cost.
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

!!! warning "Start narrow — full-matrix runs add up even without docker"

    The suite has grown past **~14k tests across ~2.5k files**. Mocked-only
    under bun it's ~8 s; under vitest it's ~60 s; with `--docker` or
    `--wasm` you add real-DB / WASM-bootstrap cost on top. Running the
    full matrix on every inner iteration burns minutes per hour.

    The cells are heavily symmetric — for most changes, the
    `<db>/oldest/*` cells emit the **same** SQL + params snapshots as the
    matching `<db>/newest/*` cell (same SqlBuilder code path, same
    expression tree). Re-running them is wasted feedback.

    **Recommended order while iterating:**
    1. `bun run tests <coord>` — single cell or file. Tightest loop;
       use this while editing.
    2. `bun run tests --scope newest` — change spans several databases.
       Skips `<db>/oldest/*` (~5 s instead of ~8 s, ~3 k fewer assertions).
    3. `bun run tests` — full mocked matrix. **Pre-push** sanity sweep.
    4. `bun run tests --docker` / `--wasm` — only when the change touches
       a docker-backed connector / the WASM path, or as a final
       confidence check.

    Widen the scope explicitly when you have a reason: touching a
    compatibility-version branch in a `SqlBuilder`, investigating a
    regression that might be version-specific, or pushing a
    release-blocking change. Otherwise, narrow stays the default.

> **Bun is the default — clearly faster for mocked and WASM,
> comparable to vitest under docker.** Reference-machine wall times:
>
> - `tests` (mocked, no WASM): bun ~8 s vs vitest ~60 s → **bun ~7×**.
> - `tests --wasm` (real WASM, no docker): bun ~13 s vs vitest ~5 min
>   → **bun ~24×**.
> - `tests --docker` (warm containers, no WASM): bun ~4:30 vs vitest
>   ~2:20–3:00 (~30 % variance run-to-run) → **inconclusive**.
> - `tests --docker --wasm` (full matrix): bun ~4:36 vs vitest ~6:17
>   → **inconclusive**.
>
> The mocked / WASM gaps are real runtime wins for bun (vitest pays
> per-worker node spin-up + TS transpile of the dependency tree, and
> re-imports the WebAssembly modules per worker). The `--docker`
> comparison is **not a clean signal**: vitest covers ~10.5k tests
> vs bun's ~14k (some connectors are bun-only, some node-only),
> single multi-minute runs have ~30 % variance, and the docker
> container engine itself is the bottleneck once you're past the
> runtime layer. Workload-normalised, the two runtimes land in the
> same ballpark.
>
> **Default to bun.** Opt into vitest (`--use-vitest`) only when you
> need its richer report / coverage stack. Full matrix and caveats
> in [`CONTAINERS.md` § Bun vs vitest](./CONTAINERS.md#bun-vs-vitest).

For the per-engine parallel timings, the container-reuse model, the
mutation-safety contract and per-worker DB isolation, see
[`CONTAINERS.md`](./CONTAINERS.md).

### Focused runs

When you are iterating on a single change and do not want to wait for
the full matrix, pass one or more positional `<coord>` arguments to
the same `tests` script. Zero positional args runs the full matrix;
one or more runs only those paths. Same flags either way — the only
behavioural delta is that `--wasm` becomes a single-pass override in
focused mode (the two-phase split fires only on the full matrix).

Each positional argument is a path under `test/db/`; it can resolve to
any of the four levels — database, version, connector, or a single
test file — **and the script accepts multiple coords, globs, and
brace expansion** so you can address any cross-section of the matrix
in one invocation.

!!! tip "Container reuse is the default"

    `tests` defaults to `--docker-mode reuse`,
    which keeps docker containers alive between invocations
    (`TESTCONTAINERS_REUSE_ENABLE=true`) and collapses the feedback
    loop from ~6 s per focused run to ~1.4 s on the mysql cell. Same
    effect on every docker-backed cell.

    The containers stay alive on the host between runs. That is
    intentional and acceptable: the time saved on every iteration is
    worth the residual `docker ps`. There is no need to call
    `tests:stop-containers` between runs — only when you actually
    want to start clean (see
    [`CONTAINERS.md` § Stopping the reused containers](./CONTAINERS.md#stopping-the-reused-containers)).
    Override with `--docker-mode no-reuse` when you need a hermetic
    container.

A coord has up to four levels — supply any prefix, the rest is walked
by the runner:

    <coord> = <db>[/<version>[/<connector>[/<file>]]]

| Level | What it is | Examples |
|---|---|---|
| `<db>` | Folder under `test/db/`. | `mariadb`, `mysql`, `oracle`, `postgres`, `sqlite`, `sqlserver` |
| `<version>` | Compatibility-version folder under `<db>/`. `newest` (= `Number.POSITIVE_INFINITY`), `oldest` (the `< lowest-breakpoint` zone), or the literal numeric breakpoint when one exists. `<db>/types.negative/` is a sibling for compile-time negatives — not a version folder — and is included only under `--connections=all`. | `newest`, `oldest`, `13_000_001`, `10_005_000` |
| `<connector>` | Per-driver folder under `<db>/<version>/`. One of the entries in [`docs/configuration/query-runners/recommended/`](../docs/configuration/query-runners/recommended/) for that DB. | postgres: `pg`, `postgres`, `bun_sql_postgres`, `pglite`; sqlite: `better-sqlite3`, `bun_sqlite`, `node_sqlite`, `sqlite3`, `sqlite-wasm-OO1` |
| `<file>` | A single `*.test.ts` file inside `<connector>/` — narrowest focus. | `select.basic.test.ts`, `insert.returning.test.ts` |

Examples use `bun run` (preferred); swap in `npm run` for the vitest
path — the script entry is the same, the underlying runner switches.
When forwarding extra args under `npm run`, prefix them with `--`
(npm strips its own arg parser without it).

```bash
# Level 4: single test file (the narrowest focus).
bun run tests postgres/newest/pg/select.basic.test.ts

# Level 3: one (version × connector) cell.
bun run tests postgres/newest/pg

# Same cell + real docker (container reused across runs by default).
bun run tests postgres/newest/pg --docker

# Level 2: whole version, every connector.
bun run tests postgres/oldest --docker

# Level 1: whole database, every (version × connector).
bun run tests postgres --docker

# Pass extra args through to the runner (snapshot update, etc.).
bun run tests postgres/newest/pg --docker -- --update-snapshots
npm  run tests postgres/newest/pg --docker -- -- -u    # vitest

# Real WASM on a wasm cell — single pass (no two-phase split here).
bun run tests postgres/oldest/pglite --wasm --mode sequential
```

#### Coord patterns: literals, globs, braces, multi-coord

A coord can be a literal path, a glob, a brace-expanded set, or any
combination — all in any number of positional arguments. **The
script handles globs AND braces whether you quote the coord or
not**, so use whichever form you find readable; both yield the same
result:

```bash
# Single connector across every existing version (newest + oldest).
# Quoting is OPTIONAL — both forms behave identically.
bun run tests 'postgres/*/pg' --docker
bun run tests postgres/*/pg --docker

# Same, with --scope newest: the script drops `*/oldest/*` paths
# from the expansion before invoking the runner — only
# postgres/newest/pg actually runs.
bun run tests 'postgres/*/pg' --docker --scope newest

# Two connectors of one database, every version. Quote or not —
# both work. (Quoted: the script brace-expands. Unquoted: bash
# brace-expands before the script even sees the args.)
bun run tests 'postgres/*/{pg,postgres}' --docker
bun run tests postgres/*/{pg,postgres} --docker

# Multiple unrelated coords combined in one run. Mix literals,
# globs, and brace-expanded sets freely.
bun run tests 'postgres/*/pg' sqlite/newest/bun_sqlite \
                    '{mariadb,mysql}/newest' --docker

# Glob across every database, one file pattern.
bun run tests '*/newest/*/select.basic.test.ts'
```

Internals: when a coord contains any of `*`, `?`, `[`, or `{`, the
script vets the string against a strict whitelist (alphanumerics,
`. _ / -`, and the pattern chars themselves) and then asks bash to
expand braces + globs in one shot. Anything outside that vocabulary
is rejected before any expansion runs.

An unmatched glob/brace expansion is an error (nullglob), not a
silent zero-test run. A coord that literally names `oldest` together
with `--scope newest` is rejected outright — that's an explicit
contradiction.

#### Narrowing inside a coordinate

Both runners accept a test-name regex (`-t` / `--test-name-pattern` on
`bun:test`, `-t` / `--testNamePattern` on vitest) which composes with
the path filter. Pass it after `--`:

```bash
# Run only the test(s) whose name matches the regex in this cell
bun run tests postgres/newest/pg --docker -- -t inner-join

# File + test-name regex
bun run tests postgres/newest/pg/select.basic.test.ts --docker -- -t inner-join

# File + test-name regex + snapshot refresh — the canonical
# "update one test's snapshot" recipe
bun run tests postgres/newest/pg/select.basic.test.ts --docker -- -t inner-join --update-snapshots

# Same recipe under vitest (use `-u`, prefix extras with `-- --`):
npm run tests postgres/newest/pg/select.basic.test.ts --docker -- -- -t inner-join -u
```

`--update-snapshots` (or `-u`) only refreshes the snapshots of the
tests the runner actually executed, so combining it with `-t <regex>`
is a safe way to fix one test's inline snapshot without churning
every other snapshot in the file or in the cell.

The focused run is the primary tool for an agent iterating on a
single cell. Standard recipe: `tests <coord> --docker` (or
narrower with `<coord>/<file>.test.ts` + `-t <regex>`), optionally
with `--update-snapshots` to refresh just what changed, followed by
`tests --docker --wasm` at the end to catch cross-cell regressions.

## Updating snapshots

SQL and params are kept in inline snapshots so they can be refreshed
in bulk whenever the SqlBuilder reshapes its output. Pass the runner's
update flag after `--`:

```bash
# Whole version
bun run tests postgres/newest --docker -- --update-snapshots

# One file
bun run tests postgres/newest/pg/select.basic.test.ts --docker -- --update-snapshots

# One test inside one file
bun run tests postgres/newest/pg/select.basic.test.ts --docker -- -t inner-join --update-snapshots
```

Either runner produces compatible inline snapshot format, so updating
under one leaves the suite green under the other.

Direct invocation also works if you do not want to go through the
script (`bun test test/db/postgres/newest/ --update-snapshots`,
`npx vitest run test/db/postgres/newest/ -u`).

Review the diff before committing — a snapshot change is real signal
that the emitted SQL has changed.
