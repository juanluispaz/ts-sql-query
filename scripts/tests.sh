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
        [--docker-scope <all|newest>]
        [--scope <all|newest>]
        [--wasm]
        [--use-vitest] [--ui]
        [--report    [--report-format <name>]…]
        [--coverage  [--coverage-format <name>]…]
        [--open]
        [--help]
        [-- <args passed to runner>]

Runs every test under test/. Dispatches to `bun test` when invoked via
`bun run`, and to `vitest run` when invoked via `npm run`. Direct
invocation (`sh scripts/tests.sh`) defaults to bun. `--use-vitest`
and `--ui` force the vitest path regardless of how the script was
invoked; `--report` works under both runtimes (formats differ —
see below).

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
  bun run tests --scope newest                             # skip oldest cells
  bun run tests --coverage --scope newest --open           # shorter coverage
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

MODE=parallel
DOCKER=off
DOCKER_MODE=reuse
# Empty sentinel: distinguishes "user didn't pass --docker-scope" from
# "user explicitly chose `all`". When --scope=newest fires, we promote
# this to `newest` ONLY if it's still empty (no explicit override).
DOCKER_SCOPE=
SCOPE=all
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
        *)                      echo "Unknown argument: $1 (use --help)" >&2; exit 2 ;;
    esac
done

case "$MODE" in parallel|sequential) ;; *)
    echo "Invalid --mode: $MODE (expected parallel|sequential)" >&2; exit 2 ;;
esac
case "$DOCKER_MODE" in reuse|no-reuse) ;; *)
    echo "Invalid --docker-mode: $DOCKER_MODE (expected reuse|no-reuse)" >&2; exit 2 ;;
esac
case "$SCOPE" in all|newest) ;; *)
    echo "Invalid --scope: $SCOPE (expected all|newest)" >&2; exit 2 ;;
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

# Build the path set for the main pass and (if --wasm) the WASM phase.
# With --scope all this is the literal `test/` root the runner walks;
# with --scope newest we hand the runner an explicit set of
# `<db>/newest/` + `<db>/types.negative/` paths instead — older-version
# cells are not enumerated at all.
MAIN_PATHS=(test/)
WASM_LIST=("${WASM_PATHS[@]}")
if [ "$SCOPE" = "newest" ]; then
    MAIN_PATHS=()
    while IFS= read -r p; do MAIN_PATHS+=("$p"); done < <(expand_newest_paths)
    if [ "${#MAIN_PATHS[@]}" -eq 0 ]; then
        echo "Error: --scope newest matched no paths under test/db/. Add a <db>/newest/ folder or drop --scope newest." >&2
        exit 2
    fi
    WASM_LIST=()
    while IFS= read -r p; do WASM_LIST+=("$p"); done < <(filter_newest_wasm_paths)
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

# Defaults for the format arrays. The choice depends on the runtime
# because bun and vitest don't share a usable format: vitest's html
# is the SPA viewer (default for the recommended path), while bun
# can't emit html for test-execution — junit is the only file it
# produces, so that's what we default to under bun. The user can
# always override with --report-format / --coverage-format; the
# helpers in _test-common.sh validate per runtime and error if
# something asked for isn't supportable.
if [ "$REPORT" = "on" ] && [ "${#REPORT_FORMAT[@]}" -eq 0 ]; then
    if [ "$runtime" = "bun" ]; then
        REPORT_FORMAT=("junit")
    else
        REPORT_FORMAT=("html")
    fi
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
# reporter is always present alongside html. Bun-side reporters
# (junit, dots) all print something to the terminal natively, so
# this injection only applies to the vitest path.
if [ "$REPORT" = "on" ] && [ "$runtime" = "npm" ]; then
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
# coverage), and at least one of --report / --coverage on. Under bun
# this is the only path to html — bun's --report-format never
# resolves to html, so users typically pair --open with
# --coverage-format=html and let our lcovToHtml.ts render it. For
# the test-exec SPA they need --use-vitest.
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
        # `monocart` also writes an index.html (MCR's html-spa under
        # bun, MCR's `v8` SPA under vitest), so it satisfies --open
        # the same way `html` does.
        for fmt in "${COVERAGE_FORMAT[@]}"; do
            case "$fmt" in
                html|monocart) HAS_HTML=on; break ;;
            esac
        done
    fi
    if [ "$HAS_HTML" = "off" ]; then
        if [ "$runtime" = "bun" ]; then
            echo "Error: --open requires html among the requested formats. Under bun, html is only available for coverage — pass --coverage-format=html (or =monocart), or add --use-vitest for the html test-execution SPA." >&2
        else
            echo "Error: --open requires html among the requested formats — pass --report-format=html, --coverage-format=html, or --coverage-format=monocart." >&2
        fi
        exit 2
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
    if [ "$WASM" = "on" ]; then
        emit_phase_legend "Coverage run" "$MODE" mixed "$DOCKER" "$DOCKER_SCOPE" "$SCOPE" "$runtime" "${MAIN_PATHS[@]}"
    else
        emit_phase_legend "Coverage run" "$MODE" off "$DOCKER" "$DOCKER_SCOPE" "$SCOPE" "$runtime" "${MAIN_PATHS[@]}"
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

if [ "$WASM" = "on" ]; then
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

# Main pass: full matrix, WASM as mock (modules never imported).
export TS_SQL_QUERY_WASM=off
if [ "$MODE" = "sequential" ]; then
    export TSSQLQUERY_PARALLEL_DBS=false
else
    unset TSSQLQUERY_PARALLEL_DBS
fi
if [ "$runtime" = "bun" ] && [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    MAIN_LOG="$(mktemp)"
    run_phase "$runtime" "$MODE" "${MAIN_PATHS[@]}" "${RUNNER_TAIL[@]}" "${EXTRA_ARGS[@]}" 2>&1 | tee "$MAIN_LOG"
    ec=${PIPESTATUS[0]}
    emit_bun_github_summary "Main phase" "$MAIN_LOG"
else
    run_phase "$runtime" "$MODE" "${MAIN_PATHS[@]}" "${RUNNER_TAIL[@]}" "${EXTRA_ARGS[@]}"
    ec=$?
fi
emit_phase_legend "Main phase" "$MODE" off "$DOCKER" "$DOCKER_SCOPE" "$SCOPE" "$runtime" "${MAIN_PATHS[@]}"

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
