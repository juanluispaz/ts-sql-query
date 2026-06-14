// Coverage of ORDER BY variants + LIMIT/OFFSET.
//   - orderBy('col')         — by alias name in the result set
//   - orderBy('col', 'desc')
//   - orderBy('col', 'asc nulls last')
//   - orderByFromString(...) — dynamic, comma-separated, optionally with
//     'desc' / 'nulls last' modifiers
//   - limit(n).offset(n)
//   - selectAll().selectOne(...) flow

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('order-by-desc', async () => {
        const expected = [{ id: 4 }, { id: 3 }, { id: 2 }, { id: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id', 'desc')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result.map(r => r.id)).toEqual([4, 3, 2, 1])
    })

    test('order-by-nulls-last', async () => {
        const expected = [
            { id: 1, assigneeId: 1 },
            { id: 2, assigneeId: 2 },
            { id: 4, assigneeId: 3 },
            { id: 3, assigneeId: null },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                id:         tIssue.id,
                assigneeId: tIssue.assigneeId,
            })
            .orderBy('assigneeId', 'asc nulls last')
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, assignee_id as assigneeId from issue order by iif(issue.assignee_id is null, 1, 0), assigneeId asc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        // Issue 3 (assignee_id null) goes last.
        expect(result[result.length - 1]?.id).toBe(3)
    })

    test('order-by-from-string', async () => {
        // priority desc, id desc → 3 first (prio=3), then prio=2 desc id
        // (4 then 1), then prio=1 (2).
        const expected = [
            { id: 3, priority: 3 },
            { id: 4, priority: 2 },
            { id: 1, priority: 2 },
            { id: 2, priority: 1 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                id:       tIssue.id,
                priority: tIssue.priority,
            })
            .orderByFromString('priority desc, id desc')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as priority from issue order by priority desc, id desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(result).toEqual(expected)
    })

    test('limit-offset', async () => {
        const expected = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .limit(2).offset(1)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id offset @0 rows fetch next @1 rows only"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual([{ id: 2 }, { id: 3 }])
    })
    test('limit-offset-without-order-by-pk-in-projection', async () => {
        // SqlServer requires ORDER BY for OFFSET/FETCH. When the user
        // omits `.orderBy(...)`, `SqlServerSqlBuilder._buildSelectOrderBy`
        // synthesises one: it scans the select columns left-to-right and
        // returns the 1-based position of the first PK column it finds.
        // Here `id` (the PK) is at projection index 2, so `order by 2`.
        // Synthetic ORDER BY id ascending → offset 1 → issue id=2
        // (`status='in_progress'`); deterministic from the seed.
        // src: SqlServerSqlBuilder.ts:256-269.
        const expected = [{ status: 'in_progress', id: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
                id:     tIssue.id,
            })
            .limit(1).offset(1)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status, id as id from issue order by 2 offset @0 rows fetch next @1 rows only"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ status: string; id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('limit-offset-without-order-by-no-pk-in-projection', async () => {
        // Same path but the projection has NO PK column. The for-loop at
        // L262-270 finds no PK and falls through to `return ' order by 1'`
        // at L271. With four seeded statuses (`open`, `in_progress`,
        // `open`, `closed`) sorted ascending the offset-1 row is
        // `in_progress` (`closed` < `in_progress`); deterministic.
        const expected = [{ status: 'in_progress' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
            })
            .limit(1).offset(1)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue order by 1 offset @0 rows fetch next @1 rows only"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ status: string }>>>()
        expect(result).toEqual(expected)
    })

    test('offset-without-limit', async () => {
        // `.offset(n)` without a preceding `.limit(n)` exercises the
        // dialect-specific workaround in the SQL builder:
        //   - sqlite / mariadb / mysql emit `limit 2147483647 offset N`
        //     because their grammar requires `LIMIT` before `OFFSET`.
        //   - postgres accepts a bare `offset N`.
        //   - sqlserver uses `OFFSET N ROWS` (FETCH is optional in TS).
        //   - oracle uses `OFFSET N ROWS`.
        const expected = [{ id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .limitIfValue(undefined)
            .offset(1)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id offset @0 rows"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual([{ id: 2 }, { id: 3 }, { id: 4 }])
    })
})
