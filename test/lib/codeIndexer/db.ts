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
    /**
     * Run the same parameterised statement for many rows inside one transaction.
     *
     * `rows` is an ITERABLE and `map` is applied one row at a time, inside the transaction:
     * the caller's source rows are never copied into a second fully-materialised array.
     * That matters — the biggest dimension (test refs) is >3.5M rows, so a `rows.map(...)`
     * at the call site would double the peak for the largest tables.
     */
    insertMany<T>(sql: string, rows: Iterable<T>, map: (row: T) => SqlValue[]): void
    /** Run a query and return all rows as plain objects. */
    all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): T[]
    /** Persist (no-op for file-backed DBs that auto-persist) and release resources. */
    close(): void
}

// Read-only view of an index, for CONSUMERS (the code searcher) that only query.
// A narrow surface — no DDL, no writes — so a search can never mutate the artifact,
// and the backend can open the file read-only (no -wal/-shm sidecars created).
export interface QueryDb {
    /** Which backend is actually serving this handle (diagnostics). */
    readonly backend: string
    /** Run a query and return all rows as plain objects. */
    all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): T[]
    /** Release resources. */
    close(): void
}

export type SqlValue = string | number | bigint | boolean | null | Uint8Array

/**
 * What an extractor needs to hand a row over: just `push`. A plain `T[]` satisfies it, and
 * so does `BatchedRows` — so an extractor never knows whether it is accumulating or
 * streaming, and the choice is made once, at the call site.
 */
export interface RowSink<T> {
    push(row: T): void
}

/**
 * A `RowSink` that flushes to the database every `size` rows instead of accumulating.
 *
 * Why this exists: the biggest dimension (test refs) is >3.5M rows and grows with the
 * matrix. Accumulating it into one array before inserting means the whole dimension is
 * resident at once, on top of the TypeScript program that dominates this build's peak.
 * Batching from the point of DETECTION keeps only `size` rows alive at a time.
 *
 * The counts are kept incrementally because the rows are gone by the time the build wants
 * to report on them — there is no final array left to `filter`.
 */
export class BatchedRows<T> implements RowSink<T> {
    private buf: T[] = []
    /** Rows pushed so far (the whole dimension, not just the live batch). */
    total = 0
    /** Of those, how many the checker resolved to a declaration. */
    resolved = 0

    constructor(
        private readonly db: IndexDb,
        private readonly sql: string,
        private readonly map: (row: T) => SqlValue[],
        private readonly size = 50_000,
        /**
         * Run before this sink writes. Use it to flush a table this one has a FOREIGN KEY
         * into, so the parent rows are always already there — `node:sqlite` enforces foreign
         * keys by default (bun:sqlite and better-sqlite3 do not), so without this a streamed
         * child would fail with SQLITE_CONSTRAINT_FOREIGNKEY under Node and pass under Bun.
         */
        private readonly before?: () => void,
    ) {}

    push(row: T): void {
        this.buf.push(row)
        this.total++
        if ((row as { resolved_symbol_id?: number | null }).resolved_symbol_id != null) this.resolved++
        if (this.buf.length >= this.size) this.flush()
    }

    /** Write and drop whatever is buffered. Call once more when the dimension is done. */
    flush(): void {
        this.before?.()
        if (this.buf.length === 0) return
        this.db.insertMany(this.sql, this.buf, this.map)
        this.buf = []
    }
}

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

// ── read-only dispatcher (for consumers/searchers) ──────────────────────────
// Same backend selection as openIndexDb, but opens the file read-only and exposes
// only the query surface (QueryDb). No bulk/finalise pragmas: a search must not
// mutate the index. Throws a clear error if the file is missing.
export async function openIndexDbReadonly(path: string): Promise<QueryDb> {
    if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') {
        const { Database } = await import('bun:sqlite')
        const db = new Database(path, { readonly: true })
        return {
            backend: 'bun:sqlite',
            all<T>(sql: string, params: SqlValue[] = []) {
                return db.query(sql).all(...(params as never[])) as T[]
            },
            close() { db.close() },
        }
    }
    try {
        const sqlite = await import('node:sqlite')
        const db = new sqlite.DatabaseSync(path, { readOnly: true })
        return {
            backend: 'node:sqlite',
            all<T>(sql: string, params: SqlValue[] = []) {
                return db.prepare(sql).all(...(params as never[])) as T[]
            },
            close() { db.close() },
        }
    } catch { /* node:sqlite not exposed — fall through to better-sqlite3 */ }
    const { default: Database } = await import('better-sqlite3')
    const db = new Database(path, { readonly: true })
    return {
        backend: 'better-sqlite3',
        all<T>(sql: string, params: SqlValue[] = []) {
            return db.prepare(sql).all(...(params as never[])) as T[]
        },
        close() { db.close() },
    }
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
        insertMany(sql, rows, map) {
            const stmt = db.prepare(sql)
            const tx = db.transaction(() => {
                for (const r of rows) stmt.run(...(map(r) as never[]))
            })
            tx()
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
        insertMany(sql, rows, map) {
            // node:sqlite has no transaction() helper — drive BEGIN/COMMIT by hand.
            const stmt = db.prepare(sql)
            db.exec('BEGIN')
            try {
                for (const r of rows) stmt.run(...(map(r) as never[]))
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
        insertMany(sql, rows, map) {
            const stmt = db.prepare(sql)
            const tx = db.transaction(() => {
                for (const r of rows) stmt.run(...(map(r) as never[]))
            })
            tx()
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
