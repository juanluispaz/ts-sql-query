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

import type { SqliteDateTimeFormat } from '../../../src/connections/SqliteConfiguration.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { createTestContext, type TestContext } from '../../lib/testContext.js'
import { MockBetterSqlite3QueryRunner } from '../../lib/mockRunners/MockBetterSqlite3QueryRunner.js'
import { MockBunSqliteQueryRunner } from '../../lib/mockRunners/MockBunSqliteQueryRunner.js'
import { MockNodeSqliteQueryRunner } from '../../lib/mockRunners/MockNodeSqliteQueryRunner.js'
import { MockSqlite3QueryRunner } from '../../lib/mockRunners/MockSqlite3QueryRunner.js'
import { MockSqlite3WasmOO1QueryRunner } from '../../lib/mockRunners/MockSqlite3WasmOO1QueryRunner.js'
import { DBConnection } from './domain/connection.js'

/**
 * `TestContext<DBConnection>` extended with sqlite-specific connection
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
export interface SqliteTestContext extends TestContext<DBConnection> {
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
    withUuidStrategy(strategy: 'string' | 'uuid-extension'): DBConnection
    /** A `DBConnection` whose `getDateTimeFormat()` is pinned to `format`. */
    withDateTimeFormat(format: SqliteDateTimeFormat): DBConnection
}

/**
 * Wrap a base `TestContext<DBConnection>` with sqlite-specific
 * connection factories. Each `withXxx` reaches into the live
 * `ctx.conn.queryRunner` (the shared interceptor) — `ctx.up()` must
 * have run before any helper is called.
 */
function decorateSqliteContext(base: TestContext<DBConnection>): SqliteTestContext {
    return Object.assign(base, {
        exampleInsensitiveCollation: 'NOCASE',
        withInsensitiveCollation(collation: string | undefined): DBConnection {
            class C extends DBConnection {
                protected override insensitiveCollation: string | undefined = collation
            }
            return new C(base.conn.queryRunner)
        },
        withUuidStrategy(strategy: 'string' | 'uuid-extension'): DBConnection {
            class C extends DBConnection {
                protected override uuidStrategy: 'string' | 'uuid-extension' = strategy
            }
            return new C(base.conn.queryRunner)
        },
        withDateTimeFormat(format: SqliteDateTimeFormat): DBConnection {
            class C extends DBConnection {
                protected override getDateTimeFormat(): SqliteDateTimeFormat { return format }
            }
            return new C(base.conn.queryRunner)
        },
    })
}

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
//
// Trailing tail-comment blocks (e.g. parity stubs for features SQLite
// doesn't support) survive the `;` split as a comment-only fragment;
// bun:sqlite rejects those with "no valid SQL statement". Strip
// `--` line comments before testing for emptiness so we drop those
// fragments before they reach the driver.
function splitStatements(sql: string): string[] {
    return sql
        .split(/;\s*(?:\n|$)/)
        .map(s => s.trim())
        .filter(s => s.replace(/--[^\n]*/g, '').trim().length > 0)
}

// ---- bun:sqlite (in-process, Bun-only) ----------------------------------

export interface BunSqliteTestSpec {
    label: string
    canonicalForDocs?: boolean
    compatibilityVersion?: number
}

// Per-process in-process sqlite instance, memoised across files in
// the same worker — same one-process-one-db pattern as the docker
// engines: `createXxx` constructs the DB once, every test file's
// `up()` just re-applies schema + seed (cheap), `down()` is a no-op
// and the kernel reclaims the in-memory DB at process exit.
let sharedBunSqliteDb: import('bun:sqlite').Database | null = null

async function getOrCreateBunSqliteDb(): Promise<import('bun:sqlite').Database> {
    if (sharedBunSqliteDb === null) {
        const { Database } = await import('bun:sqlite')
        sharedBunSqliteDb = new Database(':memory:')
    }
    return sharedBunSqliteDb
}

export function createBunSqliteTestContext(spec: BunSqliteTestSpec): SqliteTestContext {
    // In-process, but the connector module itself can only load under Bun.
    // Under node+vitest we keep the mock branch and never touch bun:sqlite.
    const realDbEnabled = isBun && isRealDbEnabled(DATABASE, /* needsDocker */ false)

    return decorateSqliteContext(createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'sqlite',
        realDbEnabled,
        mockRunnerClass: MockBunSqliteQueryRunner,
        async createRealRunner() {
            const { BunSqliteQueryRunner } = await import('../../../src/queryRunners/BunSqliteQueryRunner.js')
            const conn = await getOrCreateBunSqliteDb()
            const { schema, seed } = await readSchemaAndSeed()
            for (const stmt of splitStatements(schema)) conn.exec(stmt)
            for (const stmt of splitStatements(seed)) conn.exec(stmt)
            return {
                runner: new BunSqliteQueryRunner(conn),
                shutdown: async () => { /* shared instance, intentional no-op */ },
            }
        },
        async onReseed(runner) {
            // bun:sqlite is in-process; the runner already holds the
            // shared db. Reuse it via the public runner API instead of
            // reaching for the module-private `sharedBunSqliteDb`.
            const db = runner.getNativeRunner() as import('bun:sqlite').Database
            const { schema, seed } = await readSchemaAndSeed()
            for (const stmt of splitStatements(schema)) db.exec(stmt)
            for (const stmt of splitStatements(seed)) db.exec(stmt)
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    }))
}

// ---- better-sqlite3 (in-process, Node-only — does not load under Bun) ---

export interface SqliteTestSpec {
    label: string
    canonicalForDocs?: boolean
    compatibilityVersion?: number
}

let sharedBetterSqlite3Db: import('better-sqlite3').Database | null = null

async function getOrCreateBetterSqlite3Db(): Promise<import('better-sqlite3').Database> {
    if (sharedBetterSqlite3Db === null) {
        const Database = (await import('better-sqlite3')).default
        sharedBetterSqlite3Db = new Database(':memory:')
    }
    return sharedBetterSqlite3Db
}

export function createBetterSqlite3TestContext(spec: SqliteTestSpec): SqliteTestContext {
    // better-sqlite3 has a native binding that fails to load under Bun's
    // Node API shim. We only fire the real branch outside Bun.
    const realDbEnabled = !isBun && isRealDbEnabled(DATABASE, /* needsDocker */ false)

    return decorateSqliteContext(createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'sqlite',
        realDbEnabled,
        mockRunnerClass: MockBetterSqlite3QueryRunner,
        async createRealRunner() {
            const { BetterSqlite3QueryRunner } = await import('../../../src/queryRunners/BetterSqlite3QueryRunner.js')
            const conn = await getOrCreateBetterSqlite3Db()
            const { schema, seed } = await readSchemaAndSeed()
            conn.exec(schema)
            conn.exec(seed)
            return {
                runner: new BetterSqlite3QueryRunner(conn),
                shutdown: async () => { /* shared instance, intentional no-op */ },
            }
        },
        async onReseed(runner) {
            const db = runner.getNativeRunner() as import('better-sqlite3').Database
            const { schema, seed } = await readSchemaAndSeed()
            db.exec(schema)
            db.exec(seed)
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    }))
}

// ---- node:sqlite (in-process, Node 22.5+) -------------------------------

export function createNodeSqliteTestContext(spec: SqliteTestSpec): SqliteTestContext {
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

    return decorateSqliteContext(createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'sqlite',
        realDbEnabled,
        mockRunnerClass: MockNodeSqliteQueryRunner,
        async createRealRunner() {
            const { NodeSqliteQueryRunner } = await import('../../../src/queryRunners/NodeSqliteQueryRunner.js')
            const conn = await getOrCreateNodeSqliteDb()
            const { schema, seed } = await readSchemaAndSeed()
            conn.exec(schema)
            conn.exec(seed)
            return {
                runner: new NodeSqliteQueryRunner(conn),
                shutdown: async () => { /* shared instance, intentional no-op */ },
            }
        },
        async onReseed(runner) {
            const db = runner.getNativeRunner() as import('node:sqlite').DatabaseSync
            const { schema, seed } = await readSchemaAndSeed()
            db.exec(schema)
            db.exec(seed)
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    }))
}

let sharedNodeSqliteDb: import('node:sqlite').DatabaseSync | null = null

async function getOrCreateNodeSqliteDb(): Promise<import('node:sqlite').DatabaseSync> {
    if (sharedNodeSqliteDb === null) {
        const { DatabaseSync } = await import('node:sqlite')
        sharedNodeSqliteDb = new DatabaseSync(':memory:')
    }
    return sharedNodeSqliteDb
}

// ---- sqlite3 (in-process, async, universal) -----------------------------

let sharedSqlite3Db: import('sqlite3').Database | null = null

async function getOrCreateSqlite3Db(): Promise<import('sqlite3').Database> {
    if (sharedSqlite3Db === null) {
        const sqlite3 = (await import('sqlite3')).default
        sharedSqlite3Db = new sqlite3.Database(':memory:')
    }
    return sharedSqlite3Db
}

function sqlite3Exec(database: import('sqlite3').Database, sql: string): Promise<void> {
    return new Promise((res, rej) => database.exec(sql, e => e ? rej(e) : res()))
}

export function createSqlite3TestContext(spec: SqliteTestSpec): SqliteTestContext {
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ false)

    return decorateSqliteContext(createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'sqlite',
        realDbEnabled,
        mockRunnerClass: MockSqlite3QueryRunner,
        async createRealRunner() {
            const { Sqlite3QueryRunner } = await import('../../../src/queryRunners/Sqlite3QueryRunner.js')
            const conn = await getOrCreateSqlite3Db()
            const { schema, seed } = await readSchemaAndSeed()
            await sqlite3Exec(conn, schema)
            await sqlite3Exec(conn, seed)
            return {
                runner: new Sqlite3QueryRunner(conn),
                shutdown: async () => { /* shared instance, intentional no-op */ },
            }
        },
        async onReseed(runner) {
            const db = runner.getNativeRunner() as import('sqlite3').Database
            const { schema, seed } = await readSchemaAndSeed()
            await sqlite3Exec(db, schema)
            await sqlite3Exec(db, seed)
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    }))
}

// ---- @sqlite.org/sqlite-wasm OO1 API (in-process, universal) ------------

// Per-process sqlite-wasm instance. Initialising `@sqlite.org/sqlite-wasm`
// (loading the WASM module + constructing the OO1 wrapper) is the
// expensive step; memoising it once per worker makes the per-file `up()`
// just re-apply the schema + seed. See the parallel pglite comment in
// the postgres runner for the same pattern.
let sqliteWasmSharedDb: import('@sqlite.org/sqlite-wasm').Database | null = null

async function getOrCreateSqliteWasm(): Promise<import('@sqlite.org/sqlite-wasm').Database> {
    if (sqliteWasmSharedDb === null) {
        const sqlite3InitModule = (await import('@sqlite.org/sqlite-wasm')).default
        const sqlite3 = await sqlite3InitModule()
        sqliteWasmSharedDb = new sqlite3.oo1.DB(':memory:', 'c')
    }
    return sqliteWasmSharedDb
}

export function createSqliteWasmOO1TestContext(spec: SqliteTestSpec): SqliteTestContext {
    // sqlite-wasm-OO1 is in-process WASM — gated by `TS_SQL_QUERY_WASM`
    // so `tests` (no --wasm) can route this connector through the mock
    // without paying the per-worker WASM bootstrap cost.
    const realDbEnabled = isRealDbEnabled(DATABASE, 'wasm')

    return decorateSqliteContext(createTestContext<DBConnection>({
        label: spec.label,
        canonicalForDocs: spec.canonicalForDocs,
        compatibilityVersion: spec.compatibilityVersion,
        database: 'sqlite',
        realDbEnabled,
        mockRunnerClass: MockSqlite3WasmOO1QueryRunner,
        timeoutMs: 30_000,
        async createRealRunner() {
            const { Sqlite3WasmOO1QueryRunner } = await import('../../../src/queryRunners/Sqlite3WasmOO1QueryRunner.js')
            const conn = await getOrCreateSqliteWasm()
            const { schema, seed } = await readSchemaAndSeed()
            conn.exec({ sql: schema })
            conn.exec({ sql: seed })
            return {
                runner: new Sqlite3WasmOO1QueryRunner(conn),
                // Don't close — the shared instance survives until
                // the worker process exits.
                shutdown: async () => { /* shared instance, intentional no-op */ },
            }
        },
        async onReseed(runner) {
            const db = runner.getNativeRunner() as import('@sqlite.org/sqlite-wasm').Database
            const { schema, seed } = await readSchemaAndSeed()
            db.exec({ sql: schema })
            db.exec({ sql: seed })
        },
        buildConnection(interceptor, compatibilityVersion) {
            return new DBConnection(interceptor, compatibilityVersion)
        },
    }))
}
