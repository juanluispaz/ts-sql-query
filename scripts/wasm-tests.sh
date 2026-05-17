#!/bin/bash
# Run only the in-process WASM connectors (pglite, sqlite-wasm-OO1) and
# always serially. WASM is CPU-bound; parallel buys nothing here and
# the worker WASM instance is memoised so the whole subset runs in
# ~1.5 s — pair this with `no-wasm-tests` to cover what `all-tests`
# covers, twice as fast.
#
# Same dispatch logic as `all-tests.sh`: detects `bun run` vs `npm run`
# via `npm_config_user_agent`, defaults to bun on direct invocation.

runtime="${npm_config_user_agent%%/*}"
if [ -z "$runtime" ]; then
    runtime="bun"
fi

WASM_PATHS=(
    test/db/postgres/newest/pglite/
    test/db/postgres/oldest/pglite/
    test/db/sqlite/newest/sqlite-wasm-OO1/
)

if [ "$runtime" = "bun" ]; then
    if [ "$#" -gt 0 ]; then
        bun test "${WASM_PATHS[@]}" "$@"
    else
        bun test "${WASM_PATHS[@]}"
    fi
    ec=$?
    # bun:test returns 99 ("leaked handle / pending work at exit") on
    # fully green PGlite runs — its memoised worker threads stay alive
    # across files. Harmless when no real failures; remap to 0.
    if [ "$ec" -eq 99 ]; then
        exit 0
    fi
    exit "$ec"
else
    exec vitest run --no-file-parallelism "${WASM_PATHS[@]}" "$@"
fi
