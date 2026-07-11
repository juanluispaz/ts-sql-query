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
import { tIssue, tIssueWorklog, tProject } from '../../domain/connection.js'
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, greatest(view_count, view_count) as mn, least(view_count, view_count) as mx, coalesce(view_count, view_count) as wn, nullif(view_count, view_count) as ni from issue where id = $1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cost_cents - cost_cents as "s", cost_cents * cost_cents as mu, greatest(cost_cents, cost_cents) as mn, least(cost_cents, cost_cents) as mx, coalesce(cost_cents, cost_cents) as wn, nullif(cost_cents, cost_cents) as ni from issue_worklog where id = $1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billed_amount - billed_amount as "s", billed_amount * billed_amount as mu, greatest(billed_amount, billed_amount) as mn, least(billed_amount, billed_amount) as mx, coalesce(billed_amount, billed_amount) as wn, nullif(billed_amount, billed_amount) as ni from issue_worklog where id = $1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, power(billed_amount, $1) as "p" from issue_worklog where id = $2"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, log(($1)::numeric, (priority::float)::numeric) as ln, priority::float::float / $2::float as di, atan2(priority::float, $3) as at from issue where id = $4"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billed_amount::float / $1::float as di, atan2(billed_amount, $2) as at, log(($3)::numeric, (billed_amount)::numeric) as ln from issue_worklog where id = $4"`)
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

    test('const-rhs/double-modulo', async () => {
        // modulo on a customDouble (billed_amount = 200 for worklog 1) and a
        // plain double (issue_id cast to double = 1) with a CONST RHS:
        // 200 % 3 = 2, 1 % 3 = 1. A fractional `%` can't run on a float on
        // every engine, so the emitted form casts to numeric / uses mod(...);
        // that result a custom type is not marshalled out of can come back as a
        // string on some drivers, so the real-DB branch coerces both keys
        // through Number(...).
        const expected = [{ id: 1, mo: 2, mc: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                mo: tIssueWorklog.billedAmount.modulo(3),
                mc: tIssueWorklog.issueId.asDouble().modulo(3),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, mod((billed_amount)::numeric, ($1)::numeric) as mo, mod((issue_id::float)::numeric, ($2)::numeric) as mc from issue_worklog where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            3,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; mo: number; mc: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(Number(result[0]!.mo)).toBeCloseTo(2, 5)
            expect(Number(result[0]!.mc)).toBeCloseTo(1, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ceil(billed_amount) as "c", floor(billed_amount) as "f", round((billed_amount)::numeric) as "r" from issue_worklog where id = $1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cost_cents as "c" from issue_worklog where id = $1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, null as "c" from issue_worklog where id = $1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billed_amount as "b" from issue_worklog where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; b?: number }>>>()
        expect(result).toEqual(expected)
    })
    test('value-source-rhs/bigint-modulo', async () => {
        // `modulo` on a bigint with a value-SOURCE RHS (a const bigint 3n).
        // view_count = 0 for issue 1, so 0 % 3 = 0. The bigint `mod(...)` result
        // can leak as a string on some drivers, so the real-DB branch coerces it
        // through BigInt(...).
        const expected = [{ id: 1, mo: 0n }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                mo: tIssue.viewCount.modulo(ctx.conn.const(3n, 'bigint')),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, view_count % $1 as mo from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3n,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; mo: bigint }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(BigInt(result[0]!.mo)).toBe(0n)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('value-source-rhs/bigint-value-when-null-optional-receiver', async () => {
        // `valueWhenNull` with a value-SOURCE arg over an OPTIONAL bigint
        // receiver: coalesce(duration_ms, $1) removes the null, so the result
        // optionality flips to REQUIRED (`bigint`, not `bigint | undefined`).
        // duration_ms = 5400000 for worklog 1.
        const expected = [{ id: 1, wn: 5400000n }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                wn: tIssueWorklog.durationMs.valueWhenNull(ctx.conn.const(0n, 'bigint')),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(duration_ms, $1) as wn from issue_worklog where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0n,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; wn: bigint }>>>()
        expect(result).toEqual(expected)
    })

    test('projection-modifiers/bigint-as-required-in-optional-object', async () => {
        // `asRequiredInOptionalObject()` on a bigint leaf (view_count, required)
        // re-imposes the requiredInOptionalObject marker as a direct `?: bigint`
        // leaf.
        const expected = { id: 1, v: 0n }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                v:  tIssue.viewCount.asRequiredInOptionalObject(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, view_count as "v" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v?: bigint }>>()
        expect(row).toEqual(expected)
    })

    test('projection-modifiers/bigint-only-when-or-null', async () => {
        // `onlyWhenOrNull(false)` on a bigint leaf replaces the projection with a
        // NULL literal at build time and widens the leaf to optional.
        ctx.mockNext([{ id: 1 }])
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                v:  tIssue.viewCount.onlyWhenOrNull(false),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, null::int8 as "v" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v?: bigint }>>>()
        expect(result).toEqual([{ id: 1 }])
    })

    test('projection-modifiers/bigint-ignore-when-as-null-passthrough', async () => {
        // `ignoreWhenAsNull(false)` on a bigint leaf is the pass-through branch:
        // the column flows through unchanged but the leaf is widened to optional.
        const expected = [{ id: 1, v: 0n }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                v:  tIssue.viewCount.ignoreWhenAsNull(false),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, view_count as "v" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v?: bigint }>>>()
        expect(result).toEqual(expected)
    })

    test('value-source-rhs/customint-add-cross-table-operand', async () => {
        // customInt arithmetic (add) with a value-source operand drawn from a
        // DIFFERENT table (a joined alias): `worklog2` is a self-join alias joined
        // on the same id, so `cost_cents + worklog2.cost_cents` is a cross-table
        // operand. Worklog 1: cost_cents 100 -> 100 + 100 = 200.
        const worklog2 = tIssueWorklog.as('worklog2')
        const expected = [{ id: 1, sum: 200 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .join(worklog2).on(worklog2.id.equals(tIssueWorklog.id))
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:  tIssueWorklog.id,
                sum: tIssueWorklog.costCents.add(worklog2.costCents),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_worklog.id as id, issue_worklog.cost_cents + worklog2.cost_cents as sum from issue_worklog join issue_worklog as worklog2 on worklog2.id = issue_worklog.id where issue_worklog.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sum: number }>>>()
        expect(result).toEqual(expected)
    })


    test('value-source-rhs/bigint-add-cross-table-operand', async () => {
        // bigint `add` with a value-source operand from a self-join alias: `issue2` is
        // joined on the same id, so `view_count + issue2.view_count` uses qualified
        // columns from two instances of the issue table. view_count = 0 (seed default)
        // for every issue, so 0 + 0 = 0.
        const issue2 = tIssue.as('issue2')
        const expected = [{ id: 1, sum: 0n }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .join(issue2).on(issue2.id.equals(tIssue.id))
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                sum: tIssue.viewCount.add(issue2.viewCount),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.view_count + issue2.view_count as sum from issue join issue as issue2 on issue2.id = issue.id where issue.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sum: bigint }>>>()
        // A bigint sum can come back as a string on some drivers, so the real-DB
        // branch coerces it through BigInt(...); the mock keeps the exact shape.
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(BigInt(result[0]!.sum)).toBe(0n)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('value-source-rhs/customdouble-add-cross-table-operand', async () => {
        // customDouble `add` with a value-source operand from a self-join alias:
        // `worklog2` is joined on the same id, so `billed_amount +
        // worklog2.billed_amount` uses qualified columns from two instances of the
        // worklog table. billed_amount ('Money', marshalled) = 200 for worklog 1, so
        // 200 + 200 = 400.
        const worklog2 = tIssueWorklog.as('worklog2')
        const expected = [{ id: 1, sum: 400 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .join(worklog2).on(worklog2.id.equals(tIssueWorklog.id))
            .where(tIssueWorklog.id.equals(1))
            .select({
                id:  tIssueWorklog.id,
                sum: tIssueWorklog.billedAmount.add(worklog2.billedAmount),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_worklog.id as id, issue_worklog.billed_amount + worklog2.billed_amount as sum from issue_worklog join issue_worklog as worklog2 on worklog2.id = issue_worklog.id where issue_worklog.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sum: number }>>>()
        expect(result).toEqual(expected)
    })
    test('nullable-const/double-value-when-null-and-null-if-value', async () => {
        // `valueWhenNull(0)` / `nullIfValue(0)` on a plain OPTIONAL double
        // receiver. estimated_hours is NULL for issue 1: valueWhenNull(0) flips
        // the optionality to required and realizes 0 (`coalesce(estimated_hours,
        // $1)`); nullIfValue(0) keeps it optional and `nullif(NULL, $2)` stays
        // NULL -> the leaf is absent.
        const expected = [{ id: 1, wn: 0 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                wn: tIssue.estimatedHours.valueWhenNull(0),
                ni: tIssue.estimatedHours.nullIfValue(0),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(estimated_hours, $1) as wn, nullif(estimated_hours, $2) as ni from issue where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            0,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; wn: number; ni?: number }>>>()
        expect(result).toEqual(expected)
    })


    // ── 8. valueWhenNull / nullIfValue with a CROSS-TABLE value-source operand ─

    test('value-source-rhs/customint-value-when-null-cross-table-operand', async () => {
        // `valueWhenNull` with a value-source operand drawn from a DIFFERENT
        // table (a self-join alias): `worklog2` is joined on the same id, so
        // `coalesce(issue_worklog.cost_cents, worklog2.cost_cents)` qualifies
        // both operands with distinct table aliases. cost_cents is required
        // (non-null), so coalesce keeps the left value and the optionality stays
        // required. Worklog 1: cost_cents 100 -> 100.
        const worklog2 = tIssueWorklog.as('worklog2')
        const expected = [{ id: 1, wn: 100 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .join(worklog2).on(worklog2.id.equals(tIssueWorklog.id))
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                wn: tIssueWorklog.costCents.valueWhenNull(worklog2.costCents),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_worklog.id as id, coalesce(issue_worklog.cost_cents, worklog2.cost_cents) as wn from issue_worklog join issue_worklog as worklog2 on worklog2.id = issue_worklog.id where issue_worklog.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; wn: number }>>>()
        expect(result).toEqual(expected)
    })

    test('value-source-rhs/customint-null-if-value-cross-table-operand', async () => {
        // `nullIfValue` with a value-source operand from a self-join alias:
        // `nullif(issue_worklog.cost_cents, worklog2.cost_cents)` qualifies both
        // operands with distinct table aliases. worklog2 joins on the same id, so
        // the two cost_cents are equal (100 == 100) and `nullif` collapses to
        // NULL -> the leaf is optional and absent under optional-as-undefined.
        const worklog2 = tIssueWorklog.as('worklog2')
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .join(worklog2).on(worklog2.id.equals(tIssueWorklog.id))
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                ni: tIssueWorklog.costCents.nullIfValue(worklog2.costCents),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_worklog.id as id, nullif(issue_worklog.cost_cents, worklog2.cost_cents) as ni from issue_worklog join issue_worklog as worklog2 on worklog2.id = issue_worklog.id where issue_worklog.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; ni?: number }>>>()
        expect(result).toEqual(expected)
    })

    test('value-source-rhs/customdouble-value-when-null-cross-table-operand', async () => {
        // `valueWhenNull` with a value-source operand from a self-join alias:
        // `coalesce(issue_worklog.billed_amount, worklog2.billed_amount)`
        // qualifies both operands with distinct table aliases. billed_amount
        // ('Money', marshalled) is required, so coalesce keeps the left value and
        // the optionality stays required. Worklog 1: billed_amount 200 -> 200.
        const worklog2 = tIssueWorklog.as('worklog2')
        const expected = [{ id: 1, wn: 200 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .join(worklog2).on(worklog2.id.equals(tIssueWorklog.id))
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                wn: tIssueWorklog.billedAmount.valueWhenNull(worklog2.billedAmount),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_worklog.id as id, coalesce(issue_worklog.billed_amount, worklog2.billed_amount) as wn from issue_worklog join issue_worklog as worklog2 on worklog2.id = issue_worklog.id where issue_worklog.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; wn: number }>>>()
        expect(result).toEqual(expected)
    })

    test('value-source-rhs/customdouble-null-if-value-cross-table-operand', async () => {
        // `nullIfValue` with a value-source operand from a self-join alias:
        // `nullif(issue_worklog.billed_amount, worklog2.billed_amount)` qualifies
        // both operands with distinct table aliases. worklog2 joins on the same
        // id, so the two billed_amount are equal (200 == 200) and `nullif`
        // collapses to NULL -> the leaf is optional and absent under
        // optional-as-undefined.
        const worklog2 = tIssueWorklog.as('worklog2')
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .join(worklog2).on(worklog2.id.equals(tIssueWorklog.id))
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                ni: tIssueWorklog.billedAmount.nullIfValue(worklog2.billedAmount),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_worklog.id as id, nullif(issue_worklog.billed_amount, worklog2.billed_amount) as ni from issue_worklog join issue_worklog as worklog2 on worklog2.id = issue_worklog.id where issue_worklog.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; ni?: number }>>>()
        expect(result).toEqual(expected)
    })
    // ── 9. Scalar-subquery OPERAND on a numeric receiver ──────────────────
    // A scalar subquery built with `.selectOneColumn(<agg>).forUseAsInlineQueryValue()`
    // fed as the RIGHT operand of a numeric operator, emitting `col OP (select …)`.
    // The inline query value is always OPTIONAL (a scalar subquery may return zero
    // rows), so every result leaf widens to optional. Each operand subquery draws
    // from a DIFFERENT table than the receiver, so the emitted subquery is
    // non-correlated and its value is deterministic: max(project.id) = 4 (4 seeded
    // projects) for the int/double operand, max(issue_worklog.duration_ms) = 5400000
    // (worklog 1) for the bigint operand. Receivers are on issue 1: priority = 2,
    // view_count = 0 (default). A fresh subquery builder is used per key (a value
    // source is single-use).

    test('subquery-operand/int-req-add-scalar-subquery', async () => {
        // int-required receiver + int scalar subquery → `priority + (select max(id) …)`.
        // priority(issue 1) = 2, max(project.id) = 4 → 2 + 4 = 6. Optional inline
        // value widens the leaf to `?: number`.
        const expected = [{ id: 1, v: 6 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                v:  tIssue.priority.add(
                    ctx.conn.selectFrom(tProject).selectOneColumn(ctx.conn.max(tProject.id)).forUseAsInlineQueryValue()
                ),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority + (select max(id) as result from project) as "v" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v?: number }>>>()
        expect(result).toEqual(expected)
    })

    test('subquery-operand/bigint-req-add-scalar-subquery', async () => {
        // bigint-required receiver + bigint scalar subquery →
        // `view_count + (select max(duration_ms) …)`. view_count(issue 1) = 0,
        // max(issue_worklog.duration_ms) = 5400000 → 0 + 5400000 = 5400000n. A bigint
        // sum can come back as a string on some drivers, so the real-DB branch coerces
        // through BigInt(...); the mock keeps the exact bigint shape.
        const expected = [{ id: 1, v: 5400000n }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                v:  tIssue.viewCount.add(
                    ctx.conn.selectFrom(tIssueWorklog).selectOneColumn(ctx.conn.max(tIssueWorklog.durationMs)).forUseAsInlineQueryValue()
                ),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, view_count + (select max(duration_ms) as result from issue_worklog) as "v" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v?: bigint }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(BigInt(result[0]!.v!)).toBe(5400000n)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('subquery-operand/double-req-add-scalar-subquery', async () => {
        // double-required receiver (`priority.asDouble()`) + double scalar subquery
        // (`max(id).asDouble()`) → `priority::float + (select max(id)::float …)`.
        // priority(issue 1) = 2.0, max(project.id) = 4.0 → 2.0 + 4.0 = 6.0.
        const expected = [{ id: 1, v: 6 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                v:  tIssue.priority.asDouble().add(
                    ctx.conn.selectFrom(tProject).selectOneColumn(ctx.conn.max(tProject.id).asDouble()).forUseAsInlineQueryValue()
                ),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority::float + (select max(id)::float as result from project) as "v" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v?: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(6, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('subquery-operand/int-receiver-exact-operators', async () => {
        // int receiver (priority = 2) with the int scalar subquery (= 4) across the
        // integer-exact operators: subtract / multiply / modulo / power / minValue /
        // maxValue. subtract = -2, multiply = 8, modulo = 2, power = 16,
        // minValue = greatest(2,4) = 4, maxValue = least(2,4) = 2. Every leaf is
        // optional (the inline value is optional) and comes back as a clean number.
        const sub = () => ctx.conn.selectFrom(tProject).selectOneColumn(ctx.conn.max(tProject.id)).forUseAsInlineQueryValue()
        const expected = [{ id: 1, s: -2, mu: 8, mo: 2, pw: 16, mn: 4, mx: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                s:  tIssue.priority.subtract(sub()),
                mu: tIssue.priority.multiply(sub()),
                mo: tIssue.priority.modulo(sub()),
                pw: tIssue.priority.power(sub()),
                mn: tIssue.priority.minValue(sub()),
                mx: tIssue.priority.maxValue(sub()),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority - (select max(id) as result from project) as "s", priority * (select max(id) as result from project) as mu, priority % (select max(id) as result from project) as mo, power(priority, (select max(id) as result from project)) as pw, greatest(priority, (select max(id) as result from project)) as mn, least(priority, (select max(id) as result from project)) as mx from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; s?: number; mu?: number; mo?: number; pw?: number; mn?: number; mx?: number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('subquery-operand/int-receiver-float-operators', async () => {
        // int receiver (priority = 2) with the int scalar subquery (= 4) across the
        // float-result operators: divide / logn / roundn / atan2. divide = 2/4 = 0.5,
        // logn = log_4(2) = 0.5, roundn = round(2, 4 decimals) = 2, atan2(2, 4) ≈ 0.4636.
        // The real results are floats (and a numeric-cast round can leak the driver's
        // raw string), so the real-DB branch asserts with toBeCloseTo via Number(...).
        const sub = () => ctx.conn.selectFrom(tProject).selectOneColumn(ctx.conn.max(tProject.id)).forUseAsInlineQueryValue()
        const expected = [{ id: 1, di: 0.5, ln: 0.5, rn: 2, at: Math.atan2(2, 4) }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                di: tIssue.priority.divide(sub()),
                ln: tIssue.priority.logn(sub()),
                rn: tIssue.priority.roundn(sub()),
                at: tIssue.priority.atan2(sub()),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority::float / (select max(id) as result from project)::float as di, log(((select max(id) as result from project))::numeric, (priority)::numeric) as ln, round((priority)::numeric, (select max(id) as result from project)) as rn, atan2(priority, (select max(id) as result from project)) as at from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; di?: number; ln?: number; rn?: number; at?: number
        }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(Number(result[0]!.di)).toBeCloseTo(0.5, 5)
            expect(Number(result[0]!.ln)).toBeCloseTo(0.5, 5)
            expect(Number(result[0]!.rn)).toBeCloseTo(2, 5)
            expect(Number(result[0]!.at)).toBeCloseTo(Math.atan2(2, 4), 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('subquery-operand/double-receiver-operators', async () => {
        // double receiver (`priority.asDouble()` = 2.0) with the double scalar subquery
        // (`max(id).asDouble()` = 4.0) across the full operator set: subtract / multiply /
        // divide / modulo / power / logn / roundn / atan2 / minValue / maxValue.
        // subtract = -2, multiply = 8, divide = 0.5, modulo = 2, power = 16,
        // logn = log_4(2) = 0.5, roundn = round(2.0, 2) = 2 (roundn's decimal-place
        // operand must be an integer — a double places emits round(numeric, double)
        // which PostgreSQL rejects, so this cell uses an int-literal places while the
        // other operators take the double scalar subquery), atan2(2,4) ≈ 0.4636,
        // minValue = greatest(2,4) = 4, maxValue = least(2,4) = 2. All floats, so the
        // real-DB branch asserts with toBeCloseTo via Number(...).
        const sub = () => ctx.conn.selectFrom(tProject).selectOneColumn(ctx.conn.max(tProject.id).asDouble()).forUseAsInlineQueryValue()
        const base = () => tIssue.priority.asDouble()
        const expected = [{ id: 1, s: -2, mu: 8, di: 0.5, mo: 2, pw: 16, ln: 0.5, rn: 2, at: Math.atan2(2, 4), mn: 4, mx: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                s:  base().subtract(sub()),
                mu: base().multiply(sub()),
                di: base().divide(sub()),
                mo: base().modulo(sub()),
                pw: base().power(sub()),
                ln: base().logn(sub()),
                rn: base().roundn(2),
                at: base().atan2(sub()),
                mn: base().minValue(sub()),
                mx: base().maxValue(sub()),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority::float - (select max(id)::float as result from project) as "s", priority::float * (select max(id)::float as result from project) as mu, priority::float::float / (select max(id)::float as result from project)::float as di, mod((priority::float)::numeric, ((select max(id)::float as result from project))::numeric) as mo, power(priority::float, (select max(id)::float as result from project)) as pw, log(((select max(id)::float as result from project))::numeric, (priority::float)::numeric) as ln, round((priority::float)::numeric, $1) as rn, atan2(priority::float, (select max(id)::float as result from project)) as at, greatest(priority::float, (select max(id)::float as result from project)) as mn, least(priority::float, (select max(id)::float as result from project)) as mx from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; s?: number; mu?: number; di?: number; mo?: number; pw?: number
            ln?: number; rn: number; at?: number; mn?: number; mx?: number
        }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(Number(result[0]!.s)).toBeCloseTo(-2, 5)
            expect(Number(result[0]!.mu)).toBeCloseTo(8, 5)
            expect(Number(result[0]!.di)).toBeCloseTo(0.5, 5)
            expect(Number(result[0]!.mo)).toBeCloseTo(2, 5)
            expect(Number(result[0]!.pw)).toBeCloseTo(16, 5)
            expect(Number(result[0]!.ln)).toBeCloseTo(0.5, 5)
            expect(Number(result[0]!.rn)).toBeCloseTo(2, 5)
            expect(Number(result[0]!.at)).toBeCloseTo(Math.atan2(2, 4), 5)
            expect(Number(result[0]!.mn)).toBeCloseTo(4, 5)
            expect(Number(result[0]!.mx)).toBeCloseTo(2, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('subquery-operand/bigint-receiver-operators', async () => {
        // bigint receiver (view_count = 0) with the bigint scalar subquery
        // (`max(duration_ms)` = 5400000) across subtract / modulo / minValue / maxValue.
        // subtract = -5400000, modulo = 0 % 5400000 = 0, minValue = greatest(0, 5400000)
        // = 5400000, maxValue = least(0, 5400000) = 0. A bigint result can come back as a
        // string on some drivers, so the real-DB branch coerces through BigInt(...).
        const sub = () => ctx.conn.selectFrom(tIssueWorklog).selectOneColumn(ctx.conn.max(tIssueWorklog.durationMs)).forUseAsInlineQueryValue()
        const expected = [{ id: 1, s: -5400000n, mo: 0n, mn: 5400000n, mx: 0n }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                s:  tIssue.viewCount.subtract(sub()),
                mo: tIssue.viewCount.modulo(sub()),
                mn: tIssue.viewCount.minValue(sub()),
                mx: tIssue.viewCount.maxValue(sub()),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, view_count - (select max(duration_ms) as result from issue_worklog) as "s", view_count % (select max(duration_ms) as result from issue_worklog) as mo, greatest(view_count, (select max(duration_ms) as result from issue_worklog)) as mn, least(view_count, (select max(duration_ms) as result from issue_worklog)) as mx from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; s?: bigint; mo?: bigint; mn?: bigint; mx?: bigint
        }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(BigInt(result[0]!.s!)).toBe(-5400000n)
            expect(BigInt(result[0]!.mo!)).toBe(0n)
            expect(BigInt(result[0]!.mn!)).toBe(5400000n)
            expect(BigInt(result[0]!.mx!)).toBe(0n)
        } else {
            expect(result).toEqual(expected)
        }
    })
})
