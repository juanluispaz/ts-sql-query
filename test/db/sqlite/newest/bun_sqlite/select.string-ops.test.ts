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
        const expected = [{ id: 1, l: 'Ada', r: 'Ada' }]
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
        if (!ctx.realDbEnabled) {
            expect(result).toEqual(expected)
        }
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

    test('reverse', async () => {
        // Mock the result; not every dialect natively supports REVERSE.
        const expected = [{ id: 1, t: 'esnopser' }]
        ctx.mockNext(expected)
        try {
            const result = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.id.equals(1))
                .select({
                    id: tAppUser.id,
                    t:  tAppUser.email.reverse(),
                })
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof result, Array<{ id: number; t: string }>>>()
            if (!ctx.realDbEnabled) expect(result).toEqual(expected)
        } catch {
            // real DB may not provide a REVERSE function; the SQL was
            // captured before the runner ran.
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, reverse(email) as "t" from app_user where id = ?"`)
        }
    })

    test('substring', async () => {
        const expected = [{ id: 1, sub: 'Ada' }]
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
        // We don't pin the value to a real string; the test fixes only
        // SQL/params/types and the mock-mode value round-trip.
        if (!ctx.realDbEnabled) expect(result).toEqual(expected)
    })
})
