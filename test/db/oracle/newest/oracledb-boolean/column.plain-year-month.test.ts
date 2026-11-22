// Months of a year (Temporal.PlainYearMonth) and days of a month (Temporal.PlainMonthDay), kept in a date: calendar_value
// row 1 is 2024-02 and 02-29 (from the date 2024-02-29), row 2 is 1999-12 and 12-31 (from 1999-12-31), and row 3 is kept
// out of the reference, on 2025-01-15 and in the year 2000 (from 2023-07-04).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tCalendarValue, tDurationValue, tColMatrixPlain } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'

/** Whether the query fails with an error of the database */
async function failureOf(query: Promise<unknown>): Promise<boolean> {
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

    test('the-years-and-months-from-the-month-of-a-date-to-another-with-and-without-the-functions-of-the-library', async () => {
        // The month of the year of a date counts from the year and the month of that date: the values are the ones of
        // Temporal for the dates read, with and without the functions of the library (the mock answers no rows: there
        // it is the SQL that is checked)
        const june2025 = Temporal.PlainYearMonth.from('2025-06')
        const query = (conn: typeof ctx.conn) => conn.selectFrom(tCalendarValue)
            .select({
                id: tCalendarValue.id,
                bornOn: tCalendarValue.bornOn,
                untilJune: tCalendarValue.bornOn.toPlainYearMonth().until(june2025),
                inMonths: tCalendarValue.bornOn.toPlainYearMonth().until(june2025, { largestUnit: 'month' }),
                inYears: tCalendarValue.bornOn.toPlainYearMonth().until(june2025, { smallestUnit: 'year', roundingMode: 'halfExpand' }),
                sinceInYears: tCalendarValue.bornOn.toPlainYearMonth().since(june2025, { smallestUnit: 'year', roundingMode: 'halfExpand' }),
            })
            .orderBy('id')
            .executeSelectMany()
        ctx.mockNext([])
        const withFunctions = await query(ctx.withLibraryFunctions())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", tsq_text_of_date(born_on) as "bornOn", tsq_duration_text(0, (extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from born_on) * 12 + extract(month from born_on))), 0, 0, 0, 0, 0, 'year') as "untilJune", tsq_duration_text(0, (extract(year from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from born_on) * 12 + extract(month from born_on))), 0, 0, 0, 0, 0, 'month') as "inMonths", tsq_duration_round_of(trunc(born_on, 'MM'), trunc(to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'MM'), 'year', 'year', 1, 'halfExpand', 1) as "inYears", tsq_duration_round_of(trunc(born_on, 'MM'), trunc(to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'MM'), 'year', 'year', 1, 'halfExpand', -1) as "sinceInYears" from calendar_value order by "id""`)
        ctx.mockNext([])
        const withoutFunctions = await query(ctx.conn)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(born_on, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "bornOn", tsq_duration_text(0, (extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from born_on) * 12 + extract(month from born_on))), 0, 0, 0, 0, 0, 'year') as "untilJune", tsq_duration_text(0, (extract(year from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from born_on) * 12 + extract(month from born_on))), 0, 0, 0, 0, 0, 'month') as "inMonths", tsq_duration_round(extract(year from born_on), extract(month from born_on), 1, 0, :2, :3, 1, 0, 'year', 'year', 1, 'halfExpand', 1) as "inYears", tsq_duration_round(extract(year from born_on), extract(month from born_on), 1, 0, :4, :5, 1, 0, 'year', 'year', 1, 'halfExpand', -1) as "sinceInYears" from calendar_value order by "id""`)
        expect(withFunctions.length).toBe(ctx.realDbEnabled ? 3 : 0)
        type Row = (typeof withFunctions)[number]
        const months = (duration: Temporal.Duration) => duration.years * 12 + duration.months
        const read = (row: Row) => [row.id, months(row.untilJune), months(row.inMonths), months(row.inYears), months(row.sinceInYears)]
        const ofTemporal = (row: Row) => {
            const month = row.bornOn.toPlainYearMonth()
            return [row.id, months(month.until(june2025)), months(month.until(june2025, { largestUnit: 'month' })), months(month.until(june2025, { smallestUnit: 'year', roundingMode: 'halfExpand' })), months(month.since(june2025, { smallestUnit: 'year', roundingMode: 'halfExpand' }))]
        }
        expect(withFunctions.map(read)).toEqual(withFunctions.map(ofTemporal))
        expect(withoutFunctions.map(read)).toEqual(withoutFunctions.map(ofTemporal))
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

    test('the-facts-of-the-calendar-of-a-month-of-a-year-and-of-a-date', async () => {
        ctx.mockNext([
            { id: 1, daysInMonth: 29, daysInYear: 366, monthsInYear: 12, inLeapYear: true, dateDaysInMonth: 29, dateInLeapYear: true },
            { id: 2, daysInMonth: 31, daysInYear: 365, monthsInYear: 12, inLeapYear: false, dateDaysInMonth: 31, dateInLeapYear: false },
        ])
        const rows = await ctx.conn.selectFrom(tCalendarValue)
            .where(tCalendarValue.id.lessOrEqual(2))
            .select({
                id: tCalendarValue.id,
                daysInMonth: tCalendarValue.monthOf.daysInMonth(),
                daysInYear: tCalendarValue.monthOf.daysInYear(),
                monthsInYear: tCalendarValue.monthOf.monthsInYear(),
                inLeapYear: tCalendarValue.monthOf.inLeapYear(),
                dateDaysInMonth: tCalendarValue.bornOn.daysInMonth(),
                dateInLeapYear: tCalendarValue.bornOn.inLeapYear(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", extract(day from last_day(month_of)) as "daysInMonth", 337 + extract(day from last_day((add_months(date '0001-01-01', (extract(year from month_of) - 1) * 12 + 2 - 1) + 1 - 1))) as "daysInYear", case when month_of is not null then 12 end as "monthsInYear", extract(day from last_day((add_months(date '0001-01-01', (extract(year from month_of) - 1) * 12 + 2 - 1) + 1 - 1))) = 29 as "inLeapYear", extract(day from last_day(born_on)) as "dateDaysInMonth", extract(day from last_day((add_months(date '0001-01-01', (extract(year from born_on) - 1) * 12 + 2 - 1) + 1 - 1))) = 29 as "dateInLeapYear" from calendar_value where id <= :0 order by "id""`)
        assertType<Exact<typeof rows, Array<{ id: number; daysInMonth: number; daysInYear: number; monthsInYear: number; inLeapYear: boolean; dateDaysInMonth: number; dateInLeapYear: boolean }>>>()
        expect(rows).toEqual([
            { id: 1, daysInMonth: 29, daysInYear: 366, monthsInYear: 12, inLeapYear: true, dateDaysInMonth: 29, dateInLeapYear: true },
            { id: 2, daysInMonth: 31, daysInYear: 365, monthsInYear: 12, inLeapYear: false, dateDaysInMonth: 31, dateInLeapYear: false },
        ])
    })

    test('a-month-of-a-year-plus-years-and-months-and-with-another-year-or-month', async () => {
        // A month out of its range is taken to the nearest one (13 is December), as in Temporal
        ctx.mockNext([
            { id: 1, plus: '2025-01-01', minus: '2023-01-01', lastMonth: '2024-12-01', inYear2000: '2000-02-01' },
            { id: 2, plus: '2000-11-01', minus: '1998-11-01', lastMonth: '1999-12-01', inYear2000: '2000-12-01' },
        ])
        const rows = await ctx.conn.selectFrom(tCalendarValue)
            .where(tCalendarValue.id.lessOrEqual(2))
            .select({
                id: tCalendarValue.id,
                plus: tCalendarValue.monthOf.add({ months: 11 }),
                minus: tCalendarValue.monthOf.subtract(Temporal.Duration.from({ years: 1, months: 1 })),
                lastMonth: tCalendarValue.monthOf.with({ month: 13 }),
                inYear2000: tCalendarValue.monthOf.with({ year: 2000 }),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char((add_months(month_of, :0) - greatest(0, extract(day from add_months(month_of, :0)) - extract(day from month_of))), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "plus", to_char((add_months(month_of, :1) - greatest(0, extract(day from add_months(month_of, :1)) - extract(day from month_of))), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "minus", to_char((add_months(date '0001-01-01', (extract(year from month_of) - 1) * 12 + 12 - 1) + 1 - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "lastMonth", to_char((add_months(date '0001-01-01', (2000 - 1) * 12 + extract(month from month_of) - 1) + 1 - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "inYear2000" from calendar_value where id <= :2 order by "id""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "11",
            "-13",
            "2",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; plus: Temporal.PlainYearMonth; minus: Temporal.PlainYearMonth; lastMonth: Temporal.PlainYearMonth; inYear2000: Temporal.PlainYearMonth }>>>()
        expect(rows.map(row => [row.id, row.plus.toString(), row.minus.toString(), row.lastMonth.toString(), row.inYear2000.toString()])).toEqual([
            [1, '2025-01', '2023-01', '2024-12', '2000-02'],
            [2, '2000-11', '1998-11', '1999-12', '2000-12'],
        ])
    })

    test('a-month-of-a-year-plus-and-minus-a-duration-of-the-query', async () => {
        // duration_value row 1 keeps P1Y2M in span_calendar, row 2 none: 2024-02 plus P1Y2M is 2025-04, as in Temporal
        ctx.mockNext([
            { id: 1, plus: '2025-04-01', minus: '2022-12-01' },
            { id: 2, plus: null, minus: null },
        ])
        const rows = await ctx.conn.selectFrom(tCalendarValue)
            .join(tDurationValue).on(tDurationValue.id.equals(tCalendarValue.id))
            .where(tCalendarValue.id.lessOrEqual(2))
            .select({
                id: tCalendarValue.id,
                plus: tCalendarValue.monthOf.add(tDurationValue.spanCalendar),
                minus: tCalendarValue.monthOf.subtract(tDurationValue.spanCalendar),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select calendar_value.id as "id", to_char(add_months(calendar_value.month_of, cast(extract(year from duration_value.span_calendar) * 12 + extract(month from duration_value.span_calendar) as integer)), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "plus", to_char(add_months(calendar_value.month_of, -cast(extract(year from duration_value.span_calendar) * 12 + extract(month from duration_value.span_calendar) as integer)), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "minus" from calendar_value join duration_value on duration_value.id = calendar_value.id where calendar_value.id <= :0 order by "id""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; plus?: Temporal.PlainYearMonth; minus?: Temporal.PlainYearMonth }>>>()
        const february = Temporal.PlainYearMonth.from('2024-02')
        expect(rows.map(row => [row.id, row.plus?.toString(), row.minus?.toString()])).toEqual([
            [1, february.add('P1Y2M').toString(), february.subtract('P1Y2M').toString()],
            [2, undefined, undefined],
        ])
    })

    test('a-duration-of-the-query-with-days-makes-a-month-of-a-year-fail', async () => {
        // As Temporal throws: duration_value row 1 keeps 3 days and a time in span and in span_text; row 3 keeps PT1H30M
        // in span and PT90M in span_text
        ctx.mockNext([{ plus: '2024-02-01' }])
        const withDays = await failureOf(ctx.conn.selectFrom(tCalendarValue)
            .join(tDurationValue).on(tDurationValue.id.equals(1))
            .where(tCalendarValue.id.equals(1))
            .select({ plus: tCalendarValue.monthOf.add(tDurationValue.span) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(calendar_value.month_of + numtodsinterval((extract(day from to_date((2001) || '-' || (2) || '-' || (case when duration_value.span <> interval '0' second then 29 else 28 end), 'YYYY-MM-DD')) - 28), 'day'), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "plus" from calendar_value join duration_value on duration_value.id = :0 where calendar_value.id = :1"`)
        expect(withDays).toBe(ctx.realDbEnabled)
        ctx.mockNext([{ minus: '2024-02-01' }])
        const withTime = await failureOf(ctx.conn.selectFrom(tCalendarValue)
            .join(tDurationValue).on(tDurationValue.id.equals(3))
            .where(tCalendarValue.id.equals(1))
            .select({ minus: tCalendarValue.monthOf.subtract(tDurationValue.spanText) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(add_months(calendar_value.month_of, -tsq_duration_part(duration_value.span_text, 'M')) + numtodsinterval((extract(day from to_date((2001) || '-' || (2) || '-' || (case when tsq_duration_part(duration_value.span_text, 'D') <> 0 or tsq_duration_part(duration_value.span_text, 'S') <> 0 or tsq_duration_part(duration_value.span_text, 'N') <> 0 then 29 else 28 end), 'YYYY-MM-DD')) - 28), 'day'), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "minus" from calendar_value join duration_value on duration_value.id = :0 where calendar_value.id = :1"`)
        expect(withTime).toBe(ctx.realDbEnabled)
    })

    test('a-month-of-a-year-plus-and-minus-months-of-the-query', async () => {
        // The int 42 of col_matrix row 1 as months, and one year more
        const february = Temporal.PlainYearMonth.from('2024-02')
        ctx.mockNext([{ plus: february.add({ months: 42 }).toPlainDate({ day: 1 }).toString(), minus: february.subtract({ years: 1, months: 42 }).toPlainDate({ day: 1 }).toString() }])
        const rows = await ctx.conn.selectFrom(tCalendarValue)
            .join(tColMatrixPlain).on(tColMatrixPlain.id.equals(1))
            .where(tCalendarValue.id.equals(1))
            .select({
                plus: tCalendarValue.monthOf.add({ months: tColMatrixPlain.mInt }),
                minus: tCalendarValue.monthOf.subtract({ years: 1, months: tColMatrixPlain.mInt }),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(add_months(calendar_value.month_of, col_matrix.m_int), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "plus", to_char(add_months(calendar_value.month_of, -(col_matrix.m_int + 12)) + numtodsinterval((extract(day from to_date((2001) || '-' || (2) || '-' || (case when col_matrix.m_int < 0 then 29 else 28 end), 'YYYY-MM-DD')) - 28), 'day'), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "minus" from calendar_value join col_matrix on col_matrix.id = :0 where calendar_value.id = :1"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1",
            "1",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ plus: Temporal.PlainYearMonth; minus: Temporal.PlainYearMonth }>>>()
        expect(rows.map(row => [row.plus.toString(), row.minus.toString()])).toEqual([[february.add({ months: 42 }).toString(), february.subtract({ years: 1, months: 42 }).toString()]])
    })

    test('the-years-and-months-from-a-month-of-a-year-to-another', async () => {
        // In years and months by default; rounded to the year, by the days of the months, as Temporal (since rounds
        // with the mode inverted, negated). PostgreSQL's interval gives the months as years and months: the months
        // are compared
        ctx.mockNext([
            { id: 1, until: 'P2Y6M', inMonths: 'P30M', sinceInYears: '-P2Y', byFive: 'P30M' },
            { id: 2, until: 'P26Y8M', inMonths: 'P320M', sinceInYears: '-P27Y', byFive: 'P320M' },
        ])
        const august2026 = Temporal.PlainYearMonth.from('2026-08')
        const rows = await ctx.conn.selectFrom(tCalendarValue)
            .where(tCalendarValue.id.lessOrEqual(2))
            .select({
                id: tCalendarValue.id,
                until: tCalendarValue.monthOf.until(august2026),
                inMonths: tCalendarValue.monthOf.until(august2026, { largestUnit: 'month' }),
                sinceInYears: tCalendarValue.monthOf.since(august2026, { smallestUnit: 'year', roundingMode: 'halfExpand' }),
                byFive: tCalendarValue.monthOf.until(august2026, { largestUnit: 'month', roundingIncrement: 5 }),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", tsq_duration_text(0, (extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from month_of) * 12 + extract(month from month_of))), 0, 0, 0, 0, 0, 'year') as "until", tsq_duration_text(0, (extract(year from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from month_of) * 12 + extract(month from month_of))), 0, 0, 0, 0, 0, 'month') as "inMonths", tsq_duration_round(extract(year from month_of), extract(month from month_of), 1, 0, :2, :3, 1, 0, 'year', 'year', 1, 'halfExpand', -1) as "sinceInYears", tsq_duration_text(0, (trunc((extract(year from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from month_of) * 12 + extract(month from month_of))) / 5) * 5), 0, 0, 0, 0, 0, 'month') as "byFive" from calendar_value where id <= :5 order by "id""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2026-08-01",
            "2026-08-01",
            "2026",
            "8",
            "2026-08-01",
            "2",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; until: Temporal.Duration; inMonths: Temporal.Duration; sinceInYears: Temporal.Duration; byFive: Temporal.Duration }>>>()
        const months = (duration: Temporal.Duration) => duration.years * 12 + duration.months
        expect(rows.map(row => [row.id, months(row.until), months(row.inMonths), months(row.sinceInYears), months(row.byFive)])).toEqual([
            [1, 30, 30, -24, 30],
            [2, 320, 320, -324, 320],
        ])
    })

    test('a-month-of-a-year-and-a-day-of-a-month-taken-to-a-date-or-to-other-fields', async () => {
        // The day is taken to the last one of the month, February 29 to the 28th in a year without it, as Temporal
        ctx.mockNext([
            { id: 1, lastDay: '2024-02-29', in2023: '2023-02-28', inApril: '1972-04-29', day30: '1972-02-29' },
            { id: 2, lastDay: '1999-12-31', in2023: '2023-12-31', inApril: '1972-04-30', day30: '1972-12-30' },
        ])
        const rows = await ctx.conn.selectFrom(tCalendarValue)
            .where(tCalendarValue.id.lessOrEqual(2))
            .select({
                id: tCalendarValue.id,
                lastDay: tCalendarValue.monthOf.toPlainDate({ day: 31 }),
                in2023: tCalendarValue.dayOf.toPlainDate({ year: 2023 }),
                inApril: tCalendarValue.dayOf.with({ month: 4 }),
                day30: tCalendarValue.dayOf.with({ day: 30 }),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char((add_months(date '0001-01-01', (extract(year from month_of) - 1) * 12 + extract(month from month_of) - 1) + least(31, extract(day from last_day((add_months(date '0001-01-01', (extract(year from month_of) - 1) * 12 + extract(month from month_of) - 1) + 1 - 1)))) - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "lastDay", to_char((add_months(date '0001-01-01', (2023 - 1) * 12 + extract(month from day_of) - 1) + least(extract(day from day_of), extract(day from last_day((add_months(date '0001-01-01', (2023 - 1) * 12 + extract(month from day_of) - 1) + 1 - 1)))) - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "in2023", to_char((add_months(date '0001-01-01', (1972 - 1) * 12 + 4 - 1) + least(extract(day from day_of), extract(day from last_day((add_months(date '0001-01-01', (1972 - 1) * 12 + 4 - 1) + 1 - 1)))) - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "inApril", to_char((add_months(date '0001-01-01', (1972 - 1) * 12 + extract(month from day_of) - 1) + least(30, extract(day from last_day((add_months(date '0001-01-01', (1972 - 1) * 12 + extract(month from day_of) - 1) + 1 - 1)))) - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "day30" from calendar_value where id <= :0 order by "id""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; lastDay: Temporal.PlainDate; in2023: Temporal.PlainDate; inApril: Temporal.PlainMonthDay; day30: Temporal.PlainMonthDay }>>>()
        expect(rows.map(row => [row.id, row.lastDay.toString(), row.in2023.toString(), row.inApril.toString(), row.day30.toString()])).toEqual([
            [1, '2024-02-29', '2023-02-28', '04-29', '02-29'],
            [2, '1999-12-31', '2023-12-31', '04-30', '12-30'],
        ])
    })
})
