// Documentation snippets for the Utility for dynamic picks page
// (docs/advanced/utility-dynamic-picks.md). Demonstrates the typing
// helpers around dynamicPick/dynamicPickPaths and the runtime
// `expandTypeFromDynamicPickPaths` companion.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact, type Extends } from '../../../../lib/assertType.js'
import {
    dynamicPick,
    dynamicPickPaths,
    expandTypeFromDynamicPickPaths,
    type DynamicPick,
    type DynamicPickPaths,
    type PickValuesPath,
    type PickValuesPathWitAllProperties,
} from '../../../../../src/dynamicCondition.js'
import { tProject } from '../../domain/connection.js'
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
            // The lib's expandTypeFromDynamicPickPaths inferred shape uses
            // its internal `MandatoryValuesKeysForPickResult` helper which
            // isn't assignable to the user's `Pick<...>` without a cast —
            // documented limitation when piping through user types.
            return expandTypeFromDynamicPickPaths(availableFields, fields, projects) as Pick<ProjectInformation, FIELDS | 'id'>[]
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
})
