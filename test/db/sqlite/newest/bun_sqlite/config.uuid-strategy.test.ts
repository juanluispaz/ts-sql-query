// Per-connection coverage of `SqliteConnection.uuidStrategy`. The two
// supported strategies branch the dialect's emitter for the UUID
// surface in:
//
//   - `'uuid-extension'` (the library default for SqliteConnection;
//     the shared test connection overrides the default to `'string'` —
//     see test/db/sqlite/domain/connection.ts): assumes the SQLite `uuid_blob` /
//     `uuid_str` functions are loaded. Inputs are wrapped with
//     `uuid_blob(?)` in `_appendParam`, outputs at the outermost query
//     get a `uuid_str(...)` wrapper in `_appendColumnValue`, and
//     `.asString()` on a uuid column / value source emits
//     `uuid_str(...)` via `_asString`.
//   - `'string'`: inputs and outputs are plain TEXT — every dialect
//     hook returns the underlying SQL unchanged.
//
// `ctx.withUuidStrategy(...)` returns a `DBConnection` whose
// `uuidStrategy` is pinned to the requested value while sharing
// `ctx.conn`'s underlying `CaptureInterceptor` and driver.
//
// The `'string'` branch tests emit a plain `select ? as result` —
// universally executable, so they run end-to-end in mock and real-DB
// mode. The `'uuid-extension'` branch tests emit
// `uuid_str(uuid_blob(?))`, which requires the SQLite `uuid` extension
// functions. bun:sqlite has no user-defined-function API (only
// `loadExtension`), so they can't be registered here; its built-in
// `uuid_str` / `uuid_blob` are present only where the underlying system
// SQLite already bundles the `uuid` extension (e.g. macOS) and are
// ABSENT from Bun's bundled SQLite on Linux/CI ("no such function:
// uuid_blob"). Like the `sqlite3` (npm) connector, this connector
// therefore keeps the `'uuid-extension'` tests mock-only (guarded by
// `ctx.realDbEnabled`), per
// [DESIGN.md §1 #18](../../../../DESIGN.md#1-principles): there the
// assertion of interest is the SqlBuilder shape, not engine execution.
// The connectors that DO register the functions (better-sqlite3,
// node:sqlite, sqlite-wasm-OO1 — see test/db/sqlite/runners.ts) run the
// `'uuid-extension'` path end-to-end.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

const UUID_VALUE = '123e4567-e89b-12d3-a456-426614174000'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('uuid-strategy: string is no-op for asString', async () => {
        // `'string'` strategy renders `.asString()` as the underlying
        // bind expression — `select ? as result`, valid on every
        // sqlite connector, so the test runs end-to-end.
        const conn = ctx.withUuidStrategy('string')
        ctx.mockNext(UUID_VALUE)
        await conn.selectFromNoTable()
            .selectOneColumn(conn.const(UUID_VALUE, 'uuid').asString())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
    })

    // NOT-APPLICABLE: bun:sqlite has no user-defined-function API (only `loadExtension`), so the `uuid_str` / `uuid_blob` extension functions can't be registered; its built-ins are present only where the system SQLite bundles the `uuid` extension (e.g. macOS) and are absent from Bun's bundled SQLite on Linux/CI. Like `sqlite3`, kept mock-only here so the SqlBuilder shape is still asserted; the connectors that register the functions (better-sqlite3 / node:sqlite / sqlite-wasm-OO1 — see test/db/sqlite/runners.ts) run the `'uuid-extension'` path end-to-end.
    test('uuid-strategy: uuid-extension wraps asString in uuid_str', async () => {
        if (ctx.realDbEnabled) return
        const conn = ctx.withUuidStrategy('uuid-extension')
        ctx.mockNext(UUID_VALUE)
        await conn.selectFromNoTable()
            .selectOneColumn(conn.const(UUID_VALUE, 'uuid').asString())
            .executeSelectOne()
        // _asString wraps with uuid_str; _appendParam also wraps the
        // bound literal with uuid_blob so the round-trip through the
        // ext-UUID storage stays consistent.
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select uuid_str(uuid_blob(?)) as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
    })

    // NOT-APPLICABLE: bun:sqlite has no user-defined-function API (only `loadExtension`), so the `uuid_str` / `uuid_blob` extension functions can't be registered; its built-ins are present only where the system SQLite bundles the `uuid` extension (e.g. macOS) and are absent from Bun's bundled SQLite on Linux/CI. Like `sqlite3`, kept mock-only here so the SqlBuilder shape is still asserted; the connectors that register the functions (better-sqlite3 / node:sqlite / sqlite-wasm-OO1 — see test/db/sqlite/runners.ts) run the `'uuid-extension'` path end-to-end.
    test('uuid-strategy: outermost-column projection wraps uuid value with uuid_str on uuid-extension', async () => {
        // `_appendColumnValue` adds a `uuid_str(...)` wrapper at the
        // outermost query for any uuid value source when strategy is
        // `'uuid-extension'`.
        if (ctx.realDbEnabled) return
        const conn = ctx.withUuidStrategy('uuid-extension')
        ctx.mockNext(UUID_VALUE)
        await conn.selectFromNoTable()
            .selectOneColumn(conn.const(UUID_VALUE, 'uuid'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select uuid_str(uuid_blob(?)) as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
    })

    test('uuid-strategy: outermost-column projection on string strategy emits raw bind', async () => {
        // Mirror of the first test on the `'string'` strategy: every
        // UUID hook returns the underlying SQL unchanged. The bind is
        // the raw string parameter — no `uuid_blob` / `uuid_str`
        // decoration — valid on every sqlite connector.
        const conn = ctx.withUuidStrategy('string')
        ctx.mockNext(UUID_VALUE)
        await conn.selectFromNoTable()
            .selectOneColumn(conn.const(UUID_VALUE, 'uuid'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
    })
})
