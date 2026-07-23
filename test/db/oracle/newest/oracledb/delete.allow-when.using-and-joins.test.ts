// `allowWhen` / `disallowWhen` introspection across every limb of a
// `DELETE … USING … JOIN …` statement — the mirror twin of
// `update.allow-when.from-and-joins.test.ts`.
//
// The introspection walker mirrors the SQL builder and must descend into EVERY
// part of the statement, reporting the query disallowed when a gate anywhere
// inside is closed: target table → USING sources → joined sources → each join's
// `on` → WHERE → RETURNING columns → the three `customizeQuery` fragments → the
// final allowed verdict. Apart from the update-only SET-values loop and the
// keyword slot's name, the two walks are limb-for-limb twins.
//
// `mutation.allow-when.test.ts` already pins the WHERE, RETURNING and
// `afterQuery` limbs on the single-table forms. This file covers what the
// MULTI-table forms add: the USING source, the joined source, a join's `on`, a
// join with NO `on`, a statement with NO WHERE, the `beforeQuery` and
// `afterDeleteKeyword` fragments, and the fully-open statement that walks to the
// end and reports allowed.
//
// Two limbs are only observable through a CTE: a plain table or view always
// reports itself allowed, so only `forUseInQueryAs(...)` can make the USING or
// the joined source report not-allowed. Those two tests reference NO column of
// the CTE anywhere else, so the gated CTE body is the only limb that can report
// the query disallowed. They are introspection-only and never built.
//
// The throws are SYNCHRONOUS — the statement renders before the promise chain is
// entered — hence `try { await … } catch` rather than `.rejects`.
// `isQueryAllowed` is the sanctioned introspection seam; see test/LIMITATIONS.md.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { isQueryAllowed } from '../../../../lib/isAllowed.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('delete-using-cte-with-gated-column-reports-disallowed', async () => {
        // The USING source is a CTE whose body projects a gated column. Nothing
        // else in the statement references the CTE, so the USING limb is the only
        // one that can see the gate.
        const connection = ctx.conn
        const gatedProjects = connection.selectFrom(tProject)
            .select({ id: tProject.id.allowWhen(false, 'delete-using-cte gate blocks') })
            .forUseInQueryAs('gated_projects')

        const query = connection.deleteFrom(tIssue)
            .using(gatedProjects)
            .where(tIssue.id.equals(99999))

        expect(isQueryAllowed(query)).toBe(false)
    })

    test('delete-join-cte-with-gated-column-reports-disallowed', async () => {
        // The same trick one limb further in: the JOINED source rather than the
        // USING source, with `dynamicOn()` leaving the join's `on` empty.
        const connection = ctx.conn
        const gatedOrgs = connection.selectFrom(tOrganization)
            .select({ id: tOrganization.id.allowWhen(false, 'delete-join-cte gate blocks') })
            .forUseInQueryAs('gated_orgs')

        const query = connection.deleteFrom(tIssue)
            .using(tProject)
            .innerJoin(gatedOrgs).dynamicOn()
            .where(tIssue.projectId.equals(tProject.id))

        expect(isQueryAllowed(query)).toBe(false)
    })

    test('delete-using-join-on-gated-condition-throws', async () => {
        // The join's `on` expression is itself a value source, so a closed gate
        // on it must both report disallowed and refuse to render — before any
        // DELETE reaches the database.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.deleteFrom(tIssue)
                .using(tProject)
                .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId).allowWhen(false, 'delete-join-on gate blocks'))
                .where(tIssue.projectId.equals(tProject.id))
                    .and(tIssue.id.equals(99999))

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeDelete()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('delete-join-on gate blocks')
    })

    test('delete-using-join-without-on-gated-before-query-fragment-throws', async () => {
        // A join opened with `dynamicOn()` and never given a condition leaves the
        // `on` slot empty: the walk must SKIP it and carry on to the `beforeQuery`
        // fragment, where the only closed gate lives.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.deleteFrom(tIssue)
                .using(tProject)
                .innerJoin(tOrganization).dynamicOn()
                .where(tIssue.projectId.equals(tProject.id))
                    .and(tIssue.id.equals(99999))
                .customizeQuery({
                    beforeQuery: connection.rawFragment`/* gated ${tIssue.id.allowWhen(false, 'delete-before-query gate blocks')} */ `,
                })

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeDelete()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('delete-before-query gate blocks')
    })

    test('delete-allowing-no-where-using-join-gated-after-delete-keyword-fragment-throws', async () => {
        // `deleteAllowingNoWhereFrom` produces a statement with NO WHERE at all,
        // so the walk must skip that slot too and carry on to the customization
        // fragments — where the only closed gate lives, in the
        // `afterDeleteKeyword` slot. The statement never reaches the database, so
        // no seed row is at risk.
        const connection = ctx.conn
        let thrown: unknown
        await ctx.withRollback(async () => {
            const query = connection.deleteAllowingNoWhereFrom(tIssue)
                .using(tProject)
                .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
                .customizeQuery({
                    afterDeleteKeyword: connection.rawFragment`/* gated ${tIssue.id.allowWhen(false, 'delete-after-keyword gate blocks')} */`,
                })

            expect(isQueryAllowed(query)).toBe(false)

            try {
                await query.executeDelete()
            } catch (e) {
                thrown = e
            }
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('delete-after-keyword gate blocks')
    })

    test('delete-using-join-all-gates-open-walks-to-end-and-runs', async () => {
        // Every limb carries an OPEN gate: the join's `on`, the WHERE and all
        // three customization fragments. The walk has to traverse all of them and
        // fall through to the allowed verdict. Open gates are transparent, so the
        // statement builds and runs; the WHERE filters by an id no seed row
        // carries, so nothing is removed and the affected count is 0.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const query = connection.deleteFrom(tIssue)
                .using(tProject)
                .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId).allowWhen(true, 'delete-join-on gate'))
                .where(tIssue.projectId.equals(tProject.id).allowWhen(true, 'delete-where gate'))
                    .and(tIssue.id.equals(99999))
                .customizeQuery({
                    beforeQuery: connection.rawFragment`/* gated ${tIssue.id.allowWhen(true, 'delete-before-query gate')} */ `,
                    afterDeleteKeyword: connection.rawFragment`/* gated ${tIssue.projectId.allowWhen(true, 'delete-after-keyword gate')} */`,
                    afterQuery: connection.rawFragment` /* gated ${tProject.slug.allowWhen(true, 'delete-after-query gate')} */`,
                })

            expect(isQueryAllowed(query)).toBe(true)

            const affected = await query.executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"/* gated issue.id */  delete /* gated issue.project_id */ from issue using project inner join "organization" on "organization".id = project.organization_id where issue.project_id = project.id and issue.id = :0  /* gated project.slug */"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(0)
        })
    })

    test('delete-using-join-all-gates-open-with-allowed-returning-walks-to-end', async () => {
        // The RETURNING twin of the sibling above: the one limb it omits. With no
        // RETURNING the projection is absent and the walk skips its check, so the
        // "projection present AND allowed, keep walking" path has never run. The
        // WHERE filters by an id no seed row carries, so nothing is removed and
        // the RETURNING yields no row.
        ctx.mockNext(undefined)
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            const query = connection.deleteFrom(tIssue)
                .using(tProject)
                .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId).allowWhen(true, 'delete-join-on gate'))
                .where(tIssue.projectId.equals(tProject.id).allowWhen(true, 'delete-where gate'))
                    .and(tIssue.id.equals(99999))
                .returning({
                    id: tIssue.id.allowWhen(true, 'delete-returning gate'),
                })

            expect(isQueryAllowed(query)).toBe(true)

            const row = await query.executeDeleteNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using project inner join "organization" on "organization".id = project.organization_id where issue.project_id = project.id and issue.id = :0 returning issue.id into :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
                {
                  "as": "id",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, { id: number } | null>>()
            expect(row).toBeNull()
        })
    })
})
