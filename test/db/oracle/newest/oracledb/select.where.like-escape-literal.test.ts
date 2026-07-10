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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from app_user where email like ('%' || :0 || '%') escape '\\' order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from app_user where email not like ('%' || :0 || '%') escape '\\' order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from app_user where email like (:0 || '%') escape '\\' order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from app_user where email not like (:0 || '%') escape '\\' order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from app_user where email like ('%' || :0) escape '\\' order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from app_user where email not like ('%' || :0) escape '\\' order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from app_user where lower(email) like lower('%' || :0 || '%') escape '\\' order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from app_user where email like ('%' || :0 || '%') escape '\\' order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "50\\%\\_x",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual([])
    })
})
