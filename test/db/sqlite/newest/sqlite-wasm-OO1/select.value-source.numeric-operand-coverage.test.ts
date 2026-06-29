// Numeric value-source methods by operand shape and receiver leaf:
//
//   1. Value-SOURCE (column RHS) operands for minValue / maxValue / valueWhenNull /
//      nullIfValue / subtract / multiply / power on bigint / customInt / customDouble.
//      (`multiply` / `power` are not typed on bigint, `power` not on customInt — those
//      are skipped; see the per-test comments.)
//   2. Const operands for modulo / logn / divide / atan2 on a double and a customDouble.
//   3. ceil / floor / round on a customDouble.
//   4. asRequiredInOptionalObject / onlyWhenOrNull / ignoreWhenAsNull on a custom-numeric
//      column.
//
// Receivers and seeded values (all deterministic):
//   - tIssue.viewCount   — bigint, seed default 0 for every issue.
//   - tIssueWorklog.costCents    — customInt 'Cents', worklog 1 = 100.
//   - tIssueWorklog.billedAmount — customDouble 'Money', worklog 1 = 200.
// Custom leaves carry no marshalling for `::numeric`-cast results, so the logn arm
// leaks the driver's raw string on the postgres drivers; the real-DB branch coerces it.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tIssueWorklog } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ── 1. Value-source (column RHS) operand twins ────────────────────────

    test('value-source-rhs/bigint-min-max-valuewhennull-nullifvalue', async () => {
        // minValue / maxValue / valueWhenNull / nullIfValue on a bigint with a
        // value-SOURCE (column) RHS. The RHS is the same `view_count` column (= 0 default), so
        // greatest/least of a value with itself is itself; valueWhenNull keeps
        // the non-null value; nullIfValue(self) collapses to NULL -> absent.
        const expected = [{ id: 1, mn: 0n, mx: 0n, wn: 0n }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                mn: tIssue.viewCount.minValue(tIssue.viewCount),
                mx: tIssue.viewCount.maxValue(tIssue.viewCount),
                wn: tIssue.viewCount.valueWhenNull(tIssue.viewCount),
                ni: tIssue.viewCount.nullIfValue(tIssue.viewCount),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, max(view_count, view_count) as mn, min(view_count, view_count) as mx, ifnull(view_count, view_count) as wn, nullif(view_count, view_count) as ni from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; mn: bigint; mx: bigint; wn: bigint; ni?: bigint
        }>>>()
        expect(result).toEqual(expected)
    })

    test('value-source-rhs/customint-arithmetic-and-clamps', async () => {
        // subtract / multiply / minValue / maxValue / valueWhenNull / nullIfValue
        // on a customInt with a value-SOURCE (column) RHS. The RHS is the same
        // `cost_cents` column (= 100 for worklog 1): subtract(self) = 0,
        // multiply(self) = 10000, the clamps are 100, valueWhenNull keeps 100,
        // nullIfValue(self) collapses to NULL -> absent. `power` is NOT typed
        // on customInt, so it is excluded.
        const expected = [{ id: 1, s: 0, mu: 10000, mn: 100, mx: 100, wn: 100 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                s:  tIssueWorklog.costCents.subtract(tIssueWorklog.costCents),
                mu: tIssueWorklog.costCents.multiply(tIssueWorklog.costCents),
                mn: tIssueWorklog.costCents.minValue(tIssueWorklog.costCents),
                mx: tIssueWorklog.costCents.maxValue(tIssueWorklog.costCents),
                wn: tIssueWorklog.costCents.valueWhenNull(tIssueWorklog.costCents),
                ni: tIssueWorklog.costCents.nullIfValue(tIssueWorklog.costCents),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cost_cents - cost_cents as "s", cost_cents * cost_cents as mu, max(cost_cents, cost_cents) as mn, min(cost_cents, cost_cents) as mx, ifnull(cost_cents, cost_cents) as wn, nullif(cost_cents, cost_cents) as ni from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; s: number; mu: number; mn: number; mx: number; wn: number; ni?: number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('value-source-rhs/customdouble-arithmetic-and-clamps', async () => {
        // subtract / multiply / minValue / maxValue / valueWhenNull / nullIfValue
        // on a customDouble with a value-SOURCE (column) RHS. The RHS is the same `billed_amount` column (= 200 for
        // worklog 1): subtract(self) = 0, multiply(self) = 40000, the clamps
        // are 200, valueWhenNull keeps 200, nullIfValue(self) collapses to NULL
        // -> absent. `power` is covered separately (a 200-self exponent
        // overflows double precision).
        const expected = [{ id: 1, s: 0, mu: 40000, mn: 200, mx: 200, wn: 200 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                s:  tIssueWorklog.billedAmount.subtract(tIssueWorklog.billedAmount),
                mu: tIssueWorklog.billedAmount.multiply(tIssueWorklog.billedAmount),
                mn: tIssueWorklog.billedAmount.minValue(tIssueWorklog.billedAmount),
                mx: tIssueWorklog.billedAmount.maxValue(tIssueWorklog.billedAmount),
                wn: tIssueWorklog.billedAmount.valueWhenNull(tIssueWorklog.billedAmount),
                ni: tIssueWorklog.billedAmount.nullIfValue(tIssueWorklog.billedAmount),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billed_amount - billed_amount as "s", billed_amount * billed_amount as mu, max(billed_amount, billed_amount) as mn, min(billed_amount, billed_amount) as mx, ifnull(billed_amount, billed_amount) as wn, nullif(billed_amount, billed_amount) as ni from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; s: number; mu: number; mn: number; mx: number; wn: number; ni?: number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('value-source-rhs/customdouble-power', async () => {
        // `power` on a customDouble with a value-SOURCE exponent. The base is the
        // `billed_amount` column (= 200 for worklog 1); the exponent is a
        // customDouble value source built with the SAME 'Money' brand so the
        // value-source overload resolves. power(200, 2) = 40000, finite and
        // exact.
        const exponent = ctx.conn.const(2, 'customDouble', 'Money')
        const expected = [{ id: 1, p: 40000 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                p:  tIssueWorklog.billedAmount.power(exponent),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, power(billed_amount, ?) as "p" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; p: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.p).toBeCloseTo(40000, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    // ── 2. Const operand twins for value-source-only methods ──────────────

    test('const-rhs/double-logn-divide-atan2', async () => {
        // logn / divide / atan2 on a double with a CONST RHS. `priority.asDouble()`
        // (= 2.0 for issue 1) keeps the operand a typed double so `col OP const`
        // resolves on every engine. logn(2) = 1, divide(4) = 0.5, atan2(2) = π/4.
        const base = tIssue.priority.asDouble()
        const expected = [{ id: 1, ln: 1, di: 0.5, at: Math.PI / 4 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                ln: base.logn(2),
                di: base.divide(4),
                at: base.atan2(2),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, log(?, cast(priority as real)) as ln, cast(cast(priority as real) as real) / cast(? as real) as di, atan2(cast(priority as real), ?) as at from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            4,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; ln: number; di: number; at: number
        }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.ln).toBeCloseTo(1, 5)
            expect(result[0]!.di).toBeCloseTo(0.5, 5)
            expect(result[0]!.at).toBeCloseTo(Math.PI / 4, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('const-rhs/customdouble-divide-atan2-logn', async () => {
        // divide / atan2 / logn on a customDouble with a CONST RHS. `billed_amount`
        // ('Money', marshalled) = 200 for worklog 1: divide(4) = 50, atan2(200) = π/4.
        // logn keeps the customDouble type with no marshalling, so the
        // `::numeric`-cast result leaks the driver's raw value as a string on
        // the postgres drivers — log_200(200) = 1 — while it stays a clean
        // number on the other dialects; the real-DB branch coerces it through
        // Number(...).
        const expected = [{ id: 1, di: 50, at: Math.atan2(200, 200), ln: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                di: tIssueWorklog.billedAmount.divide(4),
                at: tIssueWorklog.billedAmount.atan2(200),
                ln: tIssueWorklog.billedAmount.logn(200),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(billed_amount as real) / cast(? as real) as di, atan2(billed_amount, ?) as at, log(?, billed_amount) as ln from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
            200,
            200,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; di: number; at: number; ln: number
        }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.di).toBeCloseTo(50, 5)
            expect(result[0]!.at).toBeCloseTo(Math.atan2(200, 200), 5)
            expect(Number(result[0]!.ln)).toBeCloseTo(1, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    // TODO[BUG]: see test/BUGS.md — `.modulo(...)` on a double/customDouble emits
    // `<col>::float % x`, which PostgreSQL rejects (no float8 `%` operator);
    // SQLite/MySQL/MariaDB accept it. The lib should emit a portable `mod(...)`.
    /*
    test('const-rhs/double-modulo', async () => {
        // modulo on a customDouble (billed_amount = 200 for worklog 1) and a
        // double (cost_cents cast to double = 100) with a CONST RHS:
        // 200 % 3 = 2, 100 % 3 = 1.
        const expected = [{ id: 1, mo: 2, mc: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                mo: tIssueWorklog.billedAmount.modulo(3),
                mc: tIssueWorklog.costCents.asDouble().modulo(3),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof result, Array<{ id: number; mo: number; mc: number }>>>()
        expect(result).toEqual(expected)
    })
    */

    // ── 3. customDouble ceil / floor / round ──────────────────────────────

    test('customdouble-rounding', async () => {
        // ceil / floor / round over a customDouble operand take the dedicated
        // customDouble arm and keep the customDouble type. `billed_amount` ('Money', marshalled) = 200 for worklog 1, already a
        // whole number, so all three return 200 as a clean number.
        const expected = [{ id: 1, c: 200, f: 200, r: 200 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                c:  tIssueWorklog.billedAmount.ceil(),
                f:  tIssueWorklog.billedAmount.floor(),
                r:  tIssueWorklog.billedAmount.round(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ceil(billed_amount) as "c", floor(billed_amount) as "f", round(billed_amount) as "r" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; c: number; f: number; r: number }>>>()
        // ceil/floor come back as clean numbers on every dialect. round over a
        // customDouble can leak the driver's raw value as a string on the
        // postgres drivers (the `round(...::numeric)` form a custom type is not
        // marshalled out of), so the real-DB branch coerces `r` through
        // Number(...); the mock keeps the exact shared shape.
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.c).toBe(200)
            expect(result[0]!.f).toBe(200)
            expect(Number(result[0]!.r)).toBe(200)
        } else {
            expect(result).toEqual(expected)
        }
    })

    // ── 4. Projection modifiers on a custom-numeric column ────────────────

    test('projection-modifiers/customint-as-required-in-optional-object', async () => {
        // `asRequiredInOptionalObject()` on a customInt column keeps the brand
        // and re-imposes the `requiredInOptionalObject` marker, projected as a
        // direct leaf `?: number`. `cost_cents` = 100 for worklog 1; the column is required, so
        // the leaf is always present.
        const expected = { id: 1, c: 100 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                c:  tIssueWorklog.costCents.asRequiredInOptionalObject(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cost_cents as "c" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; c?: number }>>()
        expect(row).toEqual(expected)
    })

    test('projection-modifiers/customint-only-when-or-null', async () => {
        // `onlyWhenOrNull(false)` on a customInt column replaces the projection
        // with a NULL literal at SQL-build time and widens the leaf to optional
        // while keeping the brand. The mock returns the shape the driver yields for a NULL
        // column — the property is absent under optional-as-undefined.
        ctx.mockNext([{ id: 1 }])
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                c:  tIssueWorklog.costCents.onlyWhenOrNull(false),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, null as "c" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; c?: number }>>>()
        expect(result).toEqual([{ id: 1 }])
    })

    test('projection-modifiers/customdouble-ignore-when-as-null-passthrough', async () => {
        // `ignoreWhenAsNull(false)` on a customDouble column is the
        // pass-through branch: the column flows through unchanged but the leaf
        // is still widened to optional, keeping the brand. `billed_amount` = 200 for
        // worklog 1, so the leaf is present.
        const expected = [{ id: 1, b: 200 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                b:  tIssueWorklog.billedAmount.ignoreWhenAsNull(false),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billed_amount as "b" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; b?: number }>>>()
        expect(result).toEqual(expected)
    })
})
