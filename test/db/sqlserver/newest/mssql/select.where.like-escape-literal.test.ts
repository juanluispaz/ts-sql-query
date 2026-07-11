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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    // The literal-escape sub-branch fed a needle containing a backslash (`\`)
    // and a bracket (`[`). Each dialect encodes these differently in the bound
    // param (backslash doubling, `[` → `[[]`
    // bracket-escaping); the escaped param below pins this dialect's form. No
    // seeded email contains this needle, so the positive predicates return [].

    test('contains-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.contains('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50[%][_]x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })
    // ---- STR-block-1: the backslash-bracket needle `a\b[c` on the 21 remaining
    // affix predicates (the plain `contains`/`startsWith`/`endsWith` sensitive
    // arms are pinned above). Each dialect encodes the needle differently in the
    // bound param (backslash doubling + `escape` clause, or SqlServer's `[`→`[[]`
    // bracket-escaping with no backslash doubling); the escaped param below pins
    // this dialect's form. The `not*` twins would match the whole table on a real
    // engine, so they assert SQL + param only; the positive twins return [].

    test('not-contains-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContains('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWith('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWith('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-insensitive-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-insensitive-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-insensitive-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitive('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-insensitive-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitive('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-insensitive-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitive('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-insensitive-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitive('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-if-value-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsIfValue('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-if-value-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithIfValue('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-if-value-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithIfValue('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-if-value-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsIfValue('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-if-value-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithIfValue('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-if-value-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithIfValue('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-insensitive-if-value-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitiveIfValue('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-insensitive-if-value-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitiveIfValue('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('starts-with-insensitive-if-value-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitiveIfValue('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-starts-with-insensitive-if-value-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitiveIfValue('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('ends-with-insensitive-if-value-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitiveIfValue('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-ends-with-insensitive-if-value-literal-with-backslash-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitiveIfValue('a\\b[c'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a\\b[[]c",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })
    // ---- STR-block-3: each LIKE metacharacter (% / _ / \\ / [) in ISOLATION fed
    // to the 24 affix predicate methods. The escaped bound param below is a
    // substring of the combined-needle params pinned above; enumerated per method
    // for saturation. No seeded email holds the isolated metachar, so the positive
    // predicates return []; the not* twins assert SQL + param only.

    test('contains-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.contains('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWith('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWith('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContains('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWith('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWith('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-insensitive-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-insensitive-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-insensitive-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitive('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-insensitive-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitive('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-insensitive-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitive('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-insensitive-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitive('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-if-value-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsIfValue('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-if-value-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithIfValue('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-if-value-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithIfValue('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-if-value-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsIfValue('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-if-value-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithIfValue('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-if-value-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithIfValue('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-insensitive-if-value-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitiveIfValue('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-insensitive-if-value-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitiveIfValue('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-insensitive-if-value-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitiveIfValue('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-insensitive-if-value-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitiveIfValue('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-insensitive-if-value-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitiveIfValue('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-insensitive-if-value-single-percent', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitiveIfValue('%'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[%]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.contains('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWith('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWith('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContains('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWith('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWith('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-insensitive-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-insensitive-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-insensitive-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitive('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-insensitive-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitive('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-insensitive-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitive('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-insensitive-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitive('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-if-value-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsIfValue('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-if-value-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithIfValue('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-if-value-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithIfValue('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-if-value-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsIfValue('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-if-value-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithIfValue('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-if-value-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithIfValue('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-insensitive-if-value-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitiveIfValue('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-insensitive-if-value-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitiveIfValue('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-insensitive-if-value-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitiveIfValue('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-insensitive-if-value-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitiveIfValue('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-insensitive-if-value-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitiveIfValue('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-insensitive-if-value-single-underscore', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitiveIfValue('_'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[_]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.contains('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWith('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWith('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContains('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWith('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWith('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-insensitive-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-insensitive-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-insensitive-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitive('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-insensitive-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitive('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-insensitive-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitive('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-insensitive-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitive('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-if-value-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsIfValue('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-if-value-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithIfValue('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-if-value-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithIfValue('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-if-value-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsIfValue('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-if-value-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithIfValue('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-if-value-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithIfValue('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-insensitive-if-value-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitiveIfValue('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-insensitive-if-value-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitiveIfValue('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-insensitive-if-value-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitiveIfValue('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-insensitive-if-value-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitiveIfValue('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-insensitive-if-value-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitiveIfValue('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-insensitive-if-value-single-backslash', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitiveIfValue('\\'))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "\\",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.contains('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWith('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWith('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContains('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWith('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWith('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-insensitive-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-insensitive-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-insensitive-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitive('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-insensitive-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitive('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-insensitive-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitive('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-insensitive-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitive('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-if-value-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsIfValue('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-if-value-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithIfValue('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-if-value-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithIfValue('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-if-value-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsIfValue('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-if-value-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithIfValue('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-if-value-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithIfValue('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('contains-insensitive-if-value-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitiveIfValue('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('starts-with-insensitive-if-value-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitiveIfValue('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('ends-with-insensitive-if-value-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitiveIfValue('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })

    test('not-contains-insensitive-if-value-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitiveIfValue('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-starts-with-insensitive-if-value-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitiveIfValue('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower(@0 + '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

    test('not-ends-with-insensitive-if-value-single-bracket', async () => {
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitiveIfValue('['))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like lower('%' + @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "[[]",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })

})
