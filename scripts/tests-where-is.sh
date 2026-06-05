#!/bin/bash
# Query the code index for a symbol (the SEARCHER). See `tests:where-is --help`.

# --help: print a short purpose banner, then fall through to search.ts --help (the
# authoritative, always-in-sync flag list). The old embedded usage is gone so the two
# can never drift.
print_help_banner() {
    cat <<'EOF'
PURPOSE: the CODE SEARCHER — the consumer half of the code index. Pick ONE door (what to
search), then shape the report with one levelled flag per section (--chain/--producers/--tests/
--version-gates/--bugs/…; "none" hides it), narrow with filters, or preset with --for <intent>.
The old --search-mode is gone (--chain / --name-search replace it). New doors: --emits-keyword,
--location-target callees, and a TEST-file --search-location (inverse search). --coord <db[/version[/
connector[/file]]]> is the single global focus (glob/brace, repeatable) across every db/cell-aware
section, incl. legacy examples; the 4th file level coexists with --file-name-pattern. Index = --index.

This is the SEARCHER; tests:index BUILDS the index (a separate producer). It only READS the
index (read-only) and warns if it looks stale. Build/refresh it with `tests:index` first.
Reference: test/lib/codeSearcher/CODE_SEARCHER.md · model/rationale: test/lib/codeSearcher/MODEL.md.

--- full flag list (from search.ts) ---
EOF
}

case "${1:-}" in
    -h|--help) print_help_banner ;;   # then fall through to search.ts --help below
esac

# shellcheck source=scripts/_test-common.sh
source "$(dirname "$0")/_test-common.sh"

if [ "$(detect_runtime)" = "bun" ]; then
    exec bun test/lib/codeSearcher/search.ts "$@"
else
    exec tsx test/lib/codeSearcher/search.ts "$@"
fi
