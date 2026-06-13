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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, assignee_id as assigneeId from issue order by assigneeId is null, assigneeId asc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        // Issue 3 (assignee_id null) goes last.
        expect(result[result.length - 1]?.id).toBe(3)
    })

    test('order-by-from-string', async () => {
        // priority desc, id desc:
        //   prio 3 → issue 3; prio 2 → issues 4, 1 (id desc); prio 1 → issue 2.
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
        // priority desc, id desc → 3 first (prio=3), then prio=2 desc id, then prio=1
        expect(result[0]?.id).toBe(3)
        expect(result.at(-1)?.id).toBe(2)
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
        expect(result).toEqual([{ id: 2 }, { id: 3 }])
    })

    // Not applicable: the synthetic ORDER BY when `limit/offset` is used
    // without `.orderBy(...)` is SqlServer-only (SqlServerSqlBuilder.ts:256-271).
    // Every other dialect accepts limit/offset on an unordered query and
    // emits the clause directly; no fake ORDER BY is needed. Body copied
    // verbatim from the canonical mssql cell for cross-cell diff parity.
    // NOT-APPLICABLE: MySQL emits limit/offset on an unordered query directly; the synthetic ORDER BY is SqlServer-only.
    /*
    test('limit-offset-without-order-by-pk-not-first-emits-synthetic-pk-position', async () => {
        const expected = [{ status: 'in_progress', id: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
                id:     tIssue.id,
            })
            .limit(1).offset(1)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof result, Array<{ status: string; id: number }>>>()
        expect(result).toEqual(expected)
    })
    */

    // Not applicable: the synthetic ORDER BY when `limit/offset` is used
    // without `.orderBy(...)` is SqlServer-only (SqlServerSqlBuilder.ts:256-271).
    // Every other dialect accepts limit/offset on an unordered query and
    // emits the clause directly; no fake ORDER BY is needed. Body copied
    // verbatim from the canonical mssql cell for cross-cell diff parity.
    // NOT-APPLICABLE: MySQL emits limit/offset on an unordered query directly; the synthetic ORDER BY is SqlServer-only.
    /*
    test('limit-offset-without-order-by-no-pk-emits-synthetic-position-one', async () => {
        const expected = [{ status: 'in_progress' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
            })
            .limit(1).offset(1)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof result, Array<{ status: string }>>>()
        expect(result).toEqual(expected)
    })
    */

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id limit 2147483647 offset ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual([{ id: 2 }, { id: 3 }, { id: 4 }])
    })
})
