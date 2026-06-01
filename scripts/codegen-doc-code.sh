#!/bin/bash
# Extract compilable TypeScript from the documentation snippets. See `codegen:doc-code --help`.

print_help() {
    cat <<'EOF'
Usage:
  codegen:doc-code [--help]

Extracts the code snippets from docs/**/*.md into compilable TypeScript under
test/documentation/generated/ (gitignored), built from the templates in
test/documentation/doc-code-templates/. The generated files are
type-checked as part of `bun run validate:tests`, so a broken doc example fails
the test typecheck. The extraction is purely textual: imports in a snippet are
stripped (the template owns them), and each snippet's first-level declarations
get usage marks so noUnusedLocals stays quiet (see "Generated shape" below).

Fence-language routing (the doc author re-tags fences):
  ```ts                        runnable example → a db template, wrapped in an
                               async function (postgresql by default, or the
                               mkdocs dialect tab it sits in: === "MariaDB" …)
  ```typescript                simplified type decls → the simplifiedDefinition
                               template, at module level (no function wrapper)
  ```tsx / ```typescriptreact  documentation-only → skipped

Re-routing directives (invisible HTML comments — they render to nothing):

  <!-- doc-code-template: NAME -->
      Put it ANYWHERE on a page to pin the WHOLE page's snippets to the template
      NAME (doc-code-templates/NAME.ts) instead of the default routing — `ts`
      blocks still wrapped in a function (dialect tabs ignored), `typescript`
      blocks still at module level. Lets you confine a page about very specific
      elements to its own self-contained template.

  <!-- doc-code-snippet-template: NAME -->
      Put it on the line IMMEDIATELY before a fence (no blank line in between) to
      re-route just THAT ONE snippet to template NAME, leaving the rest of the
      page on its default/page routing.

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
