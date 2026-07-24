// SQL-Server-only emission corners of `SqlServerSqlBuilder`, each observable
// only in the emitted T-SQL:
//
//  - `afterOrderByItems` on a query with NO `orderBy(...)`: the builder still
//    has to OPEN an `order by` to place the fragment, with no preceding items.
//  - the synthetic `order by` SQL Server injects for a `limit` when the query
//    has no explicit ordering: it scans the projection for a column to order by
//    and must SKIP a leading non-column expression.
//  - an empty `returning({})` projection: the `output` clause collapses to
//    nothing.
//  - `isNotNull()` on a non-column, non-boolean expression: the fallback
//    `<expr> is not null` branch (the `_isNull` twin is already covered).
//
// Values come from the shared seed (issues 1-4; bodies present only on 2 and 4).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('emission-edge-cases/after-order-by-items-without-order-by', async () => {
        // No `orderBy(...)` on the query: `afterOrderByItems` is the ONLY ordering
        // item, so the builder opens an `order by` with nothing before the
        // fragment. The fragment sorts by id descending → issues 4,3,2,1.
        const expected = [{ id: 4 }, { id: 3 }, { id: 2 }, { id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .customizeQuery({
                afterOrderByItems: ctx.conn.rawFragment`${tIssue.id} desc`,
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by issue.id desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('emission-edge-cases/synthetic-order-by-skips-non-column-projection', async () => {
        // A `limit` with no explicit `orderBy` makes SQL Server inject a synthetic
        // `order by` referencing a projected column by position. The FIRST entry
        // (`up`) is a non-column expression, so the scan skips it and picks the
        // second entry — the primary-key column `id` — emitting `order by 2`.
        // limit(10) returns every seeded issue, so the assertion is order-independent.
        const expected = [
            { up: 'UPDATE HERO COPY',   id: 1 },
            { up: 'REDESIGN NAVBAR',    id: 2 },
            { up: 'MIGRATE TO ESM',     id: 3 },
            { up: 'DOCUMENT /V2/USERS', id: 4 },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({
                up: tIssue.title.toUpperCase(),
                id: tIssue.id,
            })
            .limit(10)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select upper(title) as up, id as id from issue limit ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            10,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ up: string; id: number }>>>()
        expect([...rows].sort((a, b) => a.id - b.id)).toEqual(expected)
    })

    // NOT-APPLICABLE: MySQL has no RETURNING on DELETE.
    // test('emission-edge-cases/empty-returning-projection', async () => {
    //     // An empty `returning({})` on a mutation: the OUTPUT column list flattens
    //     // to nothing, so SQL Server emits the DELETE with no `output` clause. With
    //     // no OUTPUT there are no rows to hand back, so the result is an empty array
    //     // (both mock and real). Wrapped in a rollback so issue 1 is restored.
    //     await ctx.withRollback(async () => {
    //         ctx.mockNext([])
    //         const rows = await ctx.conn.deleteFrom(tIssue)
    //             .where(tIssue.id.equals(1))
    //             .returning({})
    //             .executeDeleteMany()
    //         expect(ctx.lastSql).toMatchInlineSnapshot()
    //         expect(ctx.lastParams).toMatchInlineSnapshot()
    //         assertType<Exact<typeof rows, Array<{}>>>()
    //         expect(rows).toEqual([])
    //     })
    // })

    test('emission-edge-cases/is-not-null-on-non-column-expression', async () => {
        // `isNotNull()` on a non-column, non-boolean expression (`upper(body)`)
        // takes the fallback branch `<expr> is not null`. Bodies are present only
        // on issues 2 and 4, so `upper(body) is not null` matches exactly those.
        const expected = [{ id: 2 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.body.toUpperCase().isNotNull())
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where upper(body) is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })
})
