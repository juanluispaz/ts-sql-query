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
                      [--help]
                      [-- <args passed to runner>]

Runs tests for one coordinate under test/db/. Same flags as `tests`;
--wasm in focused mode is a single-pass override (real WASM for the
focused cell), not the two-phase split.

<coord> = <db>[/<version>[/<connector>[/<file>]]]
  postgres
  postgres/newest
  postgres/newest/pg
  postgres/newest/pg/select.basic.test.ts

Defaults
  --mode          parallel
  --docker        off
  --docker-mode   reuse
  --wasm          off

Flags
  --mode <parallel|sequential>          default parallel
  --docker                              real docker backends
  --docker-mode <reuse|no-reuse>        default reuse
  --wasm                                real WASM for this run (single
                                        pass; combine with --mode
                                        sequential to avoid CPU
                                        contention on a wasm cell)
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
EOF
}

COORD=""
MODE=parallel
DOCKER=off
DOCKER_MODE=reuse
WASM=off
EXTRA_ARGS=()

while [ $# -gt 0 ]; do
    case "$1" in
        --mode)             MODE="$2"; shift 2 ;;
        --mode=*)           MODE="${1#--mode=}"; shift ;;
        --docker)           DOCKER=on; shift ;;
        --docker-mode)      DOCKER_MODE="$2"; shift 2 ;;
        --docker-mode=*)    DOCKER_MODE="${1#--docker-mode=}"; shift ;;
        --wasm)             WASM=on; shift ;;
        -h|--help)          print_help; exit 0 ;;
        --)                 shift; EXTRA_ARGS=("$@"); break ;;
        --*)                echo "Unknown argument: $1 (use --help)" >&2; exit 2 ;;
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

target="test/db/$COORD"
if [ ! -e "$target" ]; then
    echo "Coordinate not found: $COORD (looked for $target)" >&2
    exit 1
fi
# Append `/` for directories so the runner treats it as a path filter,
# not a project-name filter.
if [ -d "$target" ]; then target="$target/"; fi

runtime="$(detect_runtime)"
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

run_phase "$runtime" "$MODE" "$target" "${EXTRA_ARGS[@]}"
exit $?
