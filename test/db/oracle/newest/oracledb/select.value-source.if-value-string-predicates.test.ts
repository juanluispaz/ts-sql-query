// Coverage of the IfValue family on string predicates. The non-IfValue
// twins live in `select.where.operators-negative.test.ts` (notLike,
// notStartsWith, notEndsWith, notContains, notBetween) and
// `select.string-ops.test.ts` (like / startsWith / endsWith / contains
// proper). The IfValue twins that govern "skip on undefined / empty
// string" are not exercised — and they map to distinct branches in
// `SqlOperation1ValueSourceIfValueOrNoop`/`SqlOperation2ValueSourceIfValueOrIgnore`
// in `ValueSourceImpl.ts`. This file pins both fire and elide paths
// for:
//
//   - `likeIfValue` / `notLikeIfValue`
//   - `startsWithIfValue` / `endsWithIfValue` / `notStartsWithIfValue`
//     / `notEndsWithIfValue`
//   - `notContainsIfValue` (positive `containsIfValue` is already
//     covered in `null-handling.test.ts`)
//   - `replaceAllIfValue` — the two-arg IfValue variant that elides
//     when EITHER `findString` or `replaceWith` is missing
//     (`SqlOperation2ValueSourceIfValueOrIgnore`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('like-if-value-fires-and-not-like-if-value-fires', async () => {
        // `likeIfValue('%nav%')` on titles: matches 'Redesign navbar'
        // (id=2). Seeded titles:
        //   1='Update hero copy', 2='Redesign navbar',
        //   3='Migrate to ESM',  4='Document /v2/users'.
        // `notLikeIfValue('%ESM%')` on the same row excludes id=3 —
        // here it's a no-op (the AND-chain still matches id=2).
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)

        const includePat: string | undefined = '%nav%'
        const excludePat: string | undefined = '%ESM%'
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.likeIfValue(includePat)
                .and(tIssue.title.notLikeIfValue(excludePat)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where title like :0 escape '\\' and title not like :1 escape '\\' order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "%nav%",
            "%ESM%",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('like-if-value-skips-on-undefined', async () => {
        // Both IfValue predicates receive undefined → elide. The
        // emitted SQL carries no WHERE clause for either; every row
        // returns.
        const expected = [
            { id: 1 },
            { id: 2 },
            { id: 3 },
            { id: 4 },
        ]
        ctx.mockNext(expected)

        const includePat: string | undefined = undefined
        const excludePat: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.likeIfValue(includePat)
                .and(tIssue.title.notLikeIfValue(excludePat)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('starts-with-if-value-and-ends-with-if-value-fire', async () => {
        // Title pattern: 'Migrate to ESM' (id=3) startsWith 'Migrate'
        // AND endsWith 'ESM'. The AND-composition restricts to that
        // single row.
        const expected = [{ id: 3 }]
        ctx.mockNext(expected)

        const prefix: string | undefined = 'Migrate'
        const suffix: string | undefined = 'ESM'
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.startsWithIfValue(prefix)
                .and(tIssue.title.endsWithIfValue(suffix)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where title like (:0 || '%') escape '\\' and title like ('%' || :1) escape '\\' order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Migrate",
            "ESM",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('starts-with-if-value-elides-on-empty-string', async () => {
        // `IfValue` treats the empty string as "no value" per the
        // library's rules. `startsWithIfValue('')` and
        // `endsWithIfValue('')` both elide — all four rows return.
        const expected = [
            { id: 1 },
            { id: 2 },
            { id: 3 },
            { id: 4 },
        ]
        ctx.mockNext(expected)

        const prefix = ''
        const suffix = ''
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.startsWithIfValue(prefix)
                .and(tIssue.title.endsWithIfValue(suffix)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('not-starts-with-if-value-and-not-ends-with-if-value-fire', async () => {
        // `notStartsWithIfValue('Update')` excludes id=1.
        // `notEndsWithIfValue('users')` excludes id=4 (ends with
        // '/v2/users'). The two AND'd predicates leave ids 2 and 3.
        const expected = [
            { id: 2 },
            { id: 3 },
        ]
        ctx.mockNext(expected)

        const noPrefix: string | undefined = 'Update'
        const noSuffix: string | undefined = 'users'
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.notStartsWithIfValue(noPrefix)
                .and(tIssue.title.notEndsWithIfValue(noSuffix)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where title not like (:0 || '%') escape '\\' and title not like ('%' || :1) escape '\\' order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Update",
            "users",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('not-contains-if-value-fires-and-elides', async () => {
        // Mixed: `notContainsIfValue('nav')` fires (excludes id=2);
        // `notContainsIfValue(undefined)` elides. The result restricts
        // to ids 1, 3, 4.
        const expected = [
            { id: 1 },
            { id: 3 },
            { id: 4 },
        ]
        ctx.mockNext(expected)

        const fired: string | undefined = 'nav'
        const elided: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.notContainsIfValue(fired)
                .and(tIssue.title.notContainsIfValue(elided)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where title not like ('%' || :0 || '%') escape '\\' order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "nav",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('replace-all-if-value-fires-with-both-args', async () => {
        // `replaceAllIfValue('o', '0')` swaps every 'o' for '0' in the
        // status column. Seeded statuses: 'open', 'in_progress',
        // 'open', 'closed'. Expected: '0pen', 'in_pr0gress', '0pen',
        // 'cl0sed'. Mock returns the projection shape; the real DB
        // computes the same.
        const expected = [
            { id: 1, masked: '0pen' },
            { id: 2, masked: 'in_pr0gress' },
            { id: 3, masked: '0pen' },
            { id: 4, masked: 'cl0sed' },
        ]
        ctx.mockNext(expected)

        const find: string | undefined = 'o'
        const repl: string | undefined = '0'
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({
                id:     tIssue.id,
                masked: tIssue.status.replaceAllIfValue(find, repl),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", replace(status, :0, :1) as "masked" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "o",
            "0",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; masked: string }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('replace-all-if-value-elides-when-either-arg-missing', async () => {
        // `SqlOperation2ValueSourceIfValueOrIgnore` elides whenever
        // EITHER argument is "no value". Here `find` is provided but
        // `repl` is undefined → the projection falls back to the raw
        // column (no `replace(...)` wrapper in the emitted SQL).
        const expected = [
            { id: 1, masked: 'open' },
            { id: 2, masked: 'in_progress' },
            { id: 3, masked: 'open' },
            { id: 4, masked: 'closed' },
        ]
        ctx.mockNext(expected)

        const find: string | undefined = 'o'
        const repl: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({
                id:     tIssue.id,
                masked: tIssue.status.replaceAllIfValue(find, repl),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", status as "masked" from issue order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; masked: string }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })
})
