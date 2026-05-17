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
examples valuable in the first place: **only the public surface is touched**.
Tests never import anything from `src/internal/`, `src/queryBuilders/`,
`src/sqlBuilders/`, `src/complexProjections/` or `src/utils/`.

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

2. **SQL and params are inline snapshots.** Every test puts the emitted SQL
   string and the emitted params behind `toMatchInlineSnapshot(...)`. Both
   `bun:test` and `vitest` know how to update inline snapshots in place
   (`bun test --update-snapshots` and `vitest run -u`), so when a SqlBuilder
   change reshapes the emitted SQL across the whole suite, the refresh is
   one command — not a hand-edit of every test. This is the difference
   between the new suite being maintainable and being thrown away.

3. **Public surface only — what `package.json` `exports` enumerates,
   nothing else.** Test imports must resolve to a path enumerated in the
   `exports` map of the root `package.json`. The `./unsupported/*`
   wildcard escape hatch is **not** part of the public surface for the
   tests: if a test needs something only reachable through `unsupported/`,
   the right answer is to open up the API, not to import via that
   escape. Concretely, the imports the pilot uses (`src/Table.ts`,
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

5. **One test runner execution covers the whole suite.** The agent and CI
   run `bun:all-tests` (Bun) or `all-tests` (Node + vitest) and get genuine
   coverage of every (database × version × connector) cell. There is no
   per-script carve-up; focused runs work via direct invocation
   (`bun test test/db/pilot-postgres/newest/pg/select.basic.test.ts`).

6. **Three dimensions, all encoded in the folder layout.**

   ```
   test/db/<database>/<compatibilityVersion>/<connector>/
   ```

   - `<database>` is one of the files under
     `docs/configuration/supported-databases/`: `mariadb`, `mysql`,
     `oracle`, `postgres`, `sqlite`, `sqlserver`. The current pilot uses
     `pilot-postgres` so the `postgres` name stays free for the real
     postgres test set when it lands.
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
         (e.g. `17_000_000` for the pilot, anything `< 18_000_000`).
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
   the modern server still accepts — see §5 for the trade-off.

9. **Connector ↔ version compatibility is per-cell.** Not every
   `<compatibilityVersion>/<connector>/` combination is valid. For
   example, `pilot-postgres/oldest/pglite/` exists but
   `pilot-postgres/newest/pglite/` does **not** — PgLite bundles
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

13. **`TS_SQL_QUERY_DBS` and `TS_SQL_QUERY_DOCKER` are orthogonal.**
    Each test must be runnable with or without Docker, without
    duplicating the test body.
    - `TS_SQL_QUERY_DBS` is a comma list of database folder names under
      `test/db/` (or `all` / `none`); it narrows the SCOPE of the run
      (which tests participate). Default: `all`.
    - `TS_SQL_QUERY_DOCKER` is `on` or `off` (default `off`); it gates
      whether the real-DB branch of a docker-backed connector fires.
    When Docker is off, docker-backed connectors transparently fall
    back to the mock for the real-DB block — the same test body
    describes both modes via `ctx.conn` (see §1.1). In-process
    connectors (pglite, sqlite, …) ignore the Docker flag and always
    run their real DB when their database is in scope.

    This means `no-docker-tests` still exercises every test in the
    suite, including mariadb / sqlserver / oracle / mysql ones — only
    their real-DB branches are skipped, their SQL + params + type +
    mock-round-trip assertions all run.

14. **Two test runners, both first-class: `bun:test` and `vitest`.**
    Files import from `test/lib/testRunner.ts`, a shim that resolves to
    the right module per runtime. Every npm script follows the
    `bun:`-prefix convention: `all-tests` runs vitest, `bun:all-tests`
    runs `bun:test`; same for `no-docker-tests` /
    `bun:no-docker-tests`. Both runners produce compatible inline
    snapshot format — updating snapshots with either runner leaves the
    suite green under the other.

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
    ├── pilot-postgres/             ← the pilot. Uses `pilot-postgres` so the
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
- `pilot-postgres/<*>/bun_sql_postgres/` — the bun:sql connector is
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

For mutating tests (`INSERT` / `UPDATE` / `DELETE`) wrap the body in
`ctx.withRollback(async () => { … })`: it opens a transaction and rolls
back when the real DB is on, and is a plain `await fn()` when the mock
is on. Either way the seed is intact for the next test.

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

Run `bun run bun:audit-tests` (or `npm run audit-tests`) to verify the
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
✗ pilot-postgres (5 cells):
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
8. Run `bun run bun:no-docker-tests` and `npm run no-docker-tests`
   first, then `bun run bun:all-tests` and `npm run all-tests` (Docker
   required). Keep all four green.

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
3. Run `bun test test/path/to/file --update-snapshots` (or
   `bun run bun:focus-tests <database>/<version>/<connector> --update-snapshots`)
   to bake the SQL and params into the file.
4. Port the same `describe` + `test` name to the rest. SQL differs when
   it must (the snapshot in each cell records its own version); comment
   out (do not delete) when the test does not apply.
5. If the test should appear in documentation, prefix `docs:` and add
   the `doc-start` / `doc-end` block.

---

## 10. Pilot scope (current state)

The repository currently contains the pilot — just enough to exercise
the patterns end-to-end without the cost of porting every example:

- database: **`pilot-postgres`** (the `postgres` name is held in
  reserve for the real port).
- version folders:
  - `newest/` (`Number.POSITIVE_INFINITY`).
  - `oldest/` (pinned to `17_000_000`, representative of the
    `< 18_000_000` zone documented in
    `docs/configuration/supported-databases/postgresql.md`).
- connectors per version:
  - `newest/` → `pg`, `postgres` (against `postgres:18-alpine`
    container).
  - `oldest/` → `pg`, `postgres`, `pglite`.
- per-cell test files: `select.basic` (5 tests), `insert.returning` (3
  tests), `docs.select` (1 `docs:` test). All SQL + params assertions
  are inline snapshots.
- per-database: `types.negative/select.test.ts` and
  `types.negative/insert.test.ts` (compile-time only).
- shared infrastructure under `test/lib/`; the dialect domain lives in
  `test/db/pilot-postgres/domain/`.

What the pilot intentionally does NOT do:
- add the `bun_sql_postgres` connector (bun-only, runtime gating to
  design).
- add the other databases (`mariadb`, `mysql`, `oracle`, `sqlite`,
  `sqlserver`) or the `prisma` / `sync` trees.
- wire a new CI matrix.
- modify or retire any file under `src/examples/`.
