// Months of a year (Temporal.PlainYearMonth) and days of a month (Temporal.PlainMonthDay), kept in a date: calendar_value
// row 1 is 2024-02 and 02-29 (from the date 2024-02-29), row 2 is 1999-12 and 12-31 (from 1999-12-31), and row 3 is kept
// out of the reference, on 2025-01-15 and in the year 2000 (from 2023-07-04).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tCalendarValue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('a-month-of-a-year-and-a-day-of-a-month-are-read-from-their-dates', async () => {
        // A date out of the reference gives its month of the year, or its day of the month
        ctx.mockNext([
            { id: 1, monthOf: '2024-02-01', dayOf: '1972-02-29' },
            { id: 2, monthOf: '1999-12-01', dayOf: '1972-12-31' },
            { id: 3, monthOf: '2025-01-15', dayOf: '2000-03-15' },
        ])
        const rows = await ctx.conn.selectFrom(tCalendarValue)
            .select({ id: tCalendarValue.id, monthOf: tCalendarValue.monthOf, dayOf: tCalendarValue.dayOf })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(month_of, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "monthOf", to_char(day_of, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "dayOf" from calendar_value order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; monthOf: Temporal.PlainYearMonth; dayOf: Temporal.PlainMonthDay }>>>()
        expect(rows.map(row => [row.id, row.monthOf.toString(), row.dayOf.toString()])).toEqual([
            [1, '2024-02', '02-29'],
            [2, '1999-12', '12-31'],
            [3, '2025-01', '03-15'],
        ])
        expect(rows[0]!.monthOf).toBeInstanceOf(Temporal.PlainYearMonth)
        expect(rows[0]!.dayOf).toBeInstanceOf(Temporal.PlainMonthDay)
    })

    test('a-month-of-a-year-and-a-day-of-a-month-are-written-in-the-date-of-their-reference', async () => {
        // The 1st of the month, and the year 1972: equal to the ones a date is taken to
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tCalendarValue)
                .values({ id: 4, monthOf: Temporal.PlainYearMonth.from('2030-07'), dayOf: Temporal.PlainMonthDay.from('07-04'), bornOn: Temporal.PlainDate.from('2030-07-04') })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into calendar_value (id, month_of, day_of, born_on) values (:0, to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))"`)
            expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
              [
                "4",
                "2030-07-01",
                "1972-07-04",
                "2030-07-04",
              ]
            `)
            ctx.mockNext([{ monthOf: '2030-07-01', dayOf: '1972-07-04', sameMonth: true, sameDay: true }])
            const rows = await ctx.conn.selectFrom(tCalendarValue)
                .where(tCalendarValue.id.equals(4))
                .select({
                    monthOf: tCalendarValue.monthOf,
                    dayOf: tCalendarValue.dayOf,
                    sameMonth: tCalendarValue.monthOf.equals(tCalendarValue.bornOn.toPlainYearMonth()),
                    sameDay: tCalendarValue.dayOf.equals(tCalendarValue.bornOn.toPlainMonthDay()),
                })
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(month_of, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "monthOf", to_char(day_of, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "dayOf", month_of = trunc(born_on, 'MM') as "sameMonth", day_of = to_date('1972' || to_char(born_on, 'MMDD'), 'YYYYMMDD') as "sameDay" from calendar_value where id = :0"`)
            expect(rows.map(row => [row.monthOf.toString(), row.dayOf.toString(), row.sameMonth, row.sameDay])).toEqual([['2030-07', '07-04', true, true]])
        })
    })

    test('the-parts-of-a-month-of-a-year-and-of-a-day-of-a-month', async () => {
        ctx.mockNext([
            { id: 1, year: 2024, month: 2, monthCode: 'M02', dayMonthCode: 'M02', day: 29 },
            { id: 2, year: 1999, month: 12, monthCode: 'M12', dayMonthCode: 'M12', day: 31 },
        ])
        const rows = await ctx.conn.selectFrom(tCalendarValue)
            .where(tCalendarValue.id.lessOrEqual(2))
            .select({
                id: tCalendarValue.id,
                year: tCalendarValue.monthOf.year(),
                month: tCalendarValue.monthOf.month(),
                monthCode: tCalendarValue.monthOf.monthCode(),
                dayMonthCode: tCalendarValue.dayOf.monthCode(),
                day: tCalendarValue.dayOf.day(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", extract(year from month_of) as "year", extract(month from month_of) as "month", to_char(month_of, '"M"MM') as "monthCode", to_char(day_of, '"M"MM') as "dayMonthCode", extract(day from day_of) as "day" from calendar_value where id <= :0 order by "id""`)
        assertType<Exact<typeof rows, Array<{ id: number; year: number; month: number; monthCode: string; dayMonthCode: string; day: number }>>>()
        expect(rows).toEqual([
            { id: 1, year: 2024, month: 2, monthCode: 'M02', dayMonthCode: 'M02', day: 29 },
            { id: 2, year: 1999, month: 12, monthCode: 'M12', dayMonthCode: 'M12', day: 31 },
        ])
    })

    test('a-date-is-taken-to-its-month-of-the-year-and-its-day-of-the-month', async () => {
        // Row 3 is kept out of the reference: it isn't equal to the ones of its date, as in Temporal
        ctx.mockNext([
            { id: 1, month: '2024-02-01', day: '1972-02-29', sameMonth: true, sameDay: true },
            { id: 2, month: '1999-12-01', day: '1972-12-31', sameMonth: true, sameDay: true },
            { id: 3, month: '2023-07-01', day: '1972-07-04', sameMonth: false, sameDay: false },
        ])
        const rows = await ctx.conn.selectFrom(tCalendarValue)
            .select({
                id: tCalendarValue.id,
                month: tCalendarValue.bornOn.toPlainYearMonth(),
                day: tCalendarValue.bornOn.toPlainMonthDay(),
                sameMonth: tCalendarValue.bornOn.toPlainYearMonth().equals(tCalendarValue.monthOf),
                sameDay: tCalendarValue.bornOn.toPlainMonthDay().equals(tCalendarValue.dayOf),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(trunc(born_on, 'MM'), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "month", to_char(to_date('1972' || to_char(born_on, 'MMDD'), 'YYYYMMDD'), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "day", trunc(born_on, 'MM') = month_of as "sameMonth", to_date('1972' || to_char(born_on, 'MMDD'), 'YYYYMMDD') = day_of as "sameDay" from calendar_value order by "id""`)
        assertType<Exact<typeof rows, Array<{ id: number; month: Temporal.PlainYearMonth; day: Temporal.PlainMonthDay; sameMonth: boolean; sameDay: boolean }>>>()
        expect(rows.map(row => [row.id, row.month.toString(), row.day.toString(), row.sameMonth, row.sameDay])).toEqual([
            [1, '2024-02', '02-29', true, true],
            [2, '1999-12', '12-31', true, true],
            [3, '2023-07', '07-04', false, false],
        ])
    })

    test('months-of-a-year-are-compared-and-ordered-days-of-a-month-only-compared', async () => {
        ctx.mockNext([{ id: 2 }, { id: 1 }])
        const before2025 = await ctx.conn.selectFrom(tCalendarValue)
            .where(tCalendarValue.monthOf.lessThan(Temporal.PlainYearMonth.from('2025-01')))
            .select({ id: tCalendarValue.id })
            .orderBy('id', 'desc')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from calendar_value where month_of < to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') order by "id" desc"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2025-01-01",
          ]
        `)
        expect(before2025.map(row => row.id)).toEqual([2, 1])
        ctx.mockNext([{ id: 1 }])
        const leapDay = await ctx.conn.selectFrom(tCalendarValue)
            .where(tCalendarValue.dayOf.equals(Temporal.PlainMonthDay.from('02-29')))
            .select({ id: tCalendarValue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from calendar_value where day_of = to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1972-02-29",
          ]
        `)
        expect(leapDay.map(row => row.id)).toEqual([1])
        ctx.mockNext([{ id: 3 }, { id: 1 }, { id: 2 }])
        const byMonth = await ctx.conn.selectFrom(tCalendarValue)
            .select({ id: tCalendarValue.id })
            .orderBy(tCalendarValue.monthOf, 'desc')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from calendar_value order by calendar_value.month_of desc"`)
        expect(byMonth.map(row => row.id)).toEqual([3, 1, 2])
    })
})
