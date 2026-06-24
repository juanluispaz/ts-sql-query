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
        expect(result).toEqual(expected)
    })

    test('order-by-nulls-last', async () => {
        const expected = [
            { id: 1, assigneeId: 1 },
            { id: 2, assigneeId: 2 },
            { id: 4, assigneeId: 3 },
            { id: 3, assigneeId: undefined },
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, assignee_id as "assigneeId" from issue order by "assigneeId" asc nulls last, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(result).toEqual(expected)
    })

    test('order-by-from-string', async () => {
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id limit $1 offset $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })
    test('limit-offset-without-order-by-pk-in-projection', async () => {
        const expected = [{ status: 'in_progress', id: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
                id:     tIssue.id,
            })
            .limit(1).offset(1)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status, id as id from issue limit $1 offset $2"`)
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
        const expected = [{ status: 'in_progress' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
            })
            .limit(1).offset(1)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue limit $1 offset $2"`)
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
        // `.offset(n)` with the limit elided (limitIfValue(undefined)):
        // each dialect emits its own offset-without-limit form, pinned by
        // the snapshot.
        const expected = [{ id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .limitIfValue(undefined)
            .offset(1)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id offset $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('offset-if-value-applies-when-value-present', async () => {
        // `.offsetIfValue(n)` with a real value behaves like `.offset(n)`.
        const expected = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .limit(2)
            .offsetIfValue(1)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id limit $1 offset $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('offset-if-value-elides-offset-when-undefined', async () => {
        // `.offsetIfValue(undefined)` drops the OFFSET clause entirely.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .limit(2)
            .offsetIfValue(undefined)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id limit $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })
})
