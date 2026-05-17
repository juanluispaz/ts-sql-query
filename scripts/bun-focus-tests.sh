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
exec bun test "$target" "$@"
