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
import { DBConnection, tAppUser, tIssue } from '../../domain/connection.js'
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(:0 collate BINARY_CI, :1 collate BINARY_CI, :2) collate USING_NLS_COMP as "v" from dual"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select :0 as "v" from dual"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace((replace(:0 collate BINARY, :1 collate BINARY, :2) collate USING_NLS_COMP) collate BINARY, :3 collate BINARY, :4) collate USING_NLS_COMP as "v" from dual"`)
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
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAll('abc', 'X').collate('BINARY') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (replace(:0 collate BINARY, :1 collate BINARY, :2) collate USING_NLS_COMP) collate BINARY as "v" from dual"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace((replace(:0 collate BINARY, :1 collate BINARY, :2) collate USING_NLS_COMP) collate BINARY_CI, :3 collate BINARY_CI, :4) collate USING_NLS_COMP as "v" from dual"`)
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
            .select({ v: ctx.conn.const('ABCabc', 'string').replaceAllInsensitive('qz', 'X').collate('BINARY') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (replace(:0 collate BINARY_CI, :1 collate BINARY_CI, :2) collate USING_NLS_COMP) collate BINARY as "v" from dual"`)
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
            .select({ v: ctx.conn.const('abc', 'string').equals(ctx.conn.const('ABC', 'string').collate('BINARY')) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when :0 = (:1 collate BINARY) then 1 else 0 end as "v" from dual"`)
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
        const rhs = () => ctx.conn.const('ABC', 'string').collate('BINARY')
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when :0 <> (:1 collate BINARY) then 1 else 0 end as "ne", case when :2 < (:3 collate BINARY) then 1 else 0 end as "lt", case when :4 > (:5 collate BINARY) then 1 else 0 end as "gt", case when :6 <= (:7 collate BINARY) then 1 else 0 end as "le", case when :8 >= (:9 collate BINARY) then 1 else 0 end as "ge", case when :10 between (:11 collate BINARY) and :12 then 1 else 0 end as "bt", case when decode(:13, (:14 collate BINARY), 1, 0 ) = 1 then 1 else 0 end as "i", case when decode(:15, (:16 collate BINARY), 1, 0 ) = 0 then 1 else 0 end as "ino" from dual"`)
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
            .select({ name: tAppUser.fullName.collate('BINARY'), n: ctx.conn.count(tAppUser.id) })
            .groupBy(tAppUser.fullName.collate('BINARY'))
            .orderBy('name')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select full_name collate BINARY as "name", count(id) as "n" from app_user group by full_name collate BINARY order by "name""`)
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
            .orderBy(tAppUser.fullName.collate('BINARY'))
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", full_name as "fullName" from app_user order by app_user.full_name collate BINARY"`)
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
            .select({ id: tAppUser.id, v: tAppUser.email.replaceAll(tAppUser.fullName.collate('BINARY'), 'X') })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", replace(email collate BINARY, (full_name collate BINARY) collate BINARY, :0) collate USING_NLS_COMP as "v" from app_user order by "id""`)
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
            .select({ id: tIssue.id, v: tIssue.body.collate('BINARY') })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", "body" collate BINARY as "v" from issue where project_id = :0 order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(:0 collate BINARY_CI, :1 collate BINARY_CI, :2) collate USING_NLS_COMP as "v" from dual"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(:0 collate BINARY_CI, :1 collate BINARY_CI, :2) collate USING_NLS_COMP as "v" from dual"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(:0 collate BINARY_CI, :1 collate BINARY_CI, :2) collate USING_NLS_COMP as "v" from dual"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(:0 collate BINARY_CI, :1 collate BINARY_CI, :2) collate USING_NLS_COMP as "vfind", replace(:3 collate BINARY_CI, :4 collate BINARY_CI, :5) collate USING_NLS_COMP as "vrepl" from dual"`)
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
            .select({ v: ctx.conn.const('ABC', 'string').collate('BINARY').like('abc%') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when (:0 collate BINARY) like :1 escape '\\' then 1 else 0 end as "v" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABC",
            "abc%",
          ]
        `)
        assertType<Exact<typeof result, Array<{ v: boolean }>>>()
        expect(result).toEqual(expected)
    })
})
