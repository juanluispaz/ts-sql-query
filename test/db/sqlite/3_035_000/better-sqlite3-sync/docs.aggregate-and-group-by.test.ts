// Documentation snippets for the Aggregate and group by page (docs/queries/aggregate-and-group-by.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:aggregate-and-group-by/group-by-expressions', async () => {
        // Section "Select with aggregate functions and group by" — count
        // children of a parent grouped by parent columns.
        const expected = [
            { organizationId: 1, organizationName: 'Acme Corp', projectCount: 2 },
            { organizationId: 2, organizationName: 'Globex Ltd',    projectCount: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectCountPerOrganization = sync(connection.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .groupBy(tOrganization.id, tOrganization.name)
            .select({
                organizationId:   tOrganization.id,
                organizationName: tOrganization.name,
                projectCount:     connection.count(tProject.id),
            })
            .orderBy('organizationId')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as organizationId, organization.name as organizationName, count(project.id) as projectCount from organization inner join project on project.organization_id = organization.id group by organization.id, organization.name order by organizationId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectCountPerOrganization, Array<{
            organizationId:   number
            organizationName: string
            projectCount:     number
        }>>>()
        expect(projectCountPerOrganization).toEqual(expected)
    })
})
