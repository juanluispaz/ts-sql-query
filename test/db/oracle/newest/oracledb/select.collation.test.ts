// Collation levers on cased data (the matrix's fixture data is caseless `@`,
// so these tests use explicit cased constants like 'ABCabc' to pin the new
// behaviour): `.collate()` (Fork A), `replaceAll`'s code-point default
// (Fork C — Oracle's REPLACE honours the session collation, corrupting only
// when the session is configured CI), and `replaceAllInsensitive` (Fork D —
// collation-driven, forcing Oracle's neutral BINARY_CI when unconfigured).
// The emitted SQL matches the probed transcripts in
// test/SEMANTIC_AUDIT_COLLATION_REPORT.md. The test-name set is shared across
// every dialect cell.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

class ReplaceCollationOptOutConnection extends DBConnection {
    protected override replaceCollation = ''
}
class InsensitiveReplaceConnection extends DBConnection {
    protected override insensitiveCollation = 'BINARY_AI'
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ── Fork A: .collate() ─────────────────────────────────────────────
    test('collate forces case-sensitive equality', async () => {
        const expected = [{ v: false }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABC', 'string').collate('BINARY').equals('abc') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when (:0 collate BINARY) = :1 then 1 else 0 end as "v" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABC",
            "abc",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('collate forces case-insensitive equality', async () => {
        const expected = [{ v: true }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABC', 'string').collate('BINARY_CI').equals('abc') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when (:0 collate BINARY_CI) = :1 then 1 else 0 end as "v" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABC",
            "abc",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('collate is usable as a projected value', async () => {
        const expected = [{ v: 'ABCabc' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').collate('BINARY') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 collate BINARY as "v" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABCabc",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })

    // ── Fork C: replaceAll (default code-point) ────────────────────────
    // `replaceCollation` defaults to `BINARY`, pinned on the match operands with
    // a USING_NLS_COMP reset, so `replaceAll` is code-point exact whatever the
    // session collation. 'ABCabc' → 'ABCX'.
    test('replaceAll on cased data', async () => {
        const expected = [{ v: 'ABCX' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAll('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(:0 collate BINARY, :1 collate BINARY, :2) collate USING_NLS_COMP as "v" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABCabc",
            "abc",
            "X",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })

    // `replaceCollation = ''` opts out to the bare native `replace(...)`. Oracle's
    // default session collation is case-sensitive (BINARY), so this stays 'ABCX'
    // here — it corrupts only when the session is configured CI.
    test('replaceAll opt-out to native replace', async () => {
        const opted = new ReplaceCollationOptOutConnection(ctx.conn.queryRunner)
        const expected = [{ v: 'ABCX' }]
        ctx.mockNext(expected)
        const result = await opted.selectFromNoTable()
            .select({ v: opted.const('ABCabc', 'string').replaceAll('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(:0, :1, :2) as "v" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABCabc",
            "abc",
            "X",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })

    // ── Fork D: replaceAllInsensitive ──────────────────────────────────
    // Oracle's default is case-sensitive, so with no `insensitiveCollation` the
    // library forces Oracle's neutral BINARY_CI (+ USING_NLS_COMP reset) to make
    // the replace fold case. 'ABCabc' → 'XX'.
    test('replaceAllInsensitive on cased data', async () => {
        const expected = [{ v: 'XX' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAllInsensitive('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(:0 collate BINARY_CI, :1 collate BINARY_CI, :2) collate USING_NLS_COMP as "v" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABCabc",
            "abc",
            "X",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })

    // With `insensitiveCollation` set, it is forced on the match operands instead
    // of BINARY_CI; a `_AI` name also folds accents. 'ABCabc' → 'XX'.
    test('replaceAllInsensitive honours insensitiveCollation', async () => {
        const collated = new InsensitiveReplaceConnection(ctx.conn.queryRunner)
        const expected = [{ v: 'XX' }]
        ctx.mockNext(expected)
        const result = await collated.selectFromNoTable()
            .select({ v: collated.const('ABCabc', 'string').replaceAllInsensitive('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(:0 collate BINARY_AI, :1 collate BINARY_AI, :2) collate USING_NLS_COMP as "v" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABCabc",
            "abc",
            "X",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })

    // Oracle's REPLACE matches literally (not a regex), so a dot in the search
    // term only matches 'a.c' → 'ZaXc'.
    test('replaceAllInsensitive with a regex-metacharacter term', async () => {
        const expected = [{ v: 'ZaXc' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('a.caXc', 'string').replaceAllInsensitive('a.c', 'Z') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(:0 collate BINARY_CI, :1 collate BINARY_CI, :2) collate USING_NLS_COMP as "v" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a.caXc",
            "a.c",
            "Z",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })

    test('replaceAllInsensitiveIfValue elides the transform when an argument is absent', async () => {
        const missing: string | undefined = undefined
        const expected = [{ v: 'ABCabc' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAllInsensitiveIfValue(missing, 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "v" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABCabc",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })
})
