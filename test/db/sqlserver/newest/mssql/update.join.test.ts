// `UPDATE … INNER JOIN j ON … WHERE …` — multi-table UPDATE where the
// JOIN method (not just `.from(...)`) is used. Only MariaDB and MySQL
// type `.innerJoin` / `.leftJoin` on `UpdateExpression` (see
// [src/expressions/update.ts:368-447](../../../../../src/expressions/update.ts#L368-L447) —
// `OnExpressionFnType` is narrowed to `'noopDB' | 'mariaDB' | 'mySql'`).
// On those two dialects the library emits MariaDB/MySQL's
// `UPDATE t INNER JOIN j ON ... SET ... WHERE ...` form natively (see
// [src/sqlBuilders/AbstractMySqlMariaBDSqlBuilder.ts](../../../../../src/sqlBuilders/AbstractMySqlMariaBDSqlBuilder.ts)).
//
// Pins the UpdateQueryBuilder `innerJoin` / `leftJoin` / `leftOuterJoin` /
// `dynamicOn` / `on` / `and`-on-join branches at
// [src/queryBuilders/UpdateQueryBuilder.ts:847-924](../../../../../src/queryBuilders/UpdateQueryBuilder.ts#L847-L924)
// that aren't reached by `update.from.test.ts` (which only uses
// `.from(table)`). The `.and()` after `.on()` exercises a different code
// path than `.where().and()` because it lands on `__lastJoin.__on`
// instead of `__where` (see [L811-815](../../../../../src/queryBuilders/UpdateQueryBuilder.ts#L811-L815)).
//
// Mock-mode pins the SQL; real-DB mode wraps each update in
// `ctx.withRollback` so the seed survives.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` / `.leftOuterJoin` on UPDATE are typed `never` on SQL Server (only MariaDB / MySQL enable join-on-UPDATE); the equivalent pattern is `.update(t).from(j).set(...).where(...)`.
    /*
    test('update-with-inner-join-on-condition', async () => {
        // Bump priority of every issue whose project is archived.
        // The JOIN condition lives in `.on(...)`, not in WHERE — pins
        // the `__lastJoin.__on` setter branch that `.from(...)` cannot
        // reach. Seed: project 4 ('Legacy app') is archived; issues 1, 2, 3
        // belong to projects 1, 1, 2 (active); issue 4 belongs to
        // project 3 (active). So zero issues match → affected = 0 on real DB.
        ctx.mockNext(0)

        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
                .set({ priority: tIssue.priority.add(1) })
                .where(tProject.archivedAt.isNotNull())
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue inner join project on project.id = issue.project_id set issue.priority = issue.priority + ? where project.archived_at is not null"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(0)
        })
    })
    */

    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` / `.leftOuterJoin` on UPDATE are typed `never` on SQL Server (only MariaDB / MySQL enable join-on-UPDATE); the equivalent pattern is `.update(t).from(j).set(...).where(...)`.
    /*
    test('update-with-inner-join-targets-rows-by-joined-column', async () => {
        // Update issues belonging to a project with a specific slug.
        // The condition uses a joined-table column inside WHERE
        // (post-JOIN filter). Pins the WHERE chain riding on top of
        // the JOIN chain.
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
                .set({ status: 'closed' })
                .where(tProject.slug.equals('mktg-site'))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue inner join project on project.id = issue.project_id set issue.status = ? where project.slug = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "closed",
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

    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` / `.leftOuterJoin` on UPDATE are typed `never` on SQL Server (only MariaDB / MySQL enable join-on-UPDATE); the equivalent pattern is `.update(t).from(j).set(...).where(...)`.
    /*
    test('update-with-multi-condition-on-clause-via-and', async () => {
        // The `on(...)` chain followed by `.and(...)` accumulates into
        // a compound JOIN predicate (NOT into the outer WHERE). Pins
        // the `.and()` branch on `UpdateQueryBuilder` at
        // [L811-815](../../../../../src/queryBuilders/UpdateQueryBuilder.ts#L811-L815)
        // that lands on `__lastJoin.__on` (instead of the where slot).
        // Distinct code path from `.where().and()` — same .and() method,
        // different dispatch.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
                    .and(tProject.slug.equals('mktg-site'))
                .set({ priority: 5 })
                .where(tIssue.status.equals('open'))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue inner join project on project.id = issue.project_id and project.slug = ? set issue.priority = ? where issue.status = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "mktg-site",
                5,
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
                expect(affected).toBe(1)
            }
        })
    })
    */
})
