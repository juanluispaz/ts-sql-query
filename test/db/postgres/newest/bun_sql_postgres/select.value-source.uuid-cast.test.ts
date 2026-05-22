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
// Per [DESIGN.md §1 #18](../../../../DESIGN.md#1-principles) and the
// "synthetic SQL is the test's whole point" exception, this test is
// **mock-only**: real-DB execution requires extensions / engine
// versions that vary per test connector (sqlite's `uuid` extension,
// MySQL 8.0+, Oracle 12c+) and the assertion of interest is the
// SqlBuilder shape, not engine execution. The strategy-switch tests
// in [config.uuid-strategy.test.ts](./config.uuid-strategy.test.ts)
// cover the executable `'string'` branch end-to-end.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

const UUID_VALUE = '123e4567-e89b-12d3-a456-426614174000'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('uuid-asString-on-const', async () => {
        // Mock-only — see file header.
        if (ctx.realDbEnabled) return
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
