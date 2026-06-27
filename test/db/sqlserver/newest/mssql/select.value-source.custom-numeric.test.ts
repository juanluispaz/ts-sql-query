// Coverage of the bigint / customInt / customDouble TYPE-DISPATCH arms in
// ValueSourceImpl's numeric methods. The existing select.numeric-ops /
// select.value-source.trig files exercise these methods only on plain
// `int`/`double` operands (`tIssue.priority`), which take the `else`
// branch of each method; the bigint and custom* arms (e.g.
// `ceil()` over a bigint, `sqrt()` over a customDouble) were never
// reached. The emitted SQL is identical to the non-custom version — what
// the custom arm changes is the result's carried value-type — so the
// branch is exercised purely by feeding a differently-typed operand.
//
// Operand sources, chosen to avoid binding a JS BigInt (the sqlite3
// driver can't bind one): bigint coverage comes from the read-only
// `viewCount` column (seed default 0); customInt/customDouble come from
// `const(v, 'customInt'|'customDouble', 'TypeName')`, which bind a plain
// number — EXCEPT the arithmetic-and-sign arms, which run over the real
// `cost_cents` / `billed_amount` worklog columns (marshalled, so `col OP col`
// stays resolvable and the results come back as clean numbers). The shared arithmetic dispatch
// (createSqlOperation1ofOverloadedNumber) routes double, bigint AND
// custom operands through ONE branch, so `double-arithmetic` (a typed
// `priority.asDouble()` operand, which stays resolvable on every real DB)
// covers that branch for all of them — a const-built custom operand would
// emit two untyped params that postgres rejects as `unknown <op> unknown`.
//
// SQL Server supports trig functions and computes exp/ln/log10 with
// platform precision; a custom type carries no marshalling
// (transformValueFromDB falls through to `return value`, so the driver's
// raw representation leaks). These tests pin the emitted SQL and assert
// the value.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tIssueWorklog } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('custom-numeric/bigint-rounding', async () => {
        // ceil/floor/round over a bigint column take the dedicated bigint
        // arm and keep the bigint result type. view_count is 0 (default).
        const expected = [{ id: 1, c: 0n, f: 0n, r: 0n }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                c:  tIssue.viewCount.ceil(),
                f:  tIssue.viewCount.floor(),
                r:  tIssue.viewCount.round(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ceiling(view_count) as [c], floor(view_count) as [f], round(view_count, 0) as [r] from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; c: bigint; f: bigint; r: bigint }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/customint-rounding-and-abs', async () => {
        // customInt operand keeps the customInt result type through
        // ceil/floor/round (the customInt||customDouble arm) and abs. A
        // custom type carries no marshalling, so on SQL Server the
        // driver leaks the raw representation as a string ('7') for every
        // column; the mock echoes the seeded numbers.
        const score = ctx.conn.const(7, 'customInt', 'Score')
        const expected = [{ id: 1, c: 7, f: 7, r: 7, a: 7 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                c:  score.ceil(),
                f:  score.floor(),
                r:  score.round(),
                a:  score.abs(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ceiling(@0) as [c], floor(@1) as [f], round(@2, 0) as [r], abs(@3) as [a] from issue where id = @4"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            7,
            7,
            7,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; c: number; f: number; r: number; a: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result).toEqual([{ id: 1, c: '7', f: '7', r: '7', a: '7' }])
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('custom-numeric/double-arithmetic', async () => {
        // Arithmetic over a `double` operand routes through the
        // double/bigint/customInt/customDouble branch of
        // createSqlOperation1ofOverloadedNumber (the same branch the
        // bigint and custom operators take). A typed column operand
        // (`priority.asDouble()`) keeps the SQL resolvable on every real
        // DB — a const-built operand would emit two untyped params that
        // postgres rejects as `unknown <op> unknown`.
        const base = tIssue.priority.asDouble() // priority(id=1) = 2 -> 2.0
        const expected = [{ id: 1, sum: 4, diff: 1, prod: 4 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:   tIssue.id,
                sum:  base.add(2),
                diff: base.subtract(1),
                prod: base.multiply(2),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(priority as float) + @0 as [sum], cast(priority as float) - @1 as diff, cast(priority as float) * @2 as prod from issue where id = @3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sum: number; diff: number; prod: number }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/customdouble-math', async () => {
        // sqrt/cbrt/exp/ln/log10 over a customDouble operand keep the
        // customDouble type.
        const m = ctx.conn.const(4, 'customDouble', 'Meters')
        const expected = [{
            id: 1,
            sq:  2,
            cb:  Math.cbrt(4),
            e:   Math.exp(4),
            l:   Math.log(4),
            l10: Math.log10(4),
        }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                sq:  m.sqrt(),
                cb:  m.cbrt(),
                e:   m.exp(),
                l:   m.ln(),
                l10: m.log10(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, sqrt(@0) as sq, sign(@1) * power(cast(abs(@2) as float), 1.0 / 3.0) as cb, exp(@3) as [e], log(@4) as [l], log10(@5) as l10 from issue where id = @6"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
            4,
            4,
            4,
            4,
            4,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sq: number; cb: number; e: number; l: number; l10: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.sq).toBeCloseTo(2, 5)
            expect(result[0]!.cb).toBeCloseTo(Math.cbrt(4), 5)
            expect(result[0]!.e).toBeCloseTo(Math.exp(4), 5)
            expect(result[0]!.l).toBeCloseTo(Math.log(4), 5)
            expect(result[0]!.l10).toBeCloseTo(Math.log10(4), 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('custom-numeric/customdouble-trig', async () => {
        // The 7 trig methods over a customDouble operand keep the
        // customDouble type. SQL Server supports all trig functions.
        const r = ctx.conn.const(0.5, 'customDouble', 'Ratio')
        const expected = [{
            id: 1,
            ac: Math.acos(0.5), as: Math.asin(0.5), at: Math.atan(0.5),
            co: Math.cos(0.5), ct: 1 / Math.tan(0.5), si: Math.sin(0.5), ta: Math.tan(0.5),
        }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                ac: r.acos(), as: r.asin(), at: r.atan(),
                co: r.cos(), ct: r.cot(), si: r.sin(), ta: r.tan(),
            })
            .executeSelectMany()
        assertType<Exact<typeof result, Array<{
            id: number; ac: number; as: number; at: number
            co: number; ct: number; si: number; ta: number
        }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.ac).toBeCloseTo(Math.acos(0.5), 5)
            expect(result[0]!.as).toBeCloseTo(Math.asin(0.5), 5)
            expect(result[0]!.at).toBeCloseTo(Math.atan(0.5), 5)
            expect(result[0]!.co).toBeCloseTo(Math.cos(0.5), 5)
            expect(result[0]!.ct).toBeCloseTo(1 / Math.tan(0.5), 5)
            expect(result[0]!.si).toBeCloseTo(Math.sin(0.5), 5)
            expect(result[0]!.ta).toBeCloseTo(Math.tan(0.5), 5)
        } else {
            expect(result).toEqual(expected)
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, acos(@0) as ac, asin(@1) as [as], atan(@2) as [at], cos(@3) as co, cot(@4) as ct, sin(@5) as si, tan(@6) as ta from issue where id = @7"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0.5,
            0.5,
            0.5,
            0.5,
            0.5,
            0.5,
            0.5,
            1,
          ]
        `)
    })

    test('custom-numeric/customdouble-operation1-math', async () => {
        // The 5 `SqlOperation1` customDouble arms — `power`, `logn`,
        // `roundn`, `divide`, `atan2`. `customdouble-math` covers the
        // `SqlOperation0` arms (sqrt/cbrt/exp/ln/log10); these take an
        // additional operand and route through a different dispatch
        // arm. SQL Server supports `log` / `atn2` / `round`.
        const v = ctx.conn.const(8, 'customDouble', 'Score')
        const o = ctx.conn.const(2, 'customDouble', 'Score')
        const expected = [{ id: 1, p: 64, ln: 3, rn: 8, di: 4, at2: Math.atan2(8, 2) }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                p:   v.power(2),
                ln:  v.logn(o),
                rn:  v.roundn(2),
                di:  v.divide(o),
                at2: v.atan2(o),
            })
            .executeSelectMany()
        assertType<Exact<typeof result, Array<{
            id: number; p: number; ln: number; rn: number; di: number; at2: number
        }>>>()
        expect(result).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, power(@0, @1) as [p], log(@2, @3) as [ln], round(@4, @5) as rn, cast(@6 as float) / cast(@7 as float) as di, atn2(@8, @9) as at2 from issue where id = @10"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            8,
            2,
            8,
            2,
            8,
            2,
            8,
            2,
            8,
            2,
            1,
          ]
        `)
    })

    test('custom-numeric/cast-double-as-int-and-bigint', async () => {
        // asInt()/asBigint() over a `double` take the unsafe-round arm
        // (a non-typesafe cast): the operand is wrapped in `round(...)`
        // and re-typed to int / bigint respectively.
        const d = ctx.conn.const(1.7, 'double')
        const expected = [{ id: 1, asInt: 2, asBig: 2n }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:    tIssue.id,
                asInt: d.asInt(),
                asBig: d.asBigint(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(@0, 0) as asInt, round(@1, 0) as asBig from issue where id = @2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1.7,
            1.7,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; asInt: number; asBig: bigint }>>>()
        expect(result).toEqual(expected)
    })
    test('custom-numeric/bigint-arithmetic-and-sign', async () => {
        // Bigint arithmetic (add/subtract/modulo/minValue/maxValue/abs) keeps
        // the bigint result; sign() returns a plain number. view_count is a
        // marshalled bigint column (seed default 0). minValue/maxValue clamp via
        // greatest/least, so over 0 the bounds bind: minValue(5n)=5n,
        // maxValue(-3n)=-3n. `sg` comes back as a number (0, not 0n).
        const expected = [{ id: 1, a: 1n, s: -1n, m: 0n, mn: 5n, mx: -3n, ab: 0n, sg: 0 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                a:  tIssue.viewCount.add(1n),
                s:  tIssue.viewCount.subtract(1n),
                m:  tIssue.viewCount.modulo(2n),
                mn: tIssue.viewCount.minValue(5n),
                mx: tIssue.viewCount.maxValue(-3n),
                ab: tIssue.viewCount.abs(),
                sg: tIssue.viewCount.sign(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, view_count + @0 as [a], view_count - @1 as [s], view_count % @2 as [m], greatest(view_count, @3) as mn, least(view_count, @4) as mx, abs(view_count) as ab, sign(view_count) as sg from issue where id = @5"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1n,
            1n,
            2n,
            5n,
            -3n,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; a: bigint; s: bigint; m: bigint
            mn: bigint; mx: bigint; ab: bigint; sg: number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/bigint-arithmetic-optional', async () => {
        // Bigint arithmetic over the optional `duration_ms` column carries the
        // 'optional' marker through the operator, so `d` is `bigint | undefined`.
        // Worklog 1 has duration_ms = 5400000, so add(1n) = 5400001n.
        const expected = [{ id: 1, d: 5400001n }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                d:  tIssueWorklog.durationMs.add(1n),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, duration_ms + @0 as [d] from issue_worklog where id = @1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1n,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; d?: bigint }>>>()
        expect(result).toEqual(expected)
    })
    test('custom-numeric/customdouble-roundn-with-number-value-source-precision', async () => {
        // `roundn` on a customDouble receiver has two overloads: the literal
        // precision (`v.roundn(2)`, covered in customdouble-operation1-math)
        // and the NumberValueSource precision arm exercised here — the second
        // argument is a column value source (`tIssue.priority`), so the
        // emitted SQL rounds to a column-driven number of decimals.
        // round(8, priority=2) = 8 > 7 → true. The comparison keeps the result
        // a boolean (a customDouble result leaks per-driver string/number, so
        // wrapping it in a predicate gives one cross-dialect value assertion).
        const v = ctx.conn.const(8, 'customDouble', 'Score')
        const expected = { id: 1, big: true }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                big: v.roundn(tIssue.priority).greaterThan(7),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(case when round(@0, priority) > @1 then 1 else 0 end as bit) as big from issue where id = @2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            8,
            7,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; big: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('custom-numeric/customint-arithmetic-and-sign', async () => {
        // Arithmetic / min-max operators on a customInt operand. modulo uses
        // the custom-RHS overload (cost % cost); sign() drops the brand to a
        // plain number. All carry leaf `number`; SQL is over the typed
        // `cost_cents` column (=100 for worklog 1). minValue/maxValue clamp via
        // greatest/least: minValue(150)=150, maxValue(80)=80.
        const expected = [{ id: 1, a: 102, s: 99, mu: 200, mo: 0, mn: 150, mx: 80, sg: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                a:  tIssueWorklog.costCents.add(2),
                s:  tIssueWorklog.costCents.subtract(1),
                mu: tIssueWorklog.costCents.multiply(2),
                mo: tIssueWorklog.costCents.modulo(tIssueWorklog.costCents),
                mn: tIssueWorklog.costCents.minValue(150),
                mx: tIssueWorklog.costCents.maxValue(80),
                sg: tIssueWorklog.costCents.sign(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cost_cents + @0 as [a], cost_cents - @1 as [s], cost_cents * @2 as mu, cost_cents % cost_cents as mo, greatest(cost_cents, @3) as mn, least(cost_cents, @4) as mx, sign(cost_cents) as sg from issue_worklog where id = @5"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
            2,
            150,
            80,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; a: number; s: number; mu: number
            mo: number; mn: number; mx: number; sg: number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/customdouble-arithmetic-and-sign', async () => {
        // add/subtract/multiply/minValue/maxValue/abs/sign on a customDouble
        // operand. add uses the custom-RHS overload (amount + amount); sign()
        // drops the brand. `billed_amount` ('Money', marshalled) = 200 for
        // worklog 1. minValue(250)=250, maxValue(150)=150.
        const expected = [{ id: 1, a: 400, s: 199, mu: 400, mn: 250, mx: 150, ab: 200, sg: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                a:  tIssueWorklog.billedAmount.add(tIssueWorklog.billedAmount),
                s:  tIssueWorklog.billedAmount.subtract(1),
                mu: tIssueWorklog.billedAmount.multiply(2),
                mn: tIssueWorklog.billedAmount.minValue(250),
                mx: tIssueWorklog.billedAmount.maxValue(150),
                ab: tIssueWorklog.billedAmount.abs(),
                sg: tIssueWorklog.billedAmount.sign(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billed_amount + billed_amount as [a], billed_amount - @0 as [s], billed_amount * @1 as mu, greatest(billed_amount, @2) as mn, least(billed_amount, @3) as mx, abs(billed_amount) as ab, sign(billed_amount) as sg from issue_worklog where id = @4"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            250,
            150,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; a: number; s: number; mu: number
            mn: number; mx: number; ab: number; sg: number
        }>>>()
        expect(result).toEqual(expected)
    })
})
