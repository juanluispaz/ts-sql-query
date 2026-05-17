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

const DATABASE = 'mariadb'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(__dirname, './domain/schema.sql')
const SEED_PATH = resolve(__dirname, './domain/seed.sql')

// `mariadb` (no tag) tracks the latest stable image, matching what the
// `bun:all-examples` script uses for the `newest` cell.
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
// across separate `bun test` invocations.
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
})
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

async function applySchemaAndSeedToWorkerDb(host: string, port: number): Promise<string> {
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
        const [schemaSql, seedSql] = await Promise.all([
            readFile(SCHEMA_PATH, 'utf8'),
            readFile(SEED_PATH, 'utf8'),
        ])
        for (const stmt of splitStatements(schemaSql)) await conn.query(stmt)
        for (const stmt of splitStatements(seedSql)) await conn.query(stmt)
    } finally {
        await conn.end()
    }
    return workerDb
}

async function connectWithRetry(mariadb: typeof import('mariadb'), config: any): Promise<import('mariadb').Connection> {
    const deadline = Date.now() + 30_000
    let lastError: unknown
    while (Date.now() < deadline) {
        try {
            return await mariadb.createConnection(config)
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

export function createMariaDBPoolTestContext(spec: MariaDBTestSpec): TestContext<DBConnection> {
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ true)
    const buildRunner = memoizeSharedRunner(async (params: { host: string; port: number; workerDb: string }) => {
        const mariadb = await import('mariadb')
        const { MariaDBPoolQueryRunner } = await import('../../../src/queryRunners/MariaDBPoolQueryRunner.js')
        const pool = mariadb.createPool({
            host: params.host, port: params.port,
            user: 'root', password: ROOT_PASSWORD,
            database: params.workerDb,
            connectionLimit: 4,
        })
        return {
            runner: new MariaDBPoolQueryRunner(pool),
            shutdown: async () => { await pool.end() },
        }
    })

    return createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'mariaDB',
        realDbEnabled,
        async createRealRunner() {
            const container = await acquireContainer()
            const host = container.getHost()
            const port = container.getMappedPort(3306)
            const workerDb = await applySchemaAndSeedToWorkerDb(host, port)
            return await buildRunner({ host, port, workerDb })
        },
        async onReseed() {
            const c = await acquireContainer()
            await applySchemaAndSeedToWorkerDb(c.getHost(), c.getMappedPort(3306))
        },
        async onDown() {
            await releaseContainer()
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    })
}
