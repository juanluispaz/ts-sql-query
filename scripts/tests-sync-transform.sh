#!/bin/bash
# Rewrite test files of the -sync cells to the sync() form. See `tests:sync-transform --help`.
# Dispatches to `bun` when invoked via `bun run`, else to `tsx`.

# shellcheck source=scripts/_test-common.sh
source "$(dirname "$0")/_test-common.sh"

if [ "$(detect_runtime)" = "bun" ]; then
    exec bun "$(dirname "$0")/../test/lib/authoring/syncTransform.ts" "$@"
else
    exec tsx "$(dirname "$0")/../test/lib/authoring/syncTransform.ts" "$@"
fi
