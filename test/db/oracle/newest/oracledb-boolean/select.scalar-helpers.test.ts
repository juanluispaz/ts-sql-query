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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select acos(-1) as "p" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ p: number }>>>()
        if (ctx.realDbEnabled) {
            expect(rows[0]!.p).toBeCloseTo(Math.PI, 3)
        } else {
            expect(rows).toEqual(expected)
        }
    })

    test('random', async () => {
        // Non-deterministic but bounded to [0, 1).
        const expected = [{ r: 0.5 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFromNoTable()
            .select({ r: ctx.conn.random() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select dbms_random.value from dual) as "r" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ r: number }>>>()
        if (ctx.realDbEnabled) {
            expect(rows[0]!.r).toBeGreaterThanOrEqual(0)
            expect(rows[0]!.r).toBeLessThan(1)
        } else {
            expect(rows).toEqual(expected)
        }
    })

    test('currentTime', async () => {
        // Mock value goes through the LocalTime type adapter, so we
        // don't pin the runtime value — only the SQL/params/defined-ness
        // are asserted.
        ctx.mockNext([{ t: '12:00:00' }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ t: ctx.conn.currentTime() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select timestamp '1970-01-01 00:00:00' + (localtimestamp - trunc(localtimestamp)) as "t" from dual"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select timestamp '1970-01-01 00:00:00' + (localtimestamp - trunc(localtimestamp)) >= :0 as "afterStartOfDay", timestamp '1970-01-01 00:00:00' + (localtimestamp - trunc(localtimestamp)) <= :1 as "beforeEndOfDay" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1970-01-01T00:00:00.000Z,
            1970-01-01T23:59:59.999Z,
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select current_timestamp as "ts" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows[0]!.ts).toBeDefined()
    })
})
