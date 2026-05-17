// Factories that produce a `TestContext` for the oracle database.
//
// One factory per connector. Each `test/db/oracle/<version>/<connector>/setup.ts`
// is a thin call into the matching factory.
//
// The real engine runs in a generic testcontainers container (gvenzl/oracle-free
// image — Oracle Database Free 23ai). The oracledb driver and runner are
// loaded via dynamic import inside `createRealRunner` so the file parses
// with docker off (no testcontainer call ever fires).

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isRealDbEnabled } from '../../lib/backends.js'
import { createTestContext, type TestContext } from '../../lib/testContext.js'
import { DBConnection } from './domain/connection.js'

const DATABASE = 'oracle'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(__dirname, './domain/schema.sql')
const SEED_PATH = resolve(__dirname, './domain/seed.sql')

const ORACLE_IMAGE = 'gvenzl/oracle-free:23-slim-faststart'
const ORACLE_PASSWORD = 'OracleTestPass1!'
const SERVICE_NAME = 'FREEPDB1'

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
        containerPromise = new GenericContainer(ORACLE_IMAGE)
            .withEnvironment({
                ORACLE_PASSWORD,
            })
            .withExposedPorts(1521)
            .withWaitStrategy(Wait.forLogMessage(/DATABASE IS READY TO USE/, 1))
            .withStartupTimeout(300_000)
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

// Oracle statements can contain semicolons inside PL/SQL anonymous blocks
// (`BEGIN ... END;`). Naively splitting on `;` would break those. The
// schema/seed files keep one PL/SQL block per line so we can split on
// blank-line boundaries, fall back to `;` at end-of-line otherwise.
function splitStatements(sql: string): string[] {
    return sql
        .split(/^\s*$/m)
        .flatMap(b => b.split(/;\s*(?:\n|$)/))
        .map(s => s.trim())
        .filter(s => s.length > 0)
}

async function applySchemaAndSeed(host: string, port: number): Promise<void> {
    const oracledb = await import('oracledb')
    const conn = await oracledb.getConnection({
        user: 'system',
        password: ORACLE_PASSWORD,
        connectString: `${host}:${port}/${SERVICE_NAME}`,
    })
    try {
        const [schemaSql, seedSql] = await Promise.all([
            readFile(SCHEMA_PATH, 'utf8'),
            readFile(SEED_PATH, 'utf8'),
        ])
        for (const stmt of splitStatements(schemaSql)) {
            await conn.execute(stmt)
        }
        for (const stmt of splitStatements(seedSql)) {
            await conn.execute(stmt)
        }
        await conn.commit()
    } finally {
        await conn.close()
    }
}

// ---- Real oracle (docker) test context ----------------------------------

export interface OracleTestSpec {
    label: string
    canonicalForDocs?: boolean
    compatibilityVersion?: number
}

export function createOracleDBPoolTestContext(spec: OracleTestSpec): TestContext<DBConnection> {
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ true)
    let cleanup: (() => Promise<void>) | null = null

    return createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'oracle',
        realDbEnabled,
        timeoutMs: 300_000,
        async createRealRunner() {
            const container = await acquireContainer()
            const host = container.getHost()
            const port = container.getMappedPort(1521)
            await applySchemaAndSeed(host, port)

            const oracledb = await import('oracledb')
            const { OracleDBPoolQueryRunner } = await import('../../../src/queryRunners/OracleDBPoolQueryRunner.js')
            const pool = await oracledb.createPool({
                user: 'system',
                password: ORACLE_PASSWORD,
                connectString: `${host}:${port}/${SERVICE_NAME}`,
                poolMin: 1,
                poolMax: 4,
            })
            cleanup = async () => { await pool.close(0) }
            return {
                runner: new OracleDBPoolQueryRunner(pool),
                shutdown: async () => { if (cleanup) await cleanup(); cleanup = null },
            }
        },
        async onReseed() {
            if (!containerPromise) return
            const c = await containerPromise
            await applySchemaAndSeed(c.getHost(), c.getMappedPort(1521))
        },
        async onDown() {
            await releaseContainer()
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    })
}
