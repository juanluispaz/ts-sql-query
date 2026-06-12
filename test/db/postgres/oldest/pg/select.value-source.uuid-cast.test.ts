// Coverage of `.asString()` on a UUID value source. PostgreSQL has a
// native `uuid` type with no strategy helper, so the cast renders as
// `$1::text` and runs against the real engine without any extension —
// the param binds as a uuid and comes back as its canonical string.

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1::text as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
        expect(result).toBe(UUID_VALUE)
    })
})
