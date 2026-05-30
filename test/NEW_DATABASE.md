# `test/` — adding a database, connector, or compatibility version

End-to-end tutorial. For day-to-day test writing see
[`WRITING_TESTS.md`](./WRITING_TESTS.md). For the tree convention every
database has to satisfy see [`PER_DATABASE_LAYOUT.md`](./PER_DATABASE_LAYOUT.md).

- [Adding a database](#adding-a-database)
- [Adding a connector](#adding-a-connector)
- [Adding a compatibility version](#adding-a-compatibility-version)
- [Mirror cells from EXTERNAL_CAVEATS](#mirror-cells-from-external_caveats)
- [Prisma and sync runners](#prisma-and-sync-runners)

## Adding a database

0. **Read the docs first.** Open
   `docs/configuration/supported-databases/<database>.md` for the
   compatibility ladder, the type mappings and any
   sequence/`RETURNING`/dialect quirks. Open every
   `docs/configuration/query-runners/recommended/<connector>.md` you plan
   to wire — that page gives you the runner class, the driver package, and
   the constructor signature.

1. **Create the database folder** `test/db/<database>/` with a `domain/`
   subfolder holding `connection.ts`, `schema.sql`, `seed.sql` modelling
   the same project management domain. The domain is scoped to the
   database; if a second database happens to share the dialect, it gets
   its own copy (symmetry over sharing). See
   [`PER_DATABASE_LAYOUT.md` § `domain/`](./PER_DATABASE_LAYOUT.md#domain--schema-seed-connection).

2. **Create `test/db/<database>/runners.ts`** exposing one factory per
   engine shape (real-DB via testcontainers, in-process, …). Each factory
   wires the connector's runner into `createTestContext(...)` and returns
   a `TestContext`. See
   [`PER_DATABASE_LAYOUT.md` § `runners.ts`](./PER_DATABASE_LAYOUT.md#runnersts--per-connector-context-factories)
   and the postgres example at
   [`test/db/postgres/runners.ts`](./db/postgres/runners.ts).

   Things to consider while wiring:

   - **Container vs in-process** — docker-backed engines reach
     [`createContainerHandle`](./lib/containerLifecycle.ts#L257) for
     keep-alive + cross-process reuse; in-process WASM engines memoise the
     WASM heap per worker.
   - **Schema/seed revalidation** — hash schema + seed via
     [`hashSqlFiles`](./lib/containerLifecycle.ts#L189), store the hash in
     a per-engine meta DB, advisory-lock the validate+reset path so
     parallel workers don't race. Postgres example:
     [`validateOrResetForReuse`](./db/postgres/runners.ts#L127).
   - **Per-worker DB naming** — use
     [`workerName('tssqlquery')`](./lib/containerLifecycle.ts#L114) /
     `workerName('tsapp')` (Oracle).
   - **Reseed** — implement `onReseed(runner)` to re-apply schema+seed
     against the runner's native handle (postgres example dispatches on
     feature detection: `.exec` for PGlite, `.unsafe` for postgres.js /
     bun:sql, `.query` for pg.Pool).
   - **`isRealDbEnabled`** — call
     [`isRealDbEnabled(DATABASE, requires, version?)`](./lib/backends.ts#L105)
     with the connector's `RealDbBackend` ('docker' | 'wasm' | 'native')
     and the version derived from `spec.label`.

3. **Create `test/db/<database>/types.negative/`** with at least one file
   (compile-time only). See
   [`WRITING_TESTS.md` § Negative type tests](./WRITING_TESTS.md#negative-type-tests).

4. **Create one folder per documented compatibility zone**: `newest/`, the
   literal numeric value for each docs breakpoint, and `oldest/`. Naming
   per [`PER_DATABASE_LAYOUT.md` § `<version>/`](./PER_DATABASE_LAYOUT.md#version--compatibility-version-folders).

5. **For each connector valid for that version**, create
   `test/db/<database>/<version>/<connector>/setup.ts` calling the
   appropriate factory. Mark **exactly one** cell per database
   `canonicalForDocs: true`. See
   [`PER_DATABASE_LAYOUT.md` § `<connector>/setup.ts`](./PER_DATABASE_LAYOUT.md#connectorsetupts--the-cell-entry).

6. **Copy the test file set of any existing cell**
   (`select.basic.test.ts`, `insert.returning.test.ts`,
   `docs.<page>.test.ts`, …) — same file names, same `describe`/`test`
   names. The sqlite canonical (`test/db/sqlite/newest/bun_sqlite/`) is the
   cheapest source.

7. **Bake snapshots**: `bun run tests test/db/<database> --update-snapshots`.

8. **Triage compile errors** against the catalogue in
   [`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md) — most dialect
   restrictions are already characterised in another cell of the same
   database. Comment out the offending tests per
   [`DESIGN.md` § Symmetry rule](./DESIGN.md#symmetry-rule), with the
   **full canonical body** kept inside `/* */` per
   [`DESIGN.md` § Full-canonical-body discipline](./DESIGN.md#full-canonical-body).

9. **Run the validations**:

   ```bash
   bun run tests:audit          # symmetry ✓
   bun run validate:tests:tsgo  # fast typecheck
   bun run validate:tests       # authoritative typecheck (CI runs both)
   bun run validate:tests:tsc   # the sub-experience (CI runs this too)
   bun run tests                # no docker, fast sanity check
   bun run tests --docker --wasm  # full real matrix (Docker required)
   ```

10. **Re-run with `npm run`** to exercise the vitest path — same script
    entries, runner switches based on `npm_config_user_agent`. All four
    runs must be green.

## Adding a connector

A new connector under an existing database is a smaller version of the
above:

1. **Read the connector's docs page** in
   `docs/configuration/query-runners/recommended/<connector>.md` — runner
   class, driver package, constructor signature.

2. **Create the folder**: `test/db/<database>/<version>/<connector>/` for
   each valid `(version × connector)` combination. Not every combination
   needs to exist (e.g. PgLite only under `oldest/`, not `newest/`).

3. **Add a factory in `test/db/<database>/runners.ts`** if the connector
   needs different wiring than the existing factories (e.g. a Bun-only
   connector needs runtime detection; an in-process WASM connector needs
   different `realDbEnabled` gating). Otherwise reuse the existing factory
   with a new `setup.ts`.

4. **Set up `setup.ts`** calling the factory.

5. **Copy the test set** from a sibling cell. Run snapshot bake.

6. **Triage compile errors against `EXTERNAL_CAVEATS.md`.** If the
   connector adds a new caveat that's not already documented, add it as a
   subsection of
   [`EXTERNAL_CAVEATS.md` § Dialect-specific notes](./EXTERNAL_CAVEATS.md).

7. **Specialised mock?** If the connector's real runner applies an
   observable transformation in `addParam` (or `addOutParam`, or any
   `execute*`) that the generic `MockQueryRunner` doesn't replicate, add a
   sibling under `test/lib/mockRunners/` and wire it via the
   `mockRunnerClass` option in the factory. See
   [`test/lib/mockRunners/README.md`](./lib/mockRunners/README.md) for the
   convention.

8. **Audit + typecheck + tests** — same as step 9 above.

## Adding a compatibility version

A new `<compatibilityVersion>` folder under an existing database:

1. **Confirm the breakpoint exists** in
   `docs/configuration/supported-databases/<database>.md`.

2. **Create the folder** with the literal numeric value as its name (e.g.
   `13_000_001`, `10_005_000`). Underscores per JS numeric literal
   convention.

3. **Create `<connector>/setup.ts`** for every connector that's valid for
   this version. The `setup.ts` pins
   `compatibilityVersion: <the-literal-value>`.

4. **Copy the test set** from a sibling version (`newest/` is the
   superset; copying from there and then commenting out anything not
   typed at this older version usually works).

5. **Bake snapshots** — the SqlBuilder branches on `compatibilityVersion`,
   so each cell emits its own SQL. The snapshot recipe is the same:
   `bun run tests test/db/<db>/<new-version> --update-snapshots`.

6. **Triage compile errors** as for a new connector.

7. **Audit + typecheck + tests**.

## Mirror cells from EXTERNAL_CAVEATS

When wiring a new database, connector or version, the dialect-specific
notes in [`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md) tell you which
tests are commented out in similar cells of other databases. Use them as a
checklist to avoid re-discovering constraints already characterised
elsewhere:

- `sqlite3` cannot bind `BigInt`; sqlite-wasm-OO1 has no `uuid_str`
  function.
- MySQL has no `INSERT/UPDATE/DELETE RETURNING`.
- Oracle has no `ON CONFLICT`; isolation level OR access mode, not both.
- SQL Server has no `ON CONFLICT`; `isolationLevel(level)` only, no
  access mode.
- MariaDB exposes only the bare `.onConflictDoUpdateSet({...})` form.
- PostgreSQL requires `.onConflictOn(col).doUpdateSet({...})` — the bare
  form is commented out in every postgres cell.
- SQLite has no `tTable.oldValues()`, no `deleteFrom(...).using(...)`, no
  `isolationLevel(...)`.
- `bun_sql_postgres` mis-serialises `Date` parameters (Bun#29010).

When propagating tests across cells, the catalog above is what
[`COVERAGE_RUNBOOK.md` § EXTERNAL_CAVEATS sweep](./COVERAGE_RUNBOOK.md)
asks the validation sub-agent to re-check post-propagation.

## Prisma and sync runners

Prisma support in ts-sql-query is experimental. It lives in its own
sub-tree (sketched as `test/db/<database>/<version>/prisma/`) with
deliberately minimal coverage — enough to verify the integration works,
not to exhaustively re-test the SQL surface (which the per-driver
connectors already cover).

Synchronous query runners (and the `extras/sync` helper) live in their own
tree for the same reason: their runtime semantics differ enough that mixing
them into the main matrix would force every async-shaped test to grow
conditional paths. A light mirror set proves the sync path is wired
correctly.

**Do not block PRs on Prisma or sync parity** unless the PR is specifically
about those subsystems.
