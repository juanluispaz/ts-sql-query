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
import { createTestContext, type TestContext } from '../../lib/testContext.js'
import { DBConnection } from './domain/connection.js'

const DATABASE = 'mysql'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(__dirname, './domain/schema.sql')
const SEED_PATH = resolve(__dirname, './domain/seed.sql')

const MYSQL_IMAGE = 'mysql:9'
const ROOT_PASSWORD = 'mysql-test-pass'
const DB_NAME = 'tssqlquery'

type StartedContainer = {
    getHost(): string
    getMappedPort(p: number): number
    stop(): Promise<void>
}

let containerPromise: Promise<StartedContainer> | null = null
let refCount = 0

async function acquireContainer(): Promise<StartedContainer> {
    if (containerPromise === null) {
        const { GenericContainer, Wait } = await import('testcontainers')
        containerPromise = new GenericContainer(MYSQL_IMAGE)
            .withEnvironment({
                MYSQL_ROOT_PASSWORD: ROOT_PASSWORD,
                MYSQL_DATABASE: DB_NAME,
            })
            .withExposedPorts(3306)
            .withWaitStrategy(Wait.forLogMessage(/ready for connections/, 2))
            .start() as unknown as Promise<StartedContainer>
    }
    refCount++
    return await containerPromise
}

async function releaseContainer(): Promise<void> {
    refCount--
    if (refCount === 0 && containerPromise) {
        const c = await containerPromise
        containerPromise = null
        await c.stop()
    }
}

function splitStatements(sql: string): string[] {
    return sql
        .split(/;\s*(?:\n|$)/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
}

async function applySchemaAndSeed(host: string, port: number): Promise<void> {
    const mysql2 = await import('mysql2/promise')
    // mysql:9 logs "ready for connections" during its initial bootstrap and
    // again after the real restart; even gating on the second occurrence,
    // the server occasionally drops the first client connection mid-handshake
    // (PROTOCOL_CONNECTION_LOST). Retry the initial connect for a few seconds
    // so the test doesn't race the container's last init step.
    const conn = await connectWithRetry(mysql2, {
        host, port,
        user: 'root', password: ROOT_PASSWORD,
        database: DB_NAME,
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

export function createMySql2PoolTestContext(spec: MySqlTestSpec): TestContext<DBConnection> {
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ true)
    let cleanup: (() => Promise<void>) | null = null

    return createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'mySql',
        realDbEnabled,
        async createRealRunner() {
            const container = await acquireContainer()
            const host = container.getHost()
            const port = container.getMappedPort(3306)
            await applySchemaAndSeed(host, port)

            // MySql2PoolQueryRunner wraps the callback-style Pool, not the
            // promise-style one — import accordingly.
            const mysql2 = await import('mysql2')
            const { MySql2PoolQueryRunner } = await import('../../../src/queryRunners/MySql2PoolQueryRunner.js')
            const pool = mysql2.createPool({
                host, port,
                user: 'root', password: ROOT_PASSWORD,
                database: DB_NAME,
                connectionLimit: 4,
            })
            cleanup = async () => { await pool.end() }
            return {
                runner: new MySql2PoolQueryRunner(pool),
                shutdown: async () => { if (cleanup) await cleanup(); cleanup = null },
            }
        },
        async onReseed() {
            if (!containerPromise) return
            const c = await containerPromise
            await applySchemaAndSeed(c.getHost(), c.getMappedPort(3306))
        },
        async onDown() {
            await releaseContainer()
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    })
}
