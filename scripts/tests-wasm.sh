#!/bin/bash
# Run the WASM cells (pglite, sqlite-wasm-OO1) on their own. Always
# sequential, always real WASM. See `tests:wasm --help`.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./_test-common.sh
. "$SCRIPT_DIR/_test-common.sh"

print_help() {
    cat <<'EOF'
Usage:
  tests:wasm [--help] [-- <args passed to runner>]

Runs only the in-process WASM cells:
  test/db/postgres/newest/pglite/
  test/db/postgres/oldest/pglite/
  test/db/sqlite/newest/sqlite-wasm-OO1/

Always sequential (WASM is CPU-bound; parallel buys nothing) and
always against the real WASM module. No --docker / --mode / --wasm
flags — those are implicit. Use `tests --wasm` if you want this as a
second phase after the full matrix.

Pass-through args after --:
  bun run tests:wasm -- -t insert
  bun run tests:wasm -- --update-snapshots
EOF
}

EXTRA_ARGS=()
while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help)  print_help; exit 0 ;;
        --)         shift; EXTRA_ARGS=("$@"); break ;;
        *)          echo "Unknown argument: $1 (use --help)" >&2; exit 2 ;;
    esac
done

runtime="$(detect_runtime)"
export TS_SQL_QUERY_WASM=on
export TSSQLQUERY_PARALLEL_DBS=false

run_phase "$runtime" sequential "${WASM_PATHS[@]}" "${EXTRA_ARGS[@]}"
exit $?
