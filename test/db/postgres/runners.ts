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
import { createTestContext, type TestContext } from '../../lib/testContext.js'
import { DBConnection } from './domain/connection.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'

const DATABASE = 'postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(__dirname, './domain/schema.sql')
const SEED_PATH = resolve(__dirname, './domain/seed.sql')

const POSTGRES_IMAGE = 'postgres:18-alpine'

// ---- Shared testcontainers postgres -------------------------------------

let containerPromise: Promise<StartedPostgreSqlContainer> | null = null
let refCount = 0

async function acquireContainer(): Promise<StartedPostgreSqlContainer> {
    if (containerPromise === null) {
        containerPromise = new PostgreSqlContainer(POSTGRES_IMAGE).start()
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

async function applySchemaAndSeedToPool(uri: string): Promise<void> {
    const pool = new Pool({ connectionString: uri })
    try {
        const [schemaSql, seedSql] = await Promise.all([
            readFile(SCHEMA_PATH, 'utf8'),
            readFile(SEED_PATH, 'utf8'),
        ])
        await pool.query(schemaSql)
        await pool.query(seedSql)
    } finally {
        await pool.end()
    }
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
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ true)
    let containerUri: string | null = null

    return createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'postgreSql',
        realDbEnabled,
        async createRealRunner() {
            const container = await acquireContainer()
            containerUri = container.getConnectionUri()
            await applySchemaAndSeedToPool(containerUri)
            return await spec.createRealRunner(containerUri)
        },
        async onReseed() {
            if (containerUri) await applySchemaAndSeedToPool(containerUri)
        },
        async onDown() {
            containerUri = null
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

export function createPgLiteTestContext(spec: PgLiteTestSpec): TestContext<DBConnection> {
    // PgLite is in-process — its real-DB branch fires whenever this
    // database is in scope, regardless of the Docker flag.
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ false)
    let db: import('@electric-sql/pglite').PGlite | null = null

    return createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'postgreSql',
        realDbEnabled,
        timeoutMs: 30_000,
        async createRealRunner() {
            const { PGlite } = await import('@electric-sql/pglite')
            const { PgLiteQueryRunner } = await import('../../../src/queryRunners/PgLiteQueryRunner.js')
            db = await PGlite.create('memory://')
            const [schemaSql, seedSql] = await Promise.all([
                readFile(SCHEMA_PATH, 'utf8'),
                readFile(SEED_PATH, 'utf8'),
            ])
            await db.exec(schemaSql)
            await db.exec(seedSql)
            return {
                runner: new PgLiteQueryRunner(db),
                shutdown: async () => {
                    if (db) await db.close()
                    db = null
                },
            }
        },
        async onReseed() {
            if (!db) return
            const [schemaSql, seedSql] = await Promise.all([
                readFile(SCHEMA_PATH, 'utf8'),
                readFile(SEED_PATH, 'utf8'),
            ])
            await db.exec(schemaSql)
            await db.exec(seedSql)
        },
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
    const realDbEnabled = isBun && isRealDbEnabled(DATABASE, /* needsDocker */ true)
    let containerUri: string | null = null

    return createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'postgreSql',
        realDbEnabled,
        async createRealRunner() {
            const container = await acquireContainer()
            containerUri = container.getConnectionUri()
            await applySchemaAndSeedToPool(containerUri)
            return await spec.createRealRunner(containerUri)
        },
        async onReseed() {
            if (containerUri) await applySchemaAndSeedToPool(containerUri)
        },
        async onDown() {
            containerUri = null
            await releaseContainer()
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    })
}
