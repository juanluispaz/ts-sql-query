# Code Searcher — using it

**Search the codebase for a symbol** and get back, in one report, where it lives, how
it's reached from the public API, where it's explained in the docs, and what tests it
— across `src/`, the `test/` matrix, the published `docs/` and the legacy
`src/examples/`, without grepping four worlds by hand.

The searcher is the **feature**. It runs against a queryable **SQLite map of the
codebase** (the *code index*), which is just a **prerequisite** you build once.

This is the **usage** doc — what you run and how to read the answer. To *modify* the
tools, read the implementation references:
[`lib/codeSearcher/CODE_SEARCHER.md`](./lib/codeSearcher/CODE_SEARCHER.md) (the
searcher) and [`lib/codeIndexer/CODE_INDEXER.md`](./lib/codeIndexer/CODE_INDEXER.md)
(the index it reads). For the **why** — the intents and lessons that shaped the flags —
see [`lib/codeSearcher/MODEL.md`](./lib/codeSearcher/MODEL.md).

## The command you'll use

The invocation has three orthogonal parts (the same shape as `--help`): pick **one door** (WHAT
to search for), shape the report with **one levelled flag per section** (`none` hides it; defaults
reproduce the classic report), and narrow the data dimensions with **filters**. `--for <intent>`
presets a section set. (The old `--search-mode` is gone — `--chain` / `--name-search` replace it.)

```
tests:where-is  <door>  [<section> <level>]…  [<filter>]…  [--for <intent>]  [--index <path>]
```

```bash
bun run tests:where-is --search __addOrderBy                              # an exact name
bun run tests:where-is --search-pattern 'orderBy'                         # regex → full reports
bun run tests:where-is --search-location src/sqlBuilders/AbstractSqlBuilder.ts:1119               # a source line → enclosing fn
bun run tests:where-is --search-location …:1119 --location-target callees                         # the fn invoked ON that line
bun run tests:where-is --search-location test/db/postgres/newest/pg/select.basic.test.ts:45       # a TEST line → inverse search
bun run tests:where-is --emits-keyword 'returning old.'                  # a SQL token → the code that emits it
bun run tests:where-is --search orderBy --coord postgres --chain full --for coverage-gap          # combine freely
```

### Doors — WHAT to search for (exactly one)

| Door | Resolves to |
|---|---|
| `--search <name>` | an exact symbol/member name (`orderBy`, `__addOrderBy`) |
| `--search-pattern <regex>` | a JS regex over names → a **full report per** matching name (capped) |
| `--search-pattern-summary <regex>` | the same regex → a compact **pick-list** (name · kind · visibility counts · decls · sample) |
| `--search-location <path:line>` | a **source** line → the enclosing fn (or, with `--location-target callees`, the fn **invoked on** the line); a **test** line → inverse search (the `test_block` + the public API it exercises) |
| `--emits-keyword <sql-fragment>` | the `SqlBuilder` code that emits that SQL token — the emission-bug door |

### Sections — one levelled flag each (`none` hides)

The **default** level is in **bold**; an un-flagged run = the classic report. The `what it shows`
column doubles as the "reading the report" key (sections appear only when they have content).

| Section flag | Levels (default **bold**) | What it shows |
|---|---|---|
| `--classification` | none · **summary** · full | exists? **public** (importable) / **public-surface** (fluent API, not importable) / **internal** / not found — its **kind**, and for a member which public interfaces expose it |
| `--declared` | none · **summary** · full | every declaration site: kind + `path:line` + first JSDoc line |
| `--signature` | none · **summary** · public-interface · public-impl · internal · full | signature + JSDoc, prefixed `[public]` / `[public impl]` / `[internal]` + owner kind, **simplified-map form first** |
| `--chain` | none · **strict** · broad · full | the call-chain: public callers grouped by area + direct callers. `broad` climbs **past** public; `full` = the **whole internal stack** |
| `--producers` | **none** · summary · full | public calls whose **return type** yields a receiver you can call the member on (the upstream/receiver search) |
| `--implemented-by` | none · **summary** · full | each class implementing an interface that declares the member — impl line + impl/class spans, or "inherits it" (**non-overriders** shown); + the simplified def(s) it realizes |
| `--version-gates` | **none** · summary · full | compatibility-version branches (`compatibilityVersion <op> <breakpoint>`) + the methods they gate |
| `--docs` | none · **summary** · by-page · full | where it's **explained**: doc page + heading + exact line, per db, with the snippet kind |
| `--simplified` | none · **summary** · full | when the name IS a simplified def: completeness vs the real API per source + drift; and where the member appears **inside** a simplified-def snippet |
| `--emitted-sql` | **none** · summary · full | the asserted `toMatchInlineSnapshot` SQL the symbol's **tests + docs** produce, de-duped with the asserting cells + the refresh kind |
| `--tests` | none · **summary** · detail · gaps | matrix coverage — `summary` = `newest/total` per db; `detail` = per-test; `gaps` = who's-**missing** per db |
| `--examples` | none · **summary** · full | legacy `src/examples/` occurrences |
| `--neg-types` | none · **summary** · full | `@ts-expect-error` negative-type assertions, per db |
| `--bugs` | **none** · summary · full | `// TODO[BUG]` markers mentioning the name (the BUG subset of all indexed TODO markers) |
| `--limitation` | **none** · summary · full | `// TODO[LIMITATION]` markers mentioning the name (the sibling tag; not in any preset) |
| `--name-search` | **none** · full | name-based discovery — every place the name appears, per dimension (high recall) |

### Global focus — matrix coordinates (`--coord`)

`--coord` is the **single focus filter** — a matrix coordinate `db[/version[/connector[/file]]]`
with glob `*` and brace `{a,b}`, **repeatable** (union). It focuses **every db/cell-aware section**,
best-effort per dimension (the same mental model as the main `tests` CLI's coordinates, but as a
global focus). Exact closed-set values; no fuzzy substrings.

| | Matched against the coord |
|---|---|
| **tests**, **emitted-sql** (test rows) | the **full cell** — `db` / `version` / `connector` (/ test-file basename) |
| **legacy examples** | the **full cell** too — db/version/connector are derived from the filename (`PgExample`→`postgres/newest/pg`, `MariaDBExample-compatibility`→`mariadb/oldest/mariadb`; the `documentation/` generators have no connector) |
| **docs**, **shown-in-simplified-def**, **negative-type**, **emitted-sql** (doc rows) | the **db segment** only (these have no version/connector). db-agnostic `general` docs are always kept |

The optional **4th (file) segment** is a glob/brace on the test-file **basename**; it **coexists**
with `--file-name-pattern` (a regex over the full path that also covers doc pages) — both AND. A
coord matching no indexed cell/file is an **error** (nullglob). Examples: `--coord postgres`
(everything postgres) · `--coord 'postgres/*/{pg,postgres}'` (those connectors) · `--coord
'mariadb/oldest'` (the `-compatibility` examples) · `--coord 'postgres/newest/pg/select.order-by*'`
(a test file) · `--coord '*/newest' --coord mysql`.

### Narrow WITHIN the sections (orthogonal to the matrix axes)

| Narrowing | Narrows |
|---|---|
| `--test-name-pattern <regex>` | tests by name |
| `--file-name-pattern <regex>` | file dimensions (test files, doc pages) |
| `--owner-kind <interface\|class\|type>` · `--owner <name>` | declared / signature by owner |
| `--breakpoint <n>` | version-gates to one breakpoint (e.g. `18_000_000`) |

### Presets — `--for <intent>` (explicit flags still override)

| `--for` | sets |
|---|---|
| `coverage-gap` | classification full · chain full · producers · tests gaps · examples full |
| `emission-bug` | emitted-sql full · implemented-by full (non-overriders) · version-gates · bugs full · **chain none** |
| `version-work` | version-gates full · tests summary · chain none |
| `post-fix-sync` | emitted-sql full · docs full · examples full · tests detail · chain none |

`--index <path>` selects which code-index file to read (default
`test/lib/codeIndexer/generated/code-index.sqlite`, gitignored/disposable) — rarely needed. **Build
the index once** before the first search and refresh it when stale:

```bash
bun run tests:index                  # build / refresh the index (~18 s)
```

## When you'd use it

You're generating tests from a coverage report and you hold a symbol — often an
**internal** one like `__addOrderBy`, or a public name you're weighing — or just a
file:line from the report. Ask:

```bash
bun run tests:where-is --search __addOrderBy
```

and you get, in one markdown report: does it exist? public or internal? the public
methods that reach it; where it's explained in the docs (page:line); which
simplified definition reflects it; and how saturated its test coverage is per
database. Paste it into a wave plan as a verifiable artifact.

## Reading the report

Sections appear only when they have content; **what each shows** is the `What it shows` column of
the **Sections** table above. The cross-cutting reading conventions:

Every `file:line` in the report is followed by a **labelled block range** naming what
that range is — `(definition spans lines N–M)` for a declaration, `(caller body lines
N–M)` for a calling function, `(snippet spans lines N–M)` for a doc snippet — so you
can open exactly that section instead of guessing where it begins and ends. In a
**chain search**, the line shown is the **exact invocation line** (where the searched
symbol is called), and the labelled range is the body of the calling function:

```
- `orderBy` invokes `__addOrderBy` at src/queryBuilders/SelectQueryBuilder.ts:247 (caller body lines 241–249)
```

**Public surface vs internal.** Only functions **exposed by a public interface** are public.
The public surface is the fluent API interfaces (`src/expressions/*`, used through the public
connection methods even though not directly importable), the curated simplified map, and the
directly-exported symbols. So a member is marked:
- `[public]` — declared on a public interface (the contract).
- `[public impl]` — a **class** method that implements a public-interface member (it runs when
  the user calls the public method; public *by implementation*).
- `[internal]` — declared on no public interface (e.g. `__addOrderBy`, a private helper).

`tests:where-is --search orderBy` shows the contract interfaces as `[public]` and
`AbstractSelect.orderBy` as `[public impl]`; `tests:where-is --search __addOrderBy` is
`[internal]` — reachable only *through* the public `orderBy` (see the chain search below).

### The call-chain (`--chain`) and name search (`--name-search`)

The report's **facts** are always shown (classification, signature, where it's
implemented/explained/tested). The **searches** answer "where/how is this used?", and each is
its own levelled flag:

```bash
bun run tests:where-is --search <name>                          # --chain strict (default)
bun run tests:where-is --search <name> --chain broad            # climb past the public callers
bun run tests:where-is --search <name> --chain full             # the WHOLE internal stack
bun run tests:where-is --search <name> --name-search full       # every place the name appears
```

| level | how it searches | answers |
|---|---|---|
| **`--chain strict`** (default) | call-chain upward, **stop at the first public caller** (grouped by area) | "what public API reaches this — the precise route" |
| **`--chain broad`** | call-chain, climbing **past** the public callers through the whole graph | "the wider surrounding chain" (lower precision — name-based edges cross funnels) |
| **`--chain full`** | the **entire internal stack**, every hop grouped by depth | "the complete route, internal included" — for understanding a deep emission site |
| **`--name-search full`** | name-based across every dimension (symbols, members, tests, docs, examples, negatives) | "everywhere this name appears" (high recall, low precision) |

A hop is *public* when the calling function is itself public (a `public`/`public_impl` member or
a public-surface symbol), in **any** area. **`--chain` is the wrong tool for an emission/syntax
bug** — the SQL is built then executed, so neither the runtime stack nor the call-chain reaches
the emission; use `--emits-keyword` instead (and `--for emission-bug` sets `--chain none`).

Under `npm run` the flags need a `--` separator (`npm run tests:where-is -- --search <name> --chain full`);
under `bun run` they pass straight through.

## Worked example — internal symbol to docs & tests

`__addOrderBy` (an internal method at `src/queryBuilders/SelectQueryBuilder.ts:250`,
the kind of thing a coverage report points you at):

1. `tests:where-is --search __addOrderBy` → the **chain-strict** search shows it's reached by
   the public `orderBy` / `orderByFromString`.
2. `tests:where-is --search orderBy` → **Implemented by** `AbstractSelect`, realizing the
   simplified def `SelectExpression`; **Explained in docs** at `docs/api/select.md`
   plus every `.orderBy(...)` example across `docs/queries/*.md` with exact lines;
   **Coverage** ~5 k matrix tests across all databases + legacy examples + 6
   negative-type assertions.

That's the internal → public → docs → tests trail, from a single symbol.

## Staleness — when to rebuild

The index is a **snapshot** of the tree at build time. Every report header states its
provenance and warns when it's likely out of date:

```
> index: built 2026-06-05T14:20:00Z · 40fa555f-dirty · resolved · schema v4
> ⚠️  index built at 40fa555f, working tree is at d9100896 — likely STALE; rebuild with `tests:index`
> ⚠️  working tree is dirty — the index may not reflect uncommitted edits
```

If you see those warnings and your question is about code you just changed, re-run
`bun run tests:index`. (The searcher refuses outright only when the index is from an
incompatible tool version — a schema mismatch.) For a RAM-constrained machine,
`bun run tests:index -- --no-resolve` builds faster/lighter but drops the precise
binding links; name-based lookups still work.
