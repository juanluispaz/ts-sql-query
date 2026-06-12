// Coverage of `.asString()` on a UUID value source — the only call
// site for the `_asString` emitter on every dialect's SqlBuilder. The
// existing `select.value-source.casts.test.ts` notes UUID is not in
// the seed schema and explicitly skips this surface; the per-dialect
// `_asString` paths are therefore unreached by the rest of the suite.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

const UUID_VALUE = '123e4567-e89b-12d3-a456-426614174000'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('uuid-asString-on-const', async () => {
        ctx.mockNext(UUID_VALUE)
        const connection = ctx.conn
        const result = await connection.selectFromNoTable()
            .selectOneColumn(connection.const(UUID_VALUE, 'uuid').asString())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
        expect(result).toBe(UUID_VALUE)
    })
})
