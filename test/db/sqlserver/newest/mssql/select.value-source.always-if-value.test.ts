// `connection.dynamicBooleanExpressionUsing(...)` returns an
// `AlwaysIfValueSource` — the neutral-boolean builder seed. That interface
// *redeclares* `negate` / literal `and` / literal `or` / `onlyWhen` /
// `ignoreWhen` / `trueWhenNoValue` / `falseWhenNoValue` / `valueWhenNoValue`
// so each returns an `AlwaysIfValueSource` again (keeping the chain
// composable). Each test applies one method to the seed and asserts the
// emitted SQL; the `let w` reassignment keeps the result typed as an
// `AlwaysIfValueSource`.
//
// Seed: 4 issues, priorities {2, 1, 3, 2} for ids {1, 2, 3, 4}. So
// `priority > 1` keeps ids 1, 3, 4 and `priority <= 1` keeps id 2.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('always-if/negate', async () => {
        // `negate()` on the always-if chain: `not (priority > 1)` keeps the
        // single priority <= 1 row (id 2).
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.negate()
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where not (priority > @0) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/and-literal-true-keeps-condition', async () => {
        // The literal `and(true)` overload — `true` is neutral in AND, so
        // the surviving condition is still `priority > 1`.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.and(true)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority > @0 and (@1 = 1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            true,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/or-literal-false-keeps-condition', async () => {
        // The literal `or(false)` overload — `false` is neutral in OR, so
        // the surviving condition is still `priority > 1`.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.or(false)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority > @0 or (@1 = 1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            false,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/only-when-true-keeps-condition', async () => {
        // `onlyWhen(true)` keeps the expression — `priority > 1`.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.onlyWhen(true)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority > @0 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/only-when-false-drops-condition', async () => {
        // `onlyWhen(false)` collapses to the neutral boolean → no WHERE
        // clause at all → every row.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.onlyWhen(false)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/ignore-when-true-drops-condition', async () => {
        // `ignoreWhen(true)` is the inverse of `onlyWhen` — drops the
        // expression → no WHERE clause → every row.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.ignoreWhen(true)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/ignore-when-false-keeps-condition', async () => {
        // `ignoreWhen(false)` keeps the expression — `priority > 1`.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.and(tIssue.priority.greaterThan(1))
        w = w.ignoreWhen(false)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority > @0 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/true-when-no-value-on-empty-emits-true-literal', async () => {
        // The seed builder has no condition added, so it carries no value.
        // `trueWhenNoValue()` substitutes the dialect's TRUE literal → the
        // WHERE is unconditionally true → every row.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.trueWhenNoValue()
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where (1=1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/false-when-no-value-on-empty-emits-false-literal', async () => {
        // Twin of the above — `falseWhenNoValue()` substitutes the FALSE
        // literal → no row survives.
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.falseWhenNoValue()
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where (0=1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/value-when-no-value-source-substitutes-on-empty', async () => {
        // `valueWhenNoValue(otherBooleanSource)` — with no value on the seed,
        // the fallback boolean source (`priority > 1`) is what ends up in the
        // WHERE clause → ids 1, 3, 4.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.valueWhenNoValue(tIssue.priority.greaterThan(1))
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority > @0 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/value-when-no-value-literal-true-substitutes-on-empty', async () => {
        // With no value on the seed, `valueWhenNoValue(true)` substitutes the
        // literal `true` → the WHERE is unconditionally true → every row.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.valueWhenNoValue(true)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where (1=1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('always-if/value-when-no-value-literal-false-substitutes-on-empty', async () => {
        // With no value on the seed, `valueWhenNoValue(false)` substitutes the
        // literal `false` → no row survives.
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)

        let w = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
        w = w.valueWhenNoValue(false)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where (0=1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })
})
