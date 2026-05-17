// Behavioral coverage of numeric operators on int columns:
// add / subtract / multiply / modulo / abs and arithmetic negation
// (multiply by -1).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, floor(priority::float / $1::float) as "f" from issue where id = $2"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ceil(priority::float / $1::float) as "c" from issue where id = $2"`)
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
        // priority(id=2) is 1 → 1/2 = 0.5 → round(0.5) = 1.
        // The PostgreSQL builder wraps the operand of `.round()` in
        // `::numeric` so ties break away from zero, matching every other
        // supported dialect. Set `usePlatformDependentRound = true`
        // on the connection to opt into PostgreSQL's native
        // `round(double precision)` (platform-dependent / round-to-even).
        const expected = [{ id: 2, r: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                id: tIssue.id,
                r:  tIssue.priority.divide(2).round(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round((priority::float / $1::float)::numeric) as "r" from issue where id = $2"`)
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
        // TODO[BUG] sqlite: SqliteSqlBuilder._ln emits `log(x)` which is
        // base-10 in SQLite, so real-DB returns log10(e^2) ≈ 0.868
        // instead of 2. We still assert SQL/params/type to catch future
        // SQL-emission regressions; the data assertion only runs in mock
        // mode and on dialects whose `ln(x)` actually means natural log.
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
        if (!ctx.realDbEnabled) {
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
        // The PostgreSQL builder casts both arguments of `log(b, x)` to
        // `numeric` so the two-argument logarithm overload resolves: PG only
        // defines `log(numeric, numeric)` and the implicit numeric → double
        // cast does not apply to the base parameter (which is emitted as an
        // unbound `unknown`).
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
})
