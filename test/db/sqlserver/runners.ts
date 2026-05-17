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
import { createTestContext, type TestContext } from '../../lib/testContext.js'
import { DBConnection } from './domain/connection.js'

const DATABASE = 'sqlserver'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(__dirname, './domain/schema.sql')
const SEED_PATH = resolve(__dirname, './domain/seed.sql')

// Pin to 2025-latest to align with `bun:all-examples`. SQL Server 2025
// adds ANSI-compliant `LENGTH`, which the `docs.sql-fragments` test
// relies on via a portable raw SQL fragment.
const MSSQL_IMAGE = 'mcr.microsoft.com/mssql/server:2025-latest'
const SA_PASSWORD = 'StrongPass1!Sqlsrv'
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
        containerPromise = new GenericContainer(MSSQL_IMAGE)
            .withEnvironment({
                ACCEPT_EULA: 'Y',
                MSSQL_SA_PASSWORD: SA_PASSWORD,
                MSSQL_PID: 'Developer',
            })
            .withExposedPorts(1433)
            .withWaitStrategy(Wait.forLogMessage(/SQL Server is now ready for client connections/, 1))
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

async function connectWithRetry(sql: typeof import('mssql'), config: any): Promise<import('mssql').ConnectionPool> {
    const deadline = Date.now() + 30_000
    let lastError: unknown
    while (Date.now() < deadline) {
        const pool = new sql.ConnectionPool(config)
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

async function applySchemaAndSeed(host: string, port: number): Promise<void> {
    const sql = await import('mssql')
    // SQL Server logs "ready for client connections" before the SA login is
    // actually usable (the SA password is materialised a little later as the
    // entrypoint script finishes). Retry the initial connect for a few
    // seconds so the test isn't racing the container's last init step and
    // intermittently failing with ELOGIN.
    const masterPool = await connectWithRetry(sql, {
        server: host, port,
        user: 'sa', password: SA_PASSWORD,
        database: 'master',
        options: { encrypt: false, trustServerCertificate: true },
    })
    try {
        await masterPool.request().query(
            `IF DB_ID('${DB_NAME}') IS NULL CREATE DATABASE ${DB_NAME}`,
        )
    } finally {
        await masterPool.close()
    }

    const pool = new sql.ConnectionPool({
        server: host, port,
        user: 'sa', password: SA_PASSWORD,
        database: DB_NAME,
        options: { encrypt: false, trustServerCertificate: true },
    })
    await pool.connect()
    try {
        const [schemaSql, seedSql] = await Promise.all([
            readFile(SCHEMA_PATH, 'utf8'),
            readFile(SEED_PATH, 'utf8'),
        ])
        for (const stmt of splitBatch(schemaSql)) await pool.request().query(stmt)
        for (const stmt of splitBatch(seedSql)) await pool.request().query(stmt)
    } finally {
        await pool.close()
    }
}

// ---- Real sqlserver (docker) test context -------------------------------

export interface MssqlTestSpec {
    label: string
    canonicalForDocs?: boolean
    compatibilityVersion?: number
}

export function createMssqlPoolTestContext(spec: MssqlTestSpec): TestContext<DBConnection> {
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ true)
    let cleanup: (() => Promise<void>) | null = null

    return createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'sqlServer',
        realDbEnabled,
        async createRealRunner() {
            const container = await acquireContainer()
            const host = container.getHost()
            const port = container.getMappedPort(1433)
            await applySchemaAndSeed(host, port)

            const sql = await import('mssql')
            const { MssqlPoolQueryRunner } = await import('../../../src/queryRunners/MssqlPoolQueryRunner.js')
            const pool = new sql.ConnectionPool({
                server: host, port,
                user: 'sa', password: SA_PASSWORD,
                database: DB_NAME,
                options: { encrypt: false, trustServerCertificate: true },
            })
            await pool.connect()
            cleanup = async () => { await pool.close() }
            return {
                runner: new MssqlPoolQueryRunner(pool),
                shutdown: async () => { if (cleanup) await cleanup(); cleanup = null },
            }
        },
        async onReseed() {
            if (!containerPromise) return
            const c = await containerPromise
            await applySchemaAndSeed(c.getHost(), c.getMappedPort(1433))
        },
        async onDown() {
            await releaseContainer()
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    })
}
