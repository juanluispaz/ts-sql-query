// Documentation snippets for the SQL fragments page
// (docs/queries/sql-fragments.md).
//
// Fragments embed raw SQL inside a typed expression tree. The example
// below uses `length(...)` — present in every supported dialect — as the
// raw piece so the snippet stays portable between cells.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:sql-fragments/fragment-with-type', async () => {
        const expected = [{ id: 1, idDoubled: 2 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const rows = await connection.selectFrom(tAppUser)
            .where(tAppUser.email.equals('ada@acme.test'))
            .select({
                id:             tAppUser.id,
                idDoubled: connection
                    .fragmentWithType('int', 'required')
                    .sql`abs(${tAppUser.id} + ${tAppUser.id})`,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, abs(id + id) as "idDoubled" from app_user where email = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ada@acme.test",
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:             number
            idDoubled:      number
        }>>>()
        expect(rows).toEqual(expected)
    })

    /*
     * TODO: `buildFragmentWithArgs` and `arg` are `protected` on
     * AbstractConnection — they are meant to be called from inside a
     * DBConnection subclass to expose typed helpers as methods/fields on
     * the connection. We will reintroduce this test when the shared
     * domain DBConnection grows a real helper that demonstrates the
     * pattern. Leaving the slot here for symmetry once that lands.
     *
     * test('docs:sql-fragments/build-fragment-with-args', async () => { ... })
     */
})
