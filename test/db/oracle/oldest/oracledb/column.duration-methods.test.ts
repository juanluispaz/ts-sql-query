// The fields, the sign, the negation and the absolute value of a duration, as Temporal reads the duration kept. Every
// expected value is the one Temporal gives. duration_value: span is 1 3 days 04:05:06.789, 2 -1 day -2 hours, 3 01:30
// (an interval of days to seconds); span_text is the ISO 8601 text P1Y2M3DT4H5M6.789S, -PT26H and PT90M, whose fields
// are the ones written.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tDurationValue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('the-fields-of-a-duration-kept-as-text', async () => {
        ctx.mockNext([
            { id: 1, years: 1, months: 2, weeks: 0, days: 3, hours: 4, minutes: 5, seconds: 6, milliseconds: 789, microseconds: 0, nanoseconds: 0 },
            { id: 2, years: 0, months: 0, weeks: 0, days: 0, hours: -26, minutes: 0, seconds: 0, milliseconds: 0, microseconds: 0, nanoseconds: 0 },
            { id: 3, years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 90, seconds: 0, milliseconds: 0, microseconds: 0, nanoseconds: 0 },
        ])
        const rows = await ctx.conn.selectFrom(tDurationValue)
            .select({
                id: tDurationValue.id,
                years: tDurationValue.spanText.years(),
                months: tDurationValue.spanText.months(),
                weeks: tDurationValue.spanText.weeks(),
                days: tDurationValue.spanText.days(),
                hours: tDurationValue.spanText.hours(),
                minutes: tDurationValue.spanText.minutes(),
                seconds: tDurationValue.spanText.seconds(),
                milliseconds: tDurationValue.spanText.milliseconds(),
                microseconds: tDurationValue.spanText.microseconds(),
                nanoseconds: tDurationValue.spanText.nanoseconds(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", tsq_duration_part(span_text, 'years') as "years", tsq_duration_part(span_text, 'months') as "months", tsq_duration_part(span_text, 'weeks') as "weeks", tsq_duration_part(span_text, 'days') as "days", tsq_duration_part(span_text, 'hours') as "hours", tsq_duration_part(span_text, 'minutes') as "minutes", tsq_duration_part(span_text, 'seconds') as "seconds", (trunc(tsq_duration_part(span_text, 'N') / 1000000)) as "milliseconds", (mod(trunc(tsq_duration_part(span_text, 'N') / 1000), 1000)) as "microseconds", (mod(tsq_duration_part(span_text, 'N'), 1000)) as "nanoseconds" from duration_value order by "id""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<(typeof rows)[number]['years'], number | undefined>>()
        expect(rows.map(row => [row.id, row.years, row.months, row.weeks, row.days, row.hours, row.minutes, row.seconds, row.milliseconds, row.microseconds, row.nanoseconds])).toEqual([
            [1, 1, 2, 0, 3, 4, 5, 6, 789, 0, 0],
            [2, 0, 0, 0, 0, -26, 0, 0, 0, 0, 0],
            [3, 0, 0, 0, 0, 0, 90, 0, 0, 0, 0],
        ])
    })

    test('the-fields-of-a-duration-kept-by-the-database', async () => {
        ctx.mockNext([
            { id: 1, days: 3, hours: 4, minutes: 5, seconds: 6, milliseconds: 789 },
            { id: 2, days: -1, hours: -2, minutes: 0, seconds: 0, milliseconds: 0 },
            { id: 3, days: 0, hours: 1, minutes: 30, seconds: 0, milliseconds: 0 },
        ])
        const rows = await ctx.conn.selectFrom(tDurationValue)
            .select({
                id: tDurationValue.id,
                days: tDurationValue.span.days(),
                hours: tDurationValue.span.hours(),
                minutes: tDurationValue.span.minutes(),
                seconds: tDurationValue.span.seconds(),
                milliseconds: tDurationValue.span.milliseconds(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", extract(day from span) as "days", extract(hour from span) as "hours", extract(minute from span) as "minutes", trunc(extract(second from span)) as "seconds", mod(trunc(extract(second from span) * 1000), 1000) as "milliseconds" from duration_value order by "id""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; days: number; hours: number; minutes: number; seconds: number; milliseconds: number }>>>()
        expect(rows.map(row => [row.id, row.days, row.hours, row.minutes, row.seconds, row.milliseconds])).toEqual([
            [1, 3, 4, 5, 6, 789],
            [2, -1, -2, 0, 0, 0],
            [3, 0, 1, 30, 0, 0],
        ])
    })

    test('the-sign-negated-and-absolute-value', async () => {
        ctx.mockNext([
            { id: 1, sign: 1, textSign: 1, negated: '-3 days -04:05:06.789', textNegated: '-P1Y2M3DT4H5M6.789S', abs: '3 days 04:05:06.789', textAbs: 'P1Y2M3DT4H5M6.789S' },
            { id: 2, sign: -1, textSign: -1, negated: '1 day 02:00:00', textNegated: 'PT26H', abs: '1 day 02:00:00', textAbs: 'PT26H' },
            { id: 3, sign: 1, textSign: 1, negated: '-01:30:00', textNegated: '-PT90M', abs: '01:30:00', textAbs: 'PT90M' },
        ])
        const rows = await ctx.conn.selectFrom(tDurationValue)
            .select({
                id: tDurationValue.id,
                sign: tDurationValue.span.sign(),
                textSign: tDurationValue.spanText.sign(),
                negated: tDurationValue.span.negated(),
                textNegated: tDurationValue.spanText.negated(),
                abs: tDurationValue.span.abs(),
                textAbs: tDurationValue.spanText.abs(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", sign(extract(day from span) * 86400 + extract(hour from span) * 3600 + extract(minute from span) * 60 + extract(second from span)) as "sign", tsq_duration_part(span_text, 'sign') as "textSign", (span * -1) as "negated", case when substr(span_text, 1, 1) = '-' then substr(span_text, 2) when tsq_duration_part(span_text, 'sign') = 0 then span_text when substr(span_text, 1, 1) = '+' then '-' || substr(span_text, 2) else '-' || span_text end as "textNegated", case when span < numtodsinterval(0, 'second') then span * -1 else span end as "abs", case when substr(span_text, 1, 1) in ('-', '+') then substr(span_text, 2) else span_text end as "textAbs" from duration_value order by "id""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<(typeof rows)[number]['negated'], Temporal.Duration>>()
        expect(rows.map(row => [row.id, row.sign, row.textSign, row.negated.toString(), row.textNegated?.toString(), row.abs.toString(), row.textAbs?.toString()])).toEqual([
            [1, 1, 1, '-P3DT4H5M6.789S', '-P1Y2M3DT4H5M6.789S', 'P3DT4H5M6.789S', 'P1Y2M3DT4H5M6.789S'],
            [2, -1, -1, 'P1DT2H', 'PT26H', 'P1DT2H', 'PT26H'],
            [3, 1, 1, '-PT1H30M', '-PT90M', 'PT1H30M', 'PT90M'],
        ])
    })

    test('the-fields-of-a-difference', async () => {
        // 2024-01-31 until 2025-03-30 in years is P1Y1M30D; since gives it negated
        ctx.mockNext({ years: 1, months: 1, days: 30, sign: -1 })
        const january31 = ctx.conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate')
        const row = await ctx.conn.selectFromNoTable()
            .select({
                years: january31.until(Temporal.PlainDate.from('2025-03-30'), { largestUnit: 'year' }).years(),
                months: january31.until(Temporal.PlainDate.from('2025-03-30'), { largestUnit: 'year' }).months(),
                days: january31.until(Temporal.PlainDate.from('2025-03-30'), { largestUnit: 'year' }).days(),
                sign: january31.since(Temporal.PlainDate.from('2025-03-30')).sign(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select tsq_duration_part(tsq_duration_text(trunc(trunc(((extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 - extract(day from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) / 32) / 12), (mod(trunc(((extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 - extract(day from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) / 32), 12)), 0, (to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') - (add_months(to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), trunc(((extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 - extract(day from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) / 32)) - greatest(0, extract(day from add_months(to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), trunc(((extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 - extract(day from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) / 32))) - extract(day from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))))), 0, 'hour'), 'years') as "years", tsq_duration_part(tsq_duration_text(trunc(trunc(((extract(year from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 - extract(day from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) / 32) / 12), (mod(trunc(((extract(year from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 - extract(day from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) / 32), 12)), 0, (to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') - (add_months(to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), trunc(((extract(year from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 - extract(day from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) / 32)) - greatest(0, extract(day from add_months(to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), trunc(((extract(year from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 - extract(day from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) / 32))) - extract(day from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))))), 0, 'hour'), 'months') as "months", tsq_duration_part(tsq_duration_text(trunc(trunc(((extract(year from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 - extract(day from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) / 32) / 12), (mod(trunc(((extract(year from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 - extract(day from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) / 32), 12)), 0, (to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') - (add_months(to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), trunc(((extract(year from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 - extract(day from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) / 32)) - greatest(0, extract(day from add_months(to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), trunc(((extract(year from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 - extract(day from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) / 32))) - extract(day from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))))), 0, 'hour'), 'days') as "days", tsq_duration_part(tsq_duration_text(0, 0, 0, -(to_date(:6, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') - to_date(:7, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')), 0, 'hour'), 'sign') as "sign" from dual"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2025-03-30",
            "2024-01-31",
            "2025-03-30",
            "2024-01-31",
            "2025-03-30",
            "2024-01-31",
            "2025-03-30",
            "2024-01-31",
          ]
        `)
        expect([row.years, row.months, row.days, row.sign]).toEqual([1, 1, 30, -1])
    })
})
