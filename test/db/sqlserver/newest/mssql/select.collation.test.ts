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
import { DBConnection, tAppUser, tIssue } from '../../domain/connection.js'
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

    // ── uuid receivers ────────────────────────────────────────────────
    // `uuid.asString().replaceAll(...)` / `.replaceAllInsensitive(...)` must produce valid SQL
    // and round-trip on every dialect — replacing the whole uuid by itself yields 'X' whatever
    // the stored casing. On SQL Server a uuid receiver/operand is a `uniqueidentifier`, which
    // rejects a `collate` clause ("Expression type uniqueidentifier is invalid for COLLATE
    // clause"), so the forced-collation replace converts it to nvarchar(36) BEFORE the collate,
    // like the rest of the string API. `replaceAllInsensitive`'s collate branch (which only fires
    // when `insensitiveCollation` is set) needs the same convert.
    test('replaceAll on a uuid receiver converts before collate', async () => {
        const s = tIssue.externalRef.asString()
        const expected = [{ id: 1, v: 'X' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, v: s.replaceAll(s, 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, replace(convert(nvarchar(36), external_ref) collate Latin1_General_BIN2, convert(nvarchar(36), external_ref) collate Latin1_General_BIN2, @0) collate DATABASE_DEFAULT as [v] from issue where id = @1"`)
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
        const collated = new InsensitiveReplaceConnection(ctx.conn.queryRunner)
        const s = tIssue.externalRef.asString()
        const expected = [{ id: 1, v: 'X' }]
        ctx.mockNext(expected)
        const result = await collated.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, v: s.replaceAllInsensitive(s, 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, replace(convert(nvarchar(36), external_ref) collate Latin1_General_CI_AI, convert(nvarchar(36), external_ref) collate Latin1_General_CI_AI, @0) collate DATABASE_DEFAULT as [v] from issue where id = @1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "X",
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v?: string }>>>()
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

    test('collate on the right-hand operand of a comparison', async () => {
        const expected = [{ v: false }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({ v: ctx.conn.const('abc', 'string').equals(ctx.conn.const('ABC', 'string').collate('Latin1_General_BIN2')) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(case when @0 = (@1 collate Latin1_General_BIN2) then 1 else 0 end as bit) as [v]"`)
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
        const rhs = () => ctx.conn.const('ABC', 'string').collate('Latin1_General_BIN2')
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(case when @0 <> (@1 collate Latin1_General_BIN2) then 1 else 0 end as bit) as ne, cast(case when @2 < (@3 collate Latin1_General_BIN2) then 1 else 0 end as bit) as lt, cast(case when @4 > (@5 collate Latin1_General_BIN2) then 1 else 0 end as bit) as gt, cast(case when @6 <= (@7 collate Latin1_General_BIN2) then 1 else 0 end as bit) as le, cast(case when @8 >= (@9 collate Latin1_General_BIN2) then 1 else 0 end as bit) as ge, cast(case when @10 between (@11 collate Latin1_General_BIN2) and @12 then 1 else 0 end as bit) as bt, cast(case when @13 = (@14 collate Latin1_General_BIN2) then 1 else 0 end as bit) as [i], cast(case when @15 <> (@16 collate Latin1_General_BIN2) then 1 else 0 end as bit) as ino"`)
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
            .select({ name: tAppUser.fullName.collate('Latin1_General_BIN2'), n: ctx.conn.count(tAppUser.id) })
            .groupBy(tAppUser.fullName.collate('Latin1_General_BIN2'))
            .orderBy('name')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select full_name collate Latin1_General_BIN2 as name, count(id) as [n] from app_user group by full_name collate Latin1_General_BIN2 order by name"`)
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
            .orderBy(tAppUser.fullName.collate('Latin1_General_BIN2'))
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, full_name as fullName from app_user order by app_user.full_name collate Latin1_General_BIN2"`)
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
            .select({ id: tAppUser.id, v: tAppUser.email.replaceAll(tAppUser.fullName.collate('Latin1_General_BIN2'), 'X') })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, replace(email collate Latin1_General_BIN2, (full_name collate Latin1_General_BIN2) collate Latin1_General_BIN2, @0) collate DATABASE_DEFAULT as [v] from app_user order by id"`)
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
            .select({ id: tIssue.id, v: tIssue.body.collate('Latin1_General_BIN2') })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, body collate Latin1_General_BIN2 as [v] from issue where project_id = @0 order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(@0, @1, @2) as [v]"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(@0, @1, @2) as [v]"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(@0, @1, @2) as [v]"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select replace(@0, @1, @2) as vfind, replace(@3, @4, @5) as vrepl"`)
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
            .select({ v: ctx.conn.const('ABC', 'string').collate('Latin1_General_BIN2').like('abc%') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(case when (@0 collate Latin1_General_BIN2) like @1 then 1 else 0 end as bit) as [v]"`)
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
        const expected = [{ id: 1, v: '0A8F9C1E-1111-4222-8333-444455556666' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, v: tIssue.externalRef.asString().collate('Latin1_General_BIN2') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, convert(nvarchar(36), external_ref) collate Latin1_General_BIN2 as [v] from issue where id = @0"`)
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
            { id: 1, ref: '0A8F9C1E-1111-4222-8333-444455556666' },
            { id: 2, ref: '7B3E9D20-2222-4C55-9B66-DDDD00009999' },
        ]
        ctx.mockNext(expected)
        const result = await collated.selectFrom(tIssue)
            .where(tIssue.externalRef.isNotNull())
            .select({ id: tIssue.id, ref: tIssue.externalRef.asString() })
            .orderBy('ref', 'insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, external_ref as [ref] from issue where external_ref is not null order by convert(nvarchar(36), external_ref) collate Latin1_General_CI_AS"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(case when @0 = convert(nvarchar(36), external_ref) collate Latin1_General_CI_AS then 1 when not (@1 = convert(nvarchar(36), external_ref) collate Latin1_General_CI_AS) then 0 else null end as bit) as eq, cast(case when @2 <> convert(nvarchar(36), external_ref) collate Latin1_General_CI_AS then 1 when not (@3 <> convert(nvarchar(36), external_ref) collate Latin1_General_CI_AS) then 0 else null end as bit) as ne, cast(case when @4 like convert(nvarchar(36), external_ref) collate Latin1_General_CI_AS then 1 when not @5 like convert(nvarchar(36), external_ref) collate Latin1_General_CI_AS then 0 else null end as bit) as lk, cast(case when @6 not like convert(nvarchar(36), external_ref) collate Latin1_General_CI_AS then 1 when not @7 not like convert(nvarchar(36), external_ref) collate Latin1_General_CI_AS then 0 else null end as bit) as nl from issue where id = @8"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "x",
            "x",
            "x",
            "x",
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
})
