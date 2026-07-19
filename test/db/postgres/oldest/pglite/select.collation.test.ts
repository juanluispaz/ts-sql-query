// Collation levers on cased data (the matrix's fixture data is caseless `@`,
// so these tests use explicit cased constants like 'ABCabc' to pin the new
// behaviour): `.collate()` (Fork A), `replaceAll`'s code-point default
// (Fork C — inert on PostgreSQL, whose REPLACE ignores collation), and
// `replaceAllInsensitive` (Fork D — regex `'gi'`, case-only on PostgreSQL).
// The emitted SQL matches the probed transcripts in
// test/SEMANTIC_AUDIT_COLLATION_REPORT.md. The test-name set is shared across
// every dialect cell; the ones a dialect cannot run are kept commented for
// symmetry with a NOT-APPLICABLE reason.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ── Fork A: .collate() ─────────────────────────────────────────────
    // PostgreSQL quotes the collation name (`collate "<name>"`); `"C"` is the
    // built-in code-point collation. PostgreSQL's default is already
    // case-sensitive, so forcing `"C"` keeps 'ABC' <> 'abc'.
    test('collate forces case-sensitive equality', async () => {
        const expected = [{ v: false }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABC', 'string').collate('C').equals('abc') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ($1 collate "C") = $2 as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABC",
            "abc",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: boolean }>>>()
        expect(result).toEqual(expected)
    })

    // PostgreSQL's per-value case-insensitive EQUALITY needs a NON-deterministic
    // collation object (the built-in collations are deterministic and byte-tiebreak
    // on equality); none is created in the test schema. Runs on the dialects with a
    // built-in CI collation. Kept commented for symmetry.
    // NOT-APPLICABLE: PostgreSQL per-value CI equality needs a non-deterministic collation.
    /*
    test('collate forces case-insensitive equality', async () => {
        // see the canonical body in sqlserver/newest/mssql
    })
    */

    test('collate is usable as a projected value', async () => {
        const expected = [{ v: 'ABCabc' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').collate('C') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 collate "C" as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABCabc",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })

    // ── Fork C: replaceAll ─────────────────────────────────────────────
    // PostgreSQL's REPLACE ignores collation, so it is byte-wise case-sensitive
    // and the plain native `replace(...)` is emitted. 'ABCabc' → 'ABCX'.
    test('replaceAll on cased data', async () => {
        const expected = [{ v: 'ABCX' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAll('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace($1, $2, $3) as "v""`)
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
    // collation (SQL Server, Oracle). PostgreSQL's REPLACE ignores collation, so
    // the config does not exist on this connection. Kept commented for symmetry.
    // NOT-APPLICABLE: `replaceCollation` is not offered where REPLACE ignores collation.
    /*
    test('replaceAll opt-out to native replace', async () => {
        // see the canonical body in sqlserver/newest/mssql
    })
    */

    // ── Fork D: replaceAllInsensitive ──────────────────────────────────
    // `regexp_replace(src, <esc from>, to, 'gi')` — the `'gi'` flag folds case
    // (only), replacing every match. 'ABCabc' → both 'ABC' and 'abc' → 'XX'.
    test('replaceAllInsensitive on cased data', async () => {
        const expected = [{ v: 'XX' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAllInsensitive('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select regexp_replace($1, $2, $3, 'gi') as "v""`)
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

    // PostgreSQL's `replaceAllInsensitive` is the fixed `regexp_replace(..., 'gi')`
    // case-only flag — it cannot honour a language `insensitiveCollation`. Runs on
    // the collation/regex-operand engines. Kept commented for symmetry.
    // NOT-APPLICABLE: PostgreSQL's `'gi'` regex flag cannot honour `insensitiveCollation`.
    /*
    test('replaceAllInsensitive honours insensitiveCollation', async () => {
        // see the canonical body in sqlserver/newest/mssql
    })
    */

    test('replaceAllInsensitive with a regex-metacharacter term', async () => {
        // The search term 'a.c' is regex-escaped to `a\.c`, so the literal dot
        // only matches 'a.c' and NOT 'aXc'. Without the escape the `.` would be
        // a wildcard and 'a.caXc' would collapse to 'ZZ'.
        const expected = [{ v: 'ZaXc' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('a.caXc', 'string').replaceAllInsensitive('a.c', 'Z') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select regexp_replace($1, $2, $3, 'gi') as "v""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select regexp_replace($1, $2, $3, 'gi') as "v""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 as "v""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(replace($1, $2, $3), $4, $5) as "v""`)
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
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAll('abc', 'X').collate('C') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace($1, $2, $3) collate "C" as "v""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select regexp_replace(replace($1, $2, $3), $4, $5, 'gi') as "v""`)
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
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAllInsensitive('qz', 'X').collate('C') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select regexp_replace($1, $2, $3, 'gi') collate "C" as "v""`)
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
