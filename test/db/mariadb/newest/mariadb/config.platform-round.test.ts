// Per-connection coverage of MariaDBConnection's `usePlatformDependentRound`
// flag. The default casts the operand of `round` to an exact type first, so ties
// break away from zero on every platform; setting the flag opts into the bare
// `round(<x>)` over the engine's own type. This file pins the `true` branch and
// contrasts it against the default on the same query.
// With the flag the scale of `roundn` is also sent and written as it is; this
// database rounds a fractional one, as the library does without the flag.
//
// A subclass of `DBConnection` flips the protected flag while sharing
// `ctx.conn`'s CaptureInterceptor, so the emitted SQL is captured in
// `ctx.lastSql` and runs against the real engine.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { DBConnection, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

class PlatformRoundConnection extends DBConnection {
    protected override usePlatformDependentRound = true
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('platform-round: round emits the bare round(...) over the double division', async () => {
        // Issue 3: priority 3, so priority / 2 = 1.5 -> round 2. Ties of a bare
        // round over a double follow the platform's C library, so the data is a
        // value both rules round alike: the snapshot is what tells the two
        // forms apart.
        const conn = ctx.withConnection(PlatformRoundConnection)
        const expected = [{ id: 3, dr: 2 }]
        ctx.mockNext(expected)
        const rows = await conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .select({
                id: tIssue.id,
                dr: tIssue.priority.divide(2).round(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(cast(priority as double) / ?) as dr from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; dr: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('platform-round: default connection keeps the exact cast (contrast)', async () => {
        const expected = [{ id: 3, dr: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .select({
                id: tIssue.id,
                dr: tIssue.priority.divide(2).round(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(cast(cast(priority as double) / ? as decimal(65, 30))) as dr from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; dr: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('platform-round: roundn sends a fractional number scale as it is', async () => {
        // The scale 1.6 reaches the database as it is: the database rounds it to 2 decimals, so 2.345 gives 2.35.
        const conn = ctx.withConnection(PlatformRoundConnection)
        ctx.mockNext({ r: 2.35 })
        const row = await conn.selectFromNoTable()
            .select({ r: conn.const(2.345, 'double').roundn(1.6) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select round(?, ?) as r"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2.345,
            1.6,
          ]
        `)
        assertType<Exact<typeof row, { r: number }>>()
        expect(row.r).toBe(2.35)
    })

    test('platform-round: roundn writes a fractional expression scale as it is', async () => {
        // The scale 3.2 / 2 = 1.6 is written without rounding it: the database rounds it to 2 decimals, so
        // 2.345 gives 2.35.
        const conn = ctx.withConnection(PlatformRoundConnection)
        ctx.mockNext({ r: 2.35 })
        const row = await conn.selectFromNoTable()
            .select({ r: conn.const(2.345, 'double').roundn(conn.const(3.2, 'double').divide(2)) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select round(?, ? / ?) as r"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2.345,
            3.2,
            2,
          ]
        `)
        assertType<Exact<typeof row, { r: number }>>()
        expect(row.r).toBe(2.35)
    })
})
