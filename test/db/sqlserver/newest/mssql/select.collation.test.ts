// Collation levers on cased data (the matrix's fixture data is caseless `@`,
// so these tests use explicit cased constants like 'ABCabc' to pin the new
// behaviour): `.collate()` (Fork A), `replaceAll`'s code-point default
// (Fork C — SQL Server's REPLACE honours the collation, so the default `_CI`
// collation would corrupt the value without it), and `replaceAllInsensitive`
// (Fork D — collation-driven). The emitted SQL matches the probed transcripts
// in test/SEMANTIC_AUDIT_COLLATION_REPORT.md. The test-name set is shared
// across every dialect cell.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

// SQL Server has no `replaceCollation` context helper, so pin the config inline
// (the sanctioned `EmptyStringConnection` pattern from select.string-ops).
class ReplaceCollationOptOutConnection extends DBConnection {
    protected override replaceCollation = ''
}
class InsensitiveReplaceConnection extends DBConnection {
    protected override insensitiveCollation = 'Latin1_General_CI_AI'
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ── Fork A: .collate() ─────────────────────────────────────────────
    // `Latin1_General_BIN2` is a binary/code-point collation: forcing it makes
    // 'ABC' <> 'abc' even though SQL Server's default collation is CI.
    test('collate forces case-sensitive equality', async () => {
        const expected = [{ v: false }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABC', 'string').collate('Latin1_General_BIN2').equals('abc') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(case when (@0 collate Latin1_General_BIN2) = @1 then 1 else 0 end as bit) as [v]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABC",
            "abc",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: boolean }>>>()
        expect(result).toEqual(expected)
    })

    // A case-insensitive collation forces the fold in the other direction:
    // 'ABC' collate Latin1_General_CI_AS = 'abc' → true.
    test('collate forces case-insensitive equality', async () => {
        const expected = [{ v: true }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABC', 'string').collate('Latin1_General_CI_AS').equals('abc') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(case when (@0 collate Latin1_General_CI_AS) = @1 then 1 else 0 end as bit) as [v]"`)
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
            .select({ v: ctx.conn.const('ABCabc', 'string').collate('Latin1_General_BIN2') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select @0 collate Latin1_General_BIN2 as [v]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABCabc",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })

    // ── Fork C: replaceAll (default code-point) ────────────────────────
    // By default `replaceCollation` pins `Latin1_General_BIN2` on the match
    // operands and resets the result to DATABASE_DEFAULT, so `replaceAll` is
    // case-sensitive even on the CI database: 'ABCabc' → 'ABCX'.
    test('replaceAll on cased data', async () => {
        const expected = [{ v: 'ABCX' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAll('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(@0 collate Latin1_General_BIN2, @1 collate Latin1_General_BIN2, @2) collate DATABASE_DEFAULT as [v]"`)
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

    // `replaceCollation = ''` opts out to the bare native `replace(...)`, which
    // follows the CI database collation and folds BOTH cases — corrupting the
    // value to 'XX'. This is exactly what the default prevents.
    test('replaceAll opt-out to native replace', async () => {
        const opted = new ReplaceCollationOptOutConnection(ctx.conn.queryRunner)
        const expected = [{ v: 'XX' }]
        ctx.mockNext(expected)
        const result = await opted.selectFromNoTable()
            .select({ v: opted.const('ABCabc', 'string').replaceAll('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(@0, @1, @2) as [v]"`)
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
    // With no `insensitiveCollation`, SQL Server emits the bare `replace(...)`
    // and leans on the CI database default, folding both cases → 'XX'.
    test('replaceAllInsensitive on cased data', async () => {
        const expected = [{ v: 'XX' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAllInsensitive('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(@0, @1, @2) as [v]"`)
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

    // With `insensitiveCollation` set, it is forced on the match operands and the
    // result reset to DATABASE_DEFAULT (a `_CI_AI` name also folds accents).
    // 'ABCabc' still folds to 'XX'; the point is the emitted `collate` clauses.
    test('replaceAllInsensitive honours insensitiveCollation', async () => {
        const collated = new InsensitiveReplaceConnection(ctx.conn.queryRunner)
        const expected = [{ v: 'XX' }]
        ctx.mockNext(expected)
        const result = await collated.selectFromNoTable()
            .select({ v: collated.const('ABCabc', 'string').replaceAllInsensitive('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(@0 collate Latin1_General_CI_AI, @1 collate Latin1_General_CI_AI, @2) collate DATABASE_DEFAULT as [v]"`)
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

    // SQL Server's REPLACE matches literally (not a regex), so a dot in the
    // search term only matches 'a.c' → 'ZaXc'.
    test('replaceAllInsensitive with a regex-metacharacter term', async () => {
        const expected = [{ v: 'ZaXc' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('a.caXc', 'string').replaceAllInsensitive('a.c', 'Z') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(@0, @1, @2) as [v]"`)
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

    test('replaceAllInsensitive escapes a regex-metacharacter replacement', async () => {
        // The replacement is treated LITERALLY (like `replaceAll` / JS String.replaceAll), even
        // though it contains regex-substitution metacharacters: `\1` (a backreference shape) and
        // `$0` (a group-reference shape). The library escapes them wherever the engine would
        // otherwise interpret them, so every 'mas' becomes the literal 'a\1$0b'.
        const expected = [{ v: 'Xa\\1$0bXa\\1$0b' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('XmasXmas', 'string').replaceAllInsensitive('mas', 'a\\1$0b') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(@0, @1, @2) as [v]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "XmasXmas",
            "mas",
            "a\\1$0b",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select @0 as [v]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABCabc",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })

    // ── C2: chained replace parenthesises the inner result ─────────────
    // When a collation is forced, `replaceAll`/`replaceAllInsensitive` append a
    // trailing `collate <reset>` to their result. That trailing `collate` binds
    // looser than an embedding operator (and than an outer replace's own forced
    // collation), so a chained replace must parenthesise the inner result: without
    // the wrap, two adjacent `collate` clauses would be emitted and the engine would
    // reject the statement.
    test('chained replaceAll parenthesises the inner replace', async () => {
        const expected = [{ v: 'YCX' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAll('abc', 'X').replaceAll('AB', 'Y') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace((replace(@0 collate Latin1_General_BIN2, @1 collate Latin1_General_BIN2, @2) collate DATABASE_DEFAULT) collate Latin1_General_BIN2, @3 collate Latin1_General_BIN2, @4) collate DATABASE_DEFAULT as [v]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABCabc",
            "abc",
            "X",
            "AB",
            "Y",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })

    test('replaceAll then collate parenthesises the inner replace', async () => {
        const expected = [{ v: 'ABCX' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAll('abc', 'X').collate('Latin1_General_BIN2') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (replace(@0 collate Latin1_General_BIN2, @1 collate Latin1_General_BIN2, @2) collate DATABASE_DEFAULT) collate Latin1_General_BIN2 as [v]"`)
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

    test('replaceAll then replaceAllInsensitive parenthesises the inner replace', async () => {
        const expected = [{ v: 'ABCX' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAll('abc', 'X').replaceAllInsensitive('qz', 'Y') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(replace(@0 collate Latin1_General_BIN2, @1 collate Latin1_General_BIN2, @2) collate DATABASE_DEFAULT, @3, @4) as [v]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABCabc",
            "abc",
            "X",
            "qz",
            "Y",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })

    test('replaceAllInsensitive then collate parenthesises the inner replace', async () => {
        const expected = [{ v: 'ABCabc' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAllInsensitive('qz', 'X').collate('Latin1_General_BIN2') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (replace(@0, @1, @2)) collate Latin1_General_BIN2 as [v]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABCabc",
            "qz",
            "X",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })

})
