// Expressions whose operands are all consts — values the application supplies
// (a threshold, a quantity), combined among themselves inside a query. Each const
// is a query parameter, so the database has no column next to it to learn its
// type from: the values must still be compared and combined as numbers.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('const-operands-are-compared-and-combined-as-numbers', async () => {
        // 7 against a limit of 10: compared as text '7' would be greater than '10'.
        const quantity = 7
        const limit = 10
        const expected = { underLimit: true, overLimit: false, inRange: true, atLeastLimit: 10, atMostLimit: 7, total: 17, belowFraction: true }
        ctx.mockNext(expected)
        const connection = ctx.conn
        const row = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                underLimit:    connection.const(quantity, 'int').lessThan(limit),
                overLimit:     connection.const(quantity, 'int').greaterThan(limit),
                inRange:       connection.const(quantity, 'int').between(5, limit),
                atLeastLimit:  connection.const(quantity, 'int').minValue(limit),
                atMostLimit:   connection.const(quantity, 'int').maxValue(limit),
                total:         connection.const(quantity, 'int').add(limit),
                belowFraction: connection.const(2.5, 'double').lessThan(10.25),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ?1 < ?2 as underLimit, ?3 > ?4 as overLimit, ?5 between ?6 and ?7 as inRange, max(?8, ?9) as atLeastLimit, min(?10, ?11) as atMostLimit, ?12 + ?13 as total, ?14 < ?15 as belowFraction from issue where id = ?16"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            7,
            10,
            7,
            10,
            7,
            5,
            10,
            7,
            10,
            7,
            10,
            7,
            10,
            2.5,
            10.25,
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            underLimit:    boolean
            overLimit:     boolean
            inRange:       boolean
            atLeastLimit:  number
            atMostLimit:   number
            total:         number
            belowFraction: boolean
        }>>()
        expect(row).toEqual(expected)
    })

    test('aggregates-and-fallbacks-over-const-operands', async () => {
        // Two points per issue over the four issues; a missing bonus falls back to 3.
        const pointsPerIssue = 2
        const bonus: number | null = null
        const expected = { totalPoints: 8, counted: 4, withBonus: 4 }
        ctx.mockNext(expected)
        const connection = ctx.conn
        const row = await connection.selectFrom(tIssue)
            .select({
                totalPoints: connection.sum(connection.const(pointsPerIssue, 'int')),
                counted:     connection.count(connection.const(pointsPerIssue, 'int')),
                withBonus:   connection.max(connection.optionalConst(bonus, 'int').valueWhenNull(3).add(1)),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(?1) as totalPoints, count(?2) as counted, max(ifnull(?3, ?4) + ?5) as withBonus from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            2,
            null,
            3,
            1,
          ]
        `)
        assertType<Exact<typeof row, { totalPoints?: number; counted: number; withBonus?: number }>>()
        expect(row).toEqual(expected)
    })
})
