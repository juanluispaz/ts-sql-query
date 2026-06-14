// Factories that produce a `TestContext` for the postgres database.
//
// One factory per connector. Each `test/db/postgres/<version>/<connector>/setup.ts`
// is a thin call into the matching factory.
//
// pg / postgres / bun_sql_postgres all talk to the real engine via
// testcontainers and share a single container with refcounting. PgLite
// runs in-process and gets its own (later) factory.

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { Pool } from 'pg'

import { isRealDbEnabled } from '../../lib/backends.js'
import {
    BASE_WORKER_DB_NAME,
    createContainerHandle,
    hashSqlFiles,
    memoizeSharedRunner,
    META_DB_NAME,
    reuseEnabled,
    SCHEMA_HASH_META_TABLE,
    VALIDATE_LOCK_KEY_BIGINT,
    workerName,
    workerNameLikePattern,
} from '../../lib/containerLifecycle.js'
import { createTestContext, type TestContext } from '../../lib/testContext.js'
import { CaptureInterceptor } from '../../lib/captureInterceptor.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { MockBunSqlPostgresQueryRunner } from '../../lib/mockRunners/MockBunSqlPostgresQueryRunner.js'
import { DBConnection } from './domain/connection.js'


/**
 * `TestContext<DBConnection>` extended with Postgres-specific connection
 * factories. Each `withXxx(...)` returns a `DBConnection` (subclass)
 * whose protected config field is pinned to the requested value. The
 * subclass shares `ctx.conn`'s underlying `CaptureInterceptor` /
 * driver, so:
 *
 *   - SQL emitted by the alt connection lands in `ctx.lastSql`.
 *   - In real-DB mode the query reaches the same backing database
 *     `ctx.conn` sees — no second driver-level connection is opened.
 *
 * These factories are the **only** sanctioned way to instantiate a
 * `DBConnection` inside a test file; tests must not construct their
 * own runner or `new DBConnection(...)`.
 */
export interface PostgresTestContext extends TestContext<DBConnection> {
    /**
     * A collation name accepted by the underlying engine — used by
     * `config.insensitive-collation.test.ts` so the
     * `insensitiveCollation = '<name>'` branch emits SQL that
     * actually runs against the real DB. Each dialect picks the
     * built-in case-insensitive collation that ships with a default
     * install (SQLite: `NOCASE`, PostgreSQL: `"C"`, MySQL/MariaDB:
     * `utf8mb4_general_ci`, Oracle: `BINARY_CI`, SQL Server:
     * `Latin1_General_CI_AS`).
     */
    readonly exampleInsensitiveCollation: string
    /** A `DBConnection` whose `insensitiveCollation` is pinned to `collation`. */
    withInsensitiveCollation(collation: string | undefined): DBConnection
    /**
     * A `DBConnection` whose query runner has `allowNestedTransactions`
     * enabled — for the "nested transaction works when enabled" test. In
     * mock mode this is `ctx.conn` (the `MockQueryRunner` already reports
     * `nestedTransactionsSupported()`); in real-DB mode it is backed by a
     * flag-on runner over the same backing database, available only on the
     * connectors whose runner supports the flag (`pg` via `PgPoolQueryRunner`,
     * `pglite` via `PgLiteQueryRunner`). Throws on the other connectors
     * (`postgres` / `bun_sql_postgres`), whose nesting-works test is
     * NOT-APPLICABLE and commented out.
     */
    nestedTransactionConn(): DBConnection
}

/**
 * Wrap a base `TestContext<DBConnection>` with Postgres-specific
 * connection factories. Each `withXxx` reaches into the live
 * `ctx.conn.queryRunner` (the shared interceptor) — `ctx.up()` must
 * have run before any helper is called.
 */
function decoratePostgresContext(
    base: TestContext<DBConnection>,
    getNestedTxConn: () => DBConnection | null,
): PostgresTestContext {
    return Object.assign(base, {
        // PostgreSqlSqlBuilder wraps the collation name in double
        // quotes itself (`collate "<name>"`) — pass the unquoted
        // identifier here.
        exampleInsensitiveCollation: 'C',
        withInsensitiveCollation(collation: string | undefined): DBConnection {
            class C extends DBConnection {
                protected override insensitiveCollation: string | undefined = collation
            }
            return new C(base.conn.queryRunner)
        },
        nestedTransactionConn(): DBConnection {
            // The mock reports `nestedTransactionsSupported()`, so nesting
            // works on `ctx.conn` itself in mock mode.
            if (!base.realDbEnabled) return base.conn
            const conn = getNestedTxConn()
            if (!conn) throw new Error('nestedTransactionConn(): this connector cannot enable nested transactions on the real engine')
            return conn
        },
    })
}

const DATABASE = 'postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(__dirname, './domain/schema.sql')
const SEED_PATH = resolve(__dirname, './domain/seed.sql')

const POSTGRES_IMAGE = 'postgres:18-alpine'

// ---- Shared testcontainers postgres -------------------------------------
//
// The container is started lazily on the first acquire and kept alive for
// the entire test process — see `test/lib/containerLifecycle.ts` for why.
// `.withReuse()` is opted into via `TESTCONTAINERS_REUSE_ENABLE=true`, which
// also keeps the container alive across separate `bun test` invocations.
// `lockKey` serialises the first-acquire across worker processes so the
// reuse-lookup-then-create dance in testcontainers (which holds only an
// in-process lock) doesn't spawn duplicate containers under cold start.

const container = createContainerHandle<StartedPostgreSqlContainer>(async () => {
    const builder = new PostgreSqlContainer(POSTGRES_IMAGE)
    if (reuseEnabled()) builder.withReuse()
    const started = await builder.start()
    // Runs once per process (the factory is memoized by
    // `createContainerHandle`). Validates the schema/seed hash against
    // the meta DB and, when stale, drops every per-worker test DB so
    // they get rebuilt cleanly. The advisory lock serialises this
    // across workers running in parallel processes.
    await validateOrResetForReuse(started.getConnectionUri())
    return started
}, { lockKey: POSTGRES_IMAGE })
const acquireContainer = container.acquire
const releaseContainer = container.release

/** Replace the database segment of a postgres connection URI. */
function uriForDb(uri: string, dbName: string): string {
    const u = new URL(uri)
    u.pathname = '/' + dbName
    return u.toString()
}

async function validateOrResetForReuse(uri: string): Promise<void> {
    const [schemaSql, seedSql] = await Promise.all([
        readFile(SCHEMA_PATH, 'utf8'),
        readFile(SEED_PATH, 'utf8'),
    ])
    const currentHash = await hashSqlFiles(schemaSql, seedSql)

    // Maintenance client against the default `postgres` DB: from here
    // we take the advisory lock, enumerate / drop worker DBs, and
    // create the dedicated meta DB. CREATE/DROP DATABASE cannot run
    // in a tx, so each statement is issued individually.
    //
    // The advisory lock is session-scoped, so the entire validate +
    // potentially-reset sequence must execute on the SAME backend
    // connection — a Pool that hands out a fresh client per query
    // would silently release the lock between statements. We use
    // `pool.connect()` to pin one client for the duration.
    const adminPool = new Pool({ connectionString: uri, max: 1 })
    try {
        const admin = await adminPool.connect()
        try {
            await admin.query('SELECT pg_advisory_lock($1)', [VALIDATE_LOCK_KEY_BIGINT.toString()])
            try {
                const storedHash = await readStoredHash(uri, admin)
                if (storedHash === currentHash) return

                // Drop every existing worker DB — both the
                // parallel-on pattern (`tssqlquery_w%`) and the
                // parallel-off bare name (`tssqlquery`) — so a
                // switch between modes leaves no stragglers behind.
                // WITH (FORCE) terminates lingering backends so a
                // previous test process that died mid-run doesn't
                // block the drop.
                const workerDbs = await admin.query<{ datname: string }>(
                    `SELECT datname FROM pg_database
                      WHERE datname = $1 OR datname LIKE $2`,
                    [BASE_WORKER_DB_NAME, workerNameLikePattern(BASE_WORKER_DB_NAME)],
                )
                for (const { datname } of workerDbs.rows) {
                    await admin.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`)
                }
                await admin.query(`DROP DATABASE IF EXISTS "${META_DB_NAME}" WITH (FORCE)`)
                await admin.query(`CREATE DATABASE "${META_DB_NAME}"`)

                const metaPool = new Pool({ connectionString: uriForDb(uri, META_DB_NAME) })
                try {
                    await metaPool.query(
                        `CREATE TABLE ${SCHEMA_HASH_META_TABLE} (hash TEXT NOT NULL)`,
                    )
                    await metaPool.query(
                        `INSERT INTO ${SCHEMA_HASH_META_TABLE} (hash) VALUES ($1)`,
                        [currentHash],
                    )
                } finally {
                    await metaPool.end()
                }
            } finally {
                await admin.query('SELECT pg_advisory_unlock($1)', [VALIDATE_LOCK_KEY_BIGINT.toString()])
            }
        } finally {
            admin.release()
        }
    } finally {
        await adminPool.end()
    }
}

async function readStoredHash(uri: string, admin: import('pg').PoolClient): Promise<string | null> {
    // Postgres queries are scoped to the connected DB — we can't read
    // from the meta DB without opening a connection against it. Probe
    // the catalog first to avoid the cost of an extra pool when the
    // meta DB is missing on a fresh container.
    const exists = await admin.query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists`,
        [META_DB_NAME],
    )
    if (!exists.rows[0]?.exists) return null

    const metaPool = new Pool({ connectionString: uriForDb(uri, META_DB_NAME) })
    try {
        const res = await metaPool.query<{ hash: string }>(
            `SELECT hash FROM ${SCHEMA_HASH_META_TABLE} LIMIT 1`,
        )
        return res.rows[0]?.hash ?? null
    } catch {
        // Meta DB exists but the table is missing — treat as mismatch.
        return null
    } finally {
        await metaPool.end()
    }
}

// Once-per-process: the worker DB only needs creating on the first call.
// The schema/seed SQL is read from disk once and the dedicated admin
// pool used to apply it is also long-lived — opening and closing a
// Pool per test file dominates the suite's wall time otherwise (~5-9 s
// on postgres's 178-file matrix). Both leak by design: the process
// exits at the end of `bun test`, the kernel reclaims the sockets.
let workerDbEnsured = false
let schemaSeedPool: Pool | null = null
let schemaSql: string | null = null
let seedSql: string | null = null

/**
 * Ensure schema+seed SQL strings are loaded into module state.
 */
async function ensureSchemaAndSeedLoaded(): Promise<{ schema: string; seed: string }> {
    if (schemaSql === null || seedSql === null) {
        [schemaSql, seedSql] = await Promise.all([
            readFile(SCHEMA_PATH, 'utf8'),
            readFile(SEED_PATH, 'utf8'),
        ])
    }
    return { schema: schemaSql, seed: seedSql }
}

/**
 * Borrow against the runner's native pg/postgres.js/bun:sql/pglite handle
 * to re-apply schema + seed. Dispatches by feature detection because the
 * factories below are shared across cells whose underlying driver shape
 * differs (`pg.Pool` has `.query`; `postgres.js`/`bun:sql` are
 * tagged-template functions exposing `.unsafe`; PGlite exposes `.exec`).
 * All four accept multi-statement SQL in a single call.
 */
async function reseedAgainstNativePostgresHandle(runner: QueryRunner): Promise<void> {
    const { schema, seed } = await ensureSchemaAndSeedLoaded()
    const native = runner.getNativeRunner() as any
    // PGlite check must run BEFORE the duck-typed `.query`/`.unsafe` checks:
    // a PGlite instance also exposes `.query(text, params)` (PostgreSQL
    // extended protocol — single-statement only, rejects multi-statement
    // schema with `cannot insert multiple commands into a prepared
    // statement`). Only `.exec` routes through the simple query protocol
    // that accepts the multi-statement schema/seed.
    if (typeof native?.exec === 'function' && typeof native?.execProtocolRaw === 'function') {
        // PGlite (the extra `execProtocolRaw` check pins the brand —
        // postgres.js's tagged template also exposes a `.unsafe`, and
        // some pg drivers expose stray `.exec` methods.)
        await native.exec(schema)
        await native.exec(seed)
    } else if (typeof native?.unsafe === 'function') {
        // postgres.js Sql or bun:sql SQL — tagged-template function with .unsafe()
        await native.unsafe(schema)
        await native.unsafe(seed)
    } else if (typeof native?.query === 'function') {
        // pg.Pool
        await native.query(schema)
        await native.query(seed)
    } else {
        throw new Error('Unsupported native postgres runner shape; cannot reseed')
    }
}

/**
 * First-time setup: create the worker DB if it doesn't exist (once per
 * process), then apply schema+seed via a one-shot bootstrap pool. The
 * runner's pool does not exist yet at this point, so the bootstrap pool
 * is the only option. Subsequent reseeds borrow from the runner's pool
 * via `onReseed` and never reach this code path. Returns the worker DB
 * URI so the runner factory can open its pool against it.
 */
async function bootstrapWorkerDbSchemaAndSeed(uri: string): Promise<string> {
    const workerDb = workerName(BASE_WORKER_DB_NAME)
    const workerUri = uriForDb(uri, workerDb)
    if (!workerDbEnsured) {
        const adminPool = new Pool({ connectionString: uri })
        try {
            const exists = await adminPool.query<{ exists: boolean }>(
                `SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists`,
                [workerDb],
            )
            if (!exists.rows[0]?.exists) {
                // Two workers racing to CREATE DATABASE the first
                // time would otherwise crash with 23505. Catch the
                // duplicate and treat it as success.
                try {
                    await adminPool.query(`CREATE DATABASE "${workerDb}"`)
                } catch (err: any) {
                    if (err?.code !== '42P04') throw err
                }
            }
        } finally {
            await adminPool.end()
        }
        workerDbEnsured = true
    }

    const { schema, seed } = await ensureSchemaAndSeedLoaded()
    if (schemaSeedPool === null) {
        schemaSeedPool = new Pool({ connectionString: workerUri })
    }
    await schemaSeedPool.query(schema)
    await schemaSeedPool.query(seed)
    return workerUri
}

// ---- Real-postgres (docker) test context --------------------------------

export interface PgTestSpec {
    label: string
    canonicalForDocs?: boolean
    compatibilityVersion?: number
    /** Build the real runner for this connector against the given URI. */
    createRealRunner(uri: string): Promise<{ runner: QueryRunner; shutdown(): Promise<void> }>
    /**
     * Build a real runner with `allowNestedTransactions` enabled, over the
     * same backing database (URI), for `ctx.nestedTransactionConn()`. Only
     * the connectors whose runner supports the flag provide this (`pg`);
     * omitting it makes `nestedTransactionConn()` throw in real mode (the
     * connector's nesting-works test is NOT-APPLICABLE).
     */
    createNestedTxRunner?: (uri: string) => { runner: QueryRunner; shutdown(): Promise<void> }
}

export function createPgTestContext(spec: PgTestSpec): PostgresTestContext {
    const version = spec.label.split(' / ')[0] ?? ''
    const connector = spec.label.split(' / ')[1] ?? ''
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ true, version, connector)
    let workerUri: string | null = null
    // Memoise the spec's pool/connection so it lives for the worker
    // process, not per test file. The `setup.ts` factories don't have
    // to know about this — they just build a runner from a URI.
    const buildRunner = memoizeSharedRunner(spec.createRealRunner)

    // The flag-on connection for `ctx.nestedTransactionConn()` (real mode):
    // a second runner over the same worker DB, constructed with
    // `allowNestedTransactions`. Built eagerly in `onUp`, torn down in `onDown`.
    let nestedTxConn: DBConnection | null = null
    let nestedTxShutdown: (() => Promise<void>) | null = null

    return decoratePostgresContext(createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'postgreSql',
        realDbEnabled,
        async createRealRunner() {
            const container = await acquireContainer()
            const adminUri = container.getConnectionUri()
            workerUri = await bootstrapWorkerDbSchemaAndSeed(adminUri)
            return await buildRunner(workerUri)
        },
        async onUp() {
            if (spec.createNestedTxRunner && workerUri) {
                const built = spec.createNestedTxRunner(workerUri)
                nestedTxShutdown = built.shutdown
                nestedTxConn = new DBConnection(new CaptureInterceptor(built.runner), spec.compatibilityVersion)
            }
        },
        onReseed: reseedAgainstNativePostgresHandle,
        async onDown() {
            if (nestedTxShutdown) { await nestedTxShutdown(); nestedTxShutdown = null }
            nestedTxConn = null
            workerUri = null
            await releaseContainer()
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    }), () => nestedTxConn)
}

// ---- PgLite (in-process) test context -----------------------------------

export interface PgLiteTestSpec {
    label: string
    canonicalForDocs?: boolean
    compatibilityVersion: number
}

// Per-process PGlite instance. Bootstrapping PGlite (`PGlite.create(...)`)
// is the expensive step — it spins up a full WASM-hosted PostgreSQL —
// and was previously paid once per test file (44 pglite cells × ~300 ms
// dominated the postgres matrix wall time). Memoising it across files
// inside one worker drops that to a single startup; per-file `up()` just
// re-applies the schema + seed, which is cheap.
//
// We never explicitly close it: it's tied to the process lifetime, and
// `bun test` exits when the matrix is done so the WASM heap goes away
// with it. Same pattern as the docker `createContainerHandle` keep-alive.
let pgliteSharedDb: import('@electric-sql/pglite').PGlite | null = null
let pgliteSharedSchemaSql: string | null = null
let pgliteSharedSeedSql: string | null = null

async function getOrCreatePglite(): Promise<import('@electric-sql/pglite').PGlite> {
    if (pgliteSharedDb === null) {
        const { PGlite } = await import('@electric-sql/pglite')
        pgliteSharedDb = await PGlite.create('memory://')
        // bun:test exits with code 99 when a test process leaves
        // background work pending at exit (e.g. the PGlite worker
        // thread it spawned internally). Close the shared instance on
        // `beforeExit` so bun sees a clean shutdown.
        process.on('beforeExit', () => {
            if (pgliteSharedDb !== null) {
                const toClose = pgliteSharedDb
                pgliteSharedDb = null
                void toClose.close()
            }
        })
    }
    return pgliteSharedDb
}

async function applyPgliteSchemaAndSeed(db: import('@electric-sql/pglite').PGlite): Promise<void> {
    if (pgliteSharedSchemaSql === null || pgliteSharedSeedSql === null) {
        [pgliteSharedSchemaSql, pgliteSharedSeedSql] = await Promise.all([
            readFile(SCHEMA_PATH, 'utf8'),
            readFile(SEED_PATH, 'utf8'),
        ])
    }
    await db.exec(pgliteSharedSchemaSql)
    await db.exec(pgliteSharedSeedSql)
}

export function createPgLiteTestContext(spec: PgLiteTestSpec): PostgresTestContext {
    // PgLite is in-process WASM — gated by `TS_SQL_QUERY_WASM` so
    // `tests` (no --wasm) can route this connector through the mock
    // without paying the per-worker WASM bootstrap cost.
    const version = spec.label.split(' / ')[0] ?? ''
    const connector = spec.label.split(' / ')[1] ?? ''
    const realDbEnabled = isRealDbEnabled(DATABASE, 'wasm', version, connector)

    // The flag-on connection for `ctx.nestedTransactionConn()` (real mode):
    // a `PgLiteQueryRunner` over the same shared in-process db, constructed
    // with `allowNestedTransactions`. The db is shared (no shutdown).
    let nestedTxConn: DBConnection | null = null

    return decoratePostgresContext(createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'postgreSql',
        realDbEnabled,
        timeoutMs: 30_000,
        async createRealRunner() {
            const { PgLiteQueryRunner } = await import('../../../src/queryRunners/PgLiteQueryRunner.js')
            const db = await getOrCreatePglite()
            await applyPgliteSchemaAndSeed(db)
            return {
                runner: new PgLiteQueryRunner(db),
                // Don't close the db — the shared instance survives
                // until the worker process exits (see comment on
                // pgliteSharedDb).
                shutdown: async () => { /* shared instance, intentional no-op */ },
            }
        },
        async onUp() {
            const { PgLiteQueryRunner } = await import('../../../src/queryRunners/PgLiteQueryRunner.js')
            const db = await getOrCreatePglite()
            nestedTxConn = new DBConnection(
                new CaptureInterceptor(new PgLiteQueryRunner(db, { allowNestedTransactions: true })),
                spec.compatibilityVersion,
            )
        },
        async onDown() {
            nestedTxConn = null
        },
        onReseed: reseedAgainstNativePostgresHandle,
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    }), () => nestedTxConn)
}

// ---- bun:sql for postgres (docker-backed, bun-only) ---------------------

declare global {
    // eslint-disable-next-line no-var
    var Bun: { version: string } | undefined
}

const isBun = typeof globalThis.Bun !== 'undefined'

export function createBunSqlPostgresTestContext(spec: PgTestSpec): PostgresTestContext {
    // bun:sql is bun-only AND docker-backed. Under node we skip the real
    // branch entirely; under bun we still depend on docker for the
    // postgres engine.
    const version = spec.label.split(' / ')[0] ?? ''
    const connector = spec.label.split(' / ')[1] ?? ''
    const realDbEnabled = isBun && isRealDbEnabled(DATABASE, /* needsDocker */ true, version, connector)
    let workerUri: string | null = null
    const buildRunner = memoizeSharedRunner(spec.createRealRunner)

    return decoratePostgresContext(createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'postgreSql',
        realDbEnabled,
        mockRunnerClass: MockBunSqlPostgresQueryRunner,
        async createRealRunner() {
            const container = await acquireContainer()
            workerUri = await bootstrapWorkerDbSchemaAndSeed(container.getConnectionUri())
            return await buildRunner(workerUri)
        },
        onReseed: reseedAgainstNativePostgresHandle,
        async onDown() {
            workerUri = null
            await releaseContainer()
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
        // bun:sql's runner does not support allowNestedTransactions — the
        // nesting-works test is NOT-APPLICABLE on this connector (commented out).
    }), () => null)
}
