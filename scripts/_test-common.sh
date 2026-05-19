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
            # `monocart` is the third "html-emitting" format alongside
            # the istanbul-html post-render. Both consume bun's
            # lcov.info, so the only extra step we ask bun for is
            # the lcov emission. The post-render itself happens in
            # finalize_report → render_coverage_monocart_bun.
            local emit_lcov=off
            local has_monocart=off
            local has_html=off
            for fmt in "$@"; do
                case "$fmt" in
                    text)
                        printf -- '--coverage-reporter=text\n' ;;
                    lcov)
                        emit_lcov=on ;;
                    html)
                        emit_lcov=on; has_html=on ;;
                    monocart)
                        emit_lcov=on; has_monocart=on ;;
                    *)
                        echo "coverage_runner_flags: bun does not support --coverage-format=$fmt — supported under bun: text|lcov|html|monocart (use --use-vitest for others)" >&2
                        return 1 ;;
                esac
            done
            # Both html and monocart write to
            # .test-report/coverage/index.html; one would clobber
            # the other. Force the user to pick. text + lcov stay
            # composable with either.
            if [ "$has_monocart" = "on" ] && [ "$has_html" = "on" ]; then
                echo "coverage_runner_flags: --coverage-format=monocart and =html both write to .test-report/coverage/index.html; pick one. (text and lcov can coexist with either.)" >&2
                return 1
            fi
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
            # `monocart` under vitest swaps the coverage provider
            # entirely (vitest-monocart-coverage as a custom
            # provider, V8 raw data → MCR). It can't be combined
            # with other --coverage-format values because the V8
            # provider that emits istanbul-style reports isn't
            # running. Errors out instead of silently dropping the
            # other formats.
            local has_monocart=off
            for fmt in "$@"; do
                if [ "$fmt" = "monocart" ]; then has_monocart=on; break; fi
            done
            if [ "$has_monocart" = "on" ]; then
                if [ "$#" -gt 1 ]; then
                    echo "coverage_runner_flags: --coverage-format=monocart under vitest replaces the coverage provider — it can't be combined with other --coverage-format values. Pass monocart on its own; configure additional MCR reports in mcr.config.ts." >&2
                    return 1
                fi
                printf -- '--coverage.provider=custom\n'
                printf -- '--coverage.customProviderModule=vitest-monocart-coverage\n'
            else
                for fmt in "$@"; do
                    printf -- '--coverage.reporter=%s\n' "$fmt"
                done
            fi ;;
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

# Append a "Round details" markdown block to $GITHUB_STEP_SUMMARY
# describing what the phase actually covered. Sits next to vitest's
# auto-injected summary (under npm) and our own bun summary block
# (under bun), so the Actions UI distinguishes back-to-back reports
# that look identical otherwise. Driven by the flags/paths the caller
# passes in — does not hard-code phase order.
#
# Args: <phase-label> <mode> <wasm-real> <runtime> [<path>…]
#   <phase-label>  free-form, e.g. "WASM phase", "Main phase", "Coverage run"
#   <mode>         "parallel" | "sequential"
#   <wasm-real>    "on"  → real WASM modules loaded, non-WASM cells excluded
#                  "off" → WASM connectors fall through to mocks
#                  "mixed" → real WASM inside a single full-matrix pass
#                            (the coverage-mode flow when --wasm is set)
#   <runtime>      "bun" | "npm" (for the runner line)
#   <path>…        paths the runner was invoked with; verbatim in the
#                  rendered "Cells" list so the legend reflects the
#                  actual invocation rather than an inferred shape.
#
# Silently no-ops when $GITHUB_STEP_SUMMARY is unset (local runs).
emit_phase_legend() {
    local label="$1" mode="$2" wasm_real="$3" runtime="$4"; shift 4
    if [ -z "${GITHUB_STEP_SUMMARY:-}" ]; then return 0; fi

    local scope runner
    case "$wasm_real" in
        on)    scope='real WASM modules loaded; non-WASM cells excluded from this round' ;;
        off)   scope='WASM connectors fall through to mocks' ;;
        mixed) scope='real WASM modules loaded inside a single full-matrix pass' ;;
        *)     scope="$wasm_real" ;;
    esac
    case "$runtime" in
        bun) runner='bun test' ;;
        npm) runner='vitest' ;;
        *)   runner="$runtime" ;;
    esac

    {
        printf '### Round details\n\n'
        printf -- '- **Phase:** %s\n' "$label"
        printf -- '- **Runner:** %s\n' "$runner"
        printf -- '- **Mode:** %s\n' "$mode"
        printf -- '- **Scope:** %s\n' "$scope"
        if [ "$#" -gt 0 ]; then
            printf -- '- **Cells:**\n'
            for p in "$@"; do
                printf -- '  - `%s`\n' "$p"
            done
        fi
        printf '\n'
    } >> "$GITHUB_STEP_SUMMARY"
}

# Parse a captured bun-test log and append a markdown block to
# $GITHUB_STEP_SUMMARY that mirrors the auto-injected vitest
# `github-actions` reporter. Bun ships no equivalent reporter, so
# CI summaries would otherwise be empty on the bun job while the
# node matrix shows full per-phase numbers (`tests.sh --wasm`
# invokes the runner twice, so vitest emits two summary blocks).
# This keeps both runtimes visually symmetric in the Actions UI.
#
# Args: <phase-label> <captured-log-file>
#
# Silently no-ops when $GITHUB_STEP_SUMMARY is unset (local runs)
# or the log file is empty / missing.
emit_bun_github_summary() {
    local label="$1" logfile="$2"
    if [ -z "${GITHUB_STEP_SUMMARY:-}" ] || [ ! -s "$logfile" ]; then return 0; fi

    # bun's end-of-run summary looks like:
    #     N pass
    #     M fail
    #     K skip          (only when skips > 0)
    #     ...
    #   Ran T tests across F files. [D]
    local pass fail skip total files duration summary
    pass=$(grep -Eo '^[[:space:]]*[0-9]+ pass([[:space:]]|$)' "$logfile" | tail -1 | grep -Eo '[0-9]+' || true)
    fail=$(grep -Eo '^[[:space:]]*[0-9]+ fail([[:space:]]|$)' "$logfile" | tail -1 | grep -Eo '[0-9]+' || true)
    skip=$(grep -Eo '^[[:space:]]*[0-9]+ skip([[:space:]]|$)' "$logfile" | tail -1 | grep -Eo '[0-9]+' || true)
    summary=$(grep -E 'Ran [0-9]+ tests? across [0-9]+ files?' "$logfile" | tail -1)
    total=$(printf '%s' "$summary" | grep -Eo 'Ran [0-9]+' | grep -Eo '[0-9]+' || true)
    files=$(printf '%s' "$summary" | grep -Eo 'across [0-9]+' | grep -Eo '[0-9]+' || true)
    duration=$(printf '%s' "$summary" | grep -Eo '\[[^]]+\]' || true)

    local icon="✅"
    if [ "${fail:-0}" -gt 0 ]; then icon="❌"; fi
    local results="${icon} ${pass:-0} passes"
    if [ "${fail:-0}" -gt 0 ]; then results="${results} · ❌ ${fail} fails"; fi
    if [ -n "${skip:-}" ] && [ "$skip" -gt 0 ]; then results="${results} · ⏭️ ${skip} skipped"; fi
    results="${results} · ${total:-0} total"

    {
        printf '## Bun Test Report — %s\n\n' "$label"
        printf '### Summary\n\n'
        printf -- '- Test Files: %s %s total\n' "$icon" "${files:-0}"
        printf -- '- Test Results: %s\n' "$results"
        if [ -n "$duration" ]; then printf -- '- Duration: %s\n' "$duration"; fi
        printf '\n'
    } >> "$GITHUB_STEP_SUMMARY"
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

# Render .test-report/coverage/lcov.info as monocart-coverage-reports
# under bun. Same pipeline shape as render_coverage_html_bun, but the
# entry point uses MCR (html-spa + console-summary) instead of plain
# istanbul-reports. Validation in coverage_runner_flags already
# guarantees this isn't called alongside the istanbul-html renderer
# (they'd both write index.html into the same dir).
render_coverage_monocart_bun() {
    if [ ! -f .test-report/coverage/lcov.info ]; then
        echo "Warning: .test-report/coverage/lcov.info not produced; cannot render monocart report." >&2
        return 1
    fi
    bun test/lib/coverage/lcovToMonocart.ts .test-report/coverage/lcov.info .test-report/coverage
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
    local has_monocart_coverage=off
    for fmt in "$@"; do
        case "$fmt" in
            html)     has_html_coverage=on ;;
            monocart) has_monocart_coverage=on ;;
        esac
    done
    # Bun post-render: the two html-producing formats run their own
    # converters against the lcov.info bun emitted. Validation in
    # coverage_runner_flags guarantees they're mutually exclusive,
    # so at most one of these branches executes per run.
    if [ "$runtime" = "bun" ] && [ "$has_html_coverage" = "on" ]; then
        render_coverage_html_bun || return 1
    fi
    if [ "$runtime" = "bun" ] && [ "$has_monocart_coverage" = "on" ]; then
        render_coverage_monocart_bun || return 1
    fi
    if [ "$open_after" = "on" ]; then
        open_report_in_browser || return 1
    fi
}
