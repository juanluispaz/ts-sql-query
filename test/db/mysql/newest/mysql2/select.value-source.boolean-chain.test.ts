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
})
