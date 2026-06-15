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
//      USING-list path; the emitted form is pinned by the snapshot below.
//   3. The USING target is a CTE (`.forUseInQueryAs(...)`), so the
//      builder must bubble the `WITH ...` up to the top level of the
//      DELETE — distinct from a plain table reference.
//   4. RETURNING combined with USING; the emitted form is pinned by the
//      snapshot below. Where the dialect has no DELETE … RETURNING the
//      test is commented out for symmetry.

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

    test('delete-using-cte-source', async () => {
        // USING target is a `.forUseInQueryAs(...)` view (a CTE). The
        // emitted SQL must lead with `with active_projects as (...)`
        // bubbled up from the USING clause through `__addWiths`.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const activeProjects = ctx.conn.selectFrom(tProject)
                .where(tProject.archivedAt.isNull())
                .select({ id: tProject.id })
                .forUseInQueryAs('active_projects')

            const affected = await ctx.conn.deleteFrom(tIssue)
                .using(activeProjects)
                .where(tIssue.projectId.equals(activeProjects.id))
                .and(tIssue.id.equals(99999))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"with active_projects as (select id as id from project where archived_at is null) delete from issue using issue, active_projects where issue.project_id = active_projects.id and issue.id = ?"`)
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

    // The server rejects the emitted `delete from issue using issue,
    // project ... RETURNING ...` form with a parse error at `returning`
    // (verified against MariaDB 12.3.2). Single-table DELETE ... RETURNING
    // works on this image (it has shipped since MariaDB 10.0.5), but
    // RETURNING on a multi-table DELETE (DELETE ... USING) is not accepted.
    // TODO[LIMITATION]: see LIMITATIONS.md — RETURNING is not accepted on a multi-table DELETE (DELETE ... USING) as of MariaDB 12.3.2
    /*
    test('delete-using-with-returning-none-or-one-row', async () => {
        // RETURNING combined with USING. Uses `executeDeleteNoneOrOne`
        // (not `executeDeleteOne`) so the real-DB path returns `null`
        // instead of throwing NO_RESULT when no rows match — the
        // snapshot assertions then run unconditionally. Projects only
        // columns from the *target* table so the snapshot is portable
        // across dialects. Where the dialect has no DELETE … RETURNING
        // the test is commented out for symmetry. The `where` filters by
        // an impossible id so the test does not delete seed rows under
        // real DB.
        const expectedMock = { id: -1, title: 'X' }
        ctx.mockNext(expectedMock)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .where(tIssue.projectId.equals(tProject.id))
                .and(tIssue.id.equals(99999))
                .returning({
                    id:    tIssue.id,
                    title: tIssue.title,
                })
                .executeDeleteNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue, project where issue.project_id = project.id and issue.id = ? returning issue.id as id, issue.title as title"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
              ]
            `)
            assertType<Exact<typeof row, {
                id:    number
                title: string
            } | null>>()
            if (!ctx.realDbEnabled) expect(row).toEqual(expectedMock)
            else expect(row).toBeNull()
        })
    })
    */
})
