// Documentation snippets for the Dynamic order by utilities page
// (docs/dynamic/utilities/order-by.md): a clause typed against a business model,
// an array of clauses, and the set of ordering modes.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { OrderByForModel, OrderByMode } from '../../../../../src/dynamic/orderBy.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

interface Project {
    id: number
    name: string
    createdAt: Date
    organization?: {
        id: number
        name: string
    }
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:utilities-order-by/order-by-for-model', () => {
        // doc-start
        // 'id' | 'name' | 'createdAt' | 'organization.name' | 'name asc' | 'createdAt desc nulls last' | …
        type ProjectOrder = OrderByForModel<Project>
        // doc-end

        // The clauses without a mode are the model's scalar leaves.
        assertType<Exact<Exclude<ProjectOrder, `${string} ${string}`>, 'id' | 'name' | 'createdAt' | 'organization.id' | 'organization.name'>>()
        // Each leaf takes each of the modes.
        assertType<Exact<Extract<ProjectOrder, `organization.name ${string}`>, `organization.name ${OrderByMode}`>>()
    })

    test('docs:utilities-order-by/array-of-clauses', async () => {
        ctx.mockNext([
            { id: 1, name: 'Marketing site', 'organization.name': 'Acme Corp' },
            { id: 2, name: 'Internal tools', 'organization.name': 'Acme Corp' },
            { id: 3, name: 'Public API', 'organization.name': 'Globex Ltd' },
            { id: 4, name: 'Legacy app', 'organization.name': 'Globex Ltd' },
        ])

        // doc-start
        const orderBy: OrderByForModel<Project>[] = ['organization.name asc nulls last', 'name desc']

        const organization = tOrganization.forUseInLeftJoinAs('organization')

        const rows = await ctx.conn.selectFrom(tProject)
            .leftOuterJoin(organization).on(organization.id.equals(tProject.organizationId))
            .select({
                id: tProject.id,
                name: tProject.name,
                organization: {
                    name: organization.name
                }
            })
            .orderByFromStringArray(orderBy)
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, organization.name as "organization.name" from project left outer join organization as organization on organization.id = project.organization_id order by "organization.name" asc nulls last, name desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name: string; organization?: { name: string } }>>>()
        expect(rows).toEqual([
            { id: 1, name: 'Marketing site', organization: { name: 'Acme Corp' } },
            { id: 2, name: 'Internal tools', organization: { name: 'Acme Corp' } },
            { id: 3, name: 'Public API', organization: { name: 'Globex Ltd' } },
            { id: 4, name: 'Legacy app', organization: { name: 'Globex Ltd' } },
        ])
    })

    test('docs-extra:utilities-order-by/only-the-properties-with-a-value', () => {
        type Order = OrderByForModel<{ id: number; tags: string[]; organization?: { name: string } }>
        assertType<Exact<Exclude<Order, `${string} ${string}`>, 'id' | 'organization.name'>>()
    })

    test('docs-extra:utilities-order-by/a-clause-of-the-model-not-in-the-select-throws', () => {
        const orderBy: OrderByForModel<Project>[] = ['createdAt desc']
        expect(() => ctx.conn.selectFrom(tProject)
            .select({ id: tProject.id })
            .orderByFromStringArray(orderBy)
        ).toThrow('ORDER_BY_COLUMN_NOT_IN_SELECT')
    })

    test('docs:utilities-order-by/order-by-mode', async () => {

        assertType<Exact<OrderByMode,
            | 'asc' | 'desc'
            | 'asc nulls first' | 'asc nulls last'
            | 'desc nulls first' | 'desc nulls last'
            | 'insensitive' | 'asc insensitive' | 'desc insensitive'
            | 'asc nulls first insensitive' | 'asc nulls last insensitive'
            | 'desc nulls first insensitive' | 'desc nulls last insensitive'
        >>()

        const expected = [
            { id: 3, name: 'Public API' },
            { id: 1, name: 'Marketing site' },
            { id: 4, name: 'Legacy app' },
            { id: 2, name: 'Internal tools' },
        ]
        ctx.mockNext(expected)

        // doc-start
        const mode: OrderByMode = 'desc nulls last'

        const rows = await ctx.conn.selectFrom(tProject)
            .select({
                id: tProject.id,
                name: tProject.name
            })
            .orderBy('name', mode)
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project order by name desc nulls last"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })
})
