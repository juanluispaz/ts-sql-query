// Behavioral coverage of date/time operators. Uses the seeded
// `created_at` columns and connection-level `currentDate` /
// `currentDateTime` helpers.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('currentDate', async () => {
        const expected = [{ today: new Date() }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFromNoTable()
            .select({ today: ctx.conn.currentDate() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select current_date as today"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ today: Date }>>>()
        if (ctx.realDbEnabled) {
            expect(rows[0]?.today).toBeInstanceOf(Date)
        }
    })

    test('currentDateTime', async () => {
        const expected = [{ now: new Date() }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFromNoTable()
            .select({ now: ctx.conn.currentDateTime() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select current_timestamp as now"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ now: Date }>>>()
        if (ctx.realDbEnabled) {
            expect(rows[0]?.now).toBeInstanceOf(Date)
        }
    })

    test('getFullYear', async () => {
        const expected = [{ id: 1, year: 2024 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:   tOrganization.id,
                year: tOrganization.createdAt.getFullYear(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, year(created_at) as year from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; year: number }>>>()
        if (ctx.realDbEnabled) {
            expect(rows[0]?.year).toBeGreaterThanOrEqual(2000)
        }
    })

    test('getMonth-getDate', async () => {
        const expected = [{ id: 1, month: 6, date: 15 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:    tOrganization.id,
                month: tOrganization.createdAt.getMonth(),
                date:  tOrganization.createdAt.getDate(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, month(created_at) - 1 as month, dayofmonth(created_at) as date from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; month: number; date: number }>>>()
        if (ctx.realDbEnabled) {
            // getMonth() follows JS Date semantics: 0 = January, 11 = December.
            expect(rows[0]?.month).toBeGreaterThanOrEqual(0)
            expect(rows[0]?.month).toBeLessThanOrEqual(11)
            expect(rows[0]?.date).toBeGreaterThanOrEqual(1)
            expect(rows[0]?.date).toBeLessThanOrEqual(31)
        }
    })

    test('getHours-getMinutes-getSeconds', async () => {
        const expected = [{ id: 1, h: 12, m: 30, s: 45 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                h:  tIssue.createdAt.getHours(),
                m:  tIssue.createdAt.getMinutes(),
                s:  tIssue.createdAt.getSeconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, hour(created_at) as \`h\`, minute(created_at) as \`m\`, second(created_at) as \`s\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; h: number; m: number; s: number }>>>()
        if (ctx.realDbEnabled) {
            expect(rows[0]?.h).toBeGreaterThanOrEqual(0)
            expect(rows[0]?.h).toBeLessThan(24)
        }
    })

    test('compare-date-with-current', async () => {
        // Find rows whose created_at is before "now".
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.lessThan(ctx.conn.currentDateTime()))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at < current_timestamp order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (ctx.realDbEnabled) {
            expect(rows.map(r => r.id).sort()).toEqual([1, 2])
        }
    })
})
