#!/bin/bash
# Run the test/ matrix. See `tests --help` for details.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./_test-common.sh
. "$SCRIPT_DIR/_test-common.sh"

print_help() {
    cat <<'EOF'
Usage:
  tests [--mode <parallel|sequential>]
        [--docker] [--docker-mode <reuse|no-reuse>]
        [--wasm]
        [--use-vitest] [--ui]
        [--report    [--report-format <name>]…]
        [--coverage  [--coverage-format <name>]…]
        [--open]
        [--help]
        [-- <args passed to runner>]

Runs every test under test/. Dispatches to `bun test` when invoked via
`bun run`, and to `vitest run` when invoked via `npm run`. Direct
invocation (`sh scripts/tests.sh`) defaults to bun. `--use-vitest`,
`--ui` and `--report` force the vitest path regardless of how the
script was invoked.

Runner trade-off
  Bun is fast and is the default for the daily test loop.
  Vitest is the RECOMMENDED path for the rich report stack:
  bun's coverage is text/lcov only and line-level (no column info)
  and bun:test has no equivalent to vitest's --reporter machinery,
  so the test-execution report (`--report`) is vitest-only. Pass
  --use-vitest from a `bun run` invocation to switch.

Defaults
  --mode             parallel
  --docker           off (docker cells fall through to mock)
  --docker-mode      reuse  (containers stay alive between invocations)
  --wasm             off (WASM cells fall through to mock — modules are
                     never imported, so their bootstrap cost is paid
                     by nothing)
  --use-vitest       off (runtime detected from npm_config_user_agent)
  --ui               off (implies --use-vitest)
  --report           off (test-execution report; vitest-only)
  --report-format    html (when --report is on)
  --coverage         off
  --coverage-format  html (when --coverage is on)
  --open             off

WASM semantics
  The main pass ALWAYS runs WASM connectors (pglite, sqlite-wasm-OO1)
  as mocks. When --wasm is set, a sequential pass runs the WASM cells
  against the real module FIRST, then the parallel main pass runs;
  the WASM summary is re-emitted at the end so both phase summaries
  stay visible after the main pass scrolls. WASM failures short-
  circuit the main pass. This split keeps the parallel main pass fast
  — WASM is CPU-bound and tanks parallel throughput.

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

Report flags (test-execution report — vitest only)
  --report
        Emit a test-execution report. Output lands under
        .test-report/ (HTML report at .test-report/index.html when
        --report-format=html; see vitest.config.ts's
        `outputFile.html`). Implies --use-vitest. Independent from
        --coverage: you can have either, both, or neither.
  --report-format <name>
        Repeatable. Default `html` when --report is on. Pass-through
        to vitest's `--reporter`. Common values: html (browseable
        SPA at .test-report/index.html — needs `bunx vite preview`
        because the page fetches metadata), default, verbose, dot,
        tap, tap-flat, junit, json, tree, github-actions. Setting
        any --report-format implies --report.

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
        restricted to `html|text|lcov` and only one value per run
        (more requires --use-vitest).

        Scope (which source files end up in the report) is set in
        bunfig.toml and vitest.config.ts — both exclude
        `src/examples/**` and `test/**` by default. To narrow scope
        for a specific cell, prefer `tests:focus <coord>`; to alter
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
  bun run tests --report --open                            # test-exec html
  bun run tests --use-vitest --coverage --open             # coverage html
  bun run tests --use-vitest --report --coverage --open    # both, vite preview
  bun run tests --use-vitest --coverage \
                --coverage-format=html --coverage-format=lcov \
                --coverage-format=json-summary             # multi-format
  bun run tests --use-vitest --ui --coverage --docker      # interactive UI
  bun run tests --use-vitest --report-format=verbose       # verbose test output
EOF
}

MODE=parallel
DOCKER=off
DOCKER_MODE=reuse
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
        --wasm)                 WASM=on; shift ;;
        --use-vitest)           USE_VITEST=on; shift ;;
        --ui)                   UI=on; USE_VITEST=on; shift ;;
        --report)               REPORT=on; USE_VITEST=on; shift ;;
        --report-format)        REPORT=on; USE_VITEST=on; REPORT_FORMAT+=("$2"); shift 2 ;;
        --report-format=*)      REPORT=on; USE_VITEST=on; REPORT_FORMAT+=("${1#--report-format=}"); shift ;;
        --coverage)             COVERAGE=on; shift ;;
        --coverage-format)      COVERAGE_FORMAT+=("$2"); shift 2 ;;
        --coverage-format=*)    COVERAGE_FORMAT+=("${1#--coverage-format=}"); shift ;;
        --open)                 OPEN_AFTER=on; shift ;;
        -h|--help)              print_help; exit 0 ;;
        --)                     shift; EXTRA_ARGS=("$@"); break ;;
        *)                      echo "Unknown argument: $1 (use --help)" >&2; exit 2 ;;
    esac
done

case "$MODE" in parallel|sequential) ;; *)
    echo "Invalid --mode: $MODE (expected parallel|sequential)" >&2; exit 2 ;;
esac
case "$DOCKER_MODE" in reuse|no-reuse) ;; *)
    echo "Invalid --docker-mode: $DOCKER_MODE (expected reuse|no-reuse)" >&2; exit 2 ;;
esac

# Defaults for format arrays when their parent flag is on.
if [ "$REPORT" = "on" ] && [ "${#REPORT_FORMAT[@]}" -eq 0 ]; then
    REPORT_FORMAT=("html")
fi
if [ "$COVERAGE" = "on" ] && [ "${#COVERAGE_FORMAT[@]}" -eq 0 ]; then
    COVERAGE_FORMAT=("html")
fi

# Vitest's html reporter writes the SPA to disk and prints only
# `HTML Report is generated …` to the terminal — no progress bar, no
# pass/fail summary, no exit signal beyond that single line. When it's
# the ONLY reporter the user is left staring at a frozen prompt while
# `bunx vite preview` boots (5–10 s), which reads as "the script
# exited without doing anything". Inject `default` so a terminal
# reporter is always present alongside html.
if [ "$REPORT" = "on" ]; then
    HAS_TERMINAL_REPORTER=off
    for fmt in "${REPORT_FORMAT[@]}"; do
        case "$fmt" in
            html) ;;
            *) HAS_TERMINAL_REPORTER=on; break ;;
        esac
    done
    if [ "$HAS_TERMINAL_REPORTER" = "off" ]; then
        REPORT_FORMAT=("default" "${REPORT_FORMAT[@]}")
    fi
fi

# --open needs html among the requested formats (either report or
# coverage), and at least one of --report / --coverage on.
if [ "$OPEN_AFTER" = "on" ]; then
    if [ "$REPORT" = "off" ] && [ "$COVERAGE" = "off" ]; then
        echo "Error: --open requires --report or --coverage." >&2; exit 2
    fi
    HAS_HTML=off
    if [ "$REPORT" = "on" ]; then
        for fmt in "${REPORT_FORMAT[@]}"; do
            if [ "$fmt" = "html" ]; then HAS_HTML=on; break; fi
        done
    fi
    if [ "$HAS_HTML" = "off" ] && [ "$COVERAGE" = "on" ]; then
        for fmt in "${COVERAGE_FORMAT[@]}"; do
            if [ "$fmt" = "html" ]; then HAS_HTML=on; break; fi
        done
    fi
    if [ "$HAS_HTML" = "off" ]; then
        echo "Error: --open requires html among the requested formats — pass --report-format=html or --coverage-format=html." >&2; exit 2
    fi
fi

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

runtime="$(detect_runtime)"
if [ "$USE_VITEST" = "on" ]; then runtime="npm"; fi
export TS_SQL_QUERY_DOCKER="$DOCKER"
if [ "$DOCKER_MODE" = "reuse" ]; then export TESTCONTAINERS_REUSE_ENABLE=true; fi

# --report is vitest-only (bun:test has no --reporter machinery).
# Error early under bun without --use-vitest so the user sees what
# happened rather than a silent no-op.
if [ "$REPORT" = "on" ] && [ "$runtime" = "bun" ]; then
    echo "Error: --report (test-execution report) requires vitest; add --use-vitest." >&2
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
    if [ "$runtime" = "npm" ]; then
        if [ "$REPORT" = "on" ]; then
            for fmt in "${REPORT_FORMAT[@]}"; do COV_FLAGS+=("--reporter=$fmt"); done
        fi
        if [ "$UI" = "on" ]; then COV_FLAGS+=(--ui); fi
    fi

    run_phase "$runtime" "$MODE" test/ --coverage "${COV_FLAGS[@]}" "${EXTRA_ARGS[@]}"
    ec=$?
    if [ "$ec" -eq 0 ]; then
        finalize_report "$runtime" "$OPEN_AFTER" "${COVERAGE_FORMAT[@]}" || true
    fi
    exit "$ec"
fi

# Non-coverage flow: optional WASM phase + main pass. Build the
# vitest-only flag tail once (UI / report) so both phases get the
# same shape.
VITEST_TAIL=()
if [ "$runtime" = "npm" ]; then
    if [ "$REPORT" = "on" ]; then
        for fmt in "${REPORT_FORMAT[@]}"; do VITEST_TAIL+=("--reporter=$fmt"); done
    fi
    if [ "$UI" = "on" ]; then VITEST_TAIL+=(--ui); fi
fi

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
if [ "$WASM" = "on" ]; then
    WASM_LOG="$(mktemp)"
    trap 'rm -f "$WASM_LOG"' EXIT
    export TS_SQL_QUERY_WASM=on
    export TSSQLQUERY_PARALLEL_DBS=false
    if [ -t 1 ]; then
        export FORCE_COLOR=1
        export CLICOLOR_FORCE=1
    fi
    run_phase "$runtime" sequential "${WASM_PATHS[@]}" "${VITEST_TAIL[@]}" "${EXTRA_ARGS[@]}" 2>&1 | tee "$WASM_LOG"
    ec=${PIPESTATUS[0]}
    if [ "$ec" -ne 0 ]; then exit "$ec"; fi
fi

# Main pass: full matrix, WASM as mock (modules never imported).
export TS_SQL_QUERY_WASM=off
if [ "$MODE" = "sequential" ]; then
    export TSSQLQUERY_PARALLEL_DBS=false
else
    unset TSSQLQUERY_PARALLEL_DBS
fi
run_phase "$runtime" "$MODE" test/ "${VITEST_TAIL[@]}" "${EXTRA_ARGS[@]}"
ec=$?

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
