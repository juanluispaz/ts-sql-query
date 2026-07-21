// Behavioral coverage of string operators on text columns:
// concat / contains / startsWith / endsWith / upper / lower / length /
// substring.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tProjectReview, vReleaseOverview, tIssueWorklog } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('concat', async () => {
        const expected = [{ id: 1, label: 'ada@acme.test/Ada Lovelace' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                id:    tAppUser.id,
                label: tAppUser.email.concat('/').concat(tAppUser.fullName),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, email || ? || full_name as label from app_user where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "/",
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('concat-chain-with-conditional-flattens', async () => {
        // Chains `.concat(...)` and `.concatIfValue(...)` with every ifValue
        // argument present, so all segments are included.
        const expected = [{ label: 'ada@acme.test (verified) [main]' }]
        ctx.mockNext(expected)
        const tag: string | undefined = 'verified'
        const suffix: string | undefined = ' [main]'
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                label: tAppUser.email
                    .concat(' (')
                    .concatIfValue(tag)
                    .concat(')')
                    .concatIfValue(suffix),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select email || ? || ? || ? || ? as label from app_user where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            " (",
            "verified",
            ")",
            " [main]",
            1,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('concat-chain-conditional-skip-undefined', async () => {
        // `.concatIfValue(undefined)` drops that segment from the chain.
        const expected = [{ label: 'ada@acme.test (verified)' }]
        ctx.mockNext(expected)
        const tag: string | undefined = 'verified'
        const suffix: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                label: tAppUser.email
                    .concat(' (')
                    .concatIfValue(tag)
                    .concat(')')
                    .concatIfValue(suffix),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select email || ? || ? || ? as label from app_user where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            " (",
            "verified",
            ")",
            1,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('contains', async () => {
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.contains('@acme'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' || ? || '%') escape '\\' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "@acme",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('starts-with', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWith('ada@'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (? || '%') escape '\\'"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ada@",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('ends-with', async () => {
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWith('acme.test'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' || ?) escape '\\' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "acme.test",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('upper-lower', async () => {
        const expected = [{ id: 1, upper: 'ADA LOVELACE', lower: 'ada@acme.test' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                id:    tAppUser.id,
                upper: tAppUser.fullName.toUpperCase(),
                lower: tAppUser.email.toLowerCase(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(full_name) as upper, lower(email) as lower from app_user where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:    number
            upper: string
            lower: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('length', async () => {
        const expected = [{ id: 1, len: 12 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                id:  tAppUser.id,
                len: tAppUser.fullName.length(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, length(full_name) as len from app_user where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; len: number }>>>()
        expect(result).toEqual(expected)
    })

    test('length-non-ascii', async () => {
        // `.length()` mirrors JS's `String.length`, which counts CHARACTERS: 'café' is
        // 4 characters held in 5 utf8 bytes, and '日本' is 2 characters held in 6 — so a
        // byte-counting emission answers 5 and 6 here instead of 4 and 2.
        const expected = [{ accented: 4, cjk: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({
                accented: ctx.conn.const('café', 'string').length(),
                cjk:      ctx.conn.const('日本', 'string').length(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select length(?) as accented, length(?) as cjk"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "café",
            "日本",
          ]
        `)
        assertType<Exact<typeof result, Array<{ accented: number; cjk: number }>>>()
        expect(result).toEqual(expected)
    })

    test('length-and-substr-keep-trailing-spaces', async () => {
        // Trailing blanks are part of the string: 'Draft  ' is 7 characters, and slicing from
        // index 0 returns it whole. A length that excludes trailing blanks answers 5 here and,
        // where that same length feeds a slice, amputates them from the result too.
        const padded = ctx.conn.const('Draft  ', 'string')
        const expected = [{ len: 7, whole: 'Draft  ', tail: 'aft  ' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({
                len:   padded.length(),
                whole: padded.substrToEnd(0),
                tail:  padded.substrToEnd(2),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select length(?) as len, substr(?, ?) as whole, substr(?, ?) as tail"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Draft  ",
            "Draft  ",
            1,
            "Draft  ",
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ len: number; whole: string; tail: string }>>>()
        expect(result).toEqual(expected)
    })

    test('trim', async () => {
        const expected = [{ id: 1, t: 'Ada Lovelace' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                id: tAppUser.id,
                t:  tAppUser.fullName.trim(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, trim(full_name) as "t" from app_user where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; t: string }>>>()
        expect(result).toEqual(expected)
    })

    test('trim-left-right', async () => {
        // full_name has no surrounding whitespace → ltrim/rtrim are no-ops.
        const expected = [{ id: 1, l: 'Ada Lovelace', r: 'Ada Lovelace' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                id: tAppUser.id,
                l: tAppUser.fullName.trimLeft(),
                r: tAppUser.fullName.trimRight(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ltrim(full_name) as "l", rtrim(full_name) as "r" from app_user where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; l: string; r: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('replace-all', async () => {
        const expected = [{ id: 1, t: 'ada-acme.test' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                id: tAppUser.id,
                t:  tAppUser.email.replaceAll('@', '-'),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, replace(email, ?, ?) as "t" from app_user where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "@",
            "-",
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; t: string }>>>()
        expect(result).toEqual(expected)
    })

    // TODO[LIMITATION]: this SQLite build has no `reverse()` function.
    /*
    test('reverse', async () => {
        const expected = [{ id: 1, t: 'tset.emca@ada' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                id: tAppUser.id,
                t:  tAppUser.email.reverse(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, reverse(email) as "t" from app_user where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; t: string }>>>()
        expect(result).toEqual(expected)
    })
    */

    test('substring', async () => {
        const expected = [{ id: 1, sub: 'Upd' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                sub: tIssue.title.substring(0, 3),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, ?, ?) as sub from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sub: string }>>>()
        expect(result).toEqual(expected)
    })
    test('substring-to-end', async () => {
        // `.substringToEnd(start)` omits the length argument.
        const expected = [{ id: 1, sub: 'ate hero copy' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                sub: tIssue.title.substringToEnd(3),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, ?) as sub from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sub: string }>>>()
        expect(result).toEqual(expected)
    })

    test('substr-to-end', async () => {
        // `.substrToEnd(start)` — JS-style sibling of `.substringToEnd(start)`.
        const expected = [{ id: 1, sub: 'ate hero copy' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                sub: tIssue.title.substrToEnd(3),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, ?) as sub from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sub: string }>>>()
        expect(result).toEqual(expected)
    })

    test('negative-index-follows-javascript', async () => {
        // The one thing that separates JS's two slicing methods is the negative index:
        // 'abcdef'.substr(-2) is 'ef' (counted from the end) while 'abcdef'.substring(-2) is
        // 'abcdef' (the index clamps to 0). Out of range, substr clamps too: .substr(-10) is
        // the whole string. And substring SWAPS its arguments when start > end, so
        // .substring(2, 0) is a legal call meaning .substring(0, 2) -> 'ab'.
        const s = ctx.conn.const('abcdef', 'string')
        const expected = [{
            lastChar: 'f', fromEnd: 'ef', fromEndFar: 'abcdef', fromEndCount: 'e', fromEndFarCount: 'ab',
            clamped: 'abcdef', clampedEnd: 'abc', swapped: 'ab',
        }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFromNoTable()
            .select({
                lastChar:        s.substrToEnd(-1),
                fromEnd:         s.substrToEnd(-2),
                fromEndFar:      s.substrToEnd(-10),
                fromEndCount:    s.substr(-2, 1),
                fromEndFarCount: s.substr(-10, 2),
                clamped:         s.substringToEnd(-2),
                clampedEnd:      s.substring(-2, 3),
                swapped:         s.substring(2, 0),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select substr(?, ?) as lastChar, substr(?, ?) as fromEnd, substr(?, ?) as fromEndFar, substr(substr(?, ?), 1, ?) as fromEndCount, substr(substr(?, ?), 1, ?) as fromEndFarCount, substr(?, ?) as clamped, substr(?, ?, ?) as clampedEnd, substr(?, ?, ?) as swapped"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "abcdef",
            -1,
            "abcdef",
            -2,
            "abcdef",
            -10,
            "abcdef",
            -2,
            1,
            "abcdef",
            -10,
            2,
            "abcdef",
            1,
            "abcdef",
            1,
            3,
            "abcdef",
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            lastChar: string; fromEnd: string; fromEndFar: string; fromEndCount: string; fromEndFarCount: string
            clamped: string; clampedEnd: string; swapped: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('negative-count-clamps-to-empty-string', async () => {
        // JS clamps a negative count to 0, so 'abcdef'.substr(2, -1) and .substr(-2, -1) are
        // both ''. SQL has no such rule: a negative length is either rejected outright or read
        // as "all but the last |n| characters", which is a different string. The connection
        // opts into allowEmptyString so the '' survives the read as itself, instead of being
        // mapped to null the way the default treats every empty string.
        const conn = ctx.withAllowEmptyString()
        const s = conn.const('abcdef', 'string')
        const expected = [{ fromStart: '', fromEnd: '' }]
        ctx.mockNext(expected)
        const result = await conn.selectFromNoTable()
            .select({
                fromStart: s.substr(2, -1),
                fromEnd:   s.substr(-2, -1),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select substr(?, ?, ?) as fromStart, substr(substr(?, ?), 1, ?) as fromEnd"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "abcdef",
            3,
            0,
            "abcdef",
            -2,
            0,
          ]
        `)
        assertType<Exact<typeof result, Array<{ fromStart: string; fromEnd: string }>>>()
        expect(result).toEqual(expected)
    })

    test('substring-with-value-source-start', async () => {
        // `.substring(valueSource, end)` — start is a column ref, not a literal.
        // issue 1: title='Update hero copy', priority=2 → substring(2, 5) = 'dat'.
        const expected = [{ id: 1, sub: 'dat' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                sub: tIssue.title.substring(tIssue.priority, 5),
            })
            .executeSelectMany()
        assertType<Exact<typeof result, Array<{ id: number; sub: string }>>>()
        expect(result).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, priority + 1, ? - priority) as sub from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
            1,
          ]
        `)
    })

    test('substr-two-arg', async () => {
        // `.substr(start, count)` — JS-style two-argument form (start + count),
        // distinct from `.substring(start, end)`.
        const expected = [{ id: 1, sub: 'Upd' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                sub: tIssue.title.substr(0, 3),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, ?, ?) as sub from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sub: string }>>>()
        expect(result).toEqual(expected)
    })

    test('substring-numeric-start-value-source-end', async () => {
        // `.substring(numericStart, valueSourceEnd)` — start is a literal,
        // end is a column ref.
        // issue 1: title='Update hero copy', priority=2 → substring(0, 2) = 'Up'.
        const expected = [{ id: 1, sub: 'Up' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                sub: tIssue.title.substring(0, tIssue.priority),
            })
            .executeSelectMany()
        assertType<Exact<typeof result, Array<{ id: number; sub: string }>>>()
        expect(result).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, 1, priority) as sub from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

    test('substr-to-end-with-value-source-start', async () => {
        // `.substrToEnd(valueSource)` — the boundary is a number value
        // source, not a literal. issue 1: title='Update hero copy',
        // priority=2 → substr from 0-based offset 2 → 'date hero copy'.
        const expected = [{ id: 1, sub: 'date hero copy' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, sub: tIssue.title.substrToEnd(tIssue.priority) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, priority + 1) as sub from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sub: string }>>>()
        expect(result).toEqual(expected)
    })

    test('substring-to-end-with-value-source-start', async () => {
        // `.substringToEnd(valueSource)` — the SQL-style sibling of
        // substrToEnd, same boundary supplied as a value source.
        const expected = [{ id: 1, sub: 'date hero copy' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, sub: tIssue.title.substringToEnd(tIssue.priority) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, priority + 1) as sub from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sub: string }>>>()
        expect(result).toEqual(expected)
    })

    test('substr-two-arg-with-value-source-boundaries', async () => {
        // `.substr(valueSourceStart, valueSourceCount)` — both boundaries
        // are number value sources. issue 1: priority=2, id=1 → substr from
        // 0-based offset 2, length 1 → 'd'.
        const expected = [{ id: 1, sub: 'd' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, sub: tIssue.title.substr(tIssue.priority, tIssue.id) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, priority + 1, id) as sub from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sub: string }>>>()
        expect(result).toEqual(expected)
    })

    test('replaceAll-with-value-source-find-and-replace', async () => {
        // `.replaceAll(find, replace)` with both operands as string value
        // sources → replace(title, body, title), no params. issue 2:
        // title='Redesign navbar', body='Use new tokens' — body is not a
        // substring of title, so the value is unchanged.
        const expected = [{ id: 2, t: 'Redesign navbar' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, t: tIssue.title.replaceAll(tIssue.body, tIssue.title) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, replace(title, body, title) as "t" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; t?: string }>>>()
        expect(result).toEqual(expected)
    })

    test('replaceAll-first-arg-optional-null-row', async () => {
        // `replaceAll(find, replace)` with an optional argument (`body`)
        // projects an optional leaf (`t?: string`). On a row where body is
        // NULL, `replace(title, body, title)` is NULL and the optional leaf is
        // omitted at runtime by the optionals-as-undefined projector.
        const expected = [{ id: 1 }]
        ctx.mockNext([{ id: 1, t: null }])
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, t: tIssue.title.replaceAll(tIssue.body, tIssue.title) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, replace(title, body, title) as "t" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; t?: string }>>>()
        expect(result).toEqual(expected)
        expect(result[0]!.t).toBeUndefined()
    })
    test('string-predicate-on-optional-receiver-projects-optional-boolean', async () => {
        // A string predicate on an OPTIONAL receiver (`body`) projects an
        // OPTIONAL boolean leaf (`hasNeedle?: boolean`). issue 2 body='Use new
        // tokens' → contains('token') is true.
        const expected = [{ id: 2, hasNeedle: true }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, hasNeedle: tIssue.body.contains('token') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, body like ('%' || ? || '%') escape '\\' as hasNeedle from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "token",
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; hasNeedle?: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('string-transforms-on-optional-receiver', async () => {
        // Transforms on an OPTIONAL string receiver (`body`): `.length()`
        // shifts `string?` → `number?` and toUpperCase/toLowerCase/trimLeft/
        // trimRight keep the optional marker as `string?`. issue 2 has
        // body='Use new tokens'; the leaves stay optional because the receiver
        // is, even though the value is present.
        const expected = [{
            up: 'USE NEW TOKENS', lo: 'use new tokens', len: 14,
            tl: 'Use new tokens', tr: 'Use new tokens',
        }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                up:  tIssue.body.toUpperCase(),
                lo:  tIssue.body.toLowerCase(),
                len: tIssue.body.length(),
                tl:  tIssue.body.trimLeft(),
                tr:  tIssue.body.trimRight(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select upper(body) as up, lower(body) as lo, length(body) as len, ltrim(body) as tl, rtrim(body) as tr from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            up?: string; lo?: string; len?: number; tl?: string; tr?: string
        }>>>()
        expect(result).toEqual(expected)
    })

    // TODO[LIMITATION]: this SQLite build has no `reverse()` function.
    /*
    test('string-reverse-on-optional-receiver', async () => {
        // `.reverse()` on an OPTIONAL string receiver keeps the optional marker
        // (`rev?: string`). Kept separate because some SQLite builds have no
        // `reverse()` function. issue 2 body='Use new tokens'.
        const expected = [{ rev: 'snekot wen esU' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ rev: tIssue.body.reverse() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select reverse(body) as rev from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ rev?: string }>>>()
        expect(result).toEqual(expected)
    })
    */

    test('substr-family-with-optional-value-source-argument', async () => {
        // When a substr/substring boundary is an OPTIONAL value source the
        // argument's optionality merges into the result leaf (`?: string`).
        // `assignee_id` (optional int) is the boundary; issue 1 has
        // assignee_id = 1 (present), so the values are observed.
        // title = 'Update hero copy'.
        const expected = [{ id: 1, se: 'pdate hero copy', sse: 'pdate hero copy', s2: 'pda', sg: 'pdat' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                se:  tIssue.title.substrToEnd(tIssue.assigneeId),
                sse: tIssue.title.substringToEnd(tIssue.assigneeId),
                s2:  tIssue.title.substr(tIssue.assigneeId, 3),
                sg:  tIssue.title.substring(tIssue.assigneeId, 5),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, assignee_id + 1) as se, substr(title, assignee_id + 1) as sse, substr(title, assignee_id + 1, ?) as s2, substr(title, assignee_id + 1, ? - assignee_id) as sg from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            5,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; se?: string; sse?: string; s2?: string; sg?: string }>>>()
        expect(result).toEqual(expected)
    })

    test('concat-with-optional-value-source-argument-and-optional-receiver', async () => {
        // Two concat optionality arms: (1) the VALUE-SOURCE-argument overload
        // with an OPTIONAL argument (`title.concat(body)`) merges the argument's
        // optionality into the result (`?: string`); (2) `concat` on an OPTIONAL
        // RECEIVER (`body.concat('!')`) keeps the optional marker (`?: string`).
        // issue 2 has body = 'Use new tokens' (present), so both values are
        // observed.
        const expected = [{ id: 2, j: 'Redesign navbarUse new tokens', r: 'Use new tokens!' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                id: tIssue.id,
                j:  tIssue.title.concat(tIssue.body),
                r:  tIssue.body.concat('!'),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title || body as "j", body || ? as "r" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "!",
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; j?: string; r?: string }>>>()
        expect(result).toEqual(expected)
    })

    test('replaceAll-single-value-source-overloads', async () => {
        // The two single-value-source `replaceAll` overloads: (const, VS) and
        // (VS, const). The (const,const) and (VS,VS) forms are covered above;
        // these mixed arms emit the param/column the other way around. app_user
        // 1: email 'ada@acme.test', full_name 'Ada Lovelace'.
        const expected = {
            id:  1,
            cvs: 'adaAda Lovelaceacme.test', // replace '@' with full_name
            vsc: 'ada@acme.test',            // full_name not present in email -> unchanged
        }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                id:  tAppUser.id,
                cvs: tAppUser.email.replaceAll('@', tAppUser.fullName),
                vsc: tAppUser.email.replaceAll(tAppUser.fullName, '-'),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, replace(email, ?, full_name) as cvs, replace(email, full_name, ?) as vsc from app_user where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "@",
            "-",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; cvs: string; vsc: string }>>()
        expect(row).toEqual(expected)
    })

    test('replaceAllIfValue-single-value-source-overloads', async () => {
        // The `replaceAllIfValue` single-value-source overloads — (str, VS) and
        // (VS, str). Both literal arguments carry a value, so the predicates are
        // emitted exactly like `replaceAll` (the IfValue elision only triggers
        // when a literal argument is null/undefined). app_user 1: email
        // 'ada@acme.test', full_name 'Ada Lovelace'.
        const expected = {
            id:  1,
            sv: 'adaAda Lovelaceacme.test', // replace '@' with full_name
            vs: 'ada@acme.test',            // full_name not present in email -> unchanged
        }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                id: tAppUser.id,
                sv: tAppUser.email.replaceAllIfValue('@', tAppUser.fullName),
                vs: tAppUser.email.replaceAllIfValue(tAppUser.fullName, '-'),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, replace(email, ?, full_name) as sv, replace(email, full_name, ?) as vs from app_user where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "@",
            "-",
            1,
          ]
        `)
        // Both arguments are present (the receiver and the value-source arg are
        // required), so the IfValue result stays a required `string`.
        assertType<Exact<typeof row, { id: number; sv: string; vs: string }>>()
        expect(row).toEqual(expected)
    })

    test('substr-numeric-start-value-source-count-and-substring-both-value-sources', async () => {
        // Two more single-/double-value-source boundary overloads:
        //   - substr(numericStart, valueSourceCount) — JS-style start+count with
        //     a literal start and a value-source count.
        //   - substring(valueSourceStart, valueSourceEnd) — both boundaries are
        //     value sources (the (VS,num)/(num,VS) substring forms are covered
        //     above). issue 1: title 'Update hero copy', id 1, priority 2.
        const expected = {
            id:  1,
            sc:  'Up', // substr(0, priority=2) -> first 2 chars
            ss:  'p',  // substring(id=1, priority=2) -> char at 0-based index 1
        }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                sc: tIssue.title.substr(0, tIssue.priority),
                ss: tIssue.title.substring(tIssue.id, tIssue.priority),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, ?, priority) as sc, substr(title, id + 1, priority - id) as ss from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; sc: string; ss: string }>>()
        expect(row).toEqual(expected)
    })


    // ── substrToEnd on adapter-bearing columns ─────────────────────────
    // A string transform propagates its receiver's per-column TypeAdapter to the
    // result, so `substrToEnd(n)` over a bracket-adapter column
    // reads the substring wrapped in [...]. The mock is primed with the RAW DB
    // substring, so the assertion proves the adapter ran on the transform result.

    test('substr-to-end-on-adapter-view-column', async () => {
        // `versionBracketed` (view column, string + bracketAdapter) mapping
        // `r.version`. Release 1: version '1.2.0' → substr from 0-based 2 → '2.0',
        // read bracketed → '[2.0]'.
        const expected = { id: 1, sub: '[2.0]' }
        ctx.mockNext({ id: 1, sub: '2.0' })
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, sub: vReleaseOverview.versionBracketed.substrToEnd(2) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(version_bracketed, ?) as sub from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; sub: string }>>()
        expect(row).toEqual(expected)
    })

    test('substr-to-end-on-optional-adapter-view-column', async () => {
        // `channelBracketed` (view column, OPTIONAL string + bracketAdapter): the
        // optional receiver keeps the leaf optional. Release 1: channel_bracketed
        // 'stable' (channel <> 'beta') → substr from 0-based 2 → 'able', read
        // bracketed → '[able]'.
        const expected = { id: 1, sub: '[able]' }
        ctx.mockNext({ id: 1, sub: 'able' })
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, sub: vReleaseOverview.channelBracketed.substrToEnd(2) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(channel_bracketed, ?) as sub from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; sub?: string }>>()
        expect(row).toEqual(expected)
    })

    test('substr-to-end-on-adapter-table-column', async () => {
        // `reviewerCode` (table column, string + bracketAdapter). Review 1:
        // reviewer_code 'R-7A2' → substr from 0-based 2 → '7A2', read bracketed →
        // '[7A2]'.
        const expected = { id: 1, sub: '[7A2]' }
        ctx.mockNext({ id: 1, sub: '7A2' })
        const row = await ctx.conn.selectFrom(tProjectReview)
            .where(tProjectReview.id.equals(1))
            .select({ id: tProjectReview.id, sub: tProjectReview.reviewerCode.substrToEnd(2) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(reviewer_code, ?) as sub from project_review where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; sub: string }>>()
        expect(row).toEqual(expected)
    })

    // ── More transforms on an OPTIONAL string receiver (`body`) ─────────
    // `trim` / `substr` / `substrToEnd` / `replaceAll` on the optional `body`
    // column keep the optional marker (`?: string`). Issue 2 has body
    // 'Use new tokens' (present), so the values are observed.

    test('trim-substr-substr-to-end-replace-all-on-optional-receiver', async () => {
        const expected = { id: 2, tr: 'Use new tokens', s2: 'Use', se: 'new tokens', ra: 'UsE nEw tokEns' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                id: tIssue.id,
                tr: tIssue.body.trim(),
                s2: tIssue.body.substr(0, 3),
                se: tIssue.body.substrToEnd(4),
                ra: tIssue.body.replaceAll('e', 'E'),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, trim(body) as tr, substr(body, ?, ?) as s2, substr(body, ?) as se, replace(body, ?, ?) as ra from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
            5,
            "e",
            "E",
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; tr?: string; s2?: string; se?: string; ra?: string }>>()
        expect(row).toEqual(expected)
    })

    // ── An optional-receiver transform on a NULL row → absent value ─────
    // On a NULL row the transform is NULL and the optionals-as-undefined projector
    // omits the key at runtime.

    test('to-upper-case-on-optional-receiver-null-row-absent', async () => {
        // Issue 1 has body NULL → `upper(body)` is NULL → the optional leaf is absent.
        const expected = { id: 1 }
        ctx.mockNext({ id: 1, up: null })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, up: tIssue.body.toUpperCase() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(body) as up from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; up?: string }>>()
        expect(row).toEqual(expected)
        expect(row.up).toBeUndefined()
    })

    test('to-upper-case-on-optional-adapter-view-column-null-row-absent', async () => {
        // Release 2 has channel 'beta' → channel_bracketed NULL → `upper(...)` NULL
        // → the optional adapter leaf is absent (the adapter never runs on NULL).
        const expected = { id: 2 }
        ctx.mockNext({ id: 2, up: null })
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(2))
            .select({ id: vReleaseOverview.id, up: vReleaseOverview.channelBracketed.toUpperCase() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(channel_bracketed) as up from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; up?: string }>>()
        expect(row).toEqual(expected)
        expect(row.up).toBeUndefined()
    })

    // ── A virtual/computed bracket column fed into a string transform ───
    // `toUpperCase()` wraps the virtual fragment in another `upper(...)` and the
    // bracket adapter still reads the result wrapped in [...].

    test('to-upper-case-on-virtual-bracket-view-column', async () => {
        // `versionTagged` = `upper(version)` + bracketAdapter (view). Release 1:
        // upper(upper('1.2.0')) = '1.2.0', read bracketed → '[1.2.0]'.
        const expected = { id: 1, t: '[1.2.0]' }
        ctx.mockNext({ id: 1, t: '1.2.0' })
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, t: vReleaseOverview.versionTagged.toUpperCase() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(upper(version)) as "t" from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; t: string }>>()
        expect(row).toEqual(expected)
    })

    test('to-upper-case-on-virtual-bracket-table-column', async () => {
        // `activityTagged` = `upper(activity)` + bracketAdapter (table). Worklog 1:
        // upper(upper('coding')) = 'CODING', read bracketed → '[CODING]'.
        const expected = { id: 1, t: '[CODING]' }
        ctx.mockNext({ id: 1, t: 'CODING' })
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ id: tIssueWorklog.id, t: tIssueWorklog.activityTagged.toUpperCase() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(upper(activity)) as "t" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; t: string }>>()
        expect(row).toEqual(expected)
    })
    test('affix-predicates-with-a-value-source-term', async () => {
        // the affix predicates (contains / endsWith / notContains) reached with a
        // VALUE-SOURCE (optional column) term instead of a string literal. The needle renders as the column expression inside
        // the `(... || '%')` affix; on engines whose concat poisons on NULL (Oracle) the
        // whole affix is wrapped in a NULL-guard CASE, which the per-dialect snapshot pins.
        // The optional needle makes each result optional. issue 1 body NULL → absent; issue
        // 2 body 'Use new tokens', title 'Redesign navbar' → contains=false, endsWith=false,
        // notContains=true.
        const expected = [
            { id: 1 },
            { id: 2, ct: false, ew: false, nc: true },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                id: tIssue.id,
                ct: tIssue.title.contains(tIssue.body),
                ew: tIssue.title.endsWith(tIssue.body),
                nc: tIssue.title.notContains(tIssue.body),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title like ('%' || replace(replace(replace(body, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%') escape '\\' as ct, title like ('%' || replace(replace(replace(body, '\\', '\\\\'), '%', '\\%'), '_', '\\_')) escape '\\' as ew, title not like ('%' || replace(replace(replace(body, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%') escape '\\' as nc from issue where project_id = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; ct?: boolean; ew?: boolean; nc?: boolean }>>>()
        expect(result).toEqual(expected)
    })
    test('uuid-as-string-string-methods', async () => {
        // string methods on a `uuid.asString()` value. `length`/`toUpperCase`/`toLowerCase` route the stringified
        // uuid through the plain string operators; on SQL Server the uuid needs an implicit
        // convert (pinned by the per-dialect snapshot). external_ref is optional, so each
        // result is optional; issue 1's uuid is the 36-char lowercase value. (`reverse` is
        // excluded — SQLite has no REVERSE function.)
        const uuid = '0a8f9c1e-1111-4222-8333-444455556666'
        const expected = [{
            id: 1,
            len: 36,
            up:  uuid.toUpperCase(),
            lo:  uuid.toLowerCase(),
        }]
        ctx.mockNext(expected)
        const s = tIssue.externalRef.asString()
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                len: s.length(),
                up:  s.toUpperCase(),
                lo:  s.toLowerCase(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, length(external_ref) as len, upper(external_ref) as up, lower(external_ref) as lo from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; len?: number; up?: string; lo?: string }>>>()
        expect(result).toEqual(expected)
    })
})
