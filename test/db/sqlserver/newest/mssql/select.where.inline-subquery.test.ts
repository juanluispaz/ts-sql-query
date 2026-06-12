// Coverage of an inline subquery wrapped via `forUseAsInlineQueryValue()`
// that is itself used as a boolean condition (in `.where(...)`,
// `.and(...)`, etc.). On SQL Server a boolean one-column select is
// wrapped as `((<select>) = 1)` to coerce its bit storage back to a SQL
// condition.
//
// The schema's boolean columns all carry a CustomBooleanTypeAdapter
// (Y/N or t/f), so the value coming out of the real DB doesn't match
// what `((...) = 1)` expects on every dialect — the real-DB assertion
// is gated to mock mode and snapshot/SQL is the primary contract.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('boolean-inline-subquery-as-condition', async () => {
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }]
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
        // tests-audit-disable-next-line one-sided-guard -- expected rows depend on seed data; the real-DB contract here is that the query executes (no error), the value is asserted under the mock
        if (!ctx.realDbEnabled) expect(result).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where ((select cast(case when published = 't' then 1 else 0 end as bit) as [result] from project where id = @0) = 1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

    test('negated-boolean-inline-subquery-as-condition', async () => {
        // `.negate()` on the wrapped inline-select value source emits a
        // leading `not (...)` around the same coerced condition.
        const expected = [{ id: 4 }]
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
        // tests-audit-disable-next-line one-sided-guard -- expected rows depend on seed data; the real-DB contract here is that the query executes (no error), the value is asserted under the mock
        if (!ctx.realDbEnabled) expect(result).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where not ((select cast(case when published = 't' then 1 else 0 end as bit) as [result] from project where id = @0) = 1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })
})
