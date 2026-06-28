#!/bin/bash
# Run the test/ matrix. See `tests --help` for details.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./_test-common.sh
. "$SCRIPT_DIR/_test-common.sh"

print_help() {
    cat <<'EOF'
Usage:
  tests [<coord>…]
                   # Runner / runtime:
                   [--mode <parallel|sequential>]
                   #   · Axis 1 — participation (what RUNS; excludes):
                   [--run-versions <all|newest>]
                   [--run-connectors <all|docker|wasm|native>]
                   #   · Axis 2 — real/mock (what's REAL among what runs):
                   [--docker [all|none|newest|<coord>]]…
                   [--wasm   [all|none|newest|<coord>]]…
                   [--native [all|none|newest|<coord>]]…
                   #   · engine / runtime controls:
                   [--docker-mode <reuse|no-reuse>]
                   [--use-vitest] [--ui]
                   # Reports & coverage:
                   [--report    [--report-format <name>]…]
                   [--coverage  [--coverage-format <name>]…]
                   [--open]
                   # Narrowing (runtime-agnostic):
                   [--update-snapshots]
                   [--test-name-pattern <regex>]
                   [--bail [<N>]]
                   [--timeout <ms>]
                   [--no-color]
                   # Listing (enumerate, don't run):
                   [--list-cells]
                   [--list-cells-with-mode [running|all|real|mock|skipped]]
                   [--list-files]
                   [--list-tests]
                   # Run summary:
                   [--validation-summary [running|all|real|mock|skipped]]
                   [--help]
                   [-- <args passed to runner>]

Runs the test/ matrix. With no positional args, walks every test under
test/. With one or more <coord> args, only those paths are visited
(focused run — same script, same flags, narrower path set).
Dispatches to `bun test` when invoked via `bun run`, and to
`vitest run` when invoked via `npm run`. Direct invocation
(`sh scripts/tests.sh`) defaults to bun. `--use-vitest` and `--ui`
force the vitest path regardless of how the script was invoked;
`--report` works under both runtimes (formats differ — see below).

Coords
  Each positional arg is a path under test/db/. The structure has four
  navigable levels — supply any prefix; the rest are walked by the
  runner:

    <coord> = <db>[/<version>[/<connector>[/<file>]]]

    <db>         folder under test/db/. One of mariadb, mysql, oracle,
                 postgres, sqlite, sqlserver.
    <version>    compatibility-version folder under <db>/. Either
                 `newest` (the library default — pinned to
                 Number.POSITIVE_INFINITY), `oldest` (the
                 `< lowest-breakpoint` zone), or the literal numeric
                 breakpoint when one exists (e.g. `13_000_001`,
                 `10_005_000`). `<db>/types.negative/` is a sibling
                 used for compile-time negatives — not a version
                 folder — and is included only under --run-connectors=all.
    <connector>  per-driver folder under <db>/<version>/, one of the
                 entries in docs/configuration/query-runners/recommended/
                 for that DB (e.g. postgres: pg, postgres,
                 bun_sql_postgres, pglite).
    <file>       a single `*.test.ts` file inside <connector>/, for
                 the narrowest possible focus.

  Literal-coord examples (one per level):
    tests postgres                                       # whole DB, every version × connector
    tests postgres/newest                                # one version, every connector
    tests postgres/newest/pg                             # one (version × connector) cell
    tests postgres/newest/pg/select.basic.test.ts        # one file

  Documentation SQL tests are ORDINARY matrix cells — a `documentation` connector
  in each db's newest version (plus a synthetic `general` db) — so they're addressed
  like any other coord and always run mock (self-contained):
    tests '*/newest/documentation'                       # every doc test cell
    tests postgres/newest/documentation                  # one db's doc cell
    tests general/newest/documentation                   # the non-db (general) docs

  Multiple coords combined in one invocation (mix any of the four
  levels freely):
    tests postgres/newest/pg sqlite/newest/bun_sqlite
    tests postgres mariadb/newest

  Globs (`*`, `?`, `[`) and brace expansion (`{a,b,…}`) are supported,
  quoted or not — both forms behave identically (the script
  re-tokenises quoted patterns via a vetted eval; unquoted ones are
  expanded by the shell first):
    tests 'postgres/*/pg'                                # both versions, one connector
    tests 'postgres/*/{pg,postgres}'                     # both drivers × every version
    tests '{mariadb,mysql}/newest' postgres/newest/pg    # mix glob/brace/literal
    tests '*/newest/*/select.basic.test.ts'              # one file across every DB

  Globs and brace expansion are vetted against a strict whitelist
  (alphanumerics, `. _ / -`, and the pattern chars themselves) before
  expansion runs — anything outside that vocabulary is rejected. An
  unmatched glob is an error, not a silent zero-test run.

  Under --run-versions newest a coord that literally names oldest
  (`postgres/oldest`, `*/oldest/*`) is rejected as a contradiction;
  globs are expanded and any `*/oldest/*` matches are filtered out.

Runner trade-off
  Bun is fast and is the default for the daily test loop. Vitest is
  the RECOMMENDED path for the rich report stack — its coverage is
  V8-based (column-level) vs bun's lcov collapse, and the html
  test-execution SPA is vitest-only.
  Under bun:
    --report-format        junit (file) | dot|dots (terminal compact
                           progress). Default is junit when --report is
                           on. `dot` and `dots` are synonyms normalised
                           per runtime (bun: dots, vitest: dot), so
                           either spelling works under either runner.
                           html is rejected with an error — pass
                           --use-vitest for the SPA.
    --coverage-format      text | lcov | html | monocart. html is
                           rendered from lcov by
                           test/lib/coverage/lcovToHtml.ts. monocart
                           pipes the same lcov through
                           test/lib/coverage/lcovToMonocart.ts to
                           produce MCR's html-spa (richer UI; line-
                           level data only — bun's lcov is line-
                           collapsed). Other vitest reporters are
                           rejected.
    Passing multiple       --coverage-format values is supported
                           natively; multiple --report-format values
                           warn and keep the first (bun's --reporter
                           is single-valued). monocart and html are
                           mutually exclusive (both write
                           index.html); text and lcov stay
                           composable with either.
  Under vitest:
    --coverage-format=monocart switches the coverage provider to
                           vitest-monocart-coverage, which captures
                           native V8 byte-range coverage and renders
                           MCR's v8 SPA. It's mutually exclusive
                           with the other --coverage-format values
                           because the @vitest/coverage-v8 provider
                           isn't running. MCR options live in
                           mcr.config.mjs at the repo root.
  Pass --use-vitest from a `bun run` invocation to switch.

Defaults
  --mode             parallel
  --run-versions     all  (every version under test/db/<db>/* runs)
  --run-connectors   all  (every connector kind runs)
  --docker           none (docker cells run mock; bare --docker = all)
  --wasm             none (WASM cells run mock; bare --wasm = all)
  --native           all  (native SQLite runs real; --native none = mock)
  --docker-mode      reuse  (containers stay alive between invocations)
  --use-vitest       off (runtime detected from npm_config_user_agent)
  --ui               off (implies --use-vitest)
  --report           off (test-execution report)
  --report-format    html under vitest, junit under bun
  --coverage         off
  --coverage-format  html (when --coverage is on)
  --open             off
  --update-snapshots off
  --test-name-pattern (none — runs every test the path filter selects)
  --bail             off (no bail; bare --bail means 1)
  --timeout          60000 (ms; the value baked into the runner config)
  --no-color         off (colors kept when stdout is a TTY)
  --list-cells       off
  --list-cells-with-mode off (when set: running — show cells that will run;
                     all|real|mock|skipped filter the listing)
  --list-files       off
  --list-tests       off (vitest-backed when used)
  --validation-summary off (when set: running; all|real|mock|skipped filter)

WASM semantics
  Full-matrix mode (no positional coords): when --wasm selects any real
  WASM cell, a sequential pass runs the WASM cells FIRST (real per the
  selection), then the parallel main pass runs them mocked; the WASM
  summary is re-emitted at the end so both phase summaries stay visible.
  WASM failures short-circuit the main pass. The split keeps the parallel
  main pass fast — WASM is CPU-bound. ALL WASM runs in its own unit, no
  matter how granular the --wasm selection is.

  Focused mode (one or more coords): single pass — the --wasm selection is
  applied to that one pass directly (no split).

Runner flags
  --mode <parallel|sequential>
        parallel:   per-worker DBs + parallel test files (default).
        sequential: single shared DB, one worker.
  Two axes (see "WASM semantics" above for the split):
    Axis 1 — participation (which cells RUN; these only EXCLUDE):
  --run-versions <all|newest>
        all:    every version under test/db/<db>/* runs (default).
        newest: only `<db>/newest/*` + `<db>/types.negative/*` cells run;
                older versions are NOT executed at all. A post-filter on
                the coords — it excludes, it does not mock.
  --run-connectors <all|docker|wasm|native>
        Which connector KINDS run. all (default) | docker (pg, postgres,
        bun_sql_postgres, mariadb, mysql2, oracledb, mssql) | wasm (pglite,
        sqlite-wasm-OO1) | native (better-sqlite3, bun_sqlite, node_sqlite,
        sqlite3). A pure path filter: EXCLUDES the other kinds from the run
        (does NOT mock them). `types.negative/` folders are dialect-level
        and dropped under any non-all filter. Mirrors RealDbBackend in
        test/lib/backends.ts.
    Axis 2 — real/mock (what's REAL among what runs). Each takes EITHER one
    literal all|none|newest OR a single <coord> (same coord rules); bare = all.
    Two things to know about the coord form:
      • One token per flag. To target several cells, REPEAT the flag —
        `--docker a --docker b`, NOT `--docker a b`. Each flag swallows only
        the next token; any extra space-separated coord falls through to the
        POSITIONAL coords (Axis 1 participation), silently narrowing the run
        instead of marking another cell real.
      • Cell-level granularity. The real/mock gate keys on the cell
        <db>/<version>/<connector>, so a 4th-level <file> coord is REJECTED
        with an error (it would add no granularity — the whole cell is the
        unit). Drop the file segment: `--docker postgres/newest/pg`, not
        `--docker postgres/newest/pg/x.test.ts`. (Positional Axis-1 coords
        still accept the <file> level — that narrows which tests RUN.)
      Mixing a literal with a coord (`--docker all postgres/newest/pg`) is an
      error; a coord matching no running cell of this kind warns as a no-op.
  --docker [all|none|newest|<coord>]
        Which docker-backed cells hit a real container; the rest run mock.
        bare/all = every docker cell real; none = all mock; newest = only
        <db>/newest/* docker cells real; <coord> = only the matching docker
        cell(s) real (repeat the flag for more). Default none.
  --wasm [all|none|newest|<coord>]
        Same vocabulary for the WASM cells. Default none. When real on the
        full matrix, WASM runs in its own sequential phase (see above).
  --native [all|none|newest|<coord>]
        Same vocabulary for the native SQLite drivers. Default all (real).
        `--native none` routes them through the mock — the cheap way to
        make a run fully mock.
  Engine / runtime controls (neither axis — they pick the container
  lifecycle and the runtime, not which cells run or which are real):
  --docker-mode <reuse|no-reuse>
        reuse:    sets TESTCONTAINERS_REUSE_ENABLE=true. Containers
                  persist across invocations — preferred for local dev.
        no-reuse: fresh containers every run. Hermetic; CI baseline.
  --use-vitest
        Force vitest even if invoked via `bun run`. The test process
        runs under Node; vitest's richer V8 coverage and full
        reporter set become available.
  --ui
        Launch @vitest/ui (browser-based interactive UI for test
        results + coverage navigation). Implies --use-vitest. Only
        meaningful interactively; vitest keeps the UI server alive
        until you Ctrl+C.

Report flags (test-execution report)
  --report
        Emit a test-execution report. Output lands under
        .test-report/: under vitest the html SPA lives at
        .test-report/index.html (see vitest.config.ts's
        `outputFile.html`); under bun the junit XML lives at
        .test-report/junit.xml. Independent from --coverage: you
        can have either, both, or neither.
  --report-format <name>
        Repeatable. Default depends on runtime — `html` under
        vitest, `junit` under bun. Setting any --report-format
        implies --report.
        Under vitest, pass-through to `--reporter`. Common values:
        html (browseable SPA at .test-report/index.html — needs
        `bunx vite preview` because the page fetches metadata),
        default, verbose, dot, tap, tap-flat, junit, json, tree,
        github-actions.
        Under bun, only `junit` (file at .test-report/junit.xml)
        and `dot`/`dots` (terminal-only compact progress) are
        supported. `dot` and `dots` are accepted interchangeably and
        normalised to the runner's own name (bun: dots, vitest: dot).
        Other values — including `html` — error out and prompt for
        --use-vitest.

Coverage flags
  --coverage
        Emit a code coverage report under .test-report/coverage/.
        When set, the two-phase WASM split is bypassed — a single
        runner invocation covers the whole matrix in one shot so
        the report stays a single artifact. Forbidden combo:
        --coverage + --wasm + --mode parallel; use --mode sequential
        or drop one of the flags.
  --coverage-format <name>
        Repeatable. Default `html` when --coverage is on. Under
        vitest, every @vitest/coverage-v8 reporter is supported
        (html, text, text-summary, lcov, lcovonly, clover,
        cobertura, json, json-summary, teamcity). Under bun,
        restricted to `html|text|lcov|monocart` (multiple values
        are honoured — bun's --coverage-reporter is repeatable).
        Other formats error out. The special `monocart` value
        opts into monocart-coverage-reports — under vitest it
        switches the provider to vitest-monocart-coverage for
        native V8 byte-range coverage; under bun it post-renders
        bun's lcov.info through MCR for an html-spa.
        Mutually-exclusive pairings (monocart + html under bun,
        monocart + anything else under vitest) error out so
        you don't get a half-rendered report.

        Scope (which source files end up in the report) is set in
        bunfig.toml and vitest.config.ts — both exclude
        `src/examples/**` and `test/**` by default. To narrow scope
        for a specific cell, prefer `tests <coord>`; to alter
        the project defaults, edit those config files.

Narrowing flags (runtime-agnostic — translated for you)
  --update-snapshots
        Refresh snapshots for the tests this run actually executes.
        Translated to bun's `--update-snapshots` or vitest's `--update`
        for you — same spelling under both runtimes, and no SECOND `--`
        to forward it through (under npm it just needs the usual single
        `--` separator every script flag does). Combine with a coord
        and/or --test-name-pattern to refresh just the tests you mean —
        unscoped over the full matrix it rewrites every snapshot (the
        script warns in that case but still proceeds).
  --test-name-pattern <regex>
        Run only the tests whose name matches <regex>, composed with
        the path filter. Translated to bun's `--test-name-pattern` or
        vitest's `--testNamePattern`. Canonical "fix one test's
        snapshot" recipe (same flags under bun and npm — npm just adds
        its single `--` before the script flags):
          bun run tests postgres/newest/pg/select.basic.test.ts \
                        --test-name-pattern inner-join --update-snapshots
          npm run tests -- postgres/newest/pg/select.basic.test.ts \
                           --test-name-pattern inner-join --update-snapshots
  --bail [<N>]
        Stop the run after N test failures (default 1 when no count is
        given). Saves wall-time in the iterate-on-one-cell loop: a
        broken canonical aborts immediately instead of waiting for the
        rest of the cell. Emitted as `--bail=N`, accepted verbatim by
        both bun and vitest. `--bail 0` is rejected (use no flag at all
        to disable bailing).
  --timeout <ms>
        Override the per-test timeout (positive integer, milliseconds).
        Translated to bun's `--timeout` / vitest's `--testTimeout`.
        Defaults to 60000 (the value baked into the runner config) when
        omitted. Raise it to debug a slow docker-backed cell, or lower
        it to fail-fast on a suspected hang instead of waiting 60s.
        `--timeout 0` is rejected.
  --no-color
        Strip ANSI colors from the output (sets NO_COLOR=1, honoured by
        both runtimes). Keeps agent transcripts and `grep`/`tail`
        pipelines clean; also suppresses the color re-injection the
        WASM-phase replay would otherwise do on a TTY.

Listing flags (enumerate, don't run — mutually exclusive)
  --list-cells
        Print the connector-level cells
        (test/db/<db>/<version>/<connector>) the current
        coords/--run-versions/--run-connectors select — one per line, sorted —
        then exit WITHOUT running anything. Runner-free and
        deterministic; a drop-in for the hand-rolled `for db in
        test/db/*/…` inventory loop. Honours every path filter for free
        (it lists exactly what a real run would visit at cell level).
          tests --list-cells                       # every active cell
          tests postgres --run-versions newest --list-cells
          tests --run-connectors native --list-cells
  --list-cells-with-mode [running|all|real|mock|skipped]
        Annotate cells with their mode under the CURRENT flags. Unlike
        --list-cells (which lists only the selection), this considers the
        WHOLE matrix and gives every cell a verdict + reason:
          real     `(docker|wasm|native)` — brings up a real engine.
          mock     runs against the mock, with why its kind's selection
                   didn't include it: `(<kind>; needs --docker/--wasm)`,
                   `(docker; --docker newest skips <version>)`, or
                   `(<kind>; not in --<kind> coords)`.
          skipped  off — EXCLUDED FROM THE RUN (the runner never sees
                   it), with the reason: `(not selected: outside
                   coords)`, `(excluded by --run-connectors <type>)`, or
                   `(excluded by --run-versions newest)`.
        The optional filter selects which verdicts to print:
          running  (default) the cells that run a body: real + mock.
          all      the whole matrix, including the off (skipped) ones.
          real     only cells that bring up a real engine.
          mock     only cells running against the mock.
          skipped  only the off cells (any skip reason).
        A footer tallies the running cells (real + mock) and, separately,
        the OTHER cells that are skipped — independent of the filter:
        `-- 3 running cells: 3 real, 0 mock; 14 other cells skipped`.
        The real/mock projection mirrors isRealDbEnabled() in
        test/lib/backends.ts.
          tests --docker --list-cells-with-mode          # what runs real vs mock
          tests --docker --wasm --list-cells-with-mode real   # only the real cells
          tests --docker --list-cells-with-mode mock     # what's still on the mock
          tests postgres/newest --list-cells-with-mode all    # whole matrix, why each is off
  --list-files
        Print the `*.test.ts` files the current selection would run — one
        per line, sorted — then exit WITHOUT running anything. Like
        --list-cells it's a runner-free filesystem walk (runtime-agnostic,
        no vitest needed), just at file granularity: the level you
        copy-bake during propagation. The glob mirrors the runner's
        include (`test/**/*.test.ts`), so the output matches the files a
        real run would visit — including in-scope `types.negative/` files.
          tests postgres/newest/pg --list-files    # the 166 files in one cell
          tests --run-connectors native --list-files
  --list-tests
        Print the test NAMES the current selection would run (one full
        `file > describe > test` name per line), then exit without
        running them. Useful to review what already exists before
        deciding where to add coverage, or to preview which tests a
        --test-name-pattern matches.
        VITEST-BACKED BY DESIGN: bun has no collect-only mode, so this
        always uses `vitest list` regardless of how the script was
        invoked — the one flag in this family that is not
        runtime-agnostic. Collection imports the test files and
        evaluates their describe/test registration but NOT the test
        bodies or beforeAll hooks, so no real DB is bootstrapped.
        Honours the coord/--run-versions/--run-connectors path filter and
        --test-name-pattern; pass `-- --json` for machine-readable
        output.
          tests postgres/newest/pg --list-tests
          tests postgres/newest/pg --list-tests --test-name-pattern inner-join
          tests sqlite/newest --run-connectors native --list-tests -- --json

Run-summary flag
  --validation-summary [running|all|real|mock|skipped]
        After a normal run finishes, print the same annotated block
        `--list-cells-with-mode` would produce with the same flags —
        i.e. which cells were validated against a REAL engine vs only
        the MOCK this run. Answers the "mock-validated vs real-validated"
        question when closing a coverage round. Takes the same optional
        filter as --list-cells-with-mode (running = what ran, default;
        all = also the skipped ones; real / mock / skipped = only that
        mode). Default off. Mutually exclusive with the terminal listing
        actions (they exit before any run).
          tests --docker --validation-summary           # full matrix + breakdown
          tests postgres/newest/pg --docker --validation-summary real

Browser flag
  --open
        Open the generated HTML report in the default browser when
        the run succeeds. Picks the richest output:
          1. .test-report/index.html (from --report-format=html) is
             served via `bunx vite preview` (the page is a SPA that
             needs HTTP). The server blocks until Ctrl+C.
          2. .test-report/coverage/index.html (from
             --coverage-format=html) is opened via file://.
        Requires `html` in --report-format or --coverage-format.
        To re-open a previously generated report without re-running
        tests, use `tests:reopen` (alias `coverage:reopen`).
        Mostly redundant with --ui, which opens its own browser tab
        serving live coverage.

  -h, --help
        Show this help and exit.

Pass-through args
  Anything after `--` is forwarded verbatim to the test runner. Prefer
  the first-class --test-name-pattern / --update-snapshots flags above
  for the common cases — they are runtime-agnostic and avoid the `--`
  dance. Use pass-through only for runner-specific flags the script
  doesn't wrap.

  bun run tests -- --rerun-each 3                  # bun-only runner flag
  npm  run tests -- -- --bail 1                     # vitest-only runner flag

  (npm strips a leading `--`, hence the double `--` when forwarding
  flags through npm run.)

Examples
  bun run tests                                            # fast loop
  bun run tests --docker                                   # + docker
  bun run tests --docker --wasm                            # full matrix
  bun run tests --run-versions newest                             # skip oldest cells
  bun run tests --coverage --run-versions newest --open           # shorter coverage
  bun run tests --run-connectors wasm --wasm                  # only WASM cells (real)
  bun run tests --run-connectors docker --docker              # only docker-backed cells
  bun run tests --run-connectors native                       # only embedded SQLite
  bun run tests postgres/newest/pg                         # focused: one cell
  bun run tests postgres/newest/pg --test-name-pattern inner-join
                                                           # focused: one cell + test-name regex
  bun run tests postgres/newest/pg/select.basic.test.ts \
                --test-name-pattern inner-join --update-snapshots
                                                           # refresh one test's snapshot
  bun run tests postgres/newest/pg --docker --bail         # stop at first failure
  bun run tests --list-cells                               # enumerate active cells, no run
  bun run tests postgres --run-versions newest --list-cells       # cells a propagation would touch
  bun run tests postgres/newest/pg --list-files            # enumerate test files (filesystem)
  bun run tests postgres/newest/pg --list-tests            # enumerate test names (vitest-backed)
  bun run tests --docker --list-cells-with-mode            # which cells run real vs mock
  bun run tests --docker --wasm --list-cells-with-mode real # only the cells that go real
  bun run tests --docker --validation-summary              # run + real/mock breakdown at the end
  bun run tests 'postgres/*/pg' --docker                   # focused: glob
  bun run tests 'postgres/*/{pg,postgres}' --docker --run-versions newest
                                                           # focused: glob + brace + scope
  bun run tests --report                                   # bun → junit.xml
  bun run tests --coverage --coverage-format=html --open   # bun coverage html
  bun run tests --use-vitest --report --open               # vitest html SPA
  bun run tests --use-vitest --coverage --open             # vitest coverage html
  bun run tests --use-vitest --report --coverage --open    # both, vite preview
  bun run tests --use-vitest --coverage \
                --coverage-format=html --coverage-format=lcov \
                --coverage-format=json-summary             # multi-format
  bun run tests --use-vitest --ui --coverage --docker      # interactive UI
  bun run tests --use-vitest --report-format=verbose       # verbose test output
  bun run tests --coverage --coverage-format=monocart --open
                                                           # bun → MCR html-spa
  bun run tests --use-vitest --coverage \
                --coverage-format=monocart --open          # vitest → MCR v8 SPA
EOF
}

COORDS=()
MODE=parallel
DOCKER_MODE=reuse
# Axis 1 — participation post-filters on the coordinate set (what RUNS).
RUN_VERSIONS=all      # was --run-versions
RUN_CONNECTORS=all    # was --run-connectors
# Axis 2 — real/mock selection per backend kind (what's REAL among what runs).
# Each flag (--docker/--wasm/--native) accumulates tokens: a literal
# all|none|newest, or coords (same coord rules). Resolved later into a
# mode + cell-set per kind, then exported as TS_SQL_QUERY_DOCKER/WASM/NATIVE.
DOCKER_TOKENS=()
WASM_TOKENS=()
NATIVE_TOKENS=()
USE_VITEST=off
UI=off
REPORT=off
REPORT_FORMAT=()
COVERAGE=off
COVERAGE_FORMAT=()
OPEN_AFTER=off
UPDATE_SNAPSHOTS=off
TEST_NAME_PATTERN=
# Empty sentinel: distinguishes "no --bail" from "--bail with a count".
# `--bail` alone resolves to 1 below.
BAIL=
NO_COLOR_FLAG=off
LIST_CELLS=off
LIST_FILES=off
LIST_TESTS=off
# Empty sentinel: "no --list-cells-with-mode". Resolves to `all` or `real`
# (the cell filter) when the flag is present. A terminal listing action
# like --list-cells, but each cell is annotated with its real/mock mode
# under the current flags.
LIST_CELLS_WITH_MODE=
# Empty sentinel: "no --validation-summary". `all` or `real` when present;
# prints the same annotated block after a normal run finishes.
VAL_SUMMARY=
# Empty sentinel: "user didn't pass --timeout". Resolves to the 60000ms
# default (the value run_phase otherwise hardcodes) when left empty.
TIMEOUT=
EXTRA_ARGS=()

while [ $# -gt 0 ]; do
    case "$1" in
        --mode)                 MODE="$2"; shift 2 ;;
        --mode=*)               MODE="${1#--mode=}"; shift ;;
        --docker-mode)          DOCKER_MODE="$2"; shift 2 ;;
        --docker-mode=*)        DOCKER_MODE="${1#--docker-mode=}"; shift ;;
        --run-versions)         RUN_VERSIONS="$2"; shift 2 ;;
        --run-versions=*)       RUN_VERSIONS="${1#--run-versions=}"; shift ;;
        --run-connectors)       RUN_CONNECTORS="$2"; shift 2 ;;
        --run-connectors=*)     RUN_CONNECTORS="${1#--run-connectors=}"; shift ;;
        # Axis 2: each takes an optional value — a literal all|none|newest or
        # a coord. Bare (next is a flag or end) means `all`. Repeatable to
        # pass multiple coords. The lookahead consumes the next token unless
        # it's another flag, so `--docker postgres/newest/pg` works and
        # `--docker --wasm` leaves --wasm alone.
        --docker)
            case "${2:-}" in ''|-*) DOCKER_TOKENS+=(all); shift ;; *) DOCKER_TOKENS+=("$2"); shift 2 ;; esac ;;
        --docker=*)             DOCKER_TOKENS+=("${1#--docker=}"); shift ;;
        --wasm)
            case "${2:-}" in ''|-*) WASM_TOKENS+=(all); shift ;; *) WASM_TOKENS+=("$2"); shift 2 ;; esac ;;
        --wasm=*)               WASM_TOKENS+=("${1#--wasm=}"); shift ;;
        --native)
            case "${2:-}" in ''|-*) NATIVE_TOKENS+=(all); shift ;; *) NATIVE_TOKENS+=("$2"); shift 2 ;; esac ;;
        --native=*)             NATIVE_TOKENS+=("${1#--native=}"); shift ;;
        --use-vitest)           USE_VITEST=on; shift ;;
        --ui)                   UI=on; USE_VITEST=on; shift ;;
        --report)               REPORT=on; shift ;;
        --report-format)        REPORT=on; REPORT_FORMAT+=("$2"); shift 2 ;;
        --report-format=*)      REPORT=on; REPORT_FORMAT+=("${1#--report-format=}"); shift ;;
        --coverage)             COVERAGE=on; shift ;;
        --coverage-format)      COVERAGE_FORMAT+=("$2"); shift 2 ;;
        --coverage-format=*)    COVERAGE_FORMAT+=("${1#--coverage-format=}"); shift ;;
        --open)                 OPEN_AFTER=on; shift ;;
        --update-snapshots)     UPDATE_SNAPSHOTS=on; shift ;;
        --test-name-pattern)    TEST_NAME_PATTERN="$2"; shift 2 ;;
        --test-name-pattern=*)  TEST_NAME_PATTERN="${1#--test-name-pattern=}"; shift ;;
        --bail)
            # Optional count: `--bail` alone → 1; `--bail 3` consumes the
            # next arg only when it's a bare integer (so `--bail --docker`
            # keeps --docker as a flag).
            case "${2:-}" in
                ''|*[!0-9]*)    BAIL=1; shift ;;
                *)              BAIL="$2"; shift 2 ;;
            esac ;;
        --bail=*)               BAIL="${1#--bail=}"; shift ;;
        --timeout)              TIMEOUT="$2"; shift 2 ;;
        --timeout=*)            TIMEOUT="${1#--timeout=}"; shift ;;
        --no-color)             NO_COLOR_FLAG=on; shift ;;
        --list-cells)           LIST_CELLS=on; shift ;;
        --list-files)           LIST_FILES=on; shift ;;
        --list-tests)           LIST_TESTS=on; shift ;;
        --list-cells-with-mode)
            # Optional value: consume the next token only when it's a
            # valid filter (running|all|real|mock); otherwise default to
            # `running` and leave the token (it's a coord or another flag).
            # Mirrors --bail's bounded-set lookahead, so both `=real` and a
            # space-separated `real` work without swallowing a coord.
            case "${2:-}" in
                running|all|real|mock|skipped)  LIST_CELLS_WITH_MODE="$2"; shift 2 ;;
                *)                              LIST_CELLS_WITH_MODE=running; shift ;;
            esac ;;
        --list-cells-with-mode=*) LIST_CELLS_WITH_MODE="${1#--list-cells-with-mode=}"; shift ;;
        --validation-summary)
            case "${2:-}" in
                running|all|real|mock|skipped)  VAL_SUMMARY="$2"; shift 2 ;;
                *)                              VAL_SUMMARY=running; shift ;;
            esac ;;
        --validation-summary=*) VAL_SUMMARY="${1#--validation-summary=}"; shift ;;
        -h|--help)              print_help; exit 0 ;;
        --)                     shift; EXTRA_ARGS=("$@"); break ;;
        --*)                    echo "Unknown argument: $1 (use --help)" >&2; exit 2 ;;
        *)
            # Any non-flag positional is a coord (focused run). N coords
            # accepted; each goes through the shape detection + expansion
            # below. With zero coords the script runs the full matrix
            # (the legacy `tests` behaviour).
            COORDS+=("$1")
            shift
            ;;
    esac
done

# Tracks whether the user gave us positional coords. The two flow
# decisions hang off this: which paths the runner sees (MAIN_PATHS
# vs coord-expanded TARGETS) and whether `--wasm` triggers the
# two-phase split (full-matrix only) or a single-pass override
# (focused mode).
if [ "${#COORDS[@]}" -gt 0 ]; then FOCUSED=on; else FOCUSED=off; fi

case "$MODE" in parallel|sequential) ;; *)
    echo "Invalid --mode: $MODE (expected parallel|sequential)" >&2; exit 2 ;;
esac
case "$DOCKER_MODE" in reuse|no-reuse) ;; *)
    echo "Invalid --docker-mode: $DOCKER_MODE (expected reuse|no-reuse)" >&2; exit 2 ;;
esac
case "$RUN_VERSIONS" in all|newest) ;; *)
    echo "Invalid --run-versions: $RUN_VERSIONS (expected all|newest)" >&2; exit 2 ;;
esac
case "$RUN_CONNECTORS" in all|docker|wasm|native) ;; *)
    echo "Invalid --run-connectors: $RUN_CONNECTORS (expected all|docker|wasm|native)" >&2; exit 2 ;;
esac
if [ -n "$BAIL" ]; then
    case "$BAIL" in
        ''|*[!0-9]*|0)  echo "Invalid --bail: $BAIL (expected a positive integer; bare --bail means 1)" >&2; exit 2 ;;
    esac
fi
if [ -n "$TIMEOUT" ]; then
    case "$TIMEOUT" in
        ''|*[!0-9]*|0)  echo "Invalid --timeout: $TIMEOUT (expected a positive integer, milliseconds)" >&2; exit 2 ;;
    esac
fi
case "$LIST_CELLS_WITH_MODE" in ''|running|all|real|mock|skipped) ;; *)
    echo "Invalid --list-cells-with-mode: $LIST_CELLS_WITH_MODE (expected running|all|real|mock|skipped)" >&2; exit 2 ;;
esac
case "$VAL_SUMMARY" in ''|running|all|real|mock|skipped) ;; *)
    echo "Invalid --validation-summary: $VAL_SUMMARY (expected running|all|real|mock|skipped)" >&2; exit 2 ;;
esac

# --list-cells / --list-cells-with-mode / --list-files / --list-tests are
# all terminal listing actions (enumerate and exit). At most one may be
# passed.
_list_count=0
[ "$LIST_CELLS" = "on" ]          && _list_count=$((_list_count + 1))
[ -n "$LIST_CELLS_WITH_MODE" ]    && _list_count=$((_list_count + 1))
[ "$LIST_FILES" = "on" ]          && _list_count=$((_list_count + 1))
[ "$LIST_TESTS" = "on" ]          && _list_count=$((_list_count + 1))
if [ "$_list_count" -gt 1 ]; then
    echo "Error: --list-cells, --list-cells-with-mode, --list-files and --list-tests are mutually exclusive terminal listing actions; pass only one." >&2
    exit 2
fi
# --validation-summary runs AFTER a normal run; the terminal listing
# actions exit before any run, so combining them is a contradiction.
if [ -n "$VAL_SUMMARY" ] && [ "$_list_count" -gt 0 ]; then
    echo "Error: --validation-summary prints after a run; it can't be combined with a terminal listing action (--list-cells/--list-cells-with-mode/--list-files/--list-tests)." >&2
    echo "  For just the annotated block without running, use: --list-cells-with-mode${VAL_SUMMARY:+ $VAL_SUMMARY}" >&2
    exit 2
fi
# run_phase reads this global for the per-test timeout (bun's --timeout /
# vitest's --testTimeout). Empty --timeout falls back to the 60000ms
# default that matches vitest.config.ts's testTimeout.
TEST_TIMEOUT_MS="${TIMEOUT:-60000}"

# Resolve MAIN_PATHS (and WASM_LIST in full-matrix mode) from
# COORDS / RUN_VERSIONS / FOCUSED. Full implementation + edge cases live
# in `resolve_main_paths` in _test-common.sh.
resolve_main_paths || exit $?

# Narrow MAIN_PATHS to the requested connector type. Broad paths
# (test/, test/db/<db>/, …) get expanded to their typed connector
# children. `types.negative/` is dropped under any non-all filter.
# Helper exits non-zero when the filter empties the set.
if ! apply_connection_type_filter "$RUN_CONNECTORS"; then
    echo "Error: --run-connectors $RUN_CONNECTORS left no paths to run." >&2
    exit 2
fi

# Axis 2 — resolve each kind's real/mock selection from its --docker/--wasm/
# --native tokens into a mode (+ cell-set when coords were given). Defaults:
# docker/wasm = none (mock), native = all (real). resolve_kind_real sets
# REAL_MODE / REAL_CELLS and warns on no-op (coords that match no running
# cell of that kind). Lives in _test-common.sh.
resolve_kind_real docker none "${DOCKER_TOKENS[@]}" || exit $?
DOCKER_MODE_SEL="$REAL_MODE"; DOCKER_CELLS="$REAL_CELLS"
resolve_kind_real wasm none "${WASM_TOKENS[@]}" || exit $?
WASM_MODE_SEL="$REAL_MODE"; WASM_CELLS="$REAL_CELLS"
resolve_kind_real native all "${NATIVE_TOKENS[@]}" || exit $?
NATIVE_MODE_SEL="$REAL_MODE"; NATIVE_CELLS="$REAL_CELLS"

# --list-cells: print the connector-level cells the current
# coords/scope/connections select, one per line, then exit without
# running anything. Deterministic, runner-free — a tested replacement
# for the hand-rolled `for db in test/db/*/…` inventory loop. MAIN_PATHS
# is already coord/scope/connection-filtered, so the listing honours all
# of those for free.
if [ -n "$LIST_CELLS_WITH_MODE" ]; then
    # Cell listing annotated with each cell's real/mock/skipped mode under
    # the current flags, filtered by --list-cells-with-mode's value
    # (running|all|real|mock|skipped).
    list_cells_with_mode "$LIST_CELLS_WITH_MODE"
    exit $?
fi
if [ "$LIST_CELLS" = "on" ]; then
    list_cells_from_main_paths
    exit $?
fi

# --list-files: print the *.test.ts files the current selection would run,
# one per line, then exit. Like --list-cells it's a runner-free filesystem
# walk (so it stays runtime-agnostic and works without vitest), just at
# file granularity — the level you copy-bake during propagation. The glob
# mirrors the runner's include, so MAIN_PATHS' scope/connection filtering
# carries straight through.
if [ "$LIST_FILES" = "on" ]; then
    list_files_from_main_paths
    exit $?
fi

# --list-tests: enumerate the test NAMES the current selection would run,
# without running them, then exit. Unlike --list-cells (a filesystem walk),
# this needs a runner to collect test names — and bun has no collect-only
# mode, so this is vitest-backed by design: it always uses `vitest list`
# regardless of how the script was invoked. Collection imports the test
# files and evaluates their describe/test registration but NOT the test
# bodies or beforeAll hooks, so no real DB is bootstrapped. Honours the
# coord/scope/connection path filter (MAIN_PATHS) and --test-name-pattern;
# extra runner args after `--` pass through (e.g. `--json` for parsing).
if [ "$LIST_TESTS" = "on" ]; then
    if [ "$NO_COLOR_FLAG" = "on" ]; then export NO_COLOR=1; fi
    list_args=()
    if [ -n "$TEST_NAME_PATTERN" ]; then list_args+=(--testNamePattern "$TEST_NAME_PATTERN"); fi
    vitest list "${MAIN_PATHS[@]}" "${list_args[@]}" "${EXTRA_ARGS[@]}"
    exit $?
fi

runtime="$(detect_runtime)"
if [ "$USE_VITEST" = "on" ]; then runtime="npm"; fi

# Translate the two narrowing knobs (--update-snapshots /
# --test-name-pattern) into the active runner's spelling. These are
# first-class script flags precisely so the docs describe ONE path:
# the user never has to know bun says `--update-snapshots`/`-t` while
# vitest says `--update`/`--testNamePattern`, nor wrestle with npm's
# `-- --` pass-through dance. Built once here (after the runtime is
# settled) and appended to every runner invocation below — the coverage
# branch's COV_FLAGS and the non-coverage RUNNER_TAIL (which covers both
# the WASM and main phases).
NARROWING_FLAGS=()
if [ "$UPDATE_SNAPSHOTS" = "on" ] || [ -n "$TEST_NAME_PATTERN" ]; then
    NARROW_OUT="$(narrowing_runner_flags "$runtime" "$UPDATE_SNAPSHOTS" "$TEST_NAME_PATTERN")" || exit 2
    while IFS= read -r flag; do
        if [ -n "$flag" ]; then NARROWING_FLAGS+=("$flag"); fi
    done <<<"$NARROW_OUT"
fi
# --bail rides along the same way. `--bail=N` is accepted verbatim by
# both bun (`--bail=<val>`) and vitest (`--bail <number>` / `=N`), so no
# per-runtime translation is needed — only the empty→1 default already
# resolved at parse time.
if [ -n "$BAIL" ]; then NARROWING_FLAGS+=("--bail=$BAIL"); fi

# Soft guard: refreshing snapshots across the WHOLE matrix (no coord,
# no name filter) rewrites every snapshot in ~2.5k files at once — almost
# never what's intended. Warn but proceed, so deliberate mass-regeneration
# still works. A coord OR --test-name-pattern scopes the refresh and
# silences this.
if [ "$UPDATE_SNAPSHOTS" = "on" ] && [ "$FOCUSED" = "off" ] && [ -z "$TEST_NAME_PATTERN" ]; then
    echo "Warning: --update-snapshots over the full matrix will rewrite every snapshot." >&2
    echo "  Scope it with a coord (e.g. 'tests postgres/newest/pg …') or" >&2
    echo "  --test-name-pattern <regex> to refresh only the tests you mean." >&2
fi

# --no-color: NO_COLOR=1 is honoured by both bun and vitest (and most of
# the libraries underneath), so one env export covers both runtimes and
# also keeps the WASM-phase replay plain-text. The FORCE_COLOR /
# CLICOLOR_FORCE re-injection in the WASM tee below is gated on this so
# the two don't fight.
if [ "$NO_COLOR_FLAG" = "on" ]; then export NO_COLOR=1; fi

# Per-kind env strings the runtime gate (backends.ts) reads: all|none|newest
# or a comma list of <db>/<version>/<connector> cell keys. docker + native
# apply to every phase; wasm is set per-phase below (it runs real in its own
# sequential unit when the two-phase split fires).
DOCKER_ENV="$(kind_env_value "$DOCKER_MODE_SEL" "$DOCKER_CELLS")"
WASM_ENV="$(kind_env_value "$WASM_MODE_SEL" "$WASM_CELLS")"
NATIVE_ENV="$(kind_env_value "$NATIVE_MODE_SEL" "$NATIVE_CELLS")"
# Whether any WASM cell goes real — drives the two-phase split + forbidden combo.
WASM_REAL=off; [ "$WASM_MODE_SEL" != "none" ] && WASM_REAL=on
export TS_SQL_QUERY_DOCKER="$DOCKER_ENV"
export TS_SQL_QUERY_NATIVE="$NATIVE_ENV"
if [ "$DOCKER_MODE" = "reuse" ]; then export TESTCONTAINERS_REUSE_ENABLE=true; fi

# Docker preflight + warmup (reuse mode only). Before the parallel pass kicks
# every engine into a simultaneous cold start — a memory spike that OOM-kills
# the biggest container on an under-provisioned host and cascades into dozens
# of spurious "Failed to connect" / pool-exhaustion / hook-timeout failures —
# check the host's memory budget and bring the needed containers up ONE AT A
# TIME. Only meaningful in reuse mode: a container started in the preflight
# survives to the workers solely because reusable containers are exempt from
# Ryuk reaping (under no-reuse it would be reaped at the preflight's exit).
# Gated on at least one real docker cell in the selection. Exit code 3 means
# the strict resource check blocked the run; anything else is best-effort and
# non-fatal (the lazy per-cell acquire retries).
if [ "$DOCKER_MODE" = "reuse" ] && [ "$DOCKER_MODE_SEL" != "none" ]; then
    WARMUP_REPS=()
    while IFS= read -r _rep; do
        [ -n "$_rep" ] && WARMUP_REPS+=("$_rep")
    done < <(real_docker_rep_cells)
    if [ "${#WARMUP_REPS[@]}" -gt 0 ]; then
        warmup_docker_engines "$runtime" "${WARMUP_REPS[@]}"
        _wec=$?
        if [ "$_wec" -eq 3 ]; then exit 3; fi
    fi
fi

# Fill in runtime-aware defaults for REPORT_FORMAT / COVERAGE_FORMAT
# (and inject `default` alongside html under vitest so the user
# isn't left staring at a silent prompt during the SPA boot).
# Validate --open is paired with a renderable html target. Both
# routines live in _test-common.sh.
resolve_runner_format_defaults
validate_open_request || exit $?

# Forbidden combo: parallel + wasm + coverage. Coverage merging across
# the two-phase WASM split is fragile, and parallel workers further
# compound the problem (each worker emits its own shard, two phases =
# 2N shards). Forcing the user to choose keeps the report a single
# coherent artifact.
if [ "$COVERAGE" = "on" ] && [ "$WASM_REAL" = "on" ] && [ "$MODE" = "parallel" ]; then
    echo "Error: --coverage cannot be combined with real --wasm under --mode parallel." >&2
    echo "  Reason: coverage requires a single runner invocation. With --wasm" >&2
    echo "  in parallel mode the matrix splits into two phases (real WASM," >&2
    echo "  sequential + main parallel mocked), and the two coverage outputs" >&2
    echo "  can't be merged reliably." >&2
    echo "  Fix: pass --mode sequential, drop --wasm, or drop --coverage." >&2
    exit 2
fi

# Wipe .test-report/ when generating either report so each run starts
# clean. Done early enough that both the coverage-mode branch below
# and the standard flow share the same clean slate.
if [ "$REPORT" = "on" ] || [ "$COVERAGE" = "on" ]; then
    clean_report_dir
fi

# Coverage mode: single-pass run that covers the whole matrix in one
# go. The two-phase WASM split is bypassed because per-runner coverage
# merging across multiple invocations is fragile. With --wasm under
# sequential mode the WASM cells run with the real module inside this
# same single pass (no contention since serial).
if [ "$COVERAGE" = "on" ]; then
    # Single pass — wasm runs real per its resolved selection (none if not
    # requested), no two-phase split.
    export TS_SQL_QUERY_WASM="$WASM_ENV"
    if [ "$MODE" = "sequential" ]; then
        export TSSQLQUERY_PARALLEL_DBS=false
    fi

    COV_FLAGS=()
    COV_RUNNER_OUT="$(coverage_runner_flags "$runtime" "${COVERAGE_FORMAT[@]}")" || exit 2
    while IFS= read -r flag; do COV_FLAGS+=("$flag"); done <<<"$COV_RUNNER_OUT"
    if [ "$REPORT" = "on" ]; then
        REP_RUNNER_OUT="$(report_runner_flags "$runtime" "${REPORT_FORMAT[@]}")" || exit 2
        while IFS= read -r flag; do
            if [ -n "$flag" ]; then COV_FLAGS+=("$flag"); fi
        done <<<"$REP_RUNNER_OUT"
    fi
    if [ "$runtime" = "npm" ] && [ "$UI" = "on" ]; then COV_FLAGS+=(--ui); fi
    COV_FLAGS+=("${NARROWING_FLAGS[@]}")

    run_phase "$runtime" "$MODE" "${MAIN_PATHS[@]}" --coverage "${COV_FLAGS[@]}" "${EXTRA_ARGS[@]}"
    ec=$?
    if [ "$ec" -eq 0 ]; then
        finalize_report "$runtime" "$OPEN_AFTER" "${COVERAGE_FORMAT[@]}" || true
    fi
    if [ "$FOCUSED" = "on" ]; then
        cov_label="Coverage run (focused: ${COORDS[*]})"
    else
        cov_label="Coverage run"
    fi
    emit_phase_legend "$cov_label" "$MODE" "$runtime" "$DOCKER_ENV" "$WASM_ENV" "$NATIVE_ENV" "$RUN_VERSIONS" "$RUN_CONNECTORS"
    if [ -n "$VAL_SUMMARY" ]; then
        echo ""
        echo "Validation summary (real/mock per cell under the current flags):"
        list_cells_with_mode "$VAL_SUMMARY" || true
    fi
    exit "$ec"
fi

# Non-coverage flow: optional WASM phase + main pass. Build the
# runner flag tail once (report + UI) so both phases get the same
# shape. The tail is no longer vitest-only — bun honours --report
# natively via report_runner_flags (junit / dots).
#
# NOTE: when --report and --wasm are both on the two phases share
# the same --reporter-outfile / html outputFile path, so the WASM
# phase's report artifact is overwritten by the main pass. The
# terminal output for both phases still scrolls past (and the WASM
# summary is re-emitted at the end), but the on-disk SPA / junit
# only reflects the final phase. Pair --report with --coverage if
# you need a single-pass report that covers everything (the
# coverage branch above already forces single-pass).
RUNNER_TAIL=()
if [ "$REPORT" = "on" ]; then
    REP_RUNNER_OUT="$(report_runner_flags "$runtime" "${REPORT_FORMAT[@]}")" || exit 2
    while IFS= read -r flag; do
        if [ -n "$flag" ]; then RUNNER_TAIL+=("$flag"); fi
    done <<<"$REP_RUNNER_OUT"
fi
if [ "$runtime" = "npm" ] && [ "$UI" = "on" ]; then RUNNER_TAIL+=(--ui); fi
# Snapshot refresh / test-name filter ride along on every phase (WASM +
# main) so a focused refresh hits whichever phase actually runs the cell.
RUNNER_TAIL+=("${NARROWING_FLAGS[@]}")

# Optional real-WASM phase (when --wasm is set). Runs FIRST so its
# output stays close to the top of the scrollback; the parallel main
# pass below would otherwise push it off-screen. We `tee` into a temp
# file so the summary can be re-emitted after the main pass completes,
# keeping both phase summaries visible. Failures here short-circuit
# the main pass.
#
# Colors: bun:test and vitest both strip ANSI codes when stdout isn't
# a TTY (our `tee` pipe is one such case). We only re-inject
# FORCE_COLOR / CLICOLOR_FORCE when the PARENT stdout is a TTY — i.e.
# when the user is running interactively and the only reason colors
# would be lost is our internal pipe. In non-TTY contexts (CI, log
# capture, redirects) we leave the env as the caller had it, so the
# replayed summary stays plain-text rather than seeding ANSI escapes
# into a log file.
WASM_LOG=
MAIN_LOG=
# When running on GitHub Actions under bun, capture both phases so we
# can synthesise a job summary (bun ships no `github-actions` reporter;
# vitest auto-injects one). Outside Actions we only need WASM_LOG for
# the in-terminal replay.
__cleanup_test_logs() {
    [ -n "${WASM_LOG:-}" ] && rm -f "$WASM_LOG"
    [ -n "${MAIN_LOG:-}" ] && rm -f "$MAIN_LOG"
}
trap __cleanup_test_logs EXIT

# Two-phase WASM split fires only when:
#   - the matrix is full (FOCUSED=off), AND
#   - --run-connectors=all (otherwise either no WASM cells are in scope,
#     or every cell is WASM — a "main phase" would be empty or
#     redundant). Single pass handles both.
#   - WASM has at least one real cell (WASM_REAL=on).
# In every other case wasm is a single-pass: TS_SQL_QUERY_WASM is set to its
# resolved selection for the upcoming main pass below. The split keeps ALL
# wasm in its own sequential unit (unchanged), regardless of how granular the
# --wasm selection is.
if [ "$FOCUSED" = "off" ] && [ "$RUN_CONNECTORS" = "all" ] && [ "$WASM_REAL" = "on" ]; then
    if [ "${#WASM_LIST[@]}" -eq 0 ]; then
        echo "Error: --run-versions newest filtered every WASM cell. Drop --wasm or --run-versions newest." >&2
        exit 2
    fi
    WASM_LOG="$(mktemp)"
    export TS_SQL_QUERY_WASM="$WASM_ENV"
    export TSSQLQUERY_PARALLEL_DBS=false
    if [ -t 1 ] && [ "$NO_COLOR_FLAG" = "off" ]; then
        export FORCE_COLOR=1
        export CLICOLOR_FORCE=1
    fi
    run_phase "$runtime" sequential "${WASM_LIST[@]}" "${RUNNER_TAIL[@]}" "${EXTRA_ARGS[@]}" 2>&1 | tee "$WASM_LOG"
    ec=${PIPESTATUS[0]}
    if [ "$runtime" = "bun" ]; then
        emit_bun_github_summary "WASM phase" "$WASM_LOG"
    fi
    emit_phase_legend "WASM phase" sequential "$runtime" none "$WASM_ENV" none "$RUN_VERSIONS" "$RUN_CONNECTORS"
    if [ "$ec" -ne 0 ]; then exit "$ec"; fi
fi

# Main pass. TS_SQL_QUERY_WASM for this pass:
#   * wasm not real            → none (mock).
#   * wasm real, single-pass   → its resolved selection (focused, or
#                                --run-connectors != all: no split happened).
#   * wasm real, split fired   → none here (the sequential WASM unit above
#                                already ran the real wasm cells).
if [ "$WASM_REAL" = "on" ] && { [ "$FOCUSED" = "on" ] || [ "$RUN_CONNECTORS" != "all" ]; }; then
    MAIN_WASM_ENV="$WASM_ENV"
else
    MAIN_WASM_ENV=none
fi
export TS_SQL_QUERY_WASM="$MAIN_WASM_ENV"
if [ "$MODE" = "sequential" ]; then
    export TSSQLQUERY_PARALLEL_DBS=false
else
    unset TSSQLQUERY_PARALLEL_DBS
fi
if [ "$FOCUSED" = "on" ]; then
    main_label="Focused run: ${COORDS[*]}"
else
    main_label="Main phase"
fi
if [ "$runtime" = "bun" ] && [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    MAIN_LOG="$(mktemp)"
    run_phase "$runtime" "$MODE" "${MAIN_PATHS[@]}" "${RUNNER_TAIL[@]}" "${EXTRA_ARGS[@]}" 2>&1 | tee "$MAIN_LOG"
    ec=${PIPESTATUS[0]}
    emit_bun_github_summary "$main_label" "$MAIN_LOG"
else
    run_phase "$runtime" "$MODE" "${MAIN_PATHS[@]}" "${RUNNER_TAIL[@]}" "${EXTRA_ARGS[@]}"
    ec=$?
fi
emit_phase_legend "$main_label" "$MODE" "$runtime" "$DOCKER_ENV" "$MAIN_WASM_ENV" "$NATIVE_ENV" "$RUN_VERSIONS" "$RUN_CONNECTORS"

# Re-emit the saved WASM summary so the user sees both phases'
# headline numbers without having to scroll up. Last 4 lines covers
# the runner summary for both bun:test and vitest. The label says
# explicitly which phase the block belongs to — otherwise two
# back-to-back summary blocks look like the same run repeated.
if [ -n "$WASM_LOG" ] && [ -s "$WASM_LOG" ]; then
    echo ""
    echo "WASM phase results (ran first, replayed for visibility):"
    tail -n 4 "$WASM_LOG"
fi

# Validation summary: re-project each in-scope cell's real/mock mode under
# the current flags, so the user sees what was validated against a real
# engine vs only the mock. Independent of pass/fail.
if [ -n "$VAL_SUMMARY" ]; then
    echo ""
    echo "Validation summary (real/mock per cell under the current flags):"
    list_cells_with_mode "$VAL_SUMMARY" || true
fi

# In the non-coverage path we still need to open the report after a
# green run when --open was set (typically with --report).
if [ "$ec" -eq 0 ] && [ "$OPEN_AFTER" = "on" ]; then
    open_report_in_browser || true
fi
exit "$ec"
