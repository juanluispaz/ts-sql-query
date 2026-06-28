// Factories that produce a `TestContext` for the sqlserver database.
//
// One factory per connector. Each `test/db/sqlserver/<version>/<connector>/setup.ts`
// is a thin call into the matching factory.
//
// The real engine runs in a generic testcontainers container; the mssql
// driver is loaded via dynamic import inside `createRealRunner` so the
// file parses with docker off (no testcontainer call ever fires).

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
 * `TestContext<DBConnection>` extended with SqlServer-specific connection
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
export interface SqlServerTestContext extends TestContext<DBConnection> {
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
}

/**
 * Wrap a base `TestContext<DBConnection>` with SqlServer-specific
 * connection factories. Each `withXxx` reaches into the live
 * `ctx.conn.queryRunner` (the shared interceptor) — `ctx.up()` must
 * have run before any helper is called.
 */
function decorateSqlServerContext(base: TestContext<DBConnection>): SqlServerTestContext {
    return Object.assign(base, {
        exampleInsensitiveCollation: 'Latin1_General_CI_AS',
        withInsensitiveCollation(collation: string | undefined): DBConnection {
            class C extends DBConnection {
                protected override insensitiveCollation: string | undefined = collation
            }
            return new C(base.conn.queryRunner)
        },
    })
}

const DATABASE = 'sqlserver'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(__dirname, './domain/schema.sql')
const SEED_PATH = resolve(__dirname, './domain/seed.sql')
// Data-only reset used by the per-test reseed (onReseed) in place of the full
// schema rebuild — see ./domain/reset.sql. schema.sql's DROP+CREATE is kept
// only for the once-per-worker bootstrap.
const RESET_PATH = resolve(__dirname, './domain/reset.sql')

// Pin to 2025-latest to align with `all-examples`. SQL Server 2025
// adds ANSI-compliant `LENGTH`, which the `docs.sql-fragments` test
// relies on via a portable raw SQL fragment.
const MSSQL_IMAGE = 'mcr.microsoft.com/mssql/server:2025-latest'
const SA_PASSWORD = 'StrongPass1!Sqlsrv'

type StartedContainer = {
    getHost(): string
    getMappedPort(p: number): number
    stop(): Promise<unknown>
}

// Container is started lazily on the first acquire and kept alive for the
// entire test process — see `test/lib/containerLifecycle.ts`. With the
// `TESTCONTAINERS_REUSE_ENABLE=true` env var the container also survives
// across separate `bun test` invocations (the SQL Server image is heavy
// enough that the difference is very visible during iterative work).
// `lockKey` serialises the first-acquire across worker processes so the
// reuse-lookup-then-create dance in testcontainers (which holds only an
// in-process lock) doesn't spawn duplicate containers under cold start.
const container = createContainerHandle<StartedContainer>(async () => {
    const { GenericContainer, Wait } = await import('testcontainers')
    const builder = new GenericContainer(MSSQL_IMAGE)
        .withEnvironment({
            ACCEPT_EULA: 'Y',
            MSSQL_SA_PASSWORD: SA_PASSWORD,
            MSSQL_PID: 'Developer',
        })
        .withExposedPorts(1433)
        .withWaitStrategy(Wait.forLogMessage(/SQL Server is now ready for client connections/, 1))
    if (reuseEnabled()) builder.withReuse()
    const started = (await builder.start()) as unknown as StartedContainer
    // Runs once per process. Validates the schema/seed hash against the
    // meta DB and, when stale, drops every per-worker test DB so they
    // get rebuilt cleanly. `sp_getapplock` serialises this across
    // workers running in parallel processes.
    await validateOrResetForReuse(started.getHost(), started.getMappedPort(1433))
    return started
}, { lockKey: MSSQL_IMAGE })
const acquireContainer = container.acquire
const releaseContainer = container.release

async function validateOrResetForReuse(host: string, port: number): Promise<void> {
    const [schemaSql, seedSql] = await Promise.all([
        readFile(SCHEMA_PATH, 'utf8'),
        readFile(SEED_PATH, 'utf8'),
    ])
    const currentHash = await hashSqlFiles(schemaSql, seedSql)

    // Single connection scoped to `master`. `sp_getapplock` with
    // session lock owner is connection-scoped, so we hold one pool
    // (max=1) for the entire validate-and-maybe-reset sequence.
    const sql = await import('mssql')
    const masterPool = await connectWithRetry(sql, {
        server: host, port,
        user: 'sa', password: SA_PASSWORD,
        database: 'master',
        options: { encrypt: false, trustServerCertificate: true },
        pool: { max: 1, min: 1, idleTimeoutMillis: 30_000 },
    })
    try {
        const lockRes = await masterPool.request()
            .input('Resource', sql.NVarChar, VALIDATE_LOCK_NAME)
            .input('LockMode', sql.NVarChar, 'Exclusive')
            .input('LockOwner', sql.NVarChar, 'Session')
            .input('LockTimeout', sql.Int, 60_000)
            .execute('sp_getapplock')
        // sp_getapplock returns >= 0 on success (0 = granted immediately,
        // 1 = granted after wait), < 0 on failure.
        const lockResult = lockRes.returnValue
        if (typeof lockResult !== 'number' || lockResult < 0) {
            throw new Error(`sqlserver validator: sp_getapplock returned ${lockResult}`)
        }
        try {
            let storedHash: string | null = null
            try {
                const res = await masterPool.request().query<{ hash: string }>(
                    `SELECT TOP 1 hash FROM ${META_DB_NAME}.dbo.${SCHEMA_HASH_META_TABLE}`,
                )
                storedHash = res.recordset[0]?.hash ?? null
            } catch {
                // Meta DB / table missing — fresh container.
            }

            if (storedHash === currentHash) return

            // Enumerate and drop every existing worker DB — both the
            // parallel-on pattern (`tssqlquery_w%`) and the
            // parallel-off bare name (`tssqlquery`) — so a switch
            // between modes leaves no stragglers behind.
            // SINGLE_USER kicks every other client off the database so
            // the DROP can proceed even when a previous test process
            // left lingering pool sockets behind.
            const workerDbs = await masterPool.request()
                .input('base', sql.NVarChar, BASE_WORKER_DB_NAME)
                .input('like', sql.NVarChar, workerNameLikePattern(BASE_WORKER_DB_NAME))
                .query<{ name: string }>(
                    `SELECT name FROM sys.databases
                      WHERE name = @base OR name LIKE @like ESCAPE '\\'`,
                )
            for (const { name } of workerDbs.recordset) {
                await masterPool.request().batch(`
                    IF DB_ID('${name}') IS NOT NULL BEGIN
                        ALTER DATABASE [${name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                        DROP DATABASE [${name}];
                    END
                `)
            }
            await masterPool.request().batch(`
                IF DB_ID('${META_DB_NAME}') IS NOT NULL BEGIN
                    ALTER DATABASE [${META_DB_NAME}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                    DROP DATABASE [${META_DB_NAME}];
                END
                CREATE DATABASE [${META_DB_NAME}]
            `)
            // The CREATE TABLE has to run inside the target database, so
            // we briefly USE [${META_DB_NAME}] — and switch back to master
            // immediately. SQL Server application locks are placed in the
            // database in which sp_getapplock was called (master here);
            // calling sp_releaseapplock from a different database context
            // raises 1223 ("Cannot release the application lock … because
            // it is not currently held"). The INSERT below is
            // fully-qualified so it works from master context.
            await masterPool.request().batch(
                `USE [${META_DB_NAME}]; CREATE TABLE ${SCHEMA_HASH_META_TABLE} (hash NVARCHAR(64) NOT NULL); USE [master]`,
            )
            await masterPool.request()
                .input('h', sql.NVarChar, currentHash)
                .query(
                    `INSERT INTO ${META_DB_NAME}.dbo.${SCHEMA_HASH_META_TABLE} (hash) VALUES (@h)`,
                )
        } finally {
            await masterPool.request()
                .input('Resource', sql.NVarChar, VALIDATE_LOCK_NAME)
                .input('LockOwner', sql.NVarChar, 'Session')
                .execute('sp_releaseapplock')
        }
    } finally {
        await masterPool.close()
    }
}

async function connectWithRetry(sql: typeof import('mssql'), config: any): Promise<import('mssql').ConnectionPool> {
    // SQL Server has no arm64 image, so on Apple Silicon it runs EMULATED
    // (amd64) and is markedly slower; under the end-of-run convergence storm
    // (every remaining worker piling onto the heavy container at once through
    // macOS Docker's userspace port proxy) it gets briefly unreachable.
    //
    // Two layers of tolerance: a 30 s per-attempt `connectionTimeout` (so a
    // single connect is patient) AND a 180 s outer retry window. The patient
    // per-attempt value matters beyond the INITIAL connect this loop guards —
    // it is baked into the returned pool, so the connections the pool creates
    // ON DEMAND later (e.g. the per-cell schema/seed apply, the runner pool's
    // mid-test queries) are patient too; the old fast 5 s default made those
    // fail with "Failed to connect in 5000ms" the moment the container
    // stuttered. Warmup already absorbs the cold-start ELOGIN window, so a fast
    // retry buys nothing. `requestTimeout` is likewise generous for the slow
    // emulated engine. A caller can still override either (the runner pool
    // tunes its pool sizing on top).
    const deadline = Date.now() + 180_000
    let lastError: unknown
    while (Date.now() < deadline) {
        // Defaults first so a value in `config` still wins.
        const pool = new sql.ConnectionPool({ connectionTimeout: 30_000, requestTimeout: 60_000, ...config })
        try {
            await pool.connect()
            return pool
        } catch (err) {
            lastError = err
            try { await pool.close() } catch { /* ignore */ }
            await new Promise(r => setTimeout(r, 500))
        }
    }
    throw lastError
}

// SQL Server batches are separated by a `GO` line, NOT by `;`. Splitting on
// `;` would also break session-scoped settings (e.g. `SET IDENTITY_INSERT
// foo ON;` followed by an `INSERT` in a separate request would lose the
// setting because mssql's connection pool picks a fresh connection per
// `request().query()` call). One batch per `GO` keeps related statements on
// the same connection.
function splitBatch(sql: string): string[] {
    return sql
        .split(/^\s*GO\s*$/mi)
        .map(s => s.trim())
        .filter(s => s.length > 0)
}

// Once-per-process flag: the worker DB only needs creating the first
// time the runner starts inside a given process. Subsequent
// `applySchemaAndSeedToWorkerDb` calls skip the master pool entirely.
let workerDbEnsured = false

async function applySchemaAndSeedOnPool(pool: import('mssql').ConnectionPool): Promise<void> {
    const [schemaSql, seedSql] = await Promise.all([
        readFile(SCHEMA_PATH, 'utf8'),
        readFile(SEED_PATH, 'utf8'),
    ])
    for (const stmt of splitBatch(schemaSql)) await pool.request().query(stmt)
    for (const stmt of splitBatch(seedSql)) await pool.request().query(stmt)
}

// Data-only baseline restore used by the per-test reseed: reset.sql (DELETE +
// DBCC CHECKIDENT + ALTER SEQUENCE RESTART) instead of the heavy schema.sql,
// then the same seed. Leaves the exact post-bootstrap state without the
// DROP+CREATE catalog churn.
async function applyResetAndSeedOnPool(pool: import('mssql').ConnectionPool): Promise<void> {
    const [resetSql, seedSql] = await Promise.all([
        readFile(RESET_PATH, 'utf8'),
        readFile(SEED_PATH, 'utf8'),
    ])
    for (const stmt of splitBatch(resetSql)) await pool.request().query(stmt)
    for (const stmt of splitBatch(seedSql)) await pool.request().query(stmt)
}

// First-time setup: the runner's pool does not exist yet (the worker DB
// must be created first). This path opens a one-shot direct pool to
// bootstrap the worker DB and apply schema+seed. Subsequent reseeds
// borrow from the runner's pool — see `onReseed` below.
async function bootstrapWorkerDbSchemaAndSeed(host: string, port: number): Promise<string> {
    const workerDb = workerName(BASE_WORKER_DB_NAME)
    const sql = await import('mssql')
    if (!workerDbEnsured) {
        // SQL Server logs "ready for client connections" before the SA
        // login is actually usable (the SA password is materialised a
        // little later as the entrypoint script finishes). Retry the
        // initial connect for a few seconds so the test isn't racing
        // the container's last init step and intermittently failing
        // with ELOGIN. Pin the pool to a single connection so the
        // sp_getapplock and the CREATE DATABASE that follows it run
        // on the same backend — sp_getapplock's `LockOwner='Session'`
        // scope is per-connection.
        const masterPool = await connectWithRetry(sql, {
            server: host, port,
            user: 'sa', password: SA_PASSWORD,
            database: 'master',
            options: { encrypt: false, trustServerCertificate: true },
            pool: { max: 1, min: 1, idleTimeoutMillis: 30_000 },
        })
        try {
            // SQL Server can't handle N concurrent `CREATE DATABASE`
            // calls cleanly — under 12 parallel workers it returns
            // 1802 ("Some file names listed could not be created")
            // and 5170 because the file slots collide while a peer
            // is mid-create. Serialise the creation step across
            // workers via the same named lock the validator already
            // uses; sp_getapplock with `LockOwner='Session'` is
            // released when the connection closes.
            await masterPool.request()
                .input('Resource', sql.NVarChar, VALIDATE_LOCK_NAME)
                .input('LockMode', sql.NVarChar, 'Exclusive')
                .input('LockOwner', sql.NVarChar, 'Session')
                .input('LockTimeout', sql.Int, 60_000)
                .execute('sp_getapplock')
            await masterPool.request().query(
                `IF DB_ID('${workerDb}') IS NULL CREATE DATABASE [${workerDb}]`,
            )
        } finally {
            await masterPool.close()
        }
        workerDbEnsured = true
    }

    // Route the worker-DB bootstrap pool through the same retry helper as the
    // master pool and the runner pool. This was the one remaining unguarded
    // `connect()` — under the parallel-pass connection storm it could time out
    // with no log line and surface as an unnamed beforeAll failure.
    const pool = await connectWithRetry(sql, {
        server: host, port,
        user: 'sa', password: SA_PASSWORD,
        database: workerDb,
        options: { encrypt: false, trustServerCertificate: true },
    })
    try {
        await applySchemaAndSeedOnPool(pool)
    } finally {
        await pool.close()
    }
    return workerDb
}

// ---- Real sqlserver (docker) test context -------------------------------

export interface MssqlTestSpec {
    label: string
    canonicalForDocs?: boolean
    compatibilityVersion?: number
}

export function createMssqlPoolTestContext(spec: MssqlTestSpec): SqlServerTestContext {
    const version = spec.label.split(' / ')[0] ?? ''
    const connector = spec.label.split(' / ')[1] ?? ''
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ true, version, connector)
    const buildRunner = memoizeSharedRunner(async (params: { host: string; port: number; workerDb: string }) => {
        const sql = await import('mssql')
        const { MssqlPoolQueryRunner } = await import('../../../src/queryRunners/MssqlPoolQueryRunner.js')
        // Use the same retry helper that already guards the
        // admin/master pool — under 12-worker parallelism several
        // workers can hit the container's pool simultaneously and
        // the first connect occasionally times out with no log
        // line, leaving the test as an unnamed beforeAll failure.
        const pool = await connectWithRetry(sql, {
            server: params.host, port: params.port,
            user: 'sa', password: SA_PASSWORD,
            database: params.workerDb,
            options: { encrypt: false, trustServerCertificate: true },
            // Tolerance for OBTAINING a connection under the end-of-run
            // convergence storm. This pool is long-lived and creates
            // connections ON DEMAND mid-test (min: 0 / lazy), so the default
            // fast 5 s connect would fail a query with "Failed to connect in
            // 5000ms" the moment the emulated container is briefly saturated.
            // Patient connect + request + pool-acquire timeouts ride it out;
            // tests are sequential per worker, so max stays small.
            connectionTimeout: 30_000,
            requestTimeout: 60_000,
            pool: {
                max: 4,
                min: 0,
                acquireTimeoutMillis: 90_000,
                createTimeoutMillis: 35_000,
                idleTimeoutMillis: 30_000,
            },
        })
        return {
            runner: new MssqlPoolQueryRunner(pool),
            shutdown: async () => { await pool.close() },
        }
    })

    return decorateSqlServerContext(createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'sqlServer',
        realDbEnabled,
        async createRealRunner(forceNew = false) {
            const container = await acquireContainer()
            const host = container.getHost()
            const port = container.getMappedPort(1433)
            const workerDb = await bootstrapWorkerDbSchemaAndSeed(host, port)
            // `forceNew` rebuilds a fresh runner (clean transaction state) when
            // the harness discards a connection poisoned by a failed commit.
            return await buildRunner({ host, port, workerDb }, forceNew)
        },
        async onReseed(runner) {
            // Reuse the runner's existing mssql connection pool — its
            // `request()` calls borrow a backend from the pool. Avoids
            // standing up a brand new ConnectionPool per reseed.
            const pool = runner.getNativeRunner() as import('mssql').ConnectionPool
            await applyResetAndSeedOnPool(pool)
        },
        async onDown() {
            await releaseContainer()
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    }))
}
