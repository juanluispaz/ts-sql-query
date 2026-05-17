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
        [--help]
        [-- <args passed to runner>]

Runs every test under test/. Dispatches to `bun test` when invoked
via `bun run`, and to `vitest run` when invoked via `npm run`. Direct
invocation (`sh scripts/tests.sh`) defaults to bun.

Defaults
  --mode          parallel
  --docker        off (docker cells fall through to mock)
  --docker-mode   reuse  (containers stay alive between invocations)
  --wasm          off (WASM cells fall through to mock — modules are
                  never imported, so their bootstrap cost is paid by
                  nothing)

WASM semantics
  The main pass ALWAYS runs WASM connectors (pglite, sqlite-wasm-OO1)
  as mocks. When --wasm is set, a second sequential pass runs only
  the WASM cells against the real module. Both passes must succeed
  for the script to exit 0. This split keeps the parallel main pass
  fast — WASM is CPU-bound and tanks parallel throughput.

Flags
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
  -h, --help
        Show this help and exit.

Pass-through args
  Anything after `--` is forwarded to every phase's test runner.

  bun run tests -- -t inner-join                  # match test name
  bun run tests --docker -- --update-snapshots    # bun: refresh snapshots
  npm  run tests --docker -- -- -u                # vitest: refresh snapshots

  (npm strips a leading `--`, hence the double `--` when forwarding
  flags through npm run.)

Examples
  bun run tests                                   # fast local: no real backends
  bun run tests --docker                          # + docker
  bun run tests --docker --wasm                   # full matrix (~21 s)
  bun run tests --docker --docker-mode no-reuse   # CI-style hermetic
  bun run tests --mode sequential                 # debug under serial
EOF
}

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
        *)                  echo "Unknown argument: $1 (use --help)" >&2; exit 2 ;;
    esac
done

case "$MODE" in parallel|sequential) ;; *)
    echo "Invalid --mode: $MODE (expected parallel|sequential)" >&2; exit 2 ;;
esac
case "$DOCKER_MODE" in reuse|no-reuse) ;; *)
    echo "Invalid --docker-mode: $DOCKER_MODE (expected reuse|no-reuse)" >&2; exit 2 ;;
esac

runtime="$(detect_runtime)"
export TS_SQL_QUERY_DOCKER="$DOCKER"
if [ "$DOCKER_MODE" = "reuse" ]; then export TESTCONTAINERS_REUSE_ENABLE=true; fi
if [ "$MODE" = "sequential" ]; then export TSSQLQUERY_PARALLEL_DBS=false; fi

# Main pass: full matrix, WASM as mock (no module import).
export TS_SQL_QUERY_WASM=off
run_phase "$runtime" "$MODE" test/ "${EXTRA_ARGS[@]}"
ec=$?
if [ "$ec" -ne 0 ]; then exit "$ec"; fi

# Optional real-WASM pass: only the WASM cells, always sequential.
if [ "$WASM" = "on" ]; then
    export TS_SQL_QUERY_WASM=on
    export TSSQLQUERY_PARALLEL_DBS=false
    run_phase "$runtime" sequential "${WASM_PATHS[@]}" "${EXTRA_ARGS[@]}"
    ec=$?
fi
exit "$ec"
