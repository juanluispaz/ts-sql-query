// Coverage of a class-based SQL `View` — the
// `project_overview` view mapped in domain/connection.ts over the
// `project_overview` DDL view in domain/schema.sql. Exercises the View
// mapping surface that was previously untouched by the suite:
//   - `column` / `optionalColumn` — real view columns.
//   - `virtualColumnFromFragment` — the `nameUpper` computed column
//     expanded inline as `upper(...)`.
//   - `as(...)` / `forUseInLeftJoin()` / `forUseInLeftJoinAs(...)` —
//     aliasing and left-join participation of the view.
// See docs/configuration/mapping.md (#mapping-the-views, #virtual-columns).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, vProjectOverview } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('select-from-view-projects-of-org', async () => {
        // Plain projection of real view columns, filtered + ordered.
        const expected = [
            { id: 1, name: 'Marketing site', organizationName: 'Acme Corp', organizationPlan: 'pro' },
            { id: 2, name: 'Internal tools', organizationName: 'Acme Corp', organizationPlan: 'pro' },
        ]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectFrom(vProjectOverview)
            .where(vProjectOverview.organizationId.equals(1))
            .select({
                id:               vProjectOverview.id,
                name:             vProjectOverview.name,
                organizationName: vProjectOverview.organizationName,
                organizationPlan: vProjectOverview.organizationPlan,
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, organization_name as "organizationName", organization_plan as "organizationPlan" from project_overview where organization_id = $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id: number
            name: string
            organizationName: string
            organizationPlan: string
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('select-view-virtual-column-name-upper', async () => {
        // `nameUpper` is a virtualColumnFromFragment — it does not exist
        // in the DDL view, it expands inline as `upper(...name)`.
        const expected = { id: 1, name: 'Marketing site', nameUpper: 'MARKETING SITE' }
        ctx.mockNext(expected)

        const row = await ctx.conn.selectFrom(vProjectOverview)
            .where(vProjectOverview.id.equals(1))
            .select({
                id:        vProjectOverview.id,
                name:      vProjectOverview.name,
                nameUpper: vProjectOverview.nameUpper,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, upper(name) as "nameUpper" from project_overview where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; name: string; nameUpper: string }>>()
        expect(row).toEqual(expected)
    })

    test('select-view-optional-archived-column', async () => {
        // `archivedAt` is an optionalColumn — project 1 is not archived,
        // so the value is null in both mock and real mode.
        const expected = { id: 1, archivedAt: null }
        ctx.mockNext(expected)

        const row = await ctx.conn.selectFrom(vProjectOverview)
            .where(vProjectOverview.id.equals(1))
            .select({
                id:         vProjectOverview.id,
                archivedAt: vProjectOverview.archivedAt,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, archived_at as "archivedAt" from project_overview where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; archivedAt?: Date }>>()
        expect(row.archivedAt).toBeUndefined()
    })

    test('select-from-view-aliased-with-as', async () => {
        // `vProjectOverview.as('po')` aliases the view in the FROM.
        const expected = [{ id: 1, name: 'Marketing site' }]
        ctx.mockNext(expected)
        const po = vProjectOverview.as('po')

        const rows = await ctx.conn.selectFrom(po)
            .where(po.id.equals(1))
            .select({ id: po.id, name: po.name })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select po.id as id, po.name as name from project_overview as po where po.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('view-for-use-in-left-join-matches', async () => {
        // `forUseInLeftJoin()` lets the view participate as the optional
        // side of a left join. Org 1 joined to its overview row id=1.
        const expected = [{ orgName: 'Acme Corp', projectName: 'Marketing site', projectNameUpper: 'MARKETING SITE' }]
        ctx.mockNext(expected)
        const poLeft = vProjectOverview.forUseInLeftJoin()

        const rows = await ctx.conn.selectFrom(tOrganization)
            .leftJoin(poLeft).on(poLeft.id.equals(tOrganization.id))
            .where(tOrganization.id.equals(1))
            .select({
                orgName:          tOrganization.name,
                projectName:      poLeft.name,
                projectNameUpper: poLeft.nameUpper,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.name as "orgName", project_overview.name as "projectName", upper(project_overview.name) as "projectNameUpper" from organization left join project_overview on project_overview.id = organization.id where organization.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgName: string
            projectName?: string
            projectNameUpper?: string
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('view-for-use-in-left-join-as-no-match-yields-null', async () => {
        // `forUseInLeftJoinAs('po')` — aliased optional side. The join
        // matches nothing, so the view column is null and the projector
        // drops it (optionals-as-undefined): the result row has no
        // `projectName` key.
        const expected = [{ orgName: 'Acme Corp' }]
        ctx.mockNext([{ orgName: 'Acme Corp', projectName: null }])
        const po = vProjectOverview.forUseInLeftJoinAs('po')

        const rows = await ctx.conn.selectFrom(tOrganization)
            .leftJoin(po).on(po.id.equals(999))
            .where(tOrganization.id.equals(1))
            .select({
                orgName:     tOrganization.name,
                projectName: po.name,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.name as "orgName", po.name as "projectName" from organization left join project_overview as po on po.id = $1 where organization.id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            999,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ orgName: string; projectName?: string }>>>()
        expect(rows).toEqual(expected)
    })
})
