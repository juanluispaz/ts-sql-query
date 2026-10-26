// UPDATE fed a payload object WIDER than the table: properties that are not
// columns are skipped when the SET clause is built, so a caller can hand a
// request body straight to `set(...)`.
//
// The extra property has to survive TypeScript's excess-property check, which
// fires only on FRESH object literals — hence the payload is a named `const`
// whose inferred type carries the surplus key, as a real caller's
// `const body = req.body` would.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('non-literal-set-payload-skips-keys-that-are-not-columns', async () => {
        // `csrfToken` is not a column of `project`: only `name` reaches the SET
        // list. The follow-up select reads the renamed project 1 back.
        const body = { name: 'Marketing website', csrfToken: 'token-from-the-request-body' }

        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const affected = await ctx.conn.update(tProject)
                .set(body)
                .where(tProject.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = :0 where id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing website",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)

            const expected = { id: 1, name: 'Marketing website' }
            ctx.mockNext(expected)
            const row = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({ id: tProject.id, name: tProject.name })
                .executeSelectOne()
            expect(row).toEqual(expected)
        })
    })
})
