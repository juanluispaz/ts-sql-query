#!/bin/bash
# Run ALL code generators: the Prisma clients (codegen:prisma) and the
# documentation code extractor (codegen:doc-code). This umbrella is what GitHub
# CI invokes (except the v1 line). See `codegen --help`.

print_help() {
    cat <<'EOF'
Usage:
  codegen [--help]

Runs every code generator, in order:
  1. codegen:prisma     generate the per-database Prisma clients used by the
                        src/examples/prisma/ examples
  2. codegen:doc-code   extract compilable TypeScript from the documentation
                        snippets into test/db/<db>/newest/documentation/ cells

Each sub-generator is invoked through the same runtime that launched this
script (bun via `bun run`, npm via `npm run`), so the bun-first dev loop and the
npm-based CI/publish path both stay consistent.
EOF
}

case "${1:-}" in
    -h|--help) print_help; exit 0 ;;
esac

set -e

# shellcheck source=scripts/_test-common.sh
source "$(dirname "$0")/_test-common.sh"
rt="$(detect_runtime)"

"$rt" run codegen:prisma
"$rt" run codegen:doc-code
