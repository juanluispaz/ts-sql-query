// Coverage of `.asString()` on a UUID value source — the only call
// site for the `_asString` emitter on every dialect's SqlBuilder. The
// existing `select.value-source.casts.test.ts` notes UUID is not in
// the seed schema and explicitly skips this surface; the per-dialect
// `_asString` paths are therefore unreached by the rest of the suite.
//
// Each dialect picks its own default `uuidStrategy` and emits a
// helper that the user's deployment is expected to provide:
//
//   - `uuid_str(uuid_blob(?))`        — sqlite default (`uuid-extension`)
//   - `($1)::text`                    — postgres (native uuid, no strategy)
//   - `bin_to_uuid(uuid_to_bin(?))`   — mysql default (`binary`)
//   - `?`                             — mariadb default (native UUID, no-op)
//   - `raw_to_uuid(hextoraw(:0))`     — oracle default (`built-in`)
//   - `?`                             — sqlserver (native uniqueidentifier)
//
// On SQL Server the emitter is a no-op bare parameter, so this test
// runs against the real DB. The strategy-switch tests in
// [config.uuid-strategy.test.ts](./config.uuid-strategy.test.ts) cover
// the executable `'string'` branch end-to-end.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

const UUID_VALUE = '123e4567-e89b-12d3-a456-426614174000'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('uuid-asString-on-const', async () => {
        // On SQL Server the UUID const + `.asString()` emits a bare
        // parameter (`@0`) — native `uniqueidentifier`, no helper needed
        // — so it runs end-to-end on the real DB.
        ctx.mockNext(UUID_VALUE)
        const connection = ctx.conn
        const result = await connection.selectFromNoTable()
            .selectOneColumn(connection.const(UUID_VALUE, 'uuid').asString())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select @0 as [result]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
        // SQL Server's native `uniqueidentifier` round-trips the value
        // upper-cased; the mock echoes the lower-case input verbatim.
        if (ctx.realDbEnabled) expect(result).toBe(UUID_VALUE.toUpperCase())
        else expect(result).toBe(UUID_VALUE)
    })
})
