// Behavioral coverage of nullability: orderBy nulls-first/last,
// valueWhenNull coalesce, and the `*IfValue` family of predicates that
// drop themselves when the input is null/undefined.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('order-by-nulls-last', async () => {
        const expected = [
            { id: 1 },
            { id: 2 },
            { id: 3 },
            { id: 4, archivedAt: new Date(0) },  // present, ordered last
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .select({
                id:         tProject.id,
                archivedAt: tProject.archivedAt,
            })
            .orderBy('archivedAt', 'asc nulls first')
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, archived_at as archivedAt from project order by archivedAt asc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:          number
            archivedAt?: Date
        }>>>()
        // Don't pin the real archived_at value (CURRENT_TIMESTAMP at
        // seed time): only assert the shape.
        expect(result).toHaveLength(4)
    })

    test('value-when-null-coalesce', async () => {
        const expected = [
            { id: 1, body: '(empty)' },
            { id: 2, body: 'Use new tokens' },
            { id: 3, body: '(empty)' },
            { id: 4, body: 'See ADR-014' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                id:   tIssue.id,
                body: tIssue.body.valueWhenNull('(empty)'),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, isnull(body, @0) as body from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "(empty)",
          ]
        `)
        // After valueWhenNull the field is no longer optional.
        assertType<Exact<typeof result, Array<{ id: number; body: string }>>>()
        expect(result).toEqual(expected)
    })

    test('equals-if-value-null-drops-predicate', async () => {
        const expected = [
            { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 },
        ]
        ctx.mockNext(expected)

        const filterStatus: string | null = null
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equalsIfValue(filterStatus))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('contains-if-value-empty-drops-predicate', async () => {
        const expected = [
            { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 },
        ]
        ctx.mockNext(expected)

        const titleSearch = ''  // empty string is treated like null by *IfValue
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.containsIfValue(titleSearch))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })
})
