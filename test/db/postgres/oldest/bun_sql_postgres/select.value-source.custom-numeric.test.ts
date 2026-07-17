// Coverage of the bigint / customInt / customDouble type-dispatch arms of
// the numeric value-source methods. The other numeric tests exercise these
// methods only on plain int/double operands; the bigint and custom* arms
// (e.g. ceil() over a bigint, sqrt() over a customDouble) are reached by
// feeding a differently-typed operand. The emitted SQL is the same — what
// the custom arm changes is the carried result type.
//
// bigint coverage comes from the read-only viewCount column (seed default
// 0). The customInt/customDouble const operands use TypeNames the connection
// does NOT marshal (Meters/Score/Ratio), so their `::numeric`-cast results
// leak the driver's raw representation (a string on the postgres drivers).
// The arithmetic-and-sign arms instead run over the real `cost_cents`
// ('Cents' -> int) and `billed_amount` ('Money' -> double) worklog columns,
// which the connection DOES marshal, so those results come back as clean
// numbers — and a typed column keeps `col OP col` resolvable on every engine
// (a two-const operand would emit `$1 OP $2`, which postgres rejects).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tIssueWorklog, tReleaseDraft, vReleaseOverview, type Money, type ReleaseTag } from '../../domain/connection.js'
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ceil(view_count) as "c", floor(view_count) as "f", round((view_count)::numeric) as "r" from issue where id = $1"`)
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
        // ceil/floor/round and abs. The typeName is marshalled through its base
        // int on the connection, so every leaf round-trips as a number.
        const score = ctx.conn.const(7, 'customInt', 'ScoreCount')
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ceil($1) as "c", floor($2) as "f", round(($3)::numeric) as "r", abs($4) as "a" from issue where id = $5"`)
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
        expect(result).toEqual(expected)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority::float + $1 as sum, priority::float - $2 as diff, priority::float * $3 as prod from issue where id = $4"`)
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
        // customDouble type. The real results are floats, so the real-DB
        // branch asserts with toBeCloseTo.
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, sqrt($1) as sq, cbrt($2) as cb, exp($3) as "e", ln($4) as "l", log($5) as l10 from issue where id = $6"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
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
            expect(result[0]!.sq).toBe(2)  // sqrt(4) = 2 exactly (IEEE-754), unlike the irrational neighbours
            expect(result[0]!.cb).toBeCloseTo(Math.cbrt(4), 10)
            expect(result[0]!.e).toBeCloseTo(Math.exp(4), 5)
            expect(result[0]!.l).toBeCloseTo(Math.log(4), 5)
            expect(result[0]!.l10).toBeCloseTo(Math.log10(4), 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('custom-numeric/customdouble-trig', async () => {
        // The 7 trig methods over a customDouble operand keep the
        // customDouble type. The real results are floats, so the real-DB
        // branch asserts with toBeCloseTo.
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, acos($1) as ac, asin($2) as "as", atan($3) as at, cos($4) as co, cot($5) as ct, sin($6) as si, tan($7) as ta from issue where id = $8"`)
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
    })

    test('custom-numeric/customdouble-operation1-math', async () => {
        // The 5 SqlOperation1 customDouble arms — power, logn, roundn,
        // divide, atan2. The typeName is marshalled through its base double on
        // the connection, so every arm round-trips as a number regardless of the
        // representation its expression produces (logn and roundn are cast to
        // `::numeric`, which the drivers hand over as a string).
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
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.p).toBeCloseTo(64, 5)
            expect(result[0]!.ln).toBeCloseTo(3, 5)
            expect(result[0]!.rn).toBeCloseTo(8, 5)
            expect(result[0]!.di).toBeCloseTo(4, 5)
            expect(result[0]!.at2).toBeCloseTo(Math.atan2(8, 2), 5)
        } else {
            expect(result).toEqual(expected)
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, power($1, $2) as "p", log(($3)::numeric, ($4)::numeric) as ln, round(($5)::numeric, $6) as rn, $7::float / $8 as di, atan2($9, $10) as at2 from issue where id = $11"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            8,
            2,
            2,
            8,
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(($1)::numeric)::bigint as "asInt", round(($2)::numeric)::bigint as "asBig" from issue where id = $3"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, view_count + $1 as "a", view_count - $2 as "s", view_count % $3 as "m", greatest(view_count, $4) as mn, least(view_count, $5) as mx, abs(view_count) as ab, sign(view_count) as sg from issue where id = $6"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, duration_ms + $1 as "d" from issue_worklog where id = $2"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(($1)::numeric, priority) > $2 as big from issue where id = $3"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cost_cents + $1 as "a", cost_cents - $2 as "s", cost_cents * $3 as mu, cost_cents % cost_cents as mo, greatest(cost_cents, $4) as mn, least(cost_cents, $5) as mx, sign(cost_cents) as sg from issue_worklog where id = $6"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billed_amount + billed_amount as "a", billed_amount - $1 as "s", billed_amount * $2 as mu, greatest(billed_amount, $3) as mn, least(billed_amount, $4) as mx, abs(billed_amount) as ab, sign(billed_amount) as sg from issue_worklog where id = $5"`)
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

    test('custom-numeric/custom-arithmetic-both-operand-optional', async () => {
        // The custom-VALUE-SOURCE-RHS arithmetic overload merges the argument's
        // optionality into the result while KEEPING the custom brand, so a
        // `required-custom.add(optional-custom)` yields an OPTIONAL custom leaf
        // (`?: number`). The optional operand is synthesized with `.asOptional()`
        // on the same required column — still present at runtime, so the value
        // is observed. Worklog 1: cost_cents 100 -> 200; billed_amount 200 -> 400.
        const expected = [{ id: 1, ci: 200, cd: 400 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                ci: tIssueWorklog.costCents.add(tIssueWorklog.costCents.asOptional()),
                cd: tIssueWorklog.billedAmount.add(tIssueWorklog.billedAmount.asOptional()),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cost_cents + cost_cents as ci, billed_amount + billed_amount as cd from issue_worklog where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; ci?: number; cd?: number }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/bigint-arithmetic-value-source-rhs', async () => {
        // The bigint value-SOURCE-RHS arithmetic overload: add / subtract take
        // a bigint value source as the right operand, and the `.asOptional()`
        // RHS merges its optionality into the result (`?: bigint`). view_count
        // is 0 (default) for issue 1, so every result is 0n (the optional leaf
        // is still present).
        const expected = [{ id: 1, a: 0n, s: 0n, o: 0n }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                a:  tIssue.viewCount.add(tIssue.viewCount),
                s:  tIssue.viewCount.subtract(tIssue.viewCount),
                o:  tIssue.viewCount.add(tIssue.viewCount.asOptional()),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, view_count + view_count as "a", view_count - view_count as "s", view_count + view_count as "o" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; a: bigint; s: bigint; o?: bigint }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/value-when-null-and-null-if-value-on-bigint-customint-customdouble', async () => {
        // `valueWhenNull` / `nullIfValue` are redefined on the bigint /
        // customInt / customDouble leaves with a brand-keeping return branch:
        // valueWhenNull re-imposes `required` (coalesce), nullIfValue re-imposes
        // `optional` (nullif), and the carried bigint / customInt / customDouble
        // type is preserved. The other tests only exercise the plain
        // NumberValueSource versions of these two methods.
        //
        // Worklog 2 has duration_ms NULL, so coalesce(duration_ms, 0n) surfaces
        // the 0n fallback (proving the required re-imposition fires) while
        // nullif(duration_ms, 0n) stays NULL -> the optional `dni` leaf is
        // absent. cost_cents 100 and billed_amount 50 are non-null marshalled
        // columns (Cents -> int, Money -> double), so their nullIfValue(0)
        // results come back present as clean numbers.
        const expected = [{ id: 2, dwn: 0n, cwn: 100, cni: 100, bwn: 50, bni: 50 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(2))
            .select({
                id:  tIssueWorklog.id,
                dwn: tIssueWorklog.durationMs.valueWhenNull(0n),
                dni: tIssueWorklog.durationMs.nullIfValue(0n),
                cwn: tIssueWorklog.costCents.valueWhenNull(0),
                cni: tIssueWorklog.costCents.nullIfValue(0),
                bwn: tIssueWorklog.billedAmount.valueWhenNull(0),
                bni: tIssueWorklog.billedAmount.nullIfValue(0),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(duration_ms, $1) as dwn, nullif(duration_ms, $2) as dni, coalesce(cost_cents, $3) as cwn, nullif(cost_cents, $4) as cni, coalesce(billed_amount, $5) as bwn, nullif(billed_amount, $6) as bni from issue_worklog where id = $7"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0n,
            0n,
            0,
            0,
            0,
            0,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number
            dwn: bigint; dni?: bigint
            cwn: number; cni?: number
            bwn: number; bni?: number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/customdouble-roundn-with-customdouble-value-source-precision', async () => {
        // roundn with a BRAND-MATCHED customDouble value source as the precision
        // argument (same 'Score' brand as the receiver). round(8, 2) = 8 > 7 ->
        // true (wrapped in a predicate for one cross-dialect value, since a
        // customDouble result leaks per-driver).
        const v = ctx.conn.const(8, 'customDouble', 'Score')
        const prec = ctx.conn.const(2, 'customDouble', 'Score')
        const expected = { id: 1, big: true }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                big: v.roundn(prec).greaterThan(7),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(($1)::numeric, $2) > $3 as big from issue where id = $4"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            8,
            2,
            7,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; big: boolean }>>()
        expect(row).toEqual(expected)
    })

    test('custom-numeric/customdouble-modulo-value-source', async () => {
        // modulo over a customDouble operand with a customDouble value source on the
        // RHS keeps the customDouble leaf. billed_amount 200 % 200 = 0; 'Money' is
        // marshalled to double, so the result is a clean number.
        const expected = [{ id: 1, m: 0 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                m:  tIssueWorklog.billedAmount.modulo(tIssueWorklog.billedAmount),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, mod((billed_amount)::numeric, (billed_amount)::numeric) as "m" from issue_worklog where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; m: number }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/customint-modulo-const', async () => {
        // modulo over a customInt operand with a literal RHS keeps the customInt
        // leaf. cost_cents 100 % 2 = 0; 'Cents' is marshalled to int, so the result
        // is a clean number.
        const expected = [{ id: 1, m: 0 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                m:  tIssueWorklog.costCents.modulo(2),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cost_cents % $1 as "m" from issue_worklog where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; m: number }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/branded-newtype-keeps-or-erases-the-brand', async () => {
        // On a branded-newtype receiver (`ReleaseTag` = customInt, `Money` =
        // customDouble), brand-KEEPING methods carry the brand through while
        // brand-ERASING ones drop it to a plain `number`: `abs`/`sqrt` keep
        // `ReleaseTag`/`Money`, `sign` returns `number`. Both brands are marshalled
        // (ReleaseTag→int, Money→double), so the results read back as clean numbers:
        // abs(5)=5, sign(5)=1, sqrt(4)=2, sign(4)=1.
        const tag   = ctx.conn.const(5 as ReleaseTag, 'customInt', 'ReleaseTag')
        const money = ctx.conn.const(4 as Money, 'customDouble', 'Money')
        const expected = [{ id: 1, keepInt: 5, eraseInt: 1, keepDbl: 2, eraseDbl: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:       tIssue.id,
                keepInt:  tag.abs(),     // customInt KEEP → ReleaseTag
                eraseInt: tag.sign(),    // customInt ERASE → number
                keepDbl:  money.sqrt(),  // customDouble KEEP → Money
                eraseDbl: money.sign(),  // customDouble ERASE → number
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, abs($1) as "keepInt", sign($2) as "eraseInt", sqrt($3) as "keepDbl", sign($4) as "eraseDbl" from issue where id = $5"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
            5,
            4,
            4,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; keepInt: ReleaseTag; eraseInt: number; keepDbl: Money; eraseDbl: number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/customdouble-add-with-branded-type-const-operand', async () => {
        // customDouble `add` with a branded TYPE const as the right operand
        // (`billedAmount.add(const(2 as Money, 'customDouble', 'Money'))`).
        // billed_amount ('Money'→double) is 200 for worklog 1, so 200 + 2 = 202
        // (clean number).
        const money2 = ctx.conn.const(2 as Money, 'customDouble', 'Money')
        const expected = [{ id: 1, cd: 202 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                cd: tIssueWorklog.billedAmount.add(money2),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billed_amount + $1 as cd from issue_worklog where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; cd: number }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/optional-custom-receiver-add-keeps-brand-and-optional', async () => {
        // An OPTIONAL branded customInt receiver (`optionalReleaseOrdinal`,
        // ReleaseTag via plusOffsetAdapter) through the `add` operator: the result
        // stays OPTIONAL and keeps the ReleaseTag brand (`ord?: ReleaseTag`). The
        // view's optional_release_ordinal = release id (release 1 has download_count,
        // so it is present) and the column reads +1000 via plusOffsetAdapter, so the
        // emitted `optional_release_ordinal + $1` sums the RAW value.
        const tag10 = ctx.conn.const(10 as ReleaseTag, 'customInt', 'ReleaseTag')
        const expected = [{ id: 1, ord: 1011 }]
        ctx.mockNext([{ id: 1, ord: 11 }])
        const result = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({
                id:  vReleaseOverview.id,
                ord: vReleaseOverview.optionalReleaseOrdinal.add(tag10),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, optional_release_ordinal + $1 as ord from release_overview where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            10,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; ord?: ReleaseTag }>>>()
        expect(result).toEqual(expected)
    })
    test('custom-numeric/brand-survival-customint-rounding', async () => {
        // ceil / floor / round on a branded ReleaseTag (customInt) const keep the
        // ReleaseTag brand. Over the integer input 6 every result is a clean 6;
        // ReleaseTag is marshalled to int, so `round((...)::numeric)` reads back
        // as a number rather than the driver's raw string.
        const tag = ctx.conn.const(6 as ReleaseTag, 'customInt', 'ReleaseTag')
        const expected = [{ id: 1, c: 6, f: 6, r: 6 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                c:  tag.ceil(),
                f:  tag.floor(),
                r:  tag.round(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ceil($1) as "c", floor($2) as "f", round(($3)::numeric) as "r" from issue where id = $4"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            6,
            6,
            6,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; c: ReleaseTag; f: ReleaseTag; r: ReleaseTag }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/brand-survival-customint-minmax', async () => {
        // minValue / maxValue on a branded ReleaseTag (customInt) value keep the
        // ReleaseTag brand. minValue clamps via greatest, maxValue via least. A bare
        // const receiver would emit greatest/least over two untyped placeholders,
        // which postgres compares as text ('10' sorts before '6'); a leading round()
        // (identity for the integer receiver 6) types the left operand so the
        // comparison is numeric. Over round(6)=6 with a branded operand:
        // minValue(10)=greatest(6,10)=10, maxValue(10)=least(6,10)=6. ReleaseTag is
        // marshalled to int → clean numbers.
        const tag = ctx.conn.const(6 as ReleaseTag, 'customInt', 'ReleaseTag')
        const expected = [{ id: 1, mn: 10, mx: 6 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                mn: tag.round().minValue(10 as ReleaseTag),
                mx: tag.round().maxValue(10 as ReleaseTag),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, greatest(round(($1)::numeric), $2) as mn, least(round(($3)::numeric), $4) as mx from issue where id = $5"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            6,
            10,
            6,
            10,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; mn: ReleaseTag; mx: ReleaseTag }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/brand-survival-customint-arithmetic', async () => {
        // add / subtract / multiply / modulo on a branded ReleaseTag (customInt)
        // value keep the ReleaseTag brand. A bare const receiver would emit two
        // untyped placeholders postgres can't resolve for these operators; a leading
        // round() (identity for the integer receiver 6) types the left operand as
        // numeric so the operator resolves, without changing the value. Over
        // round(6)=6 with branded operands: add(4)=10, subtract(4)=2, multiply(2)=12,
        // modulo(4)=2. ReleaseTag is marshalled to int → clean integers.
        const tag = ctx.conn.const(6 as ReleaseTag, 'customInt', 'ReleaseTag')
        const expected = [{ id: 1, a: 10, s: 2, mu: 12, mo: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                a:  tag.round().add(4 as ReleaseTag),
                s:  tag.round().subtract(4 as ReleaseTag),
                mu: tag.round().multiply(2 as ReleaseTag),
                mo: tag.round().modulo(4 as ReleaseTag),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(($1)::numeric) + $2 as "a", round(($3)::numeric) - $4 as "s", round(($5)::numeric) * $6 as mu, round(($7)::numeric) % $8 as mo from issue where id = $9"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            6,
            4,
            6,
            4,
            6,
            2,
            6,
            4,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; a: ReleaseTag; s: ReleaseTag; mu: ReleaseTag; mo: ReleaseTag }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/brand-survival-customint-nullhandling', async () => {
        // valueWhenNull / nullIfValue on a branded ReleaseTag (customInt) const
        // keep the ReleaseTag brand. valueWhenNull re-imposes `required`
        // (coalesce), nullIfValue re-imposes `optional` (nullif). Over receiver 6:
        // coalesce(6, 0)=6 and nullif(6, 0)=6 (6≠0, so the optional leaf is
        // present). ReleaseTag is marshalled to int → clean numbers.
        const tag = ctx.conn.const(6 as ReleaseTag, 'customInt', 'ReleaseTag')
        const expected = [{ id: 1, vwn: 6, niv: 6 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                vwn: tag.valueWhenNull(0 as ReleaseTag),
                niv: tag.nullIfValue(0 as ReleaseTag),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce($1, $2) as vwn, nullif($3, $4) as niv from issue where id = $5"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            6,
            0,
            6,
            0,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; vwn: ReleaseTag; niv?: ReleaseTag }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/brand-survival-customdouble-math', async () => {
        // The SqlFunction0 math methods on a branded Money (customDouble) const
        // keep the Money brand. abs/ceil/floor/round over the integer input 4 are
        // clean integers; exp/ln/log10/cbrt are irrational floats, so the real-DB
        // branch asserts with toBeCloseTo. Money is marshalled to double, so every
        // leaf reads back as a clean number.
        const money = ctx.conn.const(4 as Money, 'customDouble', 'Money')
        const expected = [{
            id: 1,
            ab: 4, ce: 4, fl: 4, ro: 4,
            ex: Math.exp(4), l: Math.log(4), l10: Math.log10(4), cb: Math.cbrt(4),
        }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                ab: money.abs(),
                ce: money.ceil(),
                fl: money.floor(),
                ro: money.round(),
                ex: money.exp(),
                l:  money.ln(),
                l10: money.log10(),
                cb: money.cbrt(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, abs($1) as ab, ceil($2) as ce, floor($3) as fl, round(($4)::numeric) as ro, exp($5) as ex, ln($6) as "l", log($7) as l10, cbrt($8) as cb from issue where id = $9"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
            4,
            4,
            4,
            4,
            4,
            4,
            4,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; ab: Money; ce: Money; fl: Money; ro: Money
            ex: Money; l: Money; l10: Money; cb: Money
        }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.ab).toBeCloseTo(4, 5)
            expect(result[0]!.ce).toBeCloseTo(4, 5)
            expect(result[0]!.fl).toBeCloseTo(4, 5)
            expect(result[0]!.ro).toBeCloseTo(4, 5)
            expect(result[0]!.ex).toBeCloseTo(Math.exp(4), 5)
            expect(result[0]!.l).toBeCloseTo(Math.log(4), 5)
            expect(result[0]!.l10).toBeCloseTo(Math.log10(4), 5)
            expect(result[0]!.cb).toBeCloseTo(Math.cbrt(4), 10)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('custom-numeric/brand-survival-customdouble-power-logn-atan2', async () => {
        // The SqlFunction1 power / logn / atan2 on a branded Money (customDouble)
        // const keep the Money brand. power(8, 2)=64, logn(base 2 of 8)=3,
        // atan2(8, 2) is irrational. Money is marshalled to double, so each leaf
        // reads back as a clean number; the real-DB branch asserts with
        // toBeCloseTo.
        const money = ctx.conn.const(8 as Money, 'customDouble', 'Money')
        const base  = ctx.conn.const(2 as Money, 'customDouble', 'Money')
        const expected = [{ id: 1, p: 64, lg: 3, at2: Math.atan2(8, 2) }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                p:   money.power(2 as Money),
                lg:  money.logn(base),
                at2: money.atan2(base),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, power($1, $2) as "p", log(($3)::numeric, ($4)::numeric) as lg, atan2($5, $6) as at2 from issue where id = $7"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            8,
            2,
            2,
            8,
            8,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; p: Money; lg: Money; at2: Money }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.p).toBeCloseTo(64, 5)
            expect(result[0]!.lg).toBeCloseTo(3, 5)
            expect(result[0]!.at2).toBeCloseTo(Math.atan2(8, 2), 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('custom-numeric/brand-survival-customdouble-roundn', async () => {
        // roundn on a branded Money (customDouble) const keeps the Money brand
        // through both overloads: the literal-precision arm (`roundn(2)`) and the
        // value-source-precision arm (`roundn(<Money const>)`). round(8, 2)=8 for
        // both. Money is marshalled to double, so each leaf reads back as a clean
        // number; the real-DB branch asserts with toBeCloseTo.
        const money = ctx.conn.const(8 as Money, 'customDouble', 'Money')
        const prec  = ctx.conn.const(2 as Money, 'customDouble', 'Money')
        const expected = [{ id: 1, rl: 8, rv: 8 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                rl: money.roundn(2),
                rv: money.roundn(prec),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(($1)::numeric, $2) as rl, round(($3)::numeric, $4) as rv from issue where id = $5"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            8,
            2,
            8,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; rl: Money; rv: Money }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.rl).toBeCloseTo(8, 5)
            expect(result[0]!.rv).toBeCloseTo(8, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('custom-numeric/brand-survival-customdouble-arithmetic', async () => {
        // add / subtract / multiply on a branded Money (customDouble) value keep
        // the Money brand. A bare const receiver would emit two untyped placeholders
        // postgres can't resolve for these operators; a leading round() (identity
        // for the integer receiver 8) types the left operand as numeric so the
        // operator resolves, without changing the value. Over round(8)=8 with a
        // branded operand: add(2)=10, subtract(2)=6, multiply(2)=16. Money is
        // marshalled to double → clean numbers; the real-DB branch asserts with
        // toBeCloseTo.
        const money = ctx.conn.const(8 as Money, 'customDouble', 'Money')
        const base  = ctx.conn.const(2 as Money, 'customDouble', 'Money')
        const expected = [{ id: 1, a: 10, s: 6, mu: 16 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                a:  money.round().add(base),
                s:  money.round().subtract(base),
                mu: money.round().multiply(base),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(($1)::numeric) + $2 as "a", round(($3)::numeric) - $4 as "s", round(($5)::numeric) * $6 as mu from issue where id = $7"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            8,
            2,
            8,
            2,
            8,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; a: Money; s: Money; mu: Money }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.a).toBeCloseTo(10, 5)
            expect(result[0]!.s).toBeCloseTo(6, 5)
            expect(result[0]!.mu).toBeCloseTo(16, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('custom-numeric/brand-survival-customdouble-minmax', async () => {
        // minValue / maxValue on a branded Money (customDouble) value keep the Money
        // brand. minValue clamps via greatest, maxValue via least. A bare const
        // receiver would emit greatest/least over two untyped placeholders, which
        // postgres compares as text ('10' sorts before '8'); a leading round()
        // (identity for the integer receiver 8) types the left operand so the
        // comparison is numeric. Over round(8)=8 with a branded operand:
        // minValue(10)=greatest(8,10)=10, maxValue(10)=least(8,10)=8. Money is
        // marshalled to double → clean numbers; the real-DB branch asserts with
        // toBeCloseTo.
        const money = ctx.conn.const(8 as Money, 'customDouble', 'Money')
        const expected = [{ id: 1, mn: 10, mx: 8 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                mn: money.round().minValue(10 as Money),
                mx: money.round().maxValue(10 as Money),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, greatest(round(($1)::numeric), $2) as mn, least(round(($3)::numeric), $4) as mx from issue where id = $5"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            8,
            10,
            8,
            10,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; mn: Money; mx: Money }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.mn).toBeCloseTo(10, 5)
            expect(result[0]!.mx).toBeCloseTo(8, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('custom-numeric/brand-survival-customdouble-divide-modulo', async () => {
        // divide / modulo on a branded Money (customDouble) const keep the Money
        // brand. Both emit self-typing SQL over placeholders (divide casts to float,
        // modulo casts to numeric), so they resolve directly without a type anchor.
        // Over receiver 8 with a branded operand: divide(2)=4, modulo(2)=0. Money is
        // marshalled to double → clean numbers; the real-DB branch asserts with
        // toBeCloseTo.
        const money = ctx.conn.const(8 as Money, 'customDouble', 'Money')
        const base  = ctx.conn.const(2 as Money, 'customDouble', 'Money')
        const expected = [{ id: 1, di: 4, mo: 0 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                di: money.divide(base),
                mo: money.modulo(base),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, $1::float / $2 as di, mod(($3)::numeric, ($4)::numeric) as mo from issue where id = $5"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            8,
            2,
            8,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; di: Money; mo: Money }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.di).toBeCloseTo(4, 5)
            expect(result[0]!.mo).toBeCloseTo(0, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('custom-numeric/brand-survival-customdouble-nullhandling', async () => {
        // valueWhenNull / nullIfValue on a branded Money (customDouble) const keep
        // the Money brand. valueWhenNull re-imposes `required` (coalesce),
        // nullIfValue re-imposes `optional` (nullif). Over receiver 8:
        // coalesce(8, 0)=8 and nullif(8, 0)=8 (8≠0, so the optional leaf is
        // present). Money is marshalled to double → clean numbers; the real-DB
        // branch asserts with toBeCloseTo.
        const money = ctx.conn.const(8 as Money, 'customDouble', 'Money')
        const expected = [{ id: 1, vwn: 8, niv: 8 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                vwn: money.valueWhenNull(0 as Money),
                niv: money.nullIfValue(0 as Money),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce($1, $2) as vwn, nullif($3, $4) as niv from issue where id = $5"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            8,
            0,
            8,
            0,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; vwn: Money; niv?: Money }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.vwn).toBeCloseTo(8, 5)
            expect(result[0]!.niv).toBeCloseTo(8, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('custom-numeric/brand-survival-customdouble-trig', async () => {
        // The 7 trig methods on a branded Money (customDouble) const keep the Money
        // brand. Over the input 0.5 (inside the trig domain) every result is an
        // irrational float, so the real-DB branch asserts with toBeCloseTo. Money
        // is marshalled to double → clean numbers.
        const money = ctx.conn.const(0.5 as Money, 'customDouble', 'Money')
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
                ac: money.acos(), as: money.asin(), at: money.atan(),
                co: money.cos(), ct: money.cot(), si: money.sin(), ta: money.tan(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, acos($1) as ac, asin($2) as "as", atan($3) as at, cos($4) as co, cot($5) as ct, sin($6) as si, tan($7) as ta from issue where id = $8"`)
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
        assertType<Exact<typeof result, Array<{
            id: number; ac: Money; as: Money; at: Money
            co: Money; ct: Money; si: Money; ta: Money
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
    })

    test('custom-numeric/adapter-column-through-non-add-arithmetic', async () => {
        // The per-column TypeAdapter (plusOffsetAdapter, read +1000) on the branded
        // customInt view columns propagates through `subtract` and `multiply` (the
        // arithmetic result reads +1000), keeping the ReleaseTag brand and the
        // receiver's optionality. The view maps both ordinals to release id; release 1
        // has a non-null download_count so `optionalReleaseOrdinal` is present, and both
        // ordinals are 1 → `optSub` = (1 - 1) + 1000 = 1000, `reqMul` = (1 * 2) + 1000 = 1002.
        const one = ctx.conn.const(1 as ReleaseTag, 'customInt', 'ReleaseTag')
        const two = ctx.conn.const(2 as ReleaseTag, 'customInt', 'ReleaseTag')
        const expected = [{ id: 1, optSub: 1000, reqMul: 1002 }]
        ctx.mockNext([{ id: 1, optSub: 0, reqMul: 2 }])
        const result = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({
                id:     vReleaseOverview.id,
                optSub: vReleaseOverview.optionalReleaseOrdinal.subtract(one),
                reqMul: vReleaseOverview.releaseOrdinal.multiply(two),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, optional_release_ordinal - $1 as "optSub", release_ordinal * $2 as "reqMul" from release_overview where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; optSub?: ReleaseTag; reqMul: ReleaseTag }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/customdouble-add-number-literal-overload', async () => {
        // The `add(value: number)` overload on a customDouble receiver (distinct from
        // the `add<VALUE extends CustomDoubleValueSource>` value-source overload). The
        // column is declared `<number, 'Money'>`, so its value type is a plain number
        // and the result leaf is `number` (not branded). `billed_amount` ('Money' ->
        // double, marshalled, no per-column adapter) = 200 for worklog 1, so the literal
        // binds raw and 200 + 2 = 202.
        const expected = [{ id: 1, cd: 202 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                cd: tIssueWorklog.billedAmount.add(2),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billed_amount + $1 as cd from issue_worklog where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; cd: number }>>>()
        expect(result).toEqual(expected)
    })

    test('custom-numeric/customdouble-adapter-column-through-multiply', async () => {
        // `shiftedAmount` is a customDouble ('Money') column carrying a per-column
        // TypeAdapter (plusOffsetAdapter: read +1000 / write -1000) and reading its DB
        // DEFAULT of 300. `.multiply(2)` takes the number-literal overload, so the
        // result leaf is a plain `number`. The literal `2` is written THROUGH the
        // column's adapter (2 - 1000 = -998), the DB multiplies against the raw stored
        // 300 (300 * -998 = -299400), and the arithmetic result is then read back
        // THROUGH the adapter (+1000): -299400 + 1000 = -298400. The mock supplies the
        // raw pre-read value; the projector applies the +1000 read on both paths.
        const expected = [{ id: 1, v: -298400 }]
        ctx.mockNext([{ id: 1, v: -299400 }])
        const result = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({
                id: tReleaseDraft.id,
                v:  tReleaseDraft.shiftedAmount.multiply(2),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, shifted_amount * $1 as "v" from release_draft where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            -998,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(-298400, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('custom-numeric/optional-customdouble-receiver-through-multiply', async () => {
        // An OPTIONAL customDouble receiver (`budget`, 'Money', no per-column adapter)
        // through the `multiply(number)` operator keeps the receiver's optionality:
        // the result leaf is `?: number`. Draft 1 has budget = 1500.5 (present), so the
        // literal binds raw and 1500.5 * 2 = 3001.
        const expected = [{ id: 1, v: 3001 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({
                id: tReleaseDraft.id,
                v:  tReleaseDraft.budget.multiply(2),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, budget * $1 as "v" from release_draft where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v?: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(3001, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

})
