#!/bin/bash
# Type-check the test/ matrix with tsgo, split one tsgo program PER CONNECTOR
# so each slice fits the 16 GB GitHub-hosted CI runners.
#
# Why split at all: compiling the whole matrix + src in a single tsgo
# program peaks past ~17 GB, which the Linux OOM killer terminates with
# SIGKILL on the 16 GB runners (and on smaller dev machines). The OS
# reclaims all memory between invocations, so the overall peak is the
# single largest slice rather than the sum of the matrix.
#
# Why PER CONNECTOR (not per database): sqlite alone has grown to ~11 k test
# files across ~10 connectors (each query runner + its -sync twin), so a
# single sqlite program peaks ~13 GB and OOM-kills the runner. Splitting per
# database is no longer enough for sqlite, and rather than special-case one
# database this script splits EVERY database the same way — one program per
# connector. Each connector is ~0.5–1.3 k files and peaks ~6 GB, with huge
# headroom under 16 GB; the whole-run peak is now the single largest
# connector, not the largest database.
#
# The per-connector configs are generated on the fly from the connector
# directories on disk (test/db/<db>/<version>/<connector>), so a newly added
# connector — or a whole new database — is picked up with NO edit here,
# mirroring the INCLUDE-driven philosophy of test/tsconfig.newest.json. There
# are no committed test/tsconfig.<db>.json files to keep in sync anymore.
#
# Every slice still type-checks all the shared files (test/lib,
# test/db/general, test/templates, each db's runners.ts + types.negative +
# domain, src, src/examples) — nothing is dropped, the TEST CELLS are just
# partitioned. Per-connector cells are independent .test.ts files with no
# type dependency between connectors, so partitioning them is sound.
#
# This is `npm run validate:tests`, the authoritative test-scope typecheck
# CI/release gates on. (There is no single whole-matrix program anymore — one
# tsgo program over the full test/tsconfig.json + src OOMs past ~17 GB, so it
# was removed; this split gives identical coverage in far less RAM.)
#
# tsgo is a standalone binary (runtime-agnostic), so this script is the
# same whether invoked by `npm run validate:tests` or `bun run
# validate:tests`; the package manager puts node_modules/.bin on PATH.

set -e

# Remove any generated per-connector config, even on failure / interrupt,
# so an aborted run never dirties the tree. The pattern is also gitignored.
trap 'rm -f test/tsconfig.*.generated.json' EXIT

databases=(mariadb mysql oracle postgres sqlite sqlserver)

for db in "${databases[@]}"; do
    # Connector directories live at test/db/<db>/<version>/<connector>; the
    # distinct basenames at that depth are the connectors (includes
    # `documentation`; excludes the depth-1 shared `types.negative`/`domain`).
    connectors=$(find "test/db/$db" -mindepth 2 -maxdepth 2 -type d | sed -E 's#.*/##' | sort -u)
    for connector in $connectors; do
        cfg="test/tsconfig.$db.$connector.generated.json"
        # Shared infra + src + exactly one connector's cells. Paths are
        # relative to test/ (where `extends: ./tsconfig.json` resolves).
        cat > "$cfg" <<EOF
{
    "extends": "./tsconfig.json",
    "include": [
        "lib/**/*.ts",
        "templates/**/*.ts",
        "db/general/**/*.ts",
        "db/$db/runners.ts",
        "db/$db/types.negative/**/*.ts",
        "db/$db/domain/**/*.ts",
        "db/$db/*/$connector/**/*.ts",
        "../src/**/*.ts"
    ]
}
EOF
        echo ""
        echo ">>> validate:tests — $db/$connector"
        tsgo -p "$cfg" --noEmit
        rm -f "$cfg"
    done
done

echo ""
echo ">>> validate:tests — all connectors type-checked OK"
