# `test/lib/` — reference

Every piece of infrastructure under [`test/lib/`](./lib/). Per-file contract,
how to use it from a test, and the seam to extend when you need to add a new
primitive. Cite the file plus the symbol name, e.g.
[`testContext.ts`](./lib/testContext.ts) (`createTestContext`), never a line
number: these contracts are stable but the implementations move, and nothing
checks a line number, so it rots silently.

For docker / WASM lifecycle (which lives in `containerLifecycle.ts` but is its
own topic) see [`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md). For the
per-database tree convention see [`PER_DATABASE_LAYOUT.md`](./PER_DATABASE_LAYOUT.md).
For the documentation code extractor (`lib/docCodeExtractor/` + the
`DocCodeMockRunner` in `lib/mockRunners/DocCodeMockRunner.ts`, which turn the doc snippets into matrix
test cells that type-check the examples and assert their SQL via mock) see
[`DOC_CODE_EXTRACTOR.md`](./DOC_CODE_EXTRACTOR.md).

- [`testContext.ts` — `ctx` API surface](#testcontextts--ctx-api-surface)
- [`testContext.ts` — mutation safety contract](#testcontextts--mutation-safety-contract)
- [`FaultInjectingQueryRunner.ts` — transaction faults on demand](#faultinjectingqueryrunnerts--transaction-faults-on-demand)
- [`captureInterceptor.ts` — SQL / params recorder](#captureinterceptorts--sql--params-recorder)
- [`switchableRunner.ts` — the mock-only seam](#switchablerunnerts--the-mock-only-seam)
- [`backends.ts` — the real/mock gate + `RealDbBackend`](#backendsts--the-realmock-gate--realdbbackend)
- [`testRunner.ts` + `testRuntime.{bun,vitest}.ts` — runtime shim](#testrunnerts--testruntimebunvitestts--runtime-shim)
- [`assertType.ts` — compile-time type assertions](#asserttypets--compile-time-type-assertions)
- [`setupTimezone.ts` — force UTC](#setuptimezonets--force-utc)
- [`queryIntrospection.ts` — query introspection escape hatch](#queryintrospectionts--query-introspection-escape-hatch)
- [`audit/` — the symmetry audit and the content rules](#audit--the-symmetry-audit-and-the-content-rules)
- [`containerLifecycle.ts` — shared container infra](#containerlifecyclets--shared-container-infra)
- [`dockerImages.ts`, `dockerPreflight.ts`, `dockerVersionGuard.ts` — docker images and guards](#dockerimagests-dockerpreflightts-dockerversionguardts--docker-images-and-guards)
- [`coords.ts` — matrix coordinates](#coordsts--matrix-coordinates)
- [`coverage/` — bun coverage post-processors](#coverage--bun-coverage-post-processors)
- [`mockRunners/` — connector-specialised mocks](#mockrunners--connector-specialised-mocks)
- [The tools with their own document](#the-tools-with-their-own-document)

## `testContext.ts` — `ctx` API surface

`ctx` (type `TestContext<CONN>` in [`testContext.ts`](./lib/testContext.ts)) is
the single object every test file imports through its `setup.ts`. Construction
is `createTestContext<CONN>(opts)`; per-database factories under `test/db/<db>/runners.ts` wrap it.

What a test reaches via `ctx`:

| Field / method | Type | Purpose |
|---|---|---|
| `ctx.conn` | `CONN` | The ts-sql-query connection. Throws if read before `up()`. |
| `ctx.label` | `string` | Cell label (`"<version> / <connector>"`). |
| `ctx.canonicalForDocs` | `boolean` | Mirrors the `canonicalForDocs` option some `setup.ts` files set. The option stays in code, but nothing reads it. |
| `ctx.compatibilityVersion` | `number \| undefined` | The value the cell's `setup.ts` pins: the `<version>` folder's literal value, `Number.POSITIVE_INFINITY` in `newest`. |
| `ctx.realDbEnabled` | `boolean` | True iff the cell's real-DB branch is active for this run. |
| `ctx.timeoutMs` | `number` | Default for `beforeAll(() => ctx.up(), ctx.timeoutMs)`. |
| `ctx.lastSql` / `ctx.lastParams` / `ctx.lastType` | snapshot getters | Most-recent emitted SQL / params / query type. Fall back to query type ("commit", "rollback") when the underlying op emits no SQL. |
| `ctx.lastNoTransactionSql` (+ Params, + Type) | snapshot getters | Same triplet but skips transaction-control ops. Use after a `connection.transaction(...)` block. |
| `ctx.history` | `ReadonlyArray<{type, sql, params}>` | Every captured op in order, including begin/commit/rollback. |
| `ctx.lastTransactionOpts` | `readonly unknown[] \| undefined` | Most-recent `BeginTransactionOpts` passed through `transaction(fn, opts)` / `beginTransaction(opts)`. Works for connectors whose real runner manages transactions internally and never fires `executeBeginTransaction`. |
| `ctx.mockNext(value)` | `void` | Queue a value for the NEXT data query. Ignored when real DB is on — unless the test asked for `ctx.mockOnlyConnection()`. For a one-column query (`selectOneColumn`), `undefined` is "no row" (`executeSelectOne` throws `NO_RESULT`) and `null` is a row whose value is null. For a whole-row query, both mean "no row". |
| `ctx.mockOnlyConnection()` | `CONN` | Point `ctx.conn` (and everything derived from it) at the mock for the rest of THIS test, on every cell. The escape hatch for a scenario whose INPUT only the mock can supply. Needs a `// MOCK-ONLY: <reason>` marker — `tests:audit` gates it. Undone by `ctx.reset()`. |
| `ctx.withConnection(subclass)` | `T extends CONN` | Build a config-varied connection from a `CONN` subclass, threading the same interceptor and the cell's `compatibilityVersion`. The sanctioned way to override a connection field; never hand-construct one. |
| `ctx.withFaultInjection(options?)` | `{ conn, faults }` | A connection whose transaction-lifecycle calls fail on demand, wrapping the same interceptor. See [`FaultInjectingQueryRunner.ts`](#faultinjectingqueryrunnerts--transaction-faults-on-demand). |
| `ctx.up()` / `ctx.down()` / `ctx.reset()` | lifecycle | Wire from `beforeAll` / `afterAll` / `beforeEach`. |
| `ctx.reseed()` | `Promise<void>` | Restore the seeded baseline: the data-only `domain/reset.sql` + the seed (SQLite, which has no `reset.sql`, re-applies schema + seed). No-op when real DB is off. |
| `ctx.withRollback(fn)` | mutation primitive | Open tx, run `fn`, rollback. Default for mutating tests. |
| `ctx.withCommit(fn)` | mutation primitive | Open tx, run `fn`, commit, then `reseed()`. For DDL on non-transactional-DDL engines, post-commit visibility, sequence-counter advance. |
| `ctx.withReseed(fn)` | mutation primitive | No outer tx; run `fn`, then `reseed()`. For tests that manage their own `connection.transaction(...)`. |

The `TestContext<CONN>` interface in [`testContext.ts`](./lib/testContext.ts) is
the contract. New primitives go through `createTestContext` (factory) +
`TestContextOptions` (config) + the `TestContext<CONN>` interface — three
matched additions, in that order.

## `testContext.ts` — mutation safety contract

Any test that mutates state must go through one of three primitives.
Read-only tests use `ctx.conn` directly without a wrapper. Test bodies stay
free of cleanup logic — the wrapper owns it.

| Primitive | When to use it | What the infra does |
|---|---|---|
| `await ctx.withRollback(async () => { … })` | the body mutates state the next test must not see (the common case) | wraps body in `connection.transaction(...)` and throws a `RollbackSignal` to roll back — even on failure |
| `await ctx.withCommit(async () => { … })` | body needs the mutation to commit (DDL on engines without transactional DDL, post-commit visibility, sequence counters that must really advance) | wraps body in a real transaction that **commits**, then calls `ctx.reseed()` in a `finally` to restore the seeded baseline |
| `await ctx.withReseed(async () => { … })` | body itself manages a transaction (`connection.transaction(...)`) — wrapping it in a second tx would nest and most engines reject that | runs body as-is (no outer tx), then calls `ctx.reseed()` in a `finally` |

```ts
test('reading is fine outside a wrapper', async () => {
    const rows = await ctx.conn.selectFrom(tSomeTable).select({ /* … */ }).executeSelectMany()
    expect(rows).toEqual(/* … */)
})

test('mutating uses withRollback (default)', async () => {
    await ctx.withRollback(async () => {
        await ctx.conn.update(tSomeTable).set({ /* … */ }).where(/* … */).executeUpdate()
        // Rolled back after the body — seed survives for the next test.
    })
})

test('DDL on engines without transactional DDL needs withCommit', async () => {
    await ctx.withCommit(async () => {
        await ctx.conn.queryRunner.executeDatabaseSchemaModification(
            'CREATE TABLE leftover (id int)',
        )
        // … assertions about server-side state …
        await ctx.conn.queryRunner.executeDatabaseSchemaModification(
            'DROP TABLE leftover',
        )
    })
    // ctx.reseed() has already run — the seeded tables are back at
    // baseline. The body dropped its own `leftover` table because the
    // reseed only knows about the declared seed.
})
```

`withCommit` only resets what the seed declares, and the reset is data-only on
every engine but SQLite. If a test creates schema
objects that fall outside that declaration (extra tables, sequences,
functions, …), the **body of the `withCommit` callback** should drop them
before returning. Keep that local cleanup to a single block at the bottom of
the callback so it is impossible to miss when reading the test.

**When in doubt** → fall back to a fresh container by passing
`--docker-mode no-reuse` once, or by stopping the warm containers
(`bun run tests:stop-containers` — see
[`ENGINE_LIFECYCLE.md` § Stopping the reused containers](./ENGINE_LIFECYCLE.md#stopping-the-reused-containers)).
A run against a fresh container is ground truth; if a test passes there and
fails under reuse, that is the signal some test is leaking state through a
path the contract above does not cover.

The `RollbackSignal` class in [`testContext.ts`](./lib/testContext.ts)
is the small ceremony that makes the same code path work for
both mock and real-DB modes: the mock is told via `isSqlError` config that
the signal is NOT a SQL error, so the connection re-throws it instead of
wrapping it in a `TsSqlQueryExecutionError`.

## `captureInterceptor.ts` — SQL / params recorder

The seam between `ctx.conn` (what the test uses) and the underlying runner
(mock or real). Extends
[`InterceptorQueryRunner`](../src/queryRunners/InterceptorQueryRunner.ts) and
captures three things every test asserts:

- `lastSql` / `lastParams` / `lastType` — most-recent op (any type, including
  begin/commit/rollback which surface with empty SQL — the type stands in,
  see the getters in [`captureInterceptor.ts`](./lib/captureInterceptor.ts)).
- `lastNoTransactionSql` (+ Params, + Type) — same triplet but gated by query
  TYPE (not by "is SQL empty"). Use when a `transaction(...)` block would
  otherwise leave `lastSql` showing `"commit"`.
- `lastTransactionOpts` — `BeginTransactionOpts` last passed through
  `transaction(fn, opts)` / `beginTransaction(opts)`. Captured at the
  interceptor layer **before** any per-runner handling, so even connectors
  whose real-DB runner manages transactions internally (Porsager's
  `postgres` and Bun's `sql` use `sql.begin(fn)`, `oracledb` flips
  autocommit) and never call `executeBeginTransaction` still surface the
  opts. Override sites: `executeBeginTransaction` and `executeInTransaction` in
  [`captureInterceptor.ts`](./lib/captureInterceptor.ts).

Tests don't construct or override the interceptor — it's wired by
`createTestContext` in [`testContext.ts`](./lib/testContext.ts).

## `FaultInjectingQueryRunner.ts` — transaction faults on demand

[`FaultInjectingQueryRunner`](./lib/FaultInjectingQueryRunner.ts) wraps the
runner so `executeBeginTransaction` / `executeCommit` / `executeRollback` **fail
on demand**, which is how the driver-rejection classification in
`AbstractConnection` gets exercised. Tests reach it through
`ctx.withFaultInjection()`, which returns the connection and the handle to arm
faults on. See the `withFaultInjection` comment in
[`testContext.ts`](./lib/testContext.ts) for the real-DB caveat: a faulted
`commit` / `rollback` leaves the real transaction open, so such a test runs
through `ctx.withReseed(...)`.

## `switchableRunner.ts` — the mock-only seam

[`SwitchableQueryRunner`](./lib/switchableRunner.ts) is what makes
`ctx.mockOnlyConnection()` possible. It sits BELOW the capture interceptor and
delegates every `QueryRunner` member to whichever runner is currently selected:

```
ctx.conn  ->  CaptureInterceptor  ->  SwitchableQueryRunner  ->  real
                                                             \-> mock
```

Because the interceptor above it never moves, flipping the switch redirects
`ctx.conn` IN PLACE: `ctx.lastSql` / `ctx.history` observe the mock-backed
queries exactly as they observed the real ones, and every connection built from
the live interceptor (`ctx.withConnection`, `ctx.withFaultInjection`, the
per-database `withXxx` factories) inherits the active target with no extra
plumbing. On a cell that already runs the mock, both sides are the same object
and the switch is a no-op.

`ctx.mockOnlyConnection()` calls `useMock()`; `ctx.reset()` — the `beforeEach`
every cell registers — calls `useDefault()`, which is what scopes the switch to
a single test.

It is a hand-written delegator rather than a `ChainedQueryRunner` subclass
because that base class holds its delegate in a `readonly queryRunner`
PROPERTY, and TypeScript forbids re-declaring a base property as an accessor —
so there is no type-safe way to make the base's delegate swappable. Writing the
delegation out keeps `src/` untouched and confines the mutation to one field.

## `backends.ts` — the real/mock gate + `RealDbBackend`

`isRealDbEnabled(database, requires, version?, connector?)` is the runtime
source of truth: given a cell's db / kind / version / connector it returns
whether that cell's real-DB branch fires (otherwise the cell transparently
falls back to the mock — the test body runs either way). `RealDbBackend`
(`'docker' | 'wasm' | 'native'`) tags which heavyweight backend a connector
needs.

The gate is driven by an **internal** per-kind env channel the `tests` script
produces from the `--docker` / `--wasm` / `--native` flags. That's an
implementation detail — the agent uses the flags, never the env vars. The
authoritative contract (the env var names, their `all|none|newest|<cell-list>`
grammar, and how the flags resolve into them) lives where it's produced, in
[`scripts/_test-common.sh`](../scripts/_test-common.sh); `backends.ts` parses
it and points back there. For the user-facing flags see [`CLI.md`](./CLI.md).

`RealDbBackend = 'docker' | 'wasm' | 'native'` in [`backends.ts`](./lib/backends.ts)
tags a connector by **gating profile**:

- `docker`: needs a real DB container (mariadb, mysql2, oracledb, mssql, pg,
  postgres, bun_sql_postgres, bun_sql_mysql). Gated by `--docker`.
- `wasm`: needs WebAssembly bootstrap (pglite, sqlite-wasm-OO1 and its `-sync`
  twin). Gated by `--wasm`. Separate from `native` because the bootstrap is
  CPU-bound and dominates wall time.
- `native`: needs no extra infrastructure. The embedded SQLite drivers
  (better-sqlite3, bun_sqlite, bun_sql_sqlite, node_sqlite, and their
  `-sync` twins). Gated by `--native`, real by default.

The convenience predicate `isRealDbEnabled(database, requires, version?, connector?)`
combines scope + flag + version-scope into a single boolean every connector
factory consumes. The legacy boolean overload (`isRealDbEnabled(db, needsDocker)`)
is kept for the callers that pass a boolean: `true` reads as
`'docker'`, `false` as `'native'`.

## `testRunner.ts` + `testRuntime.{bun,vitest}.ts` — runtime shim

[`testRunner.ts`](./lib/testRunner.ts) is the surface every `*.test.ts` and
the framework lib imports:

```ts
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '../../../../lib/testRunner.js'
```

It re-exports from `#test-runtime`, an
[imports map](../package.json) entry that resolves to
[`testRuntime.bun.ts`](./lib/testRuntime.bun.ts) under `bun test` and
[`testRuntime.vitest.ts`](./lib/testRuntime.vitest.ts) under vitest — on Node,
and also on Bun (`--use-vitest` under `bun run`), since vitest's resolver does
not apply the `bun` condition. The split
exists because a dynamic `await import('bun:test')` / `import('vitest')`
under a top-level await doesn't work: under `bun test --parallel=N` worker processes
evaluate the importing test files before that await resolves, producing
`ReferenceError: Cannot access 'describe' before initialization` on every
test. Static re-exports gated by the imports map resolve at parse time, no
TDZ window. See the comment at the top of
[`testRunner.ts`](./lib/testRunner.ts).

`TEST_RUNTIME: 'bun' | 'vitest'` in [`testRunner.ts`](./lib/testRunner.ts)
is the detection if you ever need to branch (you almost never do — the two
runners' hooks are identical on the surface this suite uses). It detects the
**runtime** (`globalThis.Bun`), not the runner: under vitest on Bun it is
`'bun'`, which is what a test that needs a Bun API (Bun SQL) wants.

To add a new primitive (a custom matcher, a new lifecycle hook) the order is:
1. Add to BOTH `testRuntime.bun.ts` AND `testRuntime.vitest.ts` so the import
   surface stays the same.
2. Re-export in `testRunner.ts`.
3. Use across the suite.

## `assertType.ts` — compile-time type assertions

Two type-level helpers (`Exact`, `Extends` in [`assertType.ts`](./lib/assertType.ts))
plus a no-op runtime function:

```ts
const r = await ctx.conn.selectFrom(t)...executeSelectMany()
assertType<Exact<typeof r, Array<{ id: number, name: string }>>>()
```

- `Exact<A, B>` — `true` iff `A` and `B` are mutually assignable AND have
  identical key sets at every depth. The standard "invariant equality" trick
  used by tsd / type-fest / expect-type. Anything looser would let a test pass
  when the result type silently became wider/narrower than expected — the
  exact regression this suite catches.
- `Extends<A, B>` — `true` iff `A extends B`. Looser; use when the docs
  explicitly say "result type is at least `{...}`" and a future widening would
  be OK.
- `assertType<T extends true>(_value?)` — no-op at runtime. The type parameter
  is the assertion: if `T` is not `true`, the call site fails to compile.

For compile-time negative tests under `test/db/<db>/types.negative/`, see
[`WRITING_TESTS.md` § Negative type tests](./WRITING_TESTS.md#negative-type-tests).

## `setupTimezone.ts` — force UTC

```ts
// test/lib/setupTimezone.ts
process.env.TZ = 'UTC'
```

[Source](./lib/setupTimezone.ts). One line of effect behind its comment.
Forces every test process into UTC so `localDateTime` / `localDate` /
`localTime` marshalling is deterministic across developer machines and CI,
and matches the docker database engines (which run in UTC).

Without this a value like `new Date('2020-01-01T00:00:00.000Z')` marshals to
a machine-local wall-clock string on connectors that store dates as text
(sqlite), so the emitted param — and therefore the snapshot — would shift
with the host timezone.

Wired as a bun [`preload`](../bunfig.toml) and a vitest
[`setupFiles`](../vitest.config.ts) so it applies under both runners,
including direct `bun test` / `npx vitest run` invocations on a single file.

**If you write or port a test that uses Date values**: you don't need to do
anything — UTC is forced before any test file evaluates. If you ever observe
snapshots diverging by host timezone, this is the file that failed to
preload; check the bunfig/vitest config integration.

## `queryIntrospection.ts` — query introspection escape hatch

A few functions, one documented exception to
[`DESIGN.md` § Public surface only](./DESIGN.md#public-surface-only):

```ts
isQueryAllowed(query)      // -> boolean: every allowWhen/disallowWhen gate open?
queryHasAggregation(query) // -> boolean: does the query contain an aggregation?
oldValuesTableDiscoveredBy(mutation)       // -> the oldValues() pseudo-table an UPDATE discovered, or undefined
valuesForInsertTableDiscoveredBy(mutation) // -> the valuesForInsert() pseudo-table an INSERT discovered, or undefined
```

Hooks into the lib's unfinished `__isAllowed` / `__hasAggregation` walkers —
see [`LIMITATIONS.md` § Query introspection](./LIMITATIONS.md#query-introspection-__isallowed-__hasaggregation-has-no-public-api-yet--tests-reach-internals-via-a-single-helper)
for the full rationale and the contract for when the public API lands.

**The existence of these helpers does NOT widen the licence.** Test bodies must
not import from `src/internal/`, `src/queryBuilders/`, `src/sqlBuilders/`,
etc. If you need a new introspection capability for a test, extend this file
(one stable seam, one documented exception) — do not open a second escape
route.

## `audit/` — the symmetry audit and the content rules

The audit has its own folder, [`audit/`](./lib/audit/), beside its
design doc [`AUDIT.md`](./lib/audit/AUDIT.md) — the same convention as
`codeIndexer/` and `codeSearcher/`. The symmetry check (part of
`bun run tests:audit`) lives at [`audit/symmetry.ts`](./lib/audit/symmetry.ts):
it walks `test/db/`, lists every `(database × version × connector)` cell of the
**whole matrix**, extracts test names from each `.test.ts` (including ones inside
`/* … */` blocks — they count) and reports any divergence in the file set, the
test names, or their order as `symmetry` findings folded into the unified report.
`domain/` + `types.negative/` dirs, the `documentation` connector and the
`general` db are excluded (see [`DOC_CODE_EXTRACTOR.md`](./DOC_CODE_EXTRACTOR.md)),
as are `config.*` files and files whose name embeds a database name.
`symmetry` is at `error` severity, like every other rule: a divergence blocks.

**To use the audit** (run it, read a finding, fix/suppress, propose a pattern),
read [`TESTS_AUDIT.md`](./TESTS_AUDIT.md). **To extend it**, read
[`AUDIT.md`](./lib/audit/AUDIT.md) first — it is the anchor for the tool's
roadmap: the anti-cheat content rules (`mirror-image`, `as-any`, `uuid-literal`),
the warn→error severity model and the `tests-audit-disable-*` suppression comment.

## `containerLifecycle.ts` — shared container infra

Per-process container keep-alive, cross-process reuse via lockfile,
schema/seed hashing for revalidation, per-worker DB naming, advisory-lock
key constants. Covered in detail in
[`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md). What lives here in code:

- `createContainerHandle(factory, {lockKey})` — the keep-alive wrapper.
- `createContainerRegistry(factory)` — one keep-alive handle per image, what each
  docker `runners.ts` holds at module scope.
- `memoizeSharedRunner(factory)` — same
  shape for the runner-level pool/connection (so the docker pool lives for
  the worker process, not per file).
- `hashSqlFiles(...contents)` — sha256
  digest used to detect schema/seed changes across reuses.
- `withCrossProcessLock(name, fn)` (internal to the file) —
  cross-process mutex backed by a lockfile in `os.tmpdir()`.
- `workerId()` / `workerName(base)` / `parallelDbsEnabled()` — per-worker DB
  naming.
- Constants: `META_DB_NAME` / `BASE_WORKER_DB_NAME` / `BASE_ORACLE_USER` /
  `SCHEMA_HASH_META_TABLE` / `VALIDATE_LOCK_KEY_BIGINT` / `VALIDATE_LOCK_NAME`.

## `dockerImages.ts`, `dockerPreflight.ts`, `dockerVersionGuard.ts` — docker images and guards

- [`dockerImages.ts`](./lib/dockerImages.ts) — `ENGINE_IMAGES`, the hand-maintained
  map from `<db>/<version-folder>` to the image it runs against, and the
  single source of truth each `runners.ts` reads (`newestImage`, `imageForCell`).
  SQLite is absent: no container.
- [`dockerPreflight.ts`](./lib/dockerPreflight.ts) — preflight and sequential
  warmup for the `--docker` matrix, so the engines don't cold-start all at once.
- [`dockerVersionGuard.ts`](./lib/dockerVersionGuard.ts) — guardrail for
  `--docker-version closest`: it rejects a selection that would bring up two
  different images of the same engine at once.

See [`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md).

## `coords.ts` — matrix coordinates

[`coords.ts`](./lib/coords.ts) parses and matches
`db[/version[/connector[/file]]]` coordinates, with glob `*` and brace `{a,b}`.
Shared by the searcher (`tests:where-is --coord`) and the audit (`tests:audit`
positional coords). See [`CLI.md` § Coord patterns](./CLI.md#coord-patterns).

## `coverage/` — bun coverage post-processors

Two scripts that synthesise rich HTML from bun's lcov-only coverage output
(bun has no native html coverage reporter):

- [`coverage/lcovToHtml.ts`](./lib/coverage/lcovToHtml.ts) — feeds lcov to
  `lcov-parse` + `istanbul-reports` (both run under bun, no node spawned) and
  emits `.test-report/coverage/index.html`. The default for
  `--coverage-format=html` under bun.
- [`coverage/lcovToMonocart.ts`](./lib/coverage/lcovToMonocart.ts) — feeds
  lcov to `monocart-coverage-reports` and asks for `html-spa` +
  `console-summary`. Mutually exclusive with `html` (same target filename).
  Side-steps `v8.setFlagsFromString` (bun has not implemented it) by shimming
  `globalThis.gc` to a no-op before a dynamic import.

Both are invoked by `scripts/tests.sh` when bun is the runner. Under vitest
the V8 byte-range coverage path replaces all of this; see
[`CLI.md` § Coverage](./CLI.md#coverage) for which reporter to pick.

## `mockRunners/` — connector-specialised mocks

Each file is a `MockQueryRunner` subclass that mirrors **one** real
`QueryRunner` from `src/queryRunners/`, narrowed to the slice that observably
differs from the generic mock. Used by `test/db/<db>/runners.ts` so the
params captured by `CaptureInterceptor` are identical between mock and real
modes — test bodies do not need `if (ctx.realDbEnabled) ... else ...`
branches just to satisfy a snapshot that depends on a driver's internal
massage.

Full conventions and when to add a sibling: [`mockRunners/README.md`](./lib/mockRunners/README.md).

Today's divergences are in `addParam`: `boolean → int` coercion in four SQLite
runners (`MockBetterSqlite3QueryRunner`, `MockBunSqliteQueryRunner`,
`MockNodeSqliteQueryRunner`, `MockSqlite3WasmOO1QueryRunner`). `MockBunSqlSqliteQueryRunner` and
`MockBunSqlPostgresQueryRunner` behave as the generic mock does, kept on disk so a
future quirk is a one-file edit. Only these connectors have one; every other
connector uses the generic mock.

Wire from a cell factory via the `mockRunnerClass` option of `createTestContext`
in [`testContext.ts`](./lib/testContext.ts):

```ts
createTestContext({
    /* … */
    mockRunnerClass: MockBunSqliteQueryRunner,
    /* … */
})
```

## The tools with their own document

These folders under `test/lib/` are tools, documented on their own:

- [`docCodeExtractor/`](./lib/docCodeExtractor/) — see [`DOC_CODE_EXTRACTOR.md`](./DOC_CODE_EXTRACTOR.md).
- [`codeIndexer/`](./lib/codeIndexer/) — see [`CODE_INDEXER.md`](./lib/codeIndexer/CODE_INDEXER.md).
- [`codeSearcher/`](./lib/codeSearcher/) — see [`CODE_SEARCHER.md`](./lib/codeSearcher/CODE_SEARCHER.md),
  and [`CODE_SEARCH.md`](./CODE_SEARCH.md) to use it.
