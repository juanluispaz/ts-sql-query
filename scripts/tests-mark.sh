#!/bin/bash
# Comment out named tests under a reason marker, or bring them back. See `tests:mark --help`.
# Dispatches to `bun` when invoked via `bun run`, else to `tsx`.

# shellcheck source=scripts/_test-common.sh
source "$(dirname "$0")/_test-common.sh"

if [ "$(detect_runtime)" = "bun" ]; then
    exec bun "$(dirname "$0")/../test/lib/authoring/markTests.ts" "$@"
else
    exec tsx "$(dirname "$0")/../test/lib/authoring/markTests.ts" "$@"
fi
