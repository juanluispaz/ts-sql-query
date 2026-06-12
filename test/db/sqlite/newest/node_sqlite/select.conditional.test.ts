// Coverage of conditional / nullability helpers on value sources:
//   - `valueWhenNull(default)` — coalesce
//   - `asOptional()` / `asRequiredInOptionalObject()`
//   - `ignoreWhenAsNull(when)` — conditionally swap value with null
//   - the `*IfValue` family

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('valueWhenNull-coalesces', async () => {
        const expected = [
            { id: 1, body: '<empty>' },
            { id: 2, body: 'Use new tokens' },
            { id: 3, body: '<empty>' },
            { id: 4, body: 'See ADR-014' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                id:   tIssue.id,
                body: tIssue.body.valueWhenNull('<empty>'),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(body, ?) as body from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "<empty>",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; body: string }>>>()
        expect(result).toEqual(expected)
    })

    test('asOptional-makes-required-column-optional', async () => {
        const expected = [{ id: 1, status: 'open' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:     tIssue.id,
                status: tIssue.status.asOptional(),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, status as status from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        // asOptional flips required → optional in the result type.
        assertType<Exact<typeof result, Array<{
            id:     number
            status?: string
        }>>>()
        expect(result).toEqual([{ id: 1, status: 'open' }])
    })

    test('greaterThanIfValue/with-value', async () => {
        const expected = [{ id: 3 }]  // priority 3 > 2
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThanIfValue(2))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority > ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual([{ id: 3 }])
    })

    test('greaterThanIfValue/null-skips-the-predicate', async () => {
        // No filter applied → all 4 issues come back.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const nullValue: number | null = null
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThanIfValue(nullValue))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result.length).toBe(4)
        }
    })
})
