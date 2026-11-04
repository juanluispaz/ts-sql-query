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
│   ├── seed.sql
│   └── reset.sql               ← data-only reset for the per-test reseed (not in sqlite)
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

1. **One container per database by default, at the `newest` image.** All
   `<version>/<connector>/` cells share the same shared engine instance,
   wired through `runners.ts`. Older `<compatibilityVersion>` cells emit
   legacy SQL the modern server still accepts. `--docker-version closest` runs
   a cell against its own version folder's image instead (`ENGINE_IMAGES` in
   [`dockerImages.ts`](./lib/dockerImages.ts)).
2. **Connector × version compatibility is per-cell.** Folders for invalid
   combinations simply do not exist.
3. **Symmetry**: every cell of the **whole matrix** (all databases × versions ×
   connectors, not just one database) contains the same `.test.ts` files with the
   same `test(...)` names in the same order. The audit
   ([`tests:audit`](./TESTS_AUDIT.md))
   enforces this — comment out non-applicable tests (with a `// NOT-APPLICABLE:` / `// NOT-SUPPORTED:` /
   `// TODO[*]:` marker), do not delete them. Exempt from the comparison:
   `config.*` files (connection-config-specific), `*.generated.test.ts`, and files
   whose name embeds a database name (`select.postgres-const-force-type-cast.test.ts`).

## `domain/` — schema, seed, connection

One per database. These files all share the same project-management
domain (`organization`, `app_user`, `project`, `issue`, …):

| File | Contract |
|---|---|
| `schema.sql` | Raw DDL applied at the once-per-worker bootstrap. Multi-statement allowed (every runner has a path that accepts it — see `reseedAgainstNativePostgresHandle` in [`postgres/runners.ts`](./db/postgres/runners.ts) for an example). Dialect-appropriate types and `DEFAULT` clauses; tests that don't enumerate a defaulted column rely on this. |
| `seed.sql` | Canonical fixture rows, explicit values per row so tests have something concrete to assert. Multi-statement. |
| `reset.sql` | Data-only reset for the per-test reseed: `TRUNCATE`/`DELETE` plus identity/sequence rewind, no `DROP`/`CREATE`, so with `seed.sql` it leaves the state a fresh `schema.sql` + `seed.sql` would. SQLite has none: its reseed re-applies `schema.sql` + `seed.sql`. |
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
  `isRealDbEnabled(database, requires, version?, connector?)` in
  [`backends.ts`](./lib/backends.ts).
- Optional `mockRunnerClass` for connector-specialised mocks
  ([`mockRunners/`](./lib/mockRunners/README.md)).
- `onReseed` (restore the seeded baseline against the runner's native handle:
  `reset.sql` + `seed.sql`, or `schema.sql` + `seed.sql` on SQLite).

Canonical pattern (trimmed from `createPgTestContext` in
[`test/db/postgres/runners.ts`](./db/postgres/runners.ts)):

```ts
export function createPgTestContext(spec: PgTestSpec): PostgresTestContext {
    const version = spec.label.split(' / ')[0] ?? ''
    const connector = spec.label.split(' / ')[1] ?? ''
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ true, version, connector)
    // The `newest` image by default; this cell's own folder image under `--docker-version closest`.
    const image = imageForCell(DATABASE, version, realDbEnabled)
    const buildRunner = memoizeSharedRunner(spec.createRealRunner)

    return decoratePostgresContext(createTestContext<DBConnection>({
        label: spec.label,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'postgreSql',
        realDbEnabled,
        async createRealRunner(forceNew = false) {
            const container = await containers.getFor(image).acquire()
            const workerUri = await bootstrapWorkerDbSchemaAndSeed(container.getConnectionUri())
            return await buildRunner(workerUri, forceNew)
        },
        onReseed: reseedAgainstNativePostgresHandle,
        async onDown() { await containers.getFor(image).release() },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    }), /* … */)
}
```

Three factories live side-by-side in
[`test/db/postgres/runners.ts`](./db/postgres/runners.ts) — one for
docker-backed pg/postgres (`createPgTestContext`), one for in-process pglite
(`createPgLiteTestContext`), one for the Bun-only `bun:sql` (`createBunSqlPostgresTestContext`).
Same shape, different `RealDbBackend` and `createRealRunner` body.

Some `runners.ts` also expose a `PostgresTestContext` interface that extends
`TestContext<DBConnection>` with helpers (e.g. `withInsensitiveCollation(collation)`)
for tests that need to vary a `DBConnection` field per-test. The decorator
(`decoratePostgresContext`) shares the underlying interceptor, so SQL emitted by the alt connection still lands in
`ctx.lastSql`.

What lives at module scope in `runners.ts`:

- The `createContainerRegistry` instance (docker engines): one keep-alive handle
  per image, so a default run keeps one container and a `closest` run can bring
  up an older image as a separate one.
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
| `<literal>/` | The literal numeric value of a documented breakpoint, except the highest (e.g. `10_005_000`, `8_000_017`) |
| `oldest/` | A representative value below the lowest documented breakpoint (e.g. `17_000_000`) |

The two named bookends exist because the docs don't give a number for them:
the default is `Number.POSITIVE_INFINITY` (no clean filename), and the
lowest zone is described as `< X`. Every other folder uses the literal
value as its name. The highest documented breakpoint has no folder of its own:
at that value the library emits the same SQL as at `newest`, which covers it.

The breakpoints come from
[`docs/configuration/supported-databases/<database>.md`](../docs/configuration/supported-databases/);
test folder names must come from that file.

## `<connector>/setup.ts` — the cell entry

Thin file. Calls the matching factory in `runners.ts`, exports `ctx`:

```ts
// test/db/postgres/newest/pg/setup.ts (trimmed)
import { Pool } from 'pg'
import { createPgTestContext } from '../../runners.js'
import { PgPoolQueryRunner } from '../../../../../src/queryRunners/PgPoolQueryRunner.js'

export const ctx = createPgTestContext({
    label: 'newest / pg',
    compatibilityVersion: Number.POSITIVE_INFINITY,
    async createRealRunner(uri) {
        const pool = new Pool({ connectionString: uri })
        return {
            runner: new PgPoolQueryRunner(pool),
            shutdown: () => pool.end(),
        }
    },
})
```

Rules:

- `label` is `"<version> / <connector>"`. The audit and the docker-scope
  gating both parse it.
- `compatibilityVersion` is pinned in every cell.

The canonical cell, where a test is written first before being propagated, is a
convention of the workflow, not something `setup.ts` marks — see
[`WRITING_TESTS.md` § Adding a test](./WRITING_TESTS.md#adding-a-test).

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
| Domain-feature tests | `select.basic.test.ts`, `insert.returning.test.ts`, `update.execute-variants.test.ts`, `delete.execute-variants.test.ts` |
| Error / processing tests | `errors.processing.test.ts`, `errors.transaction-attachments.test.ts` |
| Fragment / composition | `fragments.with-args.test.ts`, `raw-fragment.*.test.ts`, `with-values.*.test.ts` |
| Dynamic queries | `dynamic-condition.*.test.ts` |
| Customize hooks | `customize-query.*.test.ts`, `customize-query.insert.test.ts` |
| Docs snippets | `docs.<page>.test.ts`, `docs.advanced.<page>.test.ts` (mirrored to every cell — see [`WRITING_TESTS.md` § Docs snippets](./WRITING_TESTS.md#docs-snippets)) |
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
- `bun run validate:tests` (or `validate:tests:newest` for the fast loop)
  is the real assertion. If a directive becomes "unused", the build fails with the
  canonical message — exactly the regression signal we want.
- The `types.negative/` folder is **not** part of the cell matrix. `tests:audit`
  skips it, except for the `ts-ignore` rule (`@ts-ignore` is forbidden everywhere).

For which command to run and where to place `@ts-expect-error` directives see
[`WRITING_TESTS.md` § Type-checking the test matrix](./WRITING_TESTS.md#type-checking-the-test-matrix).
