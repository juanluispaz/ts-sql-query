# `test/` — adding a database, connector, or compatibility version

End-to-end tutorial. For day-to-day test writing see
[`WRITING_TESTS.md`](./WRITING_TESTS.md). For the tree convention every
database has to satisfy see [`PER_DATABASE_LAYOUT.md`](./PER_DATABASE_LAYOUT.md).

- [Adding a database](#adding-a-database)
- [Adding a connector](#adding-a-connector)
- [Adding a compatibility version](#adding-a-compatibility-version)
- [Mirror cells from EXTERNAL_CAVEATS](#mirror-cells-from-external_caveats)
- [Sync runners](#sync-runners)

## Adding a database

0. **Read the docs first.** Open
   `docs/configuration/supported-databases/<database>.md` for the
   compatibility ladder, the type mappings and any
   sequence/`RETURNING`/dialect quirks. Open every
   `docs/configuration/query-runners/recommended/<connector>.md` you plan
   to wire — that page gives you the runner class, the driver package, and
   the constructor signature.

1. **Create the database folder** `test/db/<database>/` with a `domain/`
   subfolder holding `connection.ts`, `schema.sql`, `seed.sql` (and `reset.sql`,
   the data-only reset, unless a full `schema.sql` + `seed.sql` reseed is cheap
   enough, as on SQLite) modelling the same project management domain. The domain is scoped to the
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
     `createContainerRegistry` in
     [`containerLifecycle.ts`](./lib/containerLifecycle.ts) for keep-alive +
     cross-process reuse, keyed by image; in-process WASM engines memoise the
     WASM heap per worker.
   - **Docker image** — a docker-backed engine gets an `ENGINE_IMAGES` entry in
     [`dockerImages.ts`](./lib/dockerImages.ts), with its `newest` image and one
     image per version folder. Read it through `newestImage` / `imageForCell`;
     never hardcode a tag. Its footprint goes in `ENGINE_MEMORY_GIB` in
     [`dockerPreflight.ts`](./lib/dockerPreflight.ts), and a new repository's
     prefix in [`tests-stop-containers.sh`](../scripts/tests-stop-containers.sh).
   - **Schema/seed revalidation** — hash schema + seed via `hashSqlFiles`
     (`containerLifecycle.ts`), store the hash in
     a per-engine meta DB, advisory-lock the validate+reset path so
     parallel workers don't race. Postgres example:
     `validateOrResetForReuse` in [`postgres/runners.ts`](./db/postgres/runners.ts).
   - **Per-worker DB naming** — use `workerName('tssqlquery')` /
     `workerName('tsapp')` (Oracle), from `containerLifecycle.ts`.
   - **Reseed** — implement `onReseed(runner)` to restore the seeded baseline
     (`reset.sql` + `seed.sql`) against the runner's native handle (postgres
     example dispatches on feature detection: `.exec` for PGlite, `.unsafe` for
     postgres.js / bun:sql, `.query` for pg.Pool).
   - **`isRealDbEnabled`** — call
     `isRealDbEnabled(DATABASE, requires, version?, connector?)` from
     [`backends.ts`](./lib/backends.ts) with the connector's `RealDbBackend` ('docker' | 'wasm' | 'native')
     and the version derived from `spec.label`.

   Outside `test/db/`, the database's name also goes in the `databases` list of
   [`validate-tests.sh`](../scripts/validate-tests.sh), and its query runners get
   tests under `test/runners/<database>/` — see
   [`RUNNER_TESTS.md` § Adding a runner](./RUNNER_TESTS.md#adding-a-runner).

3. **Create `test/db/<database>/types.negative/`** with at least one file
   (compile-time only). See
   [`WRITING_TESTS.md` § Negative type tests](./WRITING_TESTS.md#negative-type-tests).

4. **Create one folder per documented compatibility zone**: `newest/`, the
   literal numeric value for each docs breakpoint except the highest (it emits
   the same SQL as `newest`, which covers it), and `oldest/`. Naming
   per [`PER_DATABASE_LAYOUT.md` § `<version>/`](./PER_DATABASE_LAYOUT.md#version--compatibility-version-folders).

5. **For each connector valid for that version**, create
   `test/db/<database>/<version>/<connector>/setup.ts` calling the
   appropriate factory. See
   [`PER_DATABASE_LAYOUT.md` § `<connector>/setup.ts`](./PER_DATABASE_LAYOUT.md#connectorsetupts--the-cell-entry).

6. **Copy the test file set of any existing cell**
   (`select.basic.test.ts`, `insert.returning.test.ts`,
   `docs.<page>.test.ts`, …) — same file names, same `describe`/`test`
   names. The sqlite canonical (`test/db/sqlite/newest/bun_sqlite/`) is the
   cheapest source.

7. **Bake snapshots**: `bun run tests <database> --update-snapshots`.

8. **Triage compile errors** against the catalogue in
   [`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md) — most dialect
   restrictions are already characterised in another cell of the same
   database. Comment out the offending tests per
   [`DESIGN.md` § Symmetry rule](./DESIGN.md#symmetry-rule), with the
   **full canonical body** kept inside `/* */` per
   [`DESIGN.md` § Full-canonical-body discipline](./DESIGN.md#full-canonical-body).
   To browse the existing caveat shape across the matrix (the wrap
   header conventions you'll mirror), use
   `bun run tests:where-is --search <api> --cell-caveats summary` for
   the per-cell map, or `--coord '<sibling-db>'` to raise it to the
   markers themselves in that db's cells.

9. **Run the validations**:

   ```bash
   bun run tests:audit          -- # symmetry ✓
   bun run validate:tests:newest        # fast typecheck — single tsc program over the newest cells (roughly 14 GB RAM)
   bun run validate:tests               # authoritative typecheck — CI gates this (tsc, one program per connector, roughly 8 GB peak)
   bun run tests                -- # no docker, fast sanity check
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
   each valid `(version × connector)` combination. A connector tied to one
   engine version still gets a cell at every version folder: PGlite bundles
   PostgreSQL 18, and its `oldest/` cell runs the library's compatibility mode
   against that engine.

3. **Add a factory in `test/db/<database>/runners.ts`** if the connector
   needs different wiring than the existing factories (e.g. a Bun-only
   connector needs runtime detection; an in-process WASM connector needs
   different `realDbEnabled` gating). Otherwise reuse the existing factory
   with a new `setup.ts`.

4. **Set up `setup.ts`** calling the factory.

   A WASM or embedded connector also needs its folder name in
   `WASM_CONNECTOR_NAMES` or `NATIVE_CONNECTOR_NAMES` in
   [`_test-common.sh`](../scripts/_test-common.sh), with any `-sync` twin, in step
   with the `RealDbBackend` it passes to `isRealDbEnabled`. A docker connector
   needs no edit there: `docker` is whatever is in neither list.

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

8. **Runner tests.** Add `test/runners/<database>/<Runner>.test.ts` — see
   [`RUNNER_TESTS.md` § Adding a runner](./RUNNER_TESTS.md#adding-a-runner).

9. **Audit + typecheck + tests** — same as step 9 above.

## Adding a compatibility version

A new `<compatibilityVersion>` folder under an existing database:

1. **Confirm the breakpoint exists** in
   `docs/configuration/supported-databases/<database>.md`. The highest documented
   breakpoint gets no folder: it emits the same SQL as `newest`.

2. **Create the folder** with the literal numeric value as its name (e.g.
   `10_005_000`, `8_000_017`). Underscores per JS numeric literal
   convention. On a docker-backed engine, check that the folder has its image in
   `ENGINE_IMAGES` — see
   [`ENGINE_LIFECYCLE.md` § Adding a version tier](./ENGINE_LIFECYCLE.md#adding-a-version-tier--the-maintenance-step).

3. **Create `<connector>/setup.ts`** for every connector that's valid for
   this version. The `setup.ts` pins
   `compatibilityVersion: <the-literal-value>`.

4. **Copy the test set** from a sibling version (`newest/` is the
   superset; copying from there and then commenting out anything not
   typed at this older version usually works). To see which APIs are
   gated by `compatibilityVersion` and at which breakpoints, use
   `bun run tests:where-is --search <api> --for version-work` — the
   preset bundles `version-gates full · tests summary · not-supported full ·
   bugs · limitation · not-applicable · mock-only · chain none`, so a single
   call shows the breakpoints that apply to the method, the existing coverage
   per db, and any markers naming it (the most common version-gated case: a
   `// NOT-SUPPORTED` declaring that the engine needs version X or later). Handy when planning step 6's triage. See
   [`CODE_SEARCH.md`](./CODE_SEARCH.md) for the full preset map.

5. **Bake snapshots** — the SqlBuilder branches on `compatibilityVersion`,
   so each cell emits its own SQL. The snapshot recipe is the same:
   `bun run tests <db>/<new-version> --update-snapshots`.

6. **Triage compile errors** as for a new connector.

7. **Audit + typecheck + tests**.

8. **Real-validate each new cell** on an engine of its version:
   `bun run tests '<db>/<new-version>/<connector>' --docker --docker-version closest`
   (one connector at a time; `--wasm` for the WASM cells). Classify each real
   failure by its cause before marking it (see
   [`LIMITATIONS.md` § The decision rule](./LIMITATIONS.md#the-decision-rule)).

## Mirror cells from EXTERNAL_CAVEATS

When wiring a new database, connector or version, the dialect-specific
notes in [`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md) tell you which
tests are commented out in similar cells of other databases. Use them as a
checklist to avoid re-discovering constraints already characterised
elsewhere:

- `bun_sql_sqlite` cannot register `uuid_str`, so its `'uuid-extension'` tests
  stay mock-only.
- MySQL has no `INSERT/UPDATE/DELETE RETURNING`.
- Oracle has no `ON CONFLICT`; isolation level OR access mode, not both.
- SQL Server has no `ON CONFLICT`; `isolationLevel(level)` only, no
  access mode.
- MariaDB exposes only the bare `.onConflictDoUpdateSet({...})` form.
- PostgreSQL requires `.onConflictOn(col).doUpdateSet({...})` — the bare
  form is commented out in every postgres cell.
- SQLite has no `tTable.oldValues()`, no `deleteFrom(...).using(...)`, no
  `isolationLevel(...)`.

When propagating tests across cells, the catalog above is what
[`COVERAGE_RUNBOOK.md` § EXTERNAL_CAVEATS sweep](./COVERAGE_RUNBOOK.md)
asks the validation sub-agent to re-check post-propagation.

## Sync runners

Synchronous query runners are ordinary cells of the matrix: a
`<connector>-sync` folder next to its async twin (`better-sqlite3-sync`,
`bun_sqlite-sync`, `node_sqlite-sync`, `sqlite-wasm-OO1-sync`). They follow the
[symmetry rule](./DESIGN.md#symmetry-rule) like any other cell: same files, same
test names, same order, same SQL, params and values. Only the execution style
differs: the runner and the mock resolve through `SynchronousPromise`, so a query
is unwrapped with the `sync(...)` helper instead of `await`. See
`docs/advanced/synchronous-query-runners.md`.

To add a `-sync` twin of an existing connector:

1. Add a `create<Connector>SyncTestContext` factory to `runners.ts` that drives
   the async factory in synchronous mode.
2. Create the `<connector>-sync/` folder at every version folder, with a
   `setup.ts` calling it and the test set of the async twin, unwrapped with
   `sync(...)`.
3. Add the folder name to the list of its twin in
   [`_test-common.sh`](../scripts/_test-common.sh) (`WASM_CONNECTOR_NAMES` or
   `NATIVE_CONNECTOR_NAMES`).
