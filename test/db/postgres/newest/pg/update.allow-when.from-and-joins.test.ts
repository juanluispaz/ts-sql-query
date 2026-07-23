// `allowWhen` / `disallowWhen` introspection across every limb of an
// `UPDATE … FROM … JOIN …` statement.
//
// The introspection walker mirrors the SQL builder and must descend into EVERY
// part of the statement, reporting the query disallowed when a gate anywhere
// inside is closed: target table → SET values → FROM sources → joined sources →
// each join's `on` → WHERE → RETURNING columns → the three `customizeQuery`
// fragments → the final allowed verdict.
//
// `mutation.allow-when.test.ts` already pins the SET, WHERE, RETURNING and
// `afterQuery` limbs on the single-table forms. This file covers what the
// MULTI-table forms add: the FROM source, the joined source, a join's `on`, a
// join with NO `on`, a statement with NO WHERE, the `beforeQuery` and
// `afterUpdateKeyword` fragments, and the fully-open statement that walks to the
// end and reports allowed.
//
// Two limbs are only observable through a CTE: a plain table or view always
// reports itself allowed, so it can never make the FROM or the joined source
// report not-allowed — only `forUseInQueryAs(...)` delegates to a body that can.
// Those two tests deliberately reference NO column of the CTE anywhere else in
// the statement, so the gated CTE body is the ONLY limb that can report the
// query disallowed. They are introspection-only and never built: rendering the
// WITH clause would throw whether or not the walker visits that limb, so a build
// assertion there would pass either way and prove nothing.
//
// The throws are SYNCHRONOUS — the statement renders before the promise chain is
// entered — hence `try { await … } catch` rather than `.rejects`.
// `isQueryAllowed` is the sanctioned introspection seam; see test/LIMITATIONS.md.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { isQueryAllowed } from '../../../../lib/isAllowed.js'
import { tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('update-from-cte-with-gated-column-reports-disallowed', async () => {
        // The FROM source is a CTE whose body projects a gated column. Nothing
        // else in the statement references the CTE, so the FROM limb is the only
        // one that can see the gate: stop walking it and the query reports
        // allowed.
        const connection = ctx.conn
        const gatedOrgs = connection.selectFrom(tOrganization)
            .select({ id: tOrganization.id.allowWhen(false, 'update-from-cte gate blocks') })
            .forUseInQueryAs('gated_orgs')

        const query = connection.update(tProject)
            .from(gatedOrgs)
            .set({ name: 'Marketing site' })
            .where(tProject.id.equals(1))

        expect(isQueryAllowed(query)).toBe(false)
    })

    test('update-join-cte-with-gated-column-reports-disallowed', async () => {
        // The same trick one limb further in: the JOINED source rather than the
        // FROM source. `dynamicOn()` with no condition leaves the join's `on`
        // empty and no column of the CTE is referenced anywhere else, so the
        // joined-source limb is the only path to the gate.
        const connection = ctx.conn
        const gatedUsers = connection.selectFrom(tAppUser)
            .select({ id: tAppUser.id.allowWhen(false, 'update-join-cte gate blocks') })
            .forUseInQueryAs('gated_users')

        const query = connection.update(tProject)
            .from(tIssue)
            .innerJoin(gatedUsers).dynamicOn()
            .set({ name: tIssue.title })
            .where(tProject.id.equals(tIssue.projectId))

        expect(isQueryAllowed(query)).toBe(false)
    })

    test('update-from-join-on-gated-condition-throws', async () => {
        // The join's `on` expression is itself a value source, so a closed gate
        // on it must both report disallowed and refuse to render — before any
        // UPDATE reaches the database.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId).allowWhen(false, 'update-join-on gate blocks'))
                .set({ name: tAppUser.fullName })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(1))

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeUpdate()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('update-join-on gate blocks')
    })

    test('update-from-join-without-on-gated-before-query-fragment-throws', async () => {
        // A join opened with `dynamicOn()` and never given a condition leaves the
        // `on` slot empty: the walk must SKIP it and carry on. The only closed
        // gate sits further along, in the `beforeQuery` fragment. Were the empty
        // slot read unconditionally the walk would fail on it instead of
        // reporting a verdict.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).dynamicOn()
                .set({ name: tAppUser.fullName })
                .where(tProject.id.equals(tIssue.projectId))
                    .and(tIssue.id.equals(1))
                .customizeQuery({
                    beforeQuery: connection.rawFragment`/* gated ${tIssue.id.allowWhen(false, 'update-before-query gate blocks')} */ `,
                })

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeUpdate()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('update-before-query gate blocks')
    })

    test('update-allowing-no-where-from-join-gated-after-update-keyword-fragment-throws', async () => {
        // `updateAllowingNoWhere` produces a statement with NO WHERE at all, so
        // the walk must skip that slot too and carry on to the customization
        // fragments — where the only closed gate lives, in the
        // `afterUpdateKeyword` slot.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.updateAllowingNoWhere(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
                .set({ name: tAppUser.fullName })
                .customizeQuery({
                    afterUpdateKeyword: connection.rawFragment`/* gated ${tIssue.id.allowWhen(false, 'update-after-keyword gate blocks')} */`,
                })

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeUpdate()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('update-after-keyword gate blocks')
    })

    test('update-from-join-all-gates-open-walks-to-end-and-runs', async () => {
        // Every limb carries an OPEN gate: the SET value, the join's `on`, the
        // WHERE and all three customization fragments. The walk has to traverse
        // all of them and fall through to the allowed verdict — the branches only
        // reachable when each limb reports allowed. Open gates are transparent,
        // so the statement builds and runs: issue 1 belongs to project 1, so
        // exactly one row is updated.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const query = connection.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId).allowWhen(true, 'update-join-on gate'))
                .set({ name: tAppUser.fullName.allowWhen(true, 'update-set gate') })
                .where(tProject.id.equals(tIssue.projectId).allowWhen(true, 'update-where gate'))
                    .and(tIssue.id.equals(1))
                .customizeQuery({
                    beforeQuery: connection.rawFragment`/* gated ${tIssue.id.allowWhen(true, 'update-before-query gate')} */ `,
                    afterUpdateKeyword: connection.rawFragment`/* gated ${tIssue.projectId.allowWhen(true, 'update-after-keyword gate')} */`,
                    afterQuery: connection.rawFragment` /* gated ${tProject.slug.allowWhen(true, 'update-after-query gate')} */`,
                })

            expect(isQueryAllowed(query)).toBe(true)

            const affected = await query.executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* gated issue.id */  update /* gated issue.project_id */ project set name = app_user.full_name from issue inner join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = $1  /* gated project.slug */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })


    test('update-from-join-all-gates-open-with-allowed-returning-walks-to-end', async () => {
        // The same all-open FROM+JOIN as the sibling above, plus an OPEN-gated
        // RETURNING column. That is the one limb the sibling omits: with no
        // RETURNING the projection is absent and the walk skips its check
        // entirely, so the "projection present AND allowed, keep walking" path has
        // never run. It catches a regression that wrongly rejects an allowed
        // RETURNING projection — which would make the introspection API refuse
        // every legitimate RETURNING-bearing mutation.
        const expected = { id: 1, name: 'Ada Lovelace' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const query = connection.update(tProject)
                .from(tIssue)
                .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId).allowWhen(true, 'update-join-on gate'))
                .set({ name: tAppUser.fullName.allowWhen(true, 'update-set gate') })
                .where(tProject.id.equals(tIssue.projectId).allowWhen(true, 'update-where gate'))
                    .and(tIssue.id.equals(1))
                .returning({
                    id: tProject.id,
                    name: tProject.name.allowWhen(true, 'update-returning gate'),
                })

            expect(isQueryAllowed(query)).toBe(true)

            const row = await query.executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = app_user.full_name from issue inner join app_user on app_user.id = issue.assignee_id where project.id = issue.project_id and issue.id = $1 returning project.id as id, project.name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number, name: string }>>()
            expect(row).toEqual(expected)
        })
    })
})
