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
import { tAppUser, tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

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
})
