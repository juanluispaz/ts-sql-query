// Coverage of connection-level scalar helpers that no other test
// exercises today: `pi()`, `random()`, `currentTime()` and
// `currentTimestamp()`. The latter two are tested for SQLite via
// config.datetime-formats but other dialects' overrides are never hit.
//
// `random()` is non-deterministic — the real-DB assertion only checks
// the column comes back as a number, not the value.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('pi', async () => {
        const expected = [{ p: Math.PI }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFromNoTable()
            .select({ p: ctx.conn.pi() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select pi() as p"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ p: number }>>>()
        if (ctx.realDbEnabled) {
            expect(rows[0]!.p).toBeCloseTo(Math.PI, 3)
        } else {
            expect(rows).toEqual(expected)
        }
    })

    test('random', async () => {
        // Non-deterministic; only the SQL/params are pinned and the
        // assertion just verifies the column comes back as a number.
        ctx.mockNext([{ r: 0.5 }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ r: ctx.conn.random() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (random() / 18446744073709551616.0 + 0.5) as r"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ r: number }>>>()
        // Non-deterministic value in both modes — assert only that the
        // column comes back as a number.
        expect(typeof rows[0]!.r).toBe('number')
    })

    test('currentTime', async () => {
        // Mock value goes through the LocalTime type adapter, so we
        // don't pin the runtime value — only the SQL/params/defined-ness
        // are asserted.
        ctx.mockNext([{ t: '12:00:00' }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ t: ctx.conn.currentTime() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%H:%M:%f', 'now', 'localtime') as t"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows[0]!.t).toBeDefined()
    })

    test('currentTime/compared-with-a-time-of-the-day', async () => {
        // The current time is a time of the day, compared with another only by the time of the day: it is never before
        // the start of the day nor after its end, whatever day each one is kept with
        ctx.mockNext([{ afterStartOfDay: true, beforeEndOfDay: true }])
        const startOfDay = new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0))
        const endOfDay = new Date(Date.UTC(1970, 0, 1, 23, 59, 59, 999))
        const rows = await ctx.conn.selectFromNoTable()
            .select({
                afterStartOfDay: ctx.conn.currentTime().greaterOrEqual(startOfDay),
                beforeEndOfDay: ctx.conn.currentTime().lessOrEqual(endOfDay),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%H:%M:%f', 'now', 'localtime') >= ?1 as afterStartOfDay, strftime('%H:%M:%f', 'now', 'localtime') <= ?2 as beforeEndOfDay"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "00:00:00.000",
            "23:59:59.999",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ afterStartOfDay: boolean, beforeEndOfDay: boolean }>>>()
        expect(rows).toEqual([{ afterStartOfDay: true, beforeEndOfDay: true }])
    })

    test('currentTimestamp', async () => {
        ctx.mockNext([{ ts: new Date() }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ ts: ctx.conn.currentTimestamp() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime') as ts"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows[0]!.ts).toBeDefined()
    })
})
