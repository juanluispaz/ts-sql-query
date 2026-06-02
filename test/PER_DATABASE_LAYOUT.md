# `test/db/` — per-database tree convention

What every `test/db/<database>/` folder contains, how the `(version × connector)`
cells are organised inside it, and the contract that every `runners.ts` and
`domain/` triplet has to satisfy. Reference, not tutorial — for "add a new
database" walk through [`NEW_DATABASE.md`](./NEW_DATABASE.md).

For the test-time infrastructure each cell depends on (`ctx`, mutation
safety, capture, runtime shim) see [`TEST_LIB.md`](./TEST_LIB.md). For the
shared lifecycle of docker / WASM engines see
[`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md).

- [The tree](#the-tree)
- [`domain/` — schema, seed, connection](#domain--schema-seed-connection)
- [`runners.ts` — per-connector context factories](#runnersts--per-connector-context-factories)
- [`<version>/` — compatibility-version folders](#version--compatibility-version-folders)
- [`<connector>/setup.ts` — the cell entry](#connectorsetupts--the-cell-entry)
- [`<connector>/*.test.ts` — the cell tests](#connectortestts--the-cell-tests)
- [`types.negative/` — compile-time negatives](#typesnegative--compile-time-negatives)

## The tree

```
test/db/<database>/
├── domain/                     ← schema, seed, DBConnection — shared across cells
│   ├── connection.ts
│   ├── schema.sql
│   └── seed.sql
├── runners.ts                  ← per-connector createXxxTestContext factories
├── types.negative/             ← compile-time negative tests at the DB root
│   ├── select.test.ts
│   └── …
└── <version>/<connector>/      ← one cell per (version × connector)
    ├── setup.ts                ← exports `ctx`
    ├── select.basic.test.ts
    ├── insert.returning.test.ts
    └── docs.<page>.test.ts
```

Three rules from [`DESIGN.md`](./DESIGN.md):

1. **One container per database, modern image only.** All
   `<version>/<connector>/` cells share the same shared engine instance,
   wired through `runners.ts`. Older `<compatibilityVersion>` cells emit
   legacy SQL the modern server still accepts.
2. **Connector × version compatibility is per-cell.** Folders for invalid
   combinations (e.g. `postgres/newest/pglite/`, which would need a pglite
   running PG18+ that does not exist yet) simply do not exist.
3. **Symmetry**: every cell of a database contains the same `.test.ts` files
   with the same `test(...)` names in the same order. The audit
   ([`tests:audit`](./TEST_LIB.md#audittestsymmetryts--the-symmetry-audit))
   enforces this — comment out non-applicable tests, do not delete them.

## `domain/` — schema, seed, connection

One per database. Three files, all sharing the same project-management
domain (`organization`, `app_user`, `project`, `issue`, …):

| File | Contract |
|---|---|
| `schema.sql` | Raw DDL applied per-container. Multi-statement allowed (every runner has a path that accepts it — see [`reseedAgainstNativePostgresHandle` for an example](./db/postgres/runners.ts#L251)). Dialect-appropriate types and `DEFAULT` clauses; tests that don't enumerate a defaulted column rely on this. |
| `seed.sql` | Canonical fixture rows, explicit values per row so tests have something concrete to assert. Multi-statement. |
| `connection.ts` | One `DBConnection extends <DialectName>Connection` subclass declaring tables, views, procedures, functions, typed fragments. The **only** sanctioned `DBConnection` users — tests must not construct their own runner or `new DBConnection(...)`; they go through the factories in `runners.ts`. |

Example connection skeleton (lifted from
[`test/db/postgres/domain/connection.ts`](./db/postgres/domain/connection.ts)):

```ts
export class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    constructor(queryRunner: QueryRunner, compatibilityVersion?: number) {
        super(queryRunner)
        if (compatibilityVersion !== undefined) {
            this.compatibilityVersion = compatibilityVersion
        }
    }

    // Public wrappers around protected executeProcedure / executeFunction —
    // the documented pattern is one domain method per callable.
    callRefreshStats(): Promise<void> { /* … */ }

    // Reusable typed SQL fragments — exercised by fragments.with-args.test.ts.
    intLeftShift = this.buildFragmentWithArgs(/* … */)
}
```

Tables, views, type adapters live alongside the class in the same file.

**Extending the shared domain** (new column, new table, new
`CustomBooleanTypeAdapter`) is a six-database lockstep operation — see
[`WRITING_TESTS.md` § Extending the shared domain](./WRITING_TESTS.md#extending-the-shared-domain).

## `runners.ts` — per-connector context factories

One file per database. Exports **one factory function per connector** that
returns a `TestContext<DBConnection>`. Each factory wires:

- The connector's `QueryRunner` (`PgPoolQueryRunner`, `PgLiteQueryRunner`,
  `BunSqlPostgresQueryRunner`, …).
- The container handle (docker) or in-process bootstrap (WASM, native).
- The `realDbEnabled` decision via
  [`isRealDbEnabled(database, requires, version?, connector?)`](./lib/backends.ts#L105).
- Optional `mockRunnerClass` for connector-specialised mocks
  ([`mockRunners/`](./lib/mockRunners/README.md)).
- `onReseed` (re-apply schema+seed against the runner's native handle).

Canonical pattern (excerpt from
[`test/db/postgres/runners.ts:332-362`](./db/postgres/runners.ts#L332-L362)):

```ts
export function createPgTestContext(spec: PgTestSpec): PostgresTestContext {
    const version = spec.label.split(' / ')[0] ?? ''
    const connector = spec.label.split(' / ')[1] ?? ''
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ true, version, connector)
    const buildRunner = memoizeSharedRunner(spec.createRealRunner)

    return decoratePostgresContext(createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'postgreSql',
        realDbEnabled,
        async createRealRunner() {
            const container = await acquireContainer()
            const workerUri = await bootstrapWorkerDbSchemaAndSeed(
                container.getConnectionUri(),
            )
            return await buildRunner(workerUri)
        },
        onReseed: reseedAgainstNativePostgresHandle,
        async onDown() { await releaseContainer() },
        buildConnection: (interceptor, compatibilityVersion) =>
            new DBConnection(interceptor, compatibilityVersion),
    }))
}
```

Three factories live side-by-side in
[`test/db/postgres/runners.ts`](./db/postgres/runners.ts) — one for
docker-backed pg/postgres (`createPgTestContext`), one for in-process pglite
(`createPgLiteTestContext`), one for the Bun-only `bun:sql` (`createBunSqlPostgresTestContext`).
Same shape, different `RealDbBackend` and `createRealRunner` body.

Some `runners.ts` also expose a `PostgresTestContext` interface that extends
`TestContext<DBConnection>` with helpers (e.g.
[`withInsensitiveCollation(collation)`](./db/postgres/runners.ts#L62)) for
tests that need to vary a `DBConnection` field per-test. The decorator
([`decoratePostgresContext`](./db/postgres/runners.ts#L72)) shares the
underlying interceptor, so SQL emitted by the alt connection still lands in
`ctx.lastSql`.

What lives at module scope in `runners.ts`:

- The `createContainerHandle` instance (docker engines).
- Schema/seed loaders memoised once per worker (`ensureSchemaAndSeedLoaded`,
  `pgliteSharedDb` for WASM, etc.).
- The `validateOrResetForReuse` function that hashes schema+seed and resets
  worker DBs when content changed (see
  [`ENGINE_LIFECYCLE.md` § Schema/seed change revalidation](./ENGINE_LIFECYCLE.md#schema--seed-change-revalidation)).
- Native-handle reseed adapter (`reseedAgainstNativePostgresHandle` /
  equivalent) — dispatches per driver shape because the factories serve
  multiple connectors.

## `<version>/` — compatibility-version folders

| Folder name | Pinned `compatibilityVersion` |
|---|---|
| `newest/` | `Number.POSITIVE_INFINITY` (library default) |
| `<literal>/` | The literal numeric value of a documented breakpoint (e.g. `13_000_001`, `10_005_000`) |
| `oldest/` | A representative value below the lowest documented breakpoint (e.g. `17_000_000`) |

The two named bookends exist because the docs don't give a number for them:
the default is `Number.POSITIVE_INFINITY` (no clean filename), and the
lowest zone is described as `< X`. Every other folder uses the literal
value as its name.

The breakpoints come from
[`docs/configuration/supported-databases/<database>.md`](../docs/configuration/supported-databases/);
test folder names must come from that file.

## `<connector>/setup.ts` — the cell entry

Thin file. Calls the matching factory in `runners.ts`, marks the canonical
cell, exports `ctx`:

```ts
// test/db/postgres/newest/pg/setup.ts
import { Pool } from 'pg'
import { PgPoolQueryRunner } from '../../../../../src/queryRunners/PgPoolQueryRunner.js'
import { createPgTestContext } from '../../runners.js'

export const ctx = createPgTestContext({
    label: 'newest / pg',
    canonicalForDocs: true,            // exactly one cell per DB sets this
    createRealRunner: async (uri) => {
        const pool = new Pool({ connectionString: uri })
        return {
            runner: new PgPoolQueryRunner(pool),
            shutdown: () => pool.end(),
        }
    },
})
```

Rules:

- Exactly one cell per database flags `canonicalForDocs: true`. The docs
  scraper publishes from that one.
- `label` is `"<version> / <connector>"`. The audit and the docker-scope
  gating both parse it.
- `compatibilityVersion` is pinned for every non-`newest` cell.

Today's canonical cells per database:

| Database | Canonical (`canonicalForDocs: true`) |
|---|---|
| mariadb | `newest/mariadb` |
| mysql | `newest/mysql2` |
| oracle | `newest/oracledb` |
| postgres | `newest/pg` |
| sqlite | `newest/bun_sqlite` |
| sqlserver | `newest/mssql` |

**Exception — `documentation/` connector.** Each database (plus a synthetic
`general` db) also carries a `newest/documentation/` cell holding the SQL tests
the doc-code extractor produces from `docs/*.md`. Its files are
`*.generated.test.ts` (gitignored, regenerated by `bun run codegen:doc-code`); no
hand-written `setup.ts` or `*.test.ts` lives there. The symmetry audit ignores
this connector and the `general` db by name. See
[`DOC_CODE_EXTRACTOR.md`](./DOC_CODE_EXTRACTOR.md).

## `<connector>/*.test.ts` — the cell tests

The test files. Same names, same `describe` / `test` names, same order
across every cell (the symmetry rule). The anatomy of one file is in
[`WRITING_TESTS.md` § Anatomy](./WRITING_TESTS.md#anatomy-of-a-test-file).

Naming convention:

| Family | Examples |
|---|---|
| Domain-feature tests | `select.basic.test.ts`, `insert.returning.test.ts`, `update.basic.test.ts`, `delete.execute-variants.test.ts` |
| Error / processing tests | `errors.processing.test.ts`, `errors.transaction-attachments.test.ts` |
| Fragment / composition | `fragments.with-args.test.ts`, `raw-fragment.*.test.ts`, `with-values.*.test.ts` |
| Dynamic queries | `dynamic-condition.*.test.ts` |
| Customize hooks | `customize-query.*.test.ts`, `customize-query.insert.test.ts` |
| Docs snippets | `docs.<page>.test.ts`, `docs.advanced.<page>.test.ts` (mirrored to every cell; one cell publishes — see `canonicalForDocs`) |
| Postgres-specific (etc.) | `select.postgres-const-force-type-cast.test.ts` lives only under postgres |

## `types.negative/` — compile-time negatives

```
test/db/<database>/types.negative/
├── select.test.ts
├── insert.test.ts
└── …
```

Lives at the **database root**, NOT per-version. TS restrictions enforced by
ts-sql-query are dialect-wide; a `compatibilityVersion` change must not
loosen or tighten them.

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

- Body of `_typeNegatives` is **never invoked**. Wrapping it in a function
  keeps `tsc` honest while preventing the throw paths inside ts-sql-query
  from firing.
- Each `// @ts-expect-error` MUST be paired with a one-line comment naming
  the rule it enforces. Without the comment, the directive is rejected at
  review time.
- `bun run validate:tests` (or `validate:tests:tsgo`) is the real assertion.
  If a directive becomes "unused", the build fails with the canonical
  message — exactly the regression signal we want.
- The `types.negative/` folder is **not** part of the cell matrix and is
  skipped by `tests:audit`.

For the tsgo / tsc divergence story (where to place directives, how to add
files to the tsc exclude list) see
[`WRITING_TESTS.md` § Handling tsgo / tsc divergences](./WRITING_TESTS.md#handling-tsgo--tsc-divergences).
