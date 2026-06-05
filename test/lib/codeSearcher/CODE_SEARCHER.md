# Code Searcher

The **consumer half** of the [Code Indexer](../codeIndexer/CODE_INDEXER.md): given a
symbol, it queries the index and prints a single markdown report answering — in one
shot — the questions the coverage-generation agent actually asks:

- Does `X` exist? Is it **public** (importable through `package.json` exports) or
  **internal**? Or unknown (likely a typo / hallucination)?
- What is its **signature + JSDoc** (preferring the simplified-map form)?
- How is it **reached** from the public API — the call-chain up to the public callers
  (any area, grouped), crossing the interface↔class bridge?
- Where is it **explained** in the docs (page + heading + exact `md_line`), reflected
  in a **simplified definition**, **exemplified** (legacy examples), and **tested**
  (matrix coverage by db + negative-type assertions)?

This folder is the **SEARCHER** — it only *reads* the index. The tool that *builds*
it ([`tests:index`](../codeIndexer/CODE_INDEXER.md)) is a separate producer. The
searcher reuses the indexer's [`db.ts`](../codeIndexer/db.ts) (the read-only handle)
and [`schema.ts`](../codeIndexer/schema.ts) (the `SCHEMA_VERSION` it gates on).

> **Regression guard:** [`verify.ts`](./verify.ts) (run via `tests:where-is:check`) unit-tests the
> pure logic — `--coord` matrix matching and the door/section/level/preset arg model — with no
> index and no DB. It is **not** a `*.test.ts`, so the `test/` matrix never collects it; run it on
> demand. Validate types with `bun run validate:tests` (tsgo) / `:tsc`.

> **Just want to USE it?** Read [`test/CODE_SEARCH.md`](../../CODE_SEARCH.md) instead —
> the agent-facing usage doc. This file is the **implementation reference** (modules,
> the read-only seam, how to extend it). The design rationale (the **why** — intents, the
> cross-cutting lessons, what was and wasn't built) lives in [`MODEL.md`](./MODEL.md), and the six
> worked case studies that discovered it in [`CASE_STUDIES.md`](./CASE_STUDIES.md).

## Run it

WHAT to search for — exactly one (resolved in `search.ts`):

```bash
bun run tests:where-is --search <name>                                   # an exact name
bun run tests:where-is --search-pattern '<regex>'                        # regex → a full report per match
bun run tests:where-is --search-pattern-summary '<regex>'               # regex → a compact pick-list
bun run tests:where-is --search-location src/foo/Bar.ts:84               # a source location → enclosing fn
```

Plus the v4 doors: `--location-target callees` (the fn invoked ON a src line), a TEST-file
`--search-location` (inverse search → the `test_block` + API it exercises), and
`--emits-keyword <sql-fragment>` (SQL token → the SqlBuilder code that emits it).

HOW to shape the report — **one levelled flag per section** (`--search-mode` was removed):

```bash
bun run tests:where-is --search <name> --chain full          # whole internal stack (vs strict/broad)
bun run tests:where-is --search <name> --tests gaps          # who's-missing per db
bun run tests:where-is --search <name> --producers full --version-gates full --bugs full
bun run tests:where-is --search <name> --name-search full    # name-based discovery (was --search-mode name)
bun run tests:where-is --search <name> --for emission-bug    # preset a section set
bun run tests:where-is --search <name> --db <path>           # non-default index file
# or, directly:
bun test/lib/codeSearcher/search.ts --search <name> [flags]
npx tsx test/lib/codeSearcher/search.ts --search <name> [flags]          # under Node
```

Full flag reference: `bun run tests:where-is --help` (and [`MODEL.md`](./MODEL.md) for the model —
doors × levelled sections × `--coord` focus × presets, and the rationale behind them).

- **`--search-pattern`** resolves to matching names and prints a **full report for each**
  (capped at 25, separated by `---`, with a note if truncated); **`--search-pattern-summary`**
  shares the same matcher (`matchNames` in [`search.ts`](search.ts)) but prints just the
  compact pick-list: name · kind · **segregated visibility counts** · total decls · a sample
  location ranked by `sampleRank` to prefer an **implementation class (abstract first, via
  `symbol.is_abstract`) over an interface**.
- **`--search-location <path:line>`** resolves to the INNERMOST member/symbol whose span
  contains that line (`enclosingAt` in [`queries.ts`](queries.ts)) and prints what it found
  before the report.

Under `npm run`, bare flags need the `--` separator (`npm run tests:where-is -- --search <name> --search-mode name`);
under `bun run` they pass straight through.

It reads **`test/lib/codeIndexer/generated/code-index.sqlite`** by default (build it
first with `tests:index`). If the file is missing it exits non-zero with a hint.

## Staleness & compatibility gate ([`meta.ts`](meta.ts))

The index is a snapshot of the tree at build time. Before trusting it, the searcher
reads the indexer's `meta` table and:

- **Refuses** (exit 3) when `schema_version` ≠ the tool's `SCHEMA_VERSION` — an index
  built by an incompatible tool version.
- **Warns** (in the report header, non-blocking) when the recorded `git_rev` differs
  from the working tree's `HEAD`, when the tree is **dirty**, or when the index was
  built `--no-resolve` (so `resolved_*` links are empty and reachability degrades to
  name matching).

Every report starts with a provenance line so the answer carries its own trust level:

```
> index: built 2026-06-03T20:32:03Z · 40fa555f-dirty · resolved · schema v3
> ⚠️  index built at 40fa555f, working tree is at d9100896 — likely STALE; rebuild with `tests:index`
```

## What the report contains

Sections are emitted only when they have content; the order maps to DESIGN.md §9.4.
Every printed `file:line` is followed by a **labelled** block range — `definition spans`
(declaration), `caller body` (calling function), `snippet spans` (doc fence) — from
`*_start_line`/`*_end_line` in the index (`symbol`, `member`, `invocation.caller_*`,
`doc_test_block`), so the label makes clear what the range is and a reader can open it.
In a **chain search** the line is the **exact invocation site** (`invocation.line`, where
the searched symbol is called), not the caller's start; the labelled range is the
caller's body.

Each section is a **levelled flag** (`none`/`summary`/`full` + shape levels); `none` hides it.
Defaults reproduce the classic report. The sections:

| Section | Source recipe | Answers |
|---|---|---|
| **Classification** | R1 | exists? **public** (importable) / **public-surface** (fluent API, not importable) / **internal** / not found — its **kind**, and for a member which public interfaces expose it |
| **Declared** | symbols by name | every declaration site prefixed with its **kind**, `path:line` + first JSDoc line |
| **Signature** | members by name | signature + JSDoc, prefixed `[public]` / `[public impl]` / `[internal]` + owner kind, **simplified-map form first** |
| **Implemented by** | R4 + R8 | each class implementing an interface that declares the member — line points at the **implementation** with both the implementation span and the class span, or (inherited) just the class span with no concrete line — plus the simplified def(s) it realizes, located |
| **Explained in docs** | R3 | doc page + heading + exact `md_line`/`md_col` + kind + dbs |
| **Shown in simplified-def docs** | R8b | where the member appears inside a `decl` (simplified def) snippet |
| **Simplified definition** | R8 | per-source (`master`/`doc`/`doc-inquery`) shown-vs-real + drift |
| **How to obtain a receiver (producers)** | `producer` | (`--producers`) public calls whose return type yields a receiver of this type (case B) |
| **Version gates** | `version_gate` | (`--version-gates`) compatibility-version branches + the methods they gate (case E) |
| **Emitted SQL** | `emitted_sql` | (`--emitted-sql`) the asserted SQL the symbol's tests/docs produce, de-duped with the asserting cells (case C/D/F) |
| **Coverage** | R2 + neg_type | (`--tests <summary\|detail\|gaps>`) matrix tests by db (`newest/total`), per-test detail, or who's-missing per db; legacy examples; negative-type assertions |
| **Known divergences** | `todo_marker` | (`--bugs`) `// TODO[BUG]` markers mentioning the name (case C/D/F) |
| **Known limitations** | `todo_marker` | (`--limitation`) `// TODO[LIMITATION]` markers — the sibling tag (not in any preset) |
| **Search: chain (strict/broad/full)** | R5 + §9.1/§9.2 | *(search, `--chain`)* call-chain — public callers grouped by area + direct callers; `full` = the whole internal stack |
| **Search: name** | R6 | *(search, `--name-search`)* name-based — hit count per dimension (low precision, high recall) |

**Public surface — read straight from the index.** The public/internal verdict is
**materialised by the indexer's publics-marking phase** (see CODE_INDEXER.md), so the searcher
just reads it: `symbol.is_public_surface` and `member.visibility` (`public` | `public_impl` |
`internal`). The rule: only functions exposed by a **public interface** are public; a **class**
method that implements one is `public_impl`; the rest are `internal` (e.g. `__addOrderBy`). The
`[public]/[public impl]/[internal]` marker is `member.visibility` verbatim;
`publicInterfacesDeclaring` (in [`queries.ts`](queries.ts)) only NAMES the exposing interfaces
for the "exposed by X, Y" detail. This is why an internal helper still surfaces *through* the
chain search.

### The two searches (`--chain`, `--name-search`)

The "where/how is this used?" question has two distinct answers, each its own levelled flag
(`--search-mode` was removed). `--chain` defaults to `strict`.

**Call-chain search (`--chain strict|broad|full`).** `callChain` in
[`queries.ts`](queries.ts) is an **iterative BFS upward** over the `invocation` table,
keeping module context. A hop is a **public hop** when the calling function is itself
public — a `public`/`public_impl` member, or a public-surface symbol — in the SAME module,
computed in SQL from `member.visibility` / `symbol.is_public_surface` (**any** area, not
only `queryBuilders`); public callers are grouped by area. The two `chain-*` strategies are
the same search at two stop points:
- **`chain-strict`** (default): a branch stops as soon as it reaches a public caller —
  you've reached the public API; the precise route public→internal.
- **`chain-broad`**: keep climbing past the public callers through the whole graph. Use
  when strict yields nothing, or for the full surrounding context. The invocation edges are
  **name-based** (`callee_name`/`caller_name`, not the resolved FKs — see the schema note),
  so climbing past a shared name (`query`/`__toSql`/`execute`) crosses into sibling
  operations: more recall, less precision. Bounded by `CHAIN_MAX_DEPTH` (8) /
  `CHAIN_MAX_EDGES` (400); a truncated graph is flagged.

**`--chain full`** renders the *entire* internal stack — every recorded hop grouped by depth,
not just the public callers — for understanding a deep emission site end to end.

**Name-based search (`--name-search full`).** `discovery` in [`queries.ts`](queries.ts) ignores the
call-chain entirely and counts every occurrence of the name across all dimensions
(symbol/member/invocation/test/doc/example/neg). It finds usages the graph can't connect
(dynamic dispatch, re-exports), at the cost of noise — high recall, low precision.

> **Resolution-scatter caveat** (inherited from the index, DESIGN.md §11.2): a fluent
> `.orderBy` resolves to the overloaded *interface* signatures, not the impl. The
> searcher therefore keys cross-dimension lookups on the **name** (`symbol_name` /
> `callee_name`), which is what the recipes do, so this scatter does not distort the
> answer. The `resolved_*` FKs are available for callers that want an exact link.

## Worked example — the validated chain

`tests:where-is --search __addOrderBy` (internal, `src/queryBuilders/SelectQueryBuilder.ts:250`)
— equivalently `--search-location src/queryBuilders/SelectQueryBuilder.ts:252`:

- **Search: chain-strict** → `orderBy` / `orderByFromString` at the `queryBuilders`
  layer — the public methods that wrap it.
- `tests:where-is --search orderBy` then lands the rest: **Implemented by** `AbstractSelect`
  realizing the simplified def `SelectExpression`; **Explained in docs** at
  `docs/api/select.md:99-104` (the `SelectExpression` decl) plus every `.orderBy(...)`
  query example across `docs/queries/*.md` with exact lines; **Coverage** ~5 k matrix
  tests + 531 example occurrences + 6 negative-type assertions.

That is the precise internal→public→docs→tests chain the index was built to support,
reachable from a single coverage-report symbol.

## Architecture & how to extend it

```
test/lib/codeSearcher/
├── search.ts     ← CLI entry: arg parse, open read-only, meta gate, print
├── meta.ts       ← staleness / schema-compat gate (reads the meta table)
├── queries.ts    ← the query layer: one typed function per recipe (R1–R8 + BFS)
└── render.ts     ← orchestrates queries → markdown; emits only non-empty sections
```

- **Read-only seam.** `openIndexDbReadonly(path)` in [`db.ts`](../codeIndexer/db.ts)
  opens the same three backends (bun:sqlite / node:sqlite / better-sqlite3) read-only,
  exposing the narrow `QueryDb` interface (`all` + `close`). A search can never mutate
  the artifact and creates no `-wal`/`-shm` sidecars.
- **Add a question**: add a typed function to [`queries.ts`](queries.ts) (bind
  parameters, never interpolate), then a section in [`render.ts`](render.ts) that
  calls it and only prints when non-empty. Keep the recipe ↔ section mapping above in
  sync.
- **Add a search strategy**: add it to the `Strategy` union + `STRATEGIES` in
  [`render.ts`](render.ts) (a single source of truth `parseArgs` validates against),
  render its section, and document it in `HELP` /
  [`scripts/tests-where-is.sh`](../../../scripts/tests-where-is.sh).
- **Schema changes** ride through `SCHEMA_VERSION`: when the indexer bumps it, an old
  index is refused automatically — no version logic needed here.

## Roadmap — candidate next steps

Prioritised by value to the coverage agent × cost (full rationale in DESIGN.md §9.5):

1. **Coverage gaps per db** — show which `newest` dbs are MISSING a test (not just where it
   IS tested); the agent's "where to add a test" directly. Cheap, fits the Coverage section.
2. **Negative-type detail** — surface the `@ts-expect-error` rule + line + scope from
   `neg_type`/`neg_type_ref`, not just a count.
3. **Sibling API** — the other members on the same interface (the fluent state's surface).
4. **Untested-public-surface sweep** — a separate mode/report (`--gaps`?): `public`/
   `public_impl` members with zero `test_ref` (the agent's work queue). Bigger; different shape.
5. **`--search-location` over tests** — `test/…:N` → resolve the `test_block` and list the
   public API it exercises (inverse search).
6. **Type-resolved chain walk** — follow `invocation.resolved_member_id` when present (fall
   back to name) so `chain-broad` stops ballooning and the chain is type-precise.
7. **JSON output mode** — only if a programmatic consumer needs it (the agent reads markdown).

Recommendation: (1)+(2) first; (4) is the next real jump.
