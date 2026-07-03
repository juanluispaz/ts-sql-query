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
import { tIssue, tOrganization, tProject, tProjectReview } from '../../domain/connection.js'
import { ctx } from './setup.js'

// tProjectReview is referenced by the `delete-using-returning-scaled-adapter-column`
// test below; the cells where that test is uncommented use it for real.
void tProjectReview

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

    test('delete-allowing-no-where-using-without-where-removes-all-rows', async () => {
        // `deleteAllowingNoWhereFrom(t).using(j)` is executable with no WHERE:
        // the cartesian `DELETE ... USING project` removes every seeded issue
        // (the worklog and webhook rows that reference issue cascade ON DELETE).
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteAllowingNoWhereFrom(tIssue)
                .using(tProject)
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue, project"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })

    // TODO[LIMITATION]: see LIMITATIONS.md — RETURNING is not accepted on a multi-table DELETE (DELETE ... USING) as of MariaDB 12.3.2
    /*
    test('delete-using-with-returning-auxiliary-using-column', async () => {
        // RETURNING a column from the USING-joined table (`project.slug`), not the
        // target `issue`. PostgreSQL's DELETE … USING … RETURNING can project
        // columns from the USING relations. Filtered by an impossible issue id so
        // no seed rows are removed; executeDeleteNoneOrOne returns null on the real
        // DB.
        const expectedMock = { projSlug: 'mktg-site' }
        ctx.mockNext(expectedMock)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .where(tIssue.projectId.equals(tProject.id))
                .and(tIssue.id.equals(99999))
                .returning({
                    projSlug: tProject.slug,
                })
                .executeDeleteNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using project where issue.project_id = project.id and issue.id = $1 returning project.slug as "projSlug""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
              ]
            `)
            assertType<Exact<typeof row, { projSlug: string } | null>>()
            if (!ctx.realDbEnabled) expect(row).toEqual(expectedMock)
            else expect(row).toBeNull()
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — RETURNING is not accepted on a multi-table DELETE (DELETE ... USING) as of MariaDB 12.3.2
    /*
    test('delete-using-returning-scaled-adapter-column', async () => {
        // An adapter column read through DELETE … USING … RETURNING:
        // `returningOneColumn(score)` reads review 1's score through the
        // scaledTenthAdapter (raw 850 -> 85). The USING join narrows the delete to
        // the review's project, and the adapter read fires on the RETURNING value.
        // Runs inside withRollback (tProjectReview is a leaf).
        await ctx.withRollback(async () => {
            ctx.mockNext(850)
            const score = await ctx.conn.deleteFrom(tProjectReview)
                .using(tProject)
                .where(tProjectReview.projectId.equals(tProject.id))
                .and(tProjectReview.id.equals(1))
                .returningOneColumn(tProjectReview.score)
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from project_review using project where project_review.project_id = project.id and project_review.id = $1 returning score as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof score, number>>()
            expect(score).toBe(85)
        })
    })
    */

    // The server rejects the emitted `delete from issue using issue,
    // project ... RETURNING ...` form with a parse error at `returning`
    // (verified against MariaDB 12.3.2). Single-table DELETE ... RETURNING
    // works on this image (it has shipped since MariaDB 10.0.5), but
    // RETURNING on a multi-table DELETE (DELETE ... USING) is not accepted.
    // TODO[LIMITATION]: see LIMITATIONS.md — RETURNING is not accepted on a multi-table DELETE (DELETE ... USING) as of MariaDB 12.3.2
    /*
    test('delete-using-returning-nullable-projected-optional', async () => {
        // `projectingOptionalValuesAsNullable()` on a DELETE … USING … RETURNING:
        // the optional `body` leaf surfaces as `string | null` (present-null)
        // instead of the default `body?`. Filtered by an impossible issue id so no
        // seed row is removed; the mock primes a null-body row. Where the dialect
        // has no DELETE … USING … RETURNING the test is commented out for symmetry.
        const expectedMock = [{ id: -1, body: null }]
        ctx.mockNext(expectedMock)
        await ctx.withRollback(async () => {
            const rows = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .where(tIssue.projectId.equals(tProject.id))
                .and(tIssue.id.equals(99999))
                .returning({ id: tIssue.id, body: tIssue.body })
                .projectingOptionalValuesAsNullable()
                .executeDeleteMany()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof rows, Array<{ id: number; body: string | null }>>>()
            if (!ctx.realDbEnabled) expect(rows).toEqual(expectedMock)
            else expect(rows).toEqual([])
        })
    })
    */
})
