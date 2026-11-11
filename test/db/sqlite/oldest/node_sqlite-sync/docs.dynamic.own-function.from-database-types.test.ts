// Documentation snippets for the page "Typing dynamic queries from the database types"
// (docs/dynamic/own-function/from-database-types.md): every helper type derived from the available columns,
// with the page's tCustomer as tProject, tCompany as tOrganization and birthday as archivedAt.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DynamicCondition } from '../../../../../src/dynamic/condition.js'
import type { OrderByForModel } from '../../../../../src/dynamic/orderBy.js'
import { dynamicPickPaths, expandTypeFromDynamicPickPaths, type DynamicPickPaths, type PickValuesPath } from '../../../../../src/dynamic/pick.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import type { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:from-database-types/filter', async () => {
        // doc-start
        const availableFields = {
            id: tProject.id,
            name: tProject.name,
            archivedAt: tProject.archivedAt
        }

        // the filter type derived from the columns
        type ProjectFilter = DynamicCondition<typeof availableFields>

        async function filterProjects(connection: DBConnection, filter: ProjectFilter) {
            const dynamicWhere = connection.dynamicConditionFor(availableFields).withValues(filter)

            return sync(connection.selectFrom(tProject)
                .where(dynamicWhere)
                .select(availableFields)
                .executeSelectMany())
        }

        ctx.mockNext([{ id: 4, name: 'Legacy app', archivedAt: new Date('2024-02-01T00:00:00.000Z') }])

        const result = await filterProjects(ctx.conn, {
            name: { containsInsensitive: 'LEGACY' },
            archivedAt: { greaterThan: new Date('1990-01-01T00:00:00Z') }
        })
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, archived_at as archivedAt from project where lower(name) like lower('%' || ?1 || '%') escape '\\' and archived_at > ?2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "LEGACY",
            "1990-01-01 00:00:00.000",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; name: string; archivedAt?: Date }>>>()
        expect(result).toEqual([{ id: 4, name: 'Legacy app', archivedAt: new Date('2024-02-01T00:00:00.000Z') }])
    })

    test('docs:from-database-types/pick-columns', async () => {
        // doc-start
        const company = tOrganization.forUseInLeftJoinAs('company')

        const availableFields = {
            id: tProject.id,
            name: tProject.name,
            company: {
                id: company.id,
                name: company.name
            }
        }

        // the pickable paths (id is always included) and the result type for a selection
        type ProjectFields = DynamicPickPaths<typeof availableFields, 'id'>
        type ProjectInfo<FIELDS extends ProjectFields> = PickValuesPath<typeof availableFields, FIELDS | 'id'>

        async function pickProjectColumns<FIELDS extends ProjectFields>(connection: DBConnection, fields: FIELDS[]): Promise<ProjectInfo<FIELDS>[]> {
            // always include id; the optional left join is pruned when no company field is picked
            const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])

            const projects = sync(connection.selectFrom(tProject)
                .optionalLeftOuterJoin(company).on(company.id.equals(tProject.organizationId))
                .where(tProject.id.equals(1))
                .select(selectedFields)
                .executeSelectMany())

            return expandTypeFromDynamicPickPaths(availableFields, fields, projects, ['id'])
        }

        ctx.mockNext([{ id: 1, name: 'Marketing site', 'company.name': 'Acme Corp' }])

        const result = await pickProjectColumns(ctx.conn, ['name', 'company.name'])
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, company.name as "company.name" from project left outer join organization as company on company.id = project.organization_id where project.id = ?1"`)
        assertType<Exact<ProjectFields, 'name' | 'company' | 'company.id' | 'company.name'>>()
        assertType<Exact<typeof result, Array<{ id: number; name: string; company?: { name: string } }>>>()
        expect(result).toEqual([{ id: 1, name: 'Marketing site', company: { name: 'Acme Corp' } }])

        ctx.mockNext([{ id: 1, name: 'Marketing site' }])
        const withoutCompany = await pickProjectColumns(ctx.conn, ['name'])
        // No company field picked: the optional left join isn't in the query.
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where id = ?1"`)
        assertType<Exact<typeof withoutCompany, Array<{ id: number; name: string }>>>()
        expect(withoutCompany).toEqual([{ id: 1, name: 'Marketing site' }])
    })

    test('docs:from-database-types/order-by', async () => {
        // doc-start
        const availableFields = {
            id: tProject.id,
            name: tProject.name,
            archivedAt: tProject.archivedAt
        }

        // the full result row, used to constrain the order-by to the orderable columns
        type ProjectRow = PickValuesPath<typeof availableFields, DynamicPickPaths<typeof availableFields>>

        async function sortProjects(connection: DBConnection, orderBy: OrderByForModel<ProjectRow>[]) {
            return sync(connection.selectFrom(tProject)
                .select(availableFields)
                .orderByFromStringIfValue(orderBy?.join(', '))
                .executeSelectMany())
        }

        ctx.mockNext([
            { id: 2, name: 'Internal tools' },
            { id: 4, name: 'Legacy app', archivedAt: new Date('2024-01-02T03:04:05Z') },
            { id: 1, name: 'Marketing site' },
            { id: 3, name: 'Public API' },
        ])

        const result = await sortProjects(ctx.conn, ['name asc', 'archivedAt desc nulls last'])
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, archived_at as archivedAt from project order by name asc, archivedAt desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<ProjectRow, { id: number; name: string; archivedAt?: Date }>>()
        assertType<Exact<typeof result, Array<{ id: number; name: string; archivedAt?: Date }>>>()
        expect(result.map((row) => row.name)).toEqual(['Internal tools', 'Legacy app', 'Marketing site', 'Public API'])
    })

    test('docs:from-database-types/all-together', async () => {
        // doc-start
        const company = tOrganization.forUseInLeftJoinAs('company')

        const availableFields = {
            id: tProject.id,
            name: tProject.name,
            archivedAt: tProject.archivedAt,
            company: {
                id: company.id,
                name: company.name
            }
        }

        type ProjectFields = DynamicPickPaths<typeof availableFields, 'id'>
        type ProjectInfo<FIELDS extends ProjectFields> = PickValuesPath<typeof availableFields, FIELDS | 'id'>
        type ProjectFilter = DynamicCondition<typeof availableFields>

        async function listProjectDirectory<FIELDS extends ProjectFields>(
            connection: DBConnection,
            fields: FIELDS[],
            filter: ProjectFilter,
            orderBy?: OrderByForModel<ProjectInfo<ProjectFields>>[]
        ): Promise<ProjectInfo<FIELDS>[]> {
            const dynamicWhere = connection.dynamicConditionFor(availableFields).withValues(filter)
            const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])

            const projects = sync(connection.selectFrom(tProject)
                .optionalLeftOuterJoin(company).on(company.id.equals(tProject.organizationId))
                .where(dynamicWhere)
                .select(selectedFields)
                .orderByFromStringIfValue(orderBy?.join(', '))
                .executeSelectMany())

            return expandTypeFromDynamicPickPaths(availableFields, fields, projects, ['id'])
        }

        ctx.mockNext([
            { id: 1, name: 'Marketing site', 'company.name': 'Acme Corp' },
            { id: 2, name: 'Internal tools', 'company.name': 'Acme Corp' },
        ])

        const result = await listProjectDirectory(ctx.conn, ['name', 'company.name'],
            { name: { containsInsensitive: 'T' }, company: { name: { equals: 'Acme Corp' } } },
            ['company.name asc nulls last', 'name desc'])
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, company.name as "company.name" from project left outer join organization as company on company.id = project.organization_id where lower(project.name) like lower('%' || ?1 || '%') escape '\\' and company.name = ?2 order by company.name is null, "company.name" asc, name desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "T",
            "Acme Corp",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; name: string; company?: { name: string } }>>>()
        expect(result).toEqual([
            { id: 1, name: 'Marketing site', company: { name: 'Acme Corp' } },
            { id: 2, name: 'Internal tools', company: { name: 'Acme Corp' } },
        ])
    })

    test('docs-extra:from-database-types/a-group-path-picks-the-whole-group', async () => {
        const company = tOrganization.forUseInLeftJoinAs('company')
        const availableFields = {
            id: tProject.id,
            name: tProject.name,
            company: {
                id: company.id,
                name: company.name
            }
        }

        ctx.mockNext([{ id: 1, 'company.id': 1, 'company.name': 'Acme Corp' }])

        const projects = sync(ctx.conn.selectFrom(tProject)
            .optionalLeftOuterJoin(company).on(company.id.equals(tProject.organizationId))
            .where(tProject.id.equals(1))
            .select(dynamicPickPaths(availableFields, ['company'], ['id']))
            .executeSelectMany())
        const result: PickValuesPath<typeof availableFields, 'company' | 'id'>[] = expandTypeFromDynamicPickPaths(availableFields, ['company'], projects, ['id'])

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, company.id as "company.id", company.name as "company.name" from project left outer join organization as company on company.id = project.organization_id where project.id = ?1"`)
        assertType<Exact<typeof result, Array<{ id: number; company?: { id: number; name: string } }>>>()
        expect(result).toEqual([{ id: 1, company: { id: 1, name: 'Acme Corp' } }])
    })

    test('docs-extra:from-database-types/no-order-array-adds-no-order', async () => {
        ctx.mockNext([{ id: 1 }])

        const result = sync(ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id })
            .orderByFromStringIfValue(undefined)
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where id = ?1"`)
        expect(result).toEqual([{ id: 1 }])
    })

    test('docs-extra:from-database-types/an-order-by-a-column-not-picked-throws', () => {
        const company = tOrganization.forUseInLeftJoinAs('company')
        const availableFields = {
            id: tProject.id,
            name: tProject.name,
            company: {
                id: company.id,
                name: company.name
            }
        }
        type ProjectFields = DynamicPickPaths<typeof availableFields, 'id'>
        type ProjectInfo<FIELDS extends ProjectFields> = PickValuesPath<typeof availableFields, FIELDS | 'id'>
        const orderBy: OrderByForModel<ProjectInfo<ProjectFields>>[] = ['company.name asc']

        expect(() => ctx.conn.selectFrom(tProject)
            .optionalLeftOuterJoin(company).on(company.id.equals(tProject.organizationId))
            .select(dynamicPickPaths(availableFields, ['name'], ['id']))
            .orderByFromStringIfValue(orderBy?.join(', '))
        ).toThrow('ORDER_BY_COLUMN_NOT_IN_SELECT')
    })
})
