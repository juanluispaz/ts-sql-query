// Behavioral coverage of string operators on text columns:
// concat / contains / startsWith / endsWith / upper / lower / length /
// substring.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue } from '../../domain/connection.js'
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

    // NOT-APPLICABLE: this SQLite build has no `reverse()` function.
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, ?, priority - ?) as sub from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            0,
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
            up?: string | undefined; lo?: string | undefined; len?: number | undefined; tl?: string | undefined; tr?: string | undefined
        }>>>()
        expect(result).toEqual(expected)
    })

    // NOT-APPLICABLE: this SQLite build has no `reverse()` function.
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
        assertType<Exact<typeof result, Array<{ rev?: string | undefined }>>>()
        expect(result).toEqual(expected)
    })
    */
})
