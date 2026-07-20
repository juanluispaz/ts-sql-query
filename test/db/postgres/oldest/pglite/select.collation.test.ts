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
import { tAppUser, tIssue } from '../../domain/connection.js'

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

    // PostgreSQL's per-value case-insensitive EQUALITY needs a NON-deterministic collation
    // object; the domain schema registers `case_insensitive` (ICU `und-u-ks-level2`) and real
    // PostgreSQL folds case with it, but pglite's bundled ICU creates the collation yet does NOT
    // fold it ('ABC' = 'abc' -> false), so this cell cannot demonstrate the fold.
    // NOT-APPLICABLE: pglite's bundled ICU does not case-fold a non-deterministic collation.
    /*
    test('collate forces case-insensitive equality', async () => {
        // see the canonical body in postgres/newest/pg
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

    // ── uuid receivers ────────────────────────────────────────────────
    // `uuid.asString().replaceAll(...)` / `.replaceAllInsensitive(...)` must produce valid SQL
    // and round-trip on every dialect — replacing the whole uuid by itself yields 'X'. SQL
    // Server needs an explicit convert-before-collate for a uuid receiver/operand; this dialect
    // needs no special handling.
    test('replaceAll on a uuid receiver converts before collate', async () => {
        const s = tIssue.externalRef.asString()
        const expected = [{ id: 1, v: 'X' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, v: s.replaceAll(s, 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, replace(external_ref::text, external_ref::text, $1) as "v" from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "X",
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v?: string }>>>()
        expect(result).toEqual(expected)
    })
    test('replaceAllInsensitive on a uuid receiver converts before collate', async () => {
        const s = tIssue.externalRef.asString()
        const expected = [{ id: 1, v: 'X' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, v: s.replaceAllInsensitive(s, 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, regexp_replace(external_ref::text, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(external_ref::text, '\\', '\\\\'), '.', '\\.'), '*', '\\*'), '+', '\\+'), '?', '\\?'), '^', '\\^'), '$', '\\$'), '{', '\\{'), '}', '\\}'), '(', '\\('), ')', '\\)'), '|', '\\|'), '[', '\\['), ']', '\\]'), $1, 'gi') as "v" from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "X",
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v?: string }>>>()
        expect(result).toEqual(expected)
    })

    // `replaceAll` with a value-source uuid REPLACEMENT (`value2`, the 3rd arg): replacing the whole
    // uuid string by itself is the identity, so the value round-trips as the stored uuid (rendered per
    // this dialect's `asString()`). The forced-collation engines convert the receiver/find before the
    // collate but leave `value2` bare, relying on the engine's implicit uniqueidentifier→string convert.
    test('replaceAll on a uuid receiver with a uuid replacement leaves the replacement bare', async () => {
        const s = tIssue.externalRef.asString()
        const expected = [{ id: 1, v: '0a8f9c1e-1111-4222-8333-444455556666' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, v: s.replaceAll(s, s) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, replace(external_ref::text, external_ref::text, external_ref::text) as "v" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v?: string }>>>()
        expect(result).toEqual(expected)
    })

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
    // TODO[LIMITATION]: PostgreSQL's `'gi'` regex flag cannot honour `insensitiveCollation`.
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

    test('collate on the right-hand operand of a comparison', async () => {
        const expected = [{ v: false }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('abc', 'string').equals(ctx.conn.const('ABC', 'string').collate('C')) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 = ($2 collate "C") as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "abc",
            "ABC",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: boolean }>>>()
        expect(result).toEqual(expected)
    })
    test('collate operand under the comparison-operator family', async () => {
        const expected = [{
            ne: true, lt: false, gt: true, le: false, ge: true,
            bt: true, i: false, ino: true,
        }]
        ctx.mockNext(expected)
        const lhs = () => ctx.conn.const('abc', 'string')
        const rhs = () => ctx.conn.const('ABC', 'string').collate('C')
        const result = await ctx.conn.selectFromNoTable()
            .select({
                ne:    lhs().notEquals(rhs()),
                lt:    lhs().lessThan(rhs()),
                gt:    lhs().greaterThan(rhs()),
                le:    lhs().lessOrEqual(rhs()),
                ge:    lhs().greaterOrEqual(rhs()),
                bt:    lhs().between(rhs(), ctx.conn.const('zzz', 'string')),
                i:     lhs().is(rhs()),
                ino:   lhs().isNot(rhs()),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 <> ($2 collate "C") as ne, $3 < ($4 collate "C") as lt, $5 > ($6 collate "C") as gt, $7 <= ($8 collate "C") as le, $9 >= ($10 collate "C") as ge, $11 between ($12 collate "C") and $13 as bt, $14 is not distinct from ($15 collate "C") as "i", $16 is distinct from ($17 collate "C") as ino"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "abc",
            "ABC",
            "abc",
            "ABC",
            "abc",
            "ABC",
            "abc",
            "ABC",
            "abc",
            "ABC",
            "abc",
            "ABC",
            "zzz",
            "abc",
            "ABC",
            "abc",
            "ABC",
          ]
        `)
        assertType<Exact<typeof result, Array<{
            ne: boolean; lt: boolean; gt: boolean; le: boolean; ge: boolean
            bt: boolean; i: boolean; ino: boolean
        }>>>()
        expect(result).toEqual(expected)
    })
    test('collate as a group-by column', async () => {
        const expected = [
            { name: 'Ada Lovelace', n: 1 },
            { name: 'Alan Turing', n: 1 },
            { name: 'Grace Hopper', n: 1 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .select({ name: tAppUser.fullName.collate('C'), n: ctx.conn.count(tAppUser.id) })
            .groupBy(tAppUser.fullName.collate('C'))
            .orderBy('name')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select full_name collate "C" as name, count(id) as "n" from app_user group by full_name collate "C" order by name"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ name: string; n: number }>>>()
        expect(result).toEqual(expected)
    })
    test('collate as an order-by column', async () => {
        const expected = [
            { id: 1, fullName: 'Ada Lovelace' },
            { id: 3, fullName: 'Alan Turing' },
            { id: 2, fullName: 'Grace Hopper' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .select({ id: tAppUser.id, fullName: tAppUser.fullName })
            .orderBy(tAppUser.fullName.collate('C'))
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, full_name as "fullName" from app_user order by app_user.full_name collate "C""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; fullName: string }>>>()
        expect(result).toEqual(expected)
    })
    test('collate as a replaceAll argument', async () => {
        const expected = [
            { id: 1, v: 'ada@acme.test' },
            { id: 2, v: 'grace@acme.test' },
            { id: 3, v: 'alan@globex.test' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .select({ id: tAppUser.id, v: tAppUser.email.replaceAll(tAppUser.fullName.collate('C'), 'X') })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, replace(email, full_name collate "C", $1) as "v" from app_user order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "X",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v: string }>>>()
        expect(result).toEqual(expected)
    })
    test('collate on an optional receiver stays optional', async () => {
        const expected = [
            { id: 1 },
            { id: 2, v: 'Use new tokens' },
        ]
        ctx.mockNext([{ id: 1, v: null }, { id: 2, v: 'Use new tokens' }])
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({ id: tIssue.id, v: tIssue.body.collate('C') })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, body collate "C" as "v" from issue where project_id = $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v?: string }>>>()
        expect(result).toEqual(expected)
        expect('v' in result[0]!).toBe(false)
    })
    test('replaceAllInsensitive with a value-source find operand', async () => {
        const expected = [{ v: 'ZXZX' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ZabcZabc', 'string').replaceAllInsensitive(ctx.conn.const('abc', 'string'), 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select regexp_replace($1, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace($2, '\\', '\\\\'), '.', '\\.'), '*', '\\*'), '+', '\\+'), '?', '\\?'), '^', '\\^'), '$', '\\$'), '{', '\\{'), '}', '\\}'), '(', '\\('), ')', '\\)'), '|', '\\|'), '[', '\\['), ']', '\\]'), $3, 'gi') as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ZabcZabc",
            "abc",
            "X",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })
    test('replaceAllInsensitive with a value-source replacement operand', async () => {
        const expected = [{ v: 'ZYZY' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ZabcZabc', 'string').replaceAllInsensitive('abc', ctx.conn.const('Y', 'string')) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select regexp_replace($1, $2, replace($3, '\\', '\\\\'), 'gi') as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ZabcZabc",
            "abc",
            "Y",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })
    test('replaceAllInsensitive with both operands value sources', async () => {
        const expected = [{ v: 'ZWZW' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ZabcZabc', 'string').replaceAllInsensitive(ctx.conn.const('abc', 'string'), ctx.conn.const('W', 'string')) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select regexp_replace($1, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace($2, '\\', '\\\\'), '.', '\\.'), '*', '\\*'), '+', '\\+'), '?', '\\?'), '^', '\\^'), '$', '\\$'), '{', '\\{'), '}', '\\}'), '(', '\\('), ')', '\\)'), '|', '\\|'), '[', '\\['), ']', '\\]'), replace($3, '\\', '\\\\'), 'gi') as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ZabcZabc",
            "abc",
            "W",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: string }>>>()
        expect(result).toEqual(expected)
    })
    test('replaceAllInsensitiveIfValue present-value arms with a value-source operand', async () => {
        const expected = [{ vfind: 'ZXZX', vrepl: 'ZYZY' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({
                vfind: ctx.conn.const('ZabcZabc', 'string').replaceAllInsensitiveIfValue(ctx.conn.const('abc', 'string'), 'X'),
                vrepl: ctx.conn.const('ZabcZabc', 'string').replaceAllInsensitiveIfValue('abc', ctx.conn.const('Y', 'string')),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select regexp_replace($1, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace($2, '\\', '\\\\'), '.', '\\.'), '*', '\\*'), '+', '\\+'), '?', '\\?'), '^', '\\^'), '$', '\\$'), '{', '\\{'), '}', '\\}'), '(', '\\('), ')', '\\)'), '|', '\\|'), '[', '\\['), ']', '\\]'), $3, 'gi') as vfind, regexp_replace($4, $5, replace($6, '\\', '\\\\'), 'gi') as vrepl"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ZabcZabc",
            "abc",
            "X",
            "ZabcZabc",
            "abc",
            "Y",
          ]
        `)
        assertType<Exact<typeof result, Array<{ vfind: string; vrepl: string }>>>()
        expect(result).toEqual(expected)
    })
    test('collate on a like receiver', async () => {
        const expected = [{ v: false }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('ABC', 'string').collate('C').like('abc%') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ($1 collate "C") like $2 as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABC",
            "abc%",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: boolean }>>>()
        expect(result).toEqual(expected)
    })

    // ── uuid × forced collation ────────────────────────────────────────
    // A forced `collate` on a uuid must emit valid SQL and round-trip — the forced-collate
    // sites beyond `replaceAll` above: a direct `.collate()` on a projected uuid, an insensitive
    // `orderBy` over a projected uuid alias, and an insensitive comparison whose uuid VALUE
    // operand carries the forced collation. The uuid is rendered per this dialect's `asString()`.
    test('collate on a uuid receiver converts before collate', async () => {
        const expected = [{ id: 1, v: '0a8f9c1e-1111-4222-8333-444455556666' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, v: tIssue.externalRef.asString().collate('C') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, external_ref::text collate "C" as "v" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v?: string }>>>()
        expect(result).toEqual(expected)
    })
    test('insensitive orderBy on a uuid alias converts before collate', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        const expected = [
            { id: 1, ref: '0a8f9c1e-1111-4222-8333-444455556666' },
            { id: 2, ref: '7b3e9d20-2222-4c55-9b66-dddd00009999' },
        ]
        ctx.mockNext(expected)
        const result = await collated.selectFrom(tIssue)
            .where(tIssue.externalRef.isNotNull())
            .select({ id: tIssue.id, ref: tIssue.externalRef.asString() })
            .orderBy('ref', 'insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, external_ref::text as ref from issue where external_ref is not null order by external_ref::text collate "C""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; ref?: string }>>>()
        expect(result).toEqual(expected)
    })
    test('insensitive comparison with a uuid value operand converts before collate', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        const expected = [{ eq: false, ne: true, lk: false, nl: true }]
        ctx.mockNext(expected)
        const result = await collated.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                eq: collated.const('x', 'string').equalsInsensitive(tIssue.externalRef.asString()),
                ne: collated.const('x', 'string').notEqualsInsensitive(tIssue.externalRef.asString()),
                lk: collated.const('x', 'string').likeInsensitive(tIssue.externalRef.asString()),
                nl: collated.const('x', 'string').notLikeInsensitive(tIssue.externalRef.asString()),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 = external_ref::text collate "C" as eq, $2 <> external_ref::text collate "C" as ne, $3 ilike external_ref::text collate "C" as lk, $4 not ilike external_ref::text collate "C" as nl from issue where id = $5"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "x",
            "x",
            "x",
            "x",
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ eq?: boolean; ne?: boolean; lk?: boolean; nl?: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('insensitive affix predicates with a uuid value operand convert before collate', async () => {
        // The affix-insensitive predicates (startsWith / endsWith / contains and
        // their negations) with a uuid VALUE operand under a set
        // insensitiveCollation. The forced collation lands on the like-pattern
        // built from the uuid (rendered per this dialect's `asString()`), which is
        // a string, so the SQL stays valid and round-trips. The receiver 'x'
        // matches none of the patterns, so every positive predicate is false and
        // every negated one true, independent of the collation.
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        const expected = [{ starts: false, notStarts: true, ends: false, notEnds: true, contains: false, notContains: true }]
        ctx.mockNext(expected)
        const result = await collated.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                starts:      collated.const('x', 'string').startsWithInsensitive(tIssue.externalRef.asString()),
                notStarts:   collated.const('x', 'string').notStartsWithInsensitive(tIssue.externalRef.asString()),
                ends:        collated.const('x', 'string').endsWithInsensitive(tIssue.externalRef.asString()),
                notEnds:     collated.const('x', 'string').notEndsWithInsensitive(tIssue.externalRef.asString()),
                contains:    collated.const('x', 'string').containsInsensitive(tIssue.externalRef.asString()),
                notContains: collated.const('x', 'string').notContainsInsensitive(tIssue.externalRef.asString()),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 ilike (replace(replace(replace(external_ref::text, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%') collate "C" as starts, $2 not ilike (replace(replace(replace(external_ref::text, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%') collate "C" as "notStarts", $3 ilike ('%' || replace(replace(replace(external_ref::text, '\\', '\\\\'), '%', '\\%'), '_', '\\_')) collate "C" as ends, $4 not ilike ('%' || replace(replace(replace(external_ref::text, '\\', '\\\\'), '%', '\\%'), '_', '\\_')) collate "C" as "notEnds", $5 ilike ('%' || replace(replace(replace(external_ref::text, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%') collate "C" as contains, $6 not ilike ('%' || replace(replace(replace(external_ref::text, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%') collate "C" as "notContains" from issue where id = $7"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "x",
            "x",
            "x",
            "x",
            "x",
            "x",
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ starts?: boolean; notStarts?: boolean; ends?: boolean; notEnds?: boolean; contains?: boolean; notContains?: boolean }>>>()
        expect(result).toEqual(expected)
    })
})
