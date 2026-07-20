#!/bin/bash
# Build the code index (the queryable SQLite map of the codebase). See `tests:index --help`.

print_help() {
    cat <<'EOF'
Usage:
  tests:index [--newest] [--out <path>] [--no-resolve] [--use-bun] [--sink <true|false>] [--help]

  --newest     : index only the NEWEST slice of the matrix — `<db>/newest/` +
                 `<db>/types.negative/` (mirrors the runner's `--run-versions newest`),
                 plus all src/shared/docs/examples. The older version tiers
                 (`<db>/oldest/`, `<db>/8_000_000/`, …) and `<db>/domain/` cells are
                 dropped from the program. Lower RAM / faster (the checker is ~70% of the
                 peak and grows with the matrix), and it's the slice the agent works with
                 day-to-day, so it's exposed as its own script (`tests:index:newest`). The
                 index records its coverage in `meta.scope` (`newest` vs `full`) so a
                 consumer can tell a reduced index from a full one; a `--newest` build to
                 the default --out overwrites a previous full index at that path (the index
                 is a disposable derived artifact, rebuilt each run). Type-resolved searches
                 still work — only the dropped cells' rows are absent.
  --no-resolve : skip type resolution → name-based, low-memory/fast build (~3.6 GB / ~15 s
                 vs ~12 GB / ~2 min). Same schema/rows; resolved_*_id FKs stay NULL, so
                 name-based searches still work and the type-resolved ones (chain,
                 ref-by-role, overload pinning) do not.
  --use-bun    : force the bun runtime whichever way this script was invoked (npm or bun).
                 Slower, but has no fixed heap ceiling — see RUNTIME below.
  --sink <true|false>
               : stream each dimension out in batches as it is detected (true), or buffer
                 it in full and write it in one transaction (false). Same rows either way
                 (`tests:index:verify` covers both); the index records which mode built it
                 (`meta.rows`). Defaults PER RUNTIME — node: true, bun: false — because the
                 two engines fail differently, not because one mode is better:
                   * node streams: V8 dies at a fixed heap ceiling, so a lower peak is what
                     keeps the build alive. ~12 GB streamed vs ~13-15 GB buffered, for ~20%
                     wall (one transaction becomes ~15). Measured, consistent across runs.
                   * bun buffers: no ceiling to hit, and bun:sqlite is very syscall-heavy,
                     which favours fewer, larger transactions. REASONED, NOT MEASURED — see
                     RUNTIME below. Flip it with `--sink true` if it looks wrong.
  Run `tests:index:verify` for a fast structural smoke test of the extractors.

RUNTIME — this build is MEMORY-BOUND, so the launcher is not a free choice. It holds ONE
TypeScript program over `src/` + the whole `test/` matrix (~4.1k files); the checker alone
is ~70% of the peak and grows with the matrix (`--no-resolve`, which skips it, peaks at
~3.6 GB against the same ~3.6M rows). Measured on this tree:

  | runtime            | peak RSS | wall   | ceiling                                |
  |--------------------|----------|--------|----------------------------------------|
  | node/tsx (V8)      | ~12 GB   | ~2 min | HARD: dies at --max-old-space-size,    |
  |                    |          |        | whose default (4 GB) is far too low;   |
  |                    |          |        | needs >=16 GB — 12 GB still OOMs       |
  | bun (JSC),         | ~12 GB   | ~3.5m  | none: grows into available RAM         |
  | --use-bun          |          |        |                                        |

Node is the default: same peak, ~1.8x faster. This script raises its heap for it
(`--max-old-space-size`, override with TESTS_INDEX_HEAP_MB) — WITHOUT that it dies with a
bare V8 OOM stack trace that says nothing about why, which is the trap this note exists to
prevent. V8 also needs headroom well above its live set to GC effectively, hence >=16 GB for
a ~12 GB peak.

So reach for `--use-bun` when the box cannot give node that headroom: bun has no preset
ceiling and degrades instead of dying. If even that OOMs, `--no-resolve` (~3.6 GB) still
gives you every name-based search. To flip the default for everyone, pin the engine in
package.json the way `coverage` does:
`npm_config_user_agent=bun/tests-index bash scripts/tests-index.sh`.

CAVEAT on the bun row: on a 24 GB box these numbers are NOT reproducible. Two identical runs
came out 219 s / 12.0 GB and 402 s / 13.6 GB, with `sys` at 417 s and 716 s — at this peak it
is paging, and the variance swamps whatever is being measured. Node's numbers are stable
(~12 GB streamed across runs; the buffered peak wanders 13.3-15.1 GB because V8 GCs lazily
under a high ceiling). So: treat the bun row and the bun `--sink false` default as REASONED,
not measured, and re-measure on a box with real headroom before relying on either.

Same root cause as `validate:tests:tsc` not being a CI gate (see CLAUDE.md): one tsc program
over the whole matrix + `src/` exhausts V8's heap. Both grow with the suite — re-measure
before assuming the numbers above still hold.

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

# `--use-bun` forces the bun runtime whichever way the script was invoked — the runtime
# choice is a memory-vs-speed trade here, not a preference (see the RUNTIME note in --help),
# so it has to be reachable without changing the entry point. Mirrors `tests --use-vitest`.
# It is NOT the default: node is ~2.4x faster and the trade only pays off on a machine that
# can't spare the RAM. To flip the default for everyone, pin the engine in package.json the
# way `coverage` does: `npm_config_user_agent=bun/tests-index bash scripts/tests-index.sh`.
use_bun=0
args=()
for a in "$@"; do
    if [ "$a" = "--use-bun" ]; then use_bun=1; else args+=("$a"); fi
done

if [ "$use_bun" = 1 ] || [ "$(detect_runtime)" = "bun" ]; then
    if command -v bun >/dev/null 2>&1; then
        exec bun test/lib/codeIndexer/build.ts "${args[@]}"
    fi
    echo "tests:index: bun requested but not installed — falling back to node/tsx." >&2
fi

# Node needs its heap raised well past the 4 GB default: the resolved build peaks ~15 GB
# under V8 and would otherwise die with a bare OOM stack trace that says nothing about why.
# Override with TESTS_INDEX_HEAP_MB; if it still OOMs, use --use-bun (~10 GB) or --no-resolve.
NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=${TESTS_INDEX_HEAP_MB:-20480}" \
    exec tsx test/lib/codeIndexer/build.ts "${args[@]}"
