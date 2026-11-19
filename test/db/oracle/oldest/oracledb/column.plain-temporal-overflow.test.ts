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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char((add_months(to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), :0) - greatest(0, extract(day from add_months(to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), :0)) - extract(day from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')))) + numtodsinterval((extract(day from to_date((trunc((extract(year from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1 + :4) / 12)) || '-' || (mod((extract(year from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1 + :4), 12) + 1) || '-' || (extract(day from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))), 'YYYY-MM-DD')) - extract(day from to_date(:6, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))), 'day'), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "nextMonth", to_char(cast(cast((add_months(trunc(to_timestamp(:8, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')), :7) - greatest(0, extract(day from add_months(trunc(to_timestamp(:8, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')), :7)) - extract(day from trunc(to_timestamp(:8, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'))))) as timestamp(9)) + (cast(to_timestamp(:8, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9)) - trunc(to_timestamp(:8, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) + numtodsinterval((extract(day from to_date((trunc((extract(year from to_timestamp(:9, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_timestamp(:10, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1 + :11) / 12)) || '-' || (mod((extract(year from to_timestamp(:9, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_timestamp(:10, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1 + :11), 12) + 1) || '-' || (extract(day from to_timestamp(:12, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'))), 'YYYY-MM-DD')) - extract(day from to_timestamp(:13, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'))), 'day') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "moment", to_char((add_months(date '0001-01-01', (extract(year from to_date(:14, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) * 12 + 2 - 1) + extract(day from to_date((extract(year from to_date(:14, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) || '-' || (2) || '-' || (extract(day from to_date(:15, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))), 'YYYY-MM-DD')) - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "february", to_char(to_date(:17, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') + :16, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "dayBefore" from dual"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1",
            "2024-01-15",
            "2024-01-15",
            "2024-01-15",
            "1",
            "2024-01-15",
            "2024-01-15",
            "1",
            "2024-01-15T10:00:00",
            "2024-01-15T10:00:00",
            "2024-01-15T10:00:00",
            "1",
            "2024-01-15T10:00:00",
            "2024-01-15T10:00:00",
            "2024-01-15",
            "2024-01-15",
            "-1",
            "2024-03-31",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char((add_months(m_date, :0) - greatest(0, extract(day from add_months(m_date, :0)) - extract(day from m_date))) + numtodsinterval((extract(day from to_date((trunc((extract(year from m_date) * 12 + extract(month from m_date) - 1 + :1) / 12)) || '-' || (mod((extract(year from m_date) * 12 + extract(month from m_date) - 1 + :1), 12) + 1) || '-' || (extract(day from m_date)), 'YYYY-MM-DD')) - extract(day from m_date)), 'day'), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "nextMonth", to_char(cast(cast((add_months(date '0001-01-01', (extract(year from m_datetime) - 1) * 12 + extract(month from m_datetime) - 1) + extract(day from to_date((extract(year from m_datetime)) || '-' || (extract(month from m_datetime)) || '-' || (31), 'YYYY-MM-DD')) - 1) as timestamp(9)) + numtodsinterval(extract(hour from m_datetime) * 3600 + extract(minute from m_datetime) * 60 + trunc(extract(second from m_datetime)) + to_number(to_char(m_datetime, 'FF9')) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "lastDayOfJanuary" from col_matrix where id = :2"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char((add_months(to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), :0) - greatest(0, extract(day from add_months(to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), :0)) - extract(day from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')))) + numtodsinterval((extract(day from to_date((trunc((extract(year from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1 + :4) / 12)) || '-' || (mod((extract(year from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1 + :4), 12) + 1) || '-' || (extract(day from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))), 'YYYY-MM-DD')) - extract(day from to_date(:6, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))), 'day'), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "day" from dual"`)
        expect(added).toBe(ctx.realDbEnabled)
        ctx.mockNext([{ day: '2024-02-29' }])
        const changed = await rejectionOf(ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({ day: tColMatrixPlain.mDate.with({ day: 30, month: 2 }, { overflow: 'reject' }) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char((add_months(date '0001-01-01', (extract(year from m_date) - 1) * 12 + 2 - 1) + extract(day from to_date((extract(year from m_date)) || '-' || (2) || '-' || (30), 'YYYY-MM-DD')) - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "day" from col_matrix where id = :0"`)
        expect(changed).toBe(ctx.realDbEnabled)
    })
})
