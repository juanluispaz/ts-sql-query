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
// This test asserts the `bin_to_uuid(uuid_to_bin(?))` shape AND that
// the value round-trips. MySQL 8.0+ provides `bin_to_uuid`/`uuid_to_bin`
// natively, so it runs end-to-end against the real engine and `result`
// comes back equal to the input UUID. The strategy-switch tests in
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
        // Runs end-to-end here — see file header.
        ctx.mockNext(UUID_VALUE)
        // Opt into the `'binary'` uuid strategy explicitly so this test
        // keeps asserting the `bin_to_uuid(uuid_to_bin(?))` shape.
        const connection = ctx.withUuidStrategy('binary')
        const result = await connection.selectFromNoTable()
            .selectOneColumn(connection.const(UUID_VALUE, 'uuid').asString())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select bin_to_uuid(uuid_to_bin(?)) as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
        expect(result).toBe(UUID_VALUE)
    })
})
