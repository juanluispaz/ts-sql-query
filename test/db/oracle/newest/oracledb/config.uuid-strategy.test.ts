// Per-connection coverage of `OracleConnection.uuidStrategy`. Oracle has
// three strategies; the shared test connection uses the library default
// `'built-in'` (exercised by the regular uuid tests, which emit
// `raw_to_uuid(uuid_to_raw(...))`). This file pins the two NON-default
// branches:
//
//   - `'string'`: uuids are plain TEXT — `_asString` and the param/column
//     hooks return the underlying SQL unchanged (no `raw_to_uuid` /
//     `uuid_to_raw` wrapping).
//   - `'custom-functions'`: identical EMITTED SQL to `'built-in'` (both go
//     through `_uuidUsesRawFunctions()`), so it wraps with the same
//     `raw_to_uuid` / `uuid_to_raw` user-defined functions — this pins that
//     the `custom-functions` arm routes through the raw-function path (vs the
//     plain-text `'string'` arm above).
//
// `ctx.withUuidStrategy(...)` returns a `DBConnection` whose `uuidStrategy`
// is pinned to the requested value while sharing `ctx.conn`'s underlying
// `CaptureInterceptor` and driver. Tests use a uuid CONST through
// `.asString()` (not a stored column, which is RAW(16) under the default
// strategy and would not round-trip under `'string'`), so they stay
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
    })

    test('uuid-strategy: custom-functions wraps asString in raw_to_uuid/uuid_to_raw', async () => {
        const conn = ctx.withUuidStrategy('custom-functions')
        ctx.mockNext(UUID_VALUE)
        await conn.selectFromNoTable()
            .selectOneColumn(conn.const(UUID_VALUE, 'uuid').asString())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select raw_to_uuid(uuid_to_raw(:0)) as "result" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
    })
})
