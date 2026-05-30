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
| The mutation safety contract (`withRollback` / `withCommit` / `withReseed`) | [`TEST_LIB.md` § Mutation safety contract](./TEST_LIB.md#testcontextts--mutation-safety-contract) |
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
│   └── mockRunners/                      ← connector-specialised mocks
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

# Real-DB validation of one cell (docker).
bun run tests postgres/newest/pg --docker

# Real WASM on a wasm cell.
bun run tests postgres/oldest/pglite --wasm

# Update snapshots.
bun run tests postgres/newest/pg -- --update-snapshots

# Pre-push sanity sweep.
bun run tests:audit && bun run validate:tests && bun run tests

# Full real matrix (the user's confidence check).
bun run tests --docker --wasm
```

Full reference: [`CLI.md`](./CLI.md).
