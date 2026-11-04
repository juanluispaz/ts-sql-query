// Documentation snippets for the page "Typing dynamic queries from the database types"
// (docs/dynamic/from-database-types.md): every helper type derived from the available columns,
// with the page's tCustomer as tProject, tCompany as tOrganization and birthday as archivedAt.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DynamicCondition } from '../../../../../src/dynamic/condition.js'
import type { OrderByForModel } from '../../../../../src/dynamic/orderBy.js'
import { dynamicPickPaths, expandTypeFromDynamicPickPaths, type DynamicPickPaths, type PickValuesPath } from '../../../../../src/dynamic/pick.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import type { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

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

            return connection.selectFrom(tProject)
                .where(dynamicWhere)
                .select(availableFields)
                .executeSelectMany()
        }

        ctx.mockNext([{ id: 4, name: 'Legacy app', archivedAt: new Date('2024-01-02T03:04:05Z') }])

        const result = await filterProjects(ctx.conn, {
            name: { containsInsensitive: 'LEGACY' },
            archivedAt: { greaterThan: new Date('1990-01-01T00:00:00Z') }
        })
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\`, archived_at as archivedAt from project where lower(\`name\`) like concat('%', lower(?), '%') and archived_at > ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "LEGACY",
            1990-01-01T00:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; name: string; archivedAt?: Date }>>>()
        // archived_at of the seed is the time of the insert.
        expect(result.map((row) => [row.id, row.name, row.archivedAt instanceof Date])).toEqual([[4, 'Legacy app', true]])
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

            const projects = await connection.selectFrom(tProject)
                .optionalLeftOuterJoin(company).on(company.id.equals(tProject.organizationId))
                .where(tProject.id.equals(1))
                .select(selectedFields)
                .executeSelectMany()

            return expandTypeFromDynamicPickPaths(availableFields, fields, projects, ['id'])
        }

        ctx.mockNext([{ id: 1, name: 'Marketing site', 'company.name': 'Acme Corp' }])

        const result = await pickProjectColumns(ctx.conn, ['name', 'company.name'])
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.\`name\` as \`name\`, company.\`name\` as \`company.name\` from project left outer join \`organization\` as company on company.id = project.organization_id where project.id = ?"`)
        assertType<Exact<ProjectFields, 'name' | 'company' | 'company.id' | 'company.name'>>()
        assertType<Exact<typeof result, Array<{ id: number; name: string; company?: { name: string } }>>>()
        expect(result).toEqual([{ id: 1, name: 'Marketing site', company: { name: 'Acme Corp' } }])

        ctx.mockNext([{ id: 1, name: 'Marketing site' }])
        const withoutCompany = await pickProjectColumns(ctx.conn, ['name'])
        // No company field picked: the optional left join isn't in the query.
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\` from project where id = ?"`)
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
            return connection.selectFrom(tProject)
                .select(availableFields)
                .orderByFromStringArrayIfValue(orderBy)
                .executeSelectMany()
        }

        ctx.mockNext([
            { id: 2, name: 'Internal tools' },
            { id: 4, name: 'Legacy app', archivedAt: new Date('2024-01-02T03:04:05Z') },
            { id: 1, name: 'Marketing site' },
            { id: 3, name: 'Public API' },
        ])

        const result = await sortProjects(ctx.conn, ['name asc', 'archivedAt desc nulls last'])
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\`, archived_at as archivedAt from project order by \`name\` asc, archivedAt desc"`)
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

            const projects = await connection.selectFrom(tProject)
                .optionalLeftOuterJoin(company).on(company.id.equals(tProject.organizationId))
                .where(dynamicWhere)
                .select(selectedFields)
                .orderByFromStringArrayIfValue(orderBy)
                .executeSelectMany()

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.\`name\` as \`name\`, company.\`name\` as \`company.name\` from project left outer join \`organization\` as company on company.id = project.organization_id where lower(project.\`name\`) like concat('%', lower(?), '%') and company.\`name\` = ? order by company.\`name\` is null, \`company.name\` asc, \`name\` desc"`)
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
})
