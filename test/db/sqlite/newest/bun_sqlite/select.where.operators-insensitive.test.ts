// Behavioral coverage of the case-insensitive WHERE operators that are
// part of the public string-operator surface but have no other test
// today: equalsInsensitive / notEqualsInsensitive and the "not"
// variants of likeInsensitive, startsWithInsensitive,
// endsWithInsensitive and containsInsensitive.
//
// Each dialect renders these differently — some override the Abstract
// default, others inherit it — so the per-cell snapshots will differ.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('equals-insensitive', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.equalsInsensitive('ADA@ACME.TEST'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) = lower(?)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ADA@ACME.TEST",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('not-equals-insensitive', async () => {
        const expected = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEqualsInsensitive('ADA@ACME.TEST'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) <> lower(?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ADA@ACME.TEST",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('like-insensitive', async () => {
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.likeInsensitive('%@ACME.TEST'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(?) escape '\\' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "%@ACME.TEST",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('not-like-insensitive', async () => {
        const expected = [{ id: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notLikeInsensitive('%@ACME.TEST'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(?) escape '\\' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "%@ACME.TEST",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('not-starts-with-insensitive', async () => {
        const expected = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitive('ADA'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(? || '%') escape '\\' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ADA",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('not-ends-with-insensitive', async () => {
        const expected = [{ id: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitive('@ACME.TEST'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' || ?) escape '\\' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "@ACME.TEST",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('not-contains-insensitive', async () => {
        const expected = [{ id: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitive('ACME'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' || ? || '%') escape '\\' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ACME",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })
    test('starts-with-insensitive', async () => {
        // Positive `startsWithInsensitive` — distinct dialect override from
        // the `not` form (different SqlBuilder method), so the negative-only
        // tests above never exercise this branch.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive('ADA'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(? || '%') escape '\\' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ADA",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('ends-with-insensitive', async () => {
        // Positive `endsWithInsensitive` — every dialect override is dead
        // code today (coverage report flagged all 5 builders).
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitive('@ACME.TEST'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' || ?) escape '\\' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "@ACME.TEST",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('contains-insensitive', async () => {
        // Positive `containsInsensitive` on a column — docs.delete /
        // docs.select touch this with a literal, but the dedicated
        // operator suite never asserted the rendering here.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive('ACME'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' || ? || '%') escape '\\' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ACME",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

})
