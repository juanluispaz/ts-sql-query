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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, acos(priority::float / $1::float) as "v" from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            10,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(Math.acos(0.2), 5)
        } else {
            expect(result).toEqual(expected)
        }
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, asin(priority::float / $1::float) as "v" from issue where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            10,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(Math.asin(0.2), 5)
        } else {
            expect(result).toEqual(expected)
        }
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, atan(priority) as "v" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(Math.atan(2), 5)
        } else {
            expect(result).toEqual(expected)
        }
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cos(priority) as "v" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(Math.cos(2), 5)
        } else {
            expect(result).toEqual(expected)
        }
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cot(priority) as "v" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(1 / Math.tan(2), 5)
        } else {
            expect(result).toEqual(expected)
        }
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, sin(priority) as "v" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(Math.sin(2), 5)
        } else {
            expect(result).toEqual(expected)
        }
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tan(priority) as "v" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; v: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result[0]!.id).toBe(1)
            expect(result[0]!.v).toBeCloseTo(Math.tan(2), 5)
        } else {
            expect(result).toEqual(expected)
        }
    })
})
