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
// SQLite has no trig functions (acos…tan raise at runtime) and computes
// exp/ln/log10 with platform precision; a custom type also carries no
// marshalling (transformValueFromDB falls through to `return value`, so
// the driver's raw representation leaks). Those tests therefore pin the
// emitted SQL always and assert the value only under the mock — the same
// accommodation select.numeric-ops/.trig already use.

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ceil(view_count) as "c", floor(view_count) as "f", round(view_count) as "r" from issue where id = ?"`)
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
        // This SQLite build returns ceil/floor/round/abs of an integer as a
        // plain integer, so the value round-trips in both modes.
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ceil(?) as "c", floor(?) as "f", round(?) as "r", abs(?) as "a" from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(priority as real) + ? as sum, cast(priority as real) - ? as diff, cast(priority as real) * ? as prod from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, sqrt(?) as sq, sign(?) * power(abs(?), 1.0 / 3.0) as cb, exp(?) as "e", ln(?) as "l", log10(?) as l10 from issue where id = ?"`)
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
            const row = result[0]!
            expect(row.sq).toBeCloseTo(2, 5)
            expect(row.cb).toBeCloseTo(Math.cbrt(4), 5)
            expect(row.e).toBeCloseTo(Math.exp(4), 5)
            expect(row.l).toBeCloseTo(Math.log(4), 5)
            expect(row.l10).toBeCloseTo(Math.log10(4), 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    // NOT-APPLICABLE: this SQLite build has no `cot()` function (the rest
    // of the trig family — acos/asin/atan/cos/sin/tan — exists), so the
    // whole query throws "no such function: cot".
    /*
    test('custom-numeric/customdouble-trig', async () => {
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
        expect(result).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, acos(?) as ac, asin(?) as "as", atan(?) as at, cos(?) as co, cot(?) as ct, sin(?) as si, tan(?) as ta from issue where id = ?"`)
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
    */

    test('custom-numeric/customdouble-operation1-math', async () => {
        // The 5 `SqlOperation1` customDouble arms — `power`, `logn`,
        // `roundn`, `divide`, `atan2`. `customdouble-math` covers the
        // `SqlOperation0` arms (sqrt/cbrt/exp/ln/log10); these take an
        // additional operand and route through a different dispatch arm.
        // This SQLite build provides log(b,x)/atan2/round(x,n), so the
        // query runs; at2 is floating-point, the others come back exact.
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
            const row = result[0]!
            expect(row.id).toBe(1)
            expect(row.p).toBe(64)
            expect(row.ln).toBe(3)
            expect(row.rn).toBe(8)
            expect(row.di).toBe(4)
            expect(row.at2).toBeCloseTo(Math.atan2(8, 2), 5)
        } else {
            expect(result).toEqual(expected)
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, power(?, ?) as "p", log(?, ?) as ln, round(?, ?) as rn, cast(? as real) / cast(? as real) as di, atan2(?, ?) as at2 from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(?) as asInt, round(?) as asBig from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, view_count + ? as "a", view_count - ? as "s", view_count % ? as "m", max(view_count, ?) as mn, min(view_count, ?) as mx, abs(view_count) as ab, sign(view_count) as sg from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            2,
            5,
            -3,
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, duration_ms + ? as "d" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(?, priority) > ? as big from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cost_cents + ? as "a", cost_cents - ? as "s", cost_cents * ? as mu, cost_cents % cost_cents as mo, max(cost_cents, ?) as mn, min(cost_cents, ?) as mx, sign(cost_cents) as sg from issue_worklog where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billed_amount + billed_amount as "a", billed_amount - ? as "s", billed_amount * ? as mu, max(billed_amount, ?) as mn, min(billed_amount, ?) as mx, abs(billed_amount) as ab, sign(billed_amount) as sg from issue_worklog where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cost_cents + cost_cents as ci, billed_amount + billed_amount as cd from issue_worklog where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, view_count + view_count as "a", view_count - view_count as "s", view_count + view_count as "o" from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(duration_ms, ?) as dwn, nullif(duration_ms, ?) as dni, ifnull(cost_cents, ?) as cwn, nullif(cost_cents, ?) as cni, ifnull(billed_amount, ?) as bwn, nullif(billed_amount, ?) as bni from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            0,
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(?, ?) > ? as big from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, billed_amount % billed_amount as "m" from issue_worklog where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cost_cents % ? as "m" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; m: number }>>>()
        expect(result).toEqual(expected)
    })

})
