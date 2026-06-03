#!/bin/bash
# Build the code index (the queryable SQLite map of the codebase). See `tests:index --help`.

print_help() {
    cat <<'EOF'
Usage:
  tests:index [--out <path>] [--no-resolve] [--help]

  --no-resolve : skip type resolution → name-based, low-memory/fast build (~1-2 GB / ~3 s
                 vs ~8 GB / ~18 s). Same schema/rows; resolved_*_id FKs stay NULL.
  Run `tests:index:verify` for a fast structural smoke test of the extractors.

PURPOSE: build the CODE INDEX — a queryable SQLite database that maps the whole
project (src + tests + docs + legacy examples) so tooling can ask precise questions
about it instead of grepping: does a symbol exist? is it public or internal? which
tests/docs exercise it, and where? what public call-chain reaches an internal symbol?

This is the INDEXER. The tool that ANSWERS searches over the index (where-is) is a
separate consumer that reuses this tool's code (db.ts / schema.ts / model.ts).

The index is a disposable derived artifact, rebuilt from scratch each run, written to
test/lib/codeIndexer/generated/code-index.sqlite (gitignored) — inside the tool's own
folder rather than .test-report/, which the test harness wipes even when the index is
still valid. Pass --out to write elsewhere. The run prints which SQLite backend served
the build (bun:sqlite under Bun; node:sqlite or better-sqlite3 under Node).

Reference (build, schema, consume, how to extend): test/lib/codeIndexer/CODE_INDEXER.md.
Deep design rationale, roadmap and searcher design: test/lib/symbolIndex/DESIGN.md.

Dispatches to `bun` when invoked via `bun run`, else to `tsx`.
EOF
}

case "${1:-}" in
    -h|--help) print_help; exit 0 ;;
esac

# shellcheck source=scripts/_test-common.sh
source "$(dirname "$0")/_test-common.sh"

if [ "$(detect_runtime)" = "bun" ]; then
    exec bun test/lib/codeIndexer/build.ts "$@"
else
    exec tsx test/lib/codeIndexer/build.ts "$@"
fi
