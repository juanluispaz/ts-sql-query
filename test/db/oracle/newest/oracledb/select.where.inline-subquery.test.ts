// Coverage of `_inlineSelectAsValueForCondition` — reached when an
// inline subquery wrapped via `forUseAsInlineQueryValue()` is itself
// used as a boolean condition (in `.where(...)`, `.and(...)`, etc.).
// The AbstractSqlBuilder default at L640 is hit by Postgres/MySQL/
// MariaDB/SQLite, and Oracle/SqlServer have a dedicated override that
// emits `((<select>) = 1)` for boolean one-column selects to coerce
// their bit/number storage back to a SQL condition.
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
        // The inline subquery coerces project 1's `published` (='t') to a
        // constant-true condition, so on the real DB this returns ALL four
        // seeded projects; `expected` is a 3-row mock fixture, not the real
        // result. The value assertion is therefore mock-only by design.
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
        // tests-audit-disable-next-line one-sided-guard -- expected is a 3-row mock fixture; the constant-true condition returns all 4 seeded projects on a real DB
        if (!ctx.realDbEnabled) expect(result).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project where (((select case when published = 't' then 1 else 0 end as "result" from project where id = :0) = 1) = 1) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

    test('negated-boolean-inline-subquery-as-condition', async () => {
        // Reaches `_inlineSelectAsValueForCondition` via `_negate(...)`
        // — `.negate()` calls `_appendConditionSql` on the wrapped
        // inline-select value source.
        // Project 1's `published` (='t') makes the inner condition true,
        // so the negation is constant-false and the real DB returns no
        // rows; `expected` is a 1-row mock fixture. Value assertion is
        // mock-only by design.
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
        // tests-audit-disable-next-line one-sided-guard -- expected is a 1-row mock fixture; the constant-false negated condition returns no rows on a real DB
        if (!ctx.realDbEnabled) expect(result).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project where not (((select case when published = 't' then 1 else 0 end as "result" from project where id = :0) = 1) = 1) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })
})
