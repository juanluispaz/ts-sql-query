#!/bin/bash
# Standalone checks for the code SEARCHER (the `tests:where-is` tool). Kept OUT of the
# test/ matrix on purpose — see test/lib/codeSearcher/verify.ts.

print_help() {
    cat <<'EOF'
Usage:
  tests:where-is:check [--help]

PURPOSE: regression checks for the code SEARCHER, in two phases. (1) Pure logic, no index and no
DB, always runs: the --coord matrix matching and the door/section/level/preset arg model
(parseArgs/buildOptions). (2) Output regression against the built index: a golden set of
query + render checks, SKIPPED when the index isn't built. Deliberately NOT a *.test.ts, so the
test/ matrix never collects it; run it on demand here. Exits non-zero if any check failed.

The SEARCHER itself is `tests:where-is`; the index it reads is built by `tests:index`.
Reference: test/lib/codeSearcher/CODE_SEARCHER.md. Dispatches to `bun` via `bun run`, else `tsx`.
EOF
}

case "${1:-}" in
    -h|--help) print_help; exit 0 ;;
esac

# shellcheck source=scripts/_test-common.sh
source "$(dirname "$0")/_test-common.sh"

if [ "$(detect_runtime)" = "bun" ]; then
    exec bun test/lib/codeSearcher/verify.ts "$@"
else
    exec tsx test/lib/codeSearcher/verify.ts "$@"
fi
