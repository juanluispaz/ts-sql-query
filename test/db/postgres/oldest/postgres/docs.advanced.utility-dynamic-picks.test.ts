// Documentation snippets for the Utility for dynamic picks page
// (docs/advanced/utility-dynamic-picks.md). Demonstrates the typing
// helpers around dynamicPick/dynamicPickPaths and the runtime
// `expandTypeFromDynamicPickPaths` companion.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact, type Extends } from '../../../../lib/assertType.js'
import { dynamicPick, dynamicPickPaths, expandTypeFromDynamicPickPaths, type DynamicPick, type DynamicPickPaths, type PickValuesPath, type PickValuesPathWitAllProperties, type PickValuesPathProjectedAsNullable, type PickValuesPathWitAllPropertiesProjectedAsNullable } from '../../../../../src/dynamic/pick.js'
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

    test('docs-extra:utility-dynamic-picks/dynamic-pick-paths-type', () => {
        type Paths = DynamicPickPaths<typeof availableFields>
        // All three top-level paths are exposed by the helper.
        assertType<Exact<Paths, 'id' | 'name' | 'slug'>>()
    })

    test('docs-extra:utility-dynamic-picks/pick-values-path-type', () => {
        type Result = PickValuesPath<typeof availableFields, 'id' | 'name'>
        // Only the picked fields appear in the result, as required.
        assertType<Exact<Result, { id: number; name: string }>>()
    })

    test('docs:utility-dynamic-picks/dynamic-pick-runtime', async () => {
        // Section "Functions to select fields dynamically — dynamicPick"
        // — call the helper with a `{ field: true }` shape; only the
        // marked fields and any `alwaysIncluded` keys make it into the
        // projected object.
        ctx.mockNext([{ id: 1, name: 'Marketing site' }])

        // doc-start
        const fieldsToPick = { name: true } as const

        const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])
        const rows = await ctx.conn.selectFrom(tProject)
            .select(pickedFields)
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Extends<typeof rows, Array<{ id: number; name?: string }>>>()
    })

    test('docs:utility-dynamic-picks/dynamic-pick-type', () => {
        // Section "Types to define dynamic pick inputs and outputs —
        // DynamicPick" — the type describes the legal shape of a
        // `fieldsToPick` input. The second generic argument lists the
        // ALWAYS-included keys; those keys are REMOVED from the picker
        // shape because the caller doesn't need to choose them.
        // doc-start
        type FieldsToPick = DynamicPick<typeof availableFields, 'id'>
        // doc-end
        // 'id' is mandatory, so it's not part of FieldsToPick — only
        // optional `name`/`slug` remain.
        const probe: FieldsToPick = { name: true }
        expect(probe.name).toBe(true)
    })

    test('docs:utility-dynamic-picks/pick-values-path-with-all-properties', () => {
        // Section "PickValuesPathWitAllProperties" — like
        // `PickValuesPath` but every property of the source appears in
        // the result (picked ones required, unpicked ones optional).
        // doc-start
        type Result = PickValuesPathWitAllProperties<typeof availableFields, 'id' | 'name'>
        // doc-end
        // id and name are required, slug is optional.
        assertType<Exact<Result, { id: number; name: string; slug?: string }>>()
    })

    test('docs-extra:utility-dynamic-picks/typed-helper-business-type-pattern', async () => {
        interface ProjectInformation {
            id:   number
            name: string
            slug: string
        }

        async function getProjects<FIELDS extends keyof ProjectInformation>(
            fields: FIELDS[],
        ): Promise<Pick<ProjectInformation, FIELDS | 'id'>[]> {
            const pickedFields = dynamicPickPaths(availableFields, fields, ['id'])
            const projects = await ctx.conn.selectFrom(tProject)
                .select(pickedFields)
                .orderBy('id')
                .executeSelectMany()
            // expandTypeFromDynamicPickPaths intersects the structural result
            // with a flat-keyed term, so the inferred shape is assignable to a
            // hand-written `Pick<Model, K>` for the flat (top-level) keys — no
            // cast needed when piping through user business types.
            return expandTypeFromDynamicPickPaths(availableFields, fields, projects, ['id'])
        }

        ctx.mockNext([
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ])
        const result = await getProjects(['name'])

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        // Pick<ProjectInformation, 'name' | 'id'> → { id, name }, both required.
        assertType<Extends<typeof result, Array<{ id: number; name: string }>>>()
        // No WHERE: returns all four seed projects ordered by id.
        expect(result).toEqual([
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
            { id: 4, name: 'Legacy app' },
        ])
    })

    test('docs-extra:utility-dynamic-picks/deep-pick-business-type-pattern', async () => {
        // Model-first NESTED flow: the generic FIELDS is constrained by the
        // business model's dotted paths and the result is typed as a DeepPick of
        // that model — no cast, no leak of the column shape into the signature.
        const organization = tOrganization.forUseInLeftJoinAs('organization')

        async function getProjects<FIELDS extends DeepPickPaths<ProjectWithOrg>>(
            fields: FIELDS[],
        ): Promise<DeepPick<ProjectWithOrg, FIELDS | 'id'>[]> {
            const availableFields = {
                id:   tProject.id,
                name: tProject.name,
                organization: {
                    id:   organization.id,
                    name: organization.name,
                },
            }
            const pickedFields = dynamicPickPaths(availableFields, fields, ['id'])
            const projects = await ctx.conn.selectFrom(tProject)
                .optionalLeftOuterJoin(organization).on(organization.id.equals(tProject.organizationId))
                .select(pickedFields)
                .orderBy('id')
                .executeSelectMany()
            return expandTypeFromDynamicPickPaths(availableFields, fields, projects, ['id'])
        }

        ctx.mockNext([
            { id: 1, name: 'Marketing site', 'organization.name': 'Acme Corp' },
        ])
        const result = await getProjects(['name', 'organization.name'])

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, organization.name as "organization.name" from project left outer join organization as organization on organization.id = project.organization_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        // DeepPick<ProjectWithOrg, 'name' | 'organization.name' | 'id'>
        assertType<Extends<typeof result, Array<{ id: number; name: string; organization?: { name: string } }>>>()
    })

    // Field map that includes an optional column (tProject.archivedAt) so the
    // nullable projection is observable.
    const fieldsWithNullable = {
        id:         tProject.id,
        name:       tProject.name,
        archivedAt: tProject.archivedAt,
    }

    test('docs-extra:utility-dynamic-picks/pick-values-path-projected-as-nullable', () => {
        // The …ProjectedAsNullable sibling of PickValuesPath projects an
        // optional picked leaf as a present `T | null` instead of `?: T`.
        type ResultNullable = PickValuesPathProjectedAsNullable<typeof fieldsWithNullable, 'name' | 'archivedAt'>
        assertType<Exact<ResultNullable, { name: string; archivedAt: Date | null }>>()
        // Contrast with the non-nullable twin, where archivedAt stays optional.
        type ResultPlain = PickValuesPath<typeof fieldsWithNullable, 'name' | 'archivedAt'>
        assertType<Exact<ResultPlain, { name: string; archivedAt?: Date }>>()
    })

    test('docs-extra:utility-dynamic-picks/pick-values-path-with-all-properties-projected-as-nullable', () => {
        // The …WitAllPropertiesProjectedAsNullable sibling keeps the picked
        // leaf required; unpicked properties stay optional (`?:`) as in the
        // non-nullable twin, and the nullable projection additionally adds
        // `| null` to the VALUE of the originally-optional column (archivedAt).
        type ResultNullable = PickValuesPathWitAllPropertiesProjectedAsNullable<typeof fieldsWithNullable, 'name'>
        assertType<Exact<ResultNullable, { name: string; id?: number; archivedAt?: Date | null }>>()
    })

})

interface ProjectWithOrg {
    id:   number
    name: string
    organization?: { id: number; name: string }
}
