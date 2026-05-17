#!/bin/bash
# Run vitest against a single (database × version × connector) coordinate.
#
# Usage:
#   bun run focus-tests <coord> [extra vitest args]
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
#   bun run focus-tests postgres/newest/pg -u                       # refresh snapshots
#   bun run focus-tests postgres/newest/pg -t inner-join            # only tests whose name matches
#   bun run focus-tests postgres/newest/pg/select.basic.test.ts -u  # narrow to one file
#   bun run focus-tests postgres/newest/pg/select.basic.test.ts -t inner-join -u
#
# Filtering reference:
#   -t / --testNamePattern <regex>  pass through to vitest; combines with the
#                                   <coord> path filter.
#   -u                              update inline snapshots for what was run.
#
# The TS_SQL_QUERY_DBS / TS_SQL_QUERY_DOCKER flags still apply; set them
# in the environment if you want to gate the real-DB branch:
#
#   TS_SQL_QUERY_DOCKER=on bun run focus-tests postgres/newest/pg

set -e

if [ -z "$1" ]; then
    echo "Usage: bun run focus-tests <database>[/<version>[/<connector>[/<file>]]] [extra args]" >&2
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

# Vitest's default pool runs files in parallel; single mode
# (`TSSQLQUERY_PARALLEL_DBS=false`) forces a serial run by adding
# `--no-file-parallelism`, collapsing the per-worker DB infra to a
# single shared database — useful for debugging one cell in isolation.
SERIAL_FLAG=
if [ "${TSSQLQUERY_PARALLEL_DBS:-true}" = "false" ]; then
    SERIAL_FLAG="--no-file-parallelism"
fi

exec vitest run $SERIAL_FLAG "$target" "$@"
