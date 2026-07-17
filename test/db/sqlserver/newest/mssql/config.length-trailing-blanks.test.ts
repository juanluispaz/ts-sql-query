// Per-connection coverage of SqlServerConnection's `excludeTrailingBlanksInLength`
// flag — SQL-Server-only.
//
// `.length()` mirrors JS `String.length` (counts trailing blanks); T-SQL's
// `len()` excludes them. The default `false` bridges the gap with the sentinel
// `len(<x> + '.') - 1`, which counts them and is character-correct except for a
// value exactly at its column's declared maximum. Setting
// `excludeTrailingBlanksInLength = true` drops the sentinel for the bare native
// `len(<x>)`: trailing blanks are excluded again (T-SQL's native semantics) and
// the max-length edge disappears. This file pins the `true` branch and contrasts
// it against the default on the same string.
//
// A subclass of `DBConnection` flips the protected flag while sharing
// `ctx.conn`'s underlying CaptureInterceptor, so the emitted SQL is captured in
// `ctx.lastSql` and runs against the real engine.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

class ExcludeTrailingBlanksConnection extends DBConnection {
    protected override excludeTrailingBlanksInLength = true
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('exclude-trailing-blanks: emits the bare native len(x) and drops the trailing blanks', async () => {
        // With the flag on, `.length()` drops the sentinel: `'Draft  '` (7 chars,
        // two trailing blanks) reports T-SQL's native `len('Draft  ')` = 5.
        const conn = new ExcludeTrailingBlanksConnection(ctx.conn.queryRunner)
        const expected = [{ len: 5 }]
        ctx.mockNext(expected)
        const result = await conn.selectFromNoTable()
            .select({ len: conn.const('Draft  ', 'string').length() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select len(@0) as len"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Draft  ",
          ]
        `)
        assertType<Exact<typeof result, Array<{ len: number }>>>()
        expect(result).toEqual(expected)
    })

    test('exclude-trailing-blanks: default connection keeps the sentinel and counts trailing blanks (contrast)', async () => {
        // Same string through the default `ctx.conn` (flag `false`): the sentinel
        // `len(@0 + '.') - 1` counts the trailing blanks, so `'Draft  '` = 7.
        const expected = [{ len: 7 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ len: ctx.conn.const('Draft  ', 'string').length() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select len(@0 + '.') - 1 as len"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Draft  ",
          ]
        `)
        assertType<Exact<typeof result, Array<{ len: number }>>>()
        expect(result).toEqual(expected)
    })
})
