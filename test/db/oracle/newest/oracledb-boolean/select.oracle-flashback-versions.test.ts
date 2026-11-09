// A flashback version query read through a table customization. How many versions a
// row has depends on the reseeds the undo still holds, all with the same values, so
// the select is distinct.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tServicePlan } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('versions-between-reads-a-row-across-reseeds', async () => {
        const expected = [{ id: 1, name: 'Enterprise' }]
        ctx.mockNext(expected)

        await ctx.reseed()
        await ctx.reseed()

        const planVersions = ctx.conn.allVersions(tServicePlan, 'planVersions')

        const result = await ctx.conn.selectDistinctFrom(planVersions)
            .where(planVersions.id.equals(1))
            .select({
                id:          planVersions.id,
                name:        planVersions.name,
                description: planVersions.description,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select distinct id as "id", name as "name", description as "description" from service_plan versions between timestamp minvalue and maxvalue  where id = :0"`)
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
