# `test/` — documentation code extractor

**The code examples in the documentation are validated by the TypeScript
compiler.** This codegen turns the TypeScript snippets embedded in the
documentation (`docs/**/*.md`) into **compilable** TypeScript and feeds them
through the same `tsc`/`tsgo` compilation as the rest of `test/` — so a doc
example that no longer type-checks (an API renamed, a signature changed, a typo)
fails the build instead of rotting silently. The docs stay correct by
construction, not by manual review.

The tool itself is standalone, self-contained code under
[`lib/docCodeExtractor/`](./lib/docCodeExtractor/) (it ships its own
`walk.ts`, no dependency on the rest of `test/lib/`). This is the reference for
it. For the navigation map see [`README.md`](./README.md); for the `test/lib/`
infra reference see [`TEST_LIB.md`](./TEST_LIB.md).

- [Run it](#run-it)
- [How it works](#how-it-works)
- [Fence-language routing](#fence-language-routing)
- [Re-routing directives](#re-routing-directives)
- [Generated shape](#generated-shape)
- [The documentation source files](#the-documentation-source-files)
- [Files](#files)

## Run it

```bash
bun run codegen:doc-code      # regenerate test/documentation/generated/
npm run codegen:doc-code      # same, via tsx
bun run codegen               # umbrella: codegen:prisma + codegen:doc-code (what CI runs)
```

The wrapper is [`scripts/codegen-doc-code.sh`](../scripts/codegen-doc-code.sh)
(`bun run codegen:doc-code --help` prints the full behaviour). The generated
files are type-checked by `bun run validate:tests` (tsgo) and
`bun run validate:tests:tsc` (tsc); the non-v1 CI runs `codegen` before
`validate:tests`.

## How it works

For every Markdown file the extractor scans the fenced code blocks and routes
each one to a **template** under
[`test/documentation/doc-code-templates/`](./documentation/doc-code-templates/),
injecting the collected code at that template's `// Generated code here` marker.
The templates (and their imports) are author-maintained so the generated files
compile. Extraction is **purely textual**: imports in a snippet are stripped (the
template owns them), and a snippet's first-level declarations get usage marks (see
[Generated shape](#generated-shape)).

Output goes to
[`test/documentation/generated/`](./documentation/generated/) — **gitignored**,
compiled by [`test/tsconfig.json`](./tsconfig.json) (`**/*.ts`), and outside
`src/` so naturally excluded from the publishable build.

### Fence-language routing

The doc author re-tags each fence so its language encodes intent:

| fence | meaning | target | emission |
|---|---|---|---|
| ` ```ts ` | runnable example | a db template (postgresql by default, or the mkdocs dialect tab `=== "MariaDB"` …) | wrapped in an `async function` |
| ` ```typescript ` | simplified type declarations | `simplifiedDefinition` | module level (no wrapper) |
| ` ```tsx ` | result-type annotation | — | skipped |
| ` ```typescriptreact ` | pseudocode | — | skipped |

A `=== "Label"` at column 0 opens a dialect tab group; any other column-0
non-blank line (prose, heading, `!!! info` admonition, column-0 fence) closes it,
so a ` ```ts ` indented inside an admonition is not mis-attributed to a tab.

### Re-routing directives

Invisible HTML comments (they render to nothing in Markdown):

- `<!-- doc-code-template: NAME -->` — anywhere on a page, pins the **whole page**
  to template `NAME`.
- `<!-- doc-code-snippet-template: NAME -->` — on the line **immediately before**
  a fence (no blank line between), re-routes **just that one snippet**.

Precedence (most specific wins): **per-snippet › per-page › default**. Targets
**combine**: several pages/snippets may feed the same template, and a directive
may name an existing db template (or a simplified-definition template) to *add*
to it rather than replace it.

### Generated shape

The extracted body is fenced by `// BEGIN <page>:<line>` … `// END <page>:<line>`
so the doc code is told apart from the generated scaffolding. **Outside** that
fence: the `async function` wrapper, a `void NAME;` per first-level value
(`const/let/var/function/class/enum`), and a single `void function (_0: T…) {}`
consuming the first-level pure types (`type/interface`) — these satisfy
`noUnusedLocals`/`noUnusedParameters`. So a compile error **between** the markers
is in the doc snippet; one on a `void`/wrapper line is an extractor bug.
Declarations nested inside a block are left untouched (the doc author handles
those). Per-file comment→code substitutions live in the `SUBSTITUTIONS` array in
[`docCodeExtractor.ts`](./lib/docCodeExtractor/docCodeExtractor.ts).

## The documentation source files

The published docs are **authored from** a small set of TypeScript files, and the
extractor pulls the resulting snippets back out to compile them. Three things are
easy to confuse — they are different, and they live in two places:

- **[`src/examples/documentation/simplifiedQueryDefinition.ts`](../src/examples/documentation/simplifiedQueryDefinition.ts)**
  (stays under `src/`) — a hand-maintained, human-readable, **valid `.ts`** view
  of the query-building API (formerly `src/simplifiedDefinition.txt`). It is an
  **authoring source**: the doc author writes the documentation *from* it,
  together with real library files such as
  [`src/TsSqlError.ts`](../src/TsSqlError.ts) (for the error-type signatures) and
  other public sources. It is NOT produced by the extractor and is NOT a
  template.

- **[`test/documentation/doc-code-templates/`](./documentation/doc-code-templates/)**
  — the templates the extractor injects into (each has a `// Generated code here`
  marker and author-maintained imports). Besides the per-database templates
  (`postgresql.ts`, `mariadb.ts`, …) there are **two simplified-definition
  templates**, which came out of splitting the simplified types as they are used
  across the docs:
  - **`simplifiedDefinition.ts`** — the *general* one, populated mainly from the
    `typescript` fences in `docs/api/*`. It is the default target for
    ` ```typescript ` snippets.
  - **`simplifiedDefinitionInQuery.ts`** — a *query-focused* subset (some extracts
    of the general one) used by the query pages (e.g.
    [`docs/queries/insert.md`](../docs/queries/insert.md),
    [`docs/queries/update.md`](../docs/queries/update.md)), reached via the
    re-routing directives above.

- **[`test/documentation/generated/`](./documentation/generated/)** — the
  extractor's output: one `.ts` file per template, with every routed snippet
  injected. It is gitignored and exists only to be type-checked alongside `test/`.

## Files

| file | role |
|---|---|
| [`lib/docCodeExtractor/docCodeExtractor.ts`](./lib/docCodeExtractor/docCodeExtractor.ts) | the extractor + standalone entry point |
| [`lib/docCodeExtractor/walk.ts`](./lib/docCodeExtractor/walk.ts) | self-contained recursive file walk |
