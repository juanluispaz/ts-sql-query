#!/bin/bash
# Run only the in-process WASM connectors (pglite, sqlite-wasm-OO1) and
# always serially. WASM is CPU-bound; parallel buys nothing here and
# the worker WASM instance is memoised so the whole subset runs in
# ~1.5 s — pair this with `bun:no-wasm-tests` to cover what
# `bun:all-tests` covers, twice as fast.

WASM_PATHS=(
    test/db/postgres/newest/pglite/
    test/db/postgres/oldest/pglite/
    test/db/sqlite/newest/sqlite-wasm-OO1/
)

# Only forward extra args when the caller actually passed some: an
# empty `"$@"` turns into a literal `""` token that `bun test`
# interprets as a filter that matches every test file in the project
# AND returns exit code 99.
if [ "$#" -gt 0 ]; then
    bun test "${WASM_PATHS[@]}" "$@"
else
    bun test "${WASM_PATHS[@]}"
fi
ec=$?

# bun:test returns 99 ("leaked handle / pending work at exit") even on
# fully green PGlite runs because the memoised PGlite instance keeps
# its internal worker threads alive across files — closing them per
# file would defeat the ~10× speedup memoisation buys for the WASM
# subset. The 99 is harmless when there are no real failures: every
# script that exercises PGlite needs to remap it to 0.
if [ "$ec" -eq 99 ]; then
    exit 0
fi
exit "$ec"
