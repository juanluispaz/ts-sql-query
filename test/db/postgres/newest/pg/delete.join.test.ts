// `DELETE … USING t INNER JOIN j ON … WHERE …` — multi-table DELETE
// where the JOIN method (not just plain `.using(...)`) is used. The
// `.innerJoin` / `.leftJoin` methods on `DeleteExpression` are typed
// `never` on the dialects whose grammar has no JOIN-on-DELETE form, so
// this file runs only where they are part of the typed surface and is
// commented out elsewhere with a NOT-APPLICABLE marker. Where it runs,
// the library rewrites the JOIN into the dialect's multi-table DELETE
// form; the emitted SQL is pinned by the snapshot below.
//
// Pins the DeleteQueryBuilder `join` / `innerJoin` / `leftJoin` /
// `dynamicOn` / `on` branches that aren't reached by the plain
// `.using(table)` form.
//
// Mock-mode pins the SQL; real-DB mode wraps each delete in
// `ctx.withRollback` so the seed survives.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject, tProjectRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('delete-using-table-then-inner-join-on-using-tables', async () => {
        // `deleteFrom(t).using(u1).innerJoin(u2).on(...)` — a JOIN after `.using()`.
        // The join links the two USING tables to each other (project ↔ organization)
        // while the delete target `issue` is joined in the WHERE. Delete project 2's
        // only issue (issue 3): project 2 → issue 3 → 1 row.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
                .where(tIssue.projectId.equals(tProject.id))
                    .and(tProject.id.equals(2))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using project inner join organization on organization.id = project.organization_id where issue.project_id = project.id and project.id = $1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })

    test('delete-using-table-then-inner-join-returning-nested', async () => {
        // `.returning({ id, meta: {...} })` composed onto the using-then-join
        // multi-table DELETE — the `.returning(...)` projection coexists with the
        // USING/JOIN in one statement, and the deleted row's columns fold into a
        // nested `meta` sub-object. Delete project 2's only issue (issue 3) and
        // read back that removed row.
        const expected = { id: 3, meta: { title: 'Migrate to ESM', priority: 3 } }
        // Mock is primed with the FLAT db row (dotted alias keys); the projector
        // folds it into the nested shape asserted below.
        ctx.mockNext({ id: 3, 'meta.title': 'Migrate to ESM', 'meta.priority': 3 })
        await ctx.withRollback(async () => {
            const row = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
                .where(tIssue.projectId.equals(tProject.id))
                    .and(tProject.id.equals(2))
                .returning({
                    id:   tIssue.id,
                    meta: { title: tIssue.title, priority: tIssue.priority },
                })
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using project inner join organization on organization.id = project.organization_id where issue.project_id = project.id and project.id = $1 returning issue.id as id, issue.title as "meta.title", issue.priority as "meta.priority""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
              ]
            `)
            assertType<Exact<typeof row, {
                id:   number
                meta: { title: string; priority: number }
            }>>()
            expect(row).toEqual(expected)
        })
    })

    test('delete-using-table-then-left-join-on-using-tables', async () => {
        // `deleteFrom(t).using(u1).leftJoin(u2).on(...)` — the LEFT-join twin of the
        // inner-join-after-using test above. Emits `left join` on the USING limb.
        // Every project has an organization, so the join matches; delete project 2's
        // only issue (issue 3) → 1 row.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const tOrg = tOrganization.forUseInLeftJoin()
            const affected = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .leftJoin(tOrg).on(tOrg.id.equals(tProject.organizationId))
                .where(tIssue.projectId.equals(tProject.id))
                    .and(tProject.id.equals(2))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using project left join organization on organization.id = project.organization_id where issue.project_id = project.id and project.id = $1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })

    test('delete-using-table-then-left-outer-join-on-using-tables', async () => {
        // `deleteFrom(t).using(u1).leftOuterJoin(u2).on(...)` — a LEFT OUTER JOIN on
        // the DELETE … USING limb, emitting the explicit `left outer join` keyword.
        // Every project has an organization, so the join matches; delete project 2's
        // only issue (issue 3).
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const tOrg = tOrganization.forUseInLeftJoin()
            const affected = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .leftOuterJoin(tOrg).on(tOrg.id.equals(tProject.organizationId))
                .where(tIssue.projectId.equals(tProject.id))
                    .and(tProject.id.equals(2))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using project left outer join organization on organization.id = project.organization_id where issue.project_id = project.id and project.id = $1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })

    test('delete-using-table-then-left-join-returning-nullable-joined-column', async () => {
        // `.returning({...})` projecting the LEFT-joined `organization.name` — a
        // USING-table column returned through a LEFT join, so the projected leaf is
        // OPTIONAL (`org?: string`), distinct from the required column an inner join
        // would return. Delete project 2's only issue (issue 3); project 2's
        // organization is Acme Corp, so the join matches and the value is present.
        const expected = { id: 3, org: 'Acme Corp' }
        ctx.mockNext({ id: 3, org: 'Acme Corp' })
        await ctx.withRollback(async () => {
            const tOrg = tOrganization.forUseInLeftJoin()
            const row = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .leftJoin(tOrg).on(tOrg.id.equals(tProject.organizationId))
                .where(tIssue.projectId.equals(tProject.id))
                    .and(tProject.id.equals(2))
                .returning({
                    id:  tIssue.id,
                    org: tOrg.name,
                })
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using project left join organization on organization.id = project.organization_id where issue.project_id = project.id and project.id = $1 returning issue.id as id, organization.name as org"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
              ]
            `)
            assertType<Exact<typeof row, {
                id:   number
                org?: string
            }>>()
            expect(row).toEqual(expected)
        })
    })

    test('delete-using-table-then-inner-join-on-and-compound-join-condition', async () => {
        // `.on(c).and(c2)` on the using-then-join limb — the `.and()` chained after
        // `.on()` accumulates into the JOIN predicate (`__lastJoin.__on`), NOT the
        // outer WHERE. Restrict the join to the 'Acme Corp' organization; project 2's
        // org is Acme, so its issue (issue 3) is still deleted → 1 row.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
                    .and(tOrganization.name.equals('Acme Corp'))
                .where(tIssue.projectId.equals(tProject.id))
                    .and(tProject.id.equals(2))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using project inner join organization on organization.id = project.organization_id and organization.name = $1 where issue.project_id = project.id and project.id = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Acme Corp",
                2,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })

    test('delete-using-table-then-inner-join-dynamic-on-and', async () => {
        // `innerJoin(...).dynamicOn()` opens an empty join predicate on the
        // using-then-join limb; the first `.and(...)` becomes the initial `on`
        // condition (the empty-`on` branch, distinct from `.on(...)`). Delete
        // project 2's only issue (issue 3) → 1 row.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .innerJoin(tOrganization).dynamicOn()
                    .and(tOrganization.id.equals(tProject.organizationId))
                .where(tIssue.projectId.equals(tProject.id))
                    .and(tProject.id.equals(2))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using project inner join organization on organization.id = project.organization_id where issue.project_id = project.id and project.id = $1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })

    test('delete-using-table-then-inner-join-dynamic-on-or', async () => {
        // `innerJoin(...).dynamicOn()` followed by `.or(...)` accumulates a compound
        // OR join predicate on the using-then-join limb (the `or(...)` branch on
        // `__lastJoin.__on`). The predicate matches when the org is the project's
        // organization OR is named 'never-matches'; project 2 → org matches → its
        // issue (issue 3) is deleted → 1 row.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .innerJoin(tOrganization).dynamicOn()
                    .or(tOrganization.id.equals(tProject.organizationId))
                    .or(tOrganization.name.equals('never-matches'))
                .where(tIssue.projectId.equals(tProject.id))
                    .and(tProject.id.equals(2))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using project inner join organization on organization.id = project.organization_id or organization.name = $1 where issue.project_id = project.id and project.id = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "never-matches",
                2,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })

    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` on DELETE are typed `never` on PostgreSQL (its grammar has no JOIN-on-DELETE form); use `.using(table).where(...)` instead.
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

    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` on DELETE are typed `never` on PostgreSQL (its grammar has no JOIN-on-DELETE form); use `.using(table).where(...)` instead.
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

    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` on DELETE are typed `never` on PostgreSQL (its grammar has no JOIN-on-DELETE form); use `.using(table).where(...)` instead.
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
    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` on DELETE are typed `never` on PostgreSQL (its grammar has no JOIN-on-DELETE form); use `.using(table).where(...)` instead.
    /*
    test('delete-with-left-join-removes-issues-with-no-matching-assignee', async () => {
        // Anti-join delete: LEFT JOIN the assignee onto each issue and
        // delete the rows where no user matched (`assignee_id` is NULL).
        // Pins the `leftJoin(...).on(...)` branch on DELETE, which the
        // `innerJoin` tests above don't reach. Seed: issue 3 has
        // `assignee_id = NULL` (unassigned); issues 1, 2, 4 are assigned
        // → exactly 1 row removed on real DB.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const tAssignee = tAppUser.forUseInLeftJoin()
            const affected = await ctx.conn.deleteFrom(tIssue)
                .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                .where(tAssignee.id.isNull())
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue left join app_user on app_user.id = issue.assignee_id where app_user.id is null"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` on DELETE are typed `never` on PostgreSQL (its grammar has no JOIN-on-DELETE form); use `.using(table).where(...)` instead.
    /*
    test('delete-with-dynamic-on-builds-compound-join-condition-via-or', async () => {
        // `innerJoin(...).dynamicOn()` opens an empty join predicate that
        // the following `.or(...)` calls accumulate into the JOIN's `on`
        // clause (not the outer WHERE). Pins the `dynamicOn()` branch plus
        // the `or(...)`-on-`__lastJoin` branch on DELETE. The compound
        // predicate matches a project when EITHER its id pairs with the
        // issue OR its slug is 'never-matches'; combined with the WHERE it
        // deletes issues of the 'mktg-site' project (issues 1, 2) → 2 rows.
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .innerJoin(tProject).dynamicOn()
                    .or(tProject.id.equals(tIssue.projectId))
                    .or(tProject.slug.equals('never-matches'))
                .where(tProject.slug.equals('mktg-site'))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue inner join project on project.id = issue.project_id or project.slug = ? where project.slug = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "never-matches",
                "mktg-site",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)
        })
    })
    */

    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` on DELETE are typed `never` on PostgreSQL (its grammar has no JOIN-on-DELETE form); use `.using(table).where(...)` instead.
    /*
    test('delete-with-left-outer-join-removes-issues-with-no-matching-assignee', async () => {
        // Same anti-join as the `leftJoin` test, written with the explicit
        // `leftOuterJoin(...)` alias — pins the `leftOuterJoin(...).on(...)`
        // branch on DELETE, which emits `left outer join` rather than
        // `left join`. Seed: issue 3 is unassigned (`assignee_id` NULL);
        // issues 1, 2, 4 are assigned → exactly 1 row removed.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const tAssignee = tAppUser.forUseInLeftJoin()
            const affected = await ctx.conn.deleteFrom(tIssue)
                .leftOuterJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                .where(tAssignee.id.isNull())
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue left outer join app_user on app_user.id = issue.assignee_id where app_user.id is null"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` on DELETE are typed `never` on PostgreSQL (its grammar has no JOIN-on-DELETE form); use `.using(table).where(...)` instead.
    /*
    test('delete-with-dynamic-on-then-and-builds-join-condition', async () => {
        // `innerJoin(...).dynamicOn()` opens an empty join predicate; the
        // first `.and(...)` becomes the initial `on` condition (the
        // empty-`on` branch — distinct from `.on(...)`, which sets it
        // directly, and from `.on(...).and(...)`, which starts from a
        // populated `on`). Deletes the 'mktg-site' project's issues
        // (1, 2) → 2 rows.
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .innerJoin(tProject).dynamicOn()
                    .and(tProject.id.equals(tIssue.projectId))
                .where(tProject.slug.equals('mktg-site'))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue inner join project on project.id = issue.project_id where project.slug = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "mktg-site",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)
        })
    })
    */


    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` on DELETE are typed `never` on PostgreSQL (its grammar has no JOIN-on-DELETE form); use `.using(table).where(...)` instead.
    /*
    test('delete-allowing-no-where-with-inner-join-removes-all-matched-rows', async () => {
        // `deleteAllowingNoWhereFrom(t).innerJoin(j).on(...)` reaches the
        // OnExpressionAllowingNoWhere interface — executable with NO WHERE. Every
        // issue matches its project, so all seeded issues are removed (dependent
        // worklog/webhook rows cascade).
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteAllowingNoWhereFrom(tIssue)
                .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue inner join project on project.id = issue.project_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(4)
        })
    })
    */

    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` on DELETE are typed `never` on PostgreSQL (its grammar has no JOIN-on-DELETE form); use `.using(table).where(...)` instead.
    /*
    test('delete-allowing-no-where-with-join-removes-all-matched-rows', async () => {
        // `deleteAllowingNoWhereFrom(t).join(j).on(...)` — the `.join` alias limb,
        // also reaching OnExpressionAllowingNoWhere with no WHERE.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteAllowingNoWhereFrom(tIssue)
                .join(tProject).on(tProject.id.equals(tIssue.projectId))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue join project on project.id = issue.project_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(4)
        })
    })
    */

    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` on DELETE are typed `never` on PostgreSQL (its grammar has no JOIN-on-DELETE form); use `.using(table).where(...)` instead.
    /*
    test('delete-allowing-no-where-with-left-join-removes-all-rows', async () => {
        // `deleteAllowingNoWhereFrom(t).leftJoin(j).on(...)` — the LEFT JOIN limb
        // on the allowing-no-where delete, executable with no WHERE. The left join
        // keeps every issue, so all are removed.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const tAssignee = tAppUser.forUseInLeftJoin()
            const affected = await ctx.conn.deleteAllowingNoWhereFrom(tIssue)
                .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue left join app_user on app_user.id = issue.assignee_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(4)
        })
    })
    */

    // NOT-APPLICABLE: `.innerJoin` / `.leftJoin` on DELETE are typed `never` on PostgreSQL (its grammar has no JOIN-on-DELETE form); use `.using(table).where(...)` instead.
    /*
    test('delete-allowing-no-where-with-left-outer-join-removes-all-rows', async () => {
        // `deleteAllowingNoWhereFrom(t).leftOuterJoin(j).on(...)` — the explicit
        // leftOuterJoin alias limb; emits `left outer join` and is executable with
        // no WHERE.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const tAssignee = tAppUser.forUseInLeftJoin()
            const affected = await ctx.conn.deleteAllowingNoWhereFrom(tIssue)
                .leftOuterJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using issue left outer join app_user on app_user.id = issue.assignee_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(4)
        })
    })
    */

    test('delete-allowing-no-where-using-table-then-inner-join-removes-all-rows', async () => {
        // `deleteAllowingNoWhereFrom(t).using(u1).innerJoin(u2).on(...)` — the
        // using-then-join DELETE limb reached through the allowing-no-where entry
        // point, executable with NO WHERE. With no WHERE correlating the target to the
        // USING tables, every project_release row is removed (project_release is a leaf
        // table, so the delete is referential-integrity-safe). The mock pins the
        // emitted no-WHERE SQL; the real DB confirms the statement runs.
        ctx.mockNext(3)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteAllowingNoWhereFrom(tProjectRelease)
                .using(tProject)
                .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from project_release using project inner join organization on organization.id = project.organization_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(3)
        })
    })
})
