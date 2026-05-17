#!/bin/bash
# Run the full matrix with `TS_SQL_QUERY_WASM=off` so the WASM-backed
# connectors (pglite, sqlite-wasm-OO1) fall through to the mock instead
# of paying their per-worker WebAssembly bootstrap cost.
#
# Same dispatch logic as `all-tests.sh`: detects `bun run` vs `npm run`
# via `npm_config_user_agent`, defaults to bun on direct invocation.
# Parallel by default — opt out via `TSSQLQUERY_PARALLEL_DBS=false`.
#
# The point: docker engines + native sqlite are fast under parallel,
# WASM tanks parallel — turning off the WASM real-DB branch lets the
# parallel default keep paying off across the whole suite.

runtime="${npm_config_user_agent%%/*}"
if [ -z "$runtime" ]; then
    runtime="bun"
fi

export TS_SQL_QUERY_WASM=off

if [ "$runtime" = "bun" ]; then
    PARALLEL_FLAG="--parallel"
    if [ "${TSSQLQUERY_PARALLEL_DBS:-true}" = "false" ]; then
        PARALLEL_FLAG=
    fi
    if [ "$#" -gt 0 ]; then
        bun test $PARALLEL_FLAG test/ "$@"
    else
        bun test $PARALLEL_FLAG test/
    fi
    ec=$?
    # With `TS_SQL_QUERY_WASM=off` PGlite never bootstraps so the
    # exit-99 leaked-handle case shouldn't happen, but keep the remap
    # defensive in case a future change reintroduces a similar source.
    if [ "$ec" -eq 99 ]; then
        exit 0
    fi
    exit "$ec"
else
    SERIAL_FLAG=
    if [ "${TSSQLQUERY_PARALLEL_DBS:-true}" = "false" ]; then
        SERIAL_FLAG="--no-file-parallelism"
    fi
    exec vitest run $SERIAL_FLAG test/ "$@"
fi
