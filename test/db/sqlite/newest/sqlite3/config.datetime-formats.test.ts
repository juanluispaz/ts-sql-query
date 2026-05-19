// Behavioral coverage of every `dateTimeFormat` accepted by
// `SqliteConnection.getDateTimeFormat()`. Each format produces different
// SQL for `currentDate()`, `currentTime()` and `currentTimestamp()` —
// the default ts-sql-query setup only ever picks one format, so the
// other 8 branches of `_currentDate / _currentTime / _currentTimestamp`
// in SqliteSqlBuilder are otherwise unreached. The test connections
// override `getDateTimeFormat` per-format; a private MockQueryRunner +
// CaptureInterceptor captures the SQL without touching the shared
// `ctx`.

import { describe, expect, test } from '../../../../lib/testRunner.js'
import { MockQueryRunner } from '../../../../../src/queryRunners/MockQueryRunner.js'
import { CaptureInterceptor } from '../../../../lib/captureInterceptor.js'
import type { SqliteDateTimeFormat } from '../../../../../src/connections/SqliteConfiguration.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

function makeConn(format: SqliteDateTimeFormat) {
    class C extends DBConnection {
        protected override getDateTimeFormat(): SqliteDateTimeFormat { return format }
    }
    const capture = new CaptureInterceptor(new MockQueryRunner(() => undefined, 'sqlite'))
    return { conn: new C(capture), capture }
}

async function emitNow(conn: DBConnection): Promise<void> {
    await conn.selectFromNoTable().select({
        d:  conn.currentDate(),
        t:  conn.currentTime(),
        ts: conn.currentTimestamp(),
    }).executeSelectMany()
}

describe(ctx.label, () => {
    test('format: localdate as text', async () => {
        const { conn, capture } = makeConn('localdate as text')
        await emitNow(conn)
        expect(capture.lastSql).toMatchInlineSnapshot(`"select date('now', 'localtime') as "d", time('now', 'localtime') as "t", datetime('now', 'localtime') as ts"`)
    })

    test('format: localdate as text using T separator', async () => {
        const { conn, capture } = makeConn('localdate as text using T separator')
        await emitNow(conn)
        expect(capture.lastSql).toMatchInlineSnapshot(`"select date('now', 'localtime') as "d", time('now', 'localtime') as "t", strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime') as ts"`)
    })

    test('format: UTC as text', async () => {
        const { conn, capture } = makeConn('UTC as text')
        await emitNow(conn)
        expect(capture.lastSql).toMatchInlineSnapshot(`"select date('now') as "d", time('now') as "t", datetime('now') as ts"`)
    })

    test('format: UTC as text using T separator', async () => {
        const { conn, capture } = makeConn('UTC as text using T separator')
        await emitNow(conn)
        expect(capture.lastSql).toMatchInlineSnapshot(`"select date('now') as "d", time('now') as "t", strftime('%Y-%m-%dT%H:%M:%S', 'now') as ts"`)
    })

    test('format: UTC as text using Z timezone', async () => {
        const { conn, capture } = makeConn('UTC as text using Z timezone')
        await emitNow(conn)
        expect(capture.lastSql).toMatchInlineSnapshot(`"select date('now') as "d", (time('now') || 'Z') as "t", strftime('%Y-%m-%d %H:%M:%SZ', 'now') as ts"`)
    })

    test('format: UTC as text using T separator and Z timezone', async () => {
        const { conn, capture } = makeConn('UTC as text using T separator and Z timezone')
        await emitNow(conn)
        expect(capture.lastSql).toMatchInlineSnapshot(`"select date('now') as "d", (time('now') || 'Z') as "t", strftime('%Y-%m-%dT%H:%M:%SZ', 'now') as ts"`)
    })

    test('format: Julian day as real number', async () => {
        const { conn, capture } = makeConn('Julian day as real number')
        await emitNow(conn)
        expect(capture.lastSql).toMatchInlineSnapshot(`"select julianday(date('now')) as "d", (julianday(strftime('1970-01-01 %H:%M:%f', 'now')) - julianday('1970-01-01')) as "t", julianday('now') as ts"`)
    })

    test('format: Unix time seconds as integer', async () => {
        const { conn, capture } = makeConn('Unix time seconds as integer')
        await emitNow(conn)
        expect(capture.lastSql).toMatchInlineSnapshot(`"select unixepoch(date('now')) as "d", unixepoch(strftime('1970-01-01 %H:%M:%S', 'now')) as "t", unixepoch('now') as ts"`)
    })

    test('format: Unix time milliseconds as integer', async () => {
        const { conn, capture } = makeConn('Unix time milliseconds as integer')
        await emitNow(conn)
        expect(capture.lastSql).toMatchInlineSnapshot(`"select (unixepoch(date('now')) * 1000) as "d", cast(unixepoch(strftime('1970-01-01 %H:%M:%f', 'now'), 'subsec') * 1000 as integer) as "t", cast(unixepoch('now', 'subsec') * 1000 as integer) as ts"`)
    })
})
