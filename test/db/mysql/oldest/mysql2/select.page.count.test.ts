// What executeSelectPage counts: the rows of the select, not the rows of the table.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('page-of-an-aggregate-without-group-by-counts-its-one-row', async () => {
        const expected = { data: [{ total: 4 }], count: 1 }
        ctx.mockNext([{ total: 4 }])
        ctx.mockNext(1)
        const page = await ctx.conn.selectFrom(tIssue)
            .select({ total: ctx.conn.count(tIssue.id) })
            .executeSelectPage()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) from (select count(id) as total from issue) as result_for_count"`)
        expect(page).toEqual(expected)
        assertType<Exact<typeof page, { data: { total: number }[], count: number }>>()
    })

    test('page-of-an-aggregate-without-rows-still-counts-its-one-row', async () => {
        const expected = { data: [{ total: 0 }], count: 1 }
        ctx.mockNext([{ total: 0 }])
        ctx.mockNext(1)
        const page = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(-1))
            .select({ total: ctx.conn.count(tIssue.id) })
            .executeSelectPage()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) from (select count(id) as total from issue where id = ?) as result_for_count"`)
        expect(page).toEqual(expected)
    })

    test('page-of-select-count-all-counts-its-one-row', async () => {
        const expected = { data: [4], count: 1 }
        ctx.mockNext([4])
        ctx.mockNext(1)
        const page = await ctx.conn.selectFrom(tIssue)
            .selectCountAll()
            .executeSelectPage()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) from (select count(*) as result from issue) as result_for_count"`)
        expect(page).toEqual(expected)
    })

    // NOT-APPLICABLE: connect by only exists on Oracle
    /*
    test('page-of-a-connect-by-counts-the-rows-of-the-hierarchy', async () => {
        const expected = { data: [{ id: 4 }], count: 1 }
        ctx.mockNext([{ id: 4 }])
        ctx.mockNext(1)
        const page = await ctx.conn.selectFrom(tIssue)
            .startWith(tIssue.id.equals(4))
            .connectBy(prior => prior(tIssue.id).equals(tIssue.parentId))
            .select({ id: tIssue.id })
            .executeSelectPage()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(page).toEqual(expected)
    })
    */
})
