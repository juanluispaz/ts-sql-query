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
import type { DBConnection } from '../../domain/connection.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'

function reasonOf(e: unknown): string | undefined {
    if (e instanceof TsSqlError) return e.errorReason.reason
    return undefined
}

// 2024-01-15T10:30:45.123Z, a Monday: the components every format must give back.
const REF = new Date(Date.UTC(2024, 0, 15, 10, 30, 45, 123))
const REF_COMPONENTS = { y: 2024, mo: 0, d: 15, dow: 1, h: 10, mi: 30, s: 45, ms: 123, t: 1705314645123 }

function selectAllComponents(conn: DBConnection) {
    const d = conn.const(REF, 'localDateTime')
    return conn.selectFromNoTable()
        .select({
            y:   d.getFullYear(),
            mo:  d.getMonth(),
            d:   d.getDate(),
            dow: d.getDay(),
            h:   d.getHours(),
            mi:  d.getMinutes(),
            s:   d.getSeconds(),
            ms:  d.getMilliseconds(),
            t:   d.getTime(),
        })
        .executeSelectOne()
}

type Components = { y: number; mo: number; d: number; dow: number; h: number; mi: number; s: number; ms: number; t: number }

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('format: localdate seconds as text', async () => {
        const conn = ctx.withDateTimeFormat('localdate seconds as text')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now', 'localtime') as d, time('now', 'localtime') as t, datetime('now', 'localtime') as ts"`)
    })

    test('format: localdate milliseconds as text', async () => {
        const conn = ctx.withDateTimeFormat('localdate milliseconds as text')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now', 'localtime') as d, strftime('%H:%M:%f', 'now', 'localtime') as t, strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime') as ts"`)
    })

    test('format: localdate seconds as text using T separator', async () => {
        const conn = ctx.withDateTimeFormat('localdate seconds as text using T separator')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now', 'localtime') as d, time('now', 'localtime') as t, strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime') as ts"`)
    })

    test('format: localdate milliseconds as text using T separator', async () => {
        const conn = ctx.withDateTimeFormat('localdate milliseconds as text using T separator')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now', 'localtime') as d, strftime('%H:%M:%f', 'now', 'localtime') as t, strftime('%Y-%m-%dT%H:%M:%f', 'now', 'localtime') as ts"`)
    })

    test('format: UTC seconds as text', async () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now') as d, time('now') as t, datetime('now') as ts"`)
    })

    test('format: UTC milliseconds as text', async () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now') as d, strftime('%H:%M:%f', 'now') as t, strftime('%Y-%m-%d %H:%M:%f', 'now') as ts"`)
    })

    test('format: UTC seconds as text using T separator', async () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text using T separator')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now') as d, time('now') as t, strftime('%Y-%m-%dT%H:%M:%S', 'now') as ts"`)
    })

    test('format: UTC milliseconds as text using T separator', async () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using T separator')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now') as d, strftime('%H:%M:%f', 'now') as t, strftime('%Y-%m-%dT%H:%M:%f', 'now') as ts"`)
    })

    test('format: UTC seconds as text using Z timezone', async () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text using Z timezone')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now') as d, strftime('%H:%M:%SZ', 'now') as t, strftime('%Y-%m-%d %H:%M:%SZ', 'now') as ts"`)
    })

    test('format: UTC milliseconds as text using Z timezone', async () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using Z timezone')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now') as d, strftime('%H:%M:%fZ', 'now') as t, strftime('%Y-%m-%d %H:%M:%fZ', 'now') as ts"`)
    })

    test('format: UTC seconds as text using T separator and Z timezone', async () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text using T separator and Z timezone')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now') as d, strftime('%H:%M:%SZ', 'now') as t, strftime('%Y-%m-%dT%H:%M:%SZ', 'now') as ts"`)
    })

    test('format: UTC milliseconds as text using T separator and Z timezone', async () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using T separator and Z timezone')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now') as d, strftime('%H:%M:%fZ', 'now') as t, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') as ts"`)
    })

    test('format: Julian day as real number', async () => {
        const conn = ctx.withDateTimeFormat('Julian day as real number')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select julianday(date('now')) as d, (julianday(strftime('1970-01-01 %H:%M:%f', 'now')) - julianday('1970-01-01')) as t, julianday('now') as ts"`)
    })

    test('format: Unix time seconds as integer', async () => {
        const conn = ctx.withDateTimeFormat('Unix time seconds as integer')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%s', date('now')) as integer) as d, cast(strftime('%s', strftime('1970-01-01 %H:%M:%S', 'now')) as integer) as t, cast(strftime('%s', 'now') as integer) as ts"`)
    })

    test('format: Unix time milliseconds as integer', async () => {
        const conn = ctx.withDateTimeFormat('Unix time milliseconds as integer')
        sync(conn.selectFromNoTable()
            .select({ d: conn.currentDate(), t: conn.currentTime(), ts: conn.currentTimestamp() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (cast(strftime('%s', date('now')) as integer) * 1000) as d, cast(round((julianday(strftime('1970-01-01 %H:%M:%f', 'now')) - 2440587.5) * 86400000.0) as integer) as t, cast(round((julianday('now') - 2440587.5) * 86400000.0) as integer) as ts"`)
    })

    test('getters of a local date time: Julian day as real number', async () => {
        // The nine getters on a local date time sent as a Julian day (a real
        // number) give back the components of 2024-01-15 10:30:45.123, the
        // milliseconds and the instant included.
        const conn = ctx.withDateTimeFormat('Julian day as real number')
        ctx.mockNext(REF_COMPONENTS)
        const row = await selectAllComponents(conn)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%Y', ?1) as integer) as y, cast(strftime('%m', ?2) as integer) - 1 as mo, cast(strftime('%d', ?3) as integer) as d, cast(strftime('%w',?4) as integer) as dow, cast(strftime('%H', ?5) as integer) as h, cast(strftime('%M', ?6) as integer) as mi, cast(strftime('%S', ?7) as integer) as s, cast(round(strftime('%f', ?8) * 1000) as integer) % 1000 as ms, round((julianday(?9) - 2440587.5) * 86400000.0) as t"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2460324.938022257,
            2460324.938022257,
            2460324.938022257,
            2460324.938022257,
            2460324.938022257,
            2460324.938022257,
            2460324.938022257,
            2460324.938022257,
            2460324.938022257,
          ]
        `)
        assertType<Exact<typeof row, Components>>()
        expect(row).toEqual(REF_COMPONENTS)
    })

    test('getters of a local date time: Unix time milliseconds as integer', async () => {
        // The same nine getters on the date time sent as the milliseconds
        // since 1970 (an integer).
        const conn = ctx.withDateTimeFormat('Unix time milliseconds as integer')
        ctx.mockNext(REF_COMPONENTS)
        const row = await selectAllComponents(conn)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%Y', cast(floor(?1 / 1000.0) as integer), 'unixepoch') as integer) as y, cast(strftime('%m', cast(floor(?2 / 1000.0) as integer), 'unixepoch') as integer) - 1 as mo, cast(strftime('%d', cast(floor(?3 / 1000.0) as integer), 'unixepoch') as integer) as d, cast(strftime('%w',cast(floor(?4 / 1000.0) as integer), 'unixepoch') as integer) as dow, cast(strftime('%H', cast(floor(?5 / 1000.0) as integer), 'unixepoch') as integer) as h, cast(strftime('%M', cast(floor(?6 / 1000.0) as integer), 'unixepoch') as integer) as mi, cast(strftime('%S', cast(floor(?7 / 1000.0) as integer), 'unixepoch') as integer) as s, ((?8 % 1000) + 1000) % 1000 as ms, ?9 as t"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1705314645123,
            1705314645123,
            1705314645123,
            1705314645123,
            1705314645123,
            1705314645123,
            1705314645123,
            1705314645123,
            1705314645123,
          ]
        `)
        assertType<Exact<typeof row, Components>>()
        expect(row).toEqual(REF_COMPONENTS)
    })

    test('getters of a local date time: UTC milliseconds as text', async () => {
        // The same nine getters on the date time sent as the text
        // '2024-01-15 10:30:45.123'.
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text')
        ctx.mockNext(REF_COMPONENTS)
        const row = await selectAllComponents(conn)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%Y', ?1) as integer) as y, cast(strftime('%m', ?2) as integer) - 1 as mo, cast(strftime('%d', ?3) as integer) as d, cast(strftime('%w',?4) as integer) as dow, cast(strftime('%H', ?5) as integer) as h, cast(strftime('%M', ?6) as integer) as mi, cast(strftime('%S', ?7) as integer) as s, cast(round(strftime('%f', ?8) * 1000) as integer) % 1000 as ms, round((julianday(?9) - 2440587.5) * 86400000.0) as t"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15 10:30:45.123",
            "2024-01-15 10:30:45.123",
            "2024-01-15 10:30:45.123",
            "2024-01-15 10:30:45.123",
            "2024-01-15 10:30:45.123",
            "2024-01-15 10:30:45.123",
            "2024-01-15 10:30:45.123",
            "2024-01-15 10:30:45.123",
            "2024-01-15 10:30:45.123",
          ]
        `)
        assertType<Exact<typeof row, Components>>()
        expect(row).toEqual(REF_COMPONENTS)
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
