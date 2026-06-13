// Coverage of SQLite date-extraction functions
// (`.getFullYear / .getMonth / .getDate / .getDay / .getHours /
// .getMinutes / .getSeconds / .getMilliseconds / .getTime`) under the
// `Unix time seconds as integer` and `Unix time milliseconds as integer`
// formats. These formats are SQLite-specific (driven by `dateTimeFormat`
// on SqliteConnection); the active implementation lives in the sqlite
// cells. Kept here with every test commented out for cross-cell symmetry
// per DESIGN §"Symmetry rule".

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: MySQL — unix epoch date format is SQLite-specific
    /*
    const REF = new Date(Date.UTC(2024, 0, 15, 10, 30, 45, 123))

    test('format Unix time seconds: extract all components', async () => {
        const conn = ctx.withDateTimeFormat('Unix time seconds as integer')
        const d = conn.const(REF, 'localDateTime')
        ctx.mockNext([])
        await conn.selectFromNoTable()
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
            .executeSelectMany()
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
    */

    // NOT-APPLICABLE: MySQL — unix epoch date format is SQLite-specific
    /*
    test('format Unix time milliseconds: extract all components', async () => {
        const conn = ctx.withDateTimeFormat('Unix time milliseconds as integer')
        const d = conn.const(REF, 'localDateTime')
        ctx.mockNext([])
        await conn.selectFromNoTable()
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
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%Y', ? / 1000, 'unixepoch') as integer) as "y", cast(strftime('%m', ? / 1000, 'unixepoch') as integer) - 1 as mo, cast(strftime('%d', ? / 1000, 'unixepoch') as integer) as "d", cast(strftime('%w',? / 1000, 'unixepoch') as integer) as dow, cast(strftime('%H', ? / 1000, 'unixepoch') as integer) as "h", cast(strftime('%M', ? / 1000, 'unixepoch') as integer) as mi, cast(strftime('%S', ? / 1000, 'unixepoch') as integer) as "s", ? % 1000 as ms, ? as "t""`)
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
    */
})
