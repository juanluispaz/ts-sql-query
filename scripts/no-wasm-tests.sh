#!/bin/bash
# Vitest counterpart to `bun-no-wasm-tests.sh`. Sets
# `TS_SQL_QUERY_WASM=off` so the WASM connectors fall through to mock
# mode; every test file still runs, the docker-backed and native
# in-process connectors still hit their real backend.

set -e

SERIAL_FLAG=
if [ "${TSSQLQUERY_PARALLEL_DBS:-true}" = "false" ]; then
    SERIAL_FLAG="--no-file-parallelism"
fi

exec env TS_SQL_QUERY_WASM=off vitest run $SERIAL_FLAG test/ "$@"
