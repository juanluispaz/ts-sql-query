// `HAVING` chains and `dynamicHaving()`:
//   1. `.having(c1).and(c2).or(c3)` — chaining `.and()` / `.or()` on a
//      committed HAVING predicate.
//   2. `.dynamicHaving()` followed by `.and(...)` — builds the HAVING
//      expression incrementally (twin of `dynamicWhere`).
//   3. `.dynamicHaving()` with no `.and(...)` follow-up — the HAVING
//      keyword is elided entirely.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('having-and-then-or-chains-after-initial-having', async () => {
        // `.having(c1).and(c2).or(c3)` composes `(c1 AND c2) OR c3`.
        // Per status group: closed→count 1 (max priority 2), in_progress→1
        // (max 1), open→2 (max 3). (count>0 AND count<10) is true for all
        // three, so every group survives; ordered by status.
        const expected = [
            { status: 'closed',      total: 1 },
            { status: 'in_progress', total: 1 },
            { status: 'open',        total: 2 },
        ]
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
                total:  ctx.conn.count(tIssue.id),
            })
            .groupBy('status')
            .having(ctx.conn.count(tIssue.id).greaterThan(0))
                .and(ctx.conn.count(tIssue.id).lessThan(10))
                .or(ctx.conn.max(tIssue.priority).equals(3))
            .orderBy('status')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as "status", count(id) as "total" from issue group by status having (count(id) > :0 and count(id) < :1) or max(priority) = :2 order by "status""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            10,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ status: string; total: number }>>>()
        expect(result).toEqual(expected)
    })

    test('dynamic-having-then-and-emits-having-clause', async () => {
        // `.dynamicHaving()` opens a HAVING without committing a predicate;
        // the subsequent `.and(cond)` builds it. Only the open status group
        // has count > 1.
        const expected = [{ status: 'open', total: 2 }]
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
                total:  ctx.conn.count(tIssue.id),
            })
            .groupBy('status')
            .dynamicHaving()
                .and(ctx.conn.count(tIssue.id).greaterThan(1))
            .orderBy('status')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as "status", count(id) as "total" from issue group by status having count(id) > :0 order by "status""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ status: string; total: number }>>>()
        if (!ctx.realDbEnabled) expect(result).toEqual(expected)
        else expect(result).toEqual(expected)
    })

    test('dynamic-having-with-no-conditions-emits-no-having-clause', async () => {
        // `.dynamicHaving()` followed by no `.and(...)` — the HAVING
        // slot stays empty; the builder MUST elide the `HAVING` keyword
        // entirely (twin of `dynamicWhere()` with no condition).
        const expected = [
            { status: 'closed',      total: 1 },
            { status: 'in_progress', total: 1 },
            { status: 'open',        total: 2 },
        ]
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
                total:  ctx.conn.count(tIssue.id),
            })
            .groupBy('status')
            .dynamicHaving()
            .orderBy('status')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as "status", count(id) as "total" from issue group by status order by "status""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ status: string; total: number }>>>()
        if (!ctx.realDbEnabled) expect(result).toEqual(expected)
        else expect(result).toEqual(expected)
    })
})
