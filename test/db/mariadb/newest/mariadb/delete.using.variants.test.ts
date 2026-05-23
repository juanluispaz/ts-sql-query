// Extra coverage for `DELETE ... USING other-table` on top of the lone
// scenario already pinned in `delete.using.test.ts`. Each test walks a
// code path through `DeleteQueryBuilder.using(...)` /
// `AbstractSqlBuilder._buildDeleteUsing` that the canonical leaves
// alone:
//
//   1. USING + an additional WHERE filter only on the USING table —
//      pins the case where the USING-side narrows the delete via a
//      column predicate, not just a join.
//   2. Two `.using(...)` calls chained — exercises the multi-source
//      USING-list path (PG/Oracle: `using a, b`; mariadb/mysql:
//      `delete a from a, b, c`; SqlServer: `delete from a from a, b`).
//   3. The USING target is a CTE (`.forUseInQueryAs(...)`), so the
//      builder must bubble the `WITH ...` up to the top level of the
//      DELETE — distinct from a plain table reference.
//   4. RETURNING combined with USING — pins
//      `_buildDeleteReturning` (PG/MariaDB/SQLite), `_buildDeleteOutput`
//      (SqlServer) and Oracle's `RETURNING ... INTO` override on top
//      of a USING-list. MySQL has no RETURNING and the cell comments
//      this test out.
//
// SQLite has no DELETE...USING (the library type-excludes it for sqlite
// connections); every test is commented out in those cells.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('delete-using-with-extra-filter-on-using', async () => {
        // Delete every issue whose project belongs to a `free`-plan
        // organisation. The USING table appears twice: once for the
        // join, once for the filter on its own column. Avoids the seed
        // by filtering on an org id that does not exist.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .using(tOrganization)
                .where(tIssue.projectId.equals(tProject.id))
                .and(tProject.organizationId.equals(tOrganization.id))
                .and(tOrganization.id.equals(99999))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue, project, organization where issue.project_id = project.id and project.organization_id = organization.id and organization.id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(0)
            else expect(typeof affected).toBe('number')
        })
    })

    test('delete-using-multiple-source-tables', async () => {
        // Two chained `.using(...)` calls — equivalent to a USING-list
        // with two auxiliary tables. The body is identical to test 1;
        // the assertion divergence is only the snapshot of how each
        // dialect renders the multi-source USING (commas vs explicit
        // joins). Splitting the cases makes the SQL divergence
        // grep-able.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .using(tOrganization)
                .where(tIssue.projectId.equals(tProject.id))
                .and(tProject.organizationId.equals(tOrganization.id))
                .and(tIssue.priority.equals(99999))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue, project, organization where issue.project_id = project.id and project.organization_id = organization.id and issue.priority = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(0)
            else expect(typeof affected).toBe('number')
        })
    })

    // Not applicable on MariaDB: the server rejects the
    // `WITH cte AS (...) DELETE FROM a USING a, cte WHERE ...` form
    // the library emits — MariaDB accepts WITH as a prefix for a
    // SELECT but not in a multi-table DELETE. See other cells for the
    // canonical body.
    /*
    test('delete-using-cte-source', async () => {
        // ... see other cells for the full body — pins the bubbled
        // `with active_projects as (...) delete from issue using ...`.
    })
    */

    // Not applicable on MariaDB: RETURNING is supported only on
    // single-table DELETE in MariaDB, not on a multi-table DELETE
    // (DELETE ... USING). The server rejects the emitted
    // `delete from issue using issue, project ... RETURNING ...` form
    // with a parse error at `returning`. See other cells for the
    // canonical body.
    /*
    test('delete-using-with-returning-none-or-one-row', async () => {
        // ... see other cells for the full body — combines USING and
        // RETURNING on a single DELETE.
    })
    */
})
