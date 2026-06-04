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
(the index it reads).

## The command you'll use

You tell it **what** to search for (exactly one of three ways) and optionally **how**
(`--search-mode`, below):

```bash
bun run tests:where-is --search __addOrderBy                              # an exact name
bun run tests:where-is --search-pattern 'orderBy'                         # regex → full reports
bun run tests:where-is --search-pattern-summary 'orderBy'                 # regex → a pick-list
bun run tests:where-is --search-location src/connections/MariaDBConnection.ts:84   # a source location
```

- **`--search <name>`** — an exact symbol/member name.
- **`--search-pattern <regex>`** — a JS regex over names (like vitest's `--testNamePattern`):
  a **full report for every matching name** (capped, with a note if truncated).
- **`--search-pattern-summary <regex>`** — the same regex, but just a compact **list** of the
  matches: name · kind · **segregated visibility counts** (e.g. `public 15, public_impl 1`) ·
  total decls · a sample location that **prefers an implementation class (abstract first) over an
  interface**, so the pointer lands on the shared impl rather than the contract.
- **`--search-location <path:line>`** — resolves to the function/method that **encloses**
  that source line, then searches it (it prints which element it resolved to).

It reads the code index at `test/lib/codeIndexer/generated/code-index.sqlite`
(gitignored, disposable). **Build that index once** before the first search, and
refresh it when it goes stale (see below):

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

Sections appear only when they have content:

| Section | Tells you |
|---|---|
| **Classification** | exists? **public** (directly importable), **public-surface** (used through the fluent API, not directly importable), or **internal** / **not found** — its **kind** (interface / class / type), and for a member whether it's exposed by a public interface and by which ones |
| **Declared** | every declaration site, prefixed with its **kind** (interface / class / type / …), `path:line` + the first JSDoc line |
| **Signature** | the signature + JSDoc, each prefixed with `[public]` / `[public impl]` / `[internal]` + the **owner kind**, **simplified-map form first** (the human-readable one the docs render) |
| **Implemented by** | each class implementing an interface declaring this member — the line points at the **implementation** (with both the implementation span and class span), or just the class span when the class inherits it — plus the simplified def(s) it realizes, located (the bridge to "what docs talk about") |
| **Explained in docs** | doc page + section heading + exact line, per database, with the snippet kind |
| **Shown in simplified-def docs** | where the member appears inside a simplified-definition snippet in the docs |
| **Simplified definition** | when the name IS a simplified def: how complete it is vs the real API, per source, with drift flags |
| **Coverage** | matrix tests by database — **total and newest-only** (`newest/total`; older versions usually re-emit the same snapshots, so newest is the telling number) — legacy example occurrences, negative-type assertions |
| **Search: …** | the result of each `--search-mode` you ran (see *Two search strategies* below) |

The facts above (classification, signature, where it's implemented/explained/tested) are
always shown. The **Search** section(s) are what you choose with `--search-mode`.

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

### Two search strategies (`--search-mode`)

The report has two parts: the **facts** (always shown — classification, signature, where it's
implemented/explained/tested) and the **search**, which answers "where/how is this used?".
There are two fundamentally different ways to answer that, and `--search-mode` picks them. It
is **repeatable** — combine strategies freely. If you pass none, `chain-strict` runs.

```bash
bun run tests:where-is --search <name>                                       # chain-strict (default)
bun run tests:where-is --search <name> --search-mode chain-broad
bun run tests:where-is --search <name> --search-mode chain-strict --search-mode name   # combine
```

| `--search-mode` | how it searches | answers | precision |
|---|---|---|---|
| **`chain-strict`** (default) | **call-chain**: walk the recorded invocation graph upward from the symbol and **stop at the first public caller** (grouped by area) | "what public API reaches this — the precise route" | high (tight, on-operation) |
| **`chain-broad`** | **call-chain**, but keep climbing **past** the public callers through the whole graph | "the wider surrounding chain" | lower — the invocation edges are name-based, so it crosses shared `query`/`__toSql` funnels and pulls in sibling operations |
| **`name`** | **name-based**: match the name across every dimension (symbols, members, tests, docs, examples, negatives) | "everywhere this name appears" | low/high-recall — ignores the call-chain entirely, so it finds usages the graph can't connect, with noise |

The first two are the *same* search (the call-chain) at two stop points; `name` is the *other*
search (pure name lookup). A hop is *public* when the calling function is itself public (a
`public`/`public_impl` member or a public-surface symbol), in **any** area. Example:
`--search __addOrderBy` (chain-strict) reports it's reached by the public `orderBy` /
`orderByFromString` — the precise chain; add `--search-mode name` to also see every mention.

Under `npm run` the flags need a `--` separator (`npm run tests:where-is -- --search <name> --search-mode name`);
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
> index: built 2026-06-03T20:32:03Z · 40fa555f-dirty · resolved · schema v3
> ⚠️  index built at 40fa555f, working tree is at d9100896 — likely STALE; rebuild with `tests:index`
> ⚠️  working tree is dirty — the index may not reflect uncommitted edits
```

If you see those warnings and your question is about code you just changed, re-run
`bun run tests:index`. (The searcher refuses outright only when the index is from an
incompatible tool version — a schema mismatch.) For a RAM-constrained machine,
`bun run tests:index -- --no-resolve` builds faster/lighter but drops the precise
binding links; name-based lookups still work.
