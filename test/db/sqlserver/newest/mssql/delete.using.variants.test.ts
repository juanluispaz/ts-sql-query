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
import { Values } from '../../../../../src/Values.js'
import { DBConnection, tIssue, tOrganization, tProject, tProjectReview } from '../../domain/connection.js'
import { ctx } from './setup.js'

// A Values source used as the USING target of a DELETE.
class VProjectIdList extends Values<DBConnection, 'projectIds'> {
    id = this.column('int')
}

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue from project, organization where issue.project_id = project.id and project.organization_id = organization.id and organization.id = @0"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue from project, organization where issue.project_id = project.id and project.organization_id = organization.id and issue.priority = @0"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"with active_projects as (select id as id from project where archived_at is null) delete from issue from active_projects where issue.project_id = active_projects.id and issue.id = @0"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue output deleted.id as id, deleted.title as title from project where issue.project_id = project.id and issue.id = @0"`)
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

    test('delete-allowing-no-where-using-without-where-removes-all-rows', async () => {
        // `deleteAllowingNoWhereFrom(t).using(j)` is executable with no WHERE:
        // the cartesian `DELETE ... USING project` removes every seeded issue
        // (the worklog and webhook rows that reference issue cascade ON DELETE).
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteAllowingNoWhereFrom(tIssue)
                .using(tProject)
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue from project"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue output project.slug as projSlug from project where issue.project_id = project.id and issue.id = @0"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from project_review output deleted.score as [result] from project where project_review.project_id = project.id and project_review.id = @0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof score, number>>()
            expect(score).toBe(85)
        })
    })

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue output deleted.id as id, deleted.body as body from project where issue.project_id = project.id and issue.id = @0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ id: number; body: string | null }>>>()
            if (!ctx.realDbEnabled) expect(rows).toEqual(expectedMock)
            else expect(rows).toEqual([])
        })
    })

    test('delete-using-returning-nested-using-joined-object', async () => {
        // DELETE … USING … RETURNING folding the USING-joined table's columns into a
        // NESTED returning sub-object (`proj.slug` / `proj.name`) rather than the flat
        // shape the sibling auxiliary-column test uses. Both are required project
        // columns, so `proj` is a required nested object. Filtered by an impossible
        // issue id so no seed row is removed; executeDeleteNoneOrOne returns null on
        // the real DB. Where the dialect has no DELETE … USING … RETURNING the test is
        // commented out for symmetry.
        const expectedMock = { id: 1, proj: { slug: 'mktg-site', name: 'Marketing site' } }
        ctx.mockNext({ id: 1, 'proj.slug': 'mktg-site', 'proj.name': 'Marketing site' })
        await ctx.withRollback(async () => {
            const row = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .where(tIssue.projectId.equals(tProject.id))
                .and(tIssue.id.equals(99999))
                .returning({
                    id:   tIssue.id,
                    proj: { slug: tProject.slug, name: tProject.name },
                })
                .executeDeleteNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue output deleted.id as id, project.slug as [proj.slug], project.name as [proj.name] from project where issue.project_id = project.id and issue.id = @0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
              ]
            `)
            assertType<Exact<typeof row, { id: number; proj: { slug: string; name: string } } | null>>()
            if (!ctx.realDbEnabled) expect(row).toEqual(expectedMock)
            else expect(row).toBeNull()
        })
    })

    test('delete-using-left-join-returning-rule2-object-miss-drops-default', async () => {
        // `deleteFrom(t).using(j).leftJoin(a).on(...)` RETURNING a RULE-2 nested `obj`
        // whose leaves MIX an originally-required LEFT-JOINED leaf (`x` =
        // project_review.reviewer_code) with a no-table CONST leaf (`k` = const(1)).
        // The left join is between the USING-side tables (`project` LEFT JOIN
        // `project_review` on the project id — the delete target `issue` cannot be
        // referenced from the USING join), so on a join MISS the whole `obj` DROPS
        // (rule-2) even though the const leaf carries a value. Deleting issue 4 (project
        // 3, which has no review → left-join miss) drops `obj` under the default projector.
        const expected = { pid: 4 }
        ctx.mockNext({ pid: 4, 'obj.x': null, 'obj.k': 1 })
        await ctx.withRollback(async () => {
            const tReview = tProjectReview.forUseInLeftJoin()
            const row = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .leftJoin(tReview).on(tReview.projectId.equals(tProject.id))
                .where(tIssue.projectId.equals(tProject.id))
                    .and(tIssue.id.equals(4))
                .returning({
                    pid: tIssue.id,
                    obj: { x: tReview.reviewerCode, k: ctx.conn.const(1, 'int') },
                })
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue output deleted.id as pid, project_review.reviewer_code as [obj.x], @0 as [obj.k] from project left join project_review on project_review.project_id = project.id where issue.project_id = project.id and issue.id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                4,
              ]
            `)
            assertType<Exact<typeof row, { pid: number; obj?: { x: string; k: number } }>>()
            expect(row).toEqual(expected)
            expect('obj' in row).toBe(false)
        })
    })

    test('delete-using-left-join-returning-rule2-object-miss-drops-as-nullable', async () => {
        // The same DELETE-using rule-2 mixed object under
        // `projectingOptionalValuesAsNullable()`: the whole `obj` becomes `{...} | null`
        // and the join miss surfaces it as `obj: null`. Deleting issue 4 (project 3 has
        // no review → miss) → `obj` is present-null.
        const expected = { pid: 4, obj: null }
        ctx.mockNext({ pid: 4, 'obj.x': null, 'obj.k': 1 })
        await ctx.withRollback(async () => {
            const tReview = tProjectReview.forUseInLeftJoin()
            const row = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .leftJoin(tReview).on(tReview.projectId.equals(tProject.id))
                .where(tIssue.projectId.equals(tProject.id))
                    .and(tIssue.id.equals(4))
                .returning({
                    pid: tIssue.id,
                    obj: { x: tReview.reviewerCode, k: ctx.conn.const(1, 'int') },
                })
                .projectingOptionalValuesAsNullable()
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue output deleted.id as pid, project_review.reviewer_code as [obj.x], @0 as [obj.k] from project left join project_review on project_review.project_id = project.id where issue.project_id = project.id and issue.id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                4,
              ]
            `)
            assertType<Exact<typeof row, { pid: number; obj: { x: string; k: number } | null }>>()
            expect(row).toEqual(expected)
            expect('obj' in row).toBe(true)
            expect(row.obj).toBe(null)
        })
    })

    test('delete-using-values-source', async () => {
        // The USING target is a `Values` source (vs a table or a forUseInQueryAs CTE).
        // The Values `WITH projectIds(id) AS (VALUES ...)` must hoist to the top of the
        // DELETE through the USING clause. The `where` filters by an impossible id so no
        // seed rows are deleted under real DB.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const ids = Values.create(VProjectIdList, 'projectIds', [{ id: 1 }])
            const affected = await ctx.conn.deleteFrom(tIssue)
                .using(ids)
                .where(tIssue.projectId.equals(ids.id))
                .and(tIssue.id.equals(99999))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectIds as (select * from (values (@0)) as projectIds(id)) delete from issue from projectIds where issue.project_id = projectIds.id and issue.id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                99999,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(0)
            else expect(typeof affected).toBe('number')
        })
    })
})
