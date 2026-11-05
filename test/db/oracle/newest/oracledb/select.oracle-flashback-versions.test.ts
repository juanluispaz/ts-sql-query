// A flashback version query read through a table customization. The row was
// inserted once and never changed, so it has exactly one version however long the
// undo of the table is kept.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tServicePlan } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('versions-between-returns-the-only-version-of-a-row-never-updated', async () => {
        const expected = [{ id: 1, name: 'Enterprise' }]
        ctx.mockNext(expected)

        const planVersions = ctx.conn.allVersions(tServicePlan, 'planVersions')

        const result = await ctx.conn.selectFrom(planVersions)
            .where(planVersions.id.equals(1))
            .select({
                id:          planVersions.id,
                name:        planVersions.name,
                description: planVersions.description,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", name as "name", description as "description" from service_plan versions between timestamp minvalue and maxvalue  where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:           number
            name:         string
            description?: string
        }>>>()
        expect(result).toEqual(expected)
    })
})
