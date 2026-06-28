// Method-chained boolean composition on boolean value sources:
// `.and(other)` / `.or(other)` / `.negate()` invoked directly on a
// `BooleanValueSource` (the result of `.equals(...)`, `.in(...)`, …)
// rather than via the SELECT builder's `.where(...).and(...)` chain
// already covered by `select.where.operators.test.ts`.
//
// These map to `_and`/`_or`
// (the `SqlOperation1ValueSource` branch
// Their behaviour is observably different from the builder-side
// `.and(...)` because the chained `.and(...)` returns a fresh
// `BooleanValueSource` you can pass around (e.g. into
// `connection.exists(...)`, `dynamicConditionFor` extensions, ad-hoc
// projection columns), where the builder-side `.and(...)` mutates the
// current `__where`/`__on`/`__having` slot in place.
//
// Snapshots pin the parenthesisation each dialect applies; that's
// the load-bearing detail readers care about when reaching for these
// chains in production code.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('boolean-and-method-combines-two-predicates', async () => {
        // `equals(...).and(greaterOrEqual(...))` builds a single
        // BooleanValueSource — handed to `.where(...)` as one
        // argument. The emitted SQL pairs the two predicates under
        // `AND` (most dialects without outer parens since AND is the
        // top-level connective in this WHERE).
        const expected = [{ id: 3 }]
        ctx.mockNext(expected)
        const predicate = tIssue.status.equals('open')
            .and(tIssue.priority.greaterOrEqual(3))
        const result = await ctx.conn.selectFrom(tIssue)
            .where(predicate)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where \`status\` = ? and priority >= ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('boolean-or-method-combines-two-predicates', async () => {
        // `equals(...).or(equals(...))` — single BooleanValueSource
        // with two status values. The `OR` should appear without
        // outer parens at the top level of the WHERE.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const predicate = tIssue.status.equals('open')
            .or(tIssue.status.equals('closed'))
        const result = await ctx.conn.selectFrom(tIssue)
            .where(predicate)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where \`status\` = ? or \`status\` = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "closed",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('boolean-and-of-or-parenthesises-inner-or', async () => {
        // Mixed: `(status='open' OR status='in_progress') AND priority < 3`.
        // The inner OR must be parenthesised in the SQL so the AND
        // doesn't bind tighter and change the semantics.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const statusInWork = tIssue.status.equals('open')
            .or(tIssue.status.equals('in_progress'))
        const predicate = statusInWork.and(tIssue.priority.lessThan(3))
        const result = await ctx.conn.selectFrom(tIssue)
            .where(predicate)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where (\`status\` = ? or \`status\` = ?) and priority < ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "in_progress",
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('boolean-chain-negate-wraps-in-not', async () => {
        // `.negate()` on a chained boolean expression wraps the whole
        // thing in `NOT (...)`. The snapshot proves the parens reach
        // around the entire AND/OR composition rather than only the
        // last operand.
        const expected = [{ id: 4 }]
        ctx.mockNext(expected)
        const inWorkPredicate = tIssue.status.equals('open')
            .or(tIssue.status.equals('in_progress'))
        const result = await ctx.conn.selectFrom(tIssue)
            .where(inWorkPredicate.negate())
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where not (\`status\` = ? or \`status\` = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "in_progress",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('if-value-negate-only-when-ignore-when-stay-if-value', async () => {
        // negate / onlyWhen / ignoreWhen applied to an IfValueSource (from
        // `equalsIfValue`) return an IfValueSource again. The `let w`
        // reassignment is the type lock: a non-If return type would fail to
        // compile here. With a
        // present value the predicate fires: `not (priority = 1)` keeps the
        // priority != 1 rows (ids 1, 3, 4).
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        let w = tIssue.priority.equalsIfValue(1)
        w = w.negate()
        w = w.onlyWhen(true)
        w = w.ignoreWhen(false)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where not (priority = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('if-value-or-if-value-stays-if-value', async () => {
        // `IfValueSource.or(IfValueSource)` keeps the result an IfValueSource.
        // `let w` pins the type. Both values present → `status = $1 or
        // status = $2` (open ids 1,3 + closed id 4).
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        let w = tIssue.status.equalsIfValue('open')
        w = w.or(tIssue.status.equalsIfValue('closed'))
        const result = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where \`status\` = ? or \`status\` = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "closed",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('if-value-and-or-both-no-value-elide-the-where', async () => {
        // When BOTH operands of `IfValue.and/or(IfValue)` carry no value, the
        // whole predicate elides — the WHERE clause is dropped. Both `.and` and
        // `.or` collapse to no-clause → every row.
        const noStatus: string | undefined = undefined
        const noPriority: number | undefined = undefined

        const expectedAnd = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expectedAnd)
        const andRows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equalsIfValue(noStatus).and(tIssue.priority.equalsIfValue(noPriority)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof andRows, Array<{ id: number }>>>()
        expect(andRows).toEqual(expectedAnd)

        const expectedOr = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expectedOr)
        const orRows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equalsIfValue(noStatus).or(tIssue.priority.equalsIfValue(noPriority)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(orRows).toEqual(expectedOr)
    })

    test('if-value-and-boolean-literal-collapses-to-boolean', async () => {
        // `IfValueSource.and/or(boolean literal)` collapses to a
        // BooleanValueSource. Projecting the result as a column is the type
        // lock: an IfValueSource is NOT projectable, so this only compiles
        // because the collapse produced a Boolean. issue 1 priority 2 →
        // `(priority = 2) and true` → true.
        const expected = [{ id: 1, flag: true }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, flag: tIssue.priority.equalsIfValue(2).and(true) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority = ? and ? as flag from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            true,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; flag: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('if-value-value-when-no-value-if-value-stays-if-value', async () => {
        // `IfValueSource.valueWhenNoValue(IfValueSource)` stays an IfValueSource.
        // The receiver carries no value (`equalsIfValue(undefined)`), so the
        // fallback IfValue (`priority = 2`, which HAS a value) is what reaches
        // the WHERE → ids 1 and 4. `let w` pins the stays-If type.
        const expected = [{ id: 1 }, { id: 4 }]
        ctx.mockNext(expected)
        const noStatus: string | undefined = undefined
        let w = tIssue.status.equalsIfValue(noStatus)
        w = w.valueWhenNoValue(tIssue.priority.equalsIfValue(2))
        const result = await ctx.conn.selectFrom(tIssue)
            .where(w)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('if-value-or-boolean-literal-collapses-to-boolean', async () => {
        // `IfValueSource.or(boolean literal)` collapses to a BooleanValueSource.
        // Projecting the result is the type lock (an IfValueSource is not
        // projectable). issue 1 priority 2 → `(priority = 2) or false` → true.
        const expected = [{ id: 1, flag: true }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, flag: tIssue.priority.equalsIfValue(2).or(false) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority = ? or ? as flag from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            false,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; flag: boolean }>>>()
        expect(result).toEqual(expected)
    })
})
