// Coverage of an inline subquery wrapped via `forUseAsInlineQueryValue()`
// used directly as a boolean condition (in `.where(...)`), including its
// negation.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('boolean-inline-subquery-as-condition', async () => {
        // The subquery yields project 1's published flag (true), so the
        // condition is constant true → every project is returned.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .where(
                ctx.conn.selectFrom(tProject)
                    .where(tProject.id.equals(1))
                    .selectOneColumn(tProject.published)
                    .forUseAsInlineQueryValue()
            )
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project where (((select case when published = 't' then 1 else 0 end as "result" from project where id = :0) = 1) = 1) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

    test('negated-boolean-inline-subquery-as-condition', async () => {
        // `.negate()` wraps the inline-select condition in `not (...)`.
        // Project 1 is published (true), so `not true` is constant false →
        // no rows.
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .where(
                ctx.conn.selectFrom(tProject)
                    .where(tProject.id.equals(1))
                    .selectOneColumn(tProject.published)
                    .forUseAsInlineQueryValue()
                    .negate()
            )
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project where not (((select case when published = 't' then 1 else 0 end as "result" from project where id = :0) = 1) = 1) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })
})
