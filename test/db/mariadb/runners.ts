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
const DB_NAME = 'tssqlquery'

// Lazy types from testcontainers (we only import at real-runner build time)
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
        containerPromise = new GenericContainer(MARIADB_IMAGE)
            .withEnvironment({
                MARIADB_ROOT_PASSWORD: ROOT_PASSWORD,
                MARIADB_DATABASE: DB_NAME,
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
    const mariadb = await import('mariadb')
    const pool = mariadb.createPool({
        host, port,
        user: 'root', password: ROOT_PASSWORD,
        database: DB_NAME,
        multipleStatements: true,
        connectionLimit: 1,
    })
    try {
        const [schemaSql, seedSql] = await Promise.all([
            readFile(SCHEMA_PATH, 'utf8'),
            readFile(SEED_PATH, 'utf8'),
        ])
        for (const stmt of splitStatements(schemaSql)) await pool.query(stmt)
        for (const stmt of splitStatements(seedSql)) await pool.query(stmt)
    } finally {
        await pool.end()
    }
}

// ---- Real mariadb (docker) test context ---------------------------------

export interface MariaDBTestSpec {
    label: string
    canonicalForDocs?: boolean
    compatibilityVersion?: number
}

export function createMariaDBPoolTestContext(spec: MariaDBTestSpec): TestContext<DBConnection> {
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ true)
    let cleanup: (() => Promise<void>) | null = null

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
            await applySchemaAndSeed(host, port)

            const mariadb = await import('mariadb')
            const { MariaDBPoolQueryRunner } = await import('../../../src/queryRunners/MariaDBPoolQueryRunner.js')
            const pool = mariadb.createPool({
                host, port,
                user: 'root', password: ROOT_PASSWORD,
                database: DB_NAME,
                connectionLimit: 4,
            })
            cleanup = async () => { await pool.end() }
            return {
                runner: new MariaDBPoolQueryRunner(pool),
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
