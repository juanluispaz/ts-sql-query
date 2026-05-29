# `test/` — design of the new test suite

> Normative document. Anything added under `test/` must comply with these rules.
> The historical strategy for `src/examples/` is summarised in [`README.md`](./README.md)
> for as long as that folder is the source of truth; this suite will eventually
> supersede it.

---

## 0. Why a new suite

`src/examples/` exists as executable scripts so the project never coupled itself
to whichever testing library was in fashion. That decision aged well, but six
things are now actively missing:

1. No per-case **exact type assertion** of the result object. Type drifts are
   only caught when `tsc` breaks somewhere unrelated.
2. No **negative type tests**. ts-sql-query already prohibits a lot per dialect,
   nothing verifies those prohibitions.
3. Examples repeat the same `preparation / expected / example` skeleton across
   100k+ lines; navigation and review are expensive.
4. A failure is reported as "the script crashed at line N", not as a named test
   that failed.
5. The mock round-trip and the real-DB execution live in different files; there
   is no single point where the two are required to agree.
6. The convention of avoiding modern runners now costs more than it saves —
   `bun:test` and `vitest` are stable and the API surface they share is what
   the suite needs, including snapshot tooling for fast bulk-updates of
   emitted SQL.

The new suite addresses all six without abandoning the property that made the
examples valuable in the first place: **only the public surface is touched** —
see [§1.3](#1-principles) for the precise rule.

---

## 1. Principles

1. **Every test runs through a single connection.** `ctx.conn` is backed by
   a `CaptureInterceptor` that wraps either the real driver-backed runner
   (when the backend is enabled) or a `MockQueryRunner` (otherwise). The
   test body writes the query exactly once and asserts:
   - **SQL** the builder emitted (`ctx.lastSql`) — `toMatchInlineSnapshot(...)`.
   - **Params** the builder emitted (`ctx.lastParams`) — `toMatchInlineSnapshot(...)`.
   - **Exact TS type** of the result (`assertType<Exact<typeof result, …>>()`).
   - **Value** of the result — `expect(result).toEqual(expected)` where
     `expected` is shared between `ctx.mockNext(expected)` and the
     assertion.

   Everything tested by the suite (except the compile-time negative tests)
   **must potentially have passed through the real database** — the exact
   same code path runs in both modes.

   **The value assertion is identical in both modes — never guard it.**
   `expect(result).toEqual(expected)` runs unconditionally; do **not**
   wrap it in `if (!ctx.realDbEnabled)`. Because `expected` is both what
   `ctx.mockNext(...)` queues AND what the seed contains, the single line
   verifies the mock round-trip and the real-DB result at once. Guarding
   the value behind `!ctx.realDbEnabled` silently drops all value
   verification on the real-DB cells — the very coverage that justifies
   running against a real database. The same applies to type and SQL
   assertions: they are mode-agnostic by construction. A `ctx.realDbEnabled`
   branch (in either direction) is reserved for **genuine extreme cases**
   only — when the real engine cannot return the same `expected` the mock
   does (non-deterministic ordering with no `ORDER BY`, engine-specific
   affected-row counts, values that vary per run). In those cases keep the
   mock assertion exact and either relax the real-DB side (e.g.
   `else expect(rows.length).toBeGreaterThanOrEqual(1)`) or drop it, always
   with a comment naming the constraint that forced the split. The default
   — and what a reviewer should expect to see — is no guard at all. The
   inverse anti-pattern (skipping the whole test in real mode with
   `if (ctx.realDbEnabled) return`) is governed by principle 18 below.

2. **SQL and params are inline snapshots.** Every test puts the emitted SQL
   string and the emitted params behind `toMatchInlineSnapshot(...)`. Both
   `bun:test` and `vitest` know how to update inline snapshots in place
   (`bun test --update-snapshots` and `vitest run -u`), so when a SqlBuilder
   change reshapes the emitted SQL across the whole suite, the refresh is
   one command — not a hand-edit of every test. This is the difference
   between the new suite being maintainable and being thrown away.

3. **Public surface only — what `package.json` `exports` enumerates,
   nothing else.** Test imports must resolve to a path enumerated in the
   `exports` map of the root `package.json`. The `./__UNSUPPORTED__/*`
   wildcard escape hatch is **not** part of the public surface for the
   tests: if a test needs something only reachable through `__UNSUPPORTED__/`,
   the right answer is to open up the API, not to import via that
   escape. Concretely, the imports the suite uses (`src/Table.ts`,
   `src/connections/PostgreSqlConnection.ts`, `src/queryRunners/*.ts`,
   `src/TypeAdapter.ts`, `src/dynamicCondition.ts`, …) all match
   entries enumerated in `exports`. If you have to write a path that
   does not appear there, stop and reconsider.

4. **The library docs are the canonical reference when writing a test.**
   Before adding or modifying a test, read the relevant pages under
   `docs/`. The pages that matter most for the test suite:

   - [`docs/configuration/supported-databases/<database>.md`](../docs/configuration/supported-databases/) —
     authoritative list of `compatibilityVersion` breakpoints, type
     mappings, sequence and `RETURNING` support, and engine-specific
     quirks. The folder names under `test/db/<database>/<version>/`
     come from this file; the values you pin to
     `compatibilityVersion` in `setup.ts` must come from this file.
   - [`docs/configuration/query-runners/`](../docs/configuration/query-runners/) —
     one page per connector. Tells you the runner class name, its
     constructor signature, the driver it wraps, and any
     configuration knobs (timeouts, type conversions, etc.). The
     `<connector>/` folder name under each version folder comes from
     here.
   - [`docs/configuration/query-runners/general-purpose/MockQueryRunner.md`](../docs/configuration/query-runners/general-purpose/MockQueryRunner.md) —
     the mock primitives the test framework builds on (`reset()`,
     `isSqlError` config, the executor's `(type, query, params, index)`
     signature). When you reach for a mock behaviour, look here before
     reinventing.
   - The query-side pages under [`docs/queries/`](../docs/queries/) and
     [`docs/composition/`](../docs/composition/) describe the SQL
     features the test exercises. The test should encode that
     contract, not invent it.

   This applies to agents as well as humans: an agent picking up a
   test task should treat these pages as the source of truth and
   resolve any ambiguity by reading them. The test suite documents
   behaviour; the library docs declare it.

5. **One test runner execution covers the whole suite.** The agent
   and CI run `bun run tests --docker --wasm` (Bun) or
   `npm run tests -- --docker --wasm` (Node + vitest — npm consumes
   bare `--flag` tokens as its own config, so the `--` separator is
   required to forward them to the script) and get genuine coverage
   of every (database × version × connector) cell. Focused runs
   work via `bun run tests <coord>…` (positional args; supports
   globs and brace expansion) or direct invocation
   (`bun test test/db/postgres/newest/pg/select.basic.test.ts`).

6. **Three dimensions, all encoded in the folder layout.**

   ```
   test/db/<database>/<compatibilityVersion>/<connector>/
   ```

   - `<database>` is one of the files under
     `docs/configuration/supported-databases/`: `mariadb`, `mysql`,
     `oracle`, `postgres`, `sqlite`, `sqlserver`.
   - `<compatibilityVersion>` is the literal value pinned on the
     connection. Each subfolder represents one zone of the compatibility
     ladder documented in
     `docs/configuration/supported-databases/<database>.md`:
       - `newest` — `compatibilityVersion = Number.POSITIVE_INFINITY`
         (the library default; everything documented is enabled).
       - `<breakpoint>` — for each numeric breakpoint listed in the docs,
         a folder named with that literal value (e.g. `13_000_001`,
         `10_005_000`). The connection inside pins
         `compatibilityVersion` to that value.
       - `oldest` — the `<` zone below the lowest documented breakpoint.
         Pinned to a representative value below the lowest breakpoint
         (e.g. `17_000_000`, anything `< 18_000_000`).
   - `<connector>` is one of the files under
     `docs/configuration/query-runners/recommended/` for that database.
     For postgres today: `pg`, `pglite`, `postgres`, `bun_sql_postgres`.

   The flat layout makes a focused run a single path argument; no
   `forEach(VARIANT) forEach(RUNNER)` loops inside test files, no shared
   describe blocks. The price is duplicated test bodies — a price the
   project explicitly chooses to pay so divergences across cells are
   file-level diffs.

7. **`newest` and `oldest` are the only named version folders.** Every
   other version folder uses the literal `compatibilityVersion` value as
   its name. The two named bookends exist because the docs do not give us
   a number for them: the default is the JavaScript `Number.POSITIVE_INFINITY`
   (no clean filename), and the lowest zone is described as `< X`, never
   as a specific value.

8. **One container per database, modern image only.** Each `<database>/`
   gets one testcontainers container at the highest supported image,
   shared across every `<compatibilityVersion>/<connector>/` cell
   underneath. Older `compatibilityVersion` cells emit legacy SQL that
   the modern server still accepts — see §5 for the trade-off. Inside
   the shared container, every test runner worker process gets its
   own database (`tssqlquery_w<N>` — Oracle: user `tsapp_w<N>`) so
   parallel runs (vitest's default pool, `bun test --parallel`) cannot
   collide on each other's data. The control hash that gates
   schema/seed revalidation lives in a separate `tssqlquery_meta`
   database. The opt-out is `TSSQLQUERY_PARALLEL_DBS=false`. Full
   contract in
   [`README.md` § Per-worker test databases](./README.md#per-worker-test-databases-parallelism).

9. **Connector ↔ version compatibility is per-cell.** Not every
   `<compatibilityVersion>/<connector>/` combination is valid. For
   example, `postgres/oldest/pglite/` exists but
   `postgres/newest/pglite/` does **not** — PgLite bundles
   PostgreSQL 17 and would fail to execute SQL emitted at the latest
   compatibility settings. When a cell makes no sense, the folder simply
   is not created.

10. **Realistic, shared domain.** No `select a, b from T`. A single
   business domain — project management (`organization`, `app_user`,
   `project`, `issue`, …) — is modelled in every dialect with whatever
   column types it demands. Test scenarios read like real product code.

11. **Negative type tests live in `types.negative/` at the database root,
    not per version.** TS restrictions enforced by ts-sql-query are
    dialect-wide; a `compatibilityVersion` change must not loosen or
    tighten them. The folder may host multiple files (split by area:
    `select.test.ts`, `insert.test.ts`, …) so it can grow without
    becoming a single sprawling file.

12. **Documentation snippets live alongside regular tests.** The file
    `docs.<page>.test.ts` inside the connector folder hosts tests
    prefixed `docs:<page>/<anchor>`. The block between `// doc-start`
    and `// doc-end` is what the scraper publishes. Docs files are
    mirrored to every (version × connector) cell so the snippet is
    verified everywhere; the single setup flagged
    `canonicalForDocs: true` is the one the scraper actually publishes.

13. **`TS_SQL_QUERY_DBS`, `TS_SQL_QUERY_DOCKER`, `TS_SQL_QUERY_DOCKER_SCOPE`
    and `TS_SQL_QUERY_WASM` are orthogonal.** Each test must be runnable
    with or without any combination of them, without duplicating the
    test body.
    - `TS_SQL_QUERY_DBS` is a comma list of database folder names under
      `test/db/` (or `all` / `none`); it narrows the SCOPE of the run
      (which tests participate). Default: `all`.
    - `TS_SQL_QUERY_DOCKER` is `on` or `off` (default `off`); it gates
      whether the real-DB branch of a docker-backed connector fires.
    - `TS_SQL_QUERY_DOCKER_SCOPE` is `all` (default) or `newest`. When
      `newest`, only cells under `<db>/newest/*` keep their real-DB
      branch active; older versions fall back to the mock. No-op when
      `TS_SQL_QUERY_DOCKER` is off. Same shape as the WASM toggle — a
      narrower scope than the full matrix — motivated by speed
      (`--docker-scope newest` smoke-tests the recent engine of each
      DB without paying for the older containers).
    - The CLI flag `--scope <all|newest>` is one level higher and lives
      in the shell scripts (no matching env var). It filters which
      paths the runner is invoked with — `--scope newest` hands the
      runner `test/db/<db>/newest/` + `test/db/<db>/types.negative/`
      instead of `test/`. Older versions are not enumerated, so their
      tests do not run at all (whereas `--docker-scope newest` keeps
      them running through the mock). Implies `--docker-scope=newest`
      unless `--docker-scope` was passed explicitly. Primary use:
      shorter coverage runs when older-version coverage is redundant.
    When Docker is off, docker-backed connectors transparently fall
    back to the mock for the real-DB block — the same test body
    describes both modes via `ctx.conn` (see §1.1). In-process
    connectors (pglite, sqlite, …) ignore the Docker flag and always
    run their real DB when their database is in scope.

    This means `bun run tests` (no `--docker`) still exercises every
    test in the suite, including mariadb / sqlserver / oracle / mysql
    ones — only their real-DB branches are skipped, their SQL +
    params + type + mock-round-trip assertions all run.

14. **Two test runners, both first-class: `bun:test` and `vitest`.**
    Files import from `test/lib/testRunner.ts`, a shim that resolves
    to the right module per runtime. The test CLIs
    (`tests`, `tests:audit`, `tests:stop-containers`,
    `tests:reopen`) each have a **single package.json entry**: the
    shell script behind it detects whether `bun run` or `npm run`
    invoked it (via `npm_config_user_agent`) and dispatches to
    `bun test` or `vitest run` accordingly. `bun run tests` and
    `npm run tests` therefore call the same entry — only the
    runner underneath switches. Both runners produce compatible
    inline snapshot format, so updating snapshots with either
    leaves the suite green under the other.

    The `tests` script does double duty: with zero positional args
    it runs the full matrix; with one or more `<coord>` args it
    switches to focused mode (same flag semantics, narrower path
    set, with `--wasm` becoming a single-pass override instead of
    the two-phase split). One script, one `--help`, one source of
    truth for flag behaviour.

15. **Prisma is a special case with minimum viable coverage.** Prisma
    support in ts-sql-query is experimental; treating it like any other
    connector would balloon the matrix. Prisma tests live in
    `test/db/<database>/<compatibilityVersion>/prisma/` and use a
    deliberately smaller test set chosen to verify the integration
    shape, not the full SQL surface.

16. **Synchronous query runners are a separate, light track.** Sync
    runners and the `extras/sync` helper produce different runtime
    semantics; squeezing them into the main matrix would force every
    async-shaped test to grow conditional paths. They live in a
    dedicated tree (sketched as `test/db/sync/...`).

17. **`src/examples/` is not modified.** The new suite must reach
    equivalent coverage before `src/examples/` is retired; until then,
    both coexist. When the new suite supersedes them, the examples are
    deleted in one commit, not piecemeal.

18. **Mock-only is a smell — investigate before reaching for
    `if (ctx.realDbEnabled) return`.** A test guarded that way asserts
    SQL no real database accepts. That is almost always a sign the test
    exercises something that does not make semantic sense — a
    "tiebreaker" on a unique column, an `ORDER BY` on a one-row scalar
    aggregate, an aggregate predicate in `WHERE`, and so on. The guard
    is the escape hatch, not the default. (The related anti-pattern —
    guarding only the *value* assertion with `if (!ctx.realDbEnabled)`,
    which keeps the test running in real mode but stops verifying its
    result there — is covered by principle 1: the value assertion is
    identical in both modes.) Before adding it:
    - **Check the SQL semantics.** Read the snapshot the assertion
      would pin. Would a developer write that SQL in production code?
      If not, the test is hiding a design problem — fix the design,
      don't paper over it with the guard.
    - **Try restructuring.** Change the column, hook position or query
      shape until the emitted SQL is meaningful AND universally
      accepted. Real-DB coverage is the goal.
    - **Document the constraint.** Only after both checks should you
      reach for the guard, and only with a comment naming what forced
      the choice — a driver that strips comments and mis-counts
      placeholders, a synthetic SQL that is the test's whole point
      (forwarder recursion through nested customize hooks, etc.), or
      a documented dialect-specific limitation. "Mock-only because
      `<DB>` rejects this" without explaining *why* that SQL exists
      is not enough.

    The same applies to per-cell guards: silencing
    `if (ctx.realDbEnabled) return` in a single dialect masks the
    same design issue and just hides it from one column of the
    matrix. The operational recipe and worked examples live in
    [`MAINTAINING.md` § Mock-only is a smell](./MAINTAINING.md#mock-only-is-a-smell--restructure-before-reaching-for-the-guard).

---

## 2. Layout

```
test/
├── DESIGN.md                       ← this document
├── README.md                       ← how to run, how to extend
├── tsconfig.json                   ← extends ../tsconfig.json; rootDir = test/..
├── lib/
│   ├── testRunner.ts               ← bun:test | vitest shim
│   ├── backends.ts                 ← TS_SQL_QUERY_DBS, isBackendEnabled()
│   ├── assertType.ts               ← Exact<A,B>, assertType<T extends true>
│   ├── captureInterceptor.ts       ← wraps any QueryRunner and records SQL+params
│   └── testContext.ts              ← createTestContext factory + TestContext type
└── db/
    ├── postgres/             ← the real postgres tree, with one cell per (version × connector)
    │                                 `postgres` name stays free for the real
    │                                 set when it lands.
    │   ├── domain/                 ← dialect domain, scoped to this database
    │   │   ├── connection.ts       ← DBConnection + Tables/Views
    │   │   ├── schema.sql          ← raw DDL, applied per container
    │   │   └── seed.sql            ← canonical fixture rows
    │   ├── runners.ts              ← createPgTestContext (testcontainers)
    │   │                             + createPgLiteTestContext (in-process)
    │   ├── types.negative/         ← folder so multiple files can live here
    │   │   ├── select.test.ts
    │   │   └── insert.test.ts
    │   ├── newest/                 ← compatibilityVersion = POSITIVE_INFINITY
    │   │   ├── pg/
    │   │   │   ├── setup.ts        ← exports `ctx` (single TestContext)
    │   │   │   ├── select.basic.test.ts
    │   │   │   ├── insert.returning.test.ts
    │   │   │   └── docs.select.test.ts
    │   │   └── postgres/
    │   │       └── …
    │   └── oldest/                 ← compatibilityVersion below lowest breakpoint
    │       ├── pg/
    │       ├── postgres/
    │       └── pglite/             ← in-process pg17 engine
    ├── postgres/    …              ← the real one, to be added
    ├── mariadb/     …
    ├── mysql/       …
    ├── oracle/      …
    ├── sqlite/      …
    └── sqlserver/   …
```

Pending, deliberately:
- `postgres/<*>/bun_sql_postgres/` — the bun:sql connector is
  bun-only and needs runtime gating.
- `prisma/` and `sync/` trees.

---

## 3. Anatomy of a test file

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('list-active-projects-of-org', async () => {
        const expected = [
            { id: 2, name: 'Internal tools', slug: 'tools' },
            { id: 1, name: 'Marketing site', slug: 'mktg-site' },
        ]
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tProject)
            .where(tProject.organizationId.equals(1))
              .and(tProject.archivedAt.isNull())
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderBy('name')
            .executeSelectMany()

        // Filled in by `bun test --update-snapshots` (or `vitest run -u`).
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()

        assertType<Exact<typeof result, Array<{
            id: number
            name: string
            slug: string
        }>>>()

        expect(result).toEqual(expected)
    })
})
```

The query is written once. `ctx.lastSql` and `ctx.lastParams` come from the
interceptor and work in both modes. `expected` is what the seed contains
AND what `mockNext` queued, so the value assertion is a single line.

Transaction control (`beginTransaction`, `commit`, `rollback`) and a
small set of side-effecty ops reach the interceptor with an empty SQL
string — the driver emits nothing meaningful for them. The capture
falls back to the query type in that case, so a snapshot of `"commit"`
(say) is more informative than `""`. Anything that asserts SQL *after*
a transaction should read `ctx.lastNoTransactionSql` /
`ctx.lastNoTransactionParams` instead of the regular `ctx.lastSql` —
that pair skips the transaction-control entries (gated by query type,
not by "is the SQL empty?") so the assertion lands on the real query
in both mock and real-DB mode, regardless of whether the driver's
`executeInTransaction` re-enters the interceptor for COMMIT.

`ctx.history` is still the right tool when a single operation emits
several queries (paginated selects via `executeSelectPage`, for
example) and the test needs to assert each in order.

For mutating tests (`INSERT` / `UPDATE` / `DELETE`) wrap the body in
`ctx.withRollback(async () => { … })`: it opens a transaction and rolls
back regardless of how the body ended. Tests that genuinely need their
mutations to commit (DDL on engines without transactional DDL,
post-commit visibility, sequence counters that must persist their
advance) use `ctx.withCommit(async () => { … })` instead — same
wrapping shape, but the transaction commits and the infra reseeds the
declared schema in a `finally` so the next test starts from baseline.
Any schema objects the body created outside the declared seed must be
torn down inside the callback itself.

The full mutation-safety contract — including the table of when to
reach for each primitive and the read-only "no wrapper needed" path —
lives in [`README.md` § Data-mutation safety](./README.md#data-mutation-safety-cooperative-contract).

### 3.1 Updating snapshots

Whenever the library's emitted SQL or params change, refresh all snapshots
with:

```bash
bun test --update-snapshots          # bun:test (preferred)
npx vitest run -u                    # vitest / Node
```

Both runners produce compatible inline snapshot format, so updating with
either leaves the suite green under the other.

---

## 4. Symmetry rules — critical maintainability property

This section is normative. Anyone editing or adding tests must follow it
exactly. Symmetry is not a stylistic preference: it is the **single
property that lets a future contributor `diff` two cells and see only
real behavioural divergence** instead of an accidental cocktail of
divergence and missing tests. Without it, the matrix collapses into a
patchwork the day after it ships.

### 4.1 The rule

Every (database × version × connector) cell must contain **the same files
with the same `test(...)` blocks in the same order**.

- **Same file names** in every cell. If `select.basic.test.ts` exists in
  any cell, it exists in every cell.
- **Same `describe` and `test` names** inside every file, in the same
  order.
- When a test does not apply to a cell, **comment out the entire
  `test(...)` block** as a `/* … */` block, with a one-line reason on
  the line above. **Do not** use `test.skip(...)`. **Do not** delete the
  test.

  ```ts
  // Not applicable on MariaDB: no FULL OUTER JOIN.
  /*
  test('outer-join-customer-with-order', async () => {
      const result = await ctx.conn.selectFrom(tCustomer)
          .fullJoin(tOrder).on(tOrder.customerId.equals(tCustomer.id))
          // …
      expect(ctx.lastSql).toMatchInlineSnapshot()
      expect(ctx.lastParams).toMatchInlineSnapshot()
      expect(result).toEqual(expected)
  })
  */
  ```

  The commented body keeps the cell visually parallel to the others and
  documents intent in place. A future contributor scanning across cells
  sees "this test exists conceptually but is disabled here, here is why"
  without having to consult a separate document. The commented code is
  treated as documentation, not as code — it does not need to compile
  against the target cell's connection, it just needs to read like the
  canonical version.

- When the emitted SQL differs across cells (boolean spelling, alias
  quoting, parenthesisation, version-specific syntax), the **test** is
  identical in every cell; only the **inline snapshot** for SQL/params
  records what that cell actually emits. The SQL divergence is the diff
  signal we want.

### 4.2 What this rule does and does not require

- **Does** require that adding a test means adding it (or its
  commented-out shell) to every existing cell.
- **Does** require that a feature exposed by only one connector still
  has a placeholder file (with all its tests commented out and a reason
  at the top of the file) in every other cell.
- **Does not** require the commented body to compile against the
  target cell's connection — it is documentation, not code.
- **Does not** require `bun:test` / `vitest` to "see" the disabled
  tests — commented-out tests are silent at runtime, which is the
  point: they document intent without affecting the test report.

### 4.3 Trade-off with `test.skip(…)`

`test.skip(…)` is the natural-feeling primitive for "this test is
intentionally not running here", and the runner reports a row for it.
We deliberately do **not** use it for symmetry placeholders because:

- A skipped row in the report does not distinguish "intentional
  disabled-on-this-dialect placeholder" from "TODO, finish me later".
  Commented-out blocks with a reason on top do.
- Skipped tests still parse and compile their body — which means the
  body must be valid for the target cell's connection, defeating the
  point of using the canonical body as documentation.

If a test is temporarily broken or under investigation, `test.skip(…)`
is fine — but that is an exceptional situation, not the
non-applicability case.

### 4.4 Auditing symmetry

Run `bun run tests:audit` (or `npm run tests:audit`) to verify the
symmetry rule mechanically. The script walks every
`test/db/<database>/`, lists the `(version × connector)` cells,
extracts the `test(...)` / `it(...)` names from each `.test.ts` file
(including the ones inside `/* … */` comment blocks — they count, see
§4.1) and reports any divergence in:

- the set of `.test.ts` files between cells,
- the set of test names within a shared file, or
- the order of those names.

Exit code is `0` when the matrix is symmetric, `1` when any divergence
is found, so the script slots into pre-merge automation. Sample
output:

```text
✗ postgres (5 cells):
  [insert.returning.test.ts] newest/pg vs oldest/pglite:
      missing in oldest/pglite: "insert-many-organizations"
```

The script lives at [`test/lib/auditTestSymmetry.ts`](./lib/auditTestSymmetry.ts)
so it is type-checked alongside the rest of the suite by
`npm run validate:tests`. The `domain/` and `types.negative/` folders
are not part of the cell matrix and are skipped by the audit.

---

## 5. Versions, connectors, engines

| Dimension | What it is | Where it lives | Cost |
|---|---|---|---|
| Database | dialect (`postgres`, `mysql`, …) | folder under `test/db/` | one container per database |
| Version  | literal `compatibilityVersion` (or `newest` / `oldest`) | folder under `test/db/<database>/` | free (client-side knob) |
| Connector | a QueryRunner from `docs/configuration/query-runners/` | folder under `test/db/<database>/<version>/` | one connection per connector |

Modern-image-for-old-compat trade-off: a single modern container image
hosts every supported `<compatibilityVersion>` cell of its database. We
give up the belt-and-braces of running a legacy SQL against an actual
server of that exact version. We keep coverage of every emitted-SQL
variant the library produces, against every supported connector, on a
real database server. For backends where the engine ships bundled with
the connector (sqlite via `better-sqlite3`, `node:sqlite`,
`bun:sqlite`, `sqlite3-wasm`, …) this is the only option — that
constraint informed this decision.

Not every (version × connector) cell is valid. `pglite` is a postgres
connector but its engine is pinned to PostgreSQL 17, so it only appears
under the `oldest/` folder (and any older breakpoints that get added),
never under `newest/`.

---

## 6. Negative type tests (`types.negative/`)

```ts
function _typeNegatives() {
    // Rule: GREATEST between a localDate and a string must not compile.
    // @ts-expect-error type mismatch
    connection.greatest(tIssue.createdAt, 'foo')
}

test('postgres-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
```

- One folder per database, at the **database root** (not per version).
  TS restrictions are dialect-wide; a `compatibilityVersion` change must
  not loosen or tighten them.
- The folder can contain multiple files split by area (`select.test.ts`,
  `insert.test.ts`, …).
- The body of `_typeNegatives` is **never invoked**. Wrapping it in a
  function keeps `tsc` honest while preventing the throw paths inside
  ts-sql-query from firing.
- Each `// @ts-expect-error` MUST be paired with a one-line comment
  naming the rule it enforces. Without the comment, the directive is
  rejected at review time.
- `validate:tests` (or `validate:tests:tsgo`) is the real assertion. If
  a directive becomes "unused", the build fails with the canonical
  message — exactly the regression signal we want.

---

## 7. Documentation snippets

- A test prefixed `docs:<page>/<anchor>` is published into
  `docs/<page>.md#<anchor>` by the docs pipeline.
- The file lives at `test/db/<database>/<compatibilityVersion>/<connector>/docs.<page>.test.ts`
  and is mirrored to every (version × connector) cell. All copies run,
  so the snippet is verified against every supported connector for that
  database.
- The scraper publishes the snippet from the **one** setup flagged
  `canonicalForDocs: true`. There must be exactly one canonical per
  documented database.
- Inside the test, the lines between `// doc-start` and `// doc-end` are
  the snippet body. Everything outside (mock seeding, `expect`,
  inline-snapshot assertions) stays in the test file. Adding a docs
  example never means writing untested code.

---

## 8. Adding a new database

0. **Read the docs first** (see §1.4). Open
   `docs/configuration/supported-databases/<database>.md` for the
   compatibility ladder, the type mappings and any
   sequence/`RETURNING`/dialect quirks. Open every
   `docs/configuration/query-runners/recommended/<connector>.md` you
   plan to wire — that page gives you the runner class, the driver
   package, and the constructor signature.
1. Create the database folder `test/db/<database>/` with a `domain/`
   subfolder that holds `connection.ts`, `schema.sql`, `seed.sql`
   modelling the same project management domain. The domain is scoped
   to the database; if a second database happens to share the dialect,
   it gets its own copy (symmetry over sharing).
2. Create `test/db/<database>/runners.ts` exposing one factory per
   engine shape (real-DB via testcontainers, in-process, …). Each
   factory wires the connector's runner into `createTestContext(...)`
   and returns a `TestContext`.
3. Create `test/db/<database>/types.negative/` with at least one file
   (compile-time only).
4. Create one folder per documented compatibility zone:
   `newest/`, the literal numeric value for each docs breakpoint, and
   `oldest/`.
5. For each connector valid for that version, create
   `test/db/<database>/<version>/<connector>/setup.ts` calling the
   appropriate factory. Mark **exactly one** cell per database
   `canonicalForDocs: true`.
6. Copy the test file set of any existing cell
   (`select.basic.test.ts`, `insert.returning.test.ts`, `docs.<page>.test.ts`,
   …) — same file names, same `describe`/`test` names.
7. Run `bun test test/db/<database> --update-snapshots` to fill the
   inline snapshots for the new cells.
8. Run `bun run tests` first (no docker, fast sanity check), then
   `bun run tests --docker --wasm` (Docker required, full real
   matrix). Re-run both with `npm run` to exercise the vitest path —
   same script entries, runner switches based on
   `npm_config_user_agent`. All four runs must be green.

---

## 9. Adding a new test

0. **Read the docs first** (see §1.4). The page for the feature you are
   testing (under `docs/queries/`, `docs/composition/` or
   `docs/configuration/`) is the contract; encode it, do not invent it.
   When the feature behaves differently across versions or connectors,
   the `docs/configuration/supported-databases/<database>.md` and
   `docs/configuration/query-runners/<connector>.md` pages tell you
   where the differences live — those become the diverging inline
   snapshots in §4.
1. Pick the file that fits the scenario (`select.basic`,
   `insert.returning`, `update.basic`, …). If none fits, create it in
   **every** valid `<connector>/` folder in the same commit, with the
   test bodies that do not apply commented out per §4 (never deleted,
   never `test.skip(...)`).
2. Write the test in the most expressive connector first (usually one
   of the recommended postgres connectors). Use
   `expect(ctx.lastSql).toMatchInlineSnapshot()` and
   `expect(ctx.lastParams).toMatchInlineSnapshot()` (empty arguments —
   the runner will fill them).
3. Run `bun test test/path/to/file --update-snapshots` (or, preferred,
   `bun run tests <database>/<version>/<connector> --docker -- --update-snapshots`
   — the `-reuse` variant reuses the docker container across
   invocations, see
   [`CONTAINERS.md` § Container reuse](./CONTAINERS.md#container-reuse-speeding-up-docker-backed-runs))
   to bake the SQL and params into the file.
4. Port the same `describe` + `test` name to the rest. SQL differs when
   it must (the snapshot in each cell records its own version); comment
   out (do not delete) when the test does not apply.
5. If the test should appear in documentation, prefix `docs:` and add
   the `doc-start` / `doc-end` block.

---

## 10. Current state

The pilot phase is closed. The suite now grows breadth-first along the
strategy "build the base in the minimum dialect, duplicate to the
maximum, then sweep the other databases":

1. **Minimum baseline** — `sqlite/newest/bun_sqlite/` (in-process,
   bun-only). First full set of tests lives here.
2. **Maximum baseline** — `postgres/newest/pg/` (testcontainers).
   Duplicate of (1) with regenerated dialect snapshots; this is the
   first symmetry pair.
3. **Other databases** (`mariadb`, `mysql`, `oracle`, `sqlserver`) at
   `newest/` with one connector each — to land next.
4. **Other connectors per (database × newest)** — `pg` / `postgres` /
   `pglite` / `bun_sql_postgres` for postgres; `better-sqlite3` /
   `node_sqlite` / `sqlite3` / `sqlite-wasm-OO1` for sqlite; etc.
5. **Other compatibility versions** — `oldest/` and the literal
   breakpoint values documented in
   `docs/configuration/supported-databases/<database>.md`.

Permanently excluded from the main matrix (separate sub-trees if added
later):
- `bun_sql_sqlite`, `bun_sql_mysql` — experimental bun connectors with
  known bugs.
- `prisma`, synchronous query runners — different runtime semantics;
  light mirror coverage at most.

What this phase does NOT do:
- modify or retire any file under `src/examples/`. The legacy suite is
  authoritative until the new suite reaches parity.
- wire a new CI matrix. Existing `tests` / `tests --docker --wasm`
  scripts already cover the new cells under both runtimes.
