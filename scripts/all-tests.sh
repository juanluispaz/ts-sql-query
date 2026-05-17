#!/bin/bash
# Run the full vitest matrix under `test/`.
#
# Vitest's default pool runs files in parallel; the script just delegates.
# Single mode (`TSSQLQUERY_PARALLEL_DBS=false`) forces a serial run by
# adding `--no-file-parallelism`, so the runner uses one worker and the
# per-worker DB infra collapses to a single shared database.
#
# Extra args are appended verbatim.

set -e

SERIAL_FLAG=
if [ "${TSSQLQUERY_PARALLEL_DBS:-true}" = "false" ]; then
    SERIAL_FLAG="--no-file-parallelism"
fi

exec vitest run $SERIAL_FLAG test/ "$@"
