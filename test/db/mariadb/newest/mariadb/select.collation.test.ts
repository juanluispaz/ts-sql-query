// Collation levers on cased data (the matrix's fixture data is caseless `@`,
// so these tests use explicit cased constants like 'ABCabc' to pin the new
// behaviour): `.collate()` (Fork A), `replaceAll` (Fork C — inert on MariaDB,
// whose REPLACE ignores collation), and `replaceAllInsensitive` (Fork D —
// regex-driven via REGEXP_REPLACE, whose operand collation governs the fold).
// The emitted SQL matches the probed transcripts in
// test/SEMANTIC_AUDIT_COLLATION_REPORT.md. The test-name set is shared across
// every dialect cell; the ones a dialect cannot run are kept commented for
// symmetry.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

// insensitiveCollation forces a collation on the REGEXP_REPLACE operands.
class InsensitiveReplaceConnection extends DBConnection {
    protected override insensitiveCollation = 'utf8mb4_bin'
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ── Fork A: .collate() ─────────────────────────────────────────────
    // MariaDB's default collation is case- and accent-insensitive; forcing the
    // binary `utf8mb4_bin` makes 'ABC' <> 'abc'.
    test('collate forces case-sensitive equality', async () => {
        const expected = [{ v: false }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABC', 'string').collate('utf8mb4_bin').equals('abc') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (? collate utf8mb4_bin) = ? as \`v\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABC",
            "abc",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: boolean }>>>()
        expect(result).toEqual(expected)
    })

    // The default collation already folds case, but forcing an explicit CI name
    // keeps 'ABC' = 'abc' → true.
    test('collate forces case-insensitive equality', async () => {
        const expected = [{ v: true }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABC', 'string').collate('utf8mb4_general_ci').equals('abc') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (? collate utf8mb4_general_ci) = ? as \`v\`"`)
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
            .select({ v: ctx.conn.const('ABCabc', 'string').collate('utf8mb4_bin') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? collate utf8mb4_bin as \`v\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABCabc",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })

    // ── Fork C: replaceAll ─────────────────────────────────────────────
    // MariaDB's REPLACE ignores collation (byte-wise case-sensitive), so the plain
    // native `replace(...)` is emitted. 'ABCabc' → 'ABCX'.
    test('replaceAll on cased data', async () => {
        const expected = [{ v: 'ABCX' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAll('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(?, ?, ?) as \`v\`"`)
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

    // `replaceCollation` is only offered on the engines whose REPLACE honours
    // collation (SQL Server, Oracle). MariaDB's REPLACE ignores collation, so the
    // config does not exist on this connection. Kept commented for symmetry.
    // NOT-APPLICABLE: `replaceCollation` is not offered where REPLACE ignores collation.
    /*
    test('replaceAll opt-out to native replace', async () => {
        // see the canonical body in sqlserver/newest/mssql
    })
    */

    // ── Fork D: replaceAllInsensitive ──────────────────────────────────
    // REGEXP_REPLACE folds under the default (case-insensitive) collation, so
    // both 'ABC' and 'abc' are replaced → 'XX'.
    test('replaceAllInsensitive on cased data', async () => {
        const expected = [{ v: 'XX' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAllInsensitive('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select regexp_replace(?, ?, ?) as \`v\`"`)
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

    // insensitiveCollation forces the collation on the REGEXP_REPLACE operands;
    // a binary collation makes it case-sensitive again → 'ABCX'.
    test('replaceAllInsensitive honours insensitiveCollation', async () => {
        const collated = new InsensitiveReplaceConnection(ctx.conn.queryRunner)
        const expected = [{ v: 'ABCX' }]
        ctx.mockNext(expected)
        const result = await collated.selectFromNoTable()
            .select({ v: collated.const('ABCabc', 'string').replaceAllInsensitive('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select regexp_replace(? collate utf8mb4_bin, ? collate utf8mb4_bin, ?) as \`v\`"`)
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

    test('replaceAllInsensitive with a regex-metacharacter term', async () => {
        // 'a.c' is regex-escaped to `a\.c`, so the literal dot only matches 'a.c'
        // and NOT 'aXc'. Without the escape 'a.caXc' would collapse to 'ZZ'.
        const expected = [{ v: 'ZaXc' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('a.caXc', 'string').replaceAllInsensitive('a.c', 'Z') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select regexp_replace(?, ?, ?) as \`v\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a.caXc",
            "a\\.c",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select regexp_replace(?, ?, ?) as \`v\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "XmasXmas",
            "mas",
            "a\\\\1$0b",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as \`v\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABCabc",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })

    // ── C2: chained replace nests without an extra parenthesis ─────────
    // This dialect's `replaceAll`/`replaceAllInsensitive` emit a bare replace with no
    // trailing collation reset, so a chained replace simply nests — the source needs
    // no wrapping (the parenthesisation guard is specific to the collation-reset
    // engines whose result carries a trailing `collate`).
    test('chained replaceAll parenthesises the inner replace', async () => {
        const expected = [{ v: 'YCX' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAll('abc', 'X').replaceAll('AB', 'Y') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(replace(?, ?, ?), ?, ?) as \`v\`"`)
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
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAll('abc', 'X').collate('utf8mb4_bin') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(?, ?, ?) collate utf8mb4_bin as \`v\`"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select regexp_replace(replace(?, ?, ?), ?, ?) as \`v\`"`)
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
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAllInsensitive('qz', 'X').collate('utf8mb4_bin') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select regexp_replace(?, ?, ?) collate utf8mb4_bin as \`v\`"`)
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
