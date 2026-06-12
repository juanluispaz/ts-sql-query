// Coverage of the bigint / customInt / customDouble type-dispatch arms of
// the numeric value-source methods. The other numeric tests exercise these
// methods only on plain int/double operands; the bigint and custom* arms
// (e.g. ceil() over a bigint, sqrt() over a customDouble) are reached by
// feeding a differently-typed operand. The emitted SQL is the same — what
// the custom arm changes is the carried result type.
//
// bigint coverage comes from the read-only viewCount column (seed default
// 0); customInt/customDouble come from const(v, 'customInt'|'customDouble',
// 'TypeName'). bigint is marshalled, so its results come back typed; custom
// types are NOT marshalled, so their `::numeric`-cast results leak the
// driver's raw representation (a string on the postgres drivers).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
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
        // ceil/floor/round and abs. A custom type carries no marshalling,
        // so the `round(...::numeric)` result leaks the driver's raw
        // representation: a string ('7') on the postgres drivers, while
        // ceil/floor/abs come back as numbers.
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
        if (ctx.realDbEnabled) {
            expect(result).toEqual([{ id: 1, c: 7, f: 7, r: '7', a: 7 }])
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
        // divide, atan2. A custom type carries no marshalling, so the
        // `::numeric`-cast results (logn, roundn) leak the driver's raw
        // representation: strings ('3.0000000000000000', '8.00') on the
        // postgres drivers, while power/divide/atan2 come back as numbers.
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
            expect(result[0]!.ln).toBe('3.0000000000000000')
            expect(result[0]!.rn).toBe('8.00')
            expect(result[0]!.di).toBeCloseTo(4, 5)
            expect(result[0]!.at2).toBeCloseTo(Math.atan2(8, 2), 5)
        } else {
            expect(result).toEqual(expected)
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, power($1, $2) as "p", log(($3)::numeric, ($4)::numeric) as ln, round(($5)::numeric, $6) as rn, $7::float / $8::float as di, atan2($9, $10) as at2 from issue where id = $11"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(($1)::numeric) as "asInt", round(($2)::numeric) as "asBig" from issue where id = $3"`)
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
})
