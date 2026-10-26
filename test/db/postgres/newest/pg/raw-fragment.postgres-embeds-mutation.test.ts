// PostgreSQL-only: a data-modifying statement embedded through `rawFragment`.
// `rawFragment` accepts an executable INSERT / UPDATE / DELETE, rendered in
// place as a nested (non-root) statement — here an `INSERT … RETURNING` inside a
// `WITH`, which only PostgreSQL runs as a data-modifying CTE. The file name
// embeds `postgres`, which excludes it from the cross-dialect symmetry audit.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('insert-returning-embedded-as-a-data-modifying-cte', async () => {
        // The embedded INSERT keeps its own RETURNING clause; the outer select
        // reads the inserted row back from the CTE.
        const created = ctx.conn.insertInto(tOrganization)
            .set({ name: 'Initech', plan: 'free' })
            .returning({ name: tOrganization.name })

        const expected = 'Initech'
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const name = await ctx.conn.selectFromNoTable()
                .selectOneColumn(ctx.conn.fragmentWithType('string', 'required').sql`(select name from created)`)
                .customizeQuery({ beforeQuery: ctx.conn.rawFragment`with created as (${created})` })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"with created as (insert into organization (name, plan) values ($1, $2) returning name as name) select (select name from created) as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Initech",
                "free",
              ]
            `)
            assertType<Exact<typeof name, string>>()
            expect(name).toBe(expected)
        })
    })
})
