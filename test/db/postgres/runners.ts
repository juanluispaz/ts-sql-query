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
import { DBConnection } from './domain/connection.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'

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
})
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
    if (typeof native?.unsafe === 'function') {
        // postgres.js Sql or bun:sql SQL — tagged-template function with .unsafe()
        await native.unsafe(schema)
        await native.unsafe(seed)
    } else if (typeof native?.query === 'function') {
        // pg.Pool
        await native.query(schema)
        await native.query(seed)
    } else if (typeof native?.exec === 'function') {
        // PGlite
        await native.exec(schema)
        await native.exec(seed)
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
}

export function createPgTestContext(spec: PgTestSpec): TestContext<DBConnection> {
    const version = spec.label.split(' / ')[0] ?? ''
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ true, version)
    let workerUri: string | null = null
    // Memoise the spec's pool/connection so it lives for the worker
    // process, not per test file. The `setup.ts` factories don't have
    // to know about this — they just build a runner from a URI.
    const buildRunner = memoizeSharedRunner(spec.createRealRunner)

    return createTestContext<DBConnection>({
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
        onReseed: reseedAgainstNativePostgresHandle,
        async onDown() {
            workerUri = null
            await releaseContainer()
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    })
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

export function createPgLiteTestContext(spec: PgLiteTestSpec): TestContext<DBConnection> {
    // PgLite is in-process WASM — gated by `TS_SQL_QUERY_WASM` so
    // `tests` (no --wasm) can route this connector through the mock
    // without paying the per-worker WASM bootstrap cost.
    const realDbEnabled = isRealDbEnabled(DATABASE, 'wasm')

    return createTestContext<DBConnection>({
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
        onReseed: reseedAgainstNativePostgresHandle,
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    })
}

// ---- bun:sql for postgres (docker-backed, bun-only) ---------------------

declare global {
    // eslint-disable-next-line no-var
    var Bun: { version: string } | undefined
}

const isBun = typeof globalThis.Bun !== 'undefined'

export function createBunSqlPostgresTestContext(spec: PgTestSpec): TestContext<DBConnection> {
    // bun:sql is bun-only AND docker-backed. Under node we skip the real
    // branch entirely; under bun we still depend on docker for the
    // postgres engine.
    const version = spec.label.split(' / ')[0] ?? ''
    const realDbEnabled = isBun && isRealDbEnabled(DATABASE, /* needsDocker */ true, version)
    let workerUri: string | null = null
    const buildRunner = memoizeSharedRunner(spec.createRealRunner)

    return createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'postgreSql',
        realDbEnabled,
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
    })
}
