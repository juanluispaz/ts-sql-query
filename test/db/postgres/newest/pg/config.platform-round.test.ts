// Per-connection coverage of PostgreSqlConnection's
// `usePlatformDependentRound` flag.
//
// PostgreSQL has two `round` overloads: `round(numeric)` breaks ties away from
// zero (the portable rule), while `round(double precision)` defers to libm
// (round-to-even, platform dependent). The default `false` casts the operand
// to `::numeric` first; setting `usePlatformDependentRound = true` opts into
// the bare `round(<x>)` form. This file pins the `true` branch and contrasts
// it against the default on the same query. With the flag the scale of
// `roundn` is also sent and written as it is; PostgreSQL rounds a fractional
// one (its cast to int4), as the library does without the flag.
//
// A subclass of `DBConnection` flips the protected flag while sharing
// `ctx.conn`'s underlying CaptureInterceptor, so the emitted SQL is captured in
// `ctx.lastSql` and runs against the real engine.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('platform-round: round emits the bare round(...) without ::numeric', async () => {
        // With the flag on, `round()` drops the `::numeric` cast: the bigint
        // column rounds as `round(view_count)` and the divided value (already
        // `::float`) rounds as `round(<float div>)`. Issue 1: view_count 0,
        // priority 2, so priority/2 = 1.0 -> round 1.
        const conn = ctx.withUsePlatformDependentRound()
        const expected = [{ id: 1, vr: 0n, dr: 1 }]
        ctx.mockNext(expected)
        const rows = await conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                vr: tIssue.viewCount.round(),
                dr: tIssue.priority.divide(2).round(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(view_count) as vr, round(priority::float / $1) as dr from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; vr: bigint; dr: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('platform-round: default connection keeps the ::numeric cast (contrast)', async () => {
        // Same query through the default `ctx.conn` (flag `false`): each
        // `round(...)` wraps its operand in `::numeric` so tie-breaking is
        // portable.
        const expected = [{ id: 1, vr: 0n, dr: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                vr: tIssue.viewCount.round(),
                dr: tIssue.priority.divide(2).round(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round((view_count)::numeric) as vr, round((priority::float / $1)::numeric) as dr from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; vr: bigint; dr: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('platform-round: roundn sends a fractional number scale as it is', async () => {
        // The scale 1.6 reaches the database as it is: the database rounds it to 2 decimals, so 2.345 gives 2.35.
        const conn = ctx.withUsePlatformDependentRound()
        ctx.mockNext({ r: 2.35 })
        const row = await conn.selectFromNoTable()
            .select({ r: conn.const(2.345, 'double').roundn(1.6) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select round(($1)::numeric, ($2::float8)::int4) as r"`)
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
        const conn = ctx.withUsePlatformDependentRound()
        ctx.mockNext({ r: 2.35 })
        const row = await conn.selectFromNoTable()
            .select({ r: conn.const(2.345, 'double').roundn(conn.const(3.2, 'double').divide(2)) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select round(($1)::numeric, ($2::float8 / $3)::int4) as r"`)
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
