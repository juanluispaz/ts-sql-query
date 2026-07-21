// Per-connection coverage of `MariaDBConnection.uuidStrategy`. MariaDB has
// two strategies; the shared test connection uses the library default
// `'uuid'` (exercised by the regular uuid tests). This file pins the NON-default
// branch:
//
//   - `'string'`: uuids are plain TEXT — `_asString` and the param/column
//     hooks return the underlying SQL unchanged (no uuid<->binary wrapping).
//
// `ctx.withUuidStrategy(...)` returns a `DBConnection` whose `uuidStrategy`
// is pinned to the requested value while sharing `ctx.conn`'s underlying
// `CaptureInterceptor` and driver. The test uses a uuid CONST through
// `.asString()` (not a stored column, which is binary under the default
// strategy and would not round-trip under `'string'`), so it stays
// universally executable.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

const UUID_VALUE = '123e4567-e89b-12d3-a456-426614174000'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('uuid-strategy: string is plain text for asString', async () => {
        const conn = ctx.withUuidStrategy('string')
        ctx.mockNext(UUID_VALUE)
        await conn.selectFromNoTable()
            .selectOneColumn(conn.const(UUID_VALUE, 'uuid').asString())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
    })
})
