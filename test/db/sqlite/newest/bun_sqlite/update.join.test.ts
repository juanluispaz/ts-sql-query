// `UPDATE … INNER JOIN j ON … WHERE …` — multi-table UPDATE where the
// JOIN method (not just `.from(...)`) is used. The `.innerJoin` /
// `.leftJoin` methods on `UpdateExpression` are typed `never` on the
// dialects whose grammar has no JOIN-on-UPDATE form, so this file runs
// only where they are part of the typed surface and is commented out
// elsewhere with a NOT-APPLICABLE marker. Where it runs, the library
// emits the dialect's multi-table UPDATE form; the emitted SQL is
// pinned by the snapshot below.
//
// Pins the UpdateQueryBuilder `innerJoin` / `leftJoin` / `leftOuterJoin` /
// `dynamicOn` / `on` / `and`-on-join branches that aren't reached by the
// plain `.from(table)` form. The `.and()` after `.on()` exercises a
// different code path than `.where().and()` because it lands on
// `__lastJoin.__on` instead of `__where`.
//
// Mock-mode pins the SQL; real-DB mode wraps each update in
// `ctx.withRollback` so the seed survives.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: SQLite has no `UPDATE … JOIN` syntax. `.innerJoin` / `.leftJoin` / `.leftOuterJoin` on UPDATE are typed `never` on this dialect; the equivalent pattern is `.update(t).from(j).set(...).where(...)`.
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

    // NOT-APPLICABLE: SQLite has no `UPDATE … JOIN` syntax. `.innerJoin` / `.leftJoin` / `.leftOuterJoin` on UPDATE are typed `never` on this dialect; the equivalent pattern is `.update(t).from(j).set(...).where(...)`.
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

    // NOT-APPLICABLE: SQLite has no `UPDATE … JOIN` syntax. `.innerJoin` / `.leftJoin` / `.leftOuterJoin` on UPDATE are typed `never` on this dialect; the equivalent pattern is `.update(t).from(j).set(...).where(...)`.
    /*
    test('update-with-multi-condition-on-clause-via-and', async () => {
        // The `on(...)` chain followed by `.and(...)` accumulates into
        // a compound JOIN predicate (NOT into the outer WHERE). Pins
        // the `.and()` branch on `UpdateQueryBuilder`
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
    // NOT-APPLICABLE: SQLite has no `UPDATE … JOIN` syntax. `.innerJoin` / `.leftJoin` / `.leftOuterJoin` on UPDATE are typed `never` on this dialect; the equivalent pattern is `.update(t).from(j).set(...).where(...)`.
    /*
    test('update-with-left-join-targets-rows-with-no-match', async () => {
        // Anti-join update: LEFT JOIN the assignee onto each issue and
        // bump the priority of the rows where no user matched
        // (`assignee_id` is NULL). Pins the `leftJoin(...).on(...)` setter
        // branch on UPDATE, which the `innerJoin` tests above don't reach.
        // Seed: issue 3 has `assignee_id = NULL` (unassigned); issues 1,
        // 2, 4 are assigned → exactly 1 row updated on real DB.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const tAssignee = tAppUser.forUseInLeftJoin()
            const affected = await ctx.conn.update(tIssue)
                .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                .set({ priority: 9 })
                .where(tAssignee.id.isNull())
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue left join app_user on app_user.id = issue.assignee_id set issue.priority = ? where app_user.id is null"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: SQLite has no `UPDATE … JOIN` syntax. `.innerJoin` / `.leftJoin` / `.leftOuterJoin` on UPDATE are typed `never` on this dialect; the equivalent pattern is `.update(t).from(j).set(...).where(...)`.
    /*
    test('update-with-dynamic-on-builds-compound-join-condition-via-or', async () => {{
        // `innerJoin(...).dynamicOn()` opens an empty join predicate that
        // the following `.or(...)` calls accumulate into the JOIN's `on`
        // clause (not the outer WHERE). Pins the `dynamicOn()` branch plus
        // the `or(...)`-on-`__lastJoin` branch on UPDATE. The compound
        // predicate matches a project when EITHER its id pairs with the
        // issue OR its slug is 'never-matches'; combined with the WHERE it
        // updates issues of the 'mktg-site' project (issues 1, 2) → 2 rows.
        ctx.mockNext(2)

        await ctx.withRollback(async () => {{
            const affected = await ctx.conn.update(tIssue)
                .innerJoin(tProject).dynamicOn()
                    .or(tProject.id.equals(tIssue.projectId))
                    .or(tProject.slug.equals('never-matches'))
                .set({{ priority: 5 }})
                .where(tProject.slug.equals('mktg-site'))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue inner join project on project.id = issue.project_id or project.slug = ? set issue.priority = ? where project.slug = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "never-matches",
                5,
                "mktg-site",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)
        }})
    }})
    */

    // NOT-APPLICABLE: SQLite has no `UPDATE … JOIN` syntax. `.innerJoin` / `.leftJoin` / `.leftOuterJoin` on UPDATE are typed `never` on this dialect; the equivalent pattern is `.update(t).from(j).set(...).where(...)`.
    /*
    test('update-with-left-outer-join-targets-rows-with-no-match', async () => {
        // Same anti-join as the `leftJoin` test, written with the explicit
        // `leftOuterJoin(...)` alias — pins the `leftOuterJoin(...).on(...)`
        // setter branch on UPDATE, which emits `left outer join` rather than
        // `left join`. Seed: issue 3 is unassigned (`assignee_id` NULL);
        // issues 1, 2, 4 are assigned → exactly 1 row updated.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const tAssignee = tAppUser.forUseInLeftJoin()
            const affected = await ctx.conn.update(tIssue)
                .leftOuterJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                .set({ priority: 9 })
                .where(tAssignee.id.isNull())
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue left outer join app_user on app_user.id = issue.assignee_id set issue.priority = ? where app_user.id is null"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: SQLite has no `UPDATE … JOIN` syntax. `.innerJoin` / `.leftJoin` / `.leftOuterJoin` on UPDATE are typed `never` on this dialect; the equivalent pattern is `.update(t).from(j).set(...).where(...)`.
    /*
    test('update-with-dynamic-on-then-and-builds-join-condition', async () => {
        // `innerJoin(...).dynamicOn()` opens an empty join predicate; the
        // first `.and(...)` becomes the initial `on` condition (the
        // empty-`on` branch — distinct from `.on(...)`, which sets it
        // directly, and from `.on(...).and(...)`, which starts from a
        // populated `on`). Updates the 'mktg-site' project's issues
        // (1, 2) → 2 rows.
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .innerJoin(tProject).dynamicOn()
                    .and(tProject.id.equals(tIssue.projectId))
                .set({ priority: 5 })
                .where(tProject.slug.equals('mktg-site'))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue inner join project on project.id = issue.project_id set issue.priority = ? where project.slug = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                5,
                "mktg-site",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)
        })
    })
    */

})
