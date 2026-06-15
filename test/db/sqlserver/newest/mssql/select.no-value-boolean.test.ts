// Coverage of `connection.noValueBoolean()`
// the neutral boolean mark the `ifValue` family returns when there is
// no value. Combined into an AND/OR chain it collapses away (the
// `__isAllowed === false` short-circuit in the boolean operators); used
// as the sole WHERE it produces no WHERE clause at all. Documented at
// docs/api/connection.md (`noValueBoolean(): BooleanValueSource`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('no-value-boolean-collapses-inside-an-and-chain', async () => {
        // `id = 1 AND <neutral>` keeps only the real predicate.
        const expectedMock = [{ id: 1, name: 'Acme Corp' }]
        ctx.mockNext(expectedMock)
        const connection = ctx.conn

        const rows = await connection.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1).and(connection.noValueBoolean()))
            .select({ id: tOrganization.id, name: tOrganization.name })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from organization where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expectedMock)
    })

    test('no-value-boolean-as-sole-where-emits-no-where-clause', async () => {
        // A WHERE made up entirely of the neutral mark emits no WHERE.
        const expectedMock = [{ id: 1, name: 'Acme Corp' }, { id: 2, name: 'Globex Ltd' }]
        ctx.mockNext(expectedMock)
        const connection = ctx.conn

        const rows = await connection.selectFrom(tOrganization)
            .where(connection.noValueBoolean())
            .select({ id: tOrganization.id, name: tOrganization.name })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from organization order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expectedMock)
    })
})
