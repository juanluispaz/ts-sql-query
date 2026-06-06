# `test/` — external caveats: per-driver, per-engine, per-runtime

Catalogue of caveats imposed by the **external** systems the test matrix
talks to — driver packages, database engines, runtimes. These are NOT
bugs in `ts-sql-query` and NOT deliberate library gaps; they are
constraints from outside the library that test authors have to work
around when writing or porting tests.

Boundary with the other catalogues:

| File | What it catalogues |
|---|---|
| [`BUGS.md`](./BUGS.md) | bugs in `src/` (`ts-sql-query` itself) |
| [`LIMITATIONS.md`](./LIMITATIONS.md) | deliberate gaps in `src/` declared by the project author |
| This file | external — what a driver / engine / runtime can't do (or doesn't yet do) |

Today's matrix already wires the workarounds in every affected cell; the
"Dialect-specific notes" section below documents them. The other
sections list connectors not in the matrix today, connection-subclass
patterns that don't fit the shared domain, and the operational checklist
for adding new infrastructure. Treat the items as a checklist when the
matrix is extended.

## How the constraints surface today

Each item below describes a `docs:` or `docs-extra:` test that is
**commented out** in some cells with a `/* ... */` block per the
symmetry rule ([`DESIGN.md` § Symmetry rule](./DESIGN.md#symmetry-rule)).
The body stays verbatim, prefixed by a one-line `// Not applicable on
<DB>: ...` reason. To browse the caveat map mechanically:

```bash
bun run tests:where-is --search <any-api> --cell-caveats summary
```

returns the per-cell **map** of `// TODO[BUG]` / `// TODO[LIMITATION]`
markers (each cell + its caveat counts). Scope to a driver with
`--coord '<driver-cells>'` and the preset auto-raises to `full` (the
markers themselves) — `--cell-caveats` is the searcher's section
designed for exactly this catalogue. Plain
`grep -rE "^    // Not applicable on" test/db/*/*/*/docs.*.test.ts`
still works when the index isn't built.

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
  - `select.aggregate-as-array.value-type-coverage.test.ts` →
    `aggregate-of-optional-uuid-column-as-array` (pure uuid) — commented
    out in `test/db/sqlite/newest/sqlite3/` and
    `test/db/sqlite/newest/sqlite-wasm-OO1/`; nothing else in the test, so
    the whole test goes.
  - `select.aggregate-as-array.value-type-coverage.test.ts` →
    `aggregate-of-object-with-bigint-uuid-and-double` (mixed
    `bigint` + `uuid` + `double`) — handled **differently per cell**:
    - `sqlite-wasm-OO1`: only the `externalRef` (`uuid`) property is
      commented out (the lines are kept in place with `//` / `/* */` so a
      fix is an un-comment + snapshot bake); the test stays **live** and
      keeps real-validating the `bigint` + `double` branches, since
      sqlite-wasm-OO1 binds BigInt fine.
    - `sqlite3`: the **whole** test stays commented — the `sqlite3` driver
      additionally can't bind the `view_count` BigInt (same reason
      `aggregate-of-bigint-column-as-array` is commented there), so
      dropping only the uuid property wouldn't make it runnable. The
      `double` branch is covered by the live
      `aggregate-of-optional-double-column-as-array`.
  - `dynamic-condition.equivalence.test.ts` →
    `equivalence/uuid-as-string-operator-path` — same root cause
    (`.asString()` on a uuid emits `uuid_str(external_ref)`); commented
    out in the same two cells (`sqlite3`, `sqlite-wasm-OO1`). The
    registered `uuid_str` / `uuid_blob` in `runners.ts` are NULL-safe
    (return NULL on NULL input, mirroring the real extension and
    `bun:sqlite`) because that query applies `uuid_str` across seeded
    rows whose `external_ref` is NULL.
  - `with-values.advanced.test.ts` →
    `values-optional-virtual-column-from-fragment-with-custom-type-emits-inline-fragment`
    — same root cause: the `customUuid` virtual column selects through
    the default uuid-extension strategy, emitting `uuid_str(null)`;
    commented out in the same two cells (`sqlite3`, `sqlite-wasm-OO1`).
    The required-enum sibling
    (`values-virtual-column-from-fragment-with-custom-type-emits-inline-fragment`)
    stays live everywhere — it inlines a bare literal and needs no uuid
    function.
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

### Oracle — nullable numeric column in a multi-row VALUES

A multi-row `VALUES` tuple is a union of row constructors, and every
engine requires each column to share one datatype across all rows.
`OracleConnection` has no `transformPlaceholder` override (unlike
`PostgreSqlConnection`, which casts VALUES placeholders — `$2::float8`
etc.), so Oracle emits bare placeholders and the `oracledb` driver
binds a JS `null` as a non-numeric type. When a numeric column mixes a
value and a `null` across rows (e.g. `amount` = `19.99` in row 1,
`null` in row 2), Oracle rejects it with `ORA-01790: expression must
have same datatype as corresponding expression`. This is a general
Oracle limitation for any nullable numeric/date column in a multi-row
VALUES, not specific to custom types.

- `with-values.advanced.test.ts` →
  `values-with-custom-typed-columns-emits-customint-customdouble-casts`
  — commented out in `test/db/oracle/newest/oracledb/` only. The
  non-null custom-typed path stays real-validated on oracle via the two
  `values-*-virtual-column-from-fragment-*` tests. The proper fix is an
  `OracleConnection.transformPlaceholder` that casts VALUES placeholders
  (including the NULL); deferred to a dedicated session.

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

### `bun_sql_postgres` — `Date` parameter binding (Bun#29010)

Bun.SQL's PostgreSQL adapter serialises JS `Date` parameters via
`Date#toString()` (e.g. `"Mon Jan 15 2024 …"`) instead of an
ISO/timestamp format. PostgreSQL rejects the bound value with
`invalid input syntax for type date|timestamp` whenever a `Date`
intended as `localDate` / `localDateTime` reaches the driver. Open
upstream: <https://github.com/oven-sh/bun/issues/29010>.

`localTime` is unaffected because `transformValueToDB('localTime',
Date)` ships a bare `'HH:MM:SS'` string, not a `Date`. Numeric and
text parameters are unaffected for the same reason.

Tests commented out in `test/db/postgres/newest/bun_sql_postgres/`
**and** `test/db/postgres/oldest/bun_sql_postgres/` until the bug is
fixed upstream — the canonical body is preserved inside `/* */` so
a fix is one comment removal plus a snapshot bake:

- `select.postgres-const-force-type-cast.test.ts` →
  `const-localdate-forces-date-cast`,
  `const-localdatetime-forces-timestamp-cast`,
  `const-custom-localdate-falls-through-without-cast`.

Coverage-driven test generation **must** consult this section before
copying any test that constructs a `new Date(...)` parameter from the
`pg`/`postgres`/`pglite` canonical to `bun_sql_postgres` — the bug
applies to every `localDate` / `localDateTime` `Date` parameter,
not just the three names already commented out. The right move is to
copy AND immediately re-wrap the affected tests in `/* */` with this
section linked from the reason header.

### `pglite` — `Date` parameter bound to an uncast (text-inferred) placeholder

When a `Date` parameter reaches a **bare** placeholder (no `::`-cast),
PostgreSQL infers the parameter type as text/unknown. pglite's
in-process serializer is then handed a JS `Date` for a string-typed
param and rejects it with `Invalid input for string type`. The
wire-protocol postgres drivers (`pg`, `postgres`) stringify a `Date`
before it reaches the server, so they round-trip fine; pglite's
serializer does not. This is a pglite constraint, **not** a library
bug — the cast is deliberately omitted (the test pins exactly that),
so there's nothing to change in `src/`.

Commented out in `test/db/postgres/newest/pglite/` **and**
`test/db/postgres/oldest/pglite/`:

- `select.postgres-const-force-type-cast.test.ts` →
  `const-custom-localdate-falls-through-without-cast`. The enumerated
  `'localDate'` / `'localDateTime'` cases are unaffected because they
  route to `::date` / `::timestamp`, giving the serializer a typed
  target. Only the `customLocalDate` fall-through (bare placeholder)
  trips it. Body kept verbatim so a future pglite fix is a `/* */`
  removal plus a snapshot bake.

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
3. Run `bun run tests <db>/<version>/<connector> --update-snapshots`
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

1. **Read** [`NEW_DATABASE.md`](./NEW_DATABASE.md) (end-to-end recipe
   for adding a database / connector / version).
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
