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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select pi() as "p""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select random() as "r""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select current_time as "t""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows[0]!.t).toBeDefined()
    })

    test('currentTimestamp', async () => {
        ctx.mockNext([{ ts: new Date() }])
        const rows = await ctx.conn.selectFromNoTable()
            .select({ ts: ctx.conn.currentTimestamp() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select current_timestamp as ts"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows[0]!.ts).toBeDefined()
    })
})
