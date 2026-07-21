// Factories that produce a `TestContext` for the mysql database.
//
// One factory per connector. Each `test/db/mysql/<version>/<connector>/setup.ts`
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
    createContainerRegistry,
    hashSqlFiles,
    memoizeSharedRunner,
    META_DB_NAME,
    reuseEnabled,
    SCHEMA_HASH_META_TABLE,
    VALIDATE_LOCK_NAME,
    workerName,
    workerNameLikePattern,
} from '../../lib/containerLifecycle.js'
import { imageForCell, newestImage } from '../../lib/dockerImages.js'
import { createTestContext, type TestContext } from '../../lib/testContext.js'
import { DBConnection } from './domain/connection.js'


/**
 * `TestContext<DBConnection>` extended with MySql-specific connection
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
export interface MySqlTestContext extends TestContext<DBConnection> {
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
    withUuidStrategy(strategy: 'string' | 'binary'): DBConnection
    /** A `DBConnection` with `allowEmptyString` enabled (empty strings kept, not mapped to null). */
    withAllowEmptyString(): DBConnection
}

/**
 * Wrap a base `TestContext<DBConnection>` with MySql-specific
 * connection factories. Each `withXxx` reaches into the live
 * `ctx.conn.queryRunner` (the shared interceptor) — `ctx.up()` must
 * have run before any helper is called.
 */
function decorateMySqlContext(base: TestContext<DBConnection>): MySqlTestContext {
    return Object.assign(base, {
        exampleInsensitiveCollation: 'utf8mb4_general_ci',
        withInsensitiveCollation(collation: string | undefined): DBConnection {
            class C extends DBConnection {
                protected override insensitiveCollation: string | undefined = collation
            }
            return base.withConnection(C)
        },
        withUuidStrategy(strategy: 'string' | 'binary'): DBConnection {
            class C extends DBConnection {
                protected override uuidStrategy: 'string' | 'binary' = strategy
            }
            return base.withConnection(C)
        },
        withAllowEmptyString(): DBConnection {
            class C extends DBConnection {
                protected override allowEmptyString = true
            }
            return base.withConnection(C)
        },
    })
}

const DATABASE = 'mysql'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(__dirname, './domain/schema.sql')
const SEED_PATH = resolve(__dirname, './domain/seed.sql')
// Data-only reset used by the per-test reseed (onReseed) in place of the full
// schema rebuild — see ./domain/reset.sql. schema.sql's DROP+CREATE is kept
// only for the once-per-worker bootstrap.
const RESET_PATH = resolve(__dirname, './domain/reset.sql')

const ROOT_PASSWORD = 'mysql-test-pass'

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
// spawn duplicate containers under cold start. The registry keys keep-alive
// handles by image so a `--docker-version closest` run can bring up an older
// image as a separate keep-alive container without colliding with the latest.
const containers = createContainerRegistry<StartedContainer>(async (image) => {
    const isVersionSpecific = image !== newestImage(DATABASE)
    if (isVersionSpecific) {
        console.error(`[docker-version] ${DATABASE}: using ${image}`)
    }
    const { GenericContainer, Wait } = await import('testcontainers')
    const builder = new GenericContainer(image)
        .withEnvironment({
            MYSQL_ROOT_PASSWORD: ROOT_PASSWORD,
        })
        .withExposedPorts(3306)
        .withWaitStrategy(Wait.forLogMessage(/ready for connections/, 2))
    if (image.startsWith('mysql:5')) {
        // `--docker-version closest` reaches the older images. The MySQL 5.x
        // line (5.7, the `oldest` tier) ships a multi-arch manifest that lists
        // amd64 WITHOUT arm64, so on Apple Silicon Docker errors instead of
        // auto-emulating (unlike the single-arch amd64 sqlserver/oracle
        // images). Pin the platform so it emulates under qemu. Harmless on
        // amd64 CI. Scoped to 5.x on purpose: the 8.0 tiers are arm64-native,
        // so pinning amd64 there would needlessly force them through qemu.
        builder.withPlatform('linux/amd64')
    }
    if (reuseEnabled()) builder.withReuse()
    const started = (await builder.start()) as unknown as StartedContainer
    // Runs once per process per image. Validates the schema/seed hash against
    // the meta DB and, when stale, drops every per-worker test DB so they
    // get rebuilt cleanly. The named lock (`GET_LOCK`) serialises this
    // across workers running in parallel processes.
    await validateOrResetForReuse(started.getHost(), started.getMappedPort(3306))
    return started
})

async function validateOrResetForReuse(host: string, port: number): Promise<void> {
    const [schemaSql, seedSql] = await Promise.all([
        readFile(SCHEMA_PATH, 'utf8'),
        readFile(SEED_PATH, 'utf8'),
    ])
    const currentHash = await hashSqlFiles(schemaSql, seedSql)

    // Connect without a default DB so we can drop and recreate
    // anything. `GET_LOCK` is connection-scoped, so we hold a single
    // connection for the whole validate-and-maybe-reset sequence.
    const mysql2 = await import('mysql2/promise')
    const conn = await connectWithRetry(mysql2, {
        host, port,
        user: 'root', password: ROOT_PASSWORD,
    })
    try {
        const [lockRows] = await conn.query<Array<{ got: number }> & import('mysql2').RowDataPacket[]>(
            'SELECT GET_LOCK(?, 60) AS got', [VALIDATE_LOCK_NAME],
        )
        if (lockRows[0]?.got !== 1) {
            throw new Error(`mysql validator: failed to acquire GET_LOCK('${VALIDATE_LOCK_NAME}')`)
        }
        try {
            let storedHash: string | null = null
            try {
                const [rows] = await conn.query<Array<{ hash: string }> & import('mysql2').RowDataPacket[]>(
                    `SELECT hash FROM \`${META_DB_NAME}\`.${SCHEMA_HASH_META_TABLE} LIMIT 1`,
                )
                storedHash = rows[0]?.hash ?? null
            } catch {
                // Meta DB / table missing — fresh container.
            }

            if (storedHash === currentHash) return

            // Enumerate and drop every existing worker DB — both the
            // parallel-on pattern (`tssqlquery_w%`) and the
            // parallel-off bare name (`tssqlquery`) — so a switch
            // between modes leaves no stragglers behind.
            const [workerDbs] = await conn.query<Array<{ SCHEMA_NAME: string }> & import('mysql2').RowDataPacket[]>(
                `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA
                  WHERE SCHEMA_NAME = ? OR SCHEMA_NAME LIKE ?`,
                [BASE_WORKER_DB_NAME, workerNameLikePattern(BASE_WORKER_DB_NAME)],
            )
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

async function applySchemaAndSeedOnConnection(conn: import('mysql2/promise').Connection | import('mysql2/promise').PoolConnection): Promise<void> {
    const [schemaSql, seedSql] = await Promise.all([
        readFile(SCHEMA_PATH, 'utf8'),
        readFile(SEED_PATH, 'utf8'),
    ])
    for (const stmt of splitStatements(schemaSql)) await conn.query(stmt)
    for (const stmt of splitStatements(seedSql)) await conn.query(stmt)
}

// Data-only baseline restore used by the per-test reseed: reset.sql (TRUNCATE,
// which also rewinds AUTO_INCREMENT) instead of the heavy schema.sql, then the
// same seed. Leaves the exact post-bootstrap state without the DROP+CREATE
// catalog churn.
async function applyResetAndSeedOnConnection(conn: import('mysql2/promise').Connection | import('mysql2/promise').PoolConnection): Promise<void> {
    const [resetSql, seedSql] = await Promise.all([
        readFile(RESET_PATH, 'utf8'),
        readFile(SEED_PATH, 'utf8'),
    ])
    for (const stmt of splitStatements(resetSql)) await conn.query(stmt)
    for (const stmt of splitStatements(seedSql)) await conn.query(stmt)
}

// MySQL 8.0 ships built-in UUID_TO_BIN / BIN_TO_UUID; MySQL 5.7 (the `oldest`
// tier under `--docker-version closest`) does NOT, so the shared seed's
// `UUID_TO_BIN(...)` and the library's emitted `uuid_to_bin(...)` /
// `bin_to_uuid(...)` (the default 'binary' uuid strategy) would fail. On 5.7
// the runner creates these as user-defined functions in the worker DB before
// applying schema/seed; MySQL resolves the names case-insensitively, so they
// stand in for the missing built-ins. The bodies match the 8.0 built-ins with
// the default swap flag (0 = natural byte order): UUID_TO_BIN packs the hex
// as-is, BIN_TO_UUID re-inserts the dashes and lowercases to match 8.0's
// output, so the same value assertions pass on both images. The NULL guard in
// BIN_TO_UUID mirrors the built-in (a NULL binary reads back as NULL, not the
// '----' an unguarded CONCAT_WS would produce). Kept out of the shared
// schema.sql/seed.sql so `newest`/8.0 keep their real built-ins. These are the
// same definitions documented for 5.7 users in
// docs/configuration/supported-databases/mysql.md. One statement per line so
// `splitStatements` (splits on `;\n`) ships each separately.
const MYSQL_57_UUID_FUNCTIONS_SQL = `
DROP FUNCTION IF EXISTS UUID_TO_BIN;
CREATE FUNCTION UUID_TO_BIN(uuid CHAR(36)) RETURNS BINARY(16) DETERMINISTIC RETURN UNHEX(REPLACE(uuid, '-', ''));
DROP FUNCTION IF EXISTS BIN_TO_UUID;
CREATE FUNCTION BIN_TO_UUID(b BINARY(16)) RETURNS CHAR(36) DETERMINISTIC RETURN IF(b IS NULL, NULL, LOWER(CONCAT_WS('-', SUBSTR(HEX(b), 1, 8), SUBSTR(HEX(b), 9, 4), SUBSTR(HEX(b), 13, 4), SUBSTR(HEX(b), 17, 4), SUBSTR(HEX(b), 21, 12))));
`

async function applyUuidCompatFunctions(conn: import('mysql2/promise').Connection): Promise<void> {
    for (const stmt of splitStatements(MYSQL_57_UUID_FUNCTIONS_SQL)) await conn.query(stmt)
}

// First-time setup: the runner's pool does not exist yet (the worker DB
// must be created before the pool can authenticate against it). This path
// opens a one-shot direct connection to bootstrap the worker DB and
// apply schema+seed. Subsequent reseeds borrow from the runner's pool —
// see `onReseed` below. `needsUuidCompat` (MySQL 5.7) creates the
// user-defined UUID_TO_BIN/BIN_TO_UUID before schema/seed so both resolve.
async function bootstrapWorkerDbSchemaAndSeed(host: string, port: number, needsUuidCompat: boolean): Promise<string> {
    const workerDb = workerName(BASE_WORKER_DB_NAME)
    const mysql2 = await import('mysql2/promise')

    if (!workerDbEnsured) {
        // Ensure the worker DB exists. `CREATE DATABASE IF NOT EXISTS`
        // is race-safe across workers — the first writer wins, the
        // rest no-op. Pin the charset to utf8mb4 so tables inherit it
        // regardless of the server's default: MySQL 8.0+ already defaults
        // to utf8mb4, but 5.7 (the `oldest` tier, reached via
        // `--docker-version closest`) still defaults to latin1, which makes
        // the library's forced `collate utf8mb4_*` invalid.
        const adminConn = await connectWithRetry(mysql2, {
            host, port,
            user: 'root', password: ROOT_PASSWORD,
        })
        try {
            await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${workerDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`)
        } finally {
            await adminConn.end()
        }
        workerDbEnsured = true
    }

    const conn = await connectWithRetry(mysql2, {
        host, port,
        user: 'root', password: ROOT_PASSWORD,
        database: workerDb,
        multipleStatements: true,
    })
    try {
        if (needsUuidCompat) await applyUuidCompatFunctions(conn)
        await applySchemaAndSeedOnConnection(conn)
    } finally {
        await conn.end()
    }
    return workerDb
}

async function connectWithRetry(mysql2: typeof import('mysql2/promise'), config: any): Promise<import('mysql2/promise').Connection> {
    const deadline = Date.now() + 30_000
    let lastError: unknown
    while (Date.now() < deadline) {
        try {
            return await mysql2.createConnection(config)
        } catch (err) {
            lastError = err
            await new Promise(r => setTimeout(r, 500))
        }
    }
    throw lastError
}

// ---- Real mysql (docker) test context -----------------------------------

export interface MySqlTestSpec {
    label: string
    canonicalForDocs?: boolean
    compatibilityVersion?: number
}

export function createMySql2PoolTestContext(spec: MySqlTestSpec): MySqlTestContext {
    const version = spec.label.split(' / ')[0] ?? ''
    const connector = spec.label.split(' / ')[1] ?? ''
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ true, version, connector)
    const image = imageForCell(DATABASE, version, realDbEnabled)
    // MySQL 5.7 (the `oldest` tier) needs two compatibility shims the 8.0+ images
    // don't: the runner emulates the missing built-in UUID_TO_BIN/BIN_TO_UUID (so
    // the default 'binary' uuid strategy works) and pins the connection collation
    // to the server's utf8mb4 default (see the pool `charset` below).
    const isMysql5 = image.startsWith('mysql:5')
    const buildRunner = memoizeSharedRunner(async (params: { host: string; port: number; workerDb: string }) => {
        // MySql2PoolQueryRunner wraps the callback-style Pool, not the
        // promise-style one — import accordingly.
        const mysql2 = await import('mysql2')
        const { MySql2PoolQueryRunner } = await import('../../../src/queryRunners/MySql2PoolQueryRunner.js')
        const pool = mysql2.createPool({
            host: params.host, port: params.port,
            user: 'root', password: ROOT_PASSWORD,
            database: params.workerDb,
            // MySQL 5.7's utf8mb4 default collation is `utf8mb4_general_ci`, which
            // the worker DB and the emulated BIN_TO_UUID (whose CHAR result inherits
            // the DB default) both use. mysql2 otherwise negotiates
            // `utf8mb4_unicode_ci` for the connection, so a literal compared against
            // a function result would raise ER_CANT_AGGREGATE_2COLLATIONS. Pin the
            // connection collation to the DB default so both sides agree — this is
            // exactly what mysql2 negotiates automatically on 8.0+ (server default),
            // so the 8.0/9 tiers don't need it.
            ...(isMysql5 ? { charset: 'UTF8MB4_GENERAL_CI' } : {}),
            connectionLimit: 4,
            // Be patient through the parallel-pass connection storm — see the
            // mariadb runner for the full rationale. mysql2 queues acquires
            // (it has no acquireTimeout — a waiter blocks until a connection
            // frees up), so the only knob that matters here is the
            // per-connection connectTimeout: raise it so the initial socket
            // connect rides out the thundering herd instead of failing fast.
            connectTimeout: 20_000,
        })
        return {
            runner: new MySql2PoolQueryRunner(pool),
            shutdown: async () => { await pool.end() },
        }
    })

    return decorateMySqlContext(createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'mySql',
        realDbEnabled,
        async createRealRunner(forceNew = false) {
            const container = await containers.getFor(image).acquire()
            const host = container.getHost()
            const port = container.getMappedPort(3306)
            const workerDb = await bootstrapWorkerDbSchemaAndSeed(host, port, isMysql5)
            // `forceNew` rebuilds a fresh runner (clean transaction state) when
            // the harness discards a connection poisoned by a failed commit.
            return await buildRunner({ host, port, workerDb }, forceNew)
        },
        async onReseed(runner) {
            // Reuse the runner's existing mysql2 pool. The runner uses the
            // callback-style pool; `.promise()` exposes the promise wrapper
            // so the async borrow flow stays clean. Borrowing avoids the
            // auth handshake on every reseed.
            const pool = runner.getNativeRunner() as import('mysql2').Pool
            const conn = await pool.promise().getConnection()
            try {
                await applyResetAndSeedOnConnection(conn)
            } finally {
                conn.release()  // returns to pool synchronously
            }
        },
        async onDown() {
            await containers.getFor(image).release()
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    }))
}
