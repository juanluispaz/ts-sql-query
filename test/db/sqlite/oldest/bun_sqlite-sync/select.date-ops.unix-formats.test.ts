// Coverage of SQLite date-extraction functions
// (`.getFullYear / .getMonth / .getDate / .getDay / .getHours /
// .getMinutes / .getSeconds / .getMilliseconds / .getTime`) under the
// `Unix time seconds as integer` and `Unix time milliseconds as integer`
// formats. These formats are SQLite-specific (driven by `dateTimeFormat`
// on SqliteConnection); the active implementation lives in the sqlite
// cells. Kept here with every test commented out for cross-cell symmetry
// per DESIGN §"Symmetry rule".

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

// 2024-01-15T10:30:45.123Z — TZ=UTC is forced by the suite (see
// test/lib/setupTimezone.ts), so the marshalling and the SQL extraction
// are deterministic.
const REF = new Date(Date.UTC(2024, 0, 15, 10, 30, 45, 123))
const PRE_EPOCH = new Date(Date.UTC(1969, 11, 31, 23, 59, 58, 500))

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('format Unix time seconds: extract all components', async () => {
        const conn = ctx.withDateTimeFormat('Unix time seconds as integer')
        const d = conn.const(REF, 'localDateTime')
        ctx.mockNext([])
        sync(conn.selectFromNoTable()
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
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%Y', ?, 'unixepoch') as integer) as "y", cast(strftime('%m', ?, 'unixepoch') as integer) - 1 as mo, cast(strftime('%d', ?, 'unixepoch') as integer) as "d", cast(strftime('%w',?, 'unixepoch') as integer) as dow, cast(strftime('%H', ?, 'unixepoch') as integer) as "h", cast(strftime('%M', ?, 'unixepoch') as integer) as mi, cast(strftime('%S', ?, 'unixepoch') as integer) as "s", 0 as ms, (? * 1000) as "t""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1705314645,
            1705314645,
            1705314645,
            1705314645,
            1705314645,
            1705314645,
            1705314645,
            1705314645,
          ]
        `)
    })

    test('format Unix time milliseconds: extract all components', async () => {
        const conn = ctx.withDateTimeFormat('Unix time milliseconds as integer')
        const d = conn.const(REF, 'localDateTime')
        ctx.mockNext([])
        sync(conn.selectFromNoTable()
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
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%Y', cast(floor(? / 1000.0) as integer), 'unixepoch') as integer) as "y", cast(strftime('%m', cast(floor(? / 1000.0) as integer), 'unixepoch') as integer) - 1 as mo, cast(strftime('%d', cast(floor(? / 1000.0) as integer), 'unixepoch') as integer) as "d", cast(strftime('%w',cast(floor(? / 1000.0) as integer), 'unixepoch') as integer) as dow, cast(strftime('%H', cast(floor(? / 1000.0) as integer), 'unixepoch') as integer) as "h", cast(strftime('%M', cast(floor(? / 1000.0) as integer), 'unixepoch') as integer) as mi, cast(strftime('%S', cast(floor(? / 1000.0) as integer), 'unixepoch') as integer) as "s", ((? % 1000) + 1000) % 1000 as ms, ? as "t""`)
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
    })

    test('format Unix time milliseconds: pre-1970 instant keeps its components', async () => {
        // An instant BEFORE 1970 is a negative unix-time, and the components are extracted
        // by dividing it: integer division truncates toward zero in SQLite instead of
        // flooring, and the modulo keeps the dividend's sign. Both are invisible for any
        // instant at or after 1970, where the value is positive. 1969-12-31T23:59:58.500Z
        // is -1500 ms, whose second is 58 and whose millisecond is 500 — never -500.
        const conn = ctx.withDateTimeFormat('Unix time milliseconds as integer')
        const d = conn.const(PRE_EPOCH, 'localDateTime')
        const expected = [{ y: 1969, mo: 11, d: 31, h: 23, mi: 59, s: 58, ms: 500 }]
        ctx.mockNext(expected)
        const rows = sync(conn.selectFromNoTable()
            .select({
                y:   d.getFullYear(),
                mo:  d.getMonth(),
                d:   d.getDate(),
                h:   d.getHours(),
                mi:  d.getMinutes(),
                s:   d.getSeconds(),
                ms:  d.getMilliseconds(),
            })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%Y', cast(floor(? / 1000.0) as integer), 'unixepoch') as integer) as "y", cast(strftime('%m', cast(floor(? / 1000.0) as integer), 'unixepoch') as integer) - 1 as mo, cast(strftime('%d', cast(floor(? / 1000.0) as integer), 'unixepoch') as integer) as "d", cast(strftime('%H', cast(floor(? / 1000.0) as integer), 'unixepoch') as integer) as "h", cast(strftime('%M', cast(floor(? / 1000.0) as integer), 'unixepoch') as integer) as mi, cast(strftime('%S', cast(floor(? / 1000.0) as integer), 'unixepoch') as integer) as "s", ((? % 1000) + 1000) % 1000 as ms"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            -1500,
            -1500,
            -1500,
            -1500,
            -1500,
            -1500,
            -1500,
          ]
        `)
        expect(rows).toEqual(expected)
    })

})
