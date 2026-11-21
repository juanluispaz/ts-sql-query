// The overflow option of Temporal's add, subtract and with: 'reject' rejects, as an error of the query, a day that the
// month reached hasn't, where 'constrain' (the default) takes it to the last day of the month. col_matrix row 1 has the
// date 2024-03-04 and the date and time 2024-01-14 12:30:00.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'
import { tColMatrixPlain, tRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

async function rejectionOf(query: Promise<unknown>): Promise<boolean> {
    try {
        await query
        return false
    } catch (error) {
        return error instanceof TsSqlError
    }
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('reject-gives-the-same-value-when-the-day-is-in-the-month', async () => {
        ctx.mockNext({ nextMonth: '2024-02-15', moment: '2024-02-15 10:00:00', february: '2024-02-15', dayBefore: '2024-03-30' })
        const january15 = ctx.conn.const(Temporal.PlainDate.from('2024-01-15'), 'plainDate')
        const row = await ctx.conn.selectFromNoTable()
            .select({
                nextMonth: january15.add({ months: 1 }, { overflow: 'reject' }),
                moment: ctx.conn.const(Temporal.PlainDateTime.from('2024-01-15T10:00'), 'plainDateTime').add({ months: 1 }, { overflow: 'reject' }),
                february: january15.with({ month: 2 }, { overflow: 'reject' }),
                dayBefore: ctx.conn.const(Temporal.PlainDate.from('2024-03-31'), 'plainDate').subtract({ days: 1 }, { overflow: 'reject' }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when day(?) > day(last_day(date_add(?, interval ? month))) then (select 1 union all select 1) else date_add(?, interval ? month) end as nextMonth, case when day(?) > day(last_day(date_add(?, interval ? month))) then (select 1 union all select 1) else date_add(?, interval ? month) end as moment, date_add(date_add(makedate(year(?), 1), interval 2 - 1 month), interval case when day(?) > day(last_day(date_add(makedate(year(?), 1), interval 2 - 1 month))) then (select 1 union all select 1) else day(?) end - 1 day) as february, date_add(?, interval ? day) as dayBefore"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-15",
            "2024-01-15",
            "1",
            "2024-01-15",
            "1",
            "2024-01-15T10:00:00",
            "2024-01-15T10:00:00",
            "1",
            "2024-01-15T10:00:00",
            "1",
            "2024-01-15",
            "2024-01-15",
            "2024-01-15",
            "2024-01-15",
            "2024-03-31",
            "-1",
          ]
        `)
        assertType<Exact<typeof row, { nextMonth: Temporal.PlainDate; moment: Temporal.PlainDateTime; february: Temporal.PlainDate; dayBefore: Temporal.PlainDate }>>()
        expect([row.nextMonth, row.moment, row.february, row.dayBefore].map(String)).toEqual(['2024-02-15', '2024-02-15T10:00:00', '2024-02-15', '2024-03-30'])
    })

    test('reject-gives-the-same-value-of-a-column-when-the-day-is-in-the-month', async () => {
        ctx.mockNext([{ nextMonth: '2024-04-04', lastDayOfJanuary: '2024-01-31 12:30:00' }])
        const rows = await ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({
                nextMonth: tColMatrixPlain.mDate.add({ months: 1 }, { overflow: 'reject' }),
                lastDayOfJanuary: tColMatrixPlain.mDatetime.with({ day: 31 }, { overflow: 'reject' }),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when day(m_date) > day(last_day(date_add(m_date, interval ? month))) then (select 1 union all select 1) else date_add(m_date, interval ? month) end as nextMonth, timestamp(date_add(date_add(makedate(year(m_datetime), 1), interval month(m_datetime) - 1 month), interval case when 31 > day(last_day(date_add(makedate(year(m_datetime), 1), interval month(m_datetime) - 1 month))) then (select 1 union all select 1) else 31 end - 1 day), maketime(hour(m_datetime), minute(m_datetime), second(m_datetime) + (microsecond(m_datetime)) * 0.000001)) as lastDayOfJanuary from col_matrix where id = ?"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1",
            "1",
            "1",
          ]
        `)
        expect(rows.map(row => [row.nextMonth, row.lastDayOfJanuary].map(String))).toEqual([['2024-04-04', '2024-01-31T12:30:00']])
    })

    test('reject-fails-the-query-when-the-day-is-not-in-the-month', async () => {
        // January 31st plus a month, and March 4th in February 30th: the database rejects them
        ctx.mockNext({ day: '2024-02-29' })
        const added = await rejectionOf(ctx.conn.selectFromNoTable()
            .select({ day: ctx.conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate').add({ months: 1 }, { overflow: 'reject' }) })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when day(?) > day(last_day(date_add(?, interval ? month))) then (select 1 union all select 1) else date_add(?, interval ? month) end as day"`)
        expect(added).toBe(ctx.realDbEnabled)
        ctx.mockNext([{ day: '2024-02-29' }])
        const changed = await rejectionOf(ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({ day: tColMatrixPlain.mDate.with({ day: 30, month: 2 }, { overflow: 'reject' }) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date_add(date_add(makedate(year(m_date), 1), interval 2 - 1 month), interval case when 30 > day(last_day(date_add(makedate(year(m_date), 1), interval 2 - 1 month))) then (select 1 union all select 1) else 30 end - 1 day) as day from col_matrix where id = ?"`)
        expect(changed).toBe(ctx.realDbEnabled)
    })

    test('reject-with-the-functions-of-the-library', async () => {
        // With the functions of the library installed the day of the value is checked in the month reached writing the
        // value once more: the values are the ones of Temporal for the values read, and a day the month hasn't fails, with
        // and without the functions (the mock answers no rows: there it is the SQL that is checked)
        const query = (conn: typeof ctx.conn) => conn.selectFrom(tRelease)
            .select({
                version: tRelease.version,
                releasedOn: tRelease.releasedOn,
                publishedAt: tRelease.publishedAt,
                nextMonth: tRelease.releasedOn.add({ months: 1 }, { overflow: 'reject' }),
                monthBefore: tRelease.publishedAt.subtract({ years: 1, months: 1 }, { overflow: 'reject' }),
            })
            .orderBy('version')
            .executeSelectMany()
        const lastOfJanuary = (conn: typeof ctx.conn, months: number) => conn.selectFromNoTable()
            .select({ reached: conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate').add({ months }, { overflow: 'reject' }) })
            .executeSelectMany()
        ctx.mockNext([])
        const withFunctions = await query(ctx.withLibraryFunctions())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, released_on as releasedOn, published_at as publishedAt, case when day(released_on) > day(last_day(date_add(released_on, interval ? month))) then (select 1 union all select 1) else date_add(released_on, interval ? month) end as nextMonth, case when day(published_at) > day(last_day(date_add(published_at, interval ? month))) then (select 1 union all select 1) else date_add(published_at, interval ? month) end as monthBefore from project_release order by version"`)
        ctx.mockNext([])
        const withoutFunctions = await query(ctx.conn)
        expect(withFunctions.length).toBe(ctx.realDbEnabled ? 3 : 0)
        type Row = (typeof withFunctions)[number]
        const read = (row: Row) => [row.version, row.nextMonth.toString(), row.monthBefore.toString()]
        const ofTemporal = (row: Row) => [row.version, row.releasedOn.add({ months: 1 }, { overflow: 'reject' }).toString(), row.publishedAt.subtract({ years: 1, months: 1 }, { overflow: 'reject' }).toString()]
        expect(withFunctions.map(read)).toEqual(withFunctions.map(ofTemporal))
        expect(withoutFunctions.map(read)).toEqual(withoutFunctions.map(ofTemporal))
        ctx.mockNext([{ reached: '2024-03-31' }])
        const twoMonths = await lastOfJanuary(ctx.withLibraryFunctions(), 2)
        expect(twoMonths.map(row => row.reached.toString())).toEqual(['2024-03-31'])
        ctx.mockNext([])
        const failsWithFunctions = await lastOfJanuary(ctx.withLibraryFunctions(), 1).then(() => false, () => true)
        ctx.mockNext([])
        const failsWithoutFunctions = await lastOfJanuary(ctx.conn, 1).then(() => false, () => true)
        expect([failsWithFunctions, failsWithoutFunctions]).toEqual([ctx.realDbEnabled, ctx.realDbEnabled])
    })
})
