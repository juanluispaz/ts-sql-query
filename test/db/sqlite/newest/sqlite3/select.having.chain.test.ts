// `HAVING` chains and `dynamicHaving()` — gaps left by
// `select.aggregation.test.ts`, which only exercises a single `.having(cond)`.
//
// Three distinct builder paths pinned here:
//
//   1. `.having(c1).and(c2).or(c3)` — chains `.and()` / `.or()` on top
//      of `.having()`. The chain is mechanical SQL composition but
//      exercises the `__inHaving` dispatch branch in
//      [SelectQueryBuilder.ts:905-918 + L931-944](../../../../../src/queryBuilders/SelectQueryBuilder.ts#L905-L944)
//      that is otherwise untouched by the matrix (the `.where().and()`
//      and `.on().and()` dispatch branches share the same method).
//   2. `.dynamicHaving()` followed by `.and(...)` — the dynamic
//      counterpart, pinning the `__inHaving` setter at
//      [L946-950](../../../../../src/queryBuilders/SelectQueryBuilder.ts#L946-L950).
//      `dynamicHaving` is not exercised anywhere else in the matrix —
//      `grep -r dynamicHaving test/` returns no other hits before this file.
//   3. `.dynamicHaving()` with no `.and(...)` follow-up — the empty
//      dynamic branch, where no HAVING clause is emitted at all
//      (twin of `dynamicWhere`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('having-and-then-or-chains-after-initial-having', async () => {
        // `.having(c1).and(c2).or(c3)` — the `.and()` and `.or()`
        // calls land on `__inHaving` dispatch, not on `__where`. The
        // emitted SQL composes the three predicates with standard
        // precedence: `((c1 AND c2) OR c3)`.
        // HAVING `(count > 0 AND count < 10) OR max(priority) = 3` passes
        // every group: closed (1 row), in_progress (1 row), open (2 rows).
        // Ordered by status.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status, count(id) as total from issue group by status having (count(id) > ? and count(id) < ?) or max(priority) = ? order by status"`)
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
        // `.dynamicHaving()` sets `__inHaving = true` without committing
        // a predicate; the subsequent `.and(cond)` builds the HAVING
        // expression incrementally. Pins the dynamic-builder pattern
        // documented for HAVING (twin of `dynamicWhere`).
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status, count(id) as total from issue group by status having count(id) > ? order by status"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status, count(id) as total from issue group by status order by status"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ status: string; total: number }>>>()
        if (!ctx.realDbEnabled) expect(result).toEqual(expected)
        else expect(result).toEqual(expected)
    })
})
