// Trigonometric `SqlOperation0` paths on `ValueSourceImpl`:
// `.acos()`, `.asin()`, `.atan()`, `.cos()`, `.cot()`, `.sin()`,
// `.tan()` — each forwards to the corresponding `_acos`/`_asin`/…
// emitter on.
// `.atan2(other)` (the 2-arg variant) is already covered by
// `select.numeric-ops.test.ts`, so this file pins only the 1-arg
// trig family.
//
// The standard SQL trig functions `acos`/`asin`/`atan`/`cos`/`sin`/`tan`
// are available natively here, so the runtime value is asserted with
// `toBeCloseTo`. The one exception is `cot`, which this SQLite build does
// NOT provide (`no such function: cot`); that block is NOT-APPLICABLE and
// kept commented for cross-cell symmetry.
//
// The scalar values pulled from `tIssue.priority` (range 1..3) are
// inside the legal domain for every trig function exercised here
// (acos/asin require |x| <= 1; we use `divide(10)` to land in
// [0.1, 0.3]).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('acos', async () => {
        const expected = [{ id: 1, v: Math.acos(0.2) }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                v:  tIssue.priority.divide(10).acos(),
            })
            .executeSelectMany()
        assertType<Exact<typeof result, Array<{ id: number; v: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(Math.acos(0.2), 5)
        } else {
            expect(result).toEqual(expected)
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, acos(cast(priority as real) / cast(? as real)) as "v" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            10,
            1,
          ]
        `)
    })

    test('asin', async () => {
        const expected = [{ id: 1, v: Math.asin(0.2) }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                v:  tIssue.priority.divide(10).asin(),
            })
            .executeSelectMany()
        assertType<Exact<typeof result, Array<{ id: number; v: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(Math.asin(0.2), 5)
        } else {
            expect(result).toEqual(expected)
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, asin(cast(priority as real) / cast(? as real)) as "v" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            10,
            1,
          ]
        `)
    })

    test('atan', async () => {
        const expected = [{ id: 1, v: Math.atan(2) }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                v:  tIssue.priority.atan(),
            })
            .executeSelectMany()
        assertType<Exact<typeof result, Array<{ id: number; v: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(Math.atan(2), 5)
        } else {
            expect(result).toEqual(expected)
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, atan(priority) as "v" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

    test('cos', async () => {
        const expected = [{ id: 1, v: Math.cos(2) }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                v:  tIssue.priority.cos(),
            })
            .executeSelectMany()
        assertType<Exact<typeof result, Array<{ id: number; v: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(Math.cos(2), 5)
        } else {
            expect(result).toEqual(expected)
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cos(priority) as "v" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

    // NOT-APPLICABLE: this SQLite build has no `cot` math function
    // (`no such function: cot`), unlike acos/asin/atan/cos/sin/tan which
    // it exposes natively. Kept commented for cross-cell symmetry.
    /*
    test('cot', async () => {
        const expected = [{ id: 1, v: 1 / Math.tan(2) }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                v:  tIssue.priority.cot(),
            })
            .executeSelectMany()
        assertType<Exact<typeof result, Array<{ id: number; v: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(1 / Math.tan(2), 5)
        } else {
            expect(result).toEqual(expected)
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cot(priority) as "v" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })
    */

    test('sin', async () => {
        const expected = [{ id: 1, v: Math.sin(2) }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                v:  tIssue.priority.sin(),
            })
            .executeSelectMany()
        assertType<Exact<typeof result, Array<{ id: number; v: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(Math.sin(2), 5)
        } else {
            expect(result).toEqual(expected)
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, sin(priority) as "v" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

    test('tan', async () => {
        const expected = [{ id: 1, v: Math.tan(2) }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                v:  tIssue.priority.tan(),
            })
            .executeSelectMany()
        assertType<Exact<typeof result, Array<{ id: number; v: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(Math.tan(2), 5)
        } else {
            expect(result).toEqual(expected)
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tan(priority) as "v" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })
    // ── Trig fan-out onto the OTHER numeric receivers ─────────────────────
    // The 1-arg trig family (acos/asin/atan/cos/sin/tan) on an optional-double
    // receiver (`estimatedHours`) and a required-double receiver
    // (`priority.asDouble()`). Operands are put in [−1, 1] via `.divide(10)` so
    // acos/asin stay in-domain. `cot` is a SEPARATE test per receiver so it can be
    // NOT-APPLICABLE-wrapped on the SQLite cells (that build lacks `cot`), matching
    // the required-int coverage above. Real results are floats (toBeCloseTo).

    test('trig-domain-safe/optional-double-receiver', async () => {
        // estimated_hours is NULL in the seed, so it is set to 8 inside the rollback;
        // divide(10) = 0.8 lands in-domain. Optional receiver → every leaf `?: number`.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 8 }).where(tIssue.id.equals(1)).executeUpdate()

            const expected = {
                id: 1,
                ac: Math.acos(0.8), as: Math.asin(0.8), at: Math.atan(0.8),
                co: Math.cos(0.8), si: Math.sin(0.8), ta: Math.tan(0.8),
            }
            ctx.mockNext(expected)
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({
                    id: tIssue.id,
                    ac: tIssue.estimatedHours.divide(10).acos(),
                    as: tIssue.estimatedHours.divide(10).asin(),
                    at: tIssue.estimatedHours.divide(10).atan(),
                    co: tIssue.estimatedHours.divide(10).cos(),
                    si: tIssue.estimatedHours.divide(10).sin(),
                    ta: tIssue.estimatedHours.divide(10).tan(),
                })
                .executeSelectOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, acos(cast(estimated_hours as real) / cast(? as real)) as ac, asin(cast(estimated_hours as real) / cast(? as real)) as "as", atan(cast(estimated_hours as real) / cast(? as real)) as at, cos(cast(estimated_hours as real) / cast(? as real)) as co, sin(cast(estimated_hours as real) / cast(? as real)) as si, tan(cast(estimated_hours as real) / cast(? as real)) as ta from issue where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                10,
                10,
                10,
                10,
                10,
                10,
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id: number; ac?: number; as?: number; at?: number; co?: number; si?: number; ta?: number
            }>>()
            if (ctx.realDbEnabled) {
                expect(row.id).toBe(1)
                expect(row.ac).toBeCloseTo(Math.acos(0.8), 5)
                expect(row.as).toBeCloseTo(Math.asin(0.8), 5)
                expect(row.at).toBeCloseTo(Math.atan(0.8), 5)
                expect(row.co).toBeCloseTo(Math.cos(0.8), 5)
                expect(row.si).toBeCloseTo(Math.sin(0.8), 5)
                expect(row.ta).toBeCloseTo(Math.tan(0.8), 5)
            } else {
                expect(row).toEqual(expected)
            }
        })
    })

    // NOT-APPLICABLE: this SQLite build has no `cot` math function
    // (`no such function: cot`); kept commented for cross-cell symmetry.
    /*
    test('trig-cot/optional-double-receiver', async () => {
        // `cot` on the optional-double receiver (SQLite lacks it → NOT-APPLICABLE
        // there). estimated_hours set to 8; divide(10) = 0.8; cot(0.8) = 1/tan(0.8).
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 8 }).where(tIssue.id.equals(1)).executeUpdate()

            const expected = { id: 1, ct: 1 / Math.tan(0.8) }
            ctx.mockNext(expected)
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({
                    id: tIssue.id,
                    ct: tIssue.estimatedHours.divide(10).cot(),
                })
                .executeSelectOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cot(cast(estimated_hours as real) / cast(? as real)) as ct from issue where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                10,
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; ct?: number }>>()
            if (ctx.realDbEnabled) {
                expect(row.id).toBe(1)
                expect(row.ct).toBeCloseTo(1 / Math.tan(0.8), 5)
            } else {
                expect(row).toEqual(expected)
            }
        })
    })
    */

    test('trig-domain-safe/double-required-receiver', async () => {
        // The same 1-arg trig family on a REQUIRED double receiver
        // (`priority.asDouble()` = 2.0 for issue 1); divide(10) = 0.2 lands in-domain.
        // Required receiver → every leaf `number`.
        const expected = {
            id: 1,
            ac: Math.acos(0.2), as: Math.asin(0.2), at: Math.atan(0.2),
            co: Math.cos(0.2), si: Math.sin(0.2), ta: Math.tan(0.2),
        }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                ac: tIssue.priority.asDouble().divide(10).acos(),
                as: tIssue.priority.asDouble().divide(10).asin(),
                at: tIssue.priority.asDouble().divide(10).atan(),
                co: tIssue.priority.asDouble().divide(10).cos(),
                si: tIssue.priority.asDouble().divide(10).sin(),
                ta: tIssue.priority.asDouble().divide(10).tan(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, acos(cast(cast(priority as real) as real) / cast(? as real)) as ac, asin(cast(cast(priority as real) as real) / cast(? as real)) as "as", atan(cast(cast(priority as real) as real) / cast(? as real)) as at, cos(cast(cast(priority as real) as real) / cast(? as real)) as co, sin(cast(cast(priority as real) as real) / cast(? as real)) as si, tan(cast(cast(priority as real) as real) / cast(? as real)) as ta from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            10,
            10,
            10,
            10,
            10,
            10,
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id: number; ac: number; as: number; at: number; co: number; si: number; ta: number
        }>>()
        if (ctx.realDbEnabled) {
            expect(row.id).toBe(1)
            expect(row.ac).toBeCloseTo(Math.acos(0.2), 5)
            expect(row.as).toBeCloseTo(Math.asin(0.2), 5)
            expect(row.at).toBeCloseTo(Math.atan(0.2), 5)
            expect(row.co).toBeCloseTo(Math.cos(0.2), 5)
            expect(row.si).toBeCloseTo(Math.sin(0.2), 5)
            expect(row.ta).toBeCloseTo(Math.tan(0.2), 5)
        } else {
            expect(row).toEqual(expected)
        }
    })

    // NOT-APPLICABLE: this SQLite build has no `cot` math function
    // (`no such function: cot`); kept commented for cross-cell symmetry.
    /*
    test('trig-cot/double-required-receiver', async () => {
        // `cot` on the required-double receiver (SQLite lacks it → NOT-APPLICABLE
        // there). priority.asDouble() = 2.0; divide(10) = 0.2; cot(0.2) = 1/tan(0.2).
        const expected = { id: 1, ct: 1 / Math.tan(0.2) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                ct: tIssue.priority.asDouble().divide(10).cot(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cot(cast(cast(priority as real) as real) / cast(? as real)) as ct from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            10,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; ct: number }>>()
        if (ctx.realDbEnabled) {
            expect(row.id).toBe(1)
            expect(row.ct).toBeCloseTo(1 / Math.tan(0.2), 5)
        } else {
            expect(row).toEqual(expected)
        }
    })
    */
})
