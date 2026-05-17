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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority + @0 as p2 from issue where id = @1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority - @0 as p_minus_1 from issue where id = @1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority * @0 as doubled from issue where id = @1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority % @0 as [m] from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; m: number }>>>()
        expect(result).toEqual(expected)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority * @0 as neg, abs(priority * @1) as absNeg from issue where id = @2"`)
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
