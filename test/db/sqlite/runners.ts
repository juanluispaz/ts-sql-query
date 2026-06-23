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
import { parse as uuidParse, stringify as uuidStringify, v7 as uuidv7 } from 'uuid'
import { DBConnection } from './domain/connection.js'

// SQLite's `uuid-extension` strategy emits uuid_blob / uuid_str / uuid
// (see docs/configuration/supported-databases/sqlite.md#uuid-strategies).
// The shared test connection now defaults to the `'string'` uuid strategy
// (test/db/sqlite/domain/connection.ts), so uuid columns round-trip as plain
// TEXT and need none of these helpers — every uuid test runs on every
// connector. We still register the helpers for the connectors that can, so a
// test that opts back into `'uuid-extension'` via
// `ctx.withUuidStrategy('uuid-extension')` finds them available and runs the
// binary `'uuid-extension'` path END-TO-END against the real engine:
//   - better-sqlite3, node:sqlite — registered here via `db.function(...)`,
//     exactly as the connector docs and
//     src/examples/{BetterSqlite3,NodeSqlite}*Example.ts show.
//   - sqlite-wasm-OO1 — registered here via `db.createFunction(...)` (the OO1
//     user-defined-function API), exactly as the connector doc shows.
// Two connectors can't register them, so their `'uuid-extension'` tests stay
// mock-only (guarded by `ctx.realDbEnabled`):
//   - sqlite3 (npm) — has no user-defined-function API at all.
//   - bun:sqlite — also has no user-defined-function API (only `loadExtension`).
//     Its `uuid_str` / `uuid_blob` are present only where the underlying system
//     SQLite already bundles the `uuid` extension (e.g. macOS); Bun's bundled
//     SQLite on Linux/CI has them NOT, raising "no such function: uuid_blob".
//     Relying on the built-ins is therefore not portable.
// uuid_str / uuid_blob are NULL-safe (return NULL on NULL input), mirroring
// the real uuid extension.
function registerBetterSqlite3UuidFunctions(db: import('better-sqlite3').Database): void {
    db.function('uuid', uuidv7 as (_: unknown) => unknown)
    db.function('uuid_str', ((blob: Uint8Array | null) => blob == null ? null : uuidStringify(blob)) as (_: unknown) => unknown)
    db.function('uuid_blob', ((uuid: string | null) => uuid == null ? null : Buffer.from(uuidParse(uuid))) as (_: unknown) => unknown)
}
function registerNodeSqliteUuidFunctions(db: import('node:sqlite').DatabaseSync): void {
    // `DatabaseSync.function` only exists from Node 24; on Node 22 the
    // real branch still runs but uuid columns are simply not exercised
    // there (no test depends on them under that runtime).
    const fnCapable = db as unknown as { function?: (name: string, fn: (...args: any[]) => unknown) => void }
    if (typeof fnCapable.function !== 'function') return
    fnCapable.function('uuid', () => uuidv7())
    fnCapable.function('uuid_str', (blob: Uint8Array | null) => blob == null ? null : uuidStringify(blob))
    fnCapable.function('uuid_blob', (uuid: string | null) => uuid == null ? null : Buffer.from(uuidParse(uuid)))
}
function registerSqlite3WasmOO1UuidFunctions(db: import('@sqlite.org/sqlite-wasm').Database): void {
    // The OO1 user-defined-function API: `createFunction(name, (ctxPtr, ...args))`.
    // Returning a `Uint8Array` binds as a BLOB (no `Buffer` needed in WASM).
    db.createFunction('uuid', () => uuidv7())
    db.createFunction('uuid_str', (_ctxPtr, blob) => blob == null ? null : uuidStringify(blob as Uint8Array))
    db.createFunction('uuid_blob', (_ctxPtr, uuid) => uuid == null ? null : uuidParse(uuid as string))
}

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
    /**
     * A `DBConnection` whose `getDateTimeFormat()` is pinned to `format`
     * AND whose "unexpected value" detection flags are pinned — the
     * defensive branches `SqliteConnection.transformValueFromDB` takes
     * when the value the db hands back does not match the configured
     * format (a number under a text format, a string under a numeric
     * format). A real engine in `format` never returns the mismatched
     * type, so these branches are only reachable through the mock.
     */
    withDateTimeFlags(format: SqliteDateTimeFormat, flags: {
        treatUnexpectedIntegerDateTimeAsJulian?: boolean
        treatUnexpectedStringDateTimeAsUTC?: boolean
        unexpectedUnixDateTimeAreMilliseconds?: boolean
    }): DBConnection
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
        withDateTimeFlags(format: SqliteDateTimeFormat, flags: {
            treatUnexpectedIntegerDateTimeAsJulian?: boolean
            treatUnexpectedStringDateTimeAsUTC?: boolean
            unexpectedUnixDateTimeAreMilliseconds?: boolean
        }): DBConnection {
            class C extends DBConnection {
                protected override getDateTimeFormat(): SqliteDateTimeFormat { return format }
                protected override treatUnexpectedIntegerDateTimeAsJulian = flags.treatUnexpectedIntegerDateTimeAsJulian ?? false
                protected override treatUnexpectedStringDateTimeAsUTC = flags.treatUnexpectedStringDateTimeAsUTC ?? false
                protected override unexpectedUnixDateTimeAreMilliseconds = flags.unexpectedUnixDateTimeAreMilliseconds ?? false
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
    const version = spec.label.split(' / ')[0] ?? ''
    const connector = spec.label.split(' / ')[1] ?? ''
    const realDbEnabled = isBun && isRealDbEnabled(DATABASE, /* needsDocker */ false, version, connector)

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
        registerBetterSqlite3UuidFunctions(sharedBetterSqlite3Db)
    }
    return sharedBetterSqlite3Db
}

export function createBetterSqlite3TestContext(spec: SqliteTestSpec): SqliteTestContext {
    // better-sqlite3 has a native binding that fails to load under Bun's
    // Node API shim. We only fire the real branch outside Bun.
    const version = spec.label.split(' / ')[0] ?? ''
    const connector = spec.label.split(' / ')[1] ?? ''
    const realDbEnabled = !isBun && isRealDbEnabled(DATABASE, /* needsDocker */ false, version, connector)

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
    const version = spec.label.split(' / ')[0] ?? ''
    const connector = spec.label.split(' / ')[1] ?? ''
    const realDbEnabled = isNodeSqliteAvailable() && isRealDbEnabled(DATABASE, /* needsDocker */ false, version, connector)

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
        registerNodeSqliteUuidFunctions(sharedNodeSqliteDb)
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
    const version = spec.label.split(' / ')[0] ?? ''
    const connector = spec.label.split(' / ')[1] ?? ''
    const realDbEnabled = isRealDbEnabled(DATABASE, /* needsDocker */ false, version, connector)

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
        registerSqlite3WasmOO1UuidFunctions(sqliteWasmSharedDb)
    }
    return sqliteWasmSharedDb
}

export function createSqliteWasmOO1TestContext(spec: SqliteTestSpec): SqliteTestContext {
    // sqlite-wasm-OO1 is in-process WASM — gated by `TS_SQL_QUERY_WASM`
    // so `tests` (no --wasm) can route this connector through the mock
    // without paying the per-worker WASM bootstrap cost.
    const version = spec.label.split(' / ')[0] ?? ''
    const connector = spec.label.split(' / ')[1] ?? ''
    const realDbEnabled = isRealDbEnabled(DATABASE, 'wasm', version, connector)

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
