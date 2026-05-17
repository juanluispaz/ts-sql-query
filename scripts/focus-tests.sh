#!/bin/bash
# Run tests against a single (database × version × connector) coordinate.
#
# Usage:
#   npm run focus-tests <coord> [extra args]
#   bun run focus-tests <coord> [extra args]
#
# Where <coord> is one of:
#   <database>                                     whole database (e.g. postgres)
#   <database>/<version>                           one version (e.g. postgres/oldest)
#   <database>/<version>/<connector>               one cell (e.g. postgres/newest/pg)
#   <database>/<version>/<connector>/<file>        one test file
#                                                   (e.g. postgres/newest/pg/select.basic.test.ts)
#
# Examples:
#   bun run focus-tests postgres/newest/pg
#   bun run focus-tests postgres/newest/pg --update-snapshots          # bun: refresh snapshots
#   npm run focus-tests postgres/newest/pg -u                          # vitest equivalent
#   bun run focus-tests postgres/newest/pg -t inner-join               # match by name
#   bun run focus-tests postgres/newest/pg/select.basic.test.ts -t inner-join
#
# Dispatches between `bun test` and `vitest run` based on the runtime
# that invoked the script (`npm_config_user_agent` prefix). Direct
# invocation defaults to bun. Parallel by default — opt out with
# `TSSQLQUERY_PARALLEL_DBS=false`.
#
# The TS_SQL_QUERY_DBS / TS_SQL_QUERY_DOCKER flags still apply; set them
# in the environment if you want to gate the real-DB branch:
#
#   TS_SQL_QUERY_DOCKER=on bun run focus-tests postgres/newest/pg

set -e

if [ -z "$1" ]; then
    echo "Usage: focus-tests <database>[/<version>[/<connector>[/<file>]]] [extra args]" >&2
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

runtime="${npm_config_user_agent%%/*}"
if [ -z "$runtime" ]; then
    runtime="bun"
fi

if [ "$runtime" = "bun" ]; then
    PARALLEL_FLAG="--parallel"
    if [ "${TSSQLQUERY_PARALLEL_DBS:-true}" = "false" ]; then
        PARALLEL_FLAG=
    fi
    if [ "$#" -gt 0 ]; then
        bun test "$target" $PARALLEL_FLAG "$@"
    else
        bun test "$target" $PARALLEL_FLAG
    fi
    ec=$?
    if [ "$ec" -eq 99 ]; then
        exit 0
    fi
    exit "$ec"
else
    SERIAL_FLAG=
    if [ "${TSSQLQUERY_PARALLEL_DBS:-true}" = "false" ]; then
        SERIAL_FLAG="--no-file-parallelism"
    fi
    exec vitest run $SERIAL_FLAG "$target" "$@"
fi
