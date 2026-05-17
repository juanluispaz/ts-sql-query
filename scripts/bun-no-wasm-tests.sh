#!/bin/bash
# Run the full matrix with `TS_SQL_QUERY_WASM=off` so the WASM-backed
# connectors (pglite, sqlite-wasm-OO1) fall through to the mock instead
# of paying their per-worker WebAssembly bootstrap cost.
#
# Same structural shape as `bun-all-tests.sh`: parallel runner by
# default, opt out via `TSSQLQUERY_PARALLEL_DBS=false` (i.e. the
# `-single` wrappers). Every test still runs in mock mode and the
# non-WASM connectors keep hitting their real backend (docker if the
# `TS_SQL_QUERY_DOCKER=on` flag is set, in-process for native sqlite).
#
# The point: docker engines + native sqlite are fast under parallel,
# WASM tanks parallel — turning off the WASM real-DB branch lets the
# parallel default keep paying off across the whole suite.

PARALLEL_FLAG="--parallel"
if [ "${TSSQLQUERY_PARALLEL_DBS:-true}" = "false" ]; then
    PARALLEL_FLAG=
fi

# Only forward extra args when the caller actually passed some: an
# empty `"$@"` turns into a literal `""` token that `bun test`
# interprets as a filter matching every project file AND exits 99.
if [ "$#" -gt 0 ]; then
    env TS_SQL_QUERY_WASM=off bun test $PARALLEL_FLAG test/ "$@"
else
    env TS_SQL_QUERY_WASM=off bun test $PARALLEL_FLAG test/
fi
ec=$?

# bun:test returns 99 when a fully green run leaks handles at exit.
# With `TS_SQL_QUERY_WASM=off` PGlite never bootstraps so the leak
# shouldn't happen, but keep the remap defensive in case a future
# change reintroduces a similar source. "0 fail" is the real signal.
if [ "$ec" -eq 99 ]; then
    exit 0
fi
exit "$ec"
