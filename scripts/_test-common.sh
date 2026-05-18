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
# into an array. Errors go to stderr; return non-zero on unsupported
# formats so the caller can short-circuit.
#
# Args: <runtime> <format1> [<format2> ...]
#
# Bun (second-class for coverage — its V8 profile is collapsed to
# lcov.info before we ever see it, so column-level data is lost):
# native --coverage-reporter accepts repeated flags. Supported
# values are `text` (terminal) and `lcov` (file). `html` is
# synthesised by asking bun for lcov and post-processing the
# resulting lcov.info via test/lib/coverage/lcovToHtml.ts (lcov-parse +
# istanbul-reports). Any other format is vitest-only and triggers
# an error — the user must drop the format or pass --use-vitest.
#
# Vitest (the recommended path for coverage — V8-rich data, all
# reporters native via @vitest/coverage-v8): pass each format
# through as `--coverage.reporter=<name>`. Whatever vitest supports
# is supported here too; vitest validates the names.
coverage_runner_flags() {
    local runtime="$1"; shift
    case "$runtime" in
        bun)
            local emit_lcov=off
            for fmt in "$@"; do
                case "$fmt" in
                    text)
                        printf -- '--coverage-reporter=text\n' ;;
                    lcov|html)
                        # `lcov` and `html` share the same upstream
                        # flag (bun emits lcov.info; we render html
                        # from it). De-dupe so two flags pointing
                        # at the same reporter don't go to bun.
                        emit_lcov=on ;;
                    *)
                        echo "coverage_runner_flags: bun does not support --coverage-format=$fmt — supported under bun: text|lcov|html (use --use-vitest for others)" >&2
                        return 1 ;;
                esac
            done
            if [ "$emit_lcov" = "on" ]; then
                # Match vitest's `coverage.reportsDirectory` layout
                # (.test-report/coverage/) so both runners land
                # coverage artifacts under the same subdirectory —
                # only .test-report/index.html itself (vitest's
                # test-execution SPA) lives one level up.
                printf -- '--coverage-reporter=lcov\n'
                printf -- '--coverage-dir=./.test-report/coverage\n'
            fi ;;
        npm)
            for fmt in "$@"; do
                printf -- '--coverage.reporter=%s\n' "$fmt"
            done ;;
        *)
            echo "coverage_runner_flags: unsupported runtime=$runtime" >&2
            return 1 ;;
    esac
}

# Map the user-facing test-execution report format(s) to runner-
# specific flags. Echoes flags one per line, mirroring
# coverage_runner_flags.
#
# Args: <runtime> <format1> [<format2> ...]
#
# Bun is single-valued for `--reporter` (the last value wins inside
# bun's parser, so passing two would silently lose one). We honour
# the first format and warn loudly that the rest were dropped — the
# user still gets an artifact, which matches the "warn-not-error
# when something usable remains" rule. Supported under bun:
#   junit  → bun's JUnit XML reporter, written to
#            .test-report/junit.xml. No browser viewer comes with
#            it; pair with --use-vitest if you want the html SPA.
#   dots   → terminal-only progress dots; produces no file.
# Any other value (notably `html`) is vitest-only and errors.
#
# Vitest accepts any number of `--reporter=<name>` flags and
# validates the names itself.
report_runner_flags() {
    local runtime="$1"; shift
    case "$runtime" in
        bun)
            if [ "$#" -eq 0 ]; then return 0; fi
            if [ "$#" -gt 1 ]; then
                echo "Warning: bun's --reporter is single-valued; keeping --report-format=$1 and dropping: ${*:2}" >&2
            fi
            case "$1" in
                junit)
                    printf -- '--reporter=junit\n'
                    printf -- '--reporter-outfile=./.test-report/junit.xml\n' ;;
                dots)
                    printf -- '--reporter=dots\n' ;;
                *)
                    echo "report_runner_flags: bun does not support --report-format=$1 — supported under bun: junit|dots (use --use-vitest for html and the rest)" >&2
                    return 1 ;;
            esac ;;
        npm)
            for fmt in "$@"; do
                printf -- '--reporter=%s\n' "$fmt"
            done ;;
        *)
            echo "report_runner_flags: unsupported runtime=$runtime" >&2
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
# next run, then recreate it empty. All test-report output lives
# under this single root:
#   .test-report/index.html       — vitest test-execution SPA
#                                   (`--report-format=html`)
#   .test-report/junit.xml        — bun JUnit report
#                                   (`--report-format=junit`)
#   .test-report/coverage/        — coverage report (any format)
#                                   from either runner
# The legacy ./coverage/ is also wiped so an old checkout doesn't
# leak stale files into the new layout. We mkdir -p .test-report
# eagerly because bun's --reporter-outfile and --coverage-dir don't
# create parent directories themselves; vitest creates them, so the
# eager mkdir is purely for the bun path's benefit but is harmless
# under vitest. Idempotent.
clean_report_dir() {
    rm -rf .test-report coverage
    mkdir -p .test-report
}

# Render .test-report/coverage/lcov.info → .test-report/coverage/
# (so it sits next to vitest's coverage output, same layout). Glue
# lives in test/lib/coverage/lcovToHtml.ts — runs UNDER BUN (not
# node) so the bun path stays bun-only. The file lives under test/
# rather than scripts/ so `validate:tests` typechecks its
# assumptions about LCOV and istanbul shapes. It wires lcov-parse
# and istanbul-reports (transitive via @vitest/coverage-v8); each
# does one job, our glue is only the format adapter.
#
# The lcov is already filtered by bun via bunfig.toml's
# coveragePathIgnorePatterns, so rendering reflects the project's
# coverage scope.
render_coverage_html_bun() {
    if [ ! -f .test-report/coverage/lcov.info ]; then
        echo "Warning: .test-report/coverage/lcov.info not produced; cannot render coverage HTML." >&2
        return 1
    fi
    bun test/lib/coverage/lcovToHtml.ts .test-report/coverage/lcov.info .test-report/coverage
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
#      among the requested COVERAGE formats, we run lcovToHtml.ts
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
