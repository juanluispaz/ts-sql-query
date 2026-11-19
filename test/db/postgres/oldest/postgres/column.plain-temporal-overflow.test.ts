// The overflow option of Temporal's add, subtract and with: 'reject' rejects, as an error of the query, a day that the
// month reached hasn't, where 'constrain' (the default) takes it to the last day of the month. col_matrix row 1 has the
// date 2024-03-04 and the date and time 2024-01-14 12:30:00.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'
import { tColMatrixPlain } from '../../domain/connection.js'
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast($1 + $2 as date) + (extract(day from make_date(((cast(extract(year from $3) as integer) * 12 + cast(extract(month from $4) as integer) - 1 + $5) / 12), (cast(extract(year from $3) as integer) * 12 + cast(extract(month from $4) as integer) - 1 + $5) % 12 + 1, cast(extract(day from $6) as integer)))::integer - cast(extract(day from $7) as integer)) as "nextMonth", $8 + $9 + make_interval(days => (extract(day from make_date(((cast(extract(year from $10) as integer) * 12 + cast(extract(month from $11) as integer) - 1 + $12) / 12), (cast(extract(year from $10) as integer) * 12 + cast(extract(month from $11) as integer) - 1 + $12) % 12 + 1, cast(extract(day from $13) as integer)))::integer - cast(extract(day from $14) as integer))) as moment, make_date(cast(extract(year from $15) as integer), 2, extract(day from make_date(cast(extract(year from $15) as integer), 2, cast(extract(day from $16) as integer)))::integer) as february, $17 + $18 as "dayBefore""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-15",
            "P1M",
            "2024-01-15",
            "2024-01-15",
            "1",
            "2024-01-15",
            "2024-01-15",
            "2024-01-15T10:00:00",
            "P1M",
            "2024-01-15T10:00:00",
            "2024-01-15T10:00:00",
            "1",
            "2024-01-15T10:00:00",
            "2024-01-15T10:00:00",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(m_date + $1 as date) + (extract(day from make_date(((cast(extract(year from m_date) as integer) * 12 + cast(extract(month from m_date) as integer) - 1 + $2) / 12), (cast(extract(year from m_date) as integer) * 12 + cast(extract(month from m_date) as integer) - 1 + $2) % 12 + 1, cast(extract(day from m_date) as integer)))::integer - cast(extract(day from m_date) as integer)) as "nextMonth", make_timestamp(cast(extract(year from m_datetime) as integer), cast(extract(month from m_datetime) as integer), extract(day from make_date(cast(extract(year from m_datetime) as integer), cast(extract(month from m_datetime) as integer), 31))::integer, cast(extract(hour from m_datetime) as integer), cast(extract(minute from m_datetime) as integer), cast(trunc(extract(second from m_datetime))::integer as integer) + (trunc(extract(microseconds from m_datetime))::integer % 1000000 * 1000) / 1000000000.0) as "lastDayOfJanuary" from col_matrix where id = $3"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "P1M",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast($1 + $2 as date) + (extract(day from make_date(((cast(extract(year from $3) as integer) * 12 + cast(extract(month from $4) as integer) - 1 + $5) / 12), (cast(extract(year from $3) as integer) * 12 + cast(extract(month from $4) as integer) - 1 + $5) % 12 + 1, cast(extract(day from $6) as integer)))::integer - cast(extract(day from $7) as integer)) as day"`)
        expect(added).toBe(ctx.realDbEnabled)
        ctx.mockNext([{ day: '2024-02-29' }])
        const changed = await rejectionOf(ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({ day: tColMatrixPlain.mDate.with({ day: 30, month: 2 }, { overflow: 'reject' }) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select make_date(cast(extract(year from m_date) as integer), 2, extract(day from make_date(cast(extract(year from m_date) as integer), 2, 30))::integer) as day from col_matrix where id = $1"`)
        expect(changed).toBe(ctx.realDbEnabled)
    })
})
