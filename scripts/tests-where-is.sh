#!/bin/bash
# Query the code index for a symbol (the SEARCHER). See `tests:where-is --help`.

print_help() {
    cat <<'EOF'
Usage:
  tests:where-is (--search <name> | --search-pattern <regex> | --search-location <path:line>)
                 [--search-mode <strategy>]… [--db <path>] [--help]

  WHAT to search for (exactly one):
    --search <name>               : an exact symbol/member name (e.g. orderBy, __addOrderBy).
    --search-pattern <regex>      : a JS regex over names (like vitest --testNamePattern) — a
                                    FULL report for every matching name.
    --search-pattern-summary <regex> : same regex, but just a compact LIST of matches to pick.
    --search-location <path:line> : resolves to the function/method ENCLOSING that line and
                                    searches it (e.g. src/connections/MariaDBConnection.ts:84).

  HOW to search — --search-mode is REPEATABLE; combine freely (default: chain-strict):
    --search-mode chain-strict    : CALL-CHAIN — walk the invocation graph upward and stop at
                                    the first PUBLIC caller (the precise route public→internal).
    --search-mode chain-broad     : CALL-CHAIN, but keep climbing PAST the public callers
                                    through the whole graph (wider recall; crosses funnels).
    --search-mode name            : NAME-BASED — every place the name appears across all
                                    dimensions; ignores the call-chain (high recall, low prec.).
  --db <path>                     : index file (default test/lib/codeIndexer/generated/code-index.sqlite).

PURPOSE: the CODE SEARCHER — the consumer half of the code index. Given a symbol
(often an internal one from coverage, e.g. __addOrderBy, or a public name being
weighed), it answers in one markdown report: does it exist? public or internal?
how is it reached from the public API (call-chain)? where is it explained in the
docs, exemplified, and tested? Meant to be pasted into a wave plan as a verifiable
artifact.

This is the SEARCHER. The tool that BUILDS the index (tests:index) is a separate
producer; the searcher only READS it (read-only) and warns if it looks stale vs
the working tree. Build/refresh the index with `tests:index` first.

Reference (queries, output, how to extend): test/lib/codeSearcher/CODE_SEARCHER.md.
Indexer reference: test/lib/codeIndexer/CODE_INDEXER.md.

Dispatches to `bun` when invoked via `bun run`, else to `tsx`.
EOF
}

case "${1:-}" in
    -h|--help) print_help; exit 0 ;;
esac

# shellcheck source=scripts/_test-common.sh
source "$(dirname "$0")/_test-common.sh"

if [ "$(detect_runtime)" = "bun" ]; then
    exec bun test/lib/codeSearcher/search.ts "$@"
else
    exec tsx test/lib/codeSearcher/search.ts "$@"
fi
