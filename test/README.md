# `test/` — ts-sql-query test suite

The new ts-sql-query test suite. Designed to **eventually replace
[`src/examples/`](../src/examples)** without losing any of its existing
coverage. Both coexist until parity is reached; this folder is the future.

This file is the **navigation map**. Pick the topic you need; jump to its
authoritative document.

## What the suite guarantees, per test

Each test goes through a single connection (`ctx.conn`) backed by either
the real driver-backed runner or a `MockQueryRunner`, and asserts:

1. The SQL string the builder emitted (`ctx.lastSql`) — inline snapshot.
2. The bound params (`ctx.lastParams`) — inline snapshot.
3. The exact TypeScript type of the result (no widening, no narrowing).
4. The returned value — `expect(result).toEqual(expected)` covers both
   modes because the mock is pre-primed (`ctx.mockNext(expected)`) with
   the same data the real seed contains.

Everything tested by the suite (except the compile-time negatives) runs
through the **same** code path in both modes, so anything that passes the
suite has potentially gone through the real database.

The suite's **purpose is real-DB validation**; the mock is the cheap
feedback loop and regression gate. See
[`DESIGN.md` § Real-DB validation](./DESIGN.md#real-db-validation) for the
`mock-validated` vs `real-validated` vocabulary the round-closing report
uses.

## Navigation map — read this when you want to …

### … understand what is and isn't allowed

| Want | Read |
|---|---|
| The rules every test must follow | [`DESIGN.md`](./DESIGN.md) |
| Why mock-only is suspicious (and the mirror-image variant) | [`DESIGN.md` § Mock-only is a smell](./DESIGN.md#mock-only-smell) |
| When `as any` is allowed (the only sanctioned case) | [`DESIGN.md` § The `as any` runtime-guard exception](./DESIGN.md#as-any-runtime-guard) |
| The symmetry rule + full-canonical-body discipline | [`DESIGN.md` § Symmetry rule](./DESIGN.md#symmetry-rule), [§ Full-canonical-body](./DESIGN.md#full-canonical-body) |

### … run things

| Want | Read |
|---|---|
| Quick `tests` commands and the inner-loop discipline | [`CLI.md`](./CLI.md) |
| Coverage runs and report formats (html, monocart, etc.) | [`CLI.md` § Coverage](./CLI.md#coverage) |
| Wall-time numbers for each invocation, bun vs vitest | [`BENCHMARKS.md`](./BENCHMARKS.md) |
| Validate the documentation code examples (type-check + mock SQL tests of the doc snippets) | [`DOC_CODE_EXTRACTOR.md`](./DOC_CODE_EXTRACTOR.md) |
| The shell scripts behind the CLIs | [`scripts/tests.sh`](../scripts/tests.sh) |

### … write or port a test

| Want | Read |
|---|---|
| Anatomy of a `.test.ts` file | [`WRITING_TESTS.md` § Anatomy](./WRITING_TESTS.md#anatomy-of-a-test-file) |
| Update inline snapshots | [`WRITING_TESTS.md` § Updating snapshots](./WRITING_TESTS.md#updating-snapshots) |
| Promote a test from mock-validated to real-validated | [`WRITING_TESTS.md` § Real-DB validation of one cell](./WRITING_TESTS.md#real-db-validation-of-one-cell) |
| Test a runtime guard the typer blocks | [`WRITING_TESTS.md` § Testing a runtime guard](./WRITING_TESTS.md#testing-a-runtime-guard-that-is-also-typed-at-compile-time) |
| Extend the shared project-management domain | [`WRITING_TESTS.md` § Extending the shared domain](./WRITING_TESTS.md#extending-the-shared-domain) |
| Write the test in the canonical cell when that cell can't compile it | [`WRITING_TESTS.md` § When the canonical cell can't compile the body](./WRITING_TESTS.md#when-the-canonical-cell-cant-compile-the-body) |
| Handle an import that only appears in a commented block | [`WRITING_TESTS.md` § Imports used only from commented-out blocks](./WRITING_TESTS.md#imports-used-only-from-commented-out-blocks) |
| Write a `docs:` snippet test | [`WRITING_TESTS.md` § Docs snippets](./WRITING_TESTS.md#docs-snippets) |
| Hand off a `src/` bug you discovered | [`WRITING_TESTS.md` § When a test surfaces a bug in `src/`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src) |
| Write a negative type test | [`WRITING_TESTS.md` § Negative type tests](./WRITING_TESTS.md#negative-type-tests) |
| Handle a tsgo / tsc divergence | [`WRITING_TESTS.md` § Handling tsgo / tsc divergences](./WRITING_TESTS.md#handling-tsgo--tsc-divergences) |

### … add a database, connector, or version

| Want | Read |
|---|---|
| End-to-end "add a new database" | [`NEW_DATABASE.md`](./NEW_DATABASE.md) |
| End-to-end "add a new connector" or "add a new compatibility version" | [`NEW_DATABASE.md`](./NEW_DATABASE.md) |
| The tree convention every database must satisfy | [`PER_DATABASE_LAYOUT.md`](./PER_DATABASE_LAYOUT.md) |
| The factory pattern in `runners.ts` | [`PER_DATABASE_LAYOUT.md` § `runners.ts`](./PER_DATABASE_LAYOUT.md#runnersts--per-connector-context-factories) |

### … generate tests from a coverage report (agent-driven round)

| Want | Read |
|---|---|
| The runbook itself | [`COVERAGE_RUNBOOK.md`](./COVERAGE_RUNBOOK.md) |
| The canonical-cell validation gate (pre-propagation review) | [`QUALITY_GATE.md`](./QUALITY_GATE.md) |
| The actual prompt the validation sub-agent receives | [`lib/canonical-cell-review-prompt.md`](./lib/canonical-cell-review-prompt.md) |
| Catalogue of past failure modes with rules + gates | [`ANTIPATTERNS.md`](./ANTIPATTERNS.md) |
| Find where a symbol lives / is reached / explained / tested; verify an API exists before proposing a wave (`tests:where-is`, builds on `tests:index`) | [`CODE_SEARCH.md`](./CODE_SEARCH.md) |

### … find context fast (the searcher)

`tests:where-is` answers *"where does this symbol live / get reached /
get explained / get tested"* in one report. **Read
[`CODE_SEARCH.md`](./CODE_SEARCH.md) in full once at session start** —
doors, sections, presets and reading conventions are all operational.
Pay special attention to
[§ "This tool vs. textual search"](./CODE_SEARCH.md#this-tool-vs-textual-search):
it is the gate that decides searcher vs grep per question. The hot spots
where the docs wire it into the flow are below — use them as quick
reminders, not as a substitute for reading the searcher doc once.

**Before you `grep`** — if your next move targets a symbol, type, member
or SQL token, the searcher already models it. Reach for one of these:

| If you were about to grep for… | Use this instead |
|---|---|
| a method / type / symbol name in `src/` (`virtualColumnFromFragment`) | `--search <name> --declared full` — every declaration site (the lesson the `Table.ts` miss taught: a bug entry can name two files when the symbol lives in three) |
| "what helper exists that contains this token?" (`NoTableOrViewRequired`) | `--search-pattern-summary '<token>'` — pick-list of every matching name with kind, visibility, count, sample |
| "who overrides / implements this?" | `--implemented-by` (classes), `--ref-implements` (interfaces extending it) |
| "who calls this from the public surface?" | `--chain strict` (default) — call-chain stopping at the first public caller |
| "from this signature, what types does it compose and where do they live?" | `--location-target types` (or `--ref-type-arg` for blast radius of a type alias) |
| "what dispatches on this `unique symbol` brand?" | `--location-target brand` or `--ref-brand` |
| a SQL token → the builder code that emits it | `--emits-keyword '<sql-fragment>'` |
| every place a name appears anywhere (high recall fallback) | `--name-search full` |

Grep still wins for **literal prose** (comments, doc bodies, `EXTERNAL_CAVEATS.md`
catalogues), **switch case literals** (`case 'x'`), **byte-anchored mass edits**
(perl/python on file positions) and **exact occurrence counts**. The rule of
thumb lives in [`CODE_SEARCH.md`](./CODE_SEARCH.md#this-tool-vs-textual-search).

Then, for the round-shaping presets:

| Want | Command shape | Where it's wired |
|---|---|---|
| Verify an API exists before proposing a wave | `--search <api>` (Classification) | [`COVERAGE_RUNBOOK.md` § Verify the API actually exists](./COVERAGE_RUNBOOK.md#verify-the-api-actually-exists), [`ANTIPATTERNS.md` § Hallucinated API](./ANTIPATTERNS.md#5-hallucinated-api), [`WRITING_TESTS.md` § When a test surfaces a bug](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src) |
| Plan a coverage wave (existing coverage + missing cells + cell caveats) | `--for coverage-gap` | [`COVERAGE_RUNBOOK.md` § Verify the existing test inventory](./COVERAGE_RUNBOOK.md#verify-the-existing-test-inventory) |
| Propagate the canonical to sibling cells | `--for propagation` | [`COVERAGE_RUNBOOK.md` § Propagation](./COVERAGE_RUNBOOK.md#propagation), [`QUALITY_GATE.md`](./QUALITY_GATE.md) |
| Investigate a `src/` emission bug (SQL emitted + impls + version gates + sibling markers) | `--for emission-bug` | [`BUGS.md` § Common bug shapes](./BUGS.md#common-bug-shapes-for-the-fixing-agent) |
| Investigate a `src/` type bug (overload, variance, assignability — the route is the signature, not the call-chain) | `--for type-bug` | [`BUGS.md` § Common bug shapes](./BUGS.md#common-bug-shapes-for-the-fixing-agent) |
| After patching `src/`, find docs/tests/examples to refresh | `--for post-fix-sync` | [`BUGS.md` § When the fix lands](./BUGS.md) |
| Add or extend a compatibility-version cell | `--for version-work` | [`NEW_DATABASE.md` § Adding a compatibility version](./NEW_DATABASE.md#adding-a-compatibility-version) |
| Add a `@ts-expect-error` rule, consistent with existing locks | `--neg-types full` | [`WRITING_TESTS.md` § Negative type tests](./WRITING_TESTS.md#negative-type-tests) |
| Browse declared caveats on cells (BUG/LIMITATION markers per cell) | `--cell-caveats summary` (or `full` with `--coord`) | [`LIMITATIONS.md`](./LIMITATIONS.md), [`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md), [`ANTIPATTERNS.md` § Blind copy](./ANTIPATTERNS.md#3-blind-copy-to-bun_sql_postgres) |

`bun run tests:index` builds the underlying index (~28 s, gitignored).
The implementation references under `lib/codeSearcher/` and
`lib/codeIndexer/` are for the agent **modifying** the tools, not for
the agent consuming them.

### … know what's broken or limited

| Want | Read |
|---|---|
| Bugs in `src/` the suite has surfaced | [`BUGS.md`](./BUGS.md) |
| Deliberate gaps in `src/` (not bugs — declared limitations) | [`LIMITATIONS.md`](./LIMITATIONS.md) |
| Caveats per driver / engine / runtime (Bun#29010, MySQL no RETURNING, etc.) | [`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md) |

### … understand the infrastructure

| Want | Read |
|---|---|
| Every file under `test/lib/` (assertType, captureInterceptor, ctx, runtime shim, audit, setupTimezone, …) | [`TEST_LIB.md`](./TEST_LIB.md) |
| How the documentation code examples are tested — type-checked AND their SQL asserted via mock (the extractor, templates, simplified definitions) | [`DOC_CODE_EXTRACTOR.md`](./DOC_CODE_EXTRACTOR.md) |
| The mutation safety contract (`withRollback` / `withCommit` / `withReseed`) | [`TEST_LIB.md` § Mutation safety contract](./TEST_LIB.md#testcontextts--mutation-safety-contract) |
| How the code index is built / how to modify the indexer or searcher (schema, extractors, queries) | [`lib/codeIndexer/CODE_INDEXER.md`](./lib/codeIndexer/CODE_INDEXER.md), [`lib/codeSearcher/CODE_SEARCHER.md`](./lib/codeSearcher/CODE_SEARCHER.md) |
| Connector-specialised mocks (when a real runner transforms params) | [`lib/mockRunners/README.md`](./lib/mockRunners/README.md) |
| Docker container reuse, schema/seed revalidation, per-worker DBs | [`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md) |
| The WASM lifecycle (pglite, sqlite-wasm-OO1) | [`ENGINE_LIFECYCLE.md` § WASM lifecycle](./ENGINE_LIFECYCLE.md#wasm-lifecycle) |

## Layout in one screen

```
test/
├── *.md                                  ← documentation (this file is the map)
├── tsconfig.json
├── lib/                                  ← infra (TEST_LIB.md is the reference)
│   ├── testRunner.ts                     ← bun:test | vitest shim
│   ├── testContext.ts                    ← `ctx` factory + mutation safety
│   ├── captureInterceptor.ts             ← SQL + params capture
│   ├── backends.ts                       ← `isRealDbEnabled`, `RealDbBackend`
│   ├── assertType.ts                     ← `Exact<A,B>`, `assertType<T extends true>`
│   ├── auditTestSymmetry.ts              ← the symmetry audit
│   ├── containerLifecycle.ts             ← container/per-worker infra
│   ├── isAllowed.ts                      ← query introspection escape hatch
│   ├── setupTimezone.ts                  ← forces UTC
│   ├── canonical-cell-review-prompt.md   ← validation sub-agent prompt asset
│   ├── coverage/                         ← bun lcov → html / monocart
│   ├── docCodeExtractor/                 ← doc snippet → matrix test cell: type-check + mock SQL (DOC_CODE_EXTRACTOR.md)
│   ├── codeIndexer/                      ← builds the queryable SQLite code map (tests:index, CODE_INDEXER.md)
│   ├── codeSearcher/                     ← searches that map: where-is a symbol (tests:where-is, CODE_SEARCHER.md)
│   └── mockRunners/                      ← connector-specialised mocks + DocCodeMockRunner.ts (the doc SQL tests' mock)
└── db/<database>/<compatibilityVersion>/<connector>/
                                          ← test cells; see PER_DATABASE_LAYOUT.md
```

- `<database>` = one of `docs/configuration/supported-databases/*.md`
  (`mariadb`, `mysql`, `oracle`, `postgres`, `sqlite`, `sqlserver`).
- `<compatibilityVersion>` = `newest` (default,
  `Number.POSITIVE_INFINITY`), the literal numeric value of any
  documented breakpoint (e.g. `13_000_001`, `10_005_000`), or `oldest`
  (the `< lowest-breakpoint` zone).
- `<connector>` = one of `docs/configuration/query-runners/recommended/*.md`
  for that database.

Not every (version × connector) cell is valid — `pglite` bundles
PostgreSQL 17 so it only appears under `oldest/`. Folders for invalid
cells simply do not exist.

## TL;DR commands

```bash
# Daily mocked loop, ~8 s under bun.
bun run tests

# One cell, fastest possible iteration.
bun run tests postgres/newest/pg

# Real-DB validation of one cell (docker). Add --bail to abort on first
# failure while iterating — saves wall-time on the slow lane.
bun run tests postgres/newest/pg --docker --bail

# Real WASM on a wasm cell.
bun run tests postgres/oldest/pglite --wasm

# Update snapshots.
bun run tests postgres/newest/pg --update-snapshots

# Enumerate the active cells (sorted, one per line, no test execution).
# Handy before propagating a wave or scoping a focused run.
bun run tests --list-cells

# Pre-push sanity sweep.
bun run tests:audit && bun run validate:tests && bun run tests

# Full real matrix (the user's confidence check).
bun run tests --docker --wasm
```

Full reference: [`CLI.md`](./CLI.md).
