# `test/` — per-dialect and per-driver caveats, as wired in today's matrix

**How each dialect / driver constraint is handled in the matrix right
now**: which tests it disables and where, which workaround is already
built into a runner, and what to re-check when the matrix grows a cell.
It is the operational companion to the three cause-based catalogues — it
answers *"what does this mean for the cell I'm writing?"*, not *"whose
fault is it?"*.

Most of what it documents is a **typed narrowing**: the library
deliberately does not expose `.returning(...)` on `MySqlConnection`,
`oldValues()` on `SqliteConnection`, `onConflictOn(...)` on
`MariaDBConnection`, … Those are `// NOT-APPLICABLE:` dialect boundaries
— the call cannot even be written — which is why they are tracked by
symmetry rather than by a catalogue of their own.

The runtime facts live in [`ENGINE_SUPPORT.md`](./ENGINE_SUPPORT.md).

Boundary with the other catalogues:

| File | What it catalogues |
|---|---|
| [`BUGS.md`](./BUGS.md) | bugs in `src/` (`ts-sql-query` itself) |
| [`LIMITATIONS.md`](./LIMITATIONS.md) | deliberate gaps in `src/` declared by the project author — closeable **here** |
| [`ENGINE_SUPPORT.md`](./ENGINE_SUPPORT.md) | what the engine / this engine **version** / its build / the driver **cannot run**, with the `// NOT-SUPPORTED:` markers that disable those tests |
| This file | the **operational** side of the same story: how each constraint is wired in today's matrix (workarounds already in the runners, per-dialect typed narrowings, the checklist when adding a connector) |

> **Read this boundary carefully.** Most of the
> per-dialect notes below are **typed narrowings**: the library deliberately does
> not expose `.returning(...)` on `MySqlConnection`, `oldValues()` on
> `SqliteConnection`, `onConflictOn(...)` on `MariaDBConnection`, … Those are
> `// NOT-APPLICABLE:` **dialect boundaries** (the call cannot even be written),
> not engine-runtime facts. A constraint where the call **compiles** and the
> engine/driver then refuses it belongs in
> [`ENGINE_SUPPORT.md`](./ENGINE_SUPPORT.md) under `// NOT-SUPPORTED:`, and one
> this repo could close belongs in [`LIMITATIONS.md`](./LIMITATIONS.md).

Today's matrix already wires the workarounds in every affected cell; the
"Dialect-specific notes" section below documents them. The other
sections list connectors not in the matrix today, connection-subclass
patterns that don't fit the shared domain, and the structural-only
assertions that a real-DB run could tighten. Treat the items as a
checklist when the matrix is extended — the end-to-end recipe for adding
a database / connector / version is [`NEW_DATABASE.md`](./NEW_DATABASE.md).

## How the constraints surface today

Each item below describes a `docs:` or `docs-extra:` test that is
**commented out** in some cells with a `/* ... */` block per the
symmetry rule ([`DESIGN.md` § Symmetry rule](./DESIGN.md#symmetry-rule)).
The body stays verbatim, prefixed by a one-line marker. The
**categories of reason marker** are four (see [`LIMITATIONS.md` § The
decision rule](./LIMITATIONS.md#the-decision-rule) for the comparison):

- `// NOT-APPLICABLE: <reason>` — a **dialect boundary** the lib will
  never run for this cell by design (the canonical case for everything
  in this catalogue: MySQL has no RETURNING, Oracle has no ON CONFLICT,
  …). The test runs and validates live on the cells whose dialect
  supports the feature; here it is only present for symmetry.
- `// NOT-SUPPORTED: <reason>` — the call compiles, but the engine /
  this engine version / its build / the driver can't run it; see
  [`ENGINE_SUPPORT.md`](./ENGINE_SUPPORT.md).
- `// TODO[LIMITATION]: <reason>` — the library hasn't covered it yet
  (or this harness can't drive it); see [`LIMITATIONS.md`](./LIMITATIONS.md).
- `// TODO[BUG]: <reason>` — the library has a defect to fix; see
  [`BUGS.md`](./BUGS.md).

Most entries below are dialect boundaries → `// NOT-APPLICABLE: …`. To
browse the caveat map mechanically:

```bash
bun run tests:where-is --search <any-api> --cell-caveats summary
```

returns the per-cell **map** of every reason marker
(`// NOT-APPLICABLE`, `// NOT-SUPPORTED`, `// TODO[BUG]`,
`// TODO[LIMITATION]`) — each cell + its caveat counts. Scope to a driver with `--coord '<driver-cells>'`
and the preset auto-raises to `full` (the markers themselves) —
`--cell-caveats` is the searcher's section designed for exactly this
catalogue. Plain
`grep -rE "^    // NOT-APPLICABLE" test/db/*/*/*/docs.*.test.ts` still
works when the index isn't built.

## Dialect-specific notes (already wired in today's matrix)

### sqlite value-marshalling: BigInt parameter binding (`sqlite3`)

The `viewCount` (`bigint`) and `estimatedHours` (`double`) columns added
to the shared `issue` domain exercise `AbstractConnection` value
marshalling. One connector limitation surfaces:

- **BigInt parameter binding** — the deprecated `sqlite3` npm driver
  cannot bind a JS `BigInt` (it sends `NULL`, tripping the NOT NULL on
  `view_count`). `bun:sqlite`, `better-sqlite3`, `node:sqlite` and
  `sqlite-wasm-OO1` all bind BigInt natively. As a best-effort fallback
  for this deprecated connector, `Sqlite3QueryRunner.addParam` coerces a
  `bigint` param to a `number` before binding it (see
  [`src/queryRunners/Sqlite3QueryRunner.ts`](../src/queryRunners/Sqlite3QueryRunner.ts));
  the mirror coercion lives in `MockSqlite3QueryRunner` so mock and real
  modes capture identical params. **Caveat:** this loses precision for
  integers above `Number.MAX_SAFE_INTEGER`. As a result the BigInt tests
  run live on `sqlite3` too, with the captured param showing the coerced
  `number` (`1500`, `100`/`200`) instead of the `bigint` literal:
  - `marshalling/bigint-insert-select-roundtrip`
    (`select.value-marshalling.test.ts`).
  - `aggregate-of-bigint-column-as-array`
    (`select.aggregate-as-array.value-type-coverage.test.ts`).
  - `aggregate-of-object-with-bigint-uuid-and-double` (same file).
- `marshalling/double-insert-select-roundtrip` stays live in every cell.

### MySQL — no INSERT/UPDATE/DELETE RETURNING

MySQL has no RETURNING clause, so the library does not type
`.returning({...})` / `.returningOneColumn(...)` on `MySqlConnection` at
all — a `// NOT-APPLICABLE:` dialect boundary, not something the server
might grow support for behind a callable API. The following tests are
commented out in `test/db/mysql/newest/mysql2/`:

- `docs.insert.test.ts`:
  - `docs:insert/insert-many-values`
  - `docs:insert/insert-returning`
  - `docs:insert/insert-multiple-with-shape`
  - `docs:insert-on-conflict/on-conflict-do-nothing`
  - `docs:insert-on-conflict/on-conflict-do-update`
  - `docs-extra:insert-on-conflict/on-conflict-do-update-bare`
  - `docs-extra:insert-on-conflict/values-for-insert-in-update`
  - `docs-extra:insert/insert-returning-one-column`
- `docs.update.test.ts`:
  - `docs-extra:update/update-returning`
  - `docs:update/returning-one-column`
- `docs.delete.test.ts`:
  - `docs:delete/delete-returning`
  - `docs-extra:delete/returning-one-column`

If a future MySQL version adds RETURNING **and the library types it on
`MySqlConnection`**, uncomment these tests in the existing `mysql2` cell
and add the same test bodies under the new `<version>/mysql2` and any new
connector cells. Until the type surface changes this stays a dialect
boundary, not an [`ENGINE_SUPPORT.md`](./ENGINE_SUPPORT.md) version gate.

### Oracle — no INSERT ... ON CONFLICT

Oracle has no equivalent of `INSERT ... ON CONFLICT DO NOTHING/UPDATE`.
The following tests are commented out in `test/db/oracle/newest/oracledb/`:

- `docs.insert.test.ts`:
  - `docs:insert-on-conflict/on-conflict-do-nothing`
  - `docs:insert-on-conflict/on-conflict-do-update`
  - `docs-extra:insert-on-conflict/on-conflict-do-update-bare`
  - `docs-extra:insert-on-conflict/values-for-insert-in-update`

If Oracle 23ai+ gains MERGE-based emulation that ts-sql-query maps to
the same fluent shape, uncomment these tests in the Oracle cells of
that version.

### Oracle — isolation level OR access mode, not both

`OracleConnection.isolationLevel(...)` accepts the isolation level
*or* the access mode but not both simultaneously. The
`docs:transaction/isolation-level` snippet from
`docs/queries/transaction.md` uses
`connection.isolationLevel('snapshot', 'read only')` and is
commented out in `test/db/oracle/newest/oracledb/docs.transaction.test.ts`.
When adding a new Oracle cell, either keep the test commented or write
a single-arg Oracle-friendly variant.

### SQL Server — no INSERT ... ON CONFLICT

Same list of commented tests as Oracle in `test/db/sqlserver/newest/mssql/docs.insert.test.ts`:

- `docs:insert-on-conflict/on-conflict-do-nothing`
- `docs:insert-on-conflict/on-conflict-do-update`
- `docs-extra:insert-on-conflict/on-conflict-do-update-bare`
- `docs-extra:insert-on-conflict/values-for-insert-in-update`

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

- `docs:insert-on-conflict/on-conflict-do-update`
- `docs-extra:insert-on-conflict/values-for-insert-in-update`

### PostgreSQL — targeted upsert required (no bare form)

PostgreSQL requires a target: `.onConflictOn(col).doUpdateSet({...})` or
`.onConflictOnConstraint(name).doUpdateSet({...})`. The bare
`.onConflictDoUpdateSet({...})` form is not typed on `PostgreSqlConnection`, so
the call doesn't compile, a `// NOT-APPLICABLE:` boundary with its negative in
the dialect's `types.negative/`. The following is commented out in every `test/db/postgres/*/<connector>/docs.insert.test.ts`:

- `docs-extra:insert-on-conflict/on-conflict-do-update-bare`

### SQLite — no `update returning old values`, no `delete using`

- `tTable.oldValues()` is only typed on PostgreSqlConnection,
  MariaDBConnection and SqlServerConnection. `docs-extra:update/update-returning-old-values`
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

A driver with a query runner in the public exports but no
`test/db/<db>/<version>/<connector>/` cell would be listed here; none is today.
Cells go one per driver, so a runner over the same driver as a cell has none of
its own: the single-connection `PgQueryRunner`, `MySql2QueryRunner`,
`MariaDBQueryRunner` and `OracleDBQueryRunner`, and the `*PoolPromise` twins
`MssqlPoolPromiseQueryRunner` and `OracleDBPoolPromiseQueryRunner`, are exercised
by the query-runner tests ([`RUNNER_TESTS.md`](./RUNNER_TESTS.md)). `extras/sync`
is covered by the `<connector>-sync` cells inside the main matrix
(`better-sqlite3-sync`, `bun_sqlite-sync`, `node_sqlite-sync`,
`sqlite-wasm-OO1-sync`).

When one is added to the main matrix:

1. Create the cell folder under the appropriate database following
   [`NEW_DATABASE.md`](./NEW_DATABASE.md).
2. Copy every `docs.*.test.ts` from a sibling cell (sqlite canonical
   is the cheapest source).
3. Run `bun run tests <db>/<version>/<connector> --update-snapshots`
   to bake per-cell SQL.
4. Triage compile errors → comment out the offending tests with the
   one-line reason. Cross-reference the dialect notes above so you
   don't re-discover constraints already characterised in another
   cell of the same database.
5. Run `bun run tests:audit` and `bun run validate:tests` before
   merging (tsc, one program per connector; a single whole-matrix program
   OOMs, >17 GB).

## Connection-subclass patterns and the `docs.*` tests

A handful of features documented in `docs/` require a custom `DBConnection`
subclass — they extend `transformValueFromDB` / `transformValueToDB` or expose
typed helper methods built with `buildFragmentWithArgs`. The shared domain
(`test/db/<db>/domain/connection.ts`) carries what the matrix covers of them, and
those tests live outside the `docs.*` files:

- **`buildFragmentWithArgs` / `buildFragmentWithArgsIfValue` / `buildFragmentWithMaybeOptionalArgs`**
  (docs/queries/sql-fragments.md, "Reusable fragments" /
  "Conditional fragments" / "Nullable fragments"). All three are
  `protected` on AbstractConnection; the domain's `DBConnection` exposes helpers
  built with them, covered by `fragments.with-args.test.ts`.
  `docs.sql-fragments.test.ts` keeps a TODO comment as the slot of the page's
  example.
- **Globally Encrypted ID (id-manipulation.md)** — needs a
  DBConnection subclass overriding `transformValueFromDB` /
  `transformValueToDB` and a per-table `ID_<prefix>` custom type.
  The `IDEncrypter` itself is exercised directly (`docs:id-manipulation/encrypter-with-prefix`,
  `docs-extra:id-manipulation/encrypter-prefix-disambiguates-tables`)
  to lock its round-trip contract.
- **createTableOrViewCustomization** (sql-fragments.md "Table or view
  customization") — defines alternative renderings for table
  references. Declared on the domain's `DBConnection`, covered by
  `select.table-customization.test.ts` and
  `select.table-customization-positions.test.ts`.

## "Could test more if real DB were on" assertions

A handful of tests check structural shape only (SQL+params+type)
because the value can't be locked in without docker / real WASM:

- `docs:insert/insert-one-set` — the real id is autogenerated; the
  mock returns the primed value, real returns whatever the engine
  picked. Pattern: `if (!ctx.realDbEnabled) expect(id).toBe(...)`.
- `docs-extra:select-page/extras-with-data-skips-data-query` — count is the
  primed value in mock mode, real `count(*)` in real-DB mode.
- `docs-extra:transaction/hooks-cleared-after-use` and similar hook
  tests — work in both modes, but only the side-effect counter is
  asserted.

When a new connector adds real-DB coverage, these tests should run
unchanged — there is no per-connector branching in the test body
itself; the `if (ctx.realDbEnabled)` switch already covers it.

## Operational checklist when adding a new connector or version

The end-to-end recipe lives in [`NEW_DATABASE.md`](./NEW_DATABASE.md) —
follow it rather than a copy that drifts. Two things it does **not**
cover, because they are this file's subject:

1. **Triage the compile errors against the "Dialect-specific notes"
   above.** A cell that matches the new dialect on commented-out tests
   usually points at the same typed narrowing; reuse its reason instead
   of re-deriving one.
2. **Re-check the [`ENGINE_SUPPORT.md`](./ENGINE_SUPPORT.md) entries for
   that engine and version.** A new version tier inherits every gate at
   or above its engine release — that is what decides which tests it can
   run at all.

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
- `docs/about/changelog/`, `docs/index.md` — meta.

`docs/advanced/synchronous-query-runners.md` is a feature page: its tests are
`docs.advanced.synchronous-query-runners.test.ts`, in every cell, and the sync
runners run in the `<connector>-sync` cells.
