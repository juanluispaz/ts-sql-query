#!/bin/bash
# Extract compilable TypeScript from the documentation snippets. See `codegen:doc-code --help`.

print_help() {
    cat <<'EOF'
Usage:
  codegen:doc-code [--help]

PURPOSE: test the documentation's code examples — (1) type-check every snippet
against the real library, and (2) run each query against a mock and assert the
emitted SQL matches the SQL the docs show. (The type-checked corpus is also reused
by the symbol-index searcher, but that's an additional benefit, not the goal.)

Extracts the code snippets from docs/**/*.md into compilable TypeScript as ordinary
matrix cells (gitignored via *.generated.test.ts), built from the templates in
test/templates/doc-code/newest/documentation/. Each db template lands in
test/db/<db>/newest/documentation/doc-code.generated.test.ts; the non-db (general)
templates in test/db/general/newest/documentation/<name>.generated.test.ts. The
generated files are type-checked by `bun run validate:tests` AND a ```ts paired with
a dialect SQL fence becomes a mock test asserting the emitted SQL == the documented
SQL (run them like any matrix cell, e.g. `bun run tests '*/newest/documentation'`).
Full reference: test/DOC_CODE_EXTRACTOR.md.
Extraction is purely textual: imports in a snippet are stripped (the template
owns them); first-level declarations get usage marks (noUnusedLocals).

Fence-language routing (the doc author re-tags fences):
  ```ts WITH a dialect SQL fence → a SQL test() in each db whose fence follows,
                               asserting that SQL (against the template's mock).
                               A query that runs several statements shows several
                               fences per db (executeSelectPage → data + count);
                               all are asserted in order against the mock history.
                               A ```ts INSIDE a db tab (=== "SQLite") asserts only
                               its OWN db's SQL (per-db query tabs); a column-0
                               ```ts asserts every following db's SQL.
  ```ts that is only // comments → "no query for this db" → dropped (no test/fn,
                               and it does not absorb the following SQL fences),
                               like a --only SQL fence.
  ```ts WITHOUT SQL            → compile-only async function (postgresql default,
                               or the mkdocs dialect tab it sits in)
  ```<dialect>                 generated SQL (mariadb|mysql|oracle|postgresql|
                               sqlite|sqlserver) → expected SQL for the preceding
                               ```ts; a `--`-comment-only fence = not applicable
  ```typescript                simplified type decls → simplifiedDefinition, module level
  ```tsx                       the query's result TYPE → not emitted, but read to
                               shape the dummy mock row for a *One() query
  ```typescriptreact           documentation-only → skipped

Re-routing directives (invisible HTML comments — they render to nothing):

  <!-- doc-code-template: NAME -->
      Put it ANYWHERE on a page to pin the WHOLE page's snippets to the template
      NAME (templates/doc-code/newest/documentation/NAME.ts) instead of the default routing — `ts`
      blocks still wrapped in a function (dialect tabs ignored), `typescript`
      blocks still at module level. Lets you confine a page about very specific
      elements to its own self-contained template.

  <!-- doc-code-snippet-template: NAME[, NAME2, …] -->
      Put it on the line IMMEDIATELY before a fence to re-route a snippet WITHOUT
      SQL (a compile-only ```ts, or a ```typescript) to the named template(s).
      A comma-separated list emits it into several at once (a db-specific example
      that only compiles in those). A ```ts WITH a dialect SQL fence is routed by
      its fences, not by this directive.

  <!-- doc-code-snippet-result: <expr> -->
      Put it on a comment line just before a ```ts to set the mock's result for a
      query with <expr> (any JS), when the per-QueryType heuristic value isn't
      enough (a single-row projection that reads a specific field, …). STACK
      several (document order) to seed successive queries of a multi-query
      snippet; combinable with doc-code-snippet-template on the run of comment
      lines just above the fence. With NO doc-code-snippet-result, the extractor
      derives defaults from the terminal call: execute*NoneOrOne → `null` (it
      shares a QueryType with the required variant the heuristic seeds `{}`);
      executeSelectPage → `[]` then `0` (data rows, then the int count); a required
      *One() (executeSelectOne, executeInsertOne, …) → a dummy row shaped by the
      ```tsx result type (flat, dotted aliases for nested objects, [] for lists).

Precedence (most specific wins):
  per-snippet directive  ›  per-page directive  ›  default routing

Targets COMBINE: several pages/snippets may point at the same template, and a
directive may name an existing db template (or simplifiedDefinition) to ADD its
snippets there rather than replace it. Each template needs a `// Generated code
here` marker where the extracted code is injected; the doc author maintains the
template's imports so it compiles in both places.

Generated shape (per snippet):
  - The extracted body is fenced by `// BEGIN <page>:<line>` … `// END <page>:
    <line>` so you can tell the doc code from the generated scaffolding.
  - OUTSIDE that fence: the `async function` wrapper, a `void NAME;` per declared
    first-level value (const/let/var/function/class/enum), and a single
    `void function (_0: T…) {}` consuming the first-level pure types
    (type/interface). A compile error between BEGIN/END is in the doc snippet;
    one on a void/wrapper line is a codegen bug. Declarations nested inside a
    block are left untouched (the doc author handles those).

Per-file comment→code substitutions live in the SUBSTITUTIONS array in
test/lib/docCodeExtractor/docCodeExtractor.ts (maintained by the doc author).

Dispatches to `bun` when invoked via `bun run`, else to `tsx`.
EOF
}

case "${1:-}" in
    -h|--help) print_help; exit 0 ;;
esac

# shellcheck source=scripts/_test-common.sh
source "$(dirname "$0")/_test-common.sh"

if [ "$(detect_runtime)" = "bun" ]; then
    exec bun test/lib/docCodeExtractor/docCodeExtractor.ts "$@"
else
    exec tsx test/lib/docCodeExtractor/docCodeExtractor.ts "$@"
fi
