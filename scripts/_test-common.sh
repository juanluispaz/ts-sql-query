# shellcheck shell=bash
# Sourced by test.sh, focus-test.sh and wasm-test.sh. Not executable on
# its own. Defines:
#
#   detect_runtime              echoes "bun" or "npm"
#   run_phase <runtime> <mode> <paths…>  runs the test runner once
#
# `npm_config_user_agent` is set by both `npm run` and `bun run`; the
# token before the first `/` is what we branch on. When invoked
# directly (no var set) we default to bun, since day-to-day dev in
# this project prefers Bun.

detect_runtime() {
    local rt="${npm_config_user_agent%%/*}"
    if [ -z "$rt" ]; then rt="bun"; fi
    if [ "$rt" != "bun" ] && [ "$rt" != "npm" ]; then rt="npm"; fi
    printf '%s\n' "$rt"
}

# Run one test pass.
#
# Args: <runtime> <mode> <paths…>
#   <runtime> = "bun" | "npm"
#   <mode>    = "parallel" | "sequential"
#   <paths…>  = paths/files to pass to the runner, plus any
#               extra pass-through args.
#
# Returns the runner's exit code. bun:test's exit codes 99 and 100
# both indicate "fully green run + spurious shutdown signal":
#   - 99  : leaked handles on a green run (PGlite's worker threads
#           keep the loop alive even after all tests pass).
#   - 100 : same shape, raised when stdout is not a TTY (which is the
#           default under CI, under `tee`, or under any kind of
#           output redirect). Empirical: with 0 failures, a TTY run
#           returns 0 and a piped run returns 100 — bun's exit-time
#           handle accounting flips signal based on output mode.
# Remapping both to 0 keeps "0 fail" the contract.
run_phase() {
    local runtime="$1" mode="$2"
    shift 2
    local ec
    if [ "$runtime" = "bun" ]; then
        local parallel_flag=
        if [ "$mode" = "parallel" ]; then parallel_flag="--parallel"; fi
        # An empty "$@" turns into a literal "" token that `bun test`
        # interprets as a filter matching every project file AND exits 99.
        if [ "$#" -gt 0 ]; then
            bun test $parallel_flag "$@"
        else
            bun test $parallel_flag
        fi
        ec=$?
        if [ "$ec" -eq 99 ] || [ "$ec" -eq 100 ]; then ec=0; fi
    else
        local serial_flag=
        if [ "$mode" = "sequential" ]; then serial_flag="--no-file-parallelism"; fi
        # `passWithNoTests` and other shared knobs live in
        # vitest.config.ts so they apply to direct `npx vitest run`
        # invocations too — not just to runs that go through us.
        vitest run $serial_flag "$@"
        ec=$?
    fi
    return $ec
}

# Paths that hit the in-process WASM connectors. The two-phase test
# script and the standalone wasm-test script both run against these.
WASM_PATHS=(
    test/db/postgres/newest/pglite/
    test/db/postgres/oldest/pglite/
    test/db/sqlite/newest/sqlite-wasm-OO1/
)

# Map the user-facing coverage format(s) to runner-specific flags.
# Echoes flags one per line so callers can `while IFS= read` them
# into an array.
#
# Args: <runtime> <format1> [<format2> ...]
#
# Bun (second-class for coverage — its lcov.info is the only data
# source we get): single format only, restricted to text|html|lcov.
# `html` and `lcov` both ask bun to emit lcov.info; html is then
# rendered by scripts/lcov-to-html.mjs (lcov-parse + istanbul-reports).
#
# Vitest (the recommended path for coverage — V8-rich data, all
# reporters native via @vitest/coverage-v8): pass each format
# through as `--coverage.reporter=<name>`. Whatever vitest supports
# is supported here too; vitest validates the names.
coverage_runner_flags() {
    local runtime="$1"; shift
    case "$runtime" in
        bun)
            if [ "$#" -gt 1 ]; then
                echo "coverage_runner_flags: bun supports only one --coverage-format; got $* (use --use-vitest for multiple)" >&2
                return 1
            fi
            case "$1" in
                text)
                    printf -- '--coverage-reporter=text\n' ;;
                html|lcov)
                    # Match vitest's `coverage.reportsDirectory`
                    # layout (.test-report/coverage/) so both
                    # runners land coverage artifacts in the same
                    # subdirectory — only .test-report/index.html
                    # itself (vitest's test-execution SPA) lives
                    # one level up.
                    printf -- '--coverage-reporter=lcov\n'
                    printf -- '--coverage-dir=./.test-report/coverage\n' ;;
                *)
                    echo "coverage_runner_flags: bun supports text|html|lcov; got $1 (use --use-vitest for $1)" >&2
                    return 1 ;;
            esac ;;
        npm)
            for fmt in "$@"; do
                printf -- '--coverage.reporter=%s\n' "$fmt"
            done ;;
        *)
            echo "coverage_runner_flags: unsupported runtime=$runtime" >&2
            return 1 ;;
    esac
}

# Coverage scope defaults live in bunfig.toml (`coveragePathIgnorePatterns`)
# for bun and in vitest.config.ts (`test.coverage.exclude`) for vitest.
# Both runners read their own config file natively; we don't need to
# duplicate the patterns here because we don't provide a CLI override
# for the scope (bun ignores `--config=<path>` for coverage settings,
# so a CLI override would only ever apply to one of the two runners
# and that asymmetry isn't worth the complexity). To narrow scope ad
# hoc, agents edit bunfig.toml / vitest.config.ts directly, or use
# `tests:focus <coord>` which already restricts to a single cell.

# Wipe ./.test-report/ so previous artifacts don't contaminate the
# next run. All test-report output lives under this single root:
#   .test-report/index.html       — vitest test-execution SPA
#                                   (`--report-format=html`)
#   .test-report/coverage/        — coverage report (any format)
#                                   from either runner
# The legacy ./coverage/ is also wiped so an old checkout doesn't
# leak stale files into the new layout. Idempotent.
clean_report_dir() {
    rm -rf .test-report coverage
}

# Render .test-report/coverage/lcov.info → .test-report/coverage/
# (so it sits next to vitest's coverage output, same layout). Glue
# lives in scripts/lcov-to-html.mjs — runs UNDER BUN (not node) so
# the bun path stays bun-only. The script wires lcov-parse and
# istanbul-reports (transitive via @vitest/coverage-v8); each does
# one job, our glue is only the format adapter.
#
# The lcov is already filtered by bun via bunfig.toml's
# coveragePathIgnorePatterns, so rendering reflects the project's
# coverage scope.
render_coverage_html_bun() {
    if [ ! -f .test-report/coverage/lcov.info ]; then
        echo "Warning: .test-report/coverage/lcov.info not produced; cannot render coverage HTML." >&2
        return 1
    fi
    bun scripts/lcov-to-html.mjs .test-report/coverage/lcov.info .test-report/coverage
}

# Open the most useful HTML report in the default browser. The two
# possible locations correspond to the two kinds of report and need
# DIFFERENT delivery mechanisms:
#
#   1. .test-report/index.html
#         — Vitest's test-execution SPA (from `--report-format=html`,
#           requires @vitest/ui). The page fetches metadata, which
#           browsers refuse to do under file://, so we serve it via
#           `bunx vite preview --outDir .test-report --open` (a
#           static-file server, NOT the interactive runner from
#           --ui). The command blocks until Ctrl+C.
#
#   2. .test-report/coverage/index.html
#         — Plain istanbul coverage report. Emitted by vitest when
#           `--coverage-format=html` is set without
#           `--report-format=html`, or by bun via our lcov-to-html
#           glue. It's static HTML and opens fine over file://, so
#           we hand it straight to the OS opener — no server.
#
# Preference: if (1) exists, use it (richest report). Otherwise
# fall back to (2).
#
# Used by `--open` (after a test run) and by `tests:reopen` (no test
# run, just open).
open_report_in_browser() {
    if [ -f .test-report/index.html ]; then
        echo "Serving .test-report/ via vite preview (Ctrl+C to stop)…" >&2
        bunx vite preview --outDir .test-report --open
        return $?
    fi
    if [ -f .test-report/coverage/index.html ]; then
        local target=".test-report/coverage/index.html"
        if command -v open >/dev/null 2>&1; then
            open "$target"
        elif command -v xdg-open >/dev/null 2>&1; then
            xdg-open "$target"
        elif command -v start >/dev/null 2>&1; then
            start "$target"
        else
            echo "No open/xdg-open/start on PATH — open $target manually." >&2
            return 1
        fi
        return 0
    fi
    echo "Error: no report at .test-report/index.html or .test-report/coverage/index.html. Generate it with --coverage --report-format=html (recommended) or --coverage --coverage-format=html first." >&2
    return 1
}

# One entry point used by tests.sh / tests-focus.sh / tests-wasm.sh
# after a successful run. Two things happen here:
#
#   1. Bun coverage post-render: when bun emitted lcov and html was
#      among the requested COVERAGE formats, we run lcov-to-html.mjs
#      so .test-report/coverage/index.html exists. Vitest writes
#      its own HTML natively, so this is a no-op there.
#
#   2. Optional browser open: when --open is on, hand off to
#      open_report_in_browser (which picks vitest's test-exec SPA
#      via vite preview if present, else the plain static coverage
#      report via file://).
#
# Args: <runtime> <open_after> <coverage_format1> [<coverage_format2> ...]
finalize_report() {
    local runtime="$1" open_after="$2"
    shift 2
    local has_html_coverage=off
    for fmt in "$@"; do
        if [ "$fmt" = "html" ]; then has_html_coverage=on; break; fi
    done
    if [ "$runtime" = "bun" ] && [ "$has_html_coverage" = "on" ]; then
        render_coverage_html_bun || return 1
    fi
    if [ "$open_after" = "on" ]; then
        open_report_in_browser || return 1
    fi
}
