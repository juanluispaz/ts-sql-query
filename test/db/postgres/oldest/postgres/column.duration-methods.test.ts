// The fields, the sign, the negation and the absolute value of a duration, as Temporal reads the duration kept. Every
// expected value is the one Temporal gives. duration_value: span is 1 3 days 04:05:06.789, 2 -1 day -2 hours, 3 01:30
// (an interval: its time is read in hours); span_text is the ISO 8601 text P1Y2M3DT4H5M6.789S, -PT26H and PT90M, whose
// fields are the ones written.

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_part(span_text, 'years') as years, tsq_duration_part(span_text, 'months') as months, tsq_duration_part(span_text, 'weeks') as weeks, tsq_duration_part(span_text, 'days') as days, tsq_duration_part(span_text, 'hours') as hours, tsq_duration_part(span_text, 'minutes') as minutes, tsq_duration_part(span_text, 'seconds') as seconds, ((tsq_duration_part(span_text, 'N') / 1000000)) as milliseconds, ((tsq_duration_part(span_text, 'N') / 1000) % 1000) as microseconds, (tsq_duration_part(span_text, 'N') % 1000) as nanoseconds from duration_value order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(extract(day from span) as integer) as days, cast(extract(hour from span) as integer) as hours, cast(extract(minute from span) as integer) as minutes, cast(trunc(extract(second from span)) as integer) as seconds, (cast(trunc(extract(microseconds from span)) as integer) / 1000 % 1000) as milliseconds from duration_value order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(sign(extract(epoch from span)) as integer) as sign, tsq_duration_part(span_text, 'sign') as "textSign", -span as negated, case when substr(span_text, 1, 1) = '-' then substr(span_text, 2) when tsq_duration_part(span_text, 'sign') = 0 then span_text when substr(span_text, 1, 1) = '+' then '-' || substr(span_text, 2) else '-' || span_text end as "textNegated", case when span < interval '0' then -span else span end as abs, case when substr(span_text, 1, 1) in ('-', '+') then substr(span_text, 2) else span_text end as "textAbs" from duration_value order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<(typeof rows)[number]['negated'], Temporal.Duration>>()
        expect(rows.map(row => [row.id, row.sign, row.textSign, row.negated.toString(), row.textNegated?.toString(), row.abs.toString(), row.textAbs?.toString()])).toEqual([
            [1, 1, 1, '-P3DT4H5M6.789S', '-P1Y2M3DT4H5M6.789S', 'P3DT4H5M6.789S', 'P1Y2M3DT4H5M6.789S'],
            [2, -1, -1, 'P1DT2H', 'PT26H', 'P1DT2H', 'PT26H'],
            [3, 1, 1, '-PT1H30M', '-PT90M', 'PT1H30M', 'PT90M'],
        ])
    })

    test('a-duration-computed-from-another-is-kept-as-that-one', async () => {
        // The text negated or without its sign is a text: its fields and its total read it as one
        ctx.mockNext([{ id: 2, hours: 26, minutes: 0, total: 1560 }, { id: 3, hours: 0, minutes: -90, total: 90 }])
        const rows = await ctx.conn.selectFrom(tDurationValue)
            .where(tDurationValue.id.greaterThan(1))
            .select({
                id: tDurationValue.id,
                hours: tDurationValue.spanText.negated().hours(),
                minutes: tDurationValue.spanText.negated().minutes(),
                total: tDurationValue.spanText.abs().total('minutes'),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_part(case when substr(span_text, 1, 1) = '-' then substr(span_text, 2) when tsq_duration_part(span_text, 'sign') = 0 then span_text when substr(span_text, 1, 1) = '+' then '-' || substr(span_text, 2) else '-' || span_text end, 'hours') as hours, tsq_duration_part(case when substr(span_text, 1, 1) = '-' then substr(span_text, 2) when tsq_duration_part(span_text, 'sign') = 0 then span_text when substr(span_text, 1, 1) = '+' then '-' || substr(span_text, 2) else '-' || span_text end, 'minutes') as minutes, tsq_duration_total(tsq_duration_part(case when substr(span_text, 1, 1) in ('-', '+') then substr(span_text, 2) else span_text end, 'M'), tsq_duration_part(case when substr(span_text, 1, 1) in ('-', '+') then substr(span_text, 2) else span_text end, 'weeks'), tsq_duration_part(case when substr(span_text, 1, 1) in ('-', '+') then substr(span_text, 2) else span_text end, 'days'), tsq_duration_part(case when substr(span_text, 1, 1) in ('-', '+') then substr(span_text, 2) else span_text end, 'S'), tsq_duration_part(case when substr(span_text, 1, 1) in ('-', '+') then substr(span_text, 2) else span_text end, 'N'), 0, 0, 0, 'minute') as total from duration_value where id > $1 order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1",
          ]
        `)
        expect(rows.map(row => [row.id, row.hours, row.minutes, row.total])).toEqual([[2, 26, 0, 1560], [3, 0, -90, 90]])
        // 2024-01-31 until 2024-03-30 in months is P1M30D: negated, -P1M30D
        ctx.mockNext({ months: -1, days: -30, total: 59 })
        const january31 = ctx.conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate')
        const row = await ctx.conn.selectFromNoTable()
            .select({
                months: january31.until(Temporal.PlainDate.from('2024-03-30'), { largestUnit: 'month' }).negated().months(),
                days: january31.until(Temporal.PlainDate.from('2024-03-30'), { largestUnit: 'month' }).negated().days(),
                total: january31.until(Temporal.PlainDate.from('2024-03-30'), { largestUnit: 'month' }).negated().abs().total({ unit: 'day', relativeTo: january31 }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(extract(month from -make_interval(months => (((cast(extract(year from $1) as integer) * 12 + cast(extract(month from $1) as integer)) * 32 + cast(extract(day from $1) as integer) - (cast(extract(year from $2) as integer) * 12 + cast(extract(month from $2) as integer)) * 32 - cast(extract(day from $2) as integer)) / 32), days => ($1 - cast($2 + make_interval(months => (((cast(extract(year from $1) as integer) * 12 + cast(extract(month from $1) as integer)) * 32 + cast(extract(day from $1) as integer) - (cast(extract(year from $2) as integer) * 12 + cast(extract(month from $2) as integer)) * 32 - cast(extract(day from $2) as integer)) / 32)) as date)))) as integer) as months, cast(extract(day from -make_interval(months => (((cast(extract(year from $3) as integer) * 12 + cast(extract(month from $3) as integer)) * 32 + cast(extract(day from $3) as integer) - (cast(extract(year from $4) as integer) * 12 + cast(extract(month from $4) as integer)) * 32 - cast(extract(day from $4) as integer)) / 32), days => ($3 - cast($4 + make_interval(months => (((cast(extract(year from $3) as integer) * 12 + cast(extract(month from $3) as integer)) * 32 + cast(extract(day from $3) as integer) - (cast(extract(year from $4) as integer) * 12 + cast(extract(month from $4) as integer)) * 32 - cast(extract(day from $4) as integer)) / 32)) as date)))) as integer) as days, tsq_duration_total(cast(extract(year from case when -make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date))) < interval '0' then -(-make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date)))) else -make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date))) end) * 12 + extract(month from case when -make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date))) < interval '0' then -(-make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date)))) else -make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date))) end) as bigint), 0, cast(extract(day from case when -make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date))) < interval '0' then -(-make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date)))) else -make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date))) end) as bigint), cast(extract(hour from case when -make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date))) < interval '0' then -(-make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date)))) else -make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date))) end) * 3600 + extract(minute from case when -make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date))) < interval '0' then -(-make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date)))) else -make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date))) end) * 60 + trunc(extract(second from case when -make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date))) < interval '0' then -(-make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date)))) else -make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date))) end)) as bigint), cast(extract(microseconds from case when -make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date))) < interval '0' then -(-make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date)))) else -make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date))) end) as bigint) % 1000000 * 1000, cast(extract(year from $7) as integer), cast(extract(month from $7) as integer), cast(extract(day from $7) as integer), 'day') as total"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-01-31",
          ]
        `)
        expect([row.months, row.days, row.total]).toEqual([-1, -30, 59])
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(extract(year from make_interval(years => ((((cast(extract(year from $1) as integer) * 12 + cast(extract(month from $1) as integer)) * 32 + cast(extract(day from $1) as integer) - (cast(extract(year from $2) as integer) * 12 + cast(extract(month from $2) as integer)) * 32 - cast(extract(day from $2) as integer)) / 32) / 12), months => ((((cast(extract(year from $1) as integer) * 12 + cast(extract(month from $1) as integer)) * 32 + cast(extract(day from $1) as integer) - (cast(extract(year from $2) as integer) * 12 + cast(extract(month from $2) as integer)) * 32 - cast(extract(day from $2) as integer)) / 32) % 12), days => ($1 - cast($2 + make_interval(months => (((cast(extract(year from $1) as integer) * 12 + cast(extract(month from $1) as integer)) * 32 + cast(extract(day from $1) as integer) - (cast(extract(year from $2) as integer) * 12 + cast(extract(month from $2) as integer)) * 32 - cast(extract(day from $2) as integer)) / 32)) as date)))) as integer) as years, cast(extract(month from make_interval(years => ((((cast(extract(year from $3) as integer) * 12 + cast(extract(month from $3) as integer)) * 32 + cast(extract(day from $3) as integer) - (cast(extract(year from $4) as integer) * 12 + cast(extract(month from $4) as integer)) * 32 - cast(extract(day from $4) as integer)) / 32) / 12), months => ((((cast(extract(year from $3) as integer) * 12 + cast(extract(month from $3) as integer)) * 32 + cast(extract(day from $3) as integer) - (cast(extract(year from $4) as integer) * 12 + cast(extract(month from $4) as integer)) * 32 - cast(extract(day from $4) as integer)) / 32) % 12), days => ($3 - cast($4 + make_interval(months => (((cast(extract(year from $3) as integer) * 12 + cast(extract(month from $3) as integer)) * 32 + cast(extract(day from $3) as integer) - (cast(extract(year from $4) as integer) * 12 + cast(extract(month from $4) as integer)) * 32 - cast(extract(day from $4) as integer)) / 32)) as date)))) as integer) as months, cast(extract(day from make_interval(years => ((((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32) / 12), months => ((((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32) % 12), days => ($5 - cast($6 + make_interval(months => (((cast(extract(year from $5) as integer) * 12 + cast(extract(month from $5) as integer)) * 32 + cast(extract(day from $5) as integer) - (cast(extract(year from $6) as integer) * 12 + cast(extract(month from $6) as integer)) * 32 - cast(extract(day from $6) as integer)) / 32)) as date)))) as integer) as days, cast(sign(extract(epoch from make_interval(days => -($7 - $8)))) as integer) as sign"`)
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
