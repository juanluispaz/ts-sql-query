# `test/` — CLI reference

The `tests` family of scripts: every command, every flag, every alias.
Reference, not tutorial.

For the navigation map see [`README.md`](./README.md). For wall-time numbers
see [`BENCHMARKS.md`](./BENCHMARKS.md). For the docker / WASM lifecycle that
the `--docker` / `--wasm` flags drive see
[`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md).

- [The scripts](#the-scripts)
- [Test-loop discipline](#test-loop-discipline)
- [Flags](#flags)
- [Focused runs](#focused-runs)
- [Coord patterns: literals, globs, braces, multi-coord](#coord-patterns)
- [Narrowing inside a coordinate](#narrowing-inside-a-coordinate)
- [Listing cells or tests without running](#listing-cells)
- [The validation summary](#validation-summary)
- [Coverage](#coverage)
- [Coverage report formats](#coverage-report-formats)
- [Test-execution report formats](#test-execution-report-formats)
- [Aliases](#aliases)
- [Forbidden combinations](#forbidden-combinations)
- [Reserved names](#reserved-names)

## The scripts

| Script | What it runs |
|---|---|
| `tests [<coord>…]` | No args: full matrix under `test/` (parallel, no docker, no real WASM by default; widen with flags). One or more positional coords: focused run on those paths only — globs (`'postgres/*/pg'`) and brace expansion (`postgres/*/{pg,postgres}`) supported, quoted or not. Same flag set either way. `--help` for all options. |
| `tests:audit [<coord>…]` | Mechanical audit of `test/db/`: the symmetry check + the anti-cheat content rules (`mirror-image`, `one-sided-guard`). Static (no docker/DB), ~1 s. Accepts positional `<coord>` args to scope the run, same grammar as `tests` (see [Coord patterns](#coord-patterns)). Pre-merge check. See [`lib/audit/AUDIT.md`](./lib/audit/AUDIT.md). |
| `tests:stop-containers` | Stops the warm docker containers that `--docker --docker-mode reuse` left running. |
| `tests:reopen` | Re-open the previously generated `--report` / `--coverage` HTML without re-running tests. |

Each script is a single shell script that detects runtime via
`npm_config_user_agent` — `bun run X` dispatches to `bun test`, `npm run X`
to `vitest run`. Same entry under either runtime.

**Under `npm run`**, bare `--flag` tokens are consumed by npm itself as
config (you'll see `npm warn Unknown cli config "--flag"`). Use the `--`
separator: `npm run tests -- --docker --run-versions newest`. Bun does not have
this problem.

## Test-loop discipline

The suite has grown past **~14k tests across ~2.5k files**. Mocked-only
under bun it's ~8 s; under vitest ~60 s; with `--docker` or `--wasm` add
real-DB / WASM-bootstrap cost on top. Running the full matrix on every
inner iteration burns minutes per hour.

The cells are heavily symmetric — for most changes, the `<db>/oldest/*`
cells emit the **same** SQL + params snapshots as the matching `<db>/newest/*`
cell (same SqlBuilder, same expression tree). Re-running them is wasted
feedback.

**Recommended order while iterating:**

1. `bun run tests <coord>` — single cell or file. Tightest loop; use while
   editing.
2. `bun run tests --run-versions newest` — change spans several databases. Skips
   `<db>/oldest/*` (~5 s instead of ~8 s, ~3 k fewer assertions).
3. `bun run tests` — full mocked matrix. **Pre-push** sanity sweep.
4. `bun run tests --docker` / `--wasm` — only when the change touches a
   docker-backed connector / the WASM path, or as a final confidence check.

Widen the scope explicitly when you have a reason: touching a
compatibility-version branch in a `SqlBuilder`, investigating a regression
that might be version-specific, or pushing a release-blocking change.
Otherwise, narrow stays the default.

## Flags

Orthogonal — combine freely (except for the [Forbidden combinations](#forbidden-combinations)).

| Flag | What it does | Default |
|---|---|---|
| **Axis 1 — participation (what RUNS; excludes, never mocks)** | | |
| `--run-versions <all\|newest>` | Post-filter on the coords by version: `newest` visits only `<db>/newest/*` (+ `<db>/types.negative/*`) — older versions are **not executed at all**. | `all` |
| `--run-connectors <all\|docker\|wasm\|native>` | Post-filter on the coords by connector kind. `wasm` = pglite + sqlite-wasm-OO1; `native` = embedded SQLite drivers; `docker` = containerised engines. Pure path filter (excludes the rest from the run) — it does **not** set real/mock. | `all` |
| **Axis 2 — real/mock (what's REAL among what runs)** | | |
| `--docker [all\|none\|newest\|<coord>]`… | Which docker-backed cells run against a real container. Bare = `all`; `newest` = only `<db>/newest/*`; a `<coord>` = only the matching docker cell(s) real, the rest mock. **Repeat the flag** for several coords (see note below). | `none` (mock) |
| `--wasm [all\|none\|newest\|<coord>]`… | Same vocabulary and coord rules as `--docker` (repeat the flag for several coords — see note below), for the WASM cells (pglite, sqlite-wasm-OO1). When real on the full matrix, WASM runs in its own sequential phase (two-phase split). | `none` (mock) |
| `--native [all\|none\|newest\|<coord>]`… | Same vocabulary and coord rules as `--docker` (repeat the flag for several coords — see note below), for the native SQLite drivers (better-sqlite3, bun_sqlite, node_sqlite, sqlite3). `--native none` forces them to the mock — the cheap way to make a run fully mock. | `all` (real) |
| **Engine / runtime controls (neither axis — container lifecycle and runtime, not which cells run or which are real)** | | |
| `--docker-mode <reuse\|no-reuse>` | Container reuse policy. `reuse` sets `TESTCONTAINERS_REUSE_ENABLE=true` and keeps containers alive between invocations. `no-reuse` is hermetic. | `reuse` |
| `--mode <parallel\|sequential>` | Parallel uses one worker per logical core (minus reserved); sequential runs everything in one worker. | `parallel` |
| `--use-vitest` | Force vitest runtime even under `bun run`. Implied by `--ui`. | off |
| `--ui` | Launch `@vitest/ui` (implies `--use-vitest`). | off |
| **Reports & coverage** | | |
| `--report` | Emit test-execution report under `.test-report/`. | off |
| `--report-format <name>` | Repeatable. See [Test-execution report formats](#test-execution-report-formats). | runtime-dependent |
| `--coverage` | Emit coverage report under `.test-report/coverage/`. | off |
| `--coverage-format <name>` | Repeatable. See [Coverage report formats](#coverage-report-formats). | `html` |
| `--open` | After a green run, open the richest available HTML report. | off |
| **Narrowing (runtime-agnostic — translated to the active runner's spelling)** | | |
| `--update-snapshots` | Refresh the snapshots of the tests this run executes. Translated to bun's `--update-snapshots` / vitest's `--update` for you. | off |
| `--test-name-pattern <regex>` | Run only the tests whose name matches `<regex>`, composed with the path filter. Translated to bun's `--test-name-pattern` / vitest's `--testNamePattern` for you. | (none) |
| `--bail [<N>]` | Stop the run after `N` test failures (`N` defaults to 1). Emitted as `--bail=N`, accepted verbatim by both runtimes. `--bail 0` is rejected; omit the flag to disable bailing. | off |
| `--timeout <ms>` | Override the per-test timeout (positive integer ms). Translated to bun's `--timeout` / vitest's `--testTimeout`. `--timeout 0` is rejected. | `60000` |
| `--no-color` | Strip ANSI colors from the output (sets `NO_COLOR=1`, honoured by both runtimes). Also suppresses the WASM-phase color re-injection on a TTY. | off |
| **Listing (enumerate, don't run — mutually exclusive)** | | |
| `--list-cells` | Print the connector-level cells the current coords/`--run-versions`/`--run-connectors` select, one per line, then exit without running. See [Listing cells or tests without running](#listing-cells). | off |
| `--list-cells-with-mode [running\|all\|real\|mock\|skipped]` | Like `--list-cells`, but each cell is annotated with its real/mock/skipped mode under the current flags. Optional filter: `running` (default — cells that will run), `all` (incl. off/skipped), `real`, `mock`, `skipped`. See [Listing cells or tests without running](#listing-cells). | off |
| `--list-files` | Print the `*.test.ts` files the current selection would run (filesystem walk, runtime-agnostic), then exit without running. See [Listing cells or tests without running](#listing-cells). | off |
| `--list-tests` | Print the test *names* the current selection would run (vitest-backed), then exit without running. See [Listing cells or tests without running](#listing-cells). | off |
| **Run summary (after a normal run)** | | |
| `--validation-summary [running\|all\|real\|mock\|skipped]` | After a normal run, print the same annotated block `--list-cells-with-mode` would — which cells were validated real vs mock. Same optional filter. See [The validation summary](#validation-summary). | off |

**Two axes.** *Axis 1* (positional coords → `--run-versions` →
`--run-connectors`) decides what **runs**; it only ever EXCLUDES cells.
*Axis 2* (`--docker` / `--wasm` / `--native`) decides what runs **real** vs
the **mock** among them. The two are orthogonal: `--run-connectors docker`
runs *only* docker cells; `--docker` makes (some) docker cells *real*. A cell
not selected as real for its kind falls back to the mock — the test body runs
either way, so no test is duplicated.

**Targeting specific cells real (the bug-fix flow).** The `<coord>` form of
`--docker` / `--wasm` / `--native` uses the same coord rules as the positional
args, with two things to keep in mind:

- **One token per flag — repeat it for more.** Each `--docker`/`--wasm`/`--native`
  consumes exactly the next token. To mark several cells real, repeat the flag:
  `--docker postgres/newest/pg --docker mariadb/newest`. Do **not** space-separate
  (`--docker postgres/newest/pg mariadb/newest`) — only the first token attaches
  to the flag; the rest fall through to the *positional* coords (Axis 1), silently
  narrowing the run instead of marking another cell real.
- **Cell-level granularity.** The real/mock gate keys on the cell
  `<db>/<version>/<connector>`, so a 4th-level `<file>` coord is **rejected with
  an error** — it would add no granularity (the cell is the unit). Drop the file
  segment: `--docker postgres/newest/pg`, not
  `--docker postgres/newest/pg/select.basic.test.ts`. (Positional Axis-1 coords
  *do* accept the `<file>` level — that narrows which tests **run**.)

Mixing a literal with a coord (`--docker all postgres/newest/pg`) errors; a coord
that matches no running cell of that kind warns as a no-op.

```bash
# One cell real, everything else mock — cheap regression while fixing a SqlBuilder.
bun run tests --docker postgres/newest/pg

# Two specific cells real — repeat the flag, don't space-separate.
bun run tests --docker postgres/newest/pg --docker mariadb/newest
```

**Every test runs in both modes.** With `--docker` off (default), a
docker-backed connector's real-DB branch is gated off but its SQL, params,
type and mock round-trip assertions still execute. Same for `--wasm` off and
pglite / sqlite-wasm-OO1. Native SQLite is real by default (`--native all`);
`--native none` routes it through the mock too.

```bash
# Full matrix, mocked docker/wasm, real native. ~8 s for ~14k tests under bun.
bun run tests

# + real docker backends. ~4:30 with warm containers.
bun run tests --docker

# Smoke against real DBs but only on the newest version of each engine.
bun run tests --docker newest

# Skip older-version cells entirely (participation: not run at all).
bun run tests --run-versions newest

# Full matrix (docker + real WASM second phase). ~4:36 under bun.
bun run tests --docker --wasm

# Only WASM cells run, real WASM module.
bun run tests --run-connectors wasm --wasm

# Only docker-backed connectors run, against real containers.
bun run tests --run-connectors docker --docker

# Only the embedded SQLite drivers run (zero-infra, real by default).
bun run tests --run-connectors native

# Bug-fix flow: validate one cell real, everything else cheap mock.
bun run tests --docker postgres/newest/pg

# Hermetic — fresh containers every run. CI baseline.
bun run tests --docker --docker-mode no-reuse

# Fully mocked — even native SQLite routed through the mock.
bun run tests --native none
```

## Focused runs

When iterating on a single change and you do not want to wait for the full
matrix, pass one or more positional `<coord>` arguments to the same `tests`
script. Same flags either way — only delta is that `--wasm` becomes a
single-pass override in focused mode (the two-phase split fires only on the
full matrix).

Each positional argument is a path under `test/db/`; it can resolve to any
of four levels — database, version, connector, or a single test file:

```
<coord> = <db>[/<version>[/<connector>[/<file>]]]
```

| Level | What it is | Examples |
|---|---|---|
| `<db>` | Folder under `test/db/`. | `mariadb`, `mysql`, `oracle`, `postgres`, `sqlite`, `sqlserver` |
| `<version>` | Compatibility-version folder under `<db>/`. `newest` (= `Number.POSITIVE_INFINITY`), `oldest` (the `< lowest-breakpoint` zone), or the literal numeric breakpoint when one exists. `<db>/types.negative/` is a sibling for compile-time negatives — not a version folder — and is included only under `--run-connectors=all`. | `newest`, `oldest`, `13_000_001`, `10_005_000` |
| `<connector>` | Per-driver folder under `<db>/<version>/`. | postgres: `pg`, `postgres`, `bun_sql_postgres`, `pglite`; sqlite: `better-sqlite3`, `bun_sqlite`, `node_sqlite`, `sqlite3`, `sqlite-wasm-OO1` |
| `<file>` | A single `*.test.ts` file inside `<connector>/` — narrowest focus. | `select.basic.test.ts` |

### Documentation tests are ordinary matrix cells

The doc-snippet SQL tests are **not a special case** — they are generated into the
matrix as a `documentation` connector in each db's `newest` version
(`test/db/<db>/newest/documentation/doc-code.generated.test.ts`), plus a synthetic
`general` db for the non-db templates
(`test/db/general/newest/documentation/<name>.generated.test.ts`). They are always
mock (self-contained), so `--docker`/`--wasm` don't apply to them, but they're
addressed with the same four-level coords as any other cell:

```bash
bun run tests '*/newest/documentation'                              # every doc test cell
bun run tests postgres/newest/documentation                        # one db's doc cell
bun run tests general/newest/documentation                         # the non-db (general) docs
bun run tests postgres/newest/documentation/doc-code.generated.test.ts  # one file
```

The generated files are gitignored (`*.generated.test.ts`) and produced by
`bun run codegen:doc-code` from templates at
`test/templates/doc-code/newest/documentation/`. Full reference:
[`DOC_CODE_EXTRACTOR.md`](./DOC_CODE_EXTRACTOR.md).

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

# Refresh this cell's snapshots — first-class flag, same spelling under
# both runtimes (npm needs its usual single `--` separator for script flags).
bun run tests postgres/newest/pg --docker --update-snapshots
npm  run tests -- postgres/newest/pg --docker --update-snapshots

# Pass runner-specific flags the script doesn't wrap through after `--`.
bun run tests postgres/newest/pg --docker -- --rerun-each 3

# Real WASM on a wasm cell — single pass (no two-phase split here).
bun run tests postgres/oldest/pglite --wasm --mode sequential
```

## Coord patterns

A coord can be a literal path, a glob, a brace-expanded set, or any
combination — all in any number of positional arguments. **The script
handles globs AND braces whether you quote the coord or not.**

```bash
# Single connector across every existing version (newest + oldest).
bun run tests 'postgres/*/pg' --docker
bun run tests postgres/*/pg --docker

# Same, with --run-versions newest: the script drops `*/oldest/*` paths
# from the expansion — only postgres/newest/pg actually runs.
bun run tests 'postgres/*/pg' --docker --run-versions newest

# Two connectors of one database, every version.
bun run tests 'postgres/*/{pg,postgres}' --docker
bun run tests postgres/*/{pg,postgres} --docker

# Multiple unrelated coords combined in one run.
bun run tests 'postgres/*/pg' sqlite/newest/bun_sqlite \
                    '{mariadb,mysql}/newest' --docker

# Glob across every database, one file pattern.
bun run tests '*/newest/*/select.basic.test.ts'
```

**Internals**: when a coord contains any of `*`, `?`, `[`, or `{`, the
script vets the string against a strict whitelist (alphanumerics,
`. _ / -`, and the pattern chars themselves) and asks bash to expand braces
+ globs in one shot. Anything outside that vocabulary is rejected before
any expansion runs.

An unmatched glob/brace expansion is an error (nullglob), not a silent
zero-test run. A coord that literally names `oldest` together with
`--run-versions newest` is rejected outright — that's an explicit contradiction.

## Narrowing inside a coordinate

`--test-name-pattern <regex>` runs only the tests whose name matches the
regex, composed with the path filter. It's a first-class script flag — the
script translates it to bun's `--test-name-pattern` or vitest's
`--testNamePattern` for you, so the spelling is the same under bun and npm.

```bash
# Run only the test(s) whose name matches the regex in this cell
bun run tests postgres/newest/pg --docker --test-name-pattern inner-join

# File + test-name regex
bun run tests postgres/newest/pg/select.basic.test.ts --docker --test-name-pattern inner-join

# File + test-name regex + snapshot refresh — canonical
# "update one test's snapshot" recipe
bun run tests postgres/newest/pg/select.basic.test.ts --docker \
              --test-name-pattern inner-join --update-snapshots

# Under npm: same first-class flags, same spelling. The only npm-ism is
# the single `--` separator npm requires for ANY script flag (the same
# one `--docker` already needs) — there is no SECOND `--` and no
# runtime-specific runner spelling:
npm run tests -- postgres/newest/pg/select.basic.test.ts --docker \
                 --test-name-pattern inner-join --update-snapshots
```

`--update-snapshots` only refreshes the snapshots of the tests the runner
actually executed, so combining it with `--test-name-pattern <regex>` (or a
narrow coord) is a safe way to fix one test's inline snapshot without
churning every other snapshot in the file or cell. Run unscoped over the
full matrix it rewrites **every** snapshot — the script prints a warning in
that case but still proceeds, so deliberate mass-regeneration stays
possible.

Pass-through after `--` remains the right tool for runner-specific flags the
script doesn't wrap — but for snapshot refresh and test-name filtering,
reach for the first-class flags.

These three runner behaviours are first-class so you don't have to
forward them after `--`:

- **`--bail [<N>]`** stops the run after `N` failures (default 1). In the
  iterate-on-one-cell loop (`tests <cell> --docker`), a broken canonical
  aborts immediately instead of waiting for the rest of the cell. Emitted as
  `--bail=N` — bun and vitest both accept it. `--bail 0` is rejected; omit
  the flag to keep running through failures.
- **`--timeout <ms>`** overrides the per-test timeout (default `60000`, the
  value baked into the runner config). Emitted as bun's `--timeout` /
  vitest's `--testTimeout`. Raise it to debug a slow docker-backed cell;
  lower it to fail-fast on a suspected hang instead of waiting the full 60s.
  `--timeout 0` is rejected.
- **`--no-color`** sets `NO_COLOR=1` (both runtimes honour it), keeping
  transcripts and `grep` / `tail` pipelines free of ANSI escapes.

```bash
bun run tests postgres/newest/pg --docker --bail          # stop at first failure
bun run tests postgres/newest/pg --docker --bail 3        # stop after 3 failures
bun run tests postgres/newest/pg --docker --timeout 180000 # roomier timeout for a slow cell
bun run tests postgres/newest/pg --no-color 2>&1 | tail   # clean, parseable output
```

<a id="listing-cells"></a>
## Listing cells or tests without running

Four terminal flags enumerate the selection and exit without running it:
cells (plain or mode-annotated), files, then test names. They are mutually
exclusive (pass only one).

### `--list-cells`

`--list-cells` prints the connector-level cells
(`test/db/<db>/<version>/<connector>`) that the current
coords / `--run-versions` / `--run-connectors` select — one per line, sorted — then
exits **without running any test**. It's runner-free and deterministic: a
drop-in replacement for the hand-rolled `for db in test/db/*/…` inventory
loop, and it honours every path filter for free because it lists exactly
the cells a real run would visit.

```bash
# Every active cell (matches the cell count tests:audit reports).
bun run tests --list-cells

# The exact set a propagation would touch — verify before copy-baking.
bun run tests 'postgres/*/{pg,postgres}' --run-versions newest --list-cells

# Only one connector type.
bun run tests --run-connectors native --list-cells

# A single file collapses to its owning cell.
bun run tests sqlite/newest/better-sqlite3/config.uuid-strategy.test.ts --list-cells
#   → test/db/sqlite/newest/better-sqlite3
```

A selection that resolves to no connector cell (e.g. a coord naming only a
`types.negative/` folder) prints a note to stderr and exits non-zero.

### `--list-cells-with-mode`

`--list-cells-with-mode` annotates cells with their mode under the *current*
flags. Unlike `--list-cells` — which lists only the selection —
`--list-cells-with-mode` considers the **whole matrix** and gives every cell
a verdict plus the reason, so you can see not just what runs but what's
**off and why**. (It's its own terminal flag — not a modifier — so the
listing is unambiguous.)

The per-cell **verdict**:

- `real` — runs against a real engine: `(docker)` / `(wasm)` / `(native)`.
- `mock` — runs, but against the mock, with the reason its kind's
  selection didn't include it: `(docker; needs --docker)`, `(wasm; needs
  --wasm)`, `(docker; --docker newest skips <version>)`, or `(docker; not in
  --docker coords)`.
- `skipped` — off, **excluded from the run** (the runner never sees it),
  with the reason (in precedence order): `(not selected: outside coords)`,
  `(excluded by --run-connectors <type>)`, `(excluded by --run-versions newest)`.

An **optional filter** selects which verdicts to print:

| filter | shows |
|---|---|
| *(omitted)* / `running` | the cells that run a body: `real` + `mock`. The default. |
| `all` | the whole matrix, including the off (`skipped`) ones. |
| `real` | only `real` cells. |
| `mock` | only `mock` cells. |
| `skipped` | only the off cells (any skip reason). |

```bash
# Default (running): only the cells that run; docker/wasm cells are mock
# without their flag, native is always real.
bun run tests 'postgres/*/{pg,pglite}' --list-cells-with-mode

# all → the whole matrix, each off cell labelled with why it's excluded.
bun run tests postgres/newest --run-connectors docker --docker --list-cells-with-mode all
#   test/db/postgres/newest/pg          real    (docker)
#   test/db/postgres/newest/pglite      skipped (excluded by --run-connectors docker)
#   test/db/postgres/oldest/pg          skipped (not selected: outside coords)
#   test/db/mariadb/newest/mariadb      skipped (not selected: outside coords)
#   …
#   -- 3 running cells: 3 real, 0 mock; 14 other cells skipped

# real keeps only the cells that bring up a real engine ("active cases").
bun run tests postgres/newest --docker --wasm --list-cells-with-mode real

# skipped → only the off cells; here, oldest excluded by --run-versions newest.
bun run tests postgres --run-versions newest --docker --list-cells-with-mode skipped
```

A footer tallies the **running** cells (real + mock) and, separately, the
count of **other cells skipped** — independent of the display filter:

```
-- 3 running cells: 3 real, 0 mock; 14 other cells skipped
```

The real/mock projection mirrors [`isRealDbEnabled()`](./lib/backends.ts#L105)
— the runtime source of truth for the real/mock gate — but stays a
runner-free bash computation, so `--list-cells-with-mode` is as instant as
`--list-cells`. (If the gate logic in `backends.ts` changes, the `cell_mode`
helper in [`scripts/_test-common.sh`](../scripts/_test-common.sh) must change
with it; a `KEEP IN SYNC` marker flags it there.)

### `--list-files`

`--list-files` prints the `*.test.ts` files the current selection would run
— one per line, sorted — then exits without running them. It's the
file-granularity sibling of `--list-cells`: the level you actually copy-bake
during propagation, and a clean input for a per-file loop.

Like `--list-cells` it's a **runner-free filesystem walk** — runtime-agnostic
and deterministic, no vitest needed. The `*.test.ts` glob mirrors the
runner's own include (`test/**/*.test.ts`), so the output is exactly the
file set a real run would visit, including in-scope `types.negative/` files.
The per-cell count matches the "N test files per cell" line in
`tests:audit`.

```bash
# Every test file in one cell (matches tests:audit's per-cell file count).
bun run tests postgres/newest/pg --list-files

# Only the native SQLite connectors.
bun run tests sqlite/newest --run-connectors native --list-files
```

> vitest also offers `vitest list --filesOnly`, but `--list-files` stays a
> filesystem walk on purpose: it works without vitest (so it's usable from a
> bun-only loop), is faster (no collection phase), and lists files by
> discovery rather than by whether they register a runtime test — which is
> what you want for inventory and propagation. `--list-tests` is the only
> listing flag that must defer to vitest.

### `--list-tests`

`--list-tests` prints the test *names* the current selection would run —
one full `file > describe > test` name per line — then exits without
running them. It's the tool for **reviewing what already exists before
deciding where to add coverage**, and for previewing which tests a
`--test-name-pattern` matches.

Unlike `--list-cells` (a pure filesystem walk), enumerating test names needs
a runner to collect them, and **bun has no collect-only mode** — so
`--list-tests` is **vitest-backed by design**: it always shells out to
`vitest list` regardless of how the script was invoked. It is the one flag
in the family that is not runtime-agnostic. Collection imports the test
files and evaluates their `describe`/`test` registration but **not** the
test bodies or `beforeAll` hooks, so no real DB is bootstrapped. It honours
the coord / `--run-versions` / `--run-connectors` path filter and `--test-name-pattern`.

```bash
# Every test name in one cell.
bun run tests postgres/newest/pg --list-tests

# Preview which tests a pattern matches before running with it.
bun run tests postgres/newest/pg --list-tests --test-name-pattern inner-join

# Machine-readable: pass --json through after `--`.
bun run tests sqlite/newest --run-connectors native --list-tests -- --json
```

`--list-cells`, `--list-cells-with-mode`, `--list-files` and `--list-tests`
are mutually exclusive — passing more than one is rejected (all are terminal
listing actions).

<a id="validation-summary"></a>
## The validation summary

`--validation-summary` is the run-time counterpart of
`--list-cells-with-mode`: instead of listing-and-exiting, it lets the run
proceed normally and then prints the same annotated real/mock block at the
end. It
answers, after the fact, **which cells were validated against a real engine
versus only the mock** — the "mock-validated vs real-validated" distinction
a coverage round reports when it closes (see
[`COVERAGE_RUNBOOK.md`](./COVERAGE_RUNBOOK.md)).

```bash
# Full matrix + the breakdown of what actually hit a real engine.
bun run tests --docker --validation-summary

# Only the real cells, for one database.
bun run tests postgres/newest --docker --wasm --validation-summary real
```

It takes the same optional filter as `--list-cells-with-mode`
(`running` — default, the cells that ran; `all`; `real`; `mock`; `skipped`)
and is identical in shape (same `cell_mode` projection). It is independent
of pass/fail and is mutually exclusive with the terminal listing actions
(those exit before any run could happen).

## Coverage

Pass `--coverage` to any of the test CLIs; output lands under
`.test-report/coverage/`:

```bash
# Whole matrix, mock-only, parallel — fastest coverage pass.
bun run tests --coverage

# Full real coverage (docker + WASM). Sequential because --wasm +
# parallel + coverage is forbidden — see "Forbidden combinations" below.
bun run tests --coverage --docker --wasm --mode sequential

# One cell.
bun run tests postgres/newest/pg --coverage

# Just the WASM cells.
bun run tests --run-connectors wasm --wasm --coverage

# Under npm/vitest, prefix flags with `--`:
npm run tests -- --coverage
```

### Vitest is the recommended path for coverage

Bun ships a minimal coverage facility — lcov/text only, line-level data
with no column or branch info — and its test-exec reporter is limited to
`junit` and `dots`. The HTML test-execution SPA is vitest-only. Bun handles
both `--report` and `--coverage` natively, but the artifacts are leaner.

To force vitest even when invoking via `bun run` (so you keep bun's faster
daily test loop and still get vitest's coverage stack), pass `--use-vitest`.
`--ui` implies it.

## Coverage report formats

| `--coverage-format` | Under vitest | Under bun |
|---|---|---|
| `html` (default) | istanbul `html` reporter from V8 coverage data; `.test-report/coverage/index.html` + one `*.ts.html` per source file | lcov + a post-render via [`test/lib/coverage/lcovToHtml.ts`](./lib/coverage/lcovToHtml.ts); `.test-report/coverage/index.html` |
| `text` | terminal table | bun's stdout table |
| `lcov` | `.test-report/coverage/lcov.info` | `.test-report/coverage/lcov.info` |
| `lcovonly` | lcov without summary | (errors) |
| `clover` | clover.xml | (errors) |
| `cobertura` | cobertura.xml | (errors) |
| `json` | full json | (errors) |
| `json-summary` | summary json | (errors) |
| `teamcity` | TeamCity service messages | (errors) |
| `monocart` | swaps `@vitest/coverage-v8` for `vitest-monocart-coverage`; native V8 byte-range coverage; SPA at index.html | lcov + a post-render via [`test/lib/coverage/lcovToMonocart.ts`](./lib/coverage/lcovToMonocart.ts); MCR's `html-spa` + per-file `.ts.html` drill-downs |

Under vitest you can pass `--coverage-format` multiple times to emit
several formats in one run. Under bun, multiple is supported only when the
combo doesn't target the same filename (i.e. `html + monocart` errors —
both write `index.html`).

**`html` vs `monocart` under vitest**:

- **Data granularity** — both consume V8 byte-range coverage. `html`
  projects bytes back to lines and paints each whole line green/red.
  `monocart` keeps byte-range data and paints **tokens** inside a line; adds
  a `Bytes` metric. Inside `a ?? b ? c : d` you can literally see which
  sub-expression fired.
- **Output shape** — `html` grows linearly with the source tree (one
  `*.ts.html` per file + istanbul assets). `monocart` is compact (one
  `index.html` + one minified `coverage-data.js`).
- **Both** open straight from `file://`; neither needs `vite preview` (that
  dance is only for the test-execution SPA).
- **Filtering** — `html` honours `coverage.exclude` from `vitest.config.ts`.
  `monocart` ignores it (running as a custom provider) and reads
  `sourceFilter` / `entryFilter` from
  [`mcr.config.mjs`](../mcr.config.mjs). The patterns there are kept in sync
  with `vitest.config.ts` and `bunfig.toml` by hand. Drift means `test/**`
  or `node_modules/**` quietly creeping into the report.
- **When to pick** — daily coverage / CI green-red gate → `html`.
  Investigating a specific gap → `monocart`.

### Scope (which source files end up in the report)

Defaults live in three project config files (kept in sync):

- [`bunfig.toml`](../bunfig.toml): `coveragePathIgnorePatterns`
- [`vitest.config.ts`](../vitest.config.ts): `test.coverage.exclude`
- [`mcr.config.mjs`](../mcr.config.mjs): `sourceFilter` / `entryFilter`

All three exclude `src/examples/**` (legacy examples) and `test/**` (the
test suite itself) so the report focuses on the library's public surface.

There's no CLI flag to override the scope at run time. To narrow the
report for a specific cell, use `tests <coord>` — coverage then only sees
files imported by that cell's tests. To change the project-wide scope, edit
the three config files.

`.test-report/` is wiped at the start of every run with `--report` or
`--coverage`, so older reports or different-format artifacts never seed the
next one.

## Test-execution report formats

`--report-format` is repeatable. Default depends on runtime — `html` under
vitest, `junit` under bun. Setting it implies `--report`.

Under vitest: pass-through (`html`, `default`, `verbose`, `dot`, `tap`,
`tap-flat`, `junit`, `json`, `tree`, `github-actions`).

Under bun: only `junit` (file → `.test-report/junit.xml`) and `dot` /
`dots` (terminal, compact one-char-per-test progress). Other formats error.
Multiple `--report-format` values are not supported (bun's `--reporter` is
single-valued); first one wins and a warning is printed.

**`dot` vs `dots` — use either.** The compact progress reporter is the one
format whose *name* differs between runners (bun's is `dots`, vitest's is
`dot`). The script accepts both as synonyms and normalises to the active
runner's real name, so `--report-format dot` works under bun and
`--report-format dots` works under vitest. `dot` is the documented canonical
(it matches the mocha/jest/vitest convention). This is also the answer to
"just give me terminal-only pass/fail progress" — there's no separate
`--quiet`/`--silent` flag (vitest has `--silent`, bun has none; this suite's
tests emit no `console.log` to silence anyway, and `… 2>&1 | tail` already
yields the summary on either runtime).

For the html test-execution SPA pass `--use-vitest`.

## Aliases

Canonical (project-level):

| Alias | Equivalent |
|---|---|
| `tests:reopen` | Opens the previously generated report without re-running tests. Errors out clearly if neither `.test-report/index.html` nor `.test-report/coverage/index.html` exists. |

User-level shortcuts (personal — feel free to adjust). The display ones wrap
`--report --coverage --open` under vitest; the discovery one (the alias
named `coverage:for-discover-tests`) emits machine-readable coverage
artifacts only (no HTML, no auto-open) under `.test-report/coverage/` for
the AI to read when asked to suggest additional tests from the gaps:

| Alias | Equivalent |
|---|---|
| `coverage:fast` | `tests --report --coverage --open` |
| `coverage:no-docker` | `tests --report --wasm --coverage --mode sequential --open` |
| `coverage:complete` | `tests --report --docker --wasm --coverage --mode sequential --open` |
| `coverage:for-discover-tests` | `tests --use-vitest --coverage --coverage-format json --coverage-format json-summary --coverage-format text-summary --run-versions newest` |
| `coverage:reopen` | Same script as `tests:reopen`. |

<a id="coverage-for-discover-tests-alias"></a>**The discovery alias**
(`coverage:for-discover-tests`) uses `--run-versions newest` on purpose:
older-version cells exercise the same `SqlBuilder` code paths as the
matching `<db>/newest/*` cell, so they would not reveal extra uncovered
lines or branches. The tests generated from those gaps still land in the
full matrix; only the discovery pass is narrowed. Used by
[`COVERAGE_RUNBOOK.md`](./COVERAGE_RUNBOOK.md) as the input for
coverage-driven test generation.

## Forbidden combinations

`--coverage --wasm --mode parallel` is rejected with exit 2. Coverage
requires a single runner invocation, but `--wasm` in parallel mode splits
the matrix into two phases (real WASM sequential + main parallel mocked)
and merging the two coverage shards is fragile. Pass `--mode sequential`,
drop `--wasm`, or drop `--coverage`.

When `--coverage` is set, `tests --wasm` bypasses the two-phase split
entirely and runs everything in one invocation with WASM real (sequential
is implied). The single-pass coverage report ends up cleaner than two
separately-collected shards would be.

## Reserved names

`test` and any `test:*` in `package.json` are **user-only aliases**. The
agent must use the canonical `tests` / `tests:audit` / `tests:stop-containers`
/ `tests:reopen` instead. If you see `test` / `test:foo` in `package.json`,
assume the user added it as a personal shortcut and **do not run it** unless
explicitly instructed.
