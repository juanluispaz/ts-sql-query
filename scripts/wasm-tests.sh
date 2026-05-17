#!/bin/bash
# Vitest counterpart to `bun-wasm-tests.sh`. Forces a serial run via
# `--no-file-parallelism` because WASM is CPU-bound and parallel buys
# nothing here.

set -e

exec vitest run --no-file-parallelism \
    test/db/postgres/newest/pglite/ \
    test/db/postgres/oldest/pglite/ \
    test/db/sqlite/newest/sqlite-wasm-OO1/ \
    "$@"
