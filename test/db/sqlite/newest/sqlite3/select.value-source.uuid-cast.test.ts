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
// On sqlite this asserts the `uuid_str(uuid_blob(?))` shape and that
// the value round-trips. The connectors that provide the `uuid`
// extension functions run it end-to-end (bun:sqlite built-in;
// better-sqlite3 / node:sqlite / sqlite-wasm-OO1 register them in the
// test harness — see test/db/sqlite/runners.ts). The `sqlite3` (npm)
// connector has no user-function API, so it can never provide them:
// here the test is kept mock-only (guarded by `ctx.realDbEnabled`) —
// real execution is not applicable on this connector, but the
// SqlBuilder shape is still asserted in mock. Per
// [DESIGN.md §1 #18](../../../../DESIGN.md#1-principles).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

const UUID_VALUE = '123e4567-e89b-12d3-a456-426614174000'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: the `sqlite3` (npm) connector has no user-defined-function API, so the `uuid_str` / `uuid_blob` extension functions can't be registered; this round-trip runs end-to-end on the connectors that can (bun:sqlite built-in; better-sqlite3 / node:sqlite / sqlite-wasm-OO1 register them — see test/db/sqlite/runners.ts). Kept mock-only here so the SqlBuilder shape is still asserted.
    test('uuid-asString-on-const', async () => {
        if (ctx.realDbEnabled) return
        ctx.mockNext(UUID_VALUE)
        // The shared test connection now defaults to the `'string'` uuid
        // strategy; opt back into `'uuid-extension'` explicitly so this
        // test keeps asserting the binary `uuid_str(uuid_blob(?))` shape.
        const connection = ctx.withUuidStrategy('uuid-extension')
        const result = await connection.selectFromNoTable()
            .selectOneColumn(connection.const(UUID_VALUE, 'uuid').asString())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select uuid_str(uuid_blob(?)) as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "123e4567-e89b-12d3-a456-426614174000",
          ]
        `)
        expect(result).toBe(UUID_VALUE)
    })
})
