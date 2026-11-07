#!/bin/bash
# Add the per-database SQL tabs after the docs ts blocks that run a query. See `docs:sql-tabs --help`.
# Dispatches to `bun` when invoked via `bun run`, else to `tsx`.

# shellcheck source=scripts/_test-common.sh
source "$(dirname "$0")/_test-common.sh"

if [ "$(detect_runtime)" = "bun" ]; then
    exec bun "$(dirname "$0")/../test/lib/authoring/docSqlTabs.ts" "$@"
else
    exec tsx "$(dirname "$0")/../test/lib/authoring/docSqlTabs.ts" "$@"
fi
