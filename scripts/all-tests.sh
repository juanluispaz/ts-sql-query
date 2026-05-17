#!/bin/bash
# Run the full test matrix under `test/`.
#
# Dispatches between `bun test` and `vitest run` based on the runtime
# that invoked the script. Both `npm run` and `bun run` set
# `npm_config_user_agent` (e.g. `npm/10.x …` vs `bun/1.x …`); the prefix
# before the first `/` is what we branch on. Direct invocation (no var)
# defaults to bun, since day-to-day dev in this project prefers Bun.
#
# Parallel by default. Opt out with `TSSQLQUERY_PARALLEL_DBS=false`,
# which collapses both runners to a single-worker run (and the
# per-worker DB infra to a single shared database).
#
# Extra args are appended verbatim (e.g. -t <regex>, --update-snapshots
# under bun / -u under vitest, --bail, …).

runtime="${npm_config_user_agent%%/*}"
if [ -z "$runtime" ]; then
    runtime="bun"
fi

if [ "$runtime" = "bun" ]; then
    PARALLEL_FLAG="--parallel"
    if [ "${TSSQLQUERY_PARALLEL_DBS:-true}" = "false" ]; then
        PARALLEL_FLAG=
    fi
    # An empty `"$@"` turns into a literal `""` token that `bun test`
    # interprets as a filter matching every project file AND exits 99.
    if [ "$#" -gt 0 ]; then
        bun test $PARALLEL_FLAG test/ "$@"
    else
        bun test $PARALLEL_FLAG test/
    fi
    ec=$?
    # bun:test returns 99 when a fully green run leaks handles at exit
    # — happens with PGlite (its worker threads stay alive). "0 fail"
    # is the real signal, so remap.
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
