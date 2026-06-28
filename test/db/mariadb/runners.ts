// Factories that produce a `TestContext` for the mariadb database.
//
// One factory per connector. Each `test/db/mariadb/<version>/<connector>/setup.ts`
// is a thin call into the matching factory.
//
// The real engine runs in a generic testcontainers container; the driver
// is loaded via dynamic import inside `createRealRunner` so the file can
// also be parsed when docker is off (no testcontainer call ever fires).

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isRealDbEnabled } from '../../lib/backends.js'
import {
    BASE_WORKER_DB_NAME,
    createContainerHandle,
    hashSqlFiles,
    memoizeSharedRunner,
    META_DB_NAME,
    reuseEnabled,
    SCHEMA_HASH_META_TABLE,
    VALIDATE_LOCK_NAME,
    workerName,
    workerNameLikePattern,
} from '../../lib/containerLifecycle.js'
import { createTestContext, type TestContext } from '../../lib/testContext.js'
import { DBConnection } from './domain/connection.js'


/**
 * `TestContext<DBConnection>` extended with MariaDB-specific connection
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
export interface MariaDBTestContext extends TestContext<DBConnection> {
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
    /** A `DBConnection` whose `uuidStrategy` is pinned to `strategy`. */
    withUuidStrategy(strategy: 'string' | 'uuid'): DBConnection
}

/**
 * Wrap a base `TestContext<DBConnection>` with MariaDB-specific
 * connection factories. Each `withXxx` reaches into the live
 * `ctx.conn.queryRunner` (the shared interceptor) — `ctx.up()` must
 * have run before any helper is called.
 */
function decorateMariaDBContext(base: TestContext<DBConnection>): MariaDBTestContext {
    return Object.assign(base, {
        exampleInsensitiveCollation: 'utf8mb4_general_ci',
        withInsensitiveCollation(collation: string | undefined): DBConnection {
            class C extends DBConnection {
                protected override insensitiveCollation: string | undefined = collation
            }
            return new C(base.conn.queryRunner)
        },
        withUuidStrategy(strategy: 'string' | 'uuid'): DBConnection {
            class C extends DBConnection {
                protected override uuidStrategy: 'string' | 'uuid' = strategy
            }
            return new C(base.conn.queryRunner)
        },
    })
}

const DATABASE = 'mariadb'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(__dirname, './domain/schema.sql')
const SEED_PATH = resolve(__dirname, './domain/seed.sql')
// Data-only reset used by the per-test reseed (onReseed) in place of the full
// schema rebuild — see ./domain/reset.sql. schema.sql's DROP+CREATE is kept
// only for the once-per-worker bootstrap.
const RESET_PATH = resolve(__dirname, './domain/reset.sql')

// `mariadb` (no tag) tracks the latest stable image, matching what the
// `all-examples` script uses for the `newest` cell.
const MARIADB_IMAGE = 'mariadb'
const ROOT_PASSWORD = 'mariadb-test-pass'

// Lazy types from testcontainers (we only import at real-runner build time)
type StartedContainer = {
    getHost(): string
    getMappedPort(p: number): number
    stop(): Promise<unknown>
}

// Container is started lazily on the first acquire and kept alive for the
// entire test process — see `test/lib/containerLifecycle.ts`. With the
// `TESTCONTAINERS_REUSE_ENABLE=true` env var the container also survives
// across separate `bun test` invocations. `lockKey` serialises the
// first-acquire across worker processes so the reuse-lookup-then-create
// dance in testcontainers (which holds only an in-process lock) doesn't
// spawn duplicate containers under cold start.
const container = createContainerHandle<StartedContainer>(async () => {
    const { GenericContainer, Wait } = await import('testcontainers')
    const builder = new GenericContainer(MARIADB_IMAGE)
        .withEnvironment({
            MARIADB_ROOT_PASSWORD: ROOT_PASSWORD,
        })
        .withExposedPorts(3306)
        .withWaitStrategy(Wait.forLogMessage(/ready for connections/, 2))
    if (reuseEnabled()) builder.withReuse()
    const started = (await builder.start()) as unknown as StartedContainer
    // Runs once per process. Validates the schema/seed hash against the
    // meta DB and, when stale, drops every per-worker test DB so they
    // get rebuilt cleanly. The named lock (`GET_LOCK`) serialises this
    // across workers running in parallel processes.
    await validateOrResetForReuse(started.getHost(), started.getMappedPort(3306))
    return started
}, { lockKey: MARIADB_IMAGE })
const acquireContainer = container.acquire
const releaseContainer = container.release

async function validateOrResetForReuse(host: string, port: number): Promise<void> {
    const [schemaSql, seedSql] = await Promise.all([
        readFile(SCHEMA_PATH, 'utf8'),
        readFile(SEED_PATH, 'utf8'),
    ])
    const currentHash = await hashSqlFiles(schemaSql, seedSql)

    // Single connection — `GET_LOCK` is connection-scoped, so the
    // whole validate-and-maybe-reset sequence has to run through it.
    const mariadb = await import('mariadb')
    const conn = await connectWithRetry(mariadb, {
        host, port,
        user: 'root', password: ROOT_PASSWORD,
    })
    try {
        const lockRows = await conn.query(
            'SELECT GET_LOCK(?, 60) AS got', [VALIDATE_LOCK_NAME],
        ) as Array<{ got: number | bigint }>
        const got = lockRows[0]?.got
        if (got !== 1 && got !== 1n) {
            throw new Error(`mariadb validator: failed to acquire GET_LOCK('${VALIDATE_LOCK_NAME}')`)
        }
        try {
            let storedHash: string | null = null
            try {
                const rows = await conn.query(
                    `SELECT hash FROM \`${META_DB_NAME}\`.${SCHEMA_HASH_META_TABLE} LIMIT 1`,
                ) as Array<{ hash: string }>
                storedHash = rows[0]?.hash ?? null
            } catch {
                // Meta DB / table missing — fresh container.
            }

            if (storedHash === currentHash) return

            // Enumerate and drop every existing worker DB — both the
            // parallel-on pattern (`tssqlquery_w%`) and the
            // parallel-off bare name (`tssqlquery`) — so a switch
            // between modes leaves no stragglers behind.
            const workerDbs = await conn.query(
                `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA
                  WHERE SCHEMA_NAME = ? OR SCHEMA_NAME LIKE ?`,
                [BASE_WORKER_DB_NAME, workerNameLikePattern(BASE_WORKER_DB_NAME)],
            ) as Array<{ SCHEMA_NAME: string }>
            for (const row of workerDbs) {
                await conn.query(`DROP DATABASE IF EXISTS \`${row.SCHEMA_NAME}\``)
            }
            await conn.query(`DROP DATABASE IF EXISTS \`${META_DB_NAME}\``)
            await conn.query(`CREATE DATABASE \`${META_DB_NAME}\``)
            await conn.query(
                `CREATE TABLE \`${META_DB_NAME}\`.${SCHEMA_HASH_META_TABLE} (hash VARCHAR(64) NOT NULL)`,
            )
            await conn.query(
                `INSERT INTO \`${META_DB_NAME}\`.${SCHEMA_HASH_META_TABLE} (hash) VALUES (?)`,
                [currentHash],
            )
        } finally {
            await conn.query('SELECT RELEASE_LOCK(?)', [VALIDATE_LOCK_NAME])
        }
    } finally {
        await conn.end()
    }
}

function splitStatements(sql: string): string[] {
    return sql
        .split(/;\s*(?:\n|$)/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
}

// Once-per-process flag: the worker DB only needs creating the first
// time the runner starts inside a given process. Subsequent
// `applySchemaAndSeedToWorkerDb` calls skip the admin connection.
let workerDbEnsured = false

async function applySchemaAndSeedOnConnection(conn: import('mariadb').Connection | import('mariadb').PoolConnection): Promise<void> {
    const [schemaSql, seedSql] = await Promise.all([
        readFile(SCHEMA_PATH, 'utf8'),
        readFile(SEED_PATH, 'utf8'),
    ])
    for (const stmt of splitStatements(schemaSql)) await conn.query(stmt)
    for (const stmt of splitStatements(seedSql)) await conn.query(stmt)
}

// Data-only baseline restore used by the per-test reseed: reset.sql (TRUNCATE +
// sequence rewind) instead of the heavy schema.sql, then the same seed. Leaves
// the exact post-bootstrap state without the DROP+CREATE catalog churn.
async function applyResetAndSeedOnConnection(conn: import('mariadb').Connection | import('mariadb').PoolConnection): Promise<void> {
    const [resetSql, seedSql] = await Promise.all([
        readFile(RESET_PATH, 'utf8'),
        readFile(SEED_PATH, 'utf8'),
    ])
    for (const stmt of splitStatements(resetSql)) await conn.query(stmt)
    for (const stmt of splitStatements(seedSql)) await conn.query(stmt)
}

// First-time setup: the runner's pool does not exist yet (the worker DB
// must be created before the pool can authenticate against it). This path
// opens a one-shot direct connection to bootstrap the worker DB and
// apply schema+seed. Subsequent reseeds borrow from the runner's pool —
// see `onReseed` below.
async function bootstrapWorkerDbSchemaAndSeed(host: string, port: number): Promise<string> {
    const workerDb = workerName(BASE_WORKER_DB_NAME)
    const mariadb = await import('mariadb')

    if (!workerDbEnsured) {
        // Ensure the worker DB exists. `CREATE DATABASE IF NOT EXISTS`
        // is race-safe across workers — the first writer wins, the
        // rest no-op.
        const adminConn = await connectWithRetry(mariadb, {
            host, port,
            user: 'root', password: ROOT_PASSWORD,
        })
        try {
            await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${workerDb}\``)
        } finally {
            await adminConn.end()
        }
        workerDbEnsured = true
    }

    const conn = await connectWithRetry(mariadb, {
        host, port,
        user: 'root', password: ROOT_PASSWORD,
        database: workerDb,
        multipleStatements: true,
    })
    try {
        await applySchemaAndSeedOnConnection(conn)
    } finally {
        await conn.end()
    }
    return workerDb
}

async function connectWithRetry(mariadb: typeof import('mariadb'), config: any): Promise<import('mariadb').Connection> {
    // 90 s window (was 30 s). The one-shot validator/bootstrap connects run at
    // the START of a worker's first acquire, but the worst contention is the
    // END-OF-RUN convergence storm: once the fast engines finish, every
    // remaining worker piles onto the few heavy containers (mariadb / mssql) at
    // once and macOS Docker's userspace port-forward proxy briefly drops socket
    // connects ("failed to create socket"). A 30 s window gave up mid-storm; 90 s
    // (with a tight per-attempt connectTimeout so each failed attempt returns
    // fast and we get ~many retries) rides the convergence out instead of
    // failing the beforeAll hook.
    const deadline = Date.now() + 90_000
    let lastError: unknown
    while (Date.now() < deadline) {
        try {
            return await mariadb.createConnection({ connectTimeout: 5_000, ...config })
        } catch (err) {
            lastError = err
            await new Promise(r => setTimeout(r, 500))
        }
    }
    throw lastError
}

// ---- Real mariadb (docker) test context ---------------------------------

export interface MariaDBTestSpec {
    label: string
    canonicalForDocs?: boolean
    compatibilityVersion?: number
}

export function createMariaDBPoolTestContext(spec: MariaDBTestSpec): MariaDBTestContext {
    const version = spec.label.split(' / ')[0] ?? ''
    const connector = spec.label.split(' / ')[1] ?? ''
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ true, version, connector)
    const buildRunner = memoizeSharedRunner(async (params: { host: string; port: number; workerDb: string }) => {
        const mariadb = await import('mariadb')
        const { MariaDBPoolQueryRunner } = await import('../../../src/queryRunners/MariaDBPoolQueryRunner.js')
        const pool = mariadb.createPool({
            host: params.host, port: params.port,
            user: 'root', password: ROOT_PASSWORD,
            database: params.workerDb,
            connectionLimit: 4,
            // Open connections LAZILY (on first use) instead of eagerly. mariadb
            // defaults `minimumIdle` to `connectionLimit`, so a bare pool opens
            // 4 sockets the instant it's created — ×12 workers = 48 simultaneous
            // connects against the just-warmed container at the start of the
            // parallel pass, the connection storm that intermittently times out.
            // Tests run sequentially within a worker (one at a time), so a worker
            // needs only ~1-2 live connections; lazy creation cuts the startup
            // peak ~4× with no downside.
            minimumIdle: 0,
            // Ride out the connection storm at the start of the parallel
            // pass: ~12 workers build their pool AND bootstrap their worker
            // DB against the just-warmed container at the same instant, so a
            // socket connect or a pool acquire can briefly stall. Without
            // patient timeouts the default ~2 s socket connect / 10 s acquire
            // fail the test with "pool failed to retrieve a connection". These
            // only make the pool wait longer before giving up — they never
            // mask a genuinely dead container (the warmup already proved it
            // up), they just absorb the thundering-herd transient — now sized
            // for the END-OF-RUN convergence storm (workers piling onto the last
            // heavy containers), matching the 90 s connectWithRetry window.
            connectTimeout: 30_000,
            acquireTimeout: 90_000,
            initializationTimeout: 90_000,
        })
        return {
            runner: new MariaDBPoolQueryRunner(pool),
            shutdown: async () => { await pool.end() },
        }
    })

    return decorateMariaDBContext(createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'mariaDB',
        realDbEnabled,
        async createRealRunner(forceNew = false) {
            const container = await acquireContainer()
            const host = container.getHost()
            const port = container.getMappedPort(3306)
            const workerDb = await bootstrapWorkerDbSchemaAndSeed(host, port)
            // `forceNew` rebuilds a fresh runner (clean transaction state) when
            // the harness discards a connection poisoned by a failed commit.
            return await buildRunner({ host, port, workerDb }, forceNew)
        },
        async onReseed(runner) {
            // Reuse the runner's existing mariadb pool. Borrowing a
            // connection avoids the auth handshake on every reseed.
            const pool = runner.getNativeRunner() as import('mariadb').Pool
            const conn = await pool.getConnection()
            try {
                await applyResetAndSeedOnConnection(conn)
            } finally {
                await conn.release()  // releases back to pool
            }
        },
        async onDown() {
            await releaseContainer()
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    }))
}
