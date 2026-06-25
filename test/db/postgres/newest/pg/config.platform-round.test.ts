// Per-connection coverage of PostgreSqlConnection's
// `usePlatformDependentRound` flag — PG-only.
//
// PostgreSQL has two `round` overloads: `round(numeric)` breaks ties away from
// zero (the portable rule), while `round(double precision)` defers to libm
// (round-to-even, platform dependent). The default `false` casts the operand
// to `::numeric` first; setting `usePlatformDependentRound = true` opts into
// the bare `round(<x>)` form. This file pins the `true` branch and contrasts
// it against the default on the same query.
//
// A subclass of `DBConnection` flips the protected flag while sharing
// `ctx.conn`'s underlying CaptureInterceptor, so the emitted SQL is captured in
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

    test('platform-round: round emits the bare round(...) without ::numeric', async () => {
        // With the flag on, `round()` drops the `::numeric` cast: the bigint
        // column rounds as `round(view_count)` and the divided value (already
        // `::float`) rounds as `round(<float div>)`. Issue 1: view_count 0,
        // priority 2, so priority/2 = 1.0 -> round 1.
        const conn = new PlatformRoundConnection(ctx.conn.queryRunner)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(view_count) as vr, round(priority::float / $1::float) as dr from issue where id = $2"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round((view_count)::numeric) as vr, round((priority::float / $1::float)::numeric) as dr from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; vr: bigint; dr: number }>>>()
        expect(rows).toEqual(expected)
    })
})
