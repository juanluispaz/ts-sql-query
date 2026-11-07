#!/bin/bash
# Propagate the tests added or changed in a cell file to the other cells. See `tests:propagate --help`.
# Dispatches to `bun` when invoked via `bun run`, else to `tsx`.

# shellcheck source=scripts/_test-common.sh
source "$(dirname "$0")/_test-common.sh"

if [ "$(detect_runtime)" = "bun" ]; then
    exec bun "$(dirname "$0")/../test/lib/authoring/propagate.ts" "$@"
else
    exec tsx "$(dirname "$0")/../test/lib/authoring/propagate.ts" "$@"
fi
