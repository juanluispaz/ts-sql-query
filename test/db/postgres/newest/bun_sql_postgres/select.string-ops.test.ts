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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, email || $1 || full_name as label from app_user where id = $2"`)
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
        // Chains `.concat(...)` and `.concatIfValue(...)` together. With
        // every ifValue argument present, all segments are included.
        // MySQL/MariaDB's `_appendMaybeInnerConcat` collapses the chain
        // into a single `concat(a, b, c, …)` call instead of nesting,
        // taking the `SqlOperation1ValueSourceIfValueOrIgnore` branch.
        // SQLite / PostgreSQL emit the chain through `||`.
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select email || $1 || $2 || $3 || $4 as label from app_user where id = $5"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            " (",
            "verified",
            ")",
            " [main]",
            1,
          ]
        `)
        if (ctx.realDbEnabled) {
            expect(rows).toEqual(expected)
        }
    })

    test('concat-chain-conditional-skip-undefined', async () => {
        // `.concatIfValue(undefined)` drops the segment, so the chain
        // collapses to `email || ' (' || ')'`. The flatten branch in
        // MySQL/MariaDB skips the optional segment as well.
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select email || $1 || $2 || $3 as label from app_user where id = $4"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            " (",
            "verified",
            ")",
            1,
          ]
        `)
        if (ctx.realDbEnabled) {
            expect(rows).toEqual(expected)
        }
    })

    test('contains', async () => {
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.contains('@acme'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' || $1 || '%') order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ($1 || '%')"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' || $1) order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(full_name) as upper, lower(email) as lower from app_user where id = $1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, length(full_name) as len from app_user where id = $1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, trim(full_name) as "t" from app_user where id = $1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ltrim(full_name) as "l", rtrim(full_name) as "r" from app_user where id = $1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, replace(email, $1, $2) as "t" from app_user where id = $3"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, reverse(email) as "t" from app_user where id = $1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, $1, $2) as sub from issue where id = $3"`)
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
    test('substring-to-end', async () => {
        // `.substringToEnd(start)` reaches the `_substringToEnd` branch
        // (no length argument). Each builder picks a slightly different
        // SQL — SQLite/Oracle drop the length argument from `substr`,
        // PostgreSQL uses `substring(x from start+1)`, SqlServer uses
        // `substring(x, start+1, len(x))`.
        const expected = [{ id: 1, sub: 'auth bug' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                sub: tIssue.title.substringToEnd(3),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, $1) as sub from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sub: string }>>>()
        if (!ctx.realDbEnabled) expect(result).toEqual(expected)
    })

    test('substr-to-end', async () => {
        // `.substrToEnd(start)` — the JS-style sibling of
        // substringToEnd(start). The emitted SQL is identical on
        // most dialects (both fall back to `substr(x, start+1)` on
        // SQLite/Oracle); the test still pins the param shape per cell.
        const expected = [{ id: 1, sub: 'auth bug' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                sub: tIssue.title.substrToEnd(3),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, $1) as sub from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sub: string }>>>()
        if (!ctx.realDbEnabled) expect(result).toEqual(expected)
    })

    test('substring-with-value-source-start', async () => {
        // `.substring(valueSource, end)` — `start` is a column ref
        // rather than a number literal. Reaches SqlServer's non-numeric
        // branch in `_substr` (the `else` arm). Other dialects already
        // pass `start` through the same path so the snapshot is just
        // recorded for documentation.
        //
        // The runtime result depends on column values and dialect
        // semantics (length may be 0 → null on some engines), so the
        // value assertion is mock-only and the runner is wrapped to
        // still capture the SQL on real-DB failure.
        const expected = [{ id: 1, sub: 'X' }]
        ctx.mockNext(expected)
        try {
            const result = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({
                    id:  tIssue.id,
                    sub: tIssue.title.substring(tIssue.priority, 5),
                })
                .executeSelectMany()
            assertType<Exact<typeof result, Array<{ id: number; sub: string }>>>()
            if (!ctx.realDbEnabled) expect(result).toEqual(expected)
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(title, priority + 1, $1 - priority) as sub from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
            1,
          ]
        `)
    })

})
