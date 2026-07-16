// Behavioral coverage of numeric operators on int columns:
// add / subtract / multiply / modulo / abs and arithmetic negation
// (multiply by -1).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tIssueWorklog, vReleaseOverview } from '../../domain/connection.js'
import type { ReleaseTag } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('add', async () => {
        const expected = [{ id: 1, p2: 4 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                p2: tIssue.priority.add(2),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority + $1 as p2 from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; p2: number }>>>()
        expect(result).toEqual(expected)
    })

    test('subtract', async () => {
        const expected = [{ id: 3, p_minus_1: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .select({
                id:        tIssue.id,
                p_minus_1: tIssue.priority.subtract(1),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority - $1 as p_minus_1 from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; p_minus_1: number }>>>()
        expect(result).toEqual(expected)
    })

    test('multiply', async () => {
        const expected = [{ id: 1, doubled: 4 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:      tIssue.id,
                doubled: tIssue.priority.multiply(2),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority * $1 as doubled from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; doubled: number }>>>()
        expect(result).toEqual(expected)
    })

    test('modulo', async () => {
        const expected = [
            { id: 1, m: 0 }, { id: 2, m: 1 }, { id: 3, m: 1 }, { id: 4, m: 0 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                id: tIssue.id,
                m:  tIssue.priority.modulo(2),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority % $1 as "m" from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; m: number }>>>()
        expect(result).toEqual(expected)
    })

    test('modulo-fractional-literal', async () => {
        // A `.modulo()` on an int receiver with a FRACTIONAL literal carries the
        // result as `double` internally and can emit a distinct float-handling
        // form from the integer-literal `.modulo()` above — the exact SQL is
        // pinned by the snapshot. Seeded priorities are {2,1,3,2}; `x % 2.5`
        // yields {2,1,0.5,2}.
        const expected = [
            { id: 1, m: 2 }, { id: 2, m: 1 }, { id: 3, m: 0.5 }, { id: 4, m: 2 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                id: tIssue.id,
                m:  tIssue.priority.modulo(2.5),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, mod((priority)::numeric, ($1)::numeric) as "m" from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2.5,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; m: number }>>>()
        expect(result).toEqual(expected)
    })

    test('floor', async () => {
        const expected = [{ id: 1, f: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                f:  tIssue.priority.divide(2).floor(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, floor(priority::float / $1) as "f" from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; f: number }>>>()
        expect(result).toEqual(expected)
    })

    test('ceil', async () => {
        const expected = [{ id: 1, c: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                c:  tIssue.priority.divide(3).ceil(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ceil(priority::float / $1) as "c" from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; c: number }>>>()
        expect(result).toEqual(expected)
    })

    test('round', async () => {
        // priority(id=2) is 1 → 1/2 = 0.5 → round(0.5) = 1. Ties break
        // away from zero by default on every supported dialect; the exact
        // cast/round form each builder emits to get there is pinned by the
        // snapshot.
        const expected = [{ id: 2, r: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                id: tIssue.id,
                r:  tIssue.priority.divide(2).round(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round((priority::float / $1)::numeric) as "r" from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; r: number }>>>()
        expect(result).toEqual(expected)
    })

    test('sqrt', async () => {
        const expected = [{ id: 3, s: 3 }]
        ctx.mockNext(expected)
        // priority of issue 3 is 3 → sqrt(3) ≈ 1.732
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .select({
                id: tIssue.id,
                s:  tIssue.priority.multiply(3).sqrt(),  // sqrt(9) = 3
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, sqrt(priority * $1) as "s" from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; s: number }>>>()
        expect(result).toEqual(expected)
    })

    test('cbrt', async () => {
        const expected = [{ id: 4, c: 2 }]
        ctx.mockNext(expected)
        // priority(id=4) is 2 → multiply by 4 = 8, cbrt(8) = 2
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(4))
            .select({
                id: tIssue.id,
                c:  tIssue.priority.multiply(4).cbrt(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cbrt(priority * $1) as "c" from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
            4,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; c: number }>>>()
        expect(result).toEqual(expected)
    })

    test('sign', async () => {
        const expected = [
            { id: 1, sPos: 1, sNeg: -1, sZero: 0 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:    tIssue.id,
                sPos:  tIssue.priority.sign(),                 // priority=2 → 1
                sNeg:  tIssue.priority.multiply(-1).sign(),    // → -1
                sZero: tIssue.priority.multiply(0).sign(),     // → 0
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, sign(priority) as "sPos", sign(priority * $1) as "sNeg", sign(priority * $2) as "sZero" from issue where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            -1,
            0,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id: number; sPos: number; sNeg: number; sZero: number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('power', async () => {
        const expected = [{ id: 1, p: 8 }]
        ctx.mockNext(expected)
        // priority(id=1) is 2 → 2^3 = 8
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                p:  tIssue.priority.power(3),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, power(priority, $1) as "p" from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; p: number }>>>()
        expect(result).toEqual(expected)
    })

    test('exp-and-ln', async () => {
        // exp + ln are inverses; ln(exp(2)) should be 2.
        const expected = [{ id: 1, lnExp: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:    tIssue.id,
                lnExp: tIssue.priority.exp().ln(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ln(exp(priority)) as "lnExp" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; lnExp: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.lnExp).toBeCloseTo(2, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('log10', async () => {
        const expected = [{ id: 1, l: 2 }]
        ctx.mockNext(expected)
        // log10(100) = 2; using priority(id=1)=2 → 10^2 = 100
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                l:  tIssue.priority.power(2).multiply(25).log10(), // log10(2^2*25)=log10(100)=2
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, log(power(priority, $1) * $2) as "l" from issue where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            25,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; l: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.l).toBeCloseTo(2, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('logn', async () => {
        // Two-argument logarithm `log(base, x)`. Each builder emits its
        // own two-arg log form (with whatever casts the engine's overload
        // resolution needs) — pinned by the snapshot.
        const expected = [{ id: 1, l: 3 }]
        ctx.mockNext(expected)
        // log base 2 of 8 = 3
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                l:  tIssue.priority.power(3).logn(2), // log_2(2^3) = 3
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, log(($1)::numeric, (power(priority, $2))::numeric) as "l" from issue where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; l: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.l).toBeCloseTo(3, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('roundn-decimals', async () => {
        // `.roundn(n)` rounds to n decimal places. Each dialect
        // delegates to `round(x, n)` or the equivalent.
        const expected = [{ id: 1, r: 0.67 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                // priority(id=1)=2 → 2/3 = 0.6666… → roundn(2) → 0.67
                r:  tIssue.priority.divide(3).roundn(2),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round((priority::float / $1)::numeric, $2) as "r" from issue where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; r: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.r).toBeCloseTo(0.67, 2)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('atan2', async () => {
        // atan2(y, x) — the public form is `y.atan2(x)`. We pick
        // priority(id=1)=2 and atan2(2, 2) = π/4 ≈ 0.7854.
        const expected = [{ id: 1, a: Math.PI / 4 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                a:  tIssue.priority.atan2(2),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, atan2(priority, $1) as "a" from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; a: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.a).toBeCloseTo(Math.PI / 4, 3)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('asDouble', async () => {
        const expected = [{ id: 1, d: 2.0 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                d:  tIssue.priority.asDouble(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority::float as "d" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; d: number }>>>()
        expect(result).toEqual(expected)
    })

    test('nullIfValue', async () => {
        // `.nullIfValue(v)` becomes `nullif(col, v)` — emits NULL when
        // the column equals v. Issue priority(id=3)=3, so nullIfValue(3)
        // collapses that row's value to absent under the default
        // optional-as-undefined projection.
        ctx.mockNext([
            { id: 1, p: 2 },
            { id: 2, p: 1 },
            { id: 3, p: null },
            { id: 4, p: 2 },
        ])
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                id: tIssue.id,
                p:  tIssue.priority.nullIfValue(3),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(priority, $1) as "p" from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        // The `optional` widening of `.nullIfValue` makes the column
        // surface as `p?: number` and null rows come back as the
        // property simply being absent.
        assertType<Exact<typeof result, Array<{ id: number; p?: number }>>>()
        expect(result).toEqual([
            { id: 1, p: 2 },
            { id: 2, p: 1 },
            { id: 3 },
            { id: 4, p: 2 },
        ])
    })

    test('abs-and-arithmetic-negation', async () => {
        // The library exposes `.abs()` directly. Arithmetic negation has no
        // dedicated method on numeric value sources (`.negate()` is logical
        // NOT on booleans) — `multiply(-1)` is the documented workaround.
        const expected = [{ id: 1, neg: -2, absNeg: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:     tIssue.id,
                neg:    tIssue.priority.multiply(-1),
                absNeg: tIssue.priority.multiply(-1).abs(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority * $1 as neg, abs(priority * $2) as "absNeg" from issue where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            -1,
            -1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:     number
            neg:    number
            absNeg: number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-double-receiver-math', async () => {
        // Arithmetic / math with an OPTIONAL DOUBLE receiver
        // (`tIssue.estimatedHours`). Every other numeric test in this file
        // uses the REQUIRED int `priority`; here the receiver is optional, so
        // each result flows through the fixed-double branch that threads the
        // `__optionalType` and the projected keys are `?: number` (optional),
        // not `number`. The seed leaves `estimated_hours` NULL, so we set a
        // clean value (16) inside `withRollback` to make the arithmetic
        // concrete: divide(2)=8, power(2)=256, sqrt()=4, round()=16 — all
        // exact in IEEE-754, so no `toBeCloseTo` is needed.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 16 }).where(tIssue.id.equals(1)).executeUpdate()

            const expected = [{ id: 1, d: 8, p: 256, s: 4, r: 16 }]
            ctx.mockNext(expected)
            const result = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({
                    id: tIssue.id,
                    d:  tIssue.estimatedHours.divide(2),
                    p:  tIssue.estimatedHours.power(2),
                    s:  tIssue.estimatedHours.sqrt(),
                    r:  tIssue.estimatedHours.round(),
                })
                .executeSelectMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, estimated_hours / $1 as "d", power(estimated_hours, $2) as "p", sqrt(estimated_hours) as "s", round((estimated_hours)::numeric) as "r" from issue where id = $3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
                2,
                1,
              ]
            `)
            assertType<Exact<typeof result, Array<{
                id: number
                d?: number
                p?: number
                s?: number
                r?: number
            }>>>()
            expect(result).toEqual(expected)
        })
    })

    test('double-column-receiver-overloaded-arithmetic-threads-optional-and-emits-uncast', async () => {
        // The 6 overloaded-arithmetic ops (add/subtract/multiply/modulo/minValue/
        // maxValue) on a raw optional-`double` column receiver (`estimatedHours`)
        // with const right operands: the emission is un-cast (`estimated_hours + $1`,
        // not `estimated_hours::float`) and the optional flag threads through every
        // operator (`?: number`). estimated_hours has no seed value (NULL), so it is
        // set to 4 inside the rollback: add(1.5)=5.5, subtract(1.5)=2.5, multiply(2)=8,
        // modulo(3)=1, minValue(5)=greatest(4,5)=5, maxValue(3)=least(4,3)=3.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue)
                .set({ estimatedHours: 4 })
                .where(tIssue.id.equals(1))
                .executeUpdate()

            const expected = { id: 1, a: 5.5, s: 2.5, mu: 8, mo: 1, mn: 5, mx: 3 }
            ctx.mockNext(expected)
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({
                    id: tIssue.id,
                    a:  tIssue.estimatedHours.add(1.5),
                    s:  tIssue.estimatedHours.subtract(1.5),
                    mu: tIssue.estimatedHours.multiply(2),
                    mo: tIssue.estimatedHours.modulo(3),
                    mn: tIssue.estimatedHours.minValue(5),
                    mx: tIssue.estimatedHours.maxValue(3),
                })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, estimated_hours + $1 as "a", estimated_hours - $2 as "s", estimated_hours * $3 as mu, mod((estimated_hours)::numeric, ($4)::numeric) as mo, greatest(estimated_hours, $5) as mn, least(estimated_hours, $6) as mx from issue where id = $7"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1.5,
                1.5,
                2,
                3,
                5,
                3,
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id: number; a?: number; s?: number; mu?: number; mo?: number; mn?: number; mx?: number
            }>>()
            expect(row).toEqual(expected)
        })
    })

    // Optional-receiver unary math on the bigint / customInt / customDouble
    // leaves: `abs()` keeps the leaf type (`?: bigint` / `?: ReleaseTag` /
    // `?: Money`) while `sign()` narrows to a number leaf (`?: number`).

    test('optional-bigint-receiver-unary-math', async () => {
        // `durationMs` is an OPTIONAL bigint column (worklog 1 duration_ms
        // 5400000, no adapter). abs keeps the bigint leaf; sign returns a number.
        const expected = { id: 1, a: 5400000n, s: 1 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                a:  tIssueWorklog.durationMs.abs(),
                s:  tIssueWorklog.durationMs.sign(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, abs(duration_ms) as "a", sign(duration_ms) as "s" from issue_worklog where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; a?: bigint; s?: number }>>()
        expect(row).toEqual(expected)
    })

    test('optional-custom-int-receiver-unary-math', async () => {
        // `optionalReleaseOrdinal` is an OPTIONAL customInt View column (ReleaseTag,
        // plusOffsetAdapter read +1000). Release 1 resolves optional_release_ordinal
        // to id 1 (download_count present). abs keeps the branded leaf (?: ReleaseTag);
        // sign returns a number leaf.
        const expected = { id: 1, a: 1001 as ReleaseTag, s: 1001 }
        ctx.mockNext({ id: 1, a: 1, s: 1 })
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({
                id: vReleaseOverview.id,
                a:  vReleaseOverview.optionalReleaseOrdinal.abs(),
                s:  vReleaseOverview.optionalReleaseOrdinal.sign(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, abs(optional_release_ordinal) as "a", sign(optional_release_ordinal) as "s" from release_overview where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; a?: ReleaseTag; s?: number }>>()
        expect(row).toEqual(expected)
    })

    test('optional-custom-double-receiver-unary-math', async () => {
        // `billedAmount.asOptional()` is an OPTIONAL customDouble receiver (Money,
        // no adapter). Worklog 1 billed_amount 200. abs keeps the branded leaf
        // (?: Money); sign returns a number leaf.
        const expected = { id: 1, a: 200, s: 1 }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                a:  tIssueWorklog.billedAmount.asOptional().abs(),
                s:  tIssueWorklog.billedAmount.asOptional().sign(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, abs(billed_amount) as "a", sign(billed_amount) as "s" from issue_worklog where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; a?: number; s?: number }>>()
        expect(row).toEqual(expected)
    })

    // Direct `ceil()` / `floor()` / `round()` / `logn()` / `roundn()` on a bare
    // int column receiver (`tIssue.priority`), with no `.divide()` / `.power()`
    // in front. The wrapper and result type match the prefixed forms above; the
    // only difference is that the receiver isn't the `::float` / `power(...)`
    // expression a preceding op would produce, so the function wraps the column
    // directly. priority(id=1) is 2.

    test('ceil-int-receiver', async () => {
        const expected = [{ id: 1, c: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                c:  tIssue.priority.ceil(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ceil(priority) as "c" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; c: number }>>>()
        expect(result).toEqual(expected)
    })

    test('floor-int-receiver', async () => {
        const expected = [{ id: 1, f: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                f:  tIssue.priority.floor(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, floor(priority) as "f" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; f: number }>>>()
        expect(result).toEqual(expected)
    })

    test('round-int-receiver', async () => {
        const expected = [{ id: 1, r: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                r:  tIssue.priority.round(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round((priority)::numeric) as "r" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; r: number }>>>()
        expect(result).toEqual(expected)
    })

    test('logn-int-receiver', async () => {
        // Two-arg logarithm on a bare int receiver: log base 2 of priority(id=1)=2 = 1.
        const expected = [{ id: 1, l: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                l:  tIssue.priority.logn(2),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, log(($1)::numeric, (priority)::numeric) as "l" from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; l: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.l).toBeCloseTo(1, 5)
        } else {
            expect(result).toEqual(expected)
        }
    })

    test('roundn-int-receiver', async () => {
        // `.roundn(n)` on a bare int receiver: round(priority(id=1)=2, 2) = 2.
        const expected = [{ id: 1, r: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                r:  tIssue.priority.roundn(2),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round((priority)::numeric, $1) as "r" from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; r: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.r).toBeCloseTo(2, 2)
        } else {
            expect(result).toEqual(expected)
        }
    })

    // ── Receiver fan-out: the unary / SqlFunction1 / cast methods on the
    // double-optional, double-required (via .asDouble()) and bigint-optional
    // receivers, mirroring the plain-int-receiver coverage above onto the
    // other numeric leaves (the wrapper SQL and result type match; only the
    // receiver leaf and its optionality/brand differ).

    test('optional-double-receiver-unary-f1-fan-out', async () => {
        // The unary math (abs/ceil/floor/sign/cbrt/exp/ln/log10), SqlFunction1
        // (logn/roundn/atan2) and cast (asInt/asBigint/asDouble) methods on an
        // OPTIONAL double receiver (`estimatedHours`). Every leaf threads the
        // `optional` marker (`?: number`, and asBigint `?: bigint`). estimated_hours
        // is NULL in the seed, so it is set to 8 inside the rollback: abs/ceil/floor=8,
        // sign=1, cbrt(8)=2, logn base-2=3, roundn(2)=8, asInt/asDouble=8, asBigint=8n;
        // exp/ln/log10/atan2 are irrational floats (toBeCloseTo).
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 8 }).where(tIssue.id.equals(1)).executeUpdate()

            const expected = {
                id: 1, ab: 8, ce: 8, fl: 8, sg: 1, cb: 2,
                ex: Math.exp(8), ln: Math.log(8), l10: Math.log10(8),
                lgn: 3, rn: 8, at: Math.atan2(8, 2),
                ai: 8, abi: 8n, ad: 8,
            }
            ctx.mockNext(expected)
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({
                    id:  tIssue.id,
                    ab:  tIssue.estimatedHours.abs(),
                    ce:  tIssue.estimatedHours.ceil(),
                    fl:  tIssue.estimatedHours.floor(),
                    sg:  tIssue.estimatedHours.sign(),
                    cb:  tIssue.estimatedHours.cbrt(),
                    ex:  tIssue.estimatedHours.exp(),
                    ln:  tIssue.estimatedHours.ln(),
                    l10: tIssue.estimatedHours.log10(),
                    lgn: tIssue.estimatedHours.logn(2),
                    rn:  tIssue.estimatedHours.roundn(2),
                    at:  tIssue.estimatedHours.atan2(2),
                    ai:  tIssue.estimatedHours.asInt(),
                    abi: tIssue.estimatedHours.asBigint(),
                    ad:  tIssue.estimatedHours.asDouble(),
                })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, abs(estimated_hours) as ab, ceil(estimated_hours) as ce, floor(estimated_hours) as fl, sign(estimated_hours) as sg, cbrt(estimated_hours) as cb, exp(estimated_hours) as ex, ln(estimated_hours) as ln, log(estimated_hours) as l10, log(($1)::numeric, (estimated_hours)::numeric) as lgn, round((estimated_hours)::numeric, $2) as rn, atan2(estimated_hours, $3) as at, round((estimated_hours)::numeric)::bigint as ai, round((estimated_hours)::numeric)::bigint as abi, estimated_hours::float as ad from issue where id = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
                2,
                2,
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id: number
                ab?: number; ce?: number; fl?: number; sg?: number; cb?: number
                ex?: number; ln?: number; l10?: number
                lgn?: number; rn?: number; at?: number
                ai?: number; abi?: bigint; ad?: number
            }>>()
            if (ctx.realDbEnabled) {
                expect(row.id).toBe(1)
                expect(row.ab).toBe(8); expect(row.ce).toBe(8); expect(row.fl).toBe(8)
                expect(row.sg).toBe(1); expect(Number(row.cb)).toBeCloseTo(2, 5)
                expect(row.ex).toBeCloseTo(Math.exp(8), 3)
                expect(row.ln).toBeCloseTo(Math.log(8), 5)
                expect(row.l10).toBeCloseTo(Math.log10(8), 5)
                expect(Number(row.lgn)).toBeCloseTo(3, 5)
                expect(Number(row.rn)).toBeCloseTo(8, 5)
                expect(row.at).toBeCloseTo(Math.atan2(8, 2), 5)
                expect(Number(row.ai)).toBe(8); expect(BigInt(row.abi!)).toBe(8n)
                expect(Number(row.ad)).toBeCloseTo(8, 5)
            } else {
                expect(row).toEqual(expected)
            }
        })
    })

    test('double-required-receiver-unary-f1-fan-out', async () => {
        // The unary math, SqlFunction1 (power/logn/roundn/atan2) and
        // minValue/maxValue methods on a REQUIRED double receiver
        // (`priority.asDouble()` = 2.0 for issue 1). Every leaf stays REQUIRED
        // (`number`). abs/ceil/floor=2, sign=1, power(2)=4, logn base-2=1,
        // roundn(2)=2, minValue(1)=greatest(2,1)=2, maxValue(3)=least(2,3)=2;
        // cbrt/exp/ln/log10/atan2 are irrational floats (toBeCloseTo).
        const base = () => tIssue.priority.asDouble()
        const expected = {
            id: 1, ab: 2, ce: 2, fl: 2, sg: 1,
            cb: Math.cbrt(2), ex: Math.exp(2), ln: Math.log(2), l10: Math.log10(2),
            pw: 4, lgn: 1, rn: 2, at: Math.PI / 4, mn: 2, mx: 2,
        }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                ab:  base().abs(),
                ce:  base().ceil(),
                fl:  base().floor(),
                sg:  base().sign(),
                cb:  base().cbrt(),
                ex:  base().exp(),
                ln:  base().ln(),
                l10: base().log10(),
                pw:  base().power(2),
                lgn: base().logn(2),
                rn:  base().roundn(2),
                at:  base().atan2(2),
                mn:  base().minValue(1),
                mx:  base().maxValue(3),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, abs(priority::float) as ab, ceil(priority::float) as ce, floor(priority::float) as fl, sign(priority::float) as sg, cbrt(priority::float) as cb, exp(priority::float) as ex, ln(priority::float) as ln, log(priority::float) as l10, power(priority::float, $1) as pw, log(($2)::numeric, (priority::float)::numeric) as lgn, round((priority::float)::numeric, $3) as rn, atan2(priority::float, $4) as at, greatest(priority::float, $5) as mn, least(priority::float, $6) as mx from issue where id = $7"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            2,
            2,
            2,
            1,
            3,
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id: number
            ab: number; ce: number; fl: number; sg: number
            cb: number; ex: number; ln: number; l10: number
            pw: number; lgn: number; rn: number; at: number; mn: number; mx: number
        }>>()
        if (ctx.realDbEnabled) {
            expect(row.id).toBe(1)
            expect(row.ab).toBe(2); expect(row.ce).toBe(2); expect(row.fl).toBe(2); expect(row.sg).toBe(1)
            expect(row.cb).toBeCloseTo(Math.cbrt(2), 10)
            expect(row.ex).toBeCloseTo(Math.exp(2), 5)
            expect(row.ln).toBeCloseTo(Math.log(2), 5)
            expect(row.l10).toBeCloseTo(Math.log10(2), 5)
            expect(row.pw).toBeCloseTo(4, 5)
            expect(Number(row.lgn)).toBeCloseTo(1, 5)
            expect(Number(row.rn)).toBeCloseTo(2, 5)
            expect(row.at).toBeCloseTo(Math.PI / 4, 5)
            expect(row.mn).toBeCloseTo(2, 5); expect(row.mx).toBeCloseTo(2, 5)
        } else {
            expect(row).toEqual(expected)
        }
    })

    test('optional-bigint-receiver-rounding-arithmetic-fan-out', async () => {
        // ceil/floor/round and the const-operand arithmetic (subtract/modulo/
        // minValue/maxValue) on an OPTIONAL bigint receiver (`durationMs` =
        // 5400000 for worklog 1). Every leaf keeps the bigint type and threads the
        // `optional` marker (`?: bigint`). ceil/floor/round=5400000n,
        // subtract(400000n)=5000000n, modulo(1000000n)=400000n,
        // minValue(6000000n)=greatest=6000000n, maxValue(6000000n)=least=5400000n.
        const expected = {
            id: 1, ce: 5400000n, fl: 5400000n, ro: 5400000n,
            s: 5000000n, mo: 400000n, mn: 6000000n, mx: 5400000n,
        }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                ce: tIssueWorklog.durationMs.ceil(),
                fl: tIssueWorklog.durationMs.floor(),
                ro: tIssueWorklog.durationMs.round(),
                s:  tIssueWorklog.durationMs.subtract(400000n),
                mo: tIssueWorklog.durationMs.modulo(1000000n),
                mn: tIssueWorklog.durationMs.minValue(6000000n),
                mx: tIssueWorklog.durationMs.maxValue(6000000n),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ceil(duration_ms) as ce, floor(duration_ms) as fl, round((duration_ms)::numeric) as ro, duration_ms - $1 as "s", duration_ms % $2 as mo, greatest(duration_ms, $3) as mn, least(duration_ms, $4) as mx from issue_worklog where id = $5"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            400000n,
            1000000n,
            6000000n,
            6000000n,
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id: number; ce?: bigint; fl?: bigint; ro?: bigint
            s?: bigint; mo?: bigint; mn?: bigint; mx?: bigint
        }>>()
        if (ctx.realDbEnabled) {
            expect(row.id).toBe(1)
            expect(BigInt(row.ce!)).toBe(5400000n)
            expect(BigInt(row.fl!)).toBe(5400000n)
            expect(BigInt(row.ro!)).toBe(5400000n)
            expect(BigInt(row.s!)).toBe(5000000n)
            expect(BigInt(row.mo!)).toBe(400000n)
            expect(BigInt(row.mn!)).toBe(6000000n)
            expect(BigInt(row.mx!)).toBe(5400000n)
        } else {
            expect(row).toEqual(expected)
        }
    })

    test('optional-int-receiver-unary-f1-fan-out', async () => {
        // The unary math (abs/ceil/floor/sign/sqrt/cbrt/exp/ln/log10), SqlFunction1
        // (power/logn/roundn/atan2) and cast (asDouble/asBigint) methods on an OPTIONAL
        // int receiver (`assigneeId`). Every leaf threads the `optional` marker
        // (`?: number`, and asBigint `?: bigint`). Issue 4 has assignee_id = 3 (present):
        // abs/ceil/floor=3, sign=1, power(2)=9, logn base-3=1, roundn(2)=3, asDouble=3,
        // asBigint=3n; sqrt/cbrt/exp/ln/log10/atan2 are irrational floats (toBeCloseTo).
        const expected = {
            id: 4, ab: 3, ce: 3, fl: 3, sg: 1,
            sq: Math.sqrt(3), cb: Math.cbrt(3), ex: Math.exp(3), ln: Math.log(3), l10: Math.log10(3),
            pw: 9, lgn: 1, rn: 3, at: Math.atan2(3, 2),
            ad: 3, abi: 3n,
        }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(4))
            .select({
                id:  tIssue.id,
                ab:  tIssue.assigneeId.abs(),
                ce:  tIssue.assigneeId.ceil(),
                fl:  tIssue.assigneeId.floor(),
                sg:  tIssue.assigneeId.sign(),
                sq:  tIssue.assigneeId.sqrt(),
                cb:  tIssue.assigneeId.cbrt(),
                ex:  tIssue.assigneeId.exp(),
                ln:  tIssue.assigneeId.ln(),
                l10: tIssue.assigneeId.log10(),
                pw:  tIssue.assigneeId.power(2),
                lgn: tIssue.assigneeId.logn(3),
                rn:  tIssue.assigneeId.roundn(2),
                at:  tIssue.assigneeId.atan2(2),
                ad:  tIssue.assigneeId.asDouble(),
                abi: tIssue.assigneeId.asBigint(),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, abs(assignee_id) as ab, ceil(assignee_id) as ce, floor(assignee_id) as fl, sign(assignee_id) as sg, sqrt(assignee_id) as sq, cbrt(assignee_id) as cb, exp(assignee_id) as ex, ln(assignee_id) as ln, log(assignee_id) as l10, power(assignee_id, $1) as pw, log(($2)::numeric, (assignee_id)::numeric) as lgn, round((assignee_id)::numeric, $3) as rn, atan2(assignee_id, $4) as at, assignee_id::float as ad, assignee_id as abi from issue where id = $5"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
            2,
            2,
            4,
          ]
        `)
        assertType<Exact<typeof row, {
            id: number
            ab?: number; ce?: number; fl?: number; sg?: number
            sq?: number; cb?: number; ex?: number; ln?: number; l10?: number
            pw?: number; lgn?: number; rn?: number; at?: number
            ad?: number; abi?: bigint
        }>>()
        if (ctx.realDbEnabled) {
            expect(row.id).toBe(4)
            expect(row.ab).toBe(3); expect(row.ce).toBe(3); expect(row.fl).toBe(3); expect(row.sg).toBe(1)
            expect(row.sq).toBeCloseTo(Math.sqrt(3), 5)
            expect(row.cb).toBeCloseTo(Math.cbrt(3), 10)
            expect(row.ex).toBeCloseTo(Math.exp(3), 5)
            expect(row.ln).toBeCloseTo(Math.log(3), 5)
            expect(row.l10).toBeCloseTo(Math.log10(3), 5)
            expect(row.pw).toBeCloseTo(9, 5)
            expect(Number(row.lgn)).toBeCloseTo(1, 5)
            expect(Number(row.rn)).toBeCloseTo(3, 5)
            expect(row.at).toBeCloseTo(Math.atan2(3, 2), 5)
            expect(Number(row.ad)).toBeCloseTo(3, 5)
            expect(BigInt(row.abi!)).toBe(3n)
        } else {
            expect(row).toEqual(expected)
        }
    })

    test('asInt-chained-into-numeric-op', async () => {
        // A REQUIRED double value's `.asInt()` chained into downstream int
        // ops. The receiver is `priority.asDouble()` (int→double, priority(id=1)=2
        // → 2.0); `.asInt()` on a double rounds back to int
        // (`round((priority::float)::numeric)`) and the `.modulo(2)` / `.add(1)`
        // ops wrap that expression. priority(1)=2 → asInt 2 → modulo(2)=0,
        // add(1)=3. Required receiver → required `number` leaves.
        const expected = [{ id: 1, m: 0, a: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                m:  tIssue.priority.asDouble().asInt().modulo(2),
                a:  tIssue.priority.asDouble().asInt().add(1),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round((priority::float)::numeric)::bigint % $1 as "m", round((priority::float)::numeric)::bigint + $2 as "a" from issue where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; m: number; a: number }>>>()
        expect(result).toEqual(expected)
    })

    test('asBigint-chained-into-bigint-op', async () => {
        // A REQUIRED int value's `.asBigint()` chained into downstream bigint ops.
        // `priority.asBigint()` is an int→bigint Noop-wrap that emits no SQL
        // (renders the bare column), so `.add(2n)` / `.modulo(2n)` wrap `priority`
        // directly. priority(id=1)=2 → add(2n)=4n, modulo(2n)=0n. Required
        // receiver → required `bigint` leaves.
        const expected = [{ id: 1, a: 4n, m: 0n }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                a:  tIssue.priority.asBigint().add(2n),
                m:  tIssue.priority.asBigint().modulo(2n),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority + $1 as "a", priority % $2 as "m" from issue where id = $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2n,
            2n,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; a: bigint; m: bigint }>>>()
        if (ctx.realDbEnabled) {
            expect(BigInt(result[0]!.a)).toBe(4n)
            expect(BigInt(result[0]!.m)).toBe(0n)
        } else {
            expect(result).toEqual(expected)
        }
    })
})
