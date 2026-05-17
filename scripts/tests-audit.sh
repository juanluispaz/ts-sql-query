#!/bin/bash
# Run the test-symmetry audit. See `tests:audit --help`.

print_help() {
    cat <<'EOF'
Usage:
  tests:audit [--help]

Walks test/db/ and verifies the symmetry rule (DESIGN.md §4): every
cell of a database must declare the same `.test.ts` files with the
same `describe` / `test` names in the same order (executed OR
commented out).

Exit code 0 on a symmetric matrix, 1 on any divergence. Useful as a
pre-merge check; runs in well under a second.

The audit script lives at test/lib/auditTestSymmetry.ts and is
type-checked by `bun run validate:tests`.
EOF
}

case "${1:-}" in
    -h|--help) print_help; exit 0 ;;
esac

exec tsx test/lib/auditTestSymmetry.ts "$@"
