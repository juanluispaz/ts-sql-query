// `DELETE … USING t INNER JOIN j ON … WHERE …` — multi-table DELETE
// where the JOIN method (not just plain `.using(...)`) is used. Only
// MariaDB and MySQL type `.innerJoin` / `.leftJoin` on their
// `DeleteExpression` (see
// [src/expressions/delete.ts:97-105](../../../../../src/expressions/delete.ts#L97-L105) —
// `OnExpressionFnType` is narrowed to `'noopDB' | 'mariaDB' | 'mySql'`).
// On those two dialects the library rewrites it under the hood to
// MariaDB/MySQL's `DELETE FROM t USING t JOIN j ON ...` form (see
// [src/sqlBuilders/AbstractMySqlMariaBDSqlBuilder.ts:348-357](../../../../../src/sqlBuilders/AbstractMySqlMariaBDSqlBuilder.ts#L348-L357)
// `_buidDeleteUsing` override that prefixes the target table to the
// from-joins result).
//
// Pins the DeleteQueryBuilder `join` / `innerJoin` / `leftJoin` /
// `dynamicOn` / `on` branches at
// [src/queryBuilders/DeleteQueryBuilder.ts:277-353](../../../../../src/queryBuilders/DeleteQueryBuilder.ts#L277-L353)
// that aren't reached by `delete.using.test.ts` (which only uses
// `.using(table)`).
//
// Mock-mode pins the SQL; real-DB mode wraps each delete in
// `ctx.withRollback` so the seed survives.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` on DELETE are typed `never` on SQL Server (the `DELETE … USING` JOIN grammar is gated to MariaDB/MySQL); on SQL Server use `.using(table).where(...)` — see `delete.using.test.ts`.
    /*
    test('delete-with-inner-join-on-condition', async () => {
        // Delete issues whose project is archived. The JOIN condition
        // lives in `.on(...)`, not in WHERE — pins the
        // `__lastJoin.__on` branch that `.using(...)` cannot reach.
        // Seed: project 4 ('Legacy app') is archived; issues 1, 2, 3
        // belong to projects 1, 1, 2 (active); issue 4 belongs to
        // project 3 (active). So zero issues are archived → affected
        // = 0 on real DB.
        ctx.mockNext(0)

        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
                .where(tProject.archivedAt.isNotNull())
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue inner join project on project.id = issue.project_id where project.archived_at is not null"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(0)
        })
    })
    */

    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` on DELETE are typed `never` on SQL Server (the `DELETE … USING` JOIN grammar is gated to MariaDB/MySQL); on SQL Server use `.using(table).where(...)` — see `delete.using.test.ts`.
    /*
    test('delete-with-inner-join-targets-rows-by-joined-column', async () => {
        // Delete issues belonging to a project with a specific slug.
        // The condition uses a joined-table column inside the WHERE
        // (post-JOIN filter). Pins the WHERE chain riding on top of
        // the JOIN chain.
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
                .where(tProject.slug.equals('mktg-site'))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue inner join project on project.id = issue.project_id where project.slug = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "mktg-site",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
                // Project 1 (slug=mktg-site) has issues 1, 2 → 2 rows.
                expect(affected).toBe(2)
            } else {
                expect(affected).toBe(2)
            }
        })
    })
    */

    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` on DELETE are typed `never` on SQL Server (the `DELETE … USING` JOIN grammar is gated to MariaDB/MySQL); on SQL Server use `.using(table).where(...)` — see `delete.using.test.ts`.
    /*
    test('delete-with-multi-condition-on-clause-via-and', async () => {
        // The `on(...)` chain followed by `.and(...)` accumulates into
        // a compound JOIN predicate (NOT into the outer WHERE). Pins
        // the `.and()` branch on `DeleteQueryBuilder` that lands on
        // `__lastJoin.__on` (instead of the where slot).
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
                    .and(tProject.slug.equals('mktg-site'))
                .where(tIssue.status.equals('open'))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue inner join project on project.id = issue.project_id and project.slug = ? where issue.status = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "mktg-site",
                "open",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
                // mktg-site issues 1, 2: status open=1, in_progress=2.
                // Only issue 1 matches → 1 row affected on real DB.
                expect(affected).toBeGreaterThanOrEqual(0)
            } else {
                expect(affected).toBe(2)
            }
        })
    })
    */
})
