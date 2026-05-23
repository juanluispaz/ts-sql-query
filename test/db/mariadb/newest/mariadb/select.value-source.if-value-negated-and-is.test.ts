// Coverage of the IfValue + variadic family on negative/equality
// operators that the existing tests do not exercise. The positive
// `equalsIfValue`/`inIfValue` is in
// `select.value-source.null-and-if-value-modifiers.test.ts`; the
// non-IfValue `notEquals`/`notIn`/`isNot` are in
// `select.where.operators.test.ts` and `select.where.is-distinct-from.test.ts`.
// The pieces still uncovered on `ValueSourceImpl` are:
//
//   - `notEqualsIfValue(value)` — `NULLIF`-style skip on undefined for
//     the non-equality predicate.
//   - `notInIfValue([...])` — skip on undefined/empty-array for the
//     non-inclusion predicate (distinct from `notIn([])`, which the
//     library short-circuits to TRUE — see `select.where.empty-in.test.ts`).
//   - `isIfValue(value)` / `isNotIfValue(value)` — skip on undefined for
//     the NULL-safe equality operators (`is`/`isNot`). These are the
//     IfValue twins of the operators in `select.where.is-distinct-from.test.ts`.
//   - `inN(...vals)` / `notInN(...vals)` — the variadic-rest overloads
//     of `in`/`notIn`. The library exposes both `.in([a,b,c])` and
//     `.inN(a,b,c)` — only the array form is pinned today.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('not-equals-if-value-fires-when-value-present', async () => {
        // `notEqualsIfValue('open')` fires — the WHERE excludes the two
        // 'open' rows (ids 1 and 3). Seeded statuses:
        // 1='open', 2='in_progress', 3='open', 4='closed'.
        const expected = [
            { id: 2 },
            { id: 4 },
        ]
        ctx.mockNext(expected)

        const filter: string | undefined = 'open'
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.notEqualsIfValue(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where status <> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('not-equals-if-value-skips-on-undefined', async () => {
        // The undefined RHS elides — the WHERE clause carries no
        // predicate, every row returns.
        const expected = [
            { id: 1 },
            { id: 2 },
            { id: 3 },
            { id: 4 },
        ]
        ctx.mockNext(expected)

        const filter: string | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.notEqualsIfValue(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('not-in-if-value-fires-when-array-non-empty', async () => {
        // `notInIfValue(['open', 'closed'])` — only id=2 ('in_progress')
        // survives.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)

        const filter: string[] | undefined = ['open', 'closed']
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.notInIfValue(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where status not in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "closed",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('not-in-if-value-skips-on-undefined-and-on-empty', async () => {
        // `notInIfValue` elides on BOTH `undefined` AND `[]` — distinct
        // from `.notIn([])` which short-circuits to the TRUE constant
        // (every row matches; covered in `select.where.empty-in.test.ts`).
        // Here the elide path means the predicate is dropped entirely,
        // same emitted SQL as no WHERE at all.
        const expected = [
            { id: 1 },
            { id: 2 },
            { id: 3 },
            { id: 4 },
        ]
        ctx.mockNext(expected)

        const filter: string[] = []
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.notInIfValue(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('is-if-value-and-is-not-if-value-fire-with-value', async () => {
        // `is`/`isNot` are NULL-safe equality. Their IfValue twins
        // share the same emitted SQL when the value is present. Seeded
        // `assignee_id`: 1, 2, NULL, 3.
        //   `isIfValue(2)`     → matches id=2.
        //   `isNotIfValue(2)`  → matches the rest (1, 3 [NULL], 4).
        // We assert the AND-composition fires both predicates.
        const expected = [{ id: 4 }]
        ctx.mockNext(expected)

        const wanted: number | undefined = 3
        const exclude: number | undefined = 2
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.isIfValue(wanted)
                .and(tIssue.assigneeId.isNotIfValue(exclude)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where assignee_id <=> ? and not (assignee_id <=> ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('is-if-value-skips-on-undefined', async () => {
        // Both elide — the WHERE clause is empty. NULL-safe IfValue
        // operators behave like the rest of the IfValue family on the
        // missing-value path.
        const expected = [
            { id: 1 },
            { id: 2 },
            { id: 3 },
            { id: 4 },
        ]
        ctx.mockNext(expected)

        const wanted: number | undefined = undefined
        const exclude: number | undefined = undefined
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.isIfValue(wanted)
                .and(tIssue.assigneeId.isNotIfValue(exclude)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('in-n-and-not-in-n-variadic-spread', async () => {
        // `.inN(a, b, c)` / `.notInN(a, b, c)` are the variadic
        // overloads of `.in([...])` / `.notIn([...])`. They produce the
        // same SQL as the array form — pinning the spread path keeps
        // the variadic dispatch covered. Seeded priorities: 2, 1, 3, 2.
        //   `priority.inN(1, 3)`    → ids 2, 3.
        //   `priority.notInN(1, 3)` → ids 1, 4.
        const expected = [{ id: 1 }, { id: 4 }]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.notInN(1, 3))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority not in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })

    test('in-n-positive-variadic-spread', async () => {
        // Companion to the negative `notInN` test — pins the positive
        // `inN(1, 3)` predicate that lands on `_in` rather than
        // `_notIn` in `SqlOperationInValueSource`.
        const expected = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.inN(1, 3))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
        else expect(rows).toEqual(expected)
    })
})
