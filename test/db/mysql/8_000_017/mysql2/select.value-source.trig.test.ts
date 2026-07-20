// Trigonometric functions on numeric columns: acos, asin, atan, cos,
// cot, sin, tan (the 1-arg family; atan2 is covered in
// select.numeric-ops.test.ts). acos/asin need |x| <= 1, so priority
// (issue 1 = 2) is divided by 10 to land in [0.1, 0.3]. Real results
// are floats, so the real-DB branch asserts with toBeCloseTo.

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, acos(cast(priority as double) / ?) as \`v\` from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, asin(cast(priority as double) / ?) as \`v\` from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, atan(priority) as \`v\` from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cos(priority) as \`v\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cot(priority) as \`v\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
    })

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, sin(priority) as \`v\` from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tan(priority) as \`v\` from issue where id = ?"`)
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
    // TODO[LIMITATION]-wrapped on the SQLite cells (that build lacks `cot`), matching
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, acos(estimated_hours / ?) as ac, asin(estimated_hours / ?) as \`as\`, atan(estimated_hours / ?) as \`at\`, cos(estimated_hours / ?) as co, sin(estimated_hours / ?) as si, tan(estimated_hours / ?) as ta from issue where id = ?"`)
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

    test('trig-cot/optional-double-receiver', async () => {
        // `cot` on the optional-double receiver (SQLite lacks it → TODO[LIMITATION]
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cot(estimated_hours / ?) as ct from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, acos(cast(priority as double) / ?) as ac, asin(cast(priority as double) / ?) as \`as\`, atan(cast(priority as double) / ?) as \`at\`, cos(cast(priority as double) / ?) as co, sin(cast(priority as double) / ?) as si, tan(cast(priority as double) / ?) as ta from issue where id = ?"`)
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

    test('trig-cot/double-required-receiver', async () => {
        // `cot` on the required-double receiver (SQLite lacks it → TODO[LIMITATION]
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cot(cast(priority as double) / ?) as ct from issue where id = ?"`)
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
    // The 1-arg trig family on an OPTIONAL-INT receiver (`assigneeId`, = 1 for issue 1,
    // present). `divide(2)` lands the operand at 0.5 so acos/asin stay in-domain, and
    // carries the optional marker through, so every leaf is `?: number`. `cot` is a
    // SEPARATE test so it can be TODO[LIMITATION]-wrapped on the SQLite cells (that build
    // lacks `cot`). Real results are floats (toBeCloseTo).

    test('trig-domain-safe/optional-int-receiver', async () => {
        const expected = {
            id: 1,
            ac: Math.acos(0.5), as: Math.asin(0.5), at: Math.atan(0.5),
            co: Math.cos(0.5), si: Math.sin(0.5), ta: Math.tan(0.5),
        }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                ac: tIssue.assigneeId.divide(2).acos(),
                as: tIssue.assigneeId.divide(2).asin(),
                at: tIssue.assigneeId.divide(2).atan(),
                co: tIssue.assigneeId.divide(2).cos(),
                si: tIssue.assigneeId.divide(2).sin(),
                ta: tIssue.assigneeId.divide(2).tan(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, acos(cast(assignee_id as double) / ?) as ac, asin(cast(assignee_id as double) / ?) as \`as\`, atan(cast(assignee_id as double) / ?) as \`at\`, cos(cast(assignee_id as double) / ?) as co, sin(cast(assignee_id as double) / ?) as si, tan(cast(assignee_id as double) / ?) as ta from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            2,
            2,
            2,
            2,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id: number; ac?: number; as?: number; at?: number; co?: number; si?: number; ta?: number
        }>>()
        if (ctx.realDbEnabled) {
            expect(row.id).toBe(1)
            expect(row.ac).toBeCloseTo(Math.acos(0.5), 5)
            expect(row.as).toBeCloseTo(Math.asin(0.5), 5)
            expect(row.at).toBeCloseTo(Math.atan(0.5), 5)
            expect(row.co).toBeCloseTo(Math.cos(0.5), 5)
            expect(row.si).toBeCloseTo(Math.sin(0.5), 5)
            expect(row.ta).toBeCloseTo(Math.tan(0.5), 5)
        } else {
            expect(row).toEqual(expected)
        }
    })

    test('trig-cot/optional-int-receiver', async () => {
        // `cot` on the optional-int receiver (SQLite lacks it → TODO[LIMITATION] there).
        // assigneeId(issue 1) = 1; divide(2) = 0.5; cot(0.5) = 1/tan(0.5). Optional leaf
        // `?: number`.
        const expected = { id: 1, ct: 1 / Math.tan(0.5) }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                ct: tIssue.assigneeId.divide(2).cot(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cot(cast(assignee_id as double) / ?) as ct from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; ct?: number }>>()
        if (ctx.realDbEnabled) {
            expect(row.id).toBe(1)
            expect(row.ct).toBeCloseTo(1 / Math.tan(0.5), 5)
        } else {
            expect(row).toEqual(expected)
        }
    })
})
