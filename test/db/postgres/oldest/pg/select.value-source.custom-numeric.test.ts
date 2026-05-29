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
// number. The shared arithmetic dispatch
// (createSqlOperation1ofOverloadedNumber) routes double, bigint AND
// custom operands through ONE branch, so `double-arithmetic` (a typed
// `priority.asDouble()` operand, which stays resolvable on every real DB)
// covers that branch for all of them — a const-built custom operand would
// emit two untyped params that postgres rejects as `unknown <op> unknown`.
//
// SQLite has no trig functions (acos…tan raise at runtime) and computes
// exp/ln/log10 with platform precision; a custom type also carries no
// marshalling (transformValueFromDB falls through to `return value`, so
// the driver's raw representation leaks). Those tests therefore pin the
// emitted SQL always and assert the value only under the mock — the same
// accommodation select.numeric-ops/.trig already use.

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
        // ceil/floor/round (the customInt||customDouble arm) and abs.
        // The SQL runs on every real DB; the VALUE is asserted only under
        // the mock because a custom type carries NO marshalling
        // (transformValueFromDB falls to `default: return value`), so the
        // round result — wrapped in `::numeric` — comes back as the
        // driver's raw representation (a string on the postgres drivers),
        // not a canonical number the library re-types.
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
        if (!ctx.realDbEnabled) expect(result).toEqual(expected)
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
        // customDouble type. exp/ln/log10 are platform-precision, so the
        // value is asserted only under the mock; SQL is pinned always.
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
        if (!ctx.realDbEnabled) expect(result).toEqual(expected)
    })

    test('custom-numeric/customdouble-trig', async () => {
        // The 7 trig methods over a customDouble operand keep the
        // customDouble type. SQLite has no trig functions, so execution
        // throws after the SQL is captured; the value is mock-only.
        const r = ctx.conn.const(0.5, 'customDouble', 'Ratio')
        const expected = [{
            id: 1,
            ac: Math.acos(0.5), as: Math.asin(0.5), at: Math.atan(0.5),
            co: Math.cos(0.5), ct: 1 / Math.tan(0.5), si: Math.sin(0.5), ta: Math.tan(0.5),
        }]
        ctx.mockNext(expected)
        try {
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
            if (!ctx.realDbEnabled) expect(result).toEqual(expected)
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
        }
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
    })

    test('custom-numeric/customdouble-operation1-math', async () => {
        // The 5 `SqlOperation1` customDouble arms — `power`, `logn`,
        // `roundn`, `divide`, `atan2` — at ValueSourceImpl.ts:614 / 635
        // / 642 / 649 / 678. `customdouble-math` covers the
        // `SqlOperation0` arms (sqrt/cbrt/exp/ln/log10); these take an
        // additional operand and route through a different dispatch
        // arm. SQLite has no `logn` / `atan2` / `roundn`, so execution
        // throws after the SQL is captured; value is mock-only as in
        // the `customdouble-math` / `customdouble-trig` siblings.
        const v = ctx.conn.const(8, 'customDouble', 'Score')
        const o = ctx.conn.const(2, 'customDouble', 'Score')
        const expected = [{ id: 1, p: 64, ln: 3, rn: 8, di: 4, at2: Math.atan2(8, 2) }]
        ctx.mockNext(expected)
        try {
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
            if (!ctx.realDbEnabled) expect(result).toEqual(expected)
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
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
