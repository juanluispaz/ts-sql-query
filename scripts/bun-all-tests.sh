#!/bin/bash
# Run the full bun:test matrix under `test/`.
#
# Parallel by default — bun:test is serial out of the box, so we always
# pass `--parallel`. The opt-out is `TSSQLQUERY_PARALLEL_DBS=false`,
# which means "single mode" (serial runner + single shared test DB);
# the `bun:all-tests-single` script wraps that.
#
# Extra args after the script name are appended verbatim, so you can
# combine with --update-snapshots, -t <regex>, --bail, …

PARALLEL_FLAG="--parallel"
if [ "${TSSQLQUERY_PARALLEL_DBS:-true}" = "false" ]; then
    PARALLEL_FLAG=
fi

# Only forward extra args when the caller actually passed some: an
# empty `"$@"` turns into a literal `""` token that `bun test`
# interprets as a filter matching every project file AND exits 99.
if [ "$#" -gt 0 ]; then
    bun test $PARALLEL_FLAG test/ "$@"
else
    bun test $PARALLEL_FLAG test/
fi
ec=$?

# bun:test returns 99 when a fully green run still has leaked handles
# at exit — happens whenever PGlite participates, because its memoised
# worker threads keep the event loop alive. Remap to 0 since "0 fail"
# is the contract we care about.
if [ "$ec" -eq 99 ]; then
    exit 0
fi
exit "$ec"
