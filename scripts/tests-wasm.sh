#!/bin/bash
# Run the WASM cells (pglite, sqlite-wasm-OO1) on their own. Always
# sequential, always real WASM. See `tests:wasm --help`.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./_test-common.sh
. "$SCRIPT_DIR/_test-common.sh"

print_help() {
    cat <<'EOF'
Usage:
  tests:wasm [--use-vitest] [--ui]
             [--report    [--report-format <name>]…]
             [--coverage  [--coverage-format <name>]…]
             [--open]
             [--help] [-- <args passed to runner>]

Runs only the in-process WASM cells:
  test/db/postgres/newest/pglite/
  test/db/postgres/oldest/pglite/
  test/db/sqlite/newest/sqlite-wasm-OO1/

Always sequential (WASM is CPU-bound; parallel buys nothing) and
always against the real WASM module. No --docker / --mode / --wasm
flags — those are implicit. Use `tests --wasm` if you want this as a
second phase after the full matrix.

Flags:
  --use-vitest                          Force vitest runtime.
  --ui                                  @vitest/ui (implies --use-vitest).
  --report                              Emit test-execution report at
                                        .test-report/ (vitest-only,
                                        implies --use-vitest).
  --report-format <name>                Repeatable; default html when
                                        --report is on. Implies
                                        --report.
  --coverage                            Emit coverage report at
                                        .test-report/coverage/.
                                        The report dir is wiped before
                                        each run.
  --coverage-format <name>              Repeatable; default html when
                                        --coverage is on.
                                        Under vitest, any
                                        @vitest/coverage-v8 reporter.
                                        Under bun, restricted to
                                        html|text|lcov, one value.
                                        Scope set in bunfig.toml +
                                        vitest.config.ts.
  --open                                Open the most useful report
                                        (test-exec SPA via vite preview
                                        if present, else coverage html
                                        via file://). Requires html in
                                        --report-format or
                                        --coverage-format.

Pass-through args after --:
  bun run tests:wasm -- -t insert
  bun run tests:wasm -- --update-snapshots
EOF
}

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

# Defaults for format arrays when their parent flag is on.
if [ "$REPORT" = "on" ] && [ "${#REPORT_FORMAT[@]}" -eq 0 ]; then
    REPORT_FORMAT=("html")
fi
if [ "$COVERAGE" = "on" ] && [ "${#COVERAGE_FORMAT[@]}" -eq 0 ]; then
    COVERAGE_FORMAT=("html")
fi

# Vitest's html reporter prints only `HTML Report is generated …` —
# no progress, no summary. When it's the only reporter the user sees
# a frozen prompt during the 5–10 s vite-preview boot. Pair it with
# `default` so terminal feedback is always present. See tests.sh for
# the long version of this rationale.
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

runtime="$(detect_runtime)"
if [ "$USE_VITEST" = "on" ]; then runtime="npm"; fi
export TS_SQL_QUERY_WASM=on
export TSSQLQUERY_PARALLEL_DBS=false

if [ "$REPORT" = "on" ] && [ "$runtime" = "bun" ]; then
    echo "Error: --report (test-execution report) requires vitest; add --use-vitest." >&2
    exit 2
fi

# Wipe .test-report/ when generating either report so each run starts
# clean.
if [ "$REPORT" = "on" ] || [ "$COVERAGE" = "on" ]; then
    clean_report_dir
fi

RUNNER_FLAGS=()
if [ "$COVERAGE" = "on" ]; then
    RUNNER_FLAGS+=(--coverage)
    COV_RUNNER_OUT="$(coverage_runner_flags "$runtime" "${COVERAGE_FORMAT[@]}")" || exit 2
    while IFS= read -r flag; do RUNNER_FLAGS+=("$flag"); done <<<"$COV_RUNNER_OUT"
fi
if [ "$runtime" = "npm" ]; then
    if [ "$REPORT" = "on" ]; then
        for fmt in "${REPORT_FORMAT[@]}"; do RUNNER_FLAGS+=("--reporter=$fmt"); done
    fi
    if [ "$UI" = "on" ]; then RUNNER_FLAGS+=(--ui); fi
fi

run_phase "$runtime" sequential "${WASM_PATHS[@]}" "${RUNNER_FLAGS[@]}" "${EXTRA_ARGS[@]}"
ec=$?
if [ "$ec" -eq 0 ]; then
    if [ "$COVERAGE" = "on" ]; then
        finalize_report "$runtime" "$OPEN_AFTER" "${COVERAGE_FORMAT[@]}" || true
    elif [ "$OPEN_AFTER" = "on" ]; then
        open_report_in_browser || true
    fi
fi
exit "$ec"
