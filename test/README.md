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
> | Known issues | [`BUGS.md`](./BUGS.md) |

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
# Daily loop: no docker, no real WASM. ~3 s for 1281 tests under bun.
bun run tests

# + real docker backends. ~17 s.
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

> **Bun is ~7× faster than vitest for the daily loop.** On the
> reference machine the same `tests` matrix (no docker, no WASM)
> finishes in ~3 s under `bun run` versus ~21 s under `npm run`
> (vitest). The gap is not parallelism — both saturate the same CPU
> percentage — but per-worker IPC + node spin-up + TS transpilation
> overhead that vitest pays and bun doesn't. Default to bun for
> day-to-day work; opt into vitest (`--use-vitest`) only when you
> need the rich report / coverage stack. Full breakdown in
> [`CONTAINERS.md` § Bun vs vitest](./CONTAINERS.md#bun-vs-vitest-daily-loop).

For the per-engine parallel timings, the container-reuse model, the
mutation-safety contract and per-worker DB isolation, see
[`CONTAINERS.md`](./CONTAINERS.md).

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
    want to start clean (see
    [`CONTAINERS.md` § Stopping the reused containers](./CONTAINERS.md#stopping-the-reused-containers)).
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
`tests --docker --wasm` at the end to catch cross-cell regressions.

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
