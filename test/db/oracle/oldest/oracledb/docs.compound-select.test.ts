// Documentation snippets for the page of the compound select (docs/queries/compound-select.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:compound-select/compound-operator', async () => {
        // Section "Select with a compound operator (union, intersect,
        // except)" — `unionAll` glues two compatible selects into one.
        // Real seed: 2 organizations + 4 projects = 6 rows.
        const expected = [
            { id: 1, name: 'Acme Corp',         kind: 'organization' as const },
            { id: 2, name: 'Globex Ltd',        kind: 'organization' as const },
            { id: 1, name: 'Marketing site',    kind: 'project'      as const },
            { id: 2, name: 'Internal tools',    kind: 'project'      as const },
            { id: 3, name: 'Public API',        kind: 'project'      as const },
            { id: 4, name: 'Legacy app',        kind: 'project'      as const },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const allNamed = await connection.selectFrom(tOrganization)
            .select({
                id:   tOrganization.id,
                name: tOrganization.name,
                kind: connection.const<'organization' | 'project'>('organization', 'enum', 'orgOrProject'),
            }).unionAll(
                connection.selectFrom(tProject)
                .select({
                    id:   tProject.id,
                    name: tProject.name,
                    kind: connection.const<'organization' | 'project'>('project', 'enum', 'orgOrProject'),
                }),
            ).executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", name as "name", :0 as "kind" from "organization" union all select id as "id", name as "name", :1 as "kind" from project"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "organization",
            "project",
          ]
        `)
        assertType<Exact<typeof allNamed, Array<{
            id:   number
            name: string
            kind: 'organization' | 'project'
        }>>>()
        expect(allNamed).toEqual(expected)
    })
})
