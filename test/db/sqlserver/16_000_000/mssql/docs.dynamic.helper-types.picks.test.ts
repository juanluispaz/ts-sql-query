// Documentation snippets for the Dynamic picks utilities page
// (docs/dynamic/helper-types/picks.md). Demonstrates the typing
// helpers around dynamicPick/dynamicPickPaths and the runtime
// `expandTypeFromDynamicPickPaths` companion.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact, type Extends } from '../../../../lib/assertType.js'
import { dynamicPick, dynamicPickPaths, expandTypeFromDynamicPickPaths, type DynamicPick, type DynamicPickPaths, type PickValuesPath, type PickValuesPathWithAllProperties, type PickValuesPathProjectedAsNullable, type PickValuesPathWithAllPropertiesProjectedAsNullable, expandTypeProjectedAsNullableFromDynamicPickPaths, type Pickable } from '../../../../../src/dynamic/pick.js'
import { type DeepPick, type DeepPickPaths } from '../../../../../src/extras/deepUtilities.js'
import { tProject, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // Shared field map for the tests below.
    const availableFields = {
        id:   tProject.id,
        name: tProject.name,
        slug: tProject.slug,
    }

    test('docs:utilities-picks/dynamic-pick-paths-type', () => {
        // doc-start
        type FieldsToPickList = DynamicPickPaths<typeof availableFields, 'id'>
        // doc-end
        // 'id' is always included, so it isn't one of the paths to choose from.
        assertType<Exact<FieldsToPickList, 'name' | 'slug'>>()
    })

    test('docs:utilities-picks/pick-values-path-type', () => {
        // doc-start
        type ResultType = PickValuesPath<typeof availableFields, 'name' | 'slug'>
        // doc-end
        // Only the picked fields appear in the result, as required.
        assertType<Exact<ResultType, { name: string; slug: string }>>()
    })

    test('docs:utilities-picks/dynamic-pick-runtime', async () => {
        const expected = [
            { id: 1, name: 'Marketing site', slug: 'mktg-site' },
            { id: 2, name: 'Internal tools', slug: 'tools' },
            { id: 3, name: 'Public API', slug: 'public-api' },
            { id: 4, name: 'Legacy app', slug: 'legacy' },
        ]
        ctx.mockNext(expected)

        // doc-start
        const fieldsToPick = {
            name: true,
            slug: true,
        }

        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])
        // doc-end
        const rows = await ctx.conn.selectFrom(tProject)
            .select(pickedFields)
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name?: string; slug?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('docs:utilities-picks/dynamic-pick-paths-runtime', async () => {
        const expected = [
            { id: 1, name: 'Marketing site', slug: 'mktg-site' },
            { id: 2, name: 'Internal tools', slug: 'tools' },
            { id: 3, name: 'Public API', slug: 'public-api' },
            { id: 4, name: 'Legacy app', slug: 'legacy' },
        ]
        ctx.mockNext(expected)

        // doc-start
        const pickedFields = dynamicPickPaths(availableFields, ['name', 'slug'], ['id'])
        // doc-end
        const rows = await ctx.conn.selectFrom(tProject)
            .select(pickedFields)
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name?: string; slug?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('docs:utilities-picks/dynamic-pick-type', () => {
        // Section "Types to define dynamic pick inputs and outputs —
        // DynamicPick" — the type describes the legal shape of a
        // `fieldsToPick` input. The second generic argument lists the
        // ALWAYS-included keys; those keys are REMOVED from the picker
        // shape because the caller doesn't need to choose them.
        // doc-start
        type FieldsToPick = DynamicPick<typeof availableFields, 'id'>
        // doc-end
        // 'id' is mandatory, so it's not part of FieldsToPick — only
        // optional `name`/`slug` remain. The exact picker shape (each
        // pickable field an optional boolean flag) is pinned here.
        assertType<Exact<FieldsToPick, { name?: boolean; slug?: boolean }>>()
        const probe: FieldsToPick = { name: true }
        expect(probe.name).toBe(true)
    })

    test('docs:utilities-picks/pick-values-path-with-all-properties', () => {
        // Section "PickValuesPathWithAllProperties" — like
        // `PickValuesPath` but every property of the source appears in
        // the result (picked ones required, unpicked ones optional).
        // doc-start
        type Result = PickValuesPathWithAllProperties<typeof availableFields, 'id' | 'name'>
        // doc-end
        // id and name are required, slug is optional.
        assertType<Exact<Result, { id: number; name: string; slug?: string }>>()
    })

    test('docs:utilities-picks/definitions-from-database-types', async () => {
        // doc-start
        const projectInformationFields = {
            id:         tProject.id,
            name:       tProject.name,
            slug:       tProject.slug,
            archivedAt: tProject.archivedAt,
        }

        type ProjectInformationFields = DynamicPickPaths<typeof projectInformationFields>
        type ProjectInformation<FIELDS extends ProjectInformationFields> = PickValuesPath<typeof projectInformationFields, FIELDS | 'id'>

        async function getProjectsInformation<FIELDS extends ProjectInformationFields>(fields: FIELDS[]): Promise<ProjectInformation<FIELDS>[]> {

            // always include id field as required
            const pickedFields = dynamicPickPaths(projectInformationFields, fields, ['id'])

            const projects = await ctx.conn.selectFrom(tProject)
                .select(pickedFields)
                .orderBy('id')
                .executeSelectMany()

            return expandTypeFromDynamicPickPaths(projectInformationFields, fields, projects, ['id'])
        }
        // doc-end

        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ]
        ctx.mockNext(expected)
        const result = await getProjectsInformation(['name'])

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; name: string }>>>()
        expect(result).toEqual(expected)
    })

    test('docs:utilities-picks/typed-helper-business-type-pattern', async () => {
        // doc-start
        interface ProjectInformation {
            id:   number
            name: string
            slug: string
            archivedAt?: Date
        }

        async function getProjects<FIELDS extends keyof ProjectInformation>(
            fields: FIELDS[],
        ): Promise<Pick<ProjectInformation, FIELDS | 'id'>[]> {
            const availableFields = {
                id:         tProject.id,
                name:       tProject.name,
                slug:       tProject.slug,
                archivedAt: tProject.archivedAt,
            }

            // always include id field as required
            const pickedFields = dynamicPickPaths(availableFields, fields, ['id'])

            const projects = await ctx.conn.selectFrom(tProject)
                .select(pickedFields)
                .orderBy('id')
                .executeSelectMany()

            return expandTypeFromDynamicPickPaths(availableFields, fields, projects, ['id'])
        }
        // doc-end

        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ]
        ctx.mockNext(expected)
        const result = await getProjects(['name'])

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<Pick<ProjectInformation, 'name' | 'id'>>>>()
        expect(result).toEqual(expected)
    })

    test('docs:utilities-picks/deep-pick-business-type-pattern', async () => {
        // doc-start
        async function getProjects<FIELDS extends DeepPickPaths<ProjectWithOrg>>(
            fields: FIELDS[],
        ): Promise<DeepPick<ProjectWithOrg, FIELDS | 'id'>[]> {
            const organization = tOrganization.forUseInLeftJoinAs('organization')
            const availableFields = {
                id:   tProject.id,
                name: tProject.name,
                organization: {
                    id:   organization.id,
                    name: organization.name,
                },
            }

            // always include id field as required
            const pickedFields = dynamicPickPaths(availableFields, fields, ['id'])

            const projects = await ctx.conn.selectFrom(tProject)
                .optionalLeftOuterJoin(organization).on(organization.id.equals(tProject.organizationId))
                .select(pickedFields)
                .orderBy('id')
                .executeSelectMany()

            return expandTypeFromDynamicPickPaths(availableFields, fields, projects, ['id'])
        }
        // doc-end

        ctx.mockNext([
            { id: 1, name: 'Marketing site', 'organization.name': 'Acme Corp' },
            { id: 2, name: 'Internal tools', 'organization.name': 'Acme Corp' },
            { id: 3, name: 'Public API', 'organization.name': 'Globex Ltd' },
            { id: 4, name: 'Legacy app', 'organization.name': 'Globex Ltd' },
        ])
        const result = await getProjects(['name', 'organization.name'])

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, organization.name as [organization.name] from project left outer join organization as organization on organization.id = project.organization_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<DeepPick<ProjectWithOrg, 'name' | 'organization.name' | 'id'>>>>()
        expect(result).toEqual([
            { id: 1, name: 'Marketing site', organization: { name: 'Acme Corp' } },
            { id: 2, name: 'Internal tools', organization: { name: 'Acme Corp' } },
            { id: 3, name: 'Public API', organization: { name: 'Globex Ltd' } },
            { id: 4, name: 'Legacy app', organization: { name: 'Globex Ltd' } },
        ])
    })

    test('docs:utilities-picks/result-types', () => {
        // doc-start
        type OnlyPicked = PickValuesPath<typeof fieldsWithNullable, 'name' | 'archivedAt'>
        type AllProperties = PickValuesPathWithAllProperties<typeof fieldsWithNullable, 'name' | 'archivedAt'>
        type OnlyPickedAsNullable = PickValuesPathProjectedAsNullable<typeof fieldsWithNullable, 'name' | 'archivedAt'>
        type AllPropertiesAsNullable = PickValuesPathWithAllPropertiesProjectedAsNullable<typeof fieldsWithNullable, 'name' | 'archivedAt'>
        // doc-end
        assertType<Exact<OnlyPicked, { name: string; archivedAt?: Date }>>()
        assertType<Exact<AllProperties, { name: string; archivedAt?: Date; id?: number }>>()
        assertType<Exact<OnlyPickedAsNullable, { name: string; archivedAt: Date | null }>>()
        assertType<Exact<AllPropertiesAsNullable, { name: string; archivedAt: Date | null; id?: number }>>()
    })

    test('docs:utilities-picks/pickable', async () => {
        // doc-start
        function pickFields<FIELDS extends Pickable>(fields: FIELDS, paths: DynamicPickPaths<FIELDS>[]) {
            return dynamicPickPaths(fields, paths)
        }

        const pickedFields = pickFields(availableFields, ['name', 'slug'])
        // doc-end

        const expected = [{ name: 'Marketing site', slug: 'mktg-site' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select(pickedFields)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as name, slug as slug from project where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('docs:utilities-picks/expand-a-page', async () => {
        ctx.mockNext([{ id: 1, name: 'Marketing site' }, { id: 2, name: 'Internal tools' }])
        ctx.mockNext(4)

        // doc-start
        const projectFields = {
            id: tProject.id,
            name: tProject.name,
            slug: tProject.slug
        }

        async function getProjectsPage<FIELDS extends DynamicPickPaths<typeof projectFields, 'id'>>(fields: FIELDS[]) {
            const page = await ctx.conn.selectFrom(tProject)
                .select(dynamicPickPaths(projectFields, fields, ['id']))
                .orderBy('id')
                .limit(2)
                .offset(0)
                .executeSelectPage()

            return expandTypeFromDynamicPickPaths(projectFields, fields, page, ['id'])
        }

        const projectsPage = await getProjectsPage(['name'])
        // doc-end

        expect(ctx.history).toMatchInlineSnapshot(`
          [
            {
              "params": [
                0,
                2,
              ],
              "sql": "select id as id, name as name from project order by id offset @0 rows fetch next @1 rows only",
              "type": "selectManyRows",
            },
            {
              "params": [],
              "sql": "select count(*) from project",
              "type": "selectOneColumnOneRow",
            },
          ]
        `)
        assertType<Extends<typeof projectsPage, { data: Array<{ id: number; name: string }>; count: number }>>()
        expect(projectsPage).toEqual({
            data: [{ id: 1, name: 'Marketing site' }, { id: 2, name: 'Internal tools' }],
            count: 4,
        })
    })

    test('docs:utilities-picks/expand-projected-as-nullable', async () => {
        const expected = [{ id: 1, archivedAt: null }]
        ctx.mockNext(expected)

        // doc-start
        const projectFields = {
            id: tProject.id,
            name: tProject.name,
            archivedAt: tProject.archivedAt
        }

        type ProjectField = DynamicPickPaths<typeof projectFields, 'id'>
        type ProjectRow<FIELDS extends ProjectField> = PickValuesPathProjectedAsNullable<typeof projectFields, FIELDS | 'id'>

        async function getProjects<FIELDS extends ProjectField>(fields: FIELDS[]): Promise<ProjectRow<FIELDS>[]> {
            const projects = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select(dynamicPickPaths(projectFields, fields, ['id']))
                .projectingOptionalValuesAsNullable()
                .executeSelectMany()

            return expandTypeProjectedAsNullableFromDynamicPickPaths(projectFields, fields, projects, ['id'])
        }

        const projects = await getProjects(['archivedAt'])
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, archived_at as archivedAt from project where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof projects, Array<{ id: number; archivedAt: Date | null }>>>()
        expect(projects).toEqual(expected)
    })

    // Field map that includes an optional column (tProject.archivedAt) so the
    // nullable projection is observable.
    const fieldsWithNullable = {
        id:         tProject.id,
        name:       tProject.name,
        archivedAt: tProject.archivedAt,
    }

    test('docs-extra:utilities-picks/pick-values-path-projected-as-nullable', () => {
        // The …ProjectedAsNullable sibling of PickValuesPath projects an
        // optional picked leaf as a present `T | null` instead of `?: T`.
        type ResultNullable = PickValuesPathProjectedAsNullable<typeof fieldsWithNullable, 'name' | 'archivedAt'>
        assertType<Exact<ResultNullable, { name: string; archivedAt: Date | null }>>()
        // Contrast with the non-nullable twin, where archivedAt stays optional.
        type ResultPlain = PickValuesPath<typeof fieldsWithNullable, 'name' | 'archivedAt'>
        assertType<Exact<ResultPlain, { name: string; archivedAt?: Date }>>()
    })

    test('docs-extra:utilities-picks/pick-values-path-with-all-properties-projected-as-nullable', () => {
        // The …WithAllPropertiesProjectedAsNullable sibling keeps the picked
        // leaf required; unpicked properties stay optional (`?:`) as in the
        // non-nullable twin, and the nullable projection additionally adds
        // `| null` to the VALUE of the originally-optional column (archivedAt).
        type ResultNullable = PickValuesPathWithAllPropertiesProjectedAsNullable<typeof fieldsWithNullable, 'name'>
        assertType<Exact<ResultNullable, { name: string; id?: number; archivedAt?: Date | null }>>()
    })

})

interface ProjectWithOrg {
    id:   number
    name: string
    organization?: { id: number; name: string }
}
