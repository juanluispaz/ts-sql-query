// Behavioral coverage of every `dateTimeFormat` accepted by
// `SqliteConnection.getDateTimeFormat()`. Each format produces different
// SQL for `currentDate()`, `currentTime()` and `currentTimestamp()` —
// the default ts-sql-query setup only ever picks one format, so the
// other 8 branches of `_currentDate / _currentTime / _currentTimestamp`
// in SqliteSqlBuilder are otherwise unreached.
//
// `ctx.withDateTimeFormat(...)` returns a `DBConnection` whose
// `getDateTimeFormat()` is pinned to the requested format while
// sharing `ctx.conn`'s underlying `CaptureInterceptor` and driver. SQL
// emitted by the alt connection lands in `ctx.lastSql`; in real-DB
// mode the query reaches the same backing database `ctx.conn` sees.
// Every format compiles to valid SQLite, so `executeSelectMany`
// proceeds without try/catch.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

function reasonOf(e: unknown): string | undefined {
    if (e instanceof TsSqlError) return e.errorReason.reason
    return undefined
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('format: localdate as text', async () => {
        const conn = ctx.withDateTimeFormat('localdate as text')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now', 'localtime') as "d", time('now', 'localtime') as "t", datetime('now', 'localtime') as ts"`)
    })

    test('format: localdate as text using T separator', async () => {
        const conn = ctx.withDateTimeFormat('localdate as text using T separator')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now', 'localtime') as "d", time('now', 'localtime') as "t", strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime') as ts"`)
    })

    test('format: UTC as text', async () => {
        const conn = ctx.withDateTimeFormat('UTC as text')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now') as "d", time('now') as "t", datetime('now') as ts"`)
    })

    test('format: UTC as text using T separator', async () => {
        const conn = ctx.withDateTimeFormat('UTC as text using T separator')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now') as "d", time('now') as "t", strftime('%Y-%m-%dT%H:%M:%S', 'now') as ts"`)
    })

    test('format: UTC as text using Z timezone', async () => {
        const conn = ctx.withDateTimeFormat('UTC as text using Z timezone')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now') as "d", (time('now') || 'Z') as "t", strftime('%Y-%m-%d %H:%M:%SZ', 'now') as ts"`)
    })

    test('format: UTC as text using T separator and Z timezone', async () => {
        const conn = ctx.withDateTimeFormat('UTC as text using T separator and Z timezone')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now') as "d", (time('now') || 'Z') as "t", strftime('%Y-%m-%dT%H:%M:%SZ', 'now') as ts"`)
    })

    test('format: Julian day as real number', async () => {
        const conn = ctx.withDateTimeFormat('Julian day as real number')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select julianday(date('now')) as "d", (julianday(strftime('1970-01-01 %H:%M:%f', 'now')) - julianday('1970-01-01')) as "t", julianday('now') as ts"`)
    })

    test('format: Unix time seconds as integer', async () => {
        const conn = ctx.withDateTimeFormat('Unix time seconds as integer')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%s', date('now')) as integer) as "d", cast(strftime('%s', strftime('1970-01-01 %H:%M:%S', 'now')) as integer) as "t", cast(strftime('%s', 'now') as integer) as ts"`)
    })

    test('format: Unix time milliseconds as integer', async () => {
        const conn = ctx.withDateTimeFormat('Unix time milliseconds as integer')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (cast(strftime('%s', date('now')) as integer) * 1000) as "d", cast(round((julianday(strftime('1970-01-01 %H:%M:%f', 'now')) - 2440587.5) * 86400000.0) as integer) as "t", cast(round((julianday('now') - 2440587.5) * 86400000.0) as integer) as ts"`)
    })

    test('invalid dateTimeFormat throws INVALID_CONFIGURATION', async () => {
        // An unrecognised `dateTimeFormat` makes `currentDate()` /
        // `currentTime()` / `currentTimestamp()` throw INVALID_CONFIGURATION
        // while building the SQL (client-side, before any DB call).
        // `getDateTimeFormat()` is a protected extension point; the `as any`
        // returns an out-of-union value to reach that guard.
        const conn = ctx.withDateTimeFormat('not-a-real-format' as any)

        for (const buildCurrent of [
            () => conn.currentDate(),
            () => conn.currentTime(),
            () => conn.currentTimestamp(),
        ]) {
            let caught: unknown
            try {
                sync(conn.selectFromNoTable().select({ v: buildCurrent() }).executeSelectMany())
            } catch (e) {
                caught = e
            }
            expect(reasonOf(caught)).toBe('INVALID_CONFIGURATION')
        }
    })
})
