// An optional join is written when the query only uses its table in the order by.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('optional-join-used-only-in-the-order-by-is-written', async () => {
        const org = tOrganization.as('org')
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .optionalInnerJoin(org).on(org.id.equals(tProject.organizationId))
            .where(tProject.id.in([1, 2]))
            .select({ id: tProject.id })
            .orderBy(org.name)
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "id" from project inner join "organization" org on org.id = project.organization_id where project.id in (:0, :1) order by org.name, "id""`)
        expect(rows.map(row => row.id).sort()).toEqual([1, 2])
    })

    test('optional-join-not-used-is-left-out-with-an-order-by', async () => {
        const org = tOrganization.as('org')
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .optionalInnerJoin(org).on(org.id.equals(tProject.organizationId))
            .where(tProject.id.equals(1))
            .select({ id: tProject.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from project where id = :0 order by "id""`)
        expect(rows).toEqual(expected)
    })
})
