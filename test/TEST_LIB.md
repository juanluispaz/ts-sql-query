# `test/lib/` — reference

Every piece of infrastructure under [`test/lib/`](./lib/). Per-file contract,
how to use it from a test, and the seam to extend when you need to add a new
primitive. Cite `file:line` everywhere — these contracts are stable but the
implementations move; pinning the line stops the doc from rotting silently
while still surviving most non-trivial refactors.

For docker / WASM lifecycle (which lives in `containerLifecycle.ts` but is its
own topic) see [`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md). For the
per-database tree convention see [`PER_DATABASE_LAYOUT.md`](./PER_DATABASE_LAYOUT.md).
For the documentation code extractor (`lib/docCodeExtractor/` + the
`DocCodeMockRunner` in `lib/mockRunners/DocCodeMockRunner.ts`, which turn the doc snippets into matrix
test cells that type-check the examples and assert their SQL via mock) see
[`DOC_CODE_EXTRACTOR.md`](./DOC_CODE_EXTRACTOR.md).

- [`testContext.ts` — `ctx` API surface](#testcontextts--ctx-api-surface)
- [`testContext.ts` — mutation safety contract](#testcontextts--mutation-safety-contract)
- [`captureInterceptor.ts` — SQL / params recorder](#captureinterceptorts--sql--params-recorder)
- [`backends.ts` — the real/mock gate + `RealDbBackend`](#backendsts--the-realmock-gate--realdbbackend)
- [`testRunner.ts` + `testRuntime.{bun,vitest}.ts` — runtime shim](#testrunnerts--testruntimebunvitestts--runtime-shim)
- [`assertType.ts` — compile-time type assertions](#asserttypets--compile-time-type-assertions)
- [`setupTimezone.ts` — force UTC](#setuptimezonets--force-utc)
- [`isAllowed.ts` — query introspection escape hatch](#isallowedts--query-introspection-escape-hatch)
- [`audit/` — the symmetry audit (now its own tool)](#audit--the-symmetry-audit-now-its-own-tool)
- [`containerLifecycle.ts` — shared container infra](#containerlifecyclets--shared-container-infra)
- [`coverage/` — bun coverage post-processors](#coverage--bun-coverage-post-processors)
- [`mockRunners/` — connector-specialised mocks](#mockrunners--connector-specialised-mocks)

## `testContext.ts` — `ctx` API surface

`ctx` (type [`TestContext<CONN>`](./lib/testContext.ts#L21)) is the single
object every test file imports through its `setup.ts`. Construction is
[`createTestContext<CONN>(opts)`](./lib/testContext.ts#L187); per-database
factories under `test/db/<db>/runners.ts` wrap it.

What a test reaches via `ctx`:

| Field / method | Type | Purpose |
|---|---|---|
| `ctx.conn` | `CONN` | The ts-sql-query connection. Throws if read before `up()`. |
| `ctx.label` | `string` | Cell label (`"<version> / <connector>"`). |
| `ctx.canonicalForDocs` | `boolean` | True on the one cell per DB that the docs scraper publishes from. |
| `ctx.compatibilityVersion` | `number \| undefined` | The `<version>` folder's literal value, or undefined for `newest`. |
| `ctx.realDbEnabled` | `boolean` | True iff the cell's real-DB branch is active for this run. |
| `ctx.timeoutMs` | `number` | Default for `beforeAll(() => ctx.up(), ctx.timeoutMs)`. |
| `ctx.lastSql` / `ctx.lastParams` / `ctx.lastType` | snapshot getters | Most-recent emitted SQL / params / query type. Fall back to query type ("commit", "rollback") when the underlying op emits no SQL. |
| `ctx.lastNoTransactionSql` (+ Params, + Type) | snapshot getters | Same triplet but skips transaction-control ops. Use after a `connection.transaction(...)` block. |
| `ctx.history` | `ReadonlyArray<{type, sql, params}>` | Every captured op in order, including begin/commit/rollback. |
| `ctx.lastTransactionOpts` | `readonly unknown[] \| undefined` | Most-recent `BeginTransactionOpts` passed through `transaction(fn, opts)` / `beginTransaction(opts)`. Works for connectors whose real runner manages transactions internally and never fires `executeBeginTransaction`. |
| `ctx.mockNext(value)` | `void` | Queue a value for the NEXT data query. Ignored when real DB is on. |
| `ctx.up()` / `ctx.down()` / `ctx.reset()` | lifecycle | Wire from `beforeAll` / `afterAll` / `beforeEach`. |
| `ctx.reseed()` | `Promise<void>` | Re-apply schema + seed. No-op when real DB is off. |
| `ctx.withRollback(fn)` | mutation primitive | Open tx, run `fn`, rollback. Default for mutating tests. |
| `ctx.withCommit(fn)` | mutation primitive | Open tx, run `fn`, commit, then `reseed()`. For DDL on non-transactional-DDL engines, post-commit visibility, sequence-counter advance. |
| `ctx.withReseed(fn)` | mutation primitive | No outer tx; run `fn`, then `reseed()`. For tests that manage their own `connection.transaction(...)`. |

The interface ([`testContext.ts:21-119`](./lib/testContext.ts#L21-L119)) is
the contract. New primitives go through `createTestContext` (factory) +
`TestContextOptions` (config) + the `TestContext<CONN>` interface — three
matched additions, in that order.

## `testContext.ts` — mutation safety contract

Any test that mutates state must go through one of three primitives.
Read-only tests use `ctx.conn` directly without a wrapper. Test bodies stay
free of cleanup logic — the wrapper owns it.

| Primitive | When to use it | What the infra does |
|---|---|---|
| `await ctx.withRollback(async () => { … })` ([impl](./lib/testContext.ts#L305)) | the body mutates state the next test must not see (the common case) | wraps body in `connection.transaction(...)` and throws a `RollbackSignal` to roll back — even on failure |
| `await ctx.withCommit(async () => { … })` ([impl](./lib/testContext.ts#L324)) | body needs the mutation to commit (DDL on engines without transactional DDL, post-commit visibility, sequence counters that must really advance) | wraps body in a real transaction that **commits**, then calls `ctx.reseed()` in a `finally` to re-apply the schema + seed |
| `await ctx.withReseed(async () => { … })` ([impl](./lib/testContext.ts#L344)) | body itself manages a transaction (`connection.transaction(...)`) — wrapping it in a second tx would nest and most engines reject that | runs body as-is (no outer tx), then calls `ctx.reseed()` in a `finally` |

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
    // schema reset only knows about the declared seed.
})
```

`withCommit` only resets what the seed declares. If a test creates schema
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

The `RollbackSignal` ([`testContext.ts:176`](./lib/testContext.ts#L176))
implementation is the small ceremony that makes the same code path work for
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
  see [`captureInterceptor.ts:73-98`](./lib/captureInterceptor.ts#L73-L98)).
- `lastNoTransactionSql` (+ Params, + Type) — same triplet but gated by query
  TYPE (not by "is SQL empty"). Use when a `transaction(...)` block would
  otherwise leave `lastSql` showing `"commit"`.
- `lastTransactionOpts` — `BeginTransactionOpts` last passed through
  `transaction(fn, opts)` / `beginTransaction(opts)`. Captured at the
  interceptor layer **before** any per-runner handling, so even connectors
  whose real-DB runner manages transactions internally (Porsager's
  `postgres` and Bun's `sql` use `sql.begin(fn)`, `oracledb` flips
  autocommit) and never call `executeBeginTransaction` still surface the
  opts. Override sites: [executeBeginTransaction](./lib/captureInterceptor.ts#L63),
  [executeInTransaction](./lib/captureInterceptor.ts#L68).

Tests don't construct or override the interceptor — it's wired by
`createTestContext` ([`testContext.ts:274`](./lib/testContext.ts#L274)).

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

`RealDbBackend = 'docker' | 'wasm' | 'native'` ([`backends.ts:68`](./lib/backends.ts#L68))
tags a connector by **gating profile**:

- `docker`: needs a real DB container (mariadb, mysql2, oracledb, mssql, pg,
  postgres, bun_sql_postgres). Gated by `--docker`.
- `wasm`: needs WebAssembly bootstrap (pglite, sqlite-wasm-OO1). Gated by
  `--wasm`. Separate from `native` because the bootstrap is CPU-bound and
  dominates wall time.
- `native`: needs nothing. Always real. The embedded SQLite drivers
  (better-sqlite3, bun_sqlite, node_sqlite, sqlite3).

The convenience predicate
[`isRealDbEnabled(database, requires, version?, connector?)`](./lib/backends.ts#L105)
combines scope + flag + version-scope into a single boolean every connector
factory consumes. The legacy boolean overload (`isRealDbEnabled(db, needsDocker)`)
is kept for callers that pre-date the WASM toggle: `true` reads as
`'docker'`, `false` as `'native'`.

## `testRunner.ts` + `testRuntime.{bun,vitest}.ts` — runtime shim

[`testRunner.ts`](./lib/testRunner.ts) is the surface every `*.test.ts` and
the framework lib imports:

```ts
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '../../../../lib/testRunner.js'
```

It re-exports from `#test-runtime`, an
[imports map](../package.json) entry that resolves to
[`testRuntime.bun.ts`](./lib/testRuntime.bun.ts) under Bun and
[`testRuntime.vitest.ts`](./lib/testRuntime.vitest.ts) under Node. The split
exists because a previous version used `await import('bun:test')` / `import('vitest')`
under a top-level await — under `bun test --parallel=N` worker processes
evaluated the importing test files before that await resolved, producing
`ReferenceError: Cannot access 'describe' before initialization` on every
test. Static re-exports gated by the imports map resolve at parse time, no
TDZ window. See the comment block in
[`testRunner.ts:9-18`](./lib/testRunner.ts#L9-L18).

`TEST_RUNTIME: 'bun' | 'vitest'` ([`testRunner.ts:36`](./lib/testRunner.ts#L36))
is the detection if you ever need to branch (you almost never do — the two
runners' hooks are identical on the surface this suite uses).

To add a new primitive (a custom matcher, a new lifecycle hook) the order is:
1. Add to BOTH `testRuntime.bun.ts` AND `testRuntime.vitest.ts` so the import
   surface stays the same.
2. Re-export in `testRunner.ts`.
3. Use across the suite.

## `assertType.ts` — compile-time type assertions

Two type-level helpers ([`assertType.ts:13-18`](./lib/assertType.ts#L13-L18))
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

[Source](./lib/setupTimezone.ts). 14 lines of comment + 1 line of effect.
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

## `isAllowed.ts` — query introspection escape hatch

One function, one documented exception to
[`DESIGN.md` § Public surface only](./DESIGN.md#public-surface-only):

```ts
isQueryAllowed(query) // -> boolean
```

Hook into the lib's unfinished `__isAllowed` walker — see
[`LIMITATIONS.md` § Query introspection (`__isAllowed`)](./LIMITATIONS.md#query-introspection-__isallowed-has-no-public-api-yet--tests-reach-internals-via-a-single-helper)
for the full rationale and the contract for when the public API lands.

**The existence of this helper does NOT widen the licence.** Test bodies must
not import from `src/internal/`, `src/queryBuilders/`, `src/sqlBuilders/`,
etc. If you need a new introspection capability for a test, extend this file
(one stable seam, one documented exception) — do not open a second escape
route.

## `audit/` — the symmetry audit (now its own tool)

The audit moved into its own folder, [`audit/`](./lib/audit/), beside its
design doc [`AUDIT.md`](./lib/audit/AUDIT.md) — the same convention as
`codeIndexer/` and `codeSearcher/`. The symmetry check (the script behind
`bun run tests:audit`) lives at [`audit/symmetry.ts`](./lib/audit/symmetry.ts):
it walks `test/db/`, lists every `(version × connector)` cell per database,
extracts test names from each `.test.ts` (including ones inside `/* … */`
blocks — they count) and exits 1 on any divergence in the file set, the test
names, or their order. `domain/` + `types.negative/` dirs, the `documentation`
connector and the `general` db are excluded (see
[`DOC_CODE_EXTRACTOR.md`](./DOC_CODE_EXTRACTOR.md)).

**To extend the audit**, read [`AUDIT.md`](./lib/audit/AUDIT.md) first — it is
the anchor for the tool's roadmap: the anti-cheat content rules
(`mirror-image`, `as-any`, `uuid-literal`), the warn→error severity model and
the `tests-audit-ignore` suppression comment.

## `containerLifecycle.ts` — shared container infra

Per-process container keep-alive, cross-process reuse via lockfile,
schema/seed hashing for revalidation, per-worker DB naming, advisory-lock
key constants. Covered in detail in
[`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md). What lives here in code:

- [`createContainerHandle(factory, {lockKey})`](./lib/containerLifecycle.ts#L257) —
  the keep-alive wrapper.
- [`memoizeSharedRunner(factory)`](./lib/containerLifecycle.ts#L164) — same
  shape for the runner-level pool/connection (so the docker pool lives for
  the worker process, not per file).
- [`hashSqlFiles(...contents)`](./lib/containerLifecycle.ts#L189) — sha256
  digest used to detect schema/seed changes across reuses.
- [`withCrossProcessLock(name, fn)`](./lib/containerLifecycle.ts#L212) —
  cross-process mutex backed by a lockfile in `os.tmpdir()`.
- [`workerId()`](./lib/containerLifecycle.ts#L81) /
  [`workerName(base)`](./lib/containerLifecycle.ts#L114) /
  [`parallelDbsEnabled()`](./lib/containerLifecycle.ts#L102) — per-worker DB
  naming.
- Constants: `META_DB_NAME` / `BASE_WORKER_DB_NAME` / `BASE_ORACLE_USER` /
  `SCHEMA_HASH_META_TABLE` / `VALIDATE_LOCK_KEY_BIGINT` / `VALIDATE_LOCK_NAME`.

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

Today's coverage: the only observable divergence is `addParam`'s
`boolean → int` coercion in the four SQLite runners (`MockBetterSqlite3QueryRunner`,
`MockBunSqliteQueryRunner`, `MockNodeSqliteQueryRunner`,
`MockSqlite3WasmOO1QueryRunner`). `MockSqlite3QueryRunner` is intentionally
empty — kept on disk so a future quirk is a one-file edit.

Wire from a cell factory via the `mockRunnerClass` option of
[`createTestContext`](./lib/testContext.ts#L151):

```ts
createTestContext({
    /* … */
    mockRunnerClass: MockBunSqliteQueryRunner,
    /* … */
})
```
