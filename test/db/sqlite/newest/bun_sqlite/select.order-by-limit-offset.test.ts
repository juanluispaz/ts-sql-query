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
        if (ctx.realDbEnabled) {
            expect(result.map(r => r.id)).toEqual([4, 3, 2, 1])
        }
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, assignee_id as assigneeId from issue order by assigneeId asc nulls last, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        if (ctx.realDbEnabled) {
            // Issue 3 (assignee_id null) goes last.
            expect(result[result.length - 1]?.id).toBe(3)
        }
    })

    test('order-by-from-string', async () => {
        const expected = [
            { id: 4, priority: 2 },
            { id: 1, priority: 2 },
            { id: 2, priority: 1 },
            { id: 3, priority: 3 },
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
        if (ctx.realDbEnabled) {
            // priority desc, id desc → 3 first (prio=3), then prio=2 desc id, then prio=1
            expect(result[0]?.id).toBe(3)
            expect(result.at(-1)?.id).toBe(2)
        }
    })

    test('limit-offset', async () => {
        const expected = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .limit(2).offset(1)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id limit ? offset ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result).toEqual([{ id: 2 }, { id: 3 }])
        }
    })

    test('offset-without-limit', async () => {
        // `.offset(n)` is only reachable after a `.limit*()` call at the
        // type level; `.limitIfValue(undefined)` drops the limit at
        // runtime and is the only way to hit the dialect-specific
        // "offset without limit" workaround in the SQL builder:
        //   - sqlite / mariadb / mysql emit `limit 2147483647 offset N`
        //     because their grammar requires `LIMIT` before `OFFSET`.
        //   - postgres / sqlserver / oracle emit a bare `OFFSET N` (or
        //     `OFFSET N ROWS` for the latter two).
        const expected = [{ id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .limitIfValue(undefined)
            .offset(1)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id limit 2147483647 offset ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result).toEqual([{ id: 2 }, { id: 3 }, { id: 4 }])
        }
    })
})
