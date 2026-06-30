// Impl-branch coverage of `createSqlOperation1ofOverloadedNumber` (the shared
// dispatcher behind add/subtract/multiply/modulo/maximumBetweenTwoValues/
// minimumBetweenTwoValues) for an INT receiver. When the OTHER operand is a
// non-int value source the dispatcher PROMOTES the result to `double` (rather
// than carrying it as `int`). This is the value-source double-promotion arm,
// previously unexercised: an `int` column added to a `double` column.
//
// The promotion is value-observable: with a fractional right operand the
// fractional result only survives because the operation is carried as double —
// an int carry would lose the fraction. A real DOUBLE COLUMN is used as the
// right operand (not a bare parameter) so the engine resolves `int + double`
// from the column's declared type — strict engines reject an untyped fractional
// parameter added to an integer column, so the column form is the portable one.
//
// Seed: issue 1 has priority 2; estimated_hours is set to 1.5 inside the
// rollback so the promoted result is the fractional 3.5.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('int-receiver-plus-double-column-promotes-result-to-double', async () => {
        // `priority.add(estimatedHours)` — the right operand is a `double`
        // column (a non-int value source), so the dispatcher carries the
        // result as double. With estimated_hours = 1.5, issue 1 priority 2 +
        // 1.5 = 3.5; the fraction survives only because the result is double.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue)
                .set({ estimatedHours: 1.5 })
                .where(tIssue.id.equals(1))
                .executeUpdate()

            const expected = { id: 1, bumped: 3.5 }
            ctx.mockNext({ id: 1, bumped: 3.5 })
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({ id: tIssue.id, bumped: tIssue.priority.add(tIssue.estimatedHours) })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority + estimated_hours as bumped from issue where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; bumped?: number }>>()
            expect(row).toEqual(expected)
        })
    })

    test('int-receiver-multiply-double-column-promotes-result-to-double', async () => {
        // The same value-source promotion arm on a different overloaded op
        // (`multiply`), confirming the branch is shared across the family. With
        // estimated_hours = 2.25, issue 1 priority 2 * 2.25 = 4.5.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue)
                .set({ estimatedHours: 2.25 })
                .where(tIssue.id.equals(1))
                .executeUpdate()

            const expected = { id: 1, scaled: 4.5 }
            ctx.mockNext({ id: 1, scaled: 4.5 })
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({ id: tIssue.id, scaled: tIssue.priority.multiply(tIssue.estimatedHours) })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority * estimated_hours as scaled from issue where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; scaled?: number }>>()
            expect(row).toEqual(expected)
        })
    })

    // TODO[BUG]: see test/BUGS.md — int.modulo(double-column) emits plain
    // `priority % estimated_hours` (PostgreSQL rejects `integer % double
    // precision`); the block below is the intended post-fix canonical body.
    /*
    test('int-receiver-modulo-double-column-promotes-result-to-double', async () => {
        // `priority.modulo(estimatedHours)` — the int-side mirror of the
        // `double % x` arm. The right operand is a `double` column, so the
        // dispatcher promotes the receiver to double and the dialect's `_modulo`
        // override wraps both operands in a numeric cast. With
        // estimated_hours = 1.5, issue 1 priority 2 mod 1.5 = 0.5; the fraction
        // survives only because the operation is carried as double.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue)
                .set({ estimatedHours: 1.5 })
                .where(tIssue.id.equals(1))
                .executeUpdate()

            const expected = { id: 1, rest: 0.5 }
            ctx.mockNext({ id: 1, rest: 0.5 })
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({ id: tIssue.id, rest: tIssue.priority.modulo(tIssue.estimatedHours) })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, mod((priority)::numeric, (estimated_hours)::numeric) as rest from issue where id = $1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; rest?: number }>>()
            expect(row).toEqual(expected)
        })
    })
    */

    test('int-receiver-maxValue-double-column-promotes-result-to-double', async () => {
        // `priority.maxValue(estimatedHours)` caps the receiver from above
        // (maxValue = "no more than x" → `least(...)`) and shares the promotion
        // dispatcher. With estimated_hours = 1.5, least(priority 2, 1.5) = 1.5 —
        // the fractional operand survives only because the result is double.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue)
                .set({ estimatedHours: 1.5 })
                .where(tIssue.id.equals(1))
                .executeUpdate()

            const expected = { id: 1, hi: 1.5 }
            ctx.mockNext({ id: 1, hi: 1.5 })
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({ id: tIssue.id, hi: tIssue.priority.maxValue(tIssue.estimatedHours) })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, least(priority, estimated_hours) as hi from issue where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; hi?: number }>>()
            expect(row).toEqual(expected)
        })
    })

    test('int-receiver-minValue-double-column-promotes-result-to-double', async () => {
        // `priority.minValue(estimatedHours)` floors the receiver from below
        // (minValue = "no less than x" → `greatest(...)`) on the same promotion
        // arm. With estimated_hours = 2.5, greatest(priority 2, 2.5) = 2.5 — the
        // fractional operand survives only because the result is double.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue)
                .set({ estimatedHours: 2.5 })
                .where(tIssue.id.equals(1))
                .executeUpdate()

            const expected = { id: 1, lo: 2.5 }
            ctx.mockNext({ id: 1, lo: 2.5 })
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({ id: tIssue.id, lo: tIssue.priority.minValue(tIssue.estimatedHours) })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, greatest(priority, estimated_hours) as lo from issue where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; lo?: number }>>()
            expect(row).toEqual(expected)
        })
    })
})
