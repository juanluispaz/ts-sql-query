# `test/` — design of the new test suite

> Normative document. Anything added under `test/` must comply with these rules.
> The historical strategy for `src/examples/` is mentioned in
> [`README.md`](./README.md) for as long as that folder remains the source of
> truth; this suite will eventually supersede it.

This is the **source of truth** for the rules. Other docs (recipes, how-tos,
runbooks) cite back here — they do not paraphrase. If a rule in this file
contradicts text elsewhere, this file wins and the other doc is stale.

- [Why a new suite](#why-a-new-suite)
- [Real-DB validation — mock-validated vs real-validated](#real-db-validation)
- [Principles](#principles)
- [Symmetry rule](#symmetry-rule)
- [Mock-only is a smell](#mock-only-smell)
  - [Skip-real form](#skip-real-form)
  - [Mirror-image form — weakening real-DB to match strong mock](#mirror-image-form)
- [Full-canonical-body discipline](#full-canonical-body)
- [The `as any` runtime-guard exception](#as-any-runtime-guard)
- [Public surface only](#public-surface-only)
- [Companion documents](#companion-documents)

## Why a new suite

`src/examples/` exists as executable scripts so the project never coupled
itself to whichever testing library was in fashion. That decision aged well,
but six things were actively missing:

1. No per-case **exact type assertion** of the result object. Type drifts
   were only caught when `tsc` broke somewhere unrelated.
2. No **negative type tests**. ts-sql-query already prohibits a lot per
   dialect, nothing verified those prohibitions.
3. Examples repeated the same `preparation / expected / example` skeleton
   across 100k+ lines; navigation and review were expensive.
4. A failure was reported as "the script crashed at line N", not as a named
   test that failed.
5. The mock round-trip and the real-DB execution lived in different files;
   there was no single point where the two were required to agree.
6. The convention of avoiding modern runners now costs more than it saves —
   `bun:test` and `vitest` are stable and the API surface they share is what
   the suite needs, including snapshot tooling for fast bulk-updates of
   emitted SQL.

The new suite addresses all six without abandoning the property that made
the examples valuable in the first place: **only the public surface is
touched** — see [Public surface only](#public-surface-only).

## Real-DB validation

**The suite's purpose is validation against a real database.** The mock
exists to close the feedback loop cheaply (~8 s for ~14k tests vs ~4:30 with
docker) and to act as a regression gate, not as a substitute for the engine.
An `expected` value queued onto the mock that no real engine has ever
returned is the test author's hypothesis, not a verified contract — until at
least one real-DB execution confirms it.

Three categories of real-DB connector with very different cost:

| Category | Connectors | Real-DB by default? | Cost per cell |
|---|---|---|---|
| **Embedded SQLite** | better-sqlite3, bun_sqlite, node_sqlite, sqlite3 | yes, no flag needed | as cheap as the mock |
| **Docker-backed** | postgres (pg, postgres, bun_sql_postgres), mysql, mariadb, oracle, sqlserver | no — opt in with `--docker` | seconds to minutes (depends on warm reuse) |
| **WASM** | pglite, sqlite-wasm-OO1 | no — opt in with `--wasm` | seconds to minutes (CPU-bound bootstrap) |

See [`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md) for the lifecycle of each
category and [`BENCHMARKS.md`](./BENCHMARKS.md) for wall-time numbers.

**Vocabulary used across the suite:**

- **mock-validated** — the test bake-passes the mock round-trip. Its
  `expected` is the author's hypothesis. No engine has seen it.
- **real-validated** — the test has passed real-DB execution in at least
  **one** cell (typically a canonical cell of convenience). The `expected`
  is what an engine actually returned.

Promotion from mock-validated to real-validated for a single cell is
mechanical:

- If the canonical cell is **SQLite native**, `bun run tests <cell>` already
  ran the real engine; the test is real-validated in that cell without any
  extra flag.
- If the canonical cell is **docker-backed**, run
  `bun run tests <cell> --docker`.
- If the canonical cell is **WASM**, run `bun run tests <cell> --wasm`.

**Full-matrix real-DB coverage** is a separate discipline — the project
author runs `bun run tests --docker --wasm` over the whole matrix as the
final confidence check. An agent finishing a round does **not** need to do
the full pass; it reports honestly which tests are mock-validated only and
in which cells the others were promoted to real-validated, so the author
knows what to cover.

This vocabulary is operational, not a CLI gate — nothing in the test runner
enforces "no commit without `real-validated`". The honesty of the agent's
closing report is what makes the distinction useful; see
[`COVERAGE_RUNBOOK.md` § Closing the round](./COVERAGE_RUNBOOK.md#closing-the-round)
for how the report should look.

## Principles

1. **Every test runs through a single connection.** `ctx.conn` is backed by
   a `CaptureInterceptor` that wraps either the real driver-backed runner
   (when the backend is enabled) or a `MockQueryRunner` (otherwise). The
   test body writes the query exactly once and asserts:
   - **SQL** the builder emitted (`ctx.lastSql`) — `toMatchInlineSnapshot(...)`.
   - **Params** the builder emitted (`ctx.lastParams`) — `toMatchInlineSnapshot(...)`.
   - **Exact TS type** of the result (`assertType<Exact<typeof result, …>>()`).
   - **Value** of the result — `expect(result).toEqual(expected)` where
     `expected` is shared between `ctx.mockNext(expected)` and the assertion.

   Everything tested by the suite (except the compile-time negative tests)
   **must potentially have passed through the real database** — the exact
   same code path runs in both modes.

   **The value assertion is identical in both modes — never guard it.**
   `expect(result).toEqual(expected)` runs unconditionally; do **not** wrap
   it in `if (!ctx.realDbEnabled)`. Because `expected` is both what
   `ctx.mockNext(...)` queues AND what the seed contains, the single line
   verifies the mock round-trip and the real-DB result at once. Guarding the
   value behind `!ctx.realDbEnabled` silently drops all value verification
   on real-DB cells — the very coverage that justifies running against a
   real database. SQL and type assertions are mode-agnostic by construction.

   The only sanctioned `if (ctx.realDbEnabled)` branches are the **genuine
   extreme cases** under [Mock-only is a smell](#mock-only-smell). The
   default — and what a reviewer should expect to see — is no guard at all.

2. **SQL and params are inline snapshots.** Every test puts the emitted SQL
   string and the emitted params behind `toMatchInlineSnapshot(...)`. Both
   `bun:test` and `vitest` know how to update inline snapshots in place
   (`bun test --update-snapshots` and `vitest run -u`), so when a SqlBuilder
   change reshapes the emitted SQL across the whole suite, the refresh is
   one command — not a hand-edit of every test.

3. **Public surface only** — see [Public surface only](#public-surface-only).

4. **The library docs are the canonical reference when writing a test.**
   Before adding or modifying a test, read the relevant pages under
   [`docs/`](../docs/). The pages that matter most for the test suite:

   - [`docs/configuration/supported-databases/<database>.md`](../docs/configuration/supported-databases/) —
     authoritative list of `compatibilityVersion` breakpoints, type
     mappings, sequence and `RETURNING` support, and engine-specific
     quirks. The folder names under `test/db/<database>/<version>/` come
     from this file.
   - [`docs/configuration/query-runners/`](../docs/configuration/query-runners/) —
     one page per connector. Tells you the runner class name, its
     constructor signature, the driver it wraps, configuration knobs.
   - [`docs/configuration/query-runners/general-purpose/MockQueryRunner.md`](../docs/configuration/query-runners/general-purpose/MockQueryRunner.md) —
     mock primitives.
   - Query-side pages under [`docs/queries/`](../docs/queries/) and
     [`docs/composition/`](../docs/composition/) describe the SQL features
     the test exercises. The test should encode that contract, not invent it.

5. **One test runner execution covers the whole suite.** The agent and CI
   run `bun run tests --docker --wasm` (Bun) or `npm run tests -- --docker --wasm`
   (Node + vitest) and get genuine coverage of every
   `(database × version × connector)` cell. Focused runs work via
   `bun run tests <coord>…` or direct invocation.

6. **Three dimensions, all encoded in the folder layout.**
   `test/db/<database>/<compatibilityVersion>/<connector>/`. The flat layout
   makes a focused run a single path argument; no `forEach(VARIANT) forEach(RUNNER)`
   loops inside test files, no shared describe blocks. The price is duplicated
   test bodies — a price the project explicitly chooses to pay so divergences
   across cells are file-level diffs. See
   [`PER_DATABASE_LAYOUT.md`](./PER_DATABASE_LAYOUT.md) for the full tree
   convention.

7. **`newest` and `oldest` are the only named version folders.** Every other
   version folder uses the literal `compatibilityVersion` value as its name.
   The two named bookends exist because the docs do not give us a number for
   them: the default is `Number.POSITIVE_INFINITY` (no clean filename), and
   the lowest zone is described as `< X`.

8. **One container per database, modern image only.** Each `<database>/`
   gets one testcontainers container at the highest supported image, shared
   across every `<compatibilityVersion>/<connector>/` cell underneath. Older
   `compatibilityVersion` cells emit legacy SQL the modern server still
   accepts. Inside the shared container, every test runner worker process
   gets its own database — see
   [`ENGINE_LIFECYCLE.md` § Per-worker test databases](./ENGINE_LIFECYCLE.md#per-worker-test-databases).

9. **Connector ↔ version compatibility is per-cell.** Not every
   `<compatibilityVersion>/<connector>/` combination is valid. For example,
   `postgres/oldest/pglite/` exists but `postgres/newest/pglite/` does
   **not** — PgLite bundles PostgreSQL 17 and would fail to execute SQL
   emitted at the latest compatibility settings. When a cell makes no sense,
   the folder simply is not created.

10. **Realistic, shared domain.** No `select a, b from T`. A single
    business domain — project management (`organization`, `app_user`,
    `project`, `issue`, …) — is modelled in every dialect with whatever
    column types it demands. Test scenarios read like real product code.

11. **Negative type tests live in `types.negative/` at the database root,
    not per version.** TS restrictions enforced by ts-sql-query are
    dialect-wide; a `compatibilityVersion` change must not loosen or
    tighten them. The folder may host multiple files (split by area:
    `select.test.ts`, `insert.test.ts`, …) so it can grow without becoming
    a single sprawling file.

12. **Documentation snippets live alongside regular tests.** The file
    `docs.<page>.test.ts` inside the connector folder hosts tests prefixed
    `docs:<page>/<anchor>`. The block between `// doc-start` and
    `// doc-end` is what the scraper publishes. Docs files are mirrored to
    every (version × connector) cell so the snippet is verified everywhere;
    the single setup flagged `canonicalForDocs: true` is the one the
    scraper actually publishes. Full convention in
    [`WRITING_TESTS.md` § Docs snippets](./WRITING_TESTS.md#docs-snippets).

13. **`--docker`, `--wasm` and `--native` are orthogonal per-kind real/mock
    gates.** Each test must be runnable real or mock for its kind, without
    duplicating the test body. See [`TEST_LIB.md` § `backends.ts`](./TEST_LIB.md#backendsts--the-realmock-gate--realdbbackend)
    for the gating model and [`CLI.md`](./CLI.md) for the flags.

14. **Two test runners, both first-class: `bun:test` and `vitest`.** Files
    import from `test/lib/testRunner.ts`, a shim that resolves to the right
    module per runtime. The test CLIs each have a single `package.json`
    entry; the shell script behind it detects whether `bun run` or `npm run`
    invoked it (via `npm_config_user_agent`) and dispatches to `bun test`
    or `vitest run` accordingly. Both runners produce compatible inline
    snapshot format.

15. **Prisma is a special case with minimum viable coverage.** Prisma
    support in ts-sql-query is experimental; treating it like any other
    connector would balloon the matrix. Prisma tests live in
    `test/db/<database>/<compatibilityVersion>/prisma/` and use a
    deliberately smaller test set chosen to verify the integration shape,
    not the full SQL surface.

16. **Synchronous query runners are a separate, light track.** Sync
    runners and the `extras/sync` helper produce different runtime
    semantics; squeezing them into the main matrix would force every
    async-shaped test to grow conditional paths. They live in a dedicated
    tree (sketched as `test/db/sync/...`).

17. **`src/examples/` is not modified.** The new suite must reach equivalent
    coverage before `src/examples/` is retired; until then, both coexist.

18. **Mock-only is a smell** — see [Mock-only is a smell](#mock-only-smell)
    for the full rule (both the skip-real form and the mirror-image form).

## Symmetry rule

**Every (database × version × connector) cell must contain the same files
with the same `test(...)` blocks in the same order.**

- **Same file names** in every cell. If `select.basic.test.ts` exists in
  any cell, it exists in every cell.
- **Same `describe` and `test` names** inside every file, in the same order.
- When a test does not apply to a cell, **comment out the entire
  `test(...)` block** as a `/* … */` block, with a one-line reason on the
  line above. **Do not** use `test.skip(...)`. **Do not** delete the test.
- When the emitted SQL differs across cells (boolean spelling, alias
  quoting, parenthesisation, version-specific syntax), the **test** is
  identical in every cell; only the **inline snapshot** for SQL/params
  records what that cell actually emits. The SQL divergence is the diff
  signal we want.

The disabled test carries a **first-class reason marker** on the line
above the `/* */` block. Three categories, one marker each (see
[`LIMITATIONS.md`](./LIMITATIONS.md) for the full distinction):

- `// NOT-APPLICABLE: <reason>` — a deliberate **dialect boundary**;
  the test will never run in this cell because the dialect doesn't
  support the feature. The same test runs live in the cells whose
  dialect supports it (and often pairs with a `types.negative/`
  assertion on this dialect).
- `// TODO[BUG]: <reason>` — the lib has a defect to fix; see
  [`BUGS.md`](./BUGS.md).
- `// TODO[LIMITATION]: <reason>` — the lib hasn't covered the path
  yet, or the environment can't; see
  [`LIMITATIONS.md`](./LIMITATIONS.md).

```ts
// NOT-APPLICABLE: MariaDB has no FULL OUTER JOIN.
/*
test('outer-join-customer-with-order', async () => {
    const result = await ctx.conn.selectFrom(tCustomer)
        .fullJoin(tOrder).on(tOrder.customerId.equals(tCustomer.id))
        // … FULL canonical body of the supporting cell, verbatim …
    expect(ctx.lastSql).toMatchInlineSnapshot()
    expect(ctx.lastParams).toMatchInlineSnapshot()
    expect(result).toEqual(expected)
})
*/
```

The commented body keeps the cell visually parallel to the others and
documents intent in place. A future contributor scanning across cells sees
"this test exists conceptually but is disabled here, here is why" without
having to consult a separate document. The commented code is treated as
documentation, not as code — it does not need to compile against the target
cell's connection, it just needs to read like the canonical version.

**Why not `test.skip(…)`** — a skipped row in the report does not
distinguish "intentional disabled-on-this-dialect placeholder" from "TODO,
finish me later". Commented-out blocks with a reason on top do. Also,
skipped tests still parse and compile their body — which means the body
must be valid for the target cell's connection, defeating the point of using
the canonical body as documentation. `test.skip(…)` is fine when a test is
temporarily broken or under investigation — that is an exceptional
situation, not the non-applicability case.

The symmetry audit (`bun run tests:audit`) enforces this mechanically over the
**whole matrix** (every database × version × connector, not just the cells of one
database). See [`test/lib/audit/AUDIT.md`](./lib/audit/AUDIT.md). It is reported
at `error` severity: the cross-database backlog (files/tests not yet mirrored to
every cell) has been worked down and the matrix is clean, so a divergence now
blocks.

**Exempt: `config.*` connection-configuration tests.** Files named `config.*.test.ts`
hold tests specific to a connector's / database's connection configuration (e.g.
sqlite's uuid strategy, datetime formats) that have no analogue in other cells, so
they are **not** required to exist in every cell and are excluded from the symmetry
comparison (`config.` prefix in `test/lib/audit/symmetry.ts`).

**Exempt: files whose name embeds a database name.** A file whose name carries a
database name as a `.`/`-`-delimited token (e.g.
`select.postgres-const-force-type-cast.test.ts` → `postgres`) is inherently
dialect-specific and is excluded from symmetry — it need not exist in the other
cells (`embedsDatabaseName` in `test/lib/audit/symmetry.ts`, matching the real
database directory names).

**Exempt: the generated documentation tests.** The doc-snippet test cells produced
by the extractor — a `documentation` connector in each db's `newest` version, plus a
synthetic `general` db — are NOT authored per-cell and are db-specific by nature
(each db's doc-code file holds only its own dialect's SQL), so they don't follow the
symmetry rule. The audit ignores the `documentation` connector and the `general` db
(`NON_CELL_CONNECTORS` / `NON_CELL_DATABASES` in `test/lib/audit/symmetry.ts`). They are
gitignored (`*.generated.test.ts`) and regenerated by `codegen:doc-code`; see
[`DOC_CODE_EXTRACTOR.md`](./DOC_CODE_EXTRACTOR.md).

Related discipline:

- **[Full-canonical-body](#full-canonical-body)** — what the body inside the
  `/* */` block must look like (full canonical, NOT a stub).
- **Imports referenced only from commented blocks** — `noUnusedLocals`
  rejects them. The fix is `void identifier` after the import; see
  [`WRITING_TESTS.md` § Imports used only from commented-out blocks](./WRITING_TESTS.md#imports-used-only-from-commented-out-blocks).

## Mock-only smell

A test guarded by `if (ctx.realDbEnabled) return` (or by the inverse
weakening pattern in [Mirror-image form](#mirror-image-form)) asserts SQL
no real database accepts. That is almost always a sign the test exercises
something that does not make semantic sense — a "tiebreaker" on a unique
column, an `ORDER BY` on a one-row scalar aggregate, an aggregate predicate
in `WHERE`, and so on. The guard is the escape hatch, not the default.

The same applies to per-cell guards: silencing
`if (ctx.realDbEnabled) return` in a single dialect masks the same design
issue and just hides it from one column of the matrix.

### Skip-real form

```ts
if (ctx.realDbEnabled) return       // ← anti-pattern
expect(rows).toEqual(/* … */)       // only the mock ever runs this
```

Before adding this guard:

1. **Check the SQL semantics.** Read the snapshot the assertion would pin.
   Would a developer write that SQL in production code? If not, the test is
   hiding a design problem — fix the design, don't paper over it with the
   guard.
2. **Try restructuring.** Change the column, hook position or query shape
   until the emitted SQL is meaningful AND universally accepted. Real-DB
   coverage is the goal.
3. **Document the constraint.** Only after both checks should you reach for
   the guard, and only with a comment naming what forced the choice — a
   driver that strips comments and mis-counts placeholders, a synthetic SQL
   that is the test's whole point (forwarder recursion through nested
   customize hooks, etc.), or a documented dialect-specific limitation.
   "Mock-only because `<DB>` rejects this" without explaining *why* that SQL
   exists is not enough.

Two real cases that surfaced in this suite. Both were initially "fixed" by
adding a per-cell mock-only guard; both should have forced a redesign:

- `.orderBy('id').customizeQuery({ afterOrderByItems: rawFragment`${tIssue.id} desc` })`
  — a "tiebreaker" by the same unique PK that is already the primary sort
  key. SQL Server rejected it (error 169, "column specified more than once
  in the order by list"). The actual fix was to make a non-unique column
  (`priority`) the primary key and use `id` as the real tiebreaker — works
  on every dialect, real-DB everywhere.
- A scalar aggregate sub-query (`selectOneColumn(count(...))` → one row)
  whose customize hook emitted `order by (<scalar sub-query>)`. Oracle
  rejected it (`ORA-00907`). Ordering one row by a scalar expression is
  meaningless. The actual fix was to move the embedded sub-query into a
  comment in the `afterSelectKeyword` slot — a natural position for a
  tag-style annotation next to an aggregate. That hook position IS
  mock-only by design (some drivers strip comments and would mis-count
  placeholders), but the SQL the snapshot now pins is meaningful and the
  guard documents a real constraint instead of papering over a broken
  design.

### Mirror-image form

```ts
if (!ctx.realDbEnabled) {
    expect(rows).toEqual([{ /* exact */ }])     // strong mock assertion
} else {
    expect(rows.length).toBeGreaterThan(0)      // weak real-DB assertion
}
```

The same smell wearing the opposite costume. The mock branch asserts a
precise value; the real-DB branch asserts only that the shape is "something
with a length", which would let almost any regression through. Either form
drops real-DB validation onto the floor.

The remedy is to make the real-DB side deterministic so both modes can share
**one** unconditional `expect(...).toEqual(...)`. Typical levers, in
increasing cost:

1. **Add an `ORDER BY`** so the result set has a stable order — *when the
   test's premise allows it*. Some tests intentionally omit `ORDER BY`
   because the test's whole point is the SQL the lib emits without one
   (the default ordering, the dialect's tie-breaking, the absence of a
   synthesised `ORDER BY` from a hook that only triggers under specific
   conditions). Adding a gratuitous `ORDER BY` would change what the test
   exercises. When the premise does allow it, sort by the projected primary
   key.

2. **Sort in JS** the dimension that's non-deterministic, then compare
   exactly. The cheap trick is
   `rows.map(r => ({ ...r, items: [...r.items].sort(cmp) }))` →
   `expect(sorted).toEqual([...sortedExpected])`. Also the right fix when
   the SQL deliberately omits `ORDER BY` per the above, or when no public
   API exposes an `ORDER BY` for the unstable dimension (the inner array
   produced by `aggregateAsArrayOfOneColumn(...)` is the canonical example).

3. **`UPDATE` inside `ctx.withRollback`** when the seed default would
   trivialise the assertion (`view_count = 0n` for every issue → `views: [0n, 0n]`
   if you `aggregateAsArrayOfOneColumn` over project 1's issues). Populate
   the interesting values, then run the SELECT. The SELECT must remain the
   **last** statement so `ctx.lastSql` / `ctx.lastParams` still capture it;
   the rollback reverts the schema for the next test. Recipe:

   ```ts
   await ctx.withRollback(async () => {
       ctx.mockNext(1)
       await ctx.conn.update(tIssue).set({ viewCount: 100n }).where(tIssue.id.equals(1)).executeUpdate()
       ctx.mockNext(1)
       await ctx.conn.update(tIssue).set({ viewCount: 200n }).where(tIssue.id.equals(2)).executeUpdate()

       ctx.mockNext([{ projectId: 1, views: [100n, 200n] }])
       const rows = await ctx.conn.selectFrom(tIssue)
           .where(tIssue.projectId.equals(1))
           .select({ projectId: tIssue.projectId, views: ctx.conn.aggregateAsArrayOfOneColumn(tIssue.viewCount) })
           .groupBy('projectId')
           .executeSelectMany()
       expect(ctx.lastSql).toMatchInlineSnapshot(/* … */)         // last stmt = the SELECT
       const sorted = rows.map(r => ({ ...r, views: [...r.views].sort((a, b) => Number(a - b)) }))
       expect(sorted).toEqual([{ projectId: 1, views: [100n, 200n] }])
   })
   ```

4. **Pick a query the existing seed already produces a meaningful answer
   for** — when the test goal allows. Cheaper than UPDATEs when one of the
   seeded values is already what you want to assert.

**Only after (1)–(4) genuinely fail** — e.g. the dialect actually returns a
different value for legitimate reasons (float precision, engine-specific
time-zone handling, affected-row count) — fall back to two assertions with
a comment naming the cause. The mock assertion stays exact; the real-DB
assertion is the widest predicate that still distinguishes "the engine ran
this query and returned something plausible" from any regression you care
about. Length checks alone almost never qualify.

When you write the test, write the **strongest** unconditional assertion you
can defend. A test that "passes everywhere" on the strength of
`expect(rows.length).toBeGreaterThan(0)` is a test that fails to catch the
bug it was added for.

## Full-canonical-body

When a test does not apply to a cell, the `/* … */` block must contain the
**FULL canonical body** that the supporting dialect would run — not a stub.

```ts
// Bad — stub:
// Not supported on this dialect: Values is not typed.
/*
test('select-from-values-untyped', async () => {
    // stub
})
*/

// Good — full canonical body kept verbatim:
// Not supported on this dialect: Values is not typed on MariaDBConnection.
/*
test('select-from-values-untyped', async () => {
    const expected = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]
    ctx.mockNext(expected)

    const rows = await ctx.conn.selectFromValues(
        ctx.conn.values('vRows', [
            { id: 1, name: 'a' },
            { id: 2, name: 'b' },
        ]),
    )
        .select({ id: vRows.id, name: vRows.name })
        .orderBy('id')
        .executeSelectMany()

    expect(ctx.lastSql).toMatchInlineSnapshot()
    expect(ctx.lastParams).toMatchInlineSnapshot()
    assertType<Exact<typeof rows, Array<{ id: number, name: string }>>>()
    expect(rows).toEqual(expected)
})
*/
```

The rationale: the symmetry audit ([`tests:audit`](./TEST_LIB.md#audittestsymmetryts--the-symmetry-audit))
walks `/* */` blocks too, so the test name still counts. But the **body** is
what makes the cell visually parallel to the others and makes a future
uncomment + re-bake mechanical. A stub strips both properties:

- A reader diffing across cells sees a gap, not a parallel structure.
- An agent uncomment-ing the test when the dialect catches up has to
  re-derive the body from another cell's source — work that was already done
  once when the test was first written.

The discipline applies in two situations:

1. **Test not applicable on this cell** (`// NOT-APPLICABLE: <reason>`
   marker). The canonical body comes from any cell that DOES support
   the test (typically the dialect canonical).
2. **Canonical can't compile the body** (e.g. a feature only typed on
   PG/MariaDB/SqlServer being tested from a canonical that lives on
   sqlite). Write the test directly into the canonical as a commented-out
   block with the supporting dialect's body verbatim. Mirror to every
   other cell. Uncomment in the cells where the feature IS available. The
   recipe is in
   [`WRITING_TESTS.md` § When the canonical cell can't compile the body](./WRITING_TESTS.md#when-the-canonical-cell-cant-compile-the-body).

When a commented-out test references an import that no live code in the
cell uses, `noUnusedLocals` rejects the import. The fix is the `void identifier`
sentinel — see
[`WRITING_TESTS.md` § Imports used only from commented-out blocks](./WRITING_TESTS.md#imports-used-only-from-commented-out-blocks).

## As any runtime-guard

A handful of `TsSqlProcessingError` paths fire from inside the SQL builders
when the user misuses the API. The typer is built to catch the same misuses
at compile time, so writing the offending code directly does not compile:

```ts
// ✗ does not compile — `.executeDelete` is not on `DeleteExpression`
//   until `.where(...)` has been called.
connection.deleteFrom(tIssue).executeDelete()

// ✗ does not compile — `set(...)` returns `NotExecutableUpdateExpression`,
//   which lacks `executeUpdate`.
connection.update(tIssue).set({ title: 'x' }).executeUpdate()
```

These compile-time guards are deliberate, and the typer does many
contortions to arrive at the `never` that fails the call site. The runtime
implementation is still there; the test of the runtime guard needs to reach
it.

**The only sanctioned use of `as any`** in the test suite is to bypass a
compile-time guard at the precise fluent step the typer blocks, to reach
the matching runtime guard:

```ts
test('delete without where throws MISSING_WHERE', () => {
    let caught: unknown
    try {
        // Cast bypasses the compile-time guard so we can reach the
        // runtime guard. The typer rejects `.executeDelete` here on
        // purpose — see DeleteExpression in src/expressions/delete.ts.
        (ctx.conn.deleteFrom(tIssue) as any).executeDelete()
    } catch (e) {
        caught = e
    }
    expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined)
        .toBe('MISSING_WHERE')
})
```

Two anti-patterns:

- **Calling `.where(...)` first to satisfy the typer**: now the fluent
  chain compiles but the runtime never sees the guard you wanted to test.
  The test asserts something else.
- **Wrapping the whole chain in `as any`**: future runtime regressions
  (a method being renamed, a builder returning a different shape) go
  undetected. Cast at the smallest possible spot.

Outside this exact use, `as any` IS NOT permitted in test bodies. If TS
rejects an API your test wants to call, pick the right reason marker
(see [Symmetry rule](#symmetry-rule) for the three categories):

- The dialect doesn't support the feature by design — block-comment the
  test with `// NOT-APPLICABLE: <reason>`.
- The lib has not covered this path yet — block-comment with
  `// TODO[LIMITATION]: see LIMITATIONS.md — <one-line>`.
- The lib has a bug (typer narrower than runtime, runtime narrower than
  typer) — open an entry in [`BUGS.md`](./BUGS.md) following
  [`WRITING_TESTS.md` § When a test surfaces a bug in `src/`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src),
  block-comment the test with `// TODO[BUG]: see test/BUGS.md`, and move on.
- The API may not exist — verify with
  `bun run tests:where-is --search <name>` before writing the test
  (see [`CODE_SEARCH.md` § When the symbol is not found](./CODE_SEARCH.md#when-the-symbol-is-not-found)).

## Public surface only

Test imports must resolve to a path enumerated in the `exports` map of
[the root `package.json`](../package.json). The `./__UNSUPPORTED__/*`
wildcard escape hatch is **not** part of the public surface for the tests:
if a test needs something only reachable through `__UNSUPPORTED__/`, the
right answer is to open up the API, not to import via that escape.

Concretely, the imports the suite uses (`src/Table.ts`,
`src/connections/PostgreSqlConnection.ts`, `src/queryRunners/*.ts`,
`src/TypeAdapter.ts`, `src/dynamicCondition.ts`, …) all match entries
enumerated in `exports`. If you have to write a path that does not appear
there, stop and reconsider.

One forward-looking exception: `src/experimental/*` is a staging area for
surface that is already meant for tests to consume but is not yet in the
`exports` map (e.g. `src/experimental/types.ts`). Tests may import it
directly.

One documented exception exists: query introspection via `__isAllowed` has
no public API yet, and the test suite reaches it through a single seam at
[`test/lib/isAllowed.ts`](./lib/isAllowed.ts). See
[`LIMITATIONS.md` § Query introspection](./LIMITATIONS.md#query-introspection-__isallowed-has-no-public-api-yet--tests-reach-internals-via-a-single-helper)
for the full justification and the contract for when the public API lands.
The existence of this helper does NOT widen the licence for other internal
imports.

## Companion documents

This file states **rules**. Operational details live next to them:

- [`README.md`](./README.md) — navigation map: which doc to read for which task.
- [`CLI.md`](./CLI.md) — commands, flags, scope, aliases, coverage formats.
- [`WRITING_TESTS.md`](./WRITING_TESTS.md) — anatomy, runtime guard recipe,
  domain extension, canonical-cant-compile, void-import, docs.* snippets,
  bug-handoff.
- [`NEW_DATABASE.md`](./NEW_DATABASE.md) — add a database / connector / version
  end-to-end.
- [`COVERAGE_RUNBOOK.md`](./COVERAGE_RUNBOOK.md) — coverage-driven test
  generation runbook for agents.
- [`QUALITY_GATE.md`](./QUALITY_GATE.md) — validation sub-agent that
  reviews the canonical cell before propagation.
- [`TEST_LIB.md`](./TEST_LIB.md) — reference for every file under `test/lib/`,
  including the mutation safety contract on `ctx`.
- [`PER_DATABASE_LAYOUT.md`](./PER_DATABASE_LAYOUT.md) — `test/db/<db>/`
  tree convention, `runners.ts` pattern, `domain/*` files.
- [`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md) — container reuse,
  schema/seed revalidation, per-worker DBs, WASM lifecycle.
- [`BENCHMARKS.md`](./BENCHMARKS.md) — wall-time numbers under each
  invocation, bun vs vitest.
- [`BUGS.md`](./BUGS.md) — bugs in `src/` the suite surfaced.
- [`LIMITATIONS.md`](./LIMITATIONS.md) — deliberate gaps in `src/`.
- [`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md) — caveats per driver /
  engine / runtime (Bun, pglite-PG18, MariaDB 13, etc.).
- [`ANTIPATTERNS.md`](./ANTIPATTERNS.md) — catalogue of past
  test-generation failures with the rule each violated and the gate
  adopted.
