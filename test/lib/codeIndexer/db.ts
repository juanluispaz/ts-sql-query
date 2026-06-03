// Thin database abstraction for the symbol index.
//
// Three interchangeable backends behind one minimal interface, picked by
// `openIndexDb` according to the runtime:
//   1. `bun:sqlite`        — when running under Bun (fast, native, no deps).
//   2. `node:sqlite`       — when running under Node and the built-in module is
//                            available (Node 22.5+ with `--experimental-sqlite`,
//                            on by default from Node 24/26). Zero extra deps.
//   3. `better-sqlite3`    — fallback for Node runtimes where `node:sqlite` is
//                            not exposed. Already a dev dependency of the matrix.
//
// The SQL we run through it is plain portable SQLite, and each backend uses the
// same statement/transaction shape, so the build/query logic above this file
// never has to know which one is active. A future `sql.js` (WASM) backend can
// join the same way. Keep this surface small; anything backend-specific stays
// inside its `open*IndexDb`.

export interface IndexDb {
    /** Which backend is actually serving this handle (diagnostics). */
    readonly backend: string
    /** Execute one or more statements with no parameters and no result (DDL). */
    exec(sql: string): void
    /** Run a parameterised statement once (INSERT/UPDATE). */
    run(sql: string, params: SqlValue[]): void
    /** Run the same parameterised statement for many rows inside one transaction. */
    insertMany(sql: string, rows: SqlValue[][]): void
    /** Run a query and return all rows as plain objects. */
    all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): T[]
    /** Persist (no-op for file-backed DBs that auto-persist) and release resources. */
    close(): void
}

export type SqlValue = string | number | bigint | boolean | null | Uint8Array

// Pragmas for a fast one-shot bulk build; safe because the index is a
// disposable derived artifact, not a system of record.
const BULK_PRAGMAS = 'PRAGMA journal_mode = WAL; PRAGMA synchronous = OFF;'
// Fold the WAL back into the main file and switch to a rollback journal so the
// written .sqlite is self-contained: readers opening it later never see stale
// data from a lingering -wal sidecar.
const FINALISE_PRAGMAS = 'PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE;'

// ── runtime dispatcher ───────────────────────────────────────────────────────
// Bun → bun:sqlite. Node → node:sqlite when present, else better-sqlite3.
export async function openIndexDb(path: string): Promise<IndexDb> {
    if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') {
        return openBunIndexDb(path)
    }
    const node = await openNodeSqliteIndexDb(path)
    if (node) return node
    return openBetterSqlite3IndexDb(path)
}

// ── bun:sqlite backend ──────────────────────────────────────────────────────
// Imported lazily so this module can be loaded under a non-bun runtime that
// only wants the IndexDb type or one of the other backends.
export async function openBunIndexDb(path: string): Promise<IndexDb> {
    const { Database } = await import('bun:sqlite')
    const db = new Database(path, { create: true })
    // bun:sqlite's Database.exec is deprecated (alias of run); run handles the
    // multi-statement pragma/DDL strings the same way.
    db.run(BULK_PRAGMAS)

    return {
        backend: 'bun:sqlite',
        exec(sql) {
            db.run(sql)
        },
        run(sql, params) {
            db.prepare(sql).run(...(params as never[]))
        },
        insertMany(sql, rows) {
            const stmt = db.prepare(sql)
            const tx = db.transaction((batch: SqlValue[][]) => {
                for (const r of batch) stmt.run(...(r as never[]))
            })
            tx(rows)
        },
        all<T>(sql: string, params: SqlValue[] = []) {
            return db.prepare(sql).all(...(params as never[])) as T[]
        },
        close() {
            db.run(FINALISE_PRAGMAS)
            db.close()
        },
    }
}

// ── node:sqlite backend ─────────────────────────────────────────────────────
// Returns null (rather than throwing) when `node:sqlite` is not exposed by this
// Node runtime, so the dispatcher can fall through to better-sqlite3.
export async function openNodeSqliteIndexDb(path: string): Promise<IndexDb | null> {
    let sqlite: typeof import('node:sqlite')
    try {
        sqlite = await import('node:sqlite')
    } catch {
        return null
    }
    const db = new sqlite.DatabaseSync(path)
    db.exec(BULK_PRAGMAS)

    return {
        backend: 'node:sqlite',
        exec(sql) {
            db.exec(sql)
        },
        run(sql, params) {
            db.prepare(sql).run(...(params as never[]))
        },
        insertMany(sql, rows) {
            // node:sqlite has no transaction() helper — drive BEGIN/COMMIT by hand.
            const stmt = db.prepare(sql)
            db.exec('BEGIN')
            try {
                for (const r of rows) stmt.run(...(r as never[]))
                db.exec('COMMIT')
            } catch (e) {
                db.exec('ROLLBACK')
                throw e
            }
        },
        all<T>(sql: string, params: SqlValue[] = []) {
            return db.prepare(sql).all(...(params as never[])) as T[]
        },
        close() {
            db.exec(FINALISE_PRAGMAS)
            db.close()
        },
    }
}

// ── better-sqlite3 backend ──────────────────────────────────────────────────
export async function openBetterSqlite3IndexDb(path: string): Promise<IndexDb> {
    const { default: Database } = await import('better-sqlite3')
    const db = new Database(path)
    db.exec(BULK_PRAGMAS)

    return {
        backend: 'better-sqlite3',
        exec(sql) {
            db.exec(sql)
        },
        run(sql, params) {
            db.prepare(sql).run(...(params as never[]))
        },
        insertMany(sql, rows) {
            const stmt = db.prepare(sql)
            const tx = db.transaction((batch: SqlValue[][]) => {
                for (const r of batch) stmt.run(...(r as never[]))
            })
            tx(rows)
        },
        all<T>(sql: string, params: SqlValue[] = []) {
            return db.prepare(sql).all(...(params as never[])) as T[]
        },
        close() {
            db.exec(FINALISE_PRAGMAS)
            db.close()
        },
    }
}
