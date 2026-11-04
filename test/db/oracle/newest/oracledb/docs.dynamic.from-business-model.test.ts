// Documentation snippets for the page "Typing dynamic queries from a business model"
// (docs/dynamic/from-business-model.md): filter, picked columns and order-by derived from a plain
// model interface, with the page's tCustomer as tProject, tCompany as tOrganization and birthday
// as archivedAt.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DynamicConditionForModel } from '../../../../../src/dynamic/condition.js'
import type { OrderByForModel } from '../../../../../src/dynamic/orderBy.js'
import { dynamicPickPaths, expandTypeFromDynamicPickPaths } from '../../../../../src/dynamic/pick.js'
import type { DeepPick, DeepPickPaths } from '../../../../../src/extras/deepUtilities.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import type { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:from-business-model/filter', async () => {
        // doc-start
        interface ProjectFilterRow {
            id: number
            name: string
            archivedAt?: Date
        }

        async function filterProjects(connection: DBConnection, filter: DynamicConditionForModel<ProjectFilterRow>): Promise<ProjectFilterRow[]> {
            const availableFields = {
                id: tProject.id,
                name: tProject.name,
                archivedAt: tProject.archivedAt
            }

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", name as "name", archived_at as "archivedAt" from project where lower(name) like lower('%' || :0 || '%') escape '\\' and archived_at > :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "LEGACY",
            1990-01-01T00:00:00.000Z,
          ]
        `)
        assertType<Exact<typeof result, ProjectFilterRow[]>>()
        // archived_at of the seed is the time of the insert.
        expect(result.map((row) => [row.id, row.name, row.archivedAt instanceof Date])).toEqual([[4, 'Legacy app', true]])
    })

    test('docs:from-business-model/pick-columns', async () => {
        // doc-start
        interface ProjectPickRow {
            id: number
            name: string
            company?: {
                id: number
                name: string
            }
        }

        async function pickProjectColumns<FIELDS extends DeepPickPaths<ProjectPickRow>>(connection: DBConnection, fields: FIELDS[]): Promise<DeepPick<ProjectPickRow, FIELDS | 'id'>[]> {
            const company = tOrganization.forUseInLeftJoinAs('company')

            const availableFields = {
                id: tProject.id,
                name: tProject.name,
                company: {
                    id: company.id,
                    name: company.name
                }
            }

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "id", project.name as "name", company.name as "company.name" from project left outer join "organization" company on company.id = project.organization_id where project.id = :0"`)
        assertType<Exact<typeof result, Array<{ id: number; name: string; company?: { name: string } }>>>()
        expect(result).toEqual([{ id: 1, name: 'Marketing site', company: { name: 'Acme Corp' } }])

        ctx.mockNext([{ id: 1, name: 'Marketing site' }])
        const withoutCompany = await pickProjectColumns(ctx.conn, ['name'])
        // No company field picked: the optional left join isn't in the query.
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", name as "name" from project where id = :0"`)
        assertType<Exact<typeof withoutCompany, Array<{ id: number; name: string }>>>()
        expect(withoutCompany).toEqual([{ id: 1, name: 'Marketing site' }])
    })

    test('docs:from-business-model/order-by', async () => {
        // doc-start
        interface ProjectSortRow {
            id: number
            name: string
            archivedAt?: Date
        }

        async function sortProjects(connection: DBConnection, orderBy: OrderByForModel<ProjectSortRow>[]): Promise<ProjectSortRow[]> {
            const availableFields = {
                id: tProject.id,
                name: tProject.name,
                archivedAt: tProject.archivedAt
            }

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", name as "name", archived_at as "archivedAt" from project order by "name" asc, "archivedAt" desc nulls last"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, ProjectSortRow[]>>()
        expect(result.map((row) => row.name)).toEqual(['Internal tools', 'Legacy app', 'Marketing site', 'Public API'])
    })

    test('docs:from-business-model/all-together', async () => {
        // doc-start
        interface ProjectDirectoryRow {
            id: number
            name: string
            archivedAt?: Date
            company?: {
                id: number
                name: string
            }
        }

        async function listProjectDirectory<FIELDS extends DeepPickPaths<ProjectDirectoryRow>>(
            connection: DBConnection,
            fields: FIELDS[],
            filter: DynamicConditionForModel<ProjectDirectoryRow>,
            orderBy?: OrderByForModel<ProjectDirectoryRow>[]
        ): Promise<DeepPick<ProjectDirectoryRow, FIELDS | 'id'>[]> {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "id", project.name as "name", company.name as "company.name" from project left outer join "organization" company on company.id = project.organization_id where lower(project.name) like lower('%' || :0 || '%') escape '\\' and company.name = :1 order by "company.name" asc nulls last, "name" desc"`)
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
