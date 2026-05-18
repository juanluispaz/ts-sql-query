#!/bin/bash
# Run tests for a single coordinate. See `tests:focus --help`.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./_test-common.sh
. "$SCRIPT_DIR/_test-common.sh"

print_help() {
    cat <<'EOF'
Usage:
  tests:focus <coord> [--mode <parallel|sequential>]
                      [--docker] [--docker-mode <reuse|no-reuse>]
                      [--wasm]
                      [--use-vitest] [--ui]
                      [--report    [--report-format <name>]…]
                      [--coverage  [--coverage-format <name>]…]
                      [--open]
                      [--help]
                      [-- <args passed to runner>]

Runs tests for one coordinate under test/db/. Same flags as `tests`;
--wasm in focused mode is a single-pass override (real WASM for the
focused cell), not the two-phase split. `--use-vitest`, `--ui` and
`--report` force the vitest path. See `tests --help` for the full
runner trade-off.

<coord> = <db>[/<version>[/<connector>[/<file>]]]
  postgres
  postgres/newest
  postgres/newest/pg
  postgres/newest/pg/select.basic.test.ts

Defaults
  --mode             parallel
  --docker           off
  --docker-mode      reuse
  --wasm             off
  --use-vitest       off
  --ui               off (implies --use-vitest)
  --report           off (test-exec report; vitest-only)
  --report-format    html (when --report is on)
  --coverage         off
  --coverage-format  html (when --coverage is on)
  --open             off

Flags
  --mode <parallel|sequential>          default parallel
  --docker                              real docker backends
  --docker-mode <reuse|no-reuse>        default reuse
  --wasm                                real WASM for this run
  --use-vitest                          force vitest runtime
  --ui                                  @vitest/ui (implies --use-vitest)
  --report                              emit test-execution report at
                                        .test-report/ (vitest-only,
                                        implies --use-vitest)
  --report-format <name>                repeatable; default html when
                                        --report is on. Setting it
                                        implies --report.
  --coverage                            emit a coverage report at
                                        .test-report/coverage/. The
                                        report dir is wiped before
                                        each run. Forbidden with
                                        --wasm under --mode parallel.
  --coverage-format <name>              repeatable; default html when
                                        --coverage is on. Under
                                        vitest, any @vitest/coverage-v8
                                        reporter. Under bun, restricted
                                        to html|text|lcov, one value.
                                        Scope set in bunfig.toml +
                                        vitest.config.ts.
  --open                                open the most useful report
                                        (test-exec SPA via vite preview
                                        if present, else coverage html
                                        via file://). Requires html in
                                        --report-format or
                                        --coverage-format.
  -h, --help                            show this help

Pass-through args after --:
  bun run tests:focus postgres/newest/pg -- -t inner-join
  bun run tests:focus postgres/newest/pg --docker -- --update-snapshots
  npm  run tests:focus postgres/newest/pg --docker -- -- -u

Examples
  bun run tests:focus postgres/newest/pg
  bun run tests:focus postgres/newest/pg --docker
  bun run tests:focus postgres/oldest/pglite --wasm --mode sequential
  bun run tests:focus postgres/newest/pg/select.basic.test.ts -- -t inner-join
  bun run tests:focus postgres --use-vitest --coverage --open
  bun run tests:focus postgres --report --coverage --open
  bun run tests:focus postgres --ui --coverage           # interactive UI
EOF
}

COORD=""
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
        --*)                    echo "Unknown argument: $1 (use --help)" >&2; exit 2 ;;
        *)
            if [ -z "$COORD" ]; then
                COORD="$1"
            else
                echo "Unexpected positional argument: $1 (already have <coord>=$COORD)" >&2
                exit 2
            fi
            shift
            ;;
    esac
done

if [ -z "$COORD" ]; then
    echo "Missing <coord>. Run \`tests:focus --help\` for usage." >&2
    exit 2
fi
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

# Same forbidden combo as `tests` — under parallel workers each emits
# its own coverage shard; combined with WASM CPU contention this
# yields an unreliable report. Force the user to pick sequential or
# drop one of --wasm / --coverage.
if [ "$COVERAGE" = "on" ] && [ "$WASM" = "on" ] && [ "$MODE" = "parallel" ]; then
    echo "Error: --coverage cannot be combined with --wasm under --mode parallel." >&2
    echo "  Pass --mode sequential, drop --wasm, or drop --coverage." >&2
    exit 2
fi

target="test/db/$COORD"
if [ ! -e "$target" ]; then
    echo "Coordinate not found: $COORD (looked for $target)" >&2
    exit 1
fi
# Append `/` for directories so the runner treats it as a path filter,
# not a project-name filter.
if [ -d "$target" ]; then target="$target/"; fi

runtime="$(detect_runtime)"
if [ "$USE_VITEST" = "on" ]; then runtime="npm"; fi
export TS_SQL_QUERY_DOCKER="$DOCKER"
if [ "$DOCKER_MODE" = "reuse" ]; then export TESTCONTAINERS_REUSE_ENABLE=true; fi
if [ "$MODE" = "sequential" ]; then export TSSQLQUERY_PARALLEL_DBS=false; fi
# In focused mode --wasm is a single-pass override. The user gets
# real WASM for this run; main test still uses the two-phase split.
if [ "$WASM" = "on" ]; then
    export TS_SQL_QUERY_WASM=on
else
    export TS_SQL_QUERY_WASM=off
fi

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

run_phase "$runtime" "$MODE" "$target" "${RUNNER_FLAGS[@]}" "${EXTRA_ARGS[@]}"
ec=$?
if [ "$ec" -eq 0 ]; then
    if [ "$COVERAGE" = "on" ]; then
        finalize_report "$runtime" "$OPEN_AFTER" "${COVERAGE_FORMAT[@]}" || true
    elif [ "$OPEN_AFTER" = "on" ]; then
        open_report_in_browser || true
    fi
fi
exit "$ec"
