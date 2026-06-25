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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) = lower(@0)"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) <> lower(@0) order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(@0) order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(@0) order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(@0 + '%') order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0) order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0 + '%') order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(@0 + '%') order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0) order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ACME",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    // B1: the value-source (column) RHS overload of the insensitive operators.
    // Every test above uses a string LITERAL on the right; these pin the
    // param-free `lower(col) … lower(col2)` emission path. Row id=1: email
    // 'ada@acme.test', full_name 'Ada Lovelace' — not equal/prefix/suffix/
    // substring of each other, so every positive op is false and every
    // negative op is true.
    test('equals-and-not-equals-insensitive-column-rhs', async () => {
        const expected = [{ eq: false, neq: true }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                eq:  tAppUser.email.equalsInsensitive(tAppUser.fullName),
                neq: tAppUser.email.notEqualsInsensitive(tAppUser.fullName),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(case when lower(email) = lower(full_name) then 1 else 0 end as bit) as eq, cast(case when lower(email) <> lower(full_name) then 1 else 0 end as bit) as neq from app_user where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ eq: boolean; neq: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('like-and-not-like-insensitive-column-rhs', async () => {
        const expected = [{ lk: false, nlk: true }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                lk:  tAppUser.email.likeInsensitive(tAppUser.fullName),
                nlk: tAppUser.email.notLikeInsensitive(tAppUser.fullName),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(case when lower(email) like lower(full_name) then 1 else 0 end as bit) as lk, cast(case when lower(email) not like lower(full_name) then 1 else 0 end as bit) as nlk from app_user where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ lk: boolean; nlk: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('affix-insensitive-column-rhs', async () => {
        const expected = [{ sw: false, nsw: true, ew: false, new: true, ct: false, nct: true }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                sw:  tAppUser.email.startsWithInsensitive(tAppUser.fullName),
                nsw: tAppUser.email.notStartsWithInsensitive(tAppUser.fullName),
                ew:  tAppUser.email.endsWithInsensitive(tAppUser.fullName),
                new: tAppUser.email.notEndsWithInsensitive(tAppUser.fullName),
                ct:  tAppUser.email.containsInsensitive(tAppUser.fullName),
                nct: tAppUser.email.notContainsInsensitive(tAppUser.fullName),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(case when lower(email) like lower(replace(replace(replace(full_name, '[', '[[]'), '%', '[%]'), '_', '[]') + '%') then 1 else 0 end as bit) as sw, cast(case when lower(email) not like lower(replace(replace(replace(full_name, '[', '[[]'), '%', '[%]'), '_', '[]') + '%') then 1 else 0 end as bit) as nsw, cast(case when lower(email) like lower('%' + replace(replace(replace(full_name, '[', '[[]'), '%', '[%]'), '_', '[]')) then 1 else 0 end as bit) as ew, cast(case when lower(email) not like lower('%' + replace(replace(replace(full_name, '[', '[[]'), '%', '[%]'), '_', '[]')) then 1 else 0 end as bit) as [new], cast(case when lower(email) like lower('%' + replace(replace(replace(full_name, '[', '[[]'), '%', '[%]'), '_', '[]') + '%') then 1 else 0 end as bit) as ct, cast(case when lower(email) not like lower('%' + replace(replace(replace(full_name, '[', '[[]'), '%', '[%]'), '_', '[]') + '%') then 1 else 0 end as bit) as nct from app_user where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            sw: boolean; nsw: boolean; ew: boolean; new: boolean; ct: boolean; nct: boolean
        }>>>()
        expect(result).toEqual(expected)
    })
})
