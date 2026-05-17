// Documentation snippets for the Utility for dynamic picks page
// (docs/advanced/utility-dynamic-picks.md). Demonstrates the typing
// helpers around dynamicPick/dynamicPickPaths and the runtime
// `expandTypeFromDynamicPickPaths` companion.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact, type Extends } from '../../../../lib/assertType.js'
import {
    dynamicPickPaths,
    expandTypeFromDynamicPickPaths,
    type DynamicPickPaths,
    type PickValuesPath,
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

    test('DynamicPickPaths/type', () => {
        type Paths = DynamicPickPaths<typeof availableFields>
        // All three top-level paths are exposed by the helper.
        assertType<Exact<Paths, 'id' | 'name' | 'slug'>>()
    })

    test('PickValuesPath/type', () => {
        type Result = PickValuesPath<typeof availableFields, 'id' | 'name'>
        // Only the picked fields appear in the result, as required.
        assertType<Exact<Result, { id: number; name: string }>>()
    })

    test('typed-helper/business-type-pattern', async () => {
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
        ])
        const result = await getProjects(['name'])

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\` from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        // Pick<ProjectInformation, 'name' | 'id'> → { id, name }, both required.
        assertType<Extends<typeof result, Array<{ id: number; name: string }>>>()
        if (!ctx.realDbEnabled) {
            expect(result).toEqual([
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ])
        }
    })
})
