// A condition with no value is neutral, so `.and(value)` or `.or(value)` leaves the value alone
// in the query. In a select it's a parameter on its own, and it must arrive as a boolean.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('neutral-and-a-value-in-the-select', async () => {
        const expected = [{ id: 1, flag: true }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, flag: tIssue.id.equalsIfValue(null).and(true) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ? as flag from issue where id = ?"`)
        assertType<Exact<typeof rows, Array<{ id: number; flag: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('neutral-or-a-value-in-the-select', async () => {
        const expected = [{ id: 1, flag: false }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, flag: tIssue.id.equalsIfValue(null).or(false) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ? as flag from issue where id = ?"`)
        expect(rows).toEqual(expected)
    })

    test('neutral-and-a-value-in-a-where', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equalsIfValue(null).and(true))
            .and(tIssue.id.equals(1))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where ? and id = ?"`)
        expect(rows).toEqual(expected)
    })
})
