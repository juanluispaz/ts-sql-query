#!/bin/bash
# Run bun:test against a single (database × version × connector) coordinate.
#
# Usage:
#   bun run bun:focus-tests <coord> [extra bun args]
#
# Where <coord> is one of:
#   <database>                                     whole database (e.g. postgres)
#   <database>/<version>                           one version (e.g. postgres/oldest)
#   <database>/<version>/<connector>               one cell (e.g. postgres/newest/pg)
#   <database>/<version>/<connector>/<file>        one test file
#                                                   (e.g. postgres/newest/pg/select.basic.test.ts)
#
# Examples:
#   bun run bun:focus-tests postgres/newest/pg
#   bun run bun:focus-tests postgres/newest/pg --update-snapshots                # refresh snapshots
#   bun run bun:focus-tests postgres/newest/pg -t inner-join                     # only tests whose name matches
#   bun run bun:focus-tests postgres/newest/pg/select.basic.test.ts --update-snapshots
#   bun run bun:focus-tests postgres/newest/pg/select.basic.test.ts -t inner-join --update-snapshots
#
# Filtering reference:
#   -t / --test-name-pattern <regex>  pass through to bun:test; combines with the
#                                     <coord> path filter.
#   --update-snapshots                update inline snapshots for what was run.
#
# The TS_SQL_QUERY_DBS / TS_SQL_QUERY_DOCKER flags still apply; set them
# in the environment if you want to gate the real-DB branch:
#
#   TS_SQL_QUERY_DOCKER=on bun run bun:focus-tests postgres/newest/pg

set -e

if [ -z "$1" ]; then
    echo "Usage: bun run bun:focus-tests <database>[/<version>[/<connector>[/<file>]]] [extra args]" >&2
    exit 2
fi

target="test/db/$1"
if [ ! -e "$target" ]; then
    echo "Coordinate not found: $1 (looked for $target)" >&2
    exit 1
fi

# Only append a trailing `/` when the target is a directory — files must be
# passed verbatim so `<coord>/<file>.test.ts` runs that single test file.
if [ -d "$target" ]; then
    target="$target/"
fi

shift

# Parallel by default — bun:test is serial out of the box, so we always
# pass `--parallel`. The opt-out is `TSSQLQUERY_PARALLEL_DBS=false`,
# which means "single mode" (serial runner + single shared test DB);
# the `bun:focus-tests-single` script wraps that.
PARALLEL_FLAG="--parallel"
if [ "${TSSQLQUERY_PARALLEL_DBS:-true}" = "false" ]; then
    PARALLEL_FLAG=
fi

# Only forward extra args when the caller actually passed some: an
# empty `"$@"` turns into a literal `""` token that `bun test`
# interprets as a filter matching every project file AND exits 99.
if [ "$#" -gt 0 ]; then
    bun test "$target" $PARALLEL_FLAG "$@"
else
    bun test "$target" $PARALLEL_FLAG
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
