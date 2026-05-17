#!/bin/bash
# Run bun:test against a single (database × version × connector) coordinate.
#
# Usage:
#   bun run bun:focus-tests <database>/<version>/<connector> [extra bun args]
#
# Examples:
#   bun run bun:focus-tests pilot-postgres/newest/pg
#   bun run bun:focus-tests pilot-postgres/newest/pg --update-snapshots
#   bun run bun:focus-tests pilot-postgres/oldest                  # all connectors of a version
#   bun run bun:focus-tests pilot-postgres                         # whole database
#
# The TS_SQL_QUERY_DBS / TS_SQL_QUERY_DOCKER flags still apply; set them
# in the environment if you want to gate the real-DB branch:
#
#   TS_SQL_QUERY_DOCKER=on bun run bun:focus-tests pilot-postgres/newest/pg

set -e

if [ -z "$1" ]; then
    echo "Usage: bun run bun:focus-tests <database>[/<version>[/<connector>]] [extra args]" >&2
    exit 2
fi

target="test/db/$1"
if [ ! -e "$target" ]; then
    echo "Coordinate not found: $1 (looked for $target)" >&2
    exit 1
fi

shift
exec bun test "$target/" "$@"
