// Coverage of `_inlineSelectAsValueForCondition` — reached when an
// inline subquery wrapped via `forUseAsInlineQueryValue()` is itself
// used as a boolean condition (in `.where(...)`, `.and(...)`, etc.).
// The AbstractSqlBuilder default at L640 is hit by Postgres/MySQL/
// MariaDB/SQLite, and Oracle/SqlServer have a dedicated override that
// emits `((<select>) = 1)` for boolean one-column selects to coerce
// their bit/number storage back to a SQL condition.
//
// The schema's boolean columns carry a CustomBooleanTypeAdapter (t/f).
// MySQL takes the AbstractSqlBuilder default and renders the inline value
// as `(published = 't')`, which the engine evaluates to 1/0, so the
// condition resolves end-to-end and the row set is asserted unconditionally.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('boolean-inline-subquery-as-condition', async () => {
        // The inner subquery yields project 1's `published` boolean (true,
        // stored as 't'). Used as the outer WHERE condition it is constant
        // truthy, so every project row passes.
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where (select (published = 't') as result from project where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

    test('negated-boolean-inline-subquery-as-condition', async () => {
        // Reaches `_inlineSelectAsValueForCondition` via `_negate(...)`
        // — `.negate()` calls `_appendConditionSql` on the wrapped
        // inline-select value source. The inner subquery is truthy
        // (project 1 is published), so the negation is constant false and
        // no project rows pass.
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where not (select (published = 't') as result from project where id = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })
})
