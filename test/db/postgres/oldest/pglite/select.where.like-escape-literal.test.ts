// Coverage of the LITERAL-string branch of `_escapeLikeWildcard`: an affix
// predicate (contains / startsWith / endsWith and their not / Insensitive /
// IfValue twins) fed a literal that CONTAINS `%` / `_`, so the `.replace()`
// calls in the string arm escape them in the BOUND PARAM. The exact escaped
// form this dialect emits is pinned by the snapshot below.
//
// The needle is a literal that no seeded `email` contains, so this dialect
// returns the empty set — the load-bearing assertion is the escaped param.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('contains-literal-with-percent-underscore', async () => {
        // `contains('50%_x')` takes the string arm: the `%` and `_` are escaped
        // in the bound param so they match literally instead of as wildcards.
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.contains('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' || $1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContains('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' || $1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('starts-with-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWith('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ($1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-starts-with-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWith('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ($1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('ends-with-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWith('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' || $1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-ends-with-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWith('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' || $1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-insensitive-literal-with-percent-underscore', async () => {
        // The `*Insensitive` twin takes the same string escape arm; only the
        // case-folding wrapper differs per dialect.
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email ilike ('%' || $1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('contains-if-value-literal-with-percent-underscore', async () => {
        // The `*IfValue` twin routes through the same string escape arm when a
        // value is present.
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsIfValue('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' || $1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    // The literal-escape sub-branch fed a needle containing a backslash (`\`)
    // and a bracket (`[`). Each dialect encodes these differently in the bound
    // param (backslash doubling, the quadruple-backslash override, `[` → `[[]`
    // bracket-escaping); the escaped param below pins this dialect's form. No
    // seeded email contains this needle, so the positive predicates return [].

    test('contains-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.contains('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' || $1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\\\b[c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-literal-with-backslash-bracket', async () => {
        // The shared escape fires on the `startsWith` affix arm too.
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWith('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ($1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\\\b[c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-literal-with-backslash-bracket', async () => {
        // ...and on the `endsWith` affix arm.
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWith('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' || $1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\\\b[c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    // The remaining `*Insensitive` affix predicates fed the wildcard literal
    // `50%_x`: same string escape arm as the sensitive forms, only the
    // case-folding wrapper differs per dialect. The `not*` twins would match
    // the whole table on a real engine, so they assert SQL + param only.

    test('starts-with-insensitive-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email ilike ($1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-starts-with-insensitive-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitive('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not ilike ($1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('ends-with-insensitive-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitive('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email ilike ('%' || $1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-ends-with-insensitive-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitive('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not ilike ('%' || $1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-contains-insensitive-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitive('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not ilike ('%' || $1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    // The remaining `*IfValue` affix twins fed the wildcard literal `50%_x`: a
    // present value routes through the same string escape arm as the plain
    // predicate. The `not*` twins assert SQL + param only.

    test('starts-with-if-value-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithIfValue('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ($1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-starts-with-if-value-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithIfValue('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ($1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('ends-with-if-value-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithIfValue('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' || $1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-ends-with-if-value-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithIfValue('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' || $1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-contains-if-value-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsIfValue('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' || $1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    // The `*InsensitiveIfValue` affix twins (both the case-folding wrapper and
    // present-value gating) fed the wildcard literal `50%_x`. Distinct public
    // methods from the plain `*Insensitive` / `*IfValue` forms above.

    test('contains-insensitive-if-value-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitiveIfValue('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email ilike ('%' || $1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-insensitive-if-value-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitiveIfValue('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not ilike ('%' || $1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('starts-with-insensitive-if-value-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitiveIfValue('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email ilike ($1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-starts-with-insensitive-if-value-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitiveIfValue('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not ilike ($1 || '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('ends-with-insensitive-if-value-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitiveIfValue('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email ilike ('%' || $1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-ends-with-insensitive-if-value-literal-with-percent-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitiveIfValue('50%_x'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not ilike ('%' || $1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })
})
