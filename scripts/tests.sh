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
  as mocks. When --wasm is set, a sequential pass runs the WASM cells
  against the real module FIRST, then the parallel main pass runs;
  the WASM summary is re-emitted at the end so both phase summaries
  stay visible after the main pass scrolls. WASM failures short-
  circuit the main pass. This split keeps the parallel main pass fast
  — WASM is CPU-bound and tanks parallel throughput.

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
    run_phase "$runtime" sequential "${WASM_PATHS[@]}" "${EXTRA_ARGS[@]}" 2>&1 | tee "$WASM_LOG"
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
run_phase "$runtime" "$MODE" test/ "${EXTRA_ARGS[@]}"
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
exit "$ec"
