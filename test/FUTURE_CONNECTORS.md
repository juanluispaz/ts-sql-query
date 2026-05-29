# `test/` — TODOs for future connectors and versions

Working notes for an agent that later expands the matrix beyond today's
17 cells (more `compatibilityVersion` zones, additional connectors, the
sync / prisma sub-trees). This file lists every dialect- or
connector-specific decision the current `docs.*.test.ts` files bake in,
so the next pass can revisit the call rather than re-discover it.

Today's matrix is fixed: do **not** open new cells from these notes.
Treat them as a checklist for when the matrix is extended.

## How the constraints surface today

Each item below describes a `docs:` or `docs-extra:` test that is
**commented out** in some cells with a `/* ... */` block per the
symmetry rule ([`DESIGN.md` §4](./DESIGN.md#4-symmetry-rules--critical-maintainability-property)).
The body stays verbatim, prefixed by a one-line `// Not applicable on
<DB>: ...` reason. To find every commented test mechanically:

```bash
grep -rE "^    // Not applicable on" test/db/*/*/*/docs.*.test.ts
```

## Dialect-specific notes (already wired in today's matrix)

### sqlite value-marshalling: BigInt binding and uuid extension functions

The `viewCount` (`bigint`), `estimatedHours` (`double`) and
`externalRef` (`uuid`) columns added to the shared `issue` domain
exercise `AbstractConnection` value marshalling. Two connector
limitations surface, isolated into one test per value type in
`select.value-marshalling.test.ts`:

- **BigInt parameter binding** — the `sqlite3` npm driver cannot bind a
  JS `BigInt` (it sends `NULL`, tripping the NOT NULL on `view_count`).
  `bun:sqlite`, `better-sqlite3`, `node:sqlite` and `sqlite-wasm-OO1`
  all bind BigInt correctly.
  - `marshalling/bigint-insert-select-roundtrip` — commented out in
    `test/db/sqlite/newest/sqlite3/` only.
- **uuid extension functions** — the default `uuid-extension` strategy
  emits `uuid_blob` / `uuid_str`. `bun:sqlite` ships them built-in;
  `better-sqlite3` and `node:sqlite` get them registered in
  `runners.ts` (per the connector docs/examples); `sqlite3` has no
  user-function API and `sqlite-wasm-OO1` does not register them (its
  `src/examples/Sqlite3WasmOO1Example.ts` uses the `'string'` uuid
  strategy instead).
  - `marshalling/uuid-insert-select-roundtrip` — commented out in
    `test/db/sqlite/newest/sqlite3/` and
    `test/db/sqlite/newest/sqlite-wasm-OO1/`.
- `marshalling/double-insert-select-roundtrip` stays live in every cell.

When the matrix is next extended, revisit whether `sqlite3` can bind
BigInt (driver upgrade), and whether the sqlite domain should adopt the
`'string'` uuid strategy uniformly (the `withUuidStrategy` helper already
lets a test pin `'uuid-extension'` where it is supported) so the uuid
round-trip runs on every sqlite connector.

### MySQL — no INSERT/UPDATE/DELETE RETURNING

MySQL's driver/server combo doesn't surface RETURNING values. The
following tests are commented out in `test/db/mysql/newest/mysql2/`
because `.returning({...})` / `.returningOneColumn(...)` is not
typed for that connection:

- `docs.insert.test.ts`:
  - `docs:insert/insert-many-values`
  - `docs:insert/insert-returning`
  - `docs:insert/insert-multiple-with-shape`
  - `docs:insert/insert-on-conflict-do-nothing`
  - `docs:insert/insert-on-conflict-do-update`
  - `docs-extra:insert/insert-on-conflict-do-update-bare`
  - `docs-extra:insert/values-for-insert-in-update`
  - `docs-extra:insert/insert-returning-one-column`
- `docs.update.test.ts`:
  - `docs:update/update-returning`
  - `docs-extra:update/returning-one-column`
- `docs.delete.test.ts`:
  - `docs:delete/delete-returning`
  - `docs-extra:delete/returning-one-column`

If a future MySQL version (or a newer driver) starts to surface
RETURNING, uncomment these tests in the existing `mysql2` cell and add
the same test bodies under the new `<version>/mysql2` and any new
connector cells.

### Oracle — no INSERT ... ON CONFLICT

Oracle has no equivalent of `INSERT ... ON CONFLICT DO NOTHING/UPDATE`.
The following tests are commented out in `test/db/oracle/newest/oracledb/`:

- `docs.insert.test.ts`:
  - `docs:insert/insert-on-conflict-do-nothing`
  - `docs:insert/insert-on-conflict-do-update`
  - `docs-extra:insert/insert-on-conflict-do-update-bare`
  - `docs-extra:insert/values-for-insert-in-update`

If Oracle 23ai+ gains MERGE-based emulation that ts-sql-query maps to
the same fluent shape, uncomment these tests in the Oracle cells of
that version.

### Oracle — isolation level OR access mode, not both

`OracleConnection.isolationLevel(...)` accepts the isolation level
*or* the access mode but not both simultaneously. The
`docs:transaction/isolation-level` snippet from
`docs/queries/transaction.md` uses
`connection.isolationLevel('serializable', 'read only')` and is
commented out in `test/db/oracle/newest/oracledb/docs.transaction.test.ts`.
When adding a new Oracle cell, either keep the test commented or write
a single-arg Oracle-friendly variant.

### SQL Server — no INSERT ... ON CONFLICT

Same list of commented tests as Oracle in `test/db/sqlserver/newest/mssql/docs.insert.test.ts`:

- `docs:insert/insert-on-conflict-do-nothing`
- `docs:insert/insert-on-conflict-do-update`
- `docs-extra:insert/insert-on-conflict-do-update-bare`
- `docs-extra:insert/values-for-insert-in-update`

### SQL Server — `isolationLevel(level)` only, no access mode

`SqlServerConnection.isolationLevel(...)` is typed with one argument
(the level); SQL Server's access modes (`read write` / `read only`)
are not exposed. `docs:transaction/isolation-level` is commented out
in `test/db/sqlserver/newest/mssql/docs.transaction.test.ts`.

### MariaDB — bare `.onConflictDoUpdateSet({...})` only

MariaDB upserts on any unique-key conflict; you don't specify a
target. The library exposes the bare form on MariaDBConnection but
*not* the targeted `onConflictOn(col).doUpdateSet({...})` form. The
following tests are commented out in `test/db/mariadb/newest/mariadb/docs.insert.test.ts`:

- `docs:insert/insert-on-conflict-do-update`
- `docs-extra:insert/values-for-insert-in-update`

### PostgreSQL — targeted upsert required (no bare form)

PostgreSQL requires `.onConflictOn(col).doUpdateSet({...})`. The bare
`.onConflictDoUpdateSet({...})` form emits an untargeted `ON CONFLICT
DO UPDATE` clause which postgres rejects at execution time (pglite
catches it, the other postgres cells run mock-only and silently pass —
the symmetry-rule comment-out keeps every postgres cell aligned). The
following is commented out in every `test/db/postgres/*/<connector>/docs.insert.test.ts`:

- `docs-extra:insert/insert-on-conflict-do-update-bare`

### SQLite — no `update returning old values`, no `delete using`

- `tTable.oldValues()` is only typed on PostgreSqlConnection,
  MariaDBConnection and SqlServerConnection. `docs:update/update-returning-old-values`
  is commented out in every sqlite cell (`test/db/sqlite/*/<connector>/docs.update.test.ts`).
- `deleteFrom(...).using(...)` is not available on SQLite. The test
  `docs:delete/delete-using` is commented out in every sqlite cell
  (`test/db/sqlite/*/<connector>/docs.delete.test.ts`).

### SQLite — no isolation-level method

`SqliteConnection` doesn't expose `isolationLevel(...)` (sqlite's
only mode is "serializable", set implicitly). The test
`docs:transaction/isolation-level` is commented out in every sqlite
cell (`test/db/sqlite/*/<connector>/docs.transaction.test.ts`).

## Connectors not in the matrix today

These are reachable from the public exports and have their own runner
implementation in `src/queryRunners/`, but no `test/db/<db>/<version>/<connector>/`
cell exists yet:

- **prisma** — different runtime semantics (Prisma client wraps the
  driver). Plan in `DESIGN.md §1.15`: light mirror coverage under
  `test/db/<database>/<version>/prisma/`, NOT the full docs.* set.
  Treat the docs tests as out-of-scope until prisma parity is the
  explicit task.
- **sync runners** — `extras/sync`, `BetterSqlite3SyncQueryRunner`,
  `Sqlite3WasmOO1SyncQueryRunner`, etc. Different runtime semantics
  (the API is sync). Plan in `DESIGN.md §1.16`: dedicated
  `test/db/sync/...` sub-tree, not part of the main matrix.
- **`bun_sql_mysql`, `bun_sql_sqlite`** — experimental bun
  connectors with known bugs. Excluded permanently per
  `DESIGN.md §10`.

When any of these are added to the main matrix:

1. Create the cell folder under the appropriate database following
   `DESIGN.md §8`.
2. Copy every `docs.*.test.ts` from a sibling cell (sqlite canonical
   is the cheapest source).
3. Run `bun test test/db/<db>/<version>/<connector>/ -- --update-snapshots`
   to bake per-cell SQL.
4. Triage compile errors → comment out the offending tests with the
   one-line reason. Cross-reference the dialect notes above so you
   don't re-discover constraints already characterised in another
   cell of the same database.
5. Run `bun run tests:audit` and `bun run validate:tests` before
   merging.

## Connection-subclass patterns not testable in the shared domain

A handful of features documented in `docs/advanced/` require a custom
`DBConnection` subclass — they extend `transformValueFromDB` /
`transformValueToDB` or expose typed helper methods built with
`buildFragmentWithArgs`. The shared domain
(`test/db/<db>/domain/connection.ts`) is intentionally vanilla, so
these features can't be exercised end-to-end inside `docs.*.test.ts`
without diverging the domain (which breaks symmetry across cells).

The library functions involved are nevertheless tested in isolation
where possible. Items to revisit if/when the domain gains a feature
that justifies the divergence:

- **`buildFragmentWithArgs` / `buildFragmentWithArgsIfValue` / `buildFragmentWithMaybeOptionalArgs`**
  (docs/queries/sql-fragments.md, "Reusable fragments" /
  "Conditional fragments" / "Nullable fragments"). All three are
  `protected` on AbstractConnection and meant to be called from
  inside a DBConnection subclass. Slot kept in
  `docs.sql-fragments.test.ts` as a TODO comment; reintroduce when
  the shared domain grows a real helper that demonstrates the
  pattern.
- **Globally Encrypted ID (id-manipulation.md)** — needs a
  DBConnection subclass overriding `transformValueFromDB` /
  `transformValueToDB` and a per-table `ID:<prefix>` custom type.
  The `IDEncrypter` itself is exercised directly (`docs:id-manipulation/encrypter-with-prefix`,
  `docs-extra:id-manipulation/encrypter-prefix-disambiguates-tables`)
  to lock its round-trip contract.
- **createTableOrViewCustomization** (sql-fragments.md "Table or view
  customization") — defines alternative renderings for table
  references. Requires either a custom Table subclass per case or a
  Values-based pattern. Out-of-scope for the symmetric domain today.

## "Could test more if real DB were on" assertions

A handful of tests check structural shape only (SQL+params+type)
because the value can't be locked in without docker / real WASM:

- `docs:insert/insert-returning` — the real id is autogenerated; the
  mock returns the primed value, real returns whatever the engine
  picked. Pattern: `if (!ctx.realDbEnabled) expect(id).toBe(...)`.
- `docs:select-page/extras-with-data-skips-data-query` — count is the
  primed value in mock mode, real `count(*)` in real-DB mode.
- `docs-extra:transaction/hooks-cleared-after-use` and similar hook
  tests — work in both modes, but only the side-effect counter is
  asserted.

When a new connector adds real-DB coverage, these tests should run
unchanged — there is no per-connector branching in the test body
itself; the `if (ctx.realDbEnabled)` switch already covers it.

## Operational checklist when adding a new connector or version

1. **Read** `DESIGN.md §8` (adding a database) and `MAINTAINING.md`
   (adding a database section).
2. **Mirror** every `docs.*.test.ts` from a sibling cell (the sqlite
   canonical `test/db/sqlite/newest/bun_sqlite/` is the cheapest
   source). Use `cp` over the whole set, then run the matrix snapshot
   bake.
3. **Triage** compile errors against the dialect notes above. Cell
   that matches the new dialect on commented tests usually points to
   the same restriction.
4. **Re-run** `bun run validate:tests:tsgo` (fast) and `bun run
   validate:tests` (authoritative) — both must be clean before
   committing.
5. **Run** `bun run tests:audit`; symmetry must be intact.
6. **If the new connector exposes a real DB** (docker or in-process),
   also run `bun run tests --docker` (and `--wasm` for WASM
   connectors). The `if (ctx.realDbEnabled)` branches in existing
   tests will fire — fix any data assertions that mismatch the real
   seed.

## Pages deliberately not in scope

These are reference pages, not feature pages. No `docs.*.test.ts`
exists for them and adding one is **not** the right move when the
matrix is extended:

- `docs/api/*` — TypeScript reference. Covered by
  `test/db/<db>/types.negative/` and the ambient type checks.
- `docs/api/error-management/*` — the error-type catalog. Same as
  above.
- `docs/configuration/*` — covered by per-cell `setup.ts` and
  `runners.ts`.
- `docs/keywords/*` — keyword index, not a feature surface.
- `docs/about/*` — narrative.
- `docs/CHANGELOG.md`, `docs/index.md` — meta.

`docs/advanced/synchronous-query-runners.md` belongs to the future
sync sub-tree, not to the main matrix.
