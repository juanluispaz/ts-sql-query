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
import { SynchronousPromise } from 'synchronous-promise'
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
// The user-registered case-insensitive replace a connection names via
// `replaceAllInsensitiveFunction`. SQLite's native `replace(...)` is
// case-sensitive; this UDF folds case (like the docs' recommended implementation)
// so `config.insensitive-collation.test.ts` can run the `fn(?, ?, ?)` emission
// END-TO-END on the connectors that can register functions.
function ciReplace(source: string | null, find: string | null, replacement: string | null): string | null {
    if (source == null || find == null || replacement == null) return source
    const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return source.replace(new RegExp(escaped, 'gi'), replacement)
}
function registerBetterSqlite3UuidFunctions(db: import('better-sqlite3').Database): void {
    db.function('uuid', uuidv7 as (_: unknown) => unknown)
    db.function('uuid_str', ((blob: Uint8Array | null) => blob == null ? null : uuidStringify(blob)) as (_: unknown) => unknown)
    db.function('uuid_blob', ((uuid: string | null) => uuid == null ? null : Buffer.from(uuidParse(uuid))) as (_: unknown) => unknown)
    db.function('ci_replace', ciReplace as (_: unknown) => unknown)
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
    fnCapable.function('ci_replace', (s: string | null, f: string | null, r: string | null) => ciReplace(s, f, r))
}
function registerSqlite3WasmOO1UuidFunctions(db: import('@sqlite.org/sqlite-wasm').Database): void {
    // The OO1 user-defined-function API: `createFunction(name, (ctxPtr, ...args))`.
    // Returning a `Uint8Array` binds as a BLOB (no `Buffer` needed in WASM).
    db.createFunction('uuid', () => uuidv7())
    db.createFunction('uuid_str', (_ctxPtr, blob) => blob == null ? null : uuidStringify(blob as Uint8Array))
    db.createFunction('uuid_blob', (_ctxPtr, uuid) => uuid == null ? null : uuidParse(uuid as string))
    db.createFunction('ci_replace', (_ctxPtr, s, f, r) => ciReplace(s as string | null, f as string | null, r as string | null))
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
    /**
     * A `DBConnection` whose `replaceAllInsensitiveFunction` is pinned to
     * `functionName` — the SQLite-only knob that routes `replaceAllInsensitive`
     * through a user-registered UDF (e.g. `ci_replace`, registered above for the
     * function-capable connectors) instead of the case-sensitive `replace(...)`
     * fallback.
     */
    withReplaceAllInsensitiveFunction(functionName: string): DBConnection
    /** A `DBConnection` whose `uuidStrategy` is pinned to `strategy`. */
    withUuidStrategy(strategy: 'string' | 'uuid-extension'): DBConnection
    /** A `DBConnection` with `allowEmptyString` enabled (empty strings kept, not mapped to null). */
    withAllowEmptyString(): DBConnection
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
    /**
     * A `DBConnection` backed by a SECOND runner over the SAME shared
     * in-memory db, but with the driver's reader put into exact-integer mode
     * (`safeIntegers` on bun:sqlite / better-sqlite3, `setReadBigInts` on
     * node:sqlite), so an integer past 2^53 arrives as an exact `bigint`
     * instead of a rounded `number` (or — node:sqlite — instead of the
     * `RangeError` the default reader throws). The mode is enabled PER
     * STATEMENT, so `ctx.conn`'s default `number` reads are untouched and the
     * two connections coexist on the shared fixture.
     *
     * Present ONLY on the native SQLite connectors whose driver exposes the
     * toggle — bun:sqlite, better-sqlite3, node:sqlite. Absent on `sqlite3`
     * (no exact-integer API) and sqlite-wasm. Meant to be called in real-DB
     * mode; under the mock the driver's reader is irrelevant (the mock hands
     * the value back verbatim), so callers guard on `ctx.realDbEnabled`.
     */
    withSafeIntegers?(): Promise<DBConnection>
}

/**
 * Wrap a base `TestContext<DBConnection>` with sqlite-specific
 * connection factories. Each `withXxx` reaches into the live
 * `ctx.conn.queryRunner` (the shared interceptor) — `ctx.up()` must
 * have run before any helper is called.
 */
function decorateSqliteContext(
    base: TestContext<DBConnection>,
    createExactIntegerConnection?: () => Promise<DBConnection>,
): SqliteTestContext {
    return Object.assign(base, {
        exampleInsensitiveCollation: 'NOCASE',
        ...(createExactIntegerConnection ? { withSafeIntegers: createExactIntegerConnection } : {}),
        withInsensitiveCollation(collation: string | undefined): DBConnection {
            class C extends DBConnection {
                protected override insensitiveCollation: string | undefined = collation
            }
            return base.withConnection(C)
        },
        withAllowEmptyString(): DBConnection {
            class C extends DBConnection {
                protected override allowEmptyString = true
            }
            return base.withConnection(C)
        },
        withReplaceAllInsensitiveFunction(functionName: string): DBConnection {
            class C extends DBConnection {
                protected override replaceAllInsensitiveFunction = functionName
            }
            return base.withConnection(C)
        },
        withUuidStrategy(strategy: 'string' | 'uuid-extension'): DBConnection {
            class C extends DBConnection {
                protected override uuidStrategy: 'string' | 'uuid-extension' = strategy
            }
            return base.withConnection(C)
        },
        withDateTimeFormat(format: SqliteDateTimeFormat): DBConnection {
            class C extends DBConnection {
                protected override getDateTimeFormat(): SqliteDateTimeFormat { return format }
            }
            return base.withConnection(C)
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
            return base.withConnection(C)
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

// A second connection whose reader surfaces integers past 2^53 as an exact
// `bigint` instead of a rounded `number` (see LIMITATIONS.md § "Reading an
// integer beyond 2^53 exactly ..."). bun-types exposes `safeIntegers` only as a
// Database CONSTRUCTOR option, and the flag is db-wide — every integer column,
// `id` included, then reads back as `bigint` — so this uses a DEDICATED
// exact-reading db (seeded like the shared one) rather than flipping the shared
// fixture every other test reads as `number`. The `int` column `id` narrows
// safely back from `1n` to `1` in `transformValueFromDB`.
let sharedBunSqliteExactDb: import('bun:sqlite').Database | null = null
async function getOrCreateBunSqliteExactDb(): Promise<import('bun:sqlite').Database> {
    if (sharedBunSqliteExactDb === null) {
        const { Database } = await import('bun:sqlite')
        const db = new Database(':memory:', { safeIntegers: true })
        const { schema, seed } = await readSchemaAndSeed()
        for (const stmt of splitStatements(schema)) db.exec(stmt)
        for (const stmt of splitStatements(seed)) db.exec(stmt)
        sharedBunSqliteExactDb = db
    }
    return sharedBunSqliteExactDb
}
async function createBunSqliteExactIntegerConnection(sync = false): Promise<DBConnection> {
    const { BunSqliteQueryRunner } = await import('../../../src/queryRunners/BunSqliteQueryRunner.js')
    const db = await getOrCreateBunSqliteExactDb()
    return new DBConnection(sync
        ? new BunSqliteQueryRunner(db, { promise: SynchronousPromise })
        : new BunSqliteQueryRunner(db))
}

// `sync` builds the `-sync` cell variant: runner + mock resolve through
// `SynchronousPromise` so tests drive it via `sync()`. See
// createBetterSqlite3TestContext for the shared rationale.
export function createBunSqliteTestContext(spec: BunSqliteTestSpec, sync = false): SqliteTestContext {
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
        ...(sync ? { promiseProvider: SynchronousPromise } : {}),
        async createRealRunner() {
            const { BunSqliteQueryRunner } = await import('../../../src/queryRunners/BunSqliteQueryRunner.js')
            const conn = await getOrCreateBunSqliteDb()
            const { schema, seed } = await readSchemaAndSeed()
            for (const stmt of splitStatements(schema)) conn.exec(stmt)
            for (const stmt of splitStatements(seed)) conn.exec(stmt)
            return {
                runner: sync
                    ? new BunSqliteQueryRunner(conn, { promise: SynchronousPromise })
                    : new BunSqliteQueryRunner(conn),
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
    }), sync
        ? () => createBunSqliteExactIntegerConnection(true)
        : createBunSqliteExactIntegerConnection)
}

/** The `bun_sqlite-sync` cell: {@link createBunSqliteTestContext} in synchronous mode. */
export function createBunSqliteSyncTestContext(spec: BunSqliteTestSpec): SqliteTestContext {
    return createBunSqliteTestContext(spec, true)
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

// See `createBunSqliteExactIntegerConnection`. better-sqlite3 exposes the same
// per-statement `safeIntegers(true)` toggle, but it caches prepared statements
// by SQL text, so we restore the flag in a `finally` to leave the shared cache
// as `ctx.conn`'s default `number` reads expect it.
async function createBetterSqlite3ExactIntegerConnection(sync = false): Promise<DBConnection> {
    const { BetterSqlite3QueryRunner } = await import('../../../src/queryRunners/BetterSqlite3QueryRunner.js')
    const db = await getOrCreateBetterSqlite3Db()
    class ExactIntegerRunner extends BetterSqlite3QueryRunner {
        protected override executeQueryReturning(query: string, params: any[]): Promise<any[]> {
            try {
                const stmt = this.connection.prepare(query)
                stmt.safeIntegers(true)
                try {
                    return this.promise.resolve(stmt.all(params))
                } finally {
                    stmt.safeIntegers(false)
                }
            } catch (e) {
                return this.promise.reject(e)
            }
        }
    }
    // The override returns results through the inherited `this.promise` provider,
    // exactly like the base runner. In a `-sync` cell that provider must be
    // `SynchronousPromise` so `sync()` can unwrap the exact-integer read — the
    // same `{ promise }` config the library takes on any runner, nothing bespoke.
    return new DBConnection(sync
        ? new ExactIntegerRunner(db, { promise: SynchronousPromise })
        : new ExactIntegerRunner(db))
}

// `sync` builds the `-sync` cell variant: the real runner and the mock both
// hand results back through `SynchronousPromise`, so test bodies unwrap them
// with the `sync()` helper instead of `await`. Everything else — schema, seed,
// shared in-memory db, exact-integer connection — is identical to the async
// cell, so both share this one factory.
export function createBetterSqlite3TestContext(spec: SqliteTestSpec, sync = false): SqliteTestContext {
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
        ...(sync ? { promiseProvider: SynchronousPromise } : {}),
        async createRealRunner() {
            const { BetterSqlite3QueryRunner } = await import('../../../src/queryRunners/BetterSqlite3QueryRunner.js')
            const conn = await getOrCreateBetterSqlite3Db()
            const { schema, seed } = await readSchemaAndSeed()
            conn.exec(schema)
            conn.exec(seed)
            return {
                runner: sync
                    ? new BetterSqlite3QueryRunner(conn, { promise: SynchronousPromise })
                    : new BetterSqlite3QueryRunner(conn),
                // Close the shared db per file so no native sqlite handle is
                // left open on an idle worker: Node 26 stalls vitest's graceful
                // worker-stop teardown otherwise. `up()` reopens it.
                shutdown: async () => {
                    if (sharedBetterSqlite3Db) {
                        sharedBetterSqlite3Db.close()
                        sharedBetterSqlite3Db = null
                    }
                },
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
    }), sync
        ? () => createBetterSqlite3ExactIntegerConnection(true)
        : createBetterSqlite3ExactIntegerConnection)
}

/** The `better-sqlite3-sync` cell: same as {@link createBetterSqlite3TestContext} but the
 * runner + mock resolve through `SynchronousPromise` so tests drive it via `sync()`. */
export function createBetterSqlite3SyncTestContext(spec: SqliteTestSpec): SqliteTestContext {
    return createBetterSqlite3TestContext(spec, true)
}

// ---- node:sqlite (in-process, Node 22.5+) -------------------------------

// `sync` builds the `-sync` cell variant (runner + mock via SynchronousPromise).
export function createNodeSqliteTestContext(spec: SqliteTestSpec, sync = false): SqliteTestContext {
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
        ...(sync ? { promiseProvider: SynchronousPromise } : {}),
        async createRealRunner() {
            const { NodeSqliteQueryRunner } = await import('../../../src/queryRunners/NodeSqliteQueryRunner.js')
            const conn = await getOrCreateNodeSqliteDb()
            const { schema, seed } = await readSchemaAndSeed()
            conn.exec(schema)
            conn.exec(seed)
            return {
                runner: sync
                    ? new NodeSqliteQueryRunner(conn, { promise: SynchronousPromise })
                    : new NodeSqliteQueryRunner(conn),
                // Close the shared in-memory db at the end of each file rather
                // than leaving it for the kernel to reclaim at process exit.
                // Under vitest's forks pool + `isolate: false`, a native sqlite
                // handle left open on an idle worker makes Node 26 stall
                // vitest's graceful worker-stop for the full 60s STOP_TIMEOUT,
                // printing "Failed to terminate worker" teardown errors on CI.
                // The next file's `up()` reopens it via `getOrCreateNodeSqliteDb`;
                // the reopen is cheap next to the schema + seed re-exec `up()`
                // already does.
                shutdown: async () => {
                    if (sharedNodeSqliteDb) {
                        sharedNodeSqliteDb.close()
                        sharedNodeSqliteDb = null
                    }
                },
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
    }), sync
        ? () => createNodeSqliteExactIntegerConnection(true)
        : createNodeSqliteExactIntegerConnection)
}

/** The `node_sqlite-sync` cell: {@link createNodeSqliteTestContext} in synchronous mode. */
export function createNodeSqliteSyncTestContext(spec: SqliteTestSpec): SqliteTestContext {
    return createNodeSqliteTestContext(spec, true)
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

// See `createBunSqliteExactIntegerConnection`. node:sqlite's toggle is
// `setReadBigInts(true)` on the statement (there is no db-wide form); its
// default reader THROWS a RangeError on an integer past 2^53 rather than
// rounding, so this exact-integer path is the only way node:sqlite surfaces the
// value at all. `prepare()` returns a fresh statement each call, so no restore
// is needed.
async function createNodeSqliteExactIntegerConnection(sync = false): Promise<DBConnection> {
    const { NodeSqliteQueryRunner } = await import('../../../src/queryRunners/NodeSqliteQueryRunner.js')
    const db = await getOrCreateNodeSqliteDb()
    class ExactIntegerRunner extends NodeSqliteQueryRunner {
        protected override executeQueryReturning(query: string, params: any[]): Promise<any[]> {
            try {
                const stmt = this.connection.prepare(query)
                stmt.setReadBigInts(true)
                return this.promise.resolve(stmt.all(...params))
            } catch (e) {
                return this.promise.reject(e)
            }
        }
    }
    // In a `-sync` cell the inherited `this.promise` must be SynchronousPromise
    // so `sync()` can unwrap the exact-integer read — same `{ promise }` config
    // the library takes on any runner.
    return new DBConnection(sync
        ? new ExactIntegerRunner(db, { promise: SynchronousPromise })
        : new ExactIntegerRunner(db))
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
                // Close the shared db per file so no native sqlite handle is
                // left open on an idle worker: Node 26 stalls vitest's graceful
                // worker-stop teardown otherwise. `up()` reopens it. sqlite3's
                // `close` is async, so await it before the file resolves `down()`.
                shutdown: async () => {
                    const db = sharedSqlite3Db
                    if (db) {
                        sharedSqlite3Db = null
                        await new Promise<void>((resolve, reject) => db.close(e => e ? reject(e) : resolve()))
                    }
                },
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

// `sync` builds the `-sync` cell variant (runner + mock via SynchronousPromise).
export function createSqliteWasmOO1TestContext(spec: SqliteTestSpec, sync = false): SqliteTestContext {
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
        ...(sync ? { promiseProvider: SynchronousPromise } : {}),
        async createRealRunner() {
            const { Sqlite3WasmOO1QueryRunner } = await import('../../../src/queryRunners/Sqlite3WasmOO1QueryRunner.js')
            const conn = await getOrCreateSqliteWasm()
            const { schema, seed } = await readSchemaAndSeed()
            conn.exec({ sql: schema })
            conn.exec({ sql: seed })
            return {
                runner: sync
                    ? new Sqlite3WasmOO1QueryRunner(conn, { promise: SynchronousPromise })
                    : new Sqlite3WasmOO1QueryRunner(conn),
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

/** The `sqlite-wasm-OO1-sync` cell: {@link createSqliteWasmOO1TestContext} in synchronous mode. */
export function createSqliteWasmOO1SyncTestContext(spec: SqliteTestSpec): SqliteTestContext {
    return createSqliteWasmOO1TestContext(spec, true)
}
