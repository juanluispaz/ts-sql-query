// Factories that produce a `TestContext` for the sqlite database.
//
// One factory per connector. Each `test/db/sqlite/<version>/<connector>/setup.ts`
// is a thin call into the matching factory.
//
// All sqlite connectors run in-process (no docker), so `needsDocker` is
// false everywhere. The exceptions that need runtime gating:
//   - `bun:sqlite` is bun-only — only fires under Bun.
//   - `node:sqlite` requires Node >= 22.5 (built-in module is gated on
//     a feature flag in some versions). We try the import and skip the
//     real branch if it throws.
//   - `better-sqlite3` is a native module that does NOT load under Bun.
//   - `sqlite3` and `sqlite-wasm-OO1` are universal under both runtimes.

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isRealDbEnabled } from '../../lib/backends.js'
import { createTestContext, type TestContext } from '../../lib/testContext.js'
import { DBConnection } from './domain/connection.js'

const DATABASE = 'sqlite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = resolve(__dirname, './domain/schema.sql')
const SEED_PATH = resolve(__dirname, './domain/seed.sql')

declare global {
    // eslint-disable-next-line no-var
    var Bun: { version: string } | undefined
}

const isBun = typeof globalThis.Bun !== 'undefined'

async function readSchemaAndSeed(): Promise<{ schema: string; seed: string }> {
    const [schema, seed] = await Promise.all([
        readFile(SCHEMA_PATH, 'utf8'),
        readFile(SEED_PATH, 'utf8'),
    ])
    return { schema, seed }
}

// Split a SQL script on semicolons at end-of-statement. SQLite drivers
// (bun:sqlite included) only execute one statement per `run()`/`prepare()`
// call, so the seed/schema files need to be chopped up before execution.
function splitStatements(sql: string): string[] {
    return sql
        .split(/;\s*(?:\n|$)/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
}

// ---- bun:sqlite (in-process, Bun-only) ----------------------------------

export interface BunSqliteTestSpec {
    label: string
    canonicalForDocs?: boolean
    compatibilityVersion?: number
}

export function createBunSqliteTestContext(spec: BunSqliteTestSpec): TestContext<DBConnection> {
    // In-process, but the connector module itself can only load under Bun.
    // Under node+vitest we keep the mock branch and never touch bun:sqlite.
    const realDbEnabled = isBun && isRealDbEnabled(DATABASE, /* needsDocker */ false)
    let db: { close(): void; exec(sql: string): unknown } | null = null

    return createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'sqlite',
        realDbEnabled,
        async createRealRunner() {
            const { Database } = await import('bun:sqlite')
            const { BunSqliteQueryRunner } = await import('../../../src/queryRunners/BunSqliteQueryRunner.js')
            const conn = new Database(':memory:')
            db = conn
            const { schema, seed } = await readSchemaAndSeed()
            for (const stmt of splitStatements(schema)) conn.exec(stmt)
            for (const stmt of splitStatements(seed)) conn.exec(stmt)
            return {
                runner: new BunSqliteQueryRunner(conn),
                shutdown: async () => {
                    if (db) db.close()
                    db = null
                },
            }
        },
        async onReseed() {
            if (!db) return
            const { schema, seed } = await readSchemaAndSeed()
            for (const stmt of splitStatements(schema)) db.exec(stmt)
            for (const stmt of splitStatements(seed)) db.exec(stmt)
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    })
}

// ---- better-sqlite3 (in-process, Node-only — does not load under Bun) ---

export interface SqliteTestSpec {
    label: string
    canonicalForDocs?: boolean
    compatibilityVersion?: number
}

export function createBetterSqlite3TestContext(spec: SqliteTestSpec): TestContext<DBConnection> {
    // better-sqlite3 has a native binding that fails to load under Bun's
    // Node API shim. We only fire the real branch outside Bun.
    const realDbEnabled = !isBun && isRealDbEnabled(DATABASE, /* needsDocker */ false)
    let db: { close(): void; exec(sql: string): unknown } | null = null

    return createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'sqlite',
        realDbEnabled,
        async createRealRunner() {
            const Database = (await import('better-sqlite3')).default
            const { BetterSqlite3QueryRunner } = await import('../../../src/queryRunners/BetterSqlite3QueryRunner.js')
            const conn = new Database(':memory:')
            db = conn
            const { schema, seed } = await readSchemaAndSeed()
            conn.exec(schema)
            conn.exec(seed)
            return {
                runner: new BetterSqlite3QueryRunner(conn),
                shutdown: async () => {
                    if (db) db.close()
                    db = null
                },
            }
        },
        async onReseed() {
            if (!db) return
            const { schema, seed } = await readSchemaAndSeed()
            db.exec(schema)
            db.exec(seed)
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    })
}

// ---- node:sqlite (in-process, Node 22.5+) -------------------------------

export function createNodeSqliteTestContext(spec: SqliteTestSpec): TestContext<DBConnection> {
    // `node:sqlite` is a built-in module added in Node 22.5. Under Bun the
    // shim does not expose it. We try the import lazily and fall back to
    // mock-only mode if the runtime does not have it.
    let resolvedRealDb: boolean | null = null
    function isNodeSqliteAvailable(): boolean {
        if (isBun) return false
        if (resolvedRealDb !== null) return resolvedRealDb
        try {
            // dynamic require to avoid bundlers complaining
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require('node:sqlite')
            resolvedRealDb = true
        } catch {
            resolvedRealDb = false
        }
        return resolvedRealDb
    }
    const realDbEnabled = isNodeSqliteAvailable() && isRealDbEnabled(DATABASE, /* needsDocker */ false)
    let db: { close(): void; exec(sql: string): unknown } | null = null

    return createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'sqlite',
        realDbEnabled,
        async createRealRunner() {
            const { DatabaseSync } = await import('node:sqlite')
            const { NodeSqliteQueryRunner } = await import('../../../src/queryRunners/NodeSqliteQueryRunner.js')
            const conn = new DatabaseSync(':memory:')
            db = conn
            const { schema, seed } = await readSchemaAndSeed()
            conn.exec(schema)
            conn.exec(seed)
            return {
                runner: new NodeSqliteQueryRunner(conn),
                shutdown: async () => {
                    if (db) db.close()
                    db = null
                },
            }
        },
        async onReseed() {
            if (!db) return
            const { schema, seed } = await readSchemaAndSeed()
            db.exec(schema)
            db.exec(seed)
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    })
}

// ---- sqlite3 (in-process, async, universal) -----------------------------

export function createSqlite3TestContext(spec: SqliteTestSpec): TestContext<DBConnection> {
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ false)
    let db: import('sqlite3').Database | null = null

    function exec(database: import('sqlite3').Database, sql: string): Promise<void> {
        return new Promise((res, rej) => database.exec(sql, e => e ? rej(e) : res()))
    }

    return createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'sqlite',
        realDbEnabled,
        async createRealRunner() {
            const sqlite3 = (await import('sqlite3')).default
            const { Sqlite3QueryRunner } = await import('../../../src/queryRunners/Sqlite3QueryRunner.js')
            const conn = new sqlite3.Database(':memory:')
            db = conn
            const { schema, seed } = await readSchemaAndSeed()
            await exec(conn, schema)
            await exec(conn, seed)
            return {
                runner: new Sqlite3QueryRunner(conn),
                shutdown: async () => {
                    if (db) await new Promise<void>(res => db!.close(() => res()))
                    db = null
                },
            }
        },
        async onReseed() {
            if (!db) return
            const { schema, seed } = await readSchemaAndSeed()
            await exec(db, schema)
            await exec(db, seed)
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    })
}

// ---- @sqlite.org/sqlite-wasm OO1 API (in-process, universal) ------------

export function createSqliteWasmOO1TestContext(spec: SqliteTestSpec): TestContext<DBConnection> {
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ false)
    let db: { close(): void; exec(opts: { sql: string }): unknown } | null = null

    return createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'sqlite',
        realDbEnabled,
        timeoutMs: 30_000,
        async createRealRunner() {
            const sqlite3InitModule = (await import('@sqlite.org/sqlite-wasm')).default
            const { Sqlite3WasmOO1QueryRunner } = await import('../../../src/queryRunners/Sqlite3WasmOO1QueryRunner.js')
            const sqlite3 = await sqlite3InitModule()
            const conn = new sqlite3.oo1.DB(':memory:', 'c')
            db = conn
            const { schema, seed } = await readSchemaAndSeed()
            conn.exec({ sql: schema })
            conn.exec({ sql: seed })
            return {
                runner: new Sqlite3WasmOO1QueryRunner(conn),
                shutdown: async () => {
                    if (db) db.close()
                    db = null
                },
            }
        },
        async onReseed() {
            if (!db) return
            const { schema, seed } = await readSchemaAndSeed()
            db.exec({ sql: schema })
            db.exec({ sql: seed })
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    })
}
