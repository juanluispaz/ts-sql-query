// Operations that DERIVE a new value type from the receiver's own type — as
// opposed to the ones that just carry it along — applied to expressions built
// with a CUSTOM data type (`customInt` / `customDouble` / `customLocalDateTime`)
// and a per-value `TypeAdapter`.
//
// The derived kinds exercised here:
//   - `add` (and the rest of the overloaded-number operators): a `customInt` /
//     `customDouble` receiver keeps its own type, so the bound operand is
//     marshalled with the receiver's type name too.
//   - `ceil` / `floor`: same rule, no bound operand.
//   - `divide` / `modulo`: a `customDouble` receiver keeps its own type; the
//     modulo emission additionally picks its floating-point form from it.
//   - `getFullYear` on a `customLocalDateTime`: the result is a plain `int`,
//     while the receiver's own temporal kind still decides how the date part
//     is spelled.
//
// How the type name is observed: `scaledByTypeName` scales a number by 100 only
// when the type name it receives is `Cents` or `Money`. So the bound param and
// the value read back are both scaled when the expression carries its custom
// type, and unscaled when it does not. The mock queues the RAW value the
// database would answer and the test asserts the value AFTER the adapter, which
// makes the single unconditional `expect(...)` cover the mock round-trip and
// the real-DB result at once.
//
// Seed used: `issue_worklog` holds cost_cents 100 / 100 / 400 (sum 600) and
// billed_amount 200 / 50 / 200 (sum 450); `project_release` holds
// signed_off_at 2024-01-14 12:30, NULL and 2024-02-28 09:00 (max in 2024).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { TypeAdapter } from '../../../../../src/TypeAdapter.js'
import { tIssueWorklog, tProjectRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

// Scales a number by 100 in both directions, but ONLY when the type name it is
// handed is `Cents` or `Money`; every other type name is delegated to `next`
// untouched. Because the transform is conditional on the type name, the value
// the adapter produces records which type name the expression carried.
const scaledByTypeName: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        if ((context.originalType === 'Cents' || context.originalType === 'Money') && typeof v === 'number') {
            return v / 100
        }
        return v
    },
    transformValueToDB(value, context, next) {
        if ((context.originalType === 'Cents' || context.originalType === 'Money') && typeof value === 'number') {
            return next.transformValueToDB(value * 100, context)
        }
        return next.transformValueToDB(value, context)
    },
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ── aggregateFragmentWithType(customKind, typeName, required, adapter) ──

    test('aggregate-fragment/custom-int-add-keeps-custom-int', async () => {
        // sum(cost_cents) = 600 as a `Cents` aggregate, plus 9 `Cents`. The
        // operand is bound as `Cents` (9 -> 900) and the answer 1500 reads back
        // as 15.
        ctx.mockNext(1500)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.costCents})`
                    .add(9),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (sum(cost_cents)) + ? as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(15)
    })

    test('aggregate-fragment/custom-int-ceil-keeps-custom-int', async () => {
        // ceil(sum(cost_cents)) = 600 as a `Cents` aggregate; no bound operand,
        // the answer reads back as 6.
        ctx.mockNext(600)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.costCents})`
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(sum(cost_cents)) as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(6)
    })

    test('aggregate-fragment/custom-double-add-keeps-custom-double', async () => {
        // sum(billed_amount) = 450 as a `Money` aggregate, plus 5 `Money`. The
        // operand is bound as `Money` (5 -> 500) and the answer 950 reads back
        // as 9.5.
        ctx.mockNext(950)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.billedAmount})`
                    .add(5),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (sum(billed_amount)) + ? as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(9.5)
    })

    test('aggregate-fragment/custom-double-floor-keeps-custom-double', async () => {
        // floor(sum(billed_amount)) = 450 as a `Money` aggregate; the answer
        // reads back as 4.5.
        ctx.mockNext(450)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.billedAmount})`
                    .floor(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select floor(sum(billed_amount)) as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(4.5)
    })

    test('aggregate-fragment/custom-double-divide-keeps-custom-double', async () => {
        // sum(billed_amount) = 450 as a `Money` aggregate, divided by 3 `Money`.
        // The divisor is bound as `Money` (3 -> 300) and the quotient 1.5 reads
        // back as 0.015.
        ctx.mockNext(1.5)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.billedAmount})`
                    .divide(3),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast((sum(billed_amount)) as double) / ? as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            300,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.015)
    })

    test('aggregate-fragment/custom-double-modulo-keeps-custom-double', async () => {
        // sum(billed_amount) = 450 as a `Money` aggregate, modulo 3 `Money`. The
        // divisor is bound as `Money` (3 -> 300), the remainder 150 reads back as
        // 1.5, and the emitted modulo takes the floating-point form the dialect
        // needs for a fractional operand.
        ctx.mockNext(150)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.billedAmount})`
                    .modulo(3),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (sum(billed_amount)) % ? as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            300,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1.5)
    })

    test('aggregate-fragment/custom-local-date-time-get-full-year', async () => {
        // max(signed_off_at) as a `SignOffStamp` aggregate; the year of the
        // latest sign-off (2024-02-28 09:00) is a plain int, so the adapter
        // leaves it alone.
        ctx.mockNext(2024)
        const v = await ctx.conn.selectFrom(tProjectRelease)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<Date, 'SignOffStamp'>('customLocalDateTime', 'SignOffStamp', 'required', scaledByTypeName)
                    .sql`max(${tProjectRelease.signedOffAt})`
                    .getFullYear(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select year(max(signed_off_at)) as result from project_release"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(2024)
    })

    // ── the same derivation on the sibling construction sites ──────────────

    test('fragment-with-type/custom-int-add-keeps-custom-int', async () => {
        // cost_cents of worklog 1 (100) wrapped in a `Cents` fragment, plus 9
        // `Cents`. The operand is bound as `Cents` (9 -> 900) and the answer
        // 1000 reads back as 10.
        ctx.mockNext(1000)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .add(9),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (cost_cents) + ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(10)
    })

    test('const/custom-double-add-keeps-custom-double', async () => {
        // A `Money` const of 4.5 (bound as 450) plus the `Money` billed_amount
        // of worklog 1 (200); the answer 650 reads back as 6.5. The column
        // operand gives the sum a resolved type on every dialect.
        ctx.mockNext(650)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.const<number, 'Money'>(4.5, 'customDouble', 'Money', scaledByTypeName)
                    .add(tIssueWorklog.billedAmount),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? + billed_amount as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            450,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(6.5)
    })

})
