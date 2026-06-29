// Behavioral coverage of the remaining ORDER BY modes. The existing
// select.order-by-limit-offset.test.ts exercises only `desc` and
// `asc nulls last`; this file covers the other 10 modes accepted by the
// public OrderByMode union, each dialect rendering them differently.
//
// Insensitive variants depend on the runtime collation, so the result
// order is not asserted — the focus is the emitted SQL.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('order-by-asc-nulls-first', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, assigneeId: tIssue.assigneeId })
            .orderBy('assigneeId', 'asc nulls first')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", assignee_id as "assigneeId" from issue order by "assigneeId" asc nulls first"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-desc-nulls-first', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, assigneeId: tIssue.assigneeId })
            .orderBy('assigneeId', 'desc nulls first')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", assignee_id as "assigneeId" from issue order by "assigneeId" desc nulls first"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-desc-nulls-last', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, assigneeId: tIssue.assigneeId })
            .orderBy('assigneeId', 'desc nulls last')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", assignee_id as "assigneeId" from issue order by "assigneeId" desc nulls last"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('title', 'insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "title" from issue order by lower("title")"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-asc-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('title', 'asc insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "title" from issue order by lower("title") asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-desc-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('title', 'desc insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "title" from issue order by lower("title") desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-asc-nulls-first-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('title', 'asc nulls first insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "title" from issue order by lower("title") asc nulls first"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-asc-nulls-last-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('title', 'asc nulls last insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "title" from issue order by lower("title") asc nulls last"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-desc-nulls-first-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('title', 'desc nulls first insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "title" from issue order by lower("title") desc nulls first"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-desc-nulls-last-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('title', 'desc nulls last insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "title" from issue order by lower("title") desc nulls last"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-raw-fragment', async () => {
        // The `orderBy(rawFragment)` overload — a typed ORDER BY entry point
        // that takes an arbitrary `IRawFragment` rather than a column name or
        // ValueSource. The raw fragment embeds the ordering keyword inline
        // (`<id> desc`), so the builder splices it verbatim into the ORDER BY
        // list. Ordered by id
        // descending: 4, 3, 2, 1.
        const expected = [{ id: 4 }, { id: 3 }, { id: 2 }, { id: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy(ctx.conn.rawFragment`${tIssue.id} desc`)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by issue.id desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })
})
