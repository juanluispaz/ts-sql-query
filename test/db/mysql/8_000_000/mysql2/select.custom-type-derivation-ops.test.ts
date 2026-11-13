// The full operation matrix of the expressions that DERIVE a new data type
// from the receiver's own one, applied to the four construction sites that
// take an inline `TypeAdapter`: `fragmentWithType`, `aggregateFragmentWithType`,
// `const` and `optionalConst`.
//
// What is observed. `scaledByTypeName` multiplies by 100 on the way to the
// database and divides by 100 on the way back, but ONLY when the type NAME it
// is handed is one of `Cents` / `Money` / `Ratio`; every other name is passed
// to `next` untouched. So both the bound parameter and the value read back
// record which type name the expression was carrying at that point:
//
//   - an operation that KEEPS the receiver's custom data type binds its operand
//     as `Cents` / `Money` / `Ratio` (×100) and reads its result back scaled
//     (÷100);
//   - an operation that resolves to a plain `int` / `double` binds and reads
//     the raw number.
//
// A few emissions depend on the data type as well, so the SQL snapshot is the
// observation instead of (or on top of) the value: the modulo of a fractional
// receiver switches to the dialect's floating-point form, an exact operand
// under `average` is cast before averaging, `round` over an exact operand skips
// the tie-break cast on MySQL / MariaDB, `power` leaves a floating base uncast
// on SQL Server, a `customUuid` parameter keeps its uuid marshalling, and the
// date-part getters need the receiver to be recognised as a temporal type at
// all on SQLite.
//
// Two operations are asserted as BOUNDARIES rather than as derivations: `abs`
// carries the receiver's type through unchanged (so the value stays scaled),
// and `sign` always resolves to a plain `int` (so the value never is).
//
// The mock queues the RAW value the database answers and each test asserts the
// value AFTER the adapter, so the single unconditional `expect(...)` covers the
// mock round-trip and the real-DB result at once.
//
// Fixtures. `issue_worklog` row 1 holds cost_cents 100, billed_amount 200 and
// minutes 90; over the three rows cost_cents is 100 / 100 / 400 (average 200)
// and billed_amount is 200 / 50 / 200 (average 150, sum 450). `centsFromId` is
// the worklog's `id * 100` virtual column, so it is 100 on row 1.
// `project_release` row 1 holds released_on 2024-01-15 (a Monday), cutoff_time
// 17:00:00, published_at 2024-01-16 09:00:00 and signing_key
// 0a8f9c1e-1111-4222-8333-444455556666.
//
// The trigonometric receivers read `minutes / 120.0` — the worklog's share of a
// two-hour block, 0.75 on row 1 — so the argument stays inside the domain of
// acos / asin. Their results are irrational, so a `ceil()` is chained to bring
// them back to an exact number; the chained `ceil` keeps the custom data type
// too, so the ÷100 read still applies.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { TypeAdapter } from '../../../../../src/TypeAdapter.js'
import { tIssueWorklog, tProjectRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

// Scales a number by 100 in both directions, but ONLY when the type name it is
// handed is `Cents`, `Money` or `Ratio`; every other type name is delegated to
// `next` untouched. Because the transform is conditional on the type name, the
// value the adapter produces records which type name the expression carried.
const scaledByTypeName: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        if ((context.originalType === 'Cents' || context.originalType === 'Money' || context.originalType === 'Ratio') && typeof v === 'number') {
            return v / 100
        }
        return v
    },
    transformValueToDB(value, context, next) {
        if ((context.originalType === 'Cents' || context.originalType === 'Money' || context.originalType === 'Ratio') && typeof value === 'number') {
            return next.transformValueToDB(value * 100, context)
        }
        return next.transformValueToDB(value, context)
    },
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ── fragmentWithType · customInt ('Cents') · no operand ────────────────

    test('fragment/custom-int-ceil-keeps-custom-int', async () => {
        // ceil(cost_cents) = 100 as a `Cents` fragment; the answer reads back as 1.
        ctx.mockNext(100)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(cost_cents) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('fragment/custom-int-floor-keeps-custom-int', async () => {
        // floor(cost_cents) = 100 as a `Cents` fragment; the answer reads back as 1.
        ctx.mockNext(100)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .floor(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select floor(cost_cents) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('fragment/custom-int-round-keeps-custom-int', async () => {
        // round(cost_cents) = 100 as a `Cents` fragment; the answer reads back as
        // 1. The receiver is an exact numeric expression, which also decides
        // whether the dialect wraps the operand to make the tie-break portable.
        ctx.mockNext(100)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .round(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select round(cost_cents) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('fragment/custom-int-abs-carries-the-custom-int-through', async () => {
        // BOUNDARY: `abs` does not derive a data type, it carries the receiver's
        // one through unchanged, so abs(cost_cents) = 100 still reads back as 1.
        ctx.mockNext(100)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .abs(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(cost_cents) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('fragment/custom-int-sign-drops-to-a-plain-int', async () => {
        // BOUNDARY: `sign` always resolves to a plain `int`, so sign(cost_cents)
        // = 1 is read back unscaled.
        ctx.mockNext(1)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .sign(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sign(cost_cents) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    // ── fragmentWithType · customInt ('Cents') · one operand ───────────────

    test('fragment/custom-int-add-integer-literal', async () => {
        // cost_cents (100) plus 9 `Cents`: the operand is bound as `Cents`
        // (9 -> 900) and the answer 1000 reads back as 10.
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

    test('fragment/custom-int-add-fractional-literal', async () => {
        // A FRACTIONAL literal operand on a `Cents` receiver is still bound as
        // `Cents` (0.5 -> 50), not as a double: 100 + 50 = 150 reads back as 1.5.
        ctx.mockNext(150)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .add(0.5),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (cost_cents) + ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1.5)
    })

    test('fragment/custom-int-add-column-operand', async () => {
        // A COLUMN operand instead of a literal: cost_cents (100) plus the
        // `Cents` virtual column id * 100 (100). No parameter is bound, so the
        // ÷100 read of the answer 200 -> 2 is what records the data type.
        ctx.mockNext(200)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .add(tIssueWorklog.centsFromId),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (cost_cents) + id * 100 as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(2)
    })

    test('fragment/custom-int-subtract-integer-literal', async () => {
        // cost_cents (100) minus 9 `Cents` (bound as 900): -800 reads back as -8.
        ctx.mockNext(-800)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .subtract(9),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (cost_cents) - ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(-8)
    })

    test('fragment/custom-int-subtract-const-operand', async () => {
        // A VALUE-SOURCE operand built with `const`: 0.6 `Cents` is bound as 60
        // by the const's own adapter, so 100 - 60 = 40 reads back as 0.4.
        ctx.mockNext(40)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .subtract(ctx.conn.const<number, 'Cents'>(0.6, 'customInt', 'Cents', scaledByTypeName)),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (cost_cents) - ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            60,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.4)
    })

    test('fragment/custom-int-multiply-integer-literal', async () => {
        // cost_cents (100) times 2 `Cents` (bound as 200): 20000 reads back as
        // 200. The scaling cancels out in the product, so the bound parameter is
        // where the data type shows.
        ctx.mockNext(20000)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .multiply(2),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (cost_cents) * ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            200,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(200)
    })

    test('fragment/custom-int-multiply-column-operand', async () => {
        // cost_cents (100) times the `Cents` virtual column id * 100 (100):
        // 10000 reads back as 100.
        ctx.mockNext(10000)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .multiply(tIssueWorklog.centsFromId),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (cost_cents) * id * 100 as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(100)
    })

    test('fragment/custom-int-modulo-integer-literal', async () => {
        // cost_cents (100) modulo 7 `Cents` (bound as 700): 100 reads back as 1.
        // An integer operand on an exact receiver keeps the plain modulo form.
        ctx.mockNext(100)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .modulo(7),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (cost_cents) % ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            700,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('fragment/custom-int-modulo-fractional-literal', async () => {
        // A FRACTIONAL operand switches the emitted modulo to the dialect's
        // floating-point form even on an integer-backed receiver, while the
        // operand is still bound as `Cents` (0.6 -> 60): 100 % 60 = 40 reads
        // back as 0.4.
        ctx.mockNext(40)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .modulo(0.6),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (cost_cents) % ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            60,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.4)
    })

    test('fragment/custom-int-modulo-const-operand', async () => {
        // The same modulo with a VALUE-SOURCE operand: 0.6 `Cents` is bound as
        // 60, and 100 % 60 = 40 reads back as 0.4.
        ctx.mockNext(40)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .modulo(ctx.conn.const<number, 'Cents'>(0.6, 'customInt', 'Cents', scaledByTypeName)),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (cost_cents) % ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            60,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.4)
    })

    test('fragment/custom-int-min-value-integer-literal', async () => {
        // minValue raises cost_cents (100) to at least 3 `Cents` (bound as 300),
        // so the answer 300 reads back as 3.
        ctx.mockNext(300)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .minValue(3),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select greatest(cost_cents, ?) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            300,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(3)
    })

    test('fragment/custom-int-min-value-column-operand', async () => {
        // minValue with a COLUMN operand: cost_cents (100) against the `Cents`
        // virtual column id * 100 (100), so the answer 100 reads back as 1.
        ctx.mockNext(100)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .minValue(tIssueWorklog.centsFromId),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select greatest(cost_cents, id * 100) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('fragment/custom-int-max-value-integer-literal', async () => {
        // maxValue caps cost_cents (100) at 3 `Cents` (bound as 300), so the
        // answer 100 reads back as 1.
        ctx.mockNext(100)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .maxValue(3),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select least(cost_cents, ?) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            300,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('fragment/custom-int-max-value-column-operand', async () => {
        // maxValue with a COLUMN operand: cost_cents (100) against the `Cents`
        // virtual column id * 100 (100), so the answer 100 reads back as 1.
        ctx.mockNext(100)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .maxValue(tIssueWorklog.centsFromId),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select least(cost_cents, id * 100) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('fragment/custom-int-average-casts-the-exact-operand', async () => {
        // `average` over an EXACT operand casts it before averaging so every
        // engine answers a fractional scalar; the emitted cast is what records
        // the receiver's data type here. The result itself is a plain `double`,
        // so the average of cost_cents {100, 100, 400} reads back unscaled.
        ctx.mockNext({ av: 200 })
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                av: ctx.conn.average(
                    ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                        .sql`${tIssueWorklog.costCents}`,
                ),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select avg((cost_cents * 1.0e0)) as av from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { av?: number }>>()
        expect(row).toEqual({ av: 200 })
    })

    // ── fragmentWithType · customDouble ('Money') · no operand ─────────────

    test('fragment/custom-double-ceil-keeps-custom-double', async () => {
        // ceil(billed_amount) = 200 as a `Money` fragment; the answer reads back as 2.
        ctx.mockNext(200)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(billed_amount) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(2)
    })

    test('fragment/custom-double-floor-keeps-custom-double', async () => {
        // floor(billed_amount) = 200 as a `Money` fragment; the answer reads back as 2.
        ctx.mockNext(200)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .floor(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select floor(billed_amount) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(2)
    })

    test('fragment/custom-double-round-keeps-custom-double', async () => {
        // round(billed_amount) = 200 as a `Money` fragment; the answer reads back as 2.
        ctx.mockNext(200)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .round(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select round(cast(billed_amount as decimal(65, 30))) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(2)
    })

    test('fragment/custom-double-abs-carries-the-custom-double-through', async () => {
        // BOUNDARY: `abs` carries the receiver's data type through unchanged, so
        // abs(billed_amount) = 200 still reads back as 2.
        ctx.mockNext(200)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .abs(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select abs(billed_amount) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(2)
    })

    test('fragment/custom-double-sign-drops-to-a-plain-int', async () => {
        // BOUNDARY: `sign` always resolves to a plain `int`, so
        // sign(billed_amount) = 1 is read back unscaled.
        ctx.mockNext(1)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .sign(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sign(billed_amount) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('fragment/custom-double-sqrt-keeps-custom-double', async () => {
        // sqrt over billed_amount * 2 (400) is exactly 20, which reads back as 0.2.
        ctx.mockNext(20)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount} * 2`
                    .sqrt(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sqrt(billed_amount * 2) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.2)
    })

    test('fragment/custom-double-cbrt-keeps-custom-double', async () => {
        // cbrt(billed_amount) = 5.848…; the chained ceil brings it to 6, which
        // reads back as 0.06.
        ctx.mockNext(6)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .cbrt()
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(sign(billed_amount) * power(abs(billed_amount), 1.0e0 / 3.0e0)) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.06)
    })

    test('fragment/custom-double-ln-keeps-custom-double', async () => {
        // ln(billed_amount) = 5.298…; the chained ceil brings it to 6, which
        // reads back as 0.06.
        ctx.mockNext(6)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .ln()
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(ln(billed_amount)) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.06)
    })

    test('fragment/custom-double-log10-keeps-custom-double', async () => {
        // log10(billed_amount) = 2.301…; the chained ceil brings it to 3, which
        // reads back as 0.03.
        ctx.mockNext(3)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .log10()
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(log10(billed_amount)) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.03)
    })

    test('fragment/custom-double-exp-keeps-custom-double', async () => {
        // exp over the worklog's share of a two-hour block (90 / 120 = 0.75) is
        // 2.117…; the chained ceil brings it to 3, which reads back as 0.03.
        ctx.mockNext(3)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Ratio'>('customDouble', 'Ratio', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.minutes} / 120.0`
                    .exp()
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(exp(minutes / 120.0)) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.03)
    })

    test('fragment/custom-double-acos-keeps-custom-double', async () => {
        // acos(0.75) = 0.7227…; the chained ceil brings it to 1, which reads
        // back as 0.01.
        ctx.mockNext(1)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Ratio'>('customDouble', 'Ratio', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.minutes} / 120.0`
                    .acos()
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(acos(minutes / 120.0)) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.01)
    })

    test('fragment/custom-double-asin-keeps-custom-double', async () => {
        // asin(0.75) = 0.8480…; the chained ceil brings it to 1, which reads
        // back as 0.01.
        ctx.mockNext(1)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Ratio'>('customDouble', 'Ratio', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.minutes} / 120.0`
                    .asin()
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(asin(minutes / 120.0)) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.01)
    })

    test('fragment/custom-double-atan-keeps-custom-double', async () => {
        // atan(0.75) = 0.6435…; the chained ceil brings it to 1, which reads
        // back as 0.01.
        ctx.mockNext(1)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Ratio'>('customDouble', 'Ratio', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.minutes} / 120.0`
                    .atan()
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(atan(minutes / 120.0)) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.01)
    })

    test('fragment/custom-double-cos-keeps-custom-double', async () => {
        // cos(0.75) = 0.7316…; the chained ceil brings it to 1, which reads
        // back as 0.01.
        ctx.mockNext(1)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Ratio'>('customDouble', 'Ratio', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.minutes} / 120.0`
                    .cos()
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(cos(minutes / 120.0)) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.01)
    })

    test('fragment/custom-double-cot-keeps-custom-double', async () => {
        // cot(0.75) = 1.0734…; the chained ceil brings it to 2, which reads
        // back as 0.02.
        ctx.mockNext(2)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Ratio'>('customDouble', 'Ratio', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.minutes} / 120.0`
                    .cot()
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(cot(minutes / 120.0)) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.02)
    })

    test('fragment/custom-double-sin-keeps-custom-double', async () => {
        // sin(0.75) = 0.6816…; the chained ceil brings it to 1, which reads
        // back as 0.01.
        ctx.mockNext(1)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Ratio'>('customDouble', 'Ratio', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.minutes} / 120.0`
                    .sin()
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(sin(minutes / 120.0)) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.01)
    })

    test('fragment/custom-double-tan-keeps-custom-double', async () => {
        // tan(0.75) = 0.9316…; the chained ceil brings it to 1, which reads
        // back as 0.01.
        ctx.mockNext(1)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Ratio'>('customDouble', 'Ratio', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.minutes} / 120.0`
                    .tan()
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(tan(minutes / 120.0)) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.01)
    })

    // ── fragmentWithType · customDouble ('Money') · one operand ────────────

    test('fragment/custom-double-add-integer-literal', async () => {
        // billed_amount (200) plus 5 `Money` (bound as 500): 700 reads back as 7.
        ctx.mockNext(700)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .add(5),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (billed_amount) + ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(7)
    })

    test('fragment/custom-double-add-fractional-literal', async () => {
        // A FRACTIONAL literal on a `Money` receiver is bound as `Money`
        // (0.5 -> 50): 200 + 50 = 250 reads back as 2.5.
        ctx.mockNext(250)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .add(0.5),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (billed_amount) + ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(2.5)
    })

    test('fragment/custom-double-add-column-operand', async () => {
        // A COLUMN operand: billed_amount (200) plus itself is 400, which reads
        // back as 4. No parameter is bound, so the ÷100 read is the observation.
        ctx.mockNext(400)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .add(tIssueWorklog.billedAmount),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (billed_amount) + billed_amount as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(4)
    })

    test('fragment/custom-double-subtract-fractional-literal', async () => {
        // billed_amount (200) minus 0.5 `Money` (bound as 50): 150 reads back as 1.5.
        ctx.mockNext(150)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .subtract(0.5),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (billed_amount) - ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1.5)
    })

    test('fragment/custom-double-subtract-const-operand', async () => {
        // A VALUE-SOURCE operand: 1.5 `Money` is bound as 150 by the const's own
        // adapter, so 200 - 150 = 50 reads back as 0.5.
        ctx.mockNext(50)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .subtract(ctx.conn.const<number, 'Money'>(1.5, 'customDouble', 'Money', scaledByTypeName)),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (billed_amount) - ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            150,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.5)
    })

    test('fragment/custom-double-multiply-fractional-literal', async () => {
        // billed_amount (200) times 0.02 `Money` (bound as 2): 400 reads back as
        // 4. The scaling cancels out in the product, so the bound parameter is
        // where the data type shows.
        ctx.mockNext(400)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .multiply(0.02),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (billed_amount) * ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(4)
    })

    test('fragment/custom-double-multiply-column-operand', async () => {
        // billed_amount (200) times itself is 40000, which reads back as 400.
        ctx.mockNext(40000)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .multiply(tIssueWorklog.billedAmount),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (billed_amount) * billed_amount as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(400)
    })

    test('fragment/custom-double-divide-integer-literal', async () => {
        // billed_amount (200) divided by 2 `Money` (bound as 200): 1 reads back
        // as 0.01. Neither operand is known to be floating point, so the
        // dividend is cast to keep the division fractional on every engine.
        ctx.mockNext(1)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .divide(2),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ((billed_amount) * 1.0e0) / ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            200,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.01)
    })

    test('fragment/custom-double-divide-const-operand', async () => {
        // A VALUE-SOURCE divisor: 0.5 `Money` is bound as 50, so 200 / 50 = 4
        // reads back as 0.04.
        ctx.mockNext(4)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .divide(ctx.conn.const<number, 'Money'>(0.5, 'customDouble', 'Money', scaledByTypeName)),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ((billed_amount) * 1.0e0) / ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.04)
    })

    test('fragment/custom-double-modulo-integer-literal', async () => {
        // A fractional RECEIVER takes the dialect's floating-point modulo form
        // even against an INTEGER literal, which is bound as `Money`
        // (3 -> 300): 200 % 300 = 200 reads back as 2.
        ctx.mockNext(200)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .modulo(3),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (billed_amount) % ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            300,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(2)
    })

    test('fragment/custom-double-modulo-fractional-literal', async () => {
        // The same floating-point modulo form with a FRACTIONAL literal, bound
        // as `Money` (0.7 -> 70): 200 % 70 = 60 reads back as 0.6.
        ctx.mockNext(60)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .modulo(0.7),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (billed_amount) % ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            70,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.6)
    })

    test('fragment/custom-double-modulo-const-operand', async () => {
        // The same modulo with a VALUE-SOURCE divisor: 1.5 `Money` is bound as
        // 150, so 200 % 150 = 50 reads back as 0.5.
        ctx.mockNext(50)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .modulo(ctx.conn.const<number, 'Money'>(1.5, 'customDouble', 'Money', scaledByTypeName)),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (billed_amount) % ? as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            150,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.5)
    })

    test('fragment/custom-double-min-value-integer-literal', async () => {
        // minValue raises billed_amount (200) to at least 3 `Money` (bound as
        // 300), so the answer 300 reads back as 3.
        ctx.mockNext(300)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .minValue(3),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select greatest(billed_amount, ?) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            300,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(3)
    })

    test('fragment/custom-double-max-value-const-operand', async () => {
        // maxValue caps billed_amount (200) at the 1.5 `Money` const (bound as
        // 150), so the answer 150 reads back as 1.5.
        ctx.mockNext(150)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .maxValue(ctx.conn.const<number, 'Money'>(1.5, 'customDouble', 'Money', scaledByTypeName)),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select least(billed_amount, ?) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            150,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1.5)
    })

    test('fragment/custom-double-max-value-integer-literal', async () => {
        // maxValue caps billed_amount (200) at 3 `Money` (bound as 300), so the
        // answer 200 reads back as 2.
        ctx.mockNext(200)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .maxValue(3),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select least(billed_amount, ?) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            300,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(2)
    })

    test('fragment/custom-double-power-keeps-custom-double', async () => {
        // A floating-point base is left uncast on the dialects that would
        // otherwise compute the power in the base's own exact type. The exponent
        // is bound as `Ratio` (0.02 -> 2), so 0.75 ^ 2 = 0.5625 reads back as
        // 0.005625.
        ctx.mockNext(0.5625)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Ratio'>('customDouble', 'Ratio', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.minutes} / 120.0`
                    .power(0.02),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select power(minutes / 120.0, ?) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.005625)
    })

    test('fragment/custom-double-logn-keeps-custom-double', async () => {
        // The base is bound as `Money` (0.02 -> 2), so the logarithm of
        // billed_amount (200) in base 2 is 7.643…; the chained ceil brings it to
        // 8, which reads back as 0.08.
        ctx.mockNext(8)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .logn(0.02)
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(log(?, billed_amount)) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.08)
    })

    test('fragment/custom-double-roundn-literal-precision', async () => {
        // The precision is bound as `Money` (0.02 -> 2), so billed_amount (200)
        // rounded to 2 decimals is 200, which reads back as 2.
        ctx.mockNext(200)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .roundn(0.02),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select round(cast(billed_amount as decimal(65, 30)), ?) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(2)
    })

    test('fragment/custom-double-roundn-number-value-source-precision', async () => {
        // The other `roundn` overload takes a plain number VALUE SOURCE as the
        // precision: the worklog's issue_id (1), so billed_amount (200) rounded
        // to one decimal is 200, which reads back as 2.
        ctx.mockNext(200)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .roundn(tIssueWorklog.issueId),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select round(cast(billed_amount as decimal(65, 30)), issue_id) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(2)
    })

    test('fragment/custom-double-atan2-keeps-custom-double', async () => {
        // The second argument is bound as `Money` (1 -> 100), so
        // atan2(200, 100) = 1.107…; the chained ceil brings it to 2, which reads
        // back as 0.02.
        ctx.mockNext(2)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .atan2(1)
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(atan2(billed_amount, ?)) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.02)
    })

    test('fragment/custom-double-average-leaves-the-operand-uncast', async () => {
        // BOUNDARY to the `Cents` average above: a custom DOUBLE says nothing
        // about whether the underlying column is exact or approximate, so the
        // operand is averaged as it stands, with no cast. The average of
        // billed_amount {200, 50, 200} is a plain `double` and reads back
        // unscaled.
        ctx.mockNext({ av: 150 })
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                av: ctx.conn.average(
                    ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                        .sql`${tIssueWorklog.billedAmount}`,
                ),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select avg(billed_amount) as av from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { av?: number }>>()
        expect(row).toEqual({ av: 150 })
    })

    // ── fragmentWithType · optional receivers ──────────────────────────────

    test('fragment/optional-custom-int-add-keeps-custom-int-and-optional', async () => {
        // The `optional` form of the same fragment: the operand is still bound
        // as `Cents` (9 -> 900) and the answer 1000 still reads back as 10, but
        // the projected leaf is optional.
        ctx.mockNext({ v: 1000 })
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                v: ctx.conn.fragmentWithType<number, 'Cents'>('customInt', 'Cents', 'optional', scaledByTypeName)
                    .sql`${tIssueWorklog.costCents}`
                    .add(9),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (cost_cents) + ? as v from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
            1,
          ]
        `)
        assertType<Exact<typeof row, { v?: number }>>()
        expect(row).toEqual({ v: 10 })
    })

    test('fragment/optional-custom-double-min-value-guards-the-null', async () => {
        // An OPTIONAL receiver makes minValue emit the dialect's null guard
        // where the native function would otherwise ignore a NULL operand. The
        // operand is still bound as `Money` (3 -> 300) and the answer 300 still
        // reads back as 3.
        ctx.mockNext({ v: 300 })
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                v: ctx.conn.fragmentWithType<number, 'Money'>('customDouble', 'Money', 'optional', scaledByTypeName)
                    .sql`${tIssueWorklog.billedAmount}`
                    .minValue(3),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select greatest(billed_amount, ?) as v from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            300,
            1,
          ]
        `)
        assertType<Exact<typeof row, { v?: number }>>()
        expect(row).toEqual({ v: 3 })
    })

    // ── aggregateFragmentWithType ──────────────────────────────────────────

    test('aggregate-fragment/custom-int-round-keeps-custom-int', async () => {
        // round(sum(cost_cents)) = 600 as a `Cents` aggregate; the answer reads
        // back as 6.
        ctx.mockNext(600)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.costCents})`
                    .round(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select round(sum(cost_cents)) as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(6)
    })

    test('aggregate-fragment/custom-int-subtract-integer-literal', async () => {
        // sum(cost_cents) = 600 minus 1 `Cents` (bound as 100): 500 reads back as 5.
        ctx.mockNext(500)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.costCents})`
                    .subtract(1),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (sum(cost_cents)) - ? as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(5)
    })

    test('aggregate-fragment/custom-int-multiply-integer-literal', async () => {
        // sum(cost_cents) = 600 times 2 `Cents` (bound as 200): 120000 reads
        // back as 1200.
        ctx.mockNext(120000)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.costCents})`
                    .multiply(2),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (sum(cost_cents)) * ? as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            200,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1200)
    })

    test('aggregate-fragment/custom-int-modulo-integer-literal', async () => {
        // sum(cost_cents) = 600 modulo 7 `Cents` (bound as 700): 600 reads back as 6.
        ctx.mockNext(600)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.costCents})`
                    .modulo(7),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (sum(cost_cents)) % ? as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            700,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(6)
    })

    test('aggregate-fragment/custom-int-min-value-integer-literal', async () => {
        // minValue raises sum(cost_cents) = 600 to at least 9 `Cents` (bound as
        // 900), so the answer 900 reads back as 9.
        ctx.mockNext(900)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.costCents})`
                    .minValue(9),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select greatest(sum(cost_cents), ?) as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(9)
    })

    test('aggregate-fragment/custom-int-max-value-integer-literal', async () => {
        // maxValue caps sum(cost_cents) = 600 at 9 `Cents` (bound as 900), so
        // the answer 600 reads back as 6.
        ctx.mockNext(600)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Cents'>('customInt', 'Cents', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.costCents})`
                    .maxValue(9),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select least(sum(cost_cents), ?) as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(6)
    })

    test('aggregate-fragment/custom-double-sqrt-keeps-custom-double', async () => {
        // sum(billed_amount) = 450 as a `Money` aggregate; sqrt(450) = 21.21…,
        // and the chained ceil brings it to 22, which reads back as 0.22.
        ctx.mockNext(22)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.billedAmount})`
                    .sqrt()
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(sqrt(sum(billed_amount))) as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.22)
    })

    test('aggregate-fragment/custom-double-roundn-literal-precision', async () => {
        // The precision is bound as `Money` (0.02 -> 2), so sum(billed_amount) =
        // 450 rounded to 2 decimals is 450, which reads back as 4.5.
        ctx.mockNext(450)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.billedAmount})`
                    .roundn(0.02),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select round(cast(sum(billed_amount) as decimal(65, 30)), ?) as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(4.5)
    })

    test('aggregate-fragment/custom-double-atan2-keeps-custom-double', async () => {
        // The second argument is bound as `Money` (1 -> 100), so
        // atan2(450, 100) = 1.352…; the chained ceil brings it to 2, which reads
        // back as 0.02.
        ctx.mockNext(2)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.billedAmount})`
                    .atan2(1)
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(atan2(sum(billed_amount), ?)) as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.02)
    })

    test('aggregate-fragment/custom-double-min-value-integer-literal', async () => {
        // minValue raises sum(billed_amount) = 450 to at least 9 `Money` (bound
        // as 900), so the answer 900 reads back as 9.
        ctx.mockNext(900)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .selectOneColumn(
                ctx.conn.aggregateFragmentWithType<number, 'Money'>('customDouble', 'Money', 'required', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.billedAmount})`
                    .minValue(9),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select greatest(sum(billed_amount), ?) as result from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(9)
    })

    test('aggregate-fragment/optional-custom-int-add-keeps-custom-int-and-optional', async () => {
        // The `optional` form of the aggregate fragment: the operand is still
        // bound as `Cents` (9 -> 900) and the answer 1500 still reads back as
        // 15, but the projected leaf is optional.
        ctx.mockNext({ v: 1500 })
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                v: ctx.conn.aggregateFragmentWithType<number, 'Cents'>('customInt', 'Cents', 'optional', scaledByTypeName)
                    .sql`sum(${tIssueWorklog.costCents})`
                    .add(9),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (sum(cost_cents)) + ? as v from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            900,
          ]
        `)
        assertType<Exact<typeof row, { v?: number }>>()
        expect(row).toEqual({ v: 15 })
    })

    // ── const / optionalConst ──────────────────────────────────────────────

    test('const/custom-int-ceil-keeps-custom-int', async () => {
        // A `Cents` const of 1 is bound as 100; ceil leaves it alone and the
        // answer 100 reads back as 1.
        ctx.mockNext(100)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.const<number, 'Cents'>(1, 'customInt', 'Cents', scaledByTypeName)
                    .ceil(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ceil(?) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            100,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('const/custom-int-add-column-operand', async () => {
        // A `Cents` const of 0.6 (bound as 60) plus the `Cents` cost_cents of
        // worklog 1 (100): the answer 160 reads back as 1.6. The column operand
        // gives the sum a resolved type on every dialect.
        ctx.mockNext(160)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.const<number, 'Cents'>(0.6, 'customInt', 'Cents', scaledByTypeName)
                    .add(tIssueWorklog.costCents),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? + cost_cents as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            60,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1.6)
    })

    test('const/custom-int-modulo-column-operand', async () => {
        // A `Cents` const of 1.4 (bound as 140) modulo the `Cents` cost_cents of
        // worklog 1 (100): the answer 40 reads back as 0.4.
        ctx.mockNext(40)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.const<number, 'Cents'>(1.4, 'customInt', 'Cents', scaledByTypeName)
                    .modulo(tIssueWorklog.costCents),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? % cost_cents as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            140,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.4)
    })

    test('const/custom-int-min-value-column-operand', async () => {
        // minValue raises a `Cents` const of 0.5 (bound as 50) to at least the
        // `Cents` cost_cents of worklog 1 (100), so the answer 100 reads back as 1.
        ctx.mockNext(100)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.const<number, 'Cents'>(0.5, 'customInt', 'Cents', scaledByTypeName)
                    .minValue(tIssueWorklog.costCents),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select greatest(?, cost_cents) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('const/custom-double-sqrt-keeps-custom-double', async () => {
        // A `Money` const of 4 is bound as 400; sqrt(400) = 20 reads back as 0.2.
        ctx.mockNext(20)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.const<number, 'Money'>(4, 'customDouble', 'Money', scaledByTypeName)
                    .sqrt(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sqrt(?) as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            400,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.2)
    })

    test('const/custom-double-divide-column-operand', async () => {
        // A `Money` const of 8 (bound as 800) divided by the `Money`
        // billed_amount of worklog 1 (200): the answer 4 reads back as 0.04.
        ctx.mockNext(4)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.const<number, 'Money'>(8, 'customDouble', 'Money', scaledByTypeName)
                    .divide(tIssueWorklog.billedAmount),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (? * 1.0e0) / billed_amount as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            800,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0.04)
    })

    test('const/custom-double-modulo-column-operand', async () => {
        // A `Money` const of 5 (bound as 500) modulo the `Money` billed_amount of
        // worklog 1 (200): the answer 100 reads back as 1. A fractional receiver
        // takes the dialect's floating-point modulo form.
        ctx.mockNext(100)
        const v = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .selectOneColumn(
                ctx.conn.const<number, 'Money'>(5, 'customDouble', 'Money', scaledByTypeName)
                    .modulo(tIssueWorklog.billedAmount),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? % billed_amount as result from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('optional-const/custom-int-add-column-operand', async () => {
        // The `optionalConst` sibling: a `Cents` const of 0.6 (bound as 60) plus
        // the `Cents` cost_cents of worklog 1 (100) still reads back as 1.6, and
        // the projected leaf is optional.
        ctx.mockNext({ v: 160 })
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                v: ctx.conn.optionalConst<number, 'Cents'>(0.6, 'customInt', 'Cents', scaledByTypeName)
                    .add(tIssueWorklog.costCents),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? + cost_cents as v from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            60,
            1,
          ]
        `)
        assertType<Exact<typeof row, { v?: number }>>()
        expect(row).toEqual({ v: 1.6 })
    })

    test('optional-const/custom-double-sqrt-keeps-custom-double', async () => {
        // The `optionalConst` sibling of the sqrt case: 4 `Money` is bound as
        // 400 and sqrt(400) = 20 reads back as 0.2 on an optional leaf.
        ctx.mockNext({ v: 20 })
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                v: ctx.conn.optionalConst<number, 'Money'>(4, 'customDouble', 'Money', scaledByTypeName)
                    .sqrt(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sqrt(?) as v from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            400,
            1,
          ]
        `)
        assertType<Exact<typeof row, { v?: number }>>()
        expect(row).toEqual({ v: 0.2 })
    })

    test('optional-const/custom-double-max-value-column-operand', async () => {
        // maxValue caps an OPTIONAL `Money` const of 5 (bound as 500) at the
        // `Money` billed_amount of worklog 1 (200); an optional operand makes
        // the dialect emit its null guard around the comparison, and the answer
        // 200 reads back as 2.
        ctx.mockNext({ v: 200 })
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                v: ctx.conn.optionalConst<number, 'Money'>(5, 'customDouble', 'Money', scaledByTypeName)
                    .maxValue(tIssueWorklog.billedAmount),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select least(?, billed_amount) as v from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            500,
            1,
          ]
        `)
        assertType<Exact<typeof row, { v?: number }>>()
        expect(row).toEqual({ v: 2 })
    })

    // ── temporal customs · the date-part getters ───────────────────────────

    test('fragment/custom-local-date-get-full-year', async () => {
        // released_on 2024-01-15 wrapped in a `ReleaseDay` fragment. The year is
        // a plain int, while the receiver's own temporal data type is what
        // decides how the date part is spelled.
        ctx.mockNext(2024)
        const v = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<Date, 'ReleaseDay'>('customLocalDate', 'ReleaseDay', 'required', scaledByTypeName)
                    .sql`${tProjectRelease.releasedOn}`
                    .getFullYear(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select year(released_on) as result from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(2024)
    })

    test('fragment/custom-local-date-get-month', async () => {
        // released_on 2024-01-15 as a `ReleaseDay` fragment; the month is
        // zero-based, so January is 0.
        ctx.mockNext(0)
        const v = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<Date, 'ReleaseDay'>('customLocalDate', 'ReleaseDay', 'required', scaledByTypeName)
                    .sql`${tProjectRelease.releasedOn}`
                    .getMonth(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select month(released_on) - 1 as result from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0)
    })

    test('fragment/custom-local-date-get-date', async () => {
        // released_on 2024-01-15 as a `ReleaseDay` fragment; the day of the
        // month is 15.
        ctx.mockNext(15)
        const v = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<Date, 'ReleaseDay'>('customLocalDate', 'ReleaseDay', 'required', scaledByTypeName)
                    .sql`${tProjectRelease.releasedOn}`
                    .getDate(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dayofmonth(released_on) as result from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(15)
    })

    test('fragment/custom-local-date-get-day', async () => {
        // released_on 2024-01-15 as a `ReleaseDay` fragment; that date is a
        // Monday and Sunday is 0, so the day of the week is 1.
        ctx.mockNext(1)
        const v = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<Date, 'ReleaseDay'>('customLocalDate', 'ReleaseDay', 'required', scaledByTypeName)
                    .sql`${tProjectRelease.releasedOn}`
                    .getDay(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dayofweek(released_on) - 1 as result from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('fragment/custom-local-time-get-hours', async () => {
        // cutoff_time 17:00:00 wrapped in a `CutoffClock` fragment; the hours
        // are 17.
        ctx.mockNext(17)
        const v = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<Date, 'CutoffClock'>('customLocalTime', 'CutoffClock', 'required', scaledByTypeName)
                    .sql`${tProjectRelease.cutoffTime}`
                    .getHours(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select hour(cutoff_time) as result from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(17)
    })

    test('fragment/custom-local-time-get-minutes', async () => {
        // cutoff_time 17:00:00 as a `CutoffClock` fragment; the minutes are 0.
        ctx.mockNext(0)
        const v = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<Date, 'CutoffClock'>('customLocalTime', 'CutoffClock', 'required', scaledByTypeName)
                    .sql`${tProjectRelease.cutoffTime}`
                    .getMinutes(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select minute(cutoff_time) as result from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0)
    })

    test('fragment/custom-local-time-get-seconds', async () => {
        // cutoff_time 17:00:00 as a `CutoffClock` fragment; the seconds are 0.
        ctx.mockNext(0)
        const v = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<Date, 'CutoffClock'>('customLocalTime', 'CutoffClock', 'required', scaledByTypeName)
                    .sql`${tProjectRelease.cutoffTime}`
                    .getSeconds(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select second(cutoff_time) as result from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0)
    })

    test('fragment/custom-local-date-time-get-hours', async () => {
        // published_at 2024-01-16 09:00:00 wrapped in a `PublishStamp`
        // fragment; the hours are 9.
        ctx.mockNext(9)
        const v = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<Date, 'PublishStamp'>('customLocalDateTime', 'PublishStamp', 'required', scaledByTypeName)
                    .sql`${tProjectRelease.publishedAt}`
                    .getHours(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select hour(published_at) as result from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(9)
    })

    test('fragment/custom-local-date-time-get-minutes', async () => {
        // published_at 2024-01-16 09:00:00 as a `PublishStamp` fragment; the
        // minutes are 0.
        ctx.mockNext(0)
        const v = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<Date, 'PublishStamp'>('customLocalDateTime', 'PublishStamp', 'required', scaledByTypeName)
                    .sql`${tProjectRelease.publishedAt}`
                    .getMinutes(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select minute(published_at) as result from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(0)
    })

    // ── customUuid · the uuid marshalling and rewrites ─────────────────────

    test('const/custom-uuid-parameter-keeps-the-uuid-marshalling', async () => {
        // A `SigningKey` const compared against the release's signing_key. The
        // parameter is marshalled as a uuid, so the dialects that store a uuid
        // in a binary/raw form wrap the placeholder in their conversion
        // function. Release 1 is the row holding that key.
        ctx.mockNext(1)
        const v = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.signingKey.equals(
                ctx.conn.const<string, 'SigningKey'>('0a8f9c1e-1111-4222-8333-444455556666', 'customUuid', 'SigningKey'),
            ))
            .selectOneColumn(tProjectRelease.id)
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from project_release where signing_key = uuid_to_bin(?)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0a8f9c1e-1111-4222-8333-444455556666",
          ]
        `)
        assertType<Exact<typeof v, number>>()
        expect(v).toBe(1)
    })

    test('fragment/custom-uuid-projected-outermost-is-rewritten-back-to-text', async () => {
        // A `SigningKey` fragment over the release's signing_key, projected as
        // the OUTERMOST column: the dialects that store a uuid in a binary/raw
        // form rewrite the outermost projection back to its text spelling.
        ctx.mockNext('0a8f9c1e-1111-4222-8333-444455556666')
        const v = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<string, 'SigningKey'>('customUuid', 'SigningKey', 'required')
                    .sql`${tProjectRelease.signingKey}`,
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select bin_to_uuid(signing_key) as result from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, string>>()
        expect(v).toBe('0a8f9c1e-1111-4222-8333-444455556666')
    })

    test('fragment/custom-uuid-as-string-marks-the-result-as-a-uuid-text', async () => {
        // `asString()` on a `SigningKey` fragment yields a string that still
        // remembers it came from a uuid, which is what makes the dialects
        // storing a uuid in a dedicated type convert it before a string
        // function is applied to it.
        ctx.mockNext('0A8F9C1E-1111-4222-8333-444455556666')
        const v = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .selectOneColumn(
                ctx.conn.fragmentWithType<string, 'SigningKey'>('customUuid', 'SigningKey', 'required')
                    .sql`${tProjectRelease.signingKey}`
                    .asString()
                    .toUpperCase(),
            )
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select upper(bin_to_uuid(signing_key)) as result from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof v, string>>()
        expect(v).toBe('0A8F9C1E-1111-4222-8333-444455556666')
    })

})
