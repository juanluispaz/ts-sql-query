// Coverage of the IfValue+Insensitive family. The non-IfValue
// insensitive variants are in `select.where.operators-insensitive.test.ts`
// and the per-collation gating is in `config.insensitive-collation.test.ts`.
// What is NOT exercised today is the IfValue × Insensitive crossbreed —
// methods that BOTH wrap each side in `lower(...)` (default collation)
// AND elide on undefined/empty string. These map to distinct branches
// in `SqlOperation1ValueSourceIfValueOrNoop` plus the
// `_appendInsensitive*` paths in `AbstractSqlBuilder`. The family is:
//
//   - `equalsInsensitiveIfValue` / `notEqualsInsensitiveIfValue`
//   - `likeInsensitiveIfValue` / `notLikeInsensitiveIfValue`
//   - `startsWithInsensitiveIfValue` / `endsWithInsensitiveIfValue`
//   - `notStartsWithInsensitiveIfValue` / `notEndsWithInsensitiveIfValue`
//   - `containsInsensitiveIfValue` / `notContainsInsensitiveIfValue`
//
// MySQL/MariaDB override `_startsWith`/`_endsWith`/`_contains` (and
// their insensitive forms) with a `concat()`-based shape, so the SQL
// snapshots on those cells diverge from the wrapper-based shape pinned
// here.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('equals-and-not-equals-insensitive-if-value-fire', async () => {
        // Default collation → both sides wrapped in `lower(...)`.
        // Seeded emails: 'ada@acme.test', 'grace@acme.test',
        // 'alan@globex.test'. `equalsInsensitiveIfValue('ADA@ACME.TEST')`
        // matches id=1; the AND with
        // `notEqualsInsensitiveIfValue('GRACE@ACME.TEST')` keeps it.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)

        const wanted: string | undefined = 'ADA@ACME.TEST'
        const exclude: string | undefined = 'GRACE@ACME.TEST'
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.equalsInsensitiveIfValue(wanted)
                .and(tAppUser.email.notEqualsInsensitiveIfValue(exclude)))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) = lower(?) and lower(email) <> lower(?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ADA@ACME.TEST",
            "GRACE@ACME.TEST",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('equals-insensitive-if-value-skips-on-undefined', async () => {
        // Both IfValue predicates elide on undefined; no `lower(...)`
        // wrappers in the emitted WHERE.
        const expected = [
            { id: 1 },
            { id: 2 },
            { id: 3 },
        ]
        ctx.mockNext(expected)

        const wanted: string | undefined = undefined
        const exclude: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.equalsInsensitiveIfValue(wanted)
                .and(tAppUser.email.notEqualsInsensitiveIfValue(exclude)))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('like-insensitive-and-not-like-insensitive-if-value-fire', async () => {
        // `likeInsensitiveIfValue('%ACME%')` matches the two acme rows
        // (ids 1, 2). The AND with
        // `notLikeInsensitiveIfValue('%GRACE%')` excludes id=2,
        // leaving id=1.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)

        const include: string | undefined = '%ACME%'
        const exclude: string | undefined = '%GRACE%'
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.likeInsensitiveIfValue(include)
                .and(tAppUser.email.notLikeInsensitiveIfValue(exclude)))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like lower(?) and lower(email) not like lower(?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "%ACME%",
            "%GRACE%",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('starts-with-insensitive-and-ends-with-insensitive-if-value-fire', async () => {
        // `startsWithInsensitiveIfValue('ADA')` matches id=1.
        // `endsWithInsensitiveIfValue('TEST')` matches all three. The
        // AND keeps id=1.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)

        const prefix: string | undefined = 'ADA'
        const suffix: string | undefined = 'TEST'
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitiveIfValue(prefix)
                .and(tAppUser.email.endsWithInsensitiveIfValue(suffix)))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like concat(lower(?), '%') and lower(email) like concat('%', lower(?)) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ADA",
            "TEST",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('not-starts-with-insensitive-and-not-ends-with-insensitive-if-value-fire', async () => {
        // `notStartsWithInsensitiveIfValue('ADA')` excludes id=1.
        // `notEndsWithInsensitiveIfValue('GLOBEX.TEST')` excludes id=3.
        // The AND-composition keeps id=2.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)

        const noPrefix: string | undefined = 'ADA'
        const noSuffix: string | undefined = 'GLOBEX.TEST'
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitiveIfValue(noPrefix)
                .and(tAppUser.email.notEndsWithInsensitiveIfValue(noSuffix)))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) not like concat(lower(?), '%') and lower(email) not like concat('%', lower(?)) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ADA",
            "GLOBEX.TEST",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('contains-insensitive-and-not-contains-insensitive-if-value-fire', async () => {
        // `containsInsensitiveIfValue('ACME')` matches ids 1 and 2.
        // The AND with `notContainsInsensitiveIfValue('GRACE')` drops
        // id=2.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)

        const include: string | undefined = 'ACME'
        const exclude: string | undefined = 'GRACE'
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitiveIfValue(include)
                .and(tAppUser.email.notContainsInsensitiveIfValue(exclude)))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like concat('%', lower(?), '%') and lower(email) not like concat('%', lower(?), '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ACME",
            "GRACE",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('insensitive-if-value-mixed-fire-and-elide', async () => {
        // Pins the elide branch on Insensitive+IfValue when ONE of
        // several AND'd predicates receives undefined. The fired
        // predicate is the only one that contributes to the SQL.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)

        const include: string | undefined = 'ACME'
        const exclude: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitiveIfValue(include)
                .and(tAppUser.email.notContainsInsensitiveIfValue(exclude)))
            .select({ id: tAppUser.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where lower(email) like concat('%', lower(?), '%') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ACME",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })
})
