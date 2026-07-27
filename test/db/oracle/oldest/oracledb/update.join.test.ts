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

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// Every test in this cell is commented out (see the blocks below); these
// sentinels satisfy noUnusedLocals while the imports stay for cross-cell symmetry.
void expect; void test; void assertType; void tAppUser; void tIssue; void tProject
export type { Exact }

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-from-table-then-inner-join-on-from-tables', async () => {
        // `update(t).from(j1).innerJoin(j2).on(...)` — a JOIN after `.from()`. The
        // join links the two FROM tables to each other (app_user ↔ issue) while the
        // target `project` is joined in the WHERE: UPDATE … FROM forbids the join's ON
        // referencing the update target, so keep the target out of the ON. Update
        // project 1's name to its issue-1 assignee's name: issue 1 → project 1,
        // assignee 1 → 1 row.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
                .set({ name: tAppUser.fullName })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = app_user.full_name from issue inner join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-from-table-then-inner-join-returning-nested', async () => {
        // `.returning({ id, meta: {...} })` composed onto the from-then-join
        // multi-table UPDATE — the `.returning(...)` projection coexists with the
        // FROM/JOIN in one statement, and the returned columns fold into a nested
        // `meta` sub-object. Update project 1's name to its issue-1 assignee's name
        // (Ada Lovelace) and read back the single touched row; the returned row
        // reflects the post-UPDATE `name`.
        const expected = { id: 1, meta: { name: 'Ada Lovelace', slug: 'mktg-site' } }
        // Mock is primed with the FLAT db row (dotted alias keys); the projector
        // folds it into the nested shape asserted below.
        ctx.mockNext({ id: 1, 'meta.name': 'Ada Lovelace', 'meta.slug': 'mktg-site' })
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
                .set({ name: tAppUser.fullName })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(1))
                .returning({
                    id:   tProject.id,
                    meta: { name: tProject.name, slug: tProject.slug },
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = app_user.full_name from issue inner join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = :0 returning project.id, project.name, project.slug into :1, :2, :3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "meta.name",
                  "dir": 3003,
                },
                {
                  "as": "meta.slug",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, {
                id:   number
                meta: { name: string; slug: string }
            }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-from-table-then-left-join-on-from-tables', async () => {
        // `update(t).from(j1).leftJoin(j2).on(...)` — the LEFT-join twin of the
        // inner-join-after-from test above. leftJoin keeps every issue even when
        // no assignee matches, so the joined `app_user.full_name` is nullable; the
        // `.set(...)` coalesces it to a fallback. Issue 3 is unassigned
        // (assignee_id NULL) → its project (project 2) gets name 'Unassigned'.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const tAssignee = tAppUser.forUseInLeftJoin()
            const affected = await ctx.conn.update(tProject)
                .from(tIssue)
                .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                .set({ name: tAssignee.fullName.valueWhenNull('Unassigned') })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(3))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = nvl(app_user.full_name, :0) from issue left join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Unassigned",
                3,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-from-table-then-left-outer-join-on-from-tables', async () => {
        // `update(t).from(j1).leftOuterJoin(j2).on(...)` — a LEFT OUTER JOIN after
        // the UPDATE … FROM limb, emitting the explicit `left outer join` keyword.
        // The join keeps every issue even when no assignee matches, so the joined
        // name is nullable and `.set(...)` coalesces it to a fallback. Issue 3 is
        // unassigned (assignee_id NULL) → its project (project 2) gets 'Unassigned'.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const tAssignee = tAppUser.forUseInLeftJoin()
            const affected = await ctx.conn.update(tProject)
                .from(tIssue)
                .leftOuterJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                .set({ name: tAssignee.fullName.valueWhenNull('Unassigned') })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(3))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = nvl(app_user.full_name, :0) from issue left outer join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Unassigned",
                3,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-from-table-then-left-join-returning-nullable-joined-column', async () => {
        // The `.returning({...})` projects the LEFT-joined `app_user.full_name`
        // column directly — because the join is a LEFT join, the column is
        // originally-nullable, so the projected leaf is OPTIONAL (`assignee?:
        // string`) and a NULL reads back as an ABSENT key. This is the real type
        // distinction vs the inner-join return, where the same column is required.
        // Update project 2 (owns issue 3, whose assignee_id is NULL); the joined
        // assignee is absent in the returned row.
        const expected = { id: 2 }
        ctx.mockNext({ id: 2, assignee: null })
        await ctx.withRollback(async () => {
            const tAssignee = tAppUser.forUseInLeftJoin()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                .set({ name: tIssue.title })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(3))
                .returning({
                    id:       tProject.id,
                    assignee: tAssignee.fullName,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = issue.title from issue left join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = :0 returning project.id, app_user.full_name into :1, :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                3,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "assignee",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, {
                id:        number
                assignee?: string
            }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-from-table-then-left-join-returning-left-join-optional-column-as-nullable-surfaces-present-null', async () => {
        // The same from-then-left-join UPDATE returning the LEFT-joined
        // `app_user.full_name`, but read back under
        // `.projectingOptionalValuesAsNullable()`. That marker retypes the
        // outer-join-optional leaf as `assignee: string | null`
        // (present-nullable) instead of the optional `assignee?: string`.
        // Issue 3 is unassigned (assignee_id NULL), so the left join misses;
        // the projected column then surfaces as a PRESENT `null` key rather
        // than an absent one. Update project 2 (owns issue 3).
        const expected = { id: 2, assignee: null }
        ctx.mockNext({ id: 2, assignee: null })
        await ctx.withRollback(async () => {
            const tAssignee = tAppUser.forUseInLeftJoin()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                .set({ name: tIssue.title })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(3))
                .returning({
                    id:       tProject.id,
                    assignee: tAssignee.fullName,
                })
                .projectingOptionalValuesAsNullable()
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = issue.title from issue left join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = :0 returning project.id, app_user.full_name into :1, :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                3,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "assignee",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, {
                id:       number
                assignee: string | null
            }>>()
            expect('assignee' in row).toBe(true)
            expect(row.assignee).toBe(null)
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-from-table-then-inner-join-on-and-compound-join-condition', async () => {
        // `.on(c).and(c2)` on the from-then-join limb — the `.and()` chained after
        // `.on()` accumulates into the JOIN predicate (`__lastJoin.__on`), NOT the
        // outer WHERE. This dispatch differs from `.where().and()`. Restrict the
        // join to the assignee named 'Ada Lovelace'; issue 1's assignee is Ada, so
        // project 1's name still updates → 1 row.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
                    .and(tAppUser.fullName.equals('Ada Lovelace'))
                .set({ name: tAppUser.fullName })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = app_user.full_name from issue inner join app_user on app_user.id = issue.assignee_id and app_user.full_name = :0 where project.id = issue.project_id and issue.id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Ada Lovelace",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-from-table-then-inner-join-dynamic-on-and', async () => {
        // `innerJoin(...).dynamicOn()` opens an empty join predicate on the
        // from-then-join limb; the first `.and(...)` becomes the initial `on`
        // condition (the empty-`on` branch, distinct from `.on(...)`). Update
        // project 1's name to its issue-1 assignee's name → 1 row.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).dynamicOn()
                    .and(tAppUser.id.equals(tIssue.assigneeId))
                .set({ name: tAppUser.fullName })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = app_user.full_name from issue inner join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-from-table-then-inner-join-dynamic-on-or', async () => {
        // `innerJoin(...).dynamicOn()` followed by `.or(...)` accumulates a
        // compound OR join predicate on the from-then-join limb (the `or(...)`
        // branch landing on `__lastJoin.__on`). The predicate matches when the
        // user is the issue's assignee OR is named 'never-matches'; issue 1 →
        // Ada, so project 1 updates → 1 row.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).dynamicOn()
                    .or(tAppUser.id.equals(tIssue.assigneeId))
                    .or(tAppUser.fullName.equals('never-matches'))
                .set({ name: tAppUser.fullName })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = app_user.full_name from issue inner join app_user on app_user.id = issue.assignee_id or app_user.full_name = :0 where project.id = issue.project_id and issue.id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "never-matches",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })
    */


    // NOT-APPLICABLE: Oracle has no DELETE/UPDATE … JOIN grammar (use WHERE id IN (SELECT …) / UPDATE … FROM)
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

    // NOT-APPLICABLE: Oracle has no DELETE/UPDATE … JOIN grammar (use WHERE id IN (SELECT …) / UPDATE … FROM)
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

    // NOT-APPLICABLE: Oracle has no DELETE/UPDATE … JOIN grammar (use WHERE id IN (SELECT …) / UPDATE … FROM)
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
    // NOT-APPLICABLE: Oracle has no DELETE/UPDATE … JOIN grammar (use WHERE id IN (SELECT …) / UPDATE … FROM)
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

    // NOT-APPLICABLE: Oracle has no DELETE/UPDATE … JOIN grammar (use WHERE id IN (SELECT …) / UPDATE … FROM)
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

    // NOT-APPLICABLE: Oracle has no DELETE/UPDATE … JOIN grammar (use WHERE id IN (SELECT …) / UPDATE … FROM)
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

    // NOT-APPLICABLE: Oracle has no DELETE/UPDATE … JOIN grammar (use WHERE id IN (SELECT …) / UPDATE … FROM)
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


    // NOT-APPLICABLE: Oracle has no DELETE/UPDATE … JOIN grammar (use WHERE id IN (SELECT …) / UPDATE … FROM)
    /*
    test('update-allowing-no-where-with-inner-join-touches-all-matched-rows', async () => {
        // `updateAllowingNoWhere(t).innerJoin(j).on(...)` reaches the
        // OnExpressionAllowingNoWhere interface — executable with NO WHERE. The
        // inner join matches every issue to its project, so every seeded issue is
        // bumped.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.updateAllowingNoWhere(tIssue)
                .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
                .set({ priority: tIssue.priority.add(1) })
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue inner join project on project.id = issue.project_id set issue.priority = issue.priority + ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(4)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no DELETE/UPDATE … JOIN grammar (use WHERE id IN (SELECT …) / UPDATE … FROM)
    /*
    test('update-allowing-no-where-with-join-touches-all-matched-rows', async () => {
        // `updateAllowingNoWhere(t).join(j).on(...)` — the `.join` alias of
        // innerJoin, also reaching OnExpressionAllowingNoWhere with no WHERE.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.updateAllowingNoWhere(tIssue)
                .join(tProject).on(tProject.id.equals(tIssue.projectId))
                .set({ priority: tIssue.priority.add(1) })
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue join project on project.id = issue.project_id set issue.priority = issue.priority + ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(4)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no DELETE/UPDATE … JOIN grammar (use WHERE id IN (SELECT …) / UPDATE … FROM)
    /*
    test('update-allowing-no-where-with-left-join-touches-all-rows', async () => {
        // `updateAllowingNoWhere(t).leftJoin(j).on(...)` — the LEFT JOIN limb on
        // the allowing-no-where update, executable with no WHERE. The left join
        // keeps every issue whether or not it has an assignee, so all rows update.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const tAssignee = tAppUser.forUseInLeftJoin()
            const affected = await ctx.conn.updateAllowingNoWhere(tIssue)
                .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                .set({ priority: tIssue.priority.add(1) })
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue left join app_user on app_user.id = issue.assignee_id set issue.priority = issue.priority + ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(4)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no DELETE/UPDATE … JOIN grammar (use WHERE id IN (SELECT …) / UPDATE … FROM)
    /*
    test('update-allowing-no-where-with-left-outer-join-touches-all-rows', async () => {
        // `updateAllowingNoWhere(t).leftOuterJoin(j).on(...)` — the explicit
        // leftOuterJoin alias limb; emits `left outer join` and is executable with
        // no WHERE.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const tAssignee = tAppUser.forUseInLeftJoin()
            const affected = await ctx.conn.updateAllowingNoWhere(tIssue)
                .leftOuterJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                .set({ priority: tIssue.priority.add(1) })
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue left outer join app_user on app_user.id = issue.assignee_id set issue.priority = issue.priority + ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(4)
        })
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-allowing-no-where-from-table-then-inner-join-touches-all-rows', async () => {
        // `updateAllowingNoWhere(t).from(j1).innerJoin(j2).on(...)` — the from-then-join
        // UPDATE limb reached through the allowing-no-where entry point, executable
        // with NO WHERE (the target carries no WHERE; the `issue.id = 1` predicate rides
        // on the JOIN's ON, resolving the FROM side to a single row so every project is
        // touched exactly once). The mock pins the emitted no-WHERE SQL; the real DB
        // confirms the statement runs and returns a count.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId)).and(tIssue.id.equals(1))
                .set({ name: tAppUser.fullName })
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = app_user.full_name from issue inner join app_user on app_user.id = issue.assignee_id and issue.id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(4)
        })
    })
    */


    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-from-table-then-join-on-from-tables', async () => {
        // The bare `.join` alias (not `.innerJoin`) after `.from()` — emits the plain
        // ` join ` keyword instead of ` inner join `, otherwise identical to
        // update-from-table-then-inner-join-on-from-tables. Update project 1's name to
        // its issue-1 assignee's name → 1 row.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .from(tIssue)
                .join(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
                .set({ name: tAppUser.fullName })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = app_user.full_name from issue join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-from-left-join-returning-rule2-object-miss-drops-default', async () => {
        // `update(t).from(j).leftJoin(a).on(...)` RETURNING a RULE-2 nested `obj` whose
        // leaves MIX an originally-required LEFT-JOINED leaf (`x` = app_user.full_name)
        // with a no-table CONST leaf (`k` = const(1)). On a join MISS the whole `obj`
        // DROPS (rule-2) even though the const leaf carries a value. Update project 2
        // (owns issue 3, whose assignee_id is NULL → left-join miss), so `obj` is absent
        // under the default projector.
        const expected = { pid: 2 }
        // Mock primed with the FLAT db row (joined leaf null, const present); the
        // projector drops `obj` because its originally-required left-join leaf is null.
        ctx.mockNext({ pid: 2, 'obj.x': null, 'obj.k': 1 })
        await ctx.withRollback(async () => {
            const tAssignee = tAppUser.forUseInLeftJoin()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                .set({ name: tIssue.title })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(3))
                .returning({
                    pid: tProject.id,
                    obj: { x: tAssignee.fullName, k: ctx.conn.const(1, 'int') },
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = issue.title from issue left join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = :0 returning project.id, app_user.full_name, :1 into :2, :3, :4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                3,
                1,
                {
                  "as": "pid",
                  "dir": 3003,
                },
                {
                  "as": "obj.x",
                  "dir": 3003,
                },
                {
                  "as": "obj.k",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, { pid: number; obj?: { x: string; k: number } }>>()
            expect(row).toEqual(expected)
            expect('obj' in row).toBe(false)
        })
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('update-from-left-join-returning-rule2-object-miss-drops-as-nullable', async () => {
        // The same rule-2 mixed object under `projectingOptionalValuesAsNullable()`:
        // the whole `obj` becomes `{...} | null` and the join miss surfaces it as
        // `obj: null` (not `{ x: null, k: 1 }`). Issue 3's null assignee → `obj` is
        // present-null.
        const expected = { pid: 2, obj: null }
        ctx.mockNext({ pid: 2, 'obj.x': null, 'obj.k': 1 })
        await ctx.withRollback(async () => {
            const tAssignee = tAppUser.forUseInLeftJoin()
            const row = await ctx.conn.update(tProject)
                .from(tIssue)
                .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                .set({ name: tIssue.title })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(3))
                .returning({
                    pid: tProject.id,
                    obj: { x: tAssignee.fullName, k: ctx.conn.const(1, 'int') },
                })
                .projectingOptionalValuesAsNullable()
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = issue.title from issue left join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = :0 returning project.id, app_user.full_name, :1 into :2, :3, :4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                3,
                1,
                {
                  "as": "pid",
                  "dir": 3003,
                },
                {
                  "as": "obj.x",
                  "dir": 3003,
                },
                {
                  "as": "obj.k",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, { pid: number; obj: { x: string; k: number } | null }>>()
            expect(row).toEqual(expected)
            expect('obj' in row).toBe(true)
            expect(row.obj).toBe(null)
        })
    })
    */


    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    /*
    test('update-from-table-then-two-inner-joins-on-from-tables', async () => {
        // Two joins after `.from(...)`: the SECOND `.on(...)` finds `__joins` already
        // populated by the first join's `on` and takes its FALSE arm — the branch a
        // single-join `UPDATE … FROM` never reaches. Both joins must appear in the
        // emitted SQL. app_user links to issue's assignee; project_review links to
        // issue's project. Update project 1 to its issue-1 assignee's name (issue 1 →
        // project 1, assignee 1, and project 1 has a review row → 1 row updated).
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
                .innerJoin(tProjectReview).on(tProjectReview.projectId.equals(tIssue.projectId))
                .set({ name: tAppUser.fullName })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })
    */
})
