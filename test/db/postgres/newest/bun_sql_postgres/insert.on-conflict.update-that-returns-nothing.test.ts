// The update of a conflict can leave the row as it is: then there is no id to return.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('returning-last-inserted-id-is-null-when-the-where-of-the-update-is-not-met', async () => {
        ctx.mockNext(null)
        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tProject)
                .set({ organizationId: 1, slug: 'mktg-site', name: 'x' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'z' })
                .where(tProject.id.equals(-1))
                .returningLastInsertedId()
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4 where project.id = $5 returning id"`)
            expect(id).toBe(null)
            assertType<Exact<typeof id, number | null>>()
        })
    })
})
