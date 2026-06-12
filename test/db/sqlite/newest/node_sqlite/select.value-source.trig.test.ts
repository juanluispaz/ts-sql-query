// Trigonometric `SqlOperation0` paths on `ValueSourceImpl`:
// `.acos()`, `.asin()`, `.atan()`, `.cos()`, `.cot()`, `.sin()`,
// `.tan()` — each forwards to the corresponding `_acos`/`_asin`/…
// emitter on [AbstractSqlBuilder.ts:L2688-L2708](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L2688).
// `.atan2(other)` (the 2-arg variant) is already covered by
// `select.numeric-ops.test.ts`, so this file pins only the 1-arg
// trig family.
//
// bun:sqlite exposes the standard SQL trig functions
// `acos`/`asin`/`atan`/`cos`/`sin`/`tan` natively, so those cells run
// end-to-end against the real DB and the runtime value is asserted with
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
})
