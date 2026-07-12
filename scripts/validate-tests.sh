#!/bin/bash
# Type-check the test/ matrix with tsgo, split PER DATABASE.
#
# Why split: compiling the whole matrix + src in a single tsgo program
# peaks at ~12 GB RSS / ~19 GB memory footprint, which the Linux OOM
# killer terminates with SIGKILL on the 16 GB GitHub-hosted runners (and
# on smaller dev machines). Each per-database program peaks well under
# that limit — postgres, the largest slice, ~9.7 GB — and the OS reclaims
# all memory between invocations, so overall peak memory is the single
# largest slice rather than the sum of the matrix.
#
# This is the CI/release entry point (`validate:tests:per-db`); the plain
# `validate:tests` still runs the whole matrix in one tsgo program, which
# is fine on dev machines with enough RAM.
#
# tsgo is a standalone binary (runtime-agnostic), so this script is the
# same whether invoked by `npm run validate:tests:per-db` or `bun run
# validate:tests:per-db`; the package manager puts node_modules/.bin on
# PATH.
#
# Each per-db tsconfig (test/tsconfig.<db>.json) inherits the full
# include from test/tsconfig.json and only excludes the sibling
# databases, so every shared file (test/lib, test/db/general,
# test/templates, src, src/examples) is still type-checked in every
# pass — nothing is dropped, the databases are just partitioned.

set -e

databases=(mariadb mysql oracle postgres sqlite sqlserver)

for db in "${databases[@]}"; do
    echo ""
    echo ">>> validate:tests:per-db — $db"
    tsgo -p "test/tsconfig.$db.json" --noEmit
done

echo ""
echo ">>> validate:tests:per-db — all databases type-checked OK"
