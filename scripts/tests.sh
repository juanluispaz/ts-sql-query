#!/bin/bash
# Run the test/ matrix. See `tests --help` for details.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./_test-common.sh
. "$SCRIPT_DIR/_test-common.sh"

print_help() {
    cat <<'EOF'
Usage:
  tests [<coord>…] [--mode <parallel|sequential>]
                   [--docker] [--docker-mode <reuse|no-reuse>]
                   [--docker-scope <all|newest>]
                   [--scope <all|newest>]
                   [--connections <all|docker|wasm|native>]
                   [--wasm]
                   [--use-vitest] [--ui]
                   [--report    [--report-format <name>]…]
                   [--coverage  [--coverage-format <name>]…]
                   [--open]
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
                 folder — and is included only under --connections=all.
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

  Under --scope newest a coord that literally names oldest
  (`postgres/oldest`, `*/oldest/*`) is rejected as a contradiction;
  globs are expanded and any `*/oldest/*` matches are filtered out.

Runner trade-off
  Bun is fast and is the default for the daily test loop. Vitest is
  the RECOMMENDED path for the rich report stack — its coverage is
  V8-based (column-level) vs bun's lcov collapse, and the html
  test-execution SPA is vitest-only.
  Under bun:
    --report-format        junit (file) | dots (terminal). Default
                           is junit when --report is on. html is
                           rejected with an error — pass
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
  --docker           off (docker cells fall through to mock)
  --docker-mode      reuse  (containers stay alive between invocations)
  --docker-scope     all  (every docker cell hits its real DB);
                     follows --scope when --docker-scope was not given
                     explicitly (so `--scope newest` implies it too)
  --scope            all  (every cell under test/db/<db>/* runs)
  --connections      all  (every connector type runs)
  --wasm             off (WASM cells fall through to mock — modules are
                     never imported, so their bootstrap cost is paid
                     by nothing)
  --use-vitest       off (runtime detected from npm_config_user_agent)
  --ui               off (implies --use-vitest)
  --report           off (test-execution report)
  --report-format    html under vitest, junit under bun
  --coverage         off
  --coverage-format  html (when --coverage is on)
  --open             off

WASM semantics
  Full-matrix mode (no positional coords): the main pass ALWAYS runs
  WASM connectors (pglite, sqlite-wasm-OO1) as mocks. When --wasm is
  set, a sequential pass runs the WASM cells against the real module
  FIRST, then the parallel main pass runs; the WASM summary is
  re-emitted at the end so both phase summaries stay visible after
  the main pass scrolls. WASM failures short-circuit the main pass.
  This split keeps the parallel main pass fast — WASM is CPU-bound
  and tanks parallel throughput.

  Focused mode (one or more coords): --wasm is a single-pass
  override. The two-phase split is bypassed because focused runs are
  smaller and the user already chose what to run; we honour that
  verbatim and just set TS_SQL_QUERY_WASM=on for the one pass.

Runner flags
  --mode <parallel|sequential>
        parallel:   per-worker DBs + parallel test files (default).
        sequential: single shared DB, one worker.
  --docker
        Docker-backed connectors hit their real DB. Without it they
        run their SQL/params/type assertions against the mock.
  --docker-mode <reuse|no-reuse>
        reuse:    sets TESTCONTAINERS_REUSE_ENABLE=true. Containers
                  persist across invocations — preferred for local dev.
        no-reuse: fresh containers every run. Hermetic; CI baseline.
  --docker-scope <all|newest>
        all:    every docker-backed cell hits its real DB (default).
        newest: only cells under `<db>/newest/*` hit a real DB; older
                versions fall back to the mock. Faster smoke run that
                still catches most regressions. No-op without --docker.
                Analogous in shape to --wasm (a scope narrower than the
                full matrix); motivation is speed, not correctness.
                When --scope=newest and --docker-scope wasn't given
                explicitly, this defaults to `newest` too — running the
                real container for a version you don't even visit is
                wasted work.
  --scope <all|newest>
        all:    every cell under `test/db/<db>/*` runs (default).
        newest: filter the file set the runner visits to
                `<db>/newest/*` + `<db>/types.negative/*` (dialect-only
                typecheck cells stay in scope). Older versions are not
                executed at all — different from --docker-scope, which
                keeps the test running but flips the real/mock gate.
                Implies --docker-scope=newest unless the user passed
                --docker-scope explicitly. Useful for shortening
                coverage runs when older-version coverage is redundant
                with the matching newest cell.
  --connections <all|docker|wasm|native>
        all:    every connector type runs (default).
        docker: only docker-backed connectors (pg, postgres,
                bun_sql_postgres, mariadb, mysql2, oracledb, mssql).
        wasm:   only WASM connectors (pglite, sqlite-wasm-OO1).
        native: only embedded-native connectors that need no extra
                infrastructure to go real — today the SQLite drivers
                (better-sqlite3, bun_sqlite, node_sqlite, sqlite3).
                Mirrors the `RealDbBackend = 'docker'|'wasm'|'native'`
                type in test/lib/backends.ts.
        Pure path filter, like --scope: the runner is invoked only on
        cells whose connector folder matches the chosen type. Does
        NOT auto-imply --docker or --wasm — `--connections docker`
        without --docker runs docker cells mocked; `--connections
        wasm` without --wasm runs WASM cells mocked. `types.negative/`
        folders are dialect-level (no connector) and are excluded
        from any non-all filter. The two-phase WASM split fires only
        in `--connections=all` mode (in other modes either no WASM
        is in scope or everything is WASM — single pass either way).
  --wasm
        After the main pass, run the WASM cells (sequential) against
        the real pglite / sqlite-wasm-OO1 module.
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
        and `dots` (terminal-only) are supported. Other values —
        including `html` — error out and prompt for --use-vitest.

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
  Anything after `--` is forwarded to the test runner.

  bun run tests -- -t inner-join                  # match test name
  bun run tests --docker -- --update-snapshots    # bun: refresh snapshots
  npm  run tests --docker -- -- -u                # vitest: refresh snapshots

  (npm strips a leading `--`, hence the double `--` when forwarding
  flags through npm run.)

Examples
  bun run tests                                            # fast loop
  bun run tests --docker                                   # + docker
  bun run tests --docker --wasm                            # full matrix
  bun run tests --scope newest                             # skip oldest cells
  bun run tests --coverage --scope newest --open           # shorter coverage
  bun run tests --connections wasm --wasm                  # only WASM cells (real)
  bun run tests --connections docker --docker              # only docker-backed cells
  bun run tests --connections native                       # only embedded SQLite
  bun run tests postgres/newest/pg                         # focused: one cell
  bun run tests 'postgres/*/pg' --docker                   # focused: glob
  bun run tests 'postgres/*/{pg,postgres}' --docker --scope newest
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
DOCKER=off
DOCKER_MODE=reuse
# Empty sentinel: distinguishes "user didn't pass --docker-scope" from
# "user explicitly chose `all`". When --scope=newest fires, we promote
# this to `newest` ONLY if it's still empty (no explicit override).
DOCKER_SCOPE=
SCOPE=all
CONNECTIONS=all
WASM=off
USE_VITEST=off
UI=off
REPORT=off
REPORT_FORMAT=()
COVERAGE=off
COVERAGE_FORMAT=()
OPEN_AFTER=off
EXTRA_ARGS=()

while [ $# -gt 0 ]; do
    case "$1" in
        --mode)                 MODE="$2"; shift 2 ;;
        --mode=*)               MODE="${1#--mode=}"; shift ;;
        --docker)               DOCKER=on; shift ;;
        --docker-mode)          DOCKER_MODE="$2"; shift 2 ;;
        --docker-mode=*)        DOCKER_MODE="${1#--docker-mode=}"; shift ;;
        --docker-scope)         DOCKER_SCOPE="$2"; shift 2 ;;
        --docker-scope=*)       DOCKER_SCOPE="${1#--docker-scope=}"; shift ;;
        --scope)                SCOPE="$2"; shift 2 ;;
        --scope=*)              SCOPE="${1#--scope=}"; shift ;;
        --connections)          CONNECTIONS="$2"; shift 2 ;;
        --connections=*)        CONNECTIONS="${1#--connections=}"; shift ;;
        --wasm)                 WASM=on; shift ;;
        --use-vitest)           USE_VITEST=on; shift ;;
        --ui)                   UI=on; USE_VITEST=on; shift ;;
        --report)               REPORT=on; shift ;;
        --report-format)        REPORT=on; REPORT_FORMAT+=("$2"); shift 2 ;;
        --report-format=*)      REPORT=on; REPORT_FORMAT+=("${1#--report-format=}"); shift ;;
        --coverage)             COVERAGE=on; shift ;;
        --coverage-format)      COVERAGE_FORMAT+=("$2"); shift 2 ;;
        --coverage-format=*)    COVERAGE_FORMAT+=("${1#--coverage-format=}"); shift ;;
        --open)                 OPEN_AFTER=on; shift ;;
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
case "$SCOPE" in all|newest) ;; *)
    echo "Invalid --scope: $SCOPE (expected all|newest)" >&2; exit 2 ;;
esac
case "$CONNECTIONS" in all|docker|wasm|native) ;; *)
    echo "Invalid --connections: $CONNECTIONS (expected all|docker|wasm|native)" >&2; exit 2 ;;
esac
# Resolve the docker-scope default. Empty means "user didn't pass it":
# follow --scope (newest filters paths AND would skip the real-DB gate
# for any version we don't even visit).
if [ -z "$DOCKER_SCOPE" ]; then
    if [ "$SCOPE" = "newest" ]; then DOCKER_SCOPE=newest; else DOCKER_SCOPE=all; fi
fi
case "$DOCKER_SCOPE" in all|newest) ;; *)
    echo "Invalid --docker-scope: $DOCKER_SCOPE (expected all|newest)" >&2; exit 2 ;;
esac

# Resolve MAIN_PATHS (and WASM_LIST in full-matrix mode) from
# COORDS / SCOPE / FOCUSED. Full implementation + edge cases live
# in `resolve_main_paths` in _test-common.sh.
resolve_main_paths || exit $?

# Narrow MAIN_PATHS to the requested connector type. Broad paths
# (test/, test/db/<db>/, …) get expanded to their typed connector
# children. `types.negative/` is dropped under any non-all filter.
# Helper exits non-zero when the filter empties the set.
if ! apply_connection_type_filter "$CONNECTIONS"; then
    echo "Error: --connections $CONNECTIONS left no paths to run." >&2
    exit 2
fi

runtime="$(detect_runtime)"
if [ "$USE_VITEST" = "on" ]; then runtime="npm"; fi
export TS_SQL_QUERY_DOCKER="$DOCKER"
if [ "$DOCKER_MODE" = "reuse" ]; then export TESTCONTAINERS_REUSE_ENABLE=true; fi
# Only propagate scope when docker is on. With docker off the env var
# is a no-op (the backends.ts gate short-circuits on docker=off first),
# but keeping it out of the env when irrelevant avoids the appearance
# in the legend that this is doing something.
if [ "$DOCKER" = "on" ]; then export TS_SQL_QUERY_DOCKER_SCOPE="$DOCKER_SCOPE"; fi

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
if [ "$COVERAGE" = "on" ] && [ "$WASM" = "on" ] && [ "$MODE" = "parallel" ]; then
    echo "Error: --coverage cannot be combined with --wasm under --mode parallel." >&2
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
    if [ "$WASM" = "on" ]; then
        export TS_SQL_QUERY_WASM=on
    else
        export TS_SQL_QUERY_WASM=off
    fi
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
    if [ "$WASM" = "on" ]; then
        emit_phase_legend "$cov_label" "$MODE" mixed "$DOCKER" "$DOCKER_SCOPE" "$SCOPE" "$runtime" "${MAIN_PATHS[@]}"
    else
        emit_phase_legend "$cov_label" "$MODE" off "$DOCKER" "$DOCKER_SCOPE" "$SCOPE" "$runtime" "${MAIN_PATHS[@]}"
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
#   - --connections=all (otherwise either no WASM cells are in scope,
#     or every cell is WASM — a "main phase" would be empty or
#     redundant). Single pass handles both.
# In every other case --wasm is a single-pass override that just sets
# TS_SQL_QUERY_WASM=on for the upcoming main pass below.
if [ "$FOCUSED" = "off" ] && [ "$CONNECTIONS" = "all" ] && [ "$WASM" = "on" ]; then
    if [ "${#WASM_LIST[@]}" -eq 0 ]; then
        echo "Error: --scope newest filtered every WASM cell. Drop --wasm or --scope newest." >&2
        exit 2
    fi
    WASM_LOG="$(mktemp)"
    export TS_SQL_QUERY_WASM=on
    export TSSQLQUERY_PARALLEL_DBS=false
    if [ -t 1 ]; then
        export FORCE_COLOR=1
        export CLICOLOR_FORCE=1
    fi
    run_phase "$runtime" sequential "${WASM_LIST[@]}" "${RUNNER_TAIL[@]}" "${EXTRA_ARGS[@]}" 2>&1 | tee "$WASM_LOG"
    ec=${PIPESTATUS[0]}
    if [ "$runtime" = "bun" ]; then
        emit_bun_github_summary "WASM phase" "$WASM_LOG"
    fi
    emit_phase_legend "WASM phase" sequential on n/a n/a "$SCOPE" "$runtime" "${WASM_LIST[@]}"
    if [ "$ec" -ne 0 ]; then exit "$ec"; fi
fi

# Main pass. TS_SQL_QUERY_WASM gating:
#   * --wasm off → always mock (`off`).
#   * --wasm on  → real (`on`) UNLESS we just ran the two-phase split
#                  (full matrix + --connections=all + --wasm), in which
#                  case the split already covered real WASM and the
#                  main pass mocks the WASM cells to keep it fast.
if [ "$WASM" = "on" ] && { [ "$FOCUSED" = "on" ] || [ "$CONNECTIONS" != "all" ]; }; then
    export TS_SQL_QUERY_WASM=on
else
    export TS_SQL_QUERY_WASM=off
fi
if [ "$MODE" = "sequential" ]; then
    export TSSQLQUERY_PARALLEL_DBS=false
else
    unset TSSQLQUERY_PARALLEL_DBS
fi
if [ "$FOCUSED" = "on" ]; then
    main_label="Focused run: ${COORDS[*]}"
    main_wasm_scope="off"
    [ "$WASM" = "on" ] && main_wasm_scope="on"
else
    main_label="Main phase"
    main_wasm_scope="off"
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
emit_phase_legend "$main_label" "$MODE" "$main_wasm_scope" "$DOCKER" "$DOCKER_SCOPE" "$SCOPE" "$runtime" "${MAIN_PATHS[@]}"

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

# In the non-coverage path we still need to open the report after a
# green run when --open was set (typically with --report).
if [ "$ec" -eq 0 ] && [ "$OPEN_AFTER" = "on" ]; then
    open_report_in_browser || true
fi
exit "$ec"
