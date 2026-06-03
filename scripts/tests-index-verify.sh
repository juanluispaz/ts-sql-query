#!/bin/bash
# Smoke / invariant check for the code indexer. See `tests:index --help` for the indexer itself.

print_help() {
    cat <<'EOF'
Usage:
  tests:index:verify [--help]

PURPOSE: a fast structural smoke test of the CODE INDEXER. Re-runs extraction in
--no-resolve mode (no type checker, no DB, no subprocess; ~4 s) and asserts a set of
invariants on the produced rows IN MEMORY — counts within range, referential integrity
of the structural foreign keys, id uniqueness, the reconcile sources, the negative-type
rows. It guards the SHAPE of the index so a refactor that silently breaks an extractor
is caught. It does NOT exercise type resolution (the slow/heavy path).

Exits non-zero on the first failing invariant set.

Reference: test/lib/codeIndexer/CODE_INDEXER.md. Dispatches to `bun` via `bun run`, else `tsx`.
EOF
}

case "${1:-}" in
    -h|--help) print_help; exit 0 ;;
esac

# shellcheck source=scripts/_test-common.sh
source "$(dirname "$0")/_test-common.sh"

if [ "$(detect_runtime)" = "bun" ]; then
    exec bun test/lib/codeIndexer/verify.ts "$@"
else
    exec tsx test/lib/codeIndexer/verify.ts "$@"
fi
