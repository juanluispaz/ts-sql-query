// The fields, the sign, the negation and the absolute value of a duration, as Temporal reads the duration kept. Every
// expected value is the one Temporal gives. duration_value: span is 1 3 days 04:05:06.789, 2 -1 day -2 hours, 3 01:30
// (kept as its ISO 8601 text P3DT4H5M6.789S, -P1DT2H and PT1H30M); span_text is the ISO 8601 text P1Y2M3DT4H5M6.789S,
// -PT26H and PT90M, whose fields are the ones written.

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, dbo.tsq_duration_part(span_text, 'years') as years, dbo.tsq_duration_part(span_text, 'months') as months, dbo.tsq_duration_part(span_text, 'weeks') as weeks, dbo.tsq_duration_part(span_text, 'days') as days, dbo.tsq_duration_part(span_text, 'hours') as hours, dbo.tsq_duration_part(span_text, 'minutes') as minutes, dbo.tsq_duration_part(span_text, 'seconds') as seconds, (dbo.tsq_duration_part(span_text, 'N') / 1000000) as milliseconds, (dbo.tsq_duration_part(span_text, 'N') / 1000 % 1000) as microseconds, (dbo.tsq_duration_part(span_text, 'N') % 1000) as nanoseconds from duration_value order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, dbo.tsq_duration_part(span, 'days') as days, dbo.tsq_duration_part(span, 'hours') as hours, dbo.tsq_duration_part(span, 'minutes') as minutes, dbo.tsq_duration_part(span, 'seconds') as seconds, (dbo.tsq_duration_part(span, 'N') / 1000000) as milliseconds from duration_value order by id"`)
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
            { id: 1, sign: 1, textSign: 1, negated: '-P3DT4H5M6.789S', textNegated: '-P1Y2M3DT4H5M6.789S', abs: 'P3DT4H5M6.789S', textAbs: 'P1Y2M3DT4H5M6.789S' },
            { id: 2, sign: -1, textSign: -1, negated: 'P1DT2H', textNegated: 'PT26H', abs: 'P1DT2H', textAbs: 'PT26H' },
            { id: 3, sign: 1, textSign: 1, negated: '-PT1H30M', textNegated: '-PT90M', abs: 'PT1H30M', textAbs: 'PT90M' },
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, dbo.tsq_duration_part(span, 'sign') as sign, dbo.tsq_duration_part(span_text, 'sign') as textSign, case when substring(span, 1, 1) = '-' then substring(span, 2, 100) when dbo.tsq_duration_part(span, 'sign') = 0 then span when substring(span, 1, 1) = '+' then '-' + substring(span, 2, 100) else '-' + span end as negated, case when substring(span_text, 1, 1) = '-' then substring(span_text, 2, 100) when dbo.tsq_duration_part(span_text, 'sign') = 0 then span_text when substring(span_text, 1, 1) = '+' then '-' + substring(span_text, 2, 100) else '-' + span_text end as textNegated, case when substring(span, 1, 1) in ('-', '+') then substring(span, 2, 100) else span end as abs, case when substring(span_text, 1, 1) in ('-', '+') then substring(span_text, 2, 100) else span_text end as textAbs from duration_value order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, dbo.tsq_duration_part(case when substring(span_text, 1, 1) = '-' then substring(span_text, 2, 100) when dbo.tsq_duration_part(span_text, 'sign') = 0 then span_text when substring(span_text, 1, 1) = '+' then '-' + substring(span_text, 2, 100) else '-' + span_text end, 'hours') as hours, dbo.tsq_duration_part(case when substring(span_text, 1, 1) = '-' then substring(span_text, 2, 100) when dbo.tsq_duration_part(span_text, 'sign') = 0 then span_text when substring(span_text, 1, 1) = '+' then '-' + substring(span_text, 2, 100) else '-' + span_text end, 'minutes') as minutes, dbo.tsq_duration_total(dbo.tsq_duration_part(case when substring(span_text, 1, 1) in ('-', '+') then substring(span_text, 2, 100) else span_text end, 'M'), dbo.tsq_duration_part(case when substring(span_text, 1, 1) in ('-', '+') then substring(span_text, 2, 100) else span_text end, 'weeks'), dbo.tsq_duration_part(case when substring(span_text, 1, 1) in ('-', '+') then substring(span_text, 2, 100) else span_text end, 'days'), dbo.tsq_duration_part(case when substring(span_text, 1, 1) in ('-', '+') then substring(span_text, 2, 100) else span_text end, 'S'), dbo.tsq_duration_part(case when substring(span_text, 1, 1) in ('-', '+') then substring(span_text, 2, 100) else span_text end, 'N'), 0, 0, 0, 'minute') as total from duration_value where id > @0 order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dbo.tsq_duration_part(case when substring(dbo.tsq_duration_text(0, ((datepart(year, @0) * 12 + datepart(month, @0)) * 32 + datepart(day, @0) - (datepart(year, @1) * 12 + datepart(month, @1)) * 32 - datepart(day, @1)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @0) * 12 + datepart(month, @0)) * 32 + datepart(day, @0) - (datepart(year, @1) * 12 + datepart(month, @1)) * 32 - datepart(day, @1)) / 32, @1), @0), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @2) * 12 + datepart(month, @2)) * 32 + datepart(day, @2) - (datepart(year, @3) * 12 + datepart(month, @3)) * 32 - datepart(day, @3)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @2) * 12 + datepart(month, @2)) * 32 + datepart(day, @2) - (datepart(year, @3) * 12 + datepart(month, @3)) * 32 - datepart(day, @3)) / 32, @3), @2), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @4) * 12 + datepart(month, @4)) * 32 + datepart(day, @4) - (datepart(year, @5) * 12 + datepart(month, @5)) * 32 - datepart(day, @5)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @4) * 12 + datepart(month, @4)) * 32 + datepart(day, @4) - (datepart(year, @5) * 12 + datepart(month, @5)) * 32 - datepart(day, @5)) / 32, @5), @4), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @6) * 12 + datepart(month, @6)) * 32 + datepart(day, @6) - (datepart(year, @7) * 12 + datepart(month, @7)) * 32 - datepart(day, @7)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @6) * 12 + datepart(month, @6)) * 32 + datepart(day, @6) - (datepart(year, @7) * 12 + datepart(month, @7)) * 32 - datepart(day, @7)) / 32, @7), @6), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @8) * 12 + datepart(month, @8)) * 32 + datepart(day, @8) - (datepart(year, @9) * 12 + datepart(month, @9)) * 32 - datepart(day, @9)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @8) * 12 + datepart(month, @8)) * 32 + datepart(day, @8) - (datepart(year, @9) * 12 + datepart(month, @9)) * 32 - datepart(day, @9)) / 32, @9), @8), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @10) * 12 + datepart(month, @10)) * 32 + datepart(day, @10) - (datepart(year, @11) * 12 + datepart(month, @11)) * 32 - datepart(day, @11)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @10) * 12 + datepart(month, @10)) * 32 + datepart(day, @10) - (datepart(year, @11) * 12 + datepart(month, @11)) * 32 - datepart(day, @11)) / 32, @11), @10), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @12) * 12 + datepart(month, @12)) * 32 + datepart(day, @12) - (datepart(year, @13) * 12 + datepart(month, @13)) * 32 - datepart(day, @13)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @12) * 12 + datepart(month, @12)) * 32 + datepart(day, @12) - (datepart(year, @13) * 12 + datepart(month, @13)) * 32 - datepart(day, @13)) / 32, @13), @12), 0, 'hour') end, 'months') as months, dbo.tsq_duration_part(case when substring(dbo.tsq_duration_text(0, ((datepart(year, @14) * 12 + datepart(month, @14)) * 32 + datepart(day, @14) - (datepart(year, @15) * 12 + datepart(month, @15)) * 32 - datepart(day, @15)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @14) * 12 + datepart(month, @14)) * 32 + datepart(day, @14) - (datepart(year, @15) * 12 + datepart(month, @15)) * 32 - datepart(day, @15)) / 32, @15), @14), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @16) * 12 + datepart(month, @16)) * 32 + datepart(day, @16) - (datepart(year, @17) * 12 + datepart(month, @17)) * 32 - datepart(day, @17)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @16) * 12 + datepart(month, @16)) * 32 + datepart(day, @16) - (datepart(year, @17) * 12 + datepart(month, @17)) * 32 - datepart(day, @17)) / 32, @17), @16), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @18) * 12 + datepart(month, @18)) * 32 + datepart(day, @18) - (datepart(year, @19) * 12 + datepart(month, @19)) * 32 - datepart(day, @19)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @18) * 12 + datepart(month, @18)) * 32 + datepart(day, @18) - (datepart(year, @19) * 12 + datepart(month, @19)) * 32 - datepart(day, @19)) / 32, @19), @18), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @20) * 12 + datepart(month, @20)) * 32 + datepart(day, @20) - (datepart(year, @21) * 12 + datepart(month, @21)) * 32 - datepart(day, @21)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @20) * 12 + datepart(month, @20)) * 32 + datepart(day, @20) - (datepart(year, @21) * 12 + datepart(month, @21)) * 32 - datepart(day, @21)) / 32, @21), @20), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @22) * 12 + datepart(month, @22)) * 32 + datepart(day, @22) - (datepart(year, @23) * 12 + datepart(month, @23)) * 32 - datepart(day, @23)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @22) * 12 + datepart(month, @22)) * 32 + datepart(day, @22) - (datepart(year, @23) * 12 + datepart(month, @23)) * 32 - datepart(day, @23)) / 32, @23), @22), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @24) * 12 + datepart(month, @24)) * 32 + datepart(day, @24) - (datepart(year, @25) * 12 + datepart(month, @25)) * 32 - datepart(day, @25)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @24) * 12 + datepart(month, @24)) * 32 + datepart(day, @24) - (datepart(year, @25) * 12 + datepart(month, @25)) * 32 - datepart(day, @25)) / 32, @25), @24), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @26) * 12 + datepart(month, @26)) * 32 + datepart(day, @26) - (datepart(year, @27) * 12 + datepart(month, @27)) * 32 - datepart(day, @27)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @26) * 12 + datepart(month, @26)) * 32 + datepart(day, @26) - (datepart(year, @27) * 12 + datepart(month, @27)) * 32 - datepart(day, @27)) / 32, @27), @26), 0, 'hour') end, 'days') as days, dbo.tsq_duration_total(dbo.tsq_duration_part(case when substring(case when substring(dbo.tsq_duration_text(0, ((datepart(year, @28) * 12 + datepart(month, @28)) * 32 + datepart(day, @28) - (datepart(year, @29) * 12 + datepart(month, @29)) * 32 - datepart(day, @29)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @28) * 12 + datepart(month, @28)) * 32 + datepart(day, @28) - (datepart(year, @29) * 12 + datepart(month, @29)) * 32 - datepart(day, @29)) / 32, @29), @28), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @30) * 12 + datepart(month, @30)) * 32 + datepart(day, @30) - (datepart(year, @31) * 12 + datepart(month, @31)) * 32 - datepart(day, @31)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @30) * 12 + datepart(month, @30)) * 32 + datepart(day, @30) - (datepart(year, @31) * 12 + datepart(month, @31)) * 32 - datepart(day, @31)) / 32, @31), @30), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @32) * 12 + datepart(month, @32)) * 32 + datepart(day, @32) - (datepart(year, @33) * 12 + datepart(month, @33)) * 32 - datepart(day, @33)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @32) * 12 + datepart(month, @32)) * 32 + datepart(day, @32) - (datepart(year, @33) * 12 + datepart(month, @33)) * 32 - datepart(day, @33)) / 32, @33), @32), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @34) * 12 + datepart(month, @34)) * 32 + datepart(day, @34) - (datepart(year, @35) * 12 + datepart(month, @35)) * 32 - datepart(day, @35)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @34) * 12 + datepart(month, @34)) * 32 + datepart(day, @34) - (datepart(year, @35) * 12 + datepart(month, @35)) * 32 - datepart(day, @35)) / 32, @35), @34), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @36) * 12 + datepart(month, @36)) * 32 + datepart(day, @36) - (datepart(year, @37) * 12 + datepart(month, @37)) * 32 - datepart(day, @37)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @36) * 12 + datepart(month, @36)) * 32 + datepart(day, @36) - (datepart(year, @37) * 12 + datepart(month, @37)) * 32 - datepart(day, @37)) / 32, @37), @36), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @38) * 12 + datepart(month, @38)) * 32 + datepart(day, @38) - (datepart(year, @39) * 12 + datepart(month, @39)) * 32 - datepart(day, @39)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @38) * 12 + datepart(month, @38)) * 32 + datepart(day, @38) - (datepart(year, @39) * 12 + datepart(month, @39)) * 32 - datepart(day, @39)) / 32, @39), @38), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @40) * 12 + datepart(month, @40)) * 32 + datepart(day, @40) - (datepart(year, @41) * 12 + datepart(month, @41)) * 32 - datepart(day, @41)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @40) * 12 + datepart(month, @40)) * 32 + datepart(day, @40) - (datepart(year, @41) * 12 + datepart(month, @41)) * 32 - datepart(day, @41)) / 32, @41), @40), 0, 'hour') end, 1, 1) in ('-', '+') then substring(case when substring(dbo.tsq_duration_text(0, ((datepart(year, @42) * 12 + datepart(month, @42)) * 32 + datepart(day, @42) - (datepart(year, @43) * 12 + datepart(month, @43)) * 32 - datepart(day, @43)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @42) * 12 + datepart(month, @42)) * 32 + datepart(day, @42) - (datepart(year, @43) * 12 + datepart(month, @43)) * 32 - datepart(day, @43)) / 32, @43), @42), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @44) * 12 + datepart(month, @44)) * 32 + datepart(day, @44) - (datepart(year, @45) * 12 + datepart(month, @45)) * 32 - datepart(day, @45)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @44) * 12 + datepart(month, @44)) * 32 + datepart(day, @44) - (datepart(year, @45) * 12 + datepart(month, @45)) * 32 - datepart(day, @45)) / 32, @45), @44), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @46) * 12 + datepart(month, @46)) * 32 + datepart(day, @46) - (datepart(year, @47) * 12 + datepart(month, @47)) * 32 - datepart(day, @47)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @46) * 12 + datepart(month, @46)) * 32 + datepart(day, @46) - (datepart(year, @47) * 12 + datepart(month, @47)) * 32 - datepart(day, @47)) / 32, @47), @46), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @48) * 12 + datepart(month, @48)) * 32 + datepart(day, @48) - (datepart(year, @49) * 12 + datepart(month, @49)) * 32 - datepart(day, @49)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @48) * 12 + datepart(month, @48)) * 32 + datepart(day, @48) - (datepart(year, @49) * 12 + datepart(month, @49)) * 32 - datepart(day, @49)) / 32, @49), @48), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @50) * 12 + datepart(month, @50)) * 32 + datepart(day, @50) - (datepart(year, @51) * 12 + datepart(month, @51)) * 32 - datepart(day, @51)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @50) * 12 + datepart(month, @50)) * 32 + datepart(day, @50) - (datepart(year, @51) * 12 + datepart(month, @51)) * 32 - datepart(day, @51)) / 32, @51), @50), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @52) * 12 + datepart(month, @52)) * 32 + datepart(day, @52) - (datepart(year, @53) * 12 + datepart(month, @53)) * 32 - datepart(day, @53)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @52) * 12 + datepart(month, @52)) * 32 + datepart(day, @52) - (datepart(year, @53) * 12 + datepart(month, @53)) * 32 - datepart(day, @53)) / 32, @53), @52), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @54) * 12 + datepart(month, @54)) * 32 + datepart(day, @54) - (datepart(year, @55) * 12 + datepart(month, @55)) * 32 - datepart(day, @55)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @54) * 12 + datepart(month, @54)) * 32 + datepart(day, @54) - (datepart(year, @55) * 12 + datepart(month, @55)) * 32 - datepart(day, @55)) / 32, @55), @54), 0, 'hour') end, 2, 100) else case when substring(dbo.tsq_duration_text(0, ((datepart(year, @56) * 12 + datepart(month, @56)) * 32 + datepart(day, @56) - (datepart(year, @57) * 12 + datepart(month, @57)) * 32 - datepart(day, @57)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @56) * 12 + datepart(month, @56)) * 32 + datepart(day, @56) - (datepart(year, @57) * 12 + datepart(month, @57)) * 32 - datepart(day, @57)) / 32, @57), @56), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @58) * 12 + datepart(month, @58)) * 32 + datepart(day, @58) - (datepart(year, @59) * 12 + datepart(month, @59)) * 32 - datepart(day, @59)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @58) * 12 + datepart(month, @58)) * 32 + datepart(day, @58) - (datepart(year, @59) * 12 + datepart(month, @59)) * 32 - datepart(day, @59)) / 32, @59), @58), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @60) * 12 + datepart(month, @60)) * 32 + datepart(day, @60) - (datepart(year, @61) * 12 + datepart(month, @61)) * 32 - datepart(day, @61)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @60) * 12 + datepart(month, @60)) * 32 + datepart(day, @60) - (datepart(year, @61) * 12 + datepart(month, @61)) * 32 - datepart(day, @61)) / 32, @61), @60), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @62) * 12 + datepart(month, @62)) * 32 + datepart(day, @62) - (datepart(year, @63) * 12 + datepart(month, @63)) * 32 - datepart(day, @63)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @62) * 12 + datepart(month, @62)) * 32 + datepart(day, @62) - (datepart(year, @63) * 12 + datepart(month, @63)) * 32 - datepart(day, @63)) / 32, @63), @62), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @64) * 12 + datepart(month, @64)) * 32 + datepart(day, @64) - (datepart(year, @65) * 12 + datepart(month, @65)) * 32 - datepart(day, @65)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @64) * 12 + datepart(month, @64)) * 32 + datepart(day, @64) - (datepart(year, @65) * 12 + datepart(month, @65)) * 32 - datepart(day, @65)) / 32, @65), @64), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @66) * 12 + datepart(month, @66)) * 32 + datepart(day, @66) - (datepart(year, @67) * 12 + datepart(month, @67)) * 32 - datepart(day, @67)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @66) * 12 + datepart(month, @66)) * 32 + datepart(day, @66) - (datepart(year, @67) * 12 + datepart(month, @67)) * 32 - datepart(day, @67)) / 32, @67), @66), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @68) * 12 + datepart(month, @68)) * 32 + datepart(day, @68) - (datepart(year, @69) * 12 + datepart(month, @69)) * 32 - datepart(day, @69)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @68) * 12 + datepart(month, @68)) * 32 + datepart(day, @68) - (datepart(year, @69) * 12 + datepart(month, @69)) * 32 - datepart(day, @69)) / 32, @69), @68), 0, 'hour') end end, 'M'), dbo.tsq_duration_part(case when substring(case when substring(dbo.tsq_duration_text(0, ((datepart(year, @70) * 12 + datepart(month, @70)) * 32 + datepart(day, @70) - (datepart(year, @71) * 12 + datepart(month, @71)) * 32 - datepart(day, @71)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @70) * 12 + datepart(month, @70)) * 32 + datepart(day, @70) - (datepart(year, @71) * 12 + datepart(month, @71)) * 32 - datepart(day, @71)) / 32, @71), @70), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @72) * 12 + datepart(month, @72)) * 32 + datepart(day, @72) - (datepart(year, @73) * 12 + datepart(month, @73)) * 32 - datepart(day, @73)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @72) * 12 + datepart(month, @72)) * 32 + datepart(day, @72) - (datepart(year, @73) * 12 + datepart(month, @73)) * 32 - datepart(day, @73)) / 32, @73), @72), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @74) * 12 + datepart(month, @74)) * 32 + datepart(day, @74) - (datepart(year, @75) * 12 + datepart(month, @75)) * 32 - datepart(day, @75)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @74) * 12 + datepart(month, @74)) * 32 + datepart(day, @74) - (datepart(year, @75) * 12 + datepart(month, @75)) * 32 - datepart(day, @75)) / 32, @75), @74), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @76) * 12 + datepart(month, @76)) * 32 + datepart(day, @76) - (datepart(year, @77) * 12 + datepart(month, @77)) * 32 - datepart(day, @77)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @76) * 12 + datepart(month, @76)) * 32 + datepart(day, @76) - (datepart(year, @77) * 12 + datepart(month, @77)) * 32 - datepart(day, @77)) / 32, @77), @76), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @78) * 12 + datepart(month, @78)) * 32 + datepart(day, @78) - (datepart(year, @79) * 12 + datepart(month, @79)) * 32 - datepart(day, @79)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @78) * 12 + datepart(month, @78)) * 32 + datepart(day, @78) - (datepart(year, @79) * 12 + datepart(month, @79)) * 32 - datepart(day, @79)) / 32, @79), @78), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @80) * 12 + datepart(month, @80)) * 32 + datepart(day, @80) - (datepart(year, @81) * 12 + datepart(month, @81)) * 32 - datepart(day, @81)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @80) * 12 + datepart(month, @80)) * 32 + datepart(day, @80) - (datepart(year, @81) * 12 + datepart(month, @81)) * 32 - datepart(day, @81)) / 32, @81), @80), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @82) * 12 + datepart(month, @82)) * 32 + datepart(day, @82) - (datepart(year, @83) * 12 + datepart(month, @83)) * 32 - datepart(day, @83)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @82) * 12 + datepart(month, @82)) * 32 + datepart(day, @82) - (datepart(year, @83) * 12 + datepart(month, @83)) * 32 - datepart(day, @83)) / 32, @83), @82), 0, 'hour') end, 1, 1) in ('-', '+') then substring(case when substring(dbo.tsq_duration_text(0, ((datepart(year, @84) * 12 + datepart(month, @84)) * 32 + datepart(day, @84) - (datepart(year, @85) * 12 + datepart(month, @85)) * 32 - datepart(day, @85)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @84) * 12 + datepart(month, @84)) * 32 + datepart(day, @84) - (datepart(year, @85) * 12 + datepart(month, @85)) * 32 - datepart(day, @85)) / 32, @85), @84), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @86) * 12 + datepart(month, @86)) * 32 + datepart(day, @86) - (datepart(year, @87) * 12 + datepart(month, @87)) * 32 - datepart(day, @87)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @86) * 12 + datepart(month, @86)) * 32 + datepart(day, @86) - (datepart(year, @87) * 12 + datepart(month, @87)) * 32 - datepart(day, @87)) / 32, @87), @86), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @88) * 12 + datepart(month, @88)) * 32 + datepart(day, @88) - (datepart(year, @89) * 12 + datepart(month, @89)) * 32 - datepart(day, @89)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @88) * 12 + datepart(month, @88)) * 32 + datepart(day, @88) - (datepart(year, @89) * 12 + datepart(month, @89)) * 32 - datepart(day, @89)) / 32, @89), @88), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @90) * 12 + datepart(month, @90)) * 32 + datepart(day, @90) - (datepart(year, @91) * 12 + datepart(month, @91)) * 32 - datepart(day, @91)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @90) * 12 + datepart(month, @90)) * 32 + datepart(day, @90) - (datepart(year, @91) * 12 + datepart(month, @91)) * 32 - datepart(day, @91)) / 32, @91), @90), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @92) * 12 + datepart(month, @92)) * 32 + datepart(day, @92) - (datepart(year, @93) * 12 + datepart(month, @93)) * 32 - datepart(day, @93)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @92) * 12 + datepart(month, @92)) * 32 + datepart(day, @92) - (datepart(year, @93) * 12 + datepart(month, @93)) * 32 - datepart(day, @93)) / 32, @93), @92), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @94) * 12 + datepart(month, @94)) * 32 + datepart(day, @94) - (datepart(year, @95) * 12 + datepart(month, @95)) * 32 - datepart(day, @95)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @94) * 12 + datepart(month, @94)) * 32 + datepart(day, @94) - (datepart(year, @95) * 12 + datepart(month, @95)) * 32 - datepart(day, @95)) / 32, @95), @94), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @96) * 12 + datepart(month, @96)) * 32 + datepart(day, @96) - (datepart(year, @97) * 12 + datepart(month, @97)) * 32 - datepart(day, @97)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @96) * 12 + datepart(month, @96)) * 32 + datepart(day, @96) - (datepart(year, @97) * 12 + datepart(month, @97)) * 32 - datepart(day, @97)) / 32, @97), @96), 0, 'hour') end, 2, 100) else case when substring(dbo.tsq_duration_text(0, ((datepart(year, @98) * 12 + datepart(month, @98)) * 32 + datepart(day, @98) - (datepart(year, @99) * 12 + datepart(month, @99)) * 32 - datepart(day, @99)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @98) * 12 + datepart(month, @98)) * 32 + datepart(day, @98) - (datepart(year, @99) * 12 + datepart(month, @99)) * 32 - datepart(day, @99)) / 32, @99), @98), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @100) * 12 + datepart(month, @100)) * 32 + datepart(day, @100) - (datepart(year, @101) * 12 + datepart(month, @101)) * 32 - datepart(day, @101)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @100) * 12 + datepart(month, @100)) * 32 + datepart(day, @100) - (datepart(year, @101) * 12 + datepart(month, @101)) * 32 - datepart(day, @101)) / 32, @101), @100), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @102) * 12 + datepart(month, @102)) * 32 + datepart(day, @102) - (datepart(year, @103) * 12 + datepart(month, @103)) * 32 - datepart(day, @103)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @102) * 12 + datepart(month, @102)) * 32 + datepart(day, @102) - (datepart(year, @103) * 12 + datepart(month, @103)) * 32 - datepart(day, @103)) / 32, @103), @102), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @104) * 12 + datepart(month, @104)) * 32 + datepart(day, @104) - (datepart(year, @105) * 12 + datepart(month, @105)) * 32 - datepart(day, @105)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @104) * 12 + datepart(month, @104)) * 32 + datepart(day, @104) - (datepart(year, @105) * 12 + datepart(month, @105)) * 32 - datepart(day, @105)) / 32, @105), @104), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @106) * 12 + datepart(month, @106)) * 32 + datepart(day, @106) - (datepart(year, @107) * 12 + datepart(month, @107)) * 32 - datepart(day, @107)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @106) * 12 + datepart(month, @106)) * 32 + datepart(day, @106) - (datepart(year, @107) * 12 + datepart(month, @107)) * 32 - datepart(day, @107)) / 32, @107), @106), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @108) * 12 + datepart(month, @108)) * 32 + datepart(day, @108) - (datepart(year, @109) * 12 + datepart(month, @109)) * 32 - datepart(day, @109)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @108) * 12 + datepart(month, @108)) * 32 + datepart(day, @108) - (datepart(year, @109) * 12 + datepart(month, @109)) * 32 - datepart(day, @109)) / 32, @109), @108), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @110) * 12 + datepart(month, @110)) * 32 + datepart(day, @110) - (datepart(year, @111) * 12 + datepart(month, @111)) * 32 - datepart(day, @111)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @110) * 12 + datepart(month, @110)) * 32 + datepart(day, @110) - (datepart(year, @111) * 12 + datepart(month, @111)) * 32 - datepart(day, @111)) / 32, @111), @110), 0, 'hour') end end, 'weeks'), dbo.tsq_duration_part(case when substring(case when substring(dbo.tsq_duration_text(0, ((datepart(year, @112) * 12 + datepart(month, @112)) * 32 + datepart(day, @112) - (datepart(year, @113) * 12 + datepart(month, @113)) * 32 - datepart(day, @113)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @112) * 12 + datepart(month, @112)) * 32 + datepart(day, @112) - (datepart(year, @113) * 12 + datepart(month, @113)) * 32 - datepart(day, @113)) / 32, @113), @112), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @114) * 12 + datepart(month, @114)) * 32 + datepart(day, @114) - (datepart(year, @115) * 12 + datepart(month, @115)) * 32 - datepart(day, @115)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @114) * 12 + datepart(month, @114)) * 32 + datepart(day, @114) - (datepart(year, @115) * 12 + datepart(month, @115)) * 32 - datepart(day, @115)) / 32, @115), @114), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @116) * 12 + datepart(month, @116)) * 32 + datepart(day, @116) - (datepart(year, @117) * 12 + datepart(month, @117)) * 32 - datepart(day, @117)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @116) * 12 + datepart(month, @116)) * 32 + datepart(day, @116) - (datepart(year, @117) * 12 + datepart(month, @117)) * 32 - datepart(day, @117)) / 32, @117), @116), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @118) * 12 + datepart(month, @118)) * 32 + datepart(day, @118) - (datepart(year, @119) * 12 + datepart(month, @119)) * 32 - datepart(day, @119)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @118) * 12 + datepart(month, @118)) * 32 + datepart(day, @118) - (datepart(year, @119) * 12 + datepart(month, @119)) * 32 - datepart(day, @119)) / 32, @119), @118), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @120) * 12 + datepart(month, @120)) * 32 + datepart(day, @120) - (datepart(year, @121) * 12 + datepart(month, @121)) * 32 - datepart(day, @121)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @120) * 12 + datepart(month, @120)) * 32 + datepart(day, @120) - (datepart(year, @121) * 12 + datepart(month, @121)) * 32 - datepart(day, @121)) / 32, @121), @120), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @122) * 12 + datepart(month, @122)) * 32 + datepart(day, @122) - (datepart(year, @123) * 12 + datepart(month, @123)) * 32 - datepart(day, @123)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @122) * 12 + datepart(month, @122)) * 32 + datepart(day, @122) - (datepart(year, @123) * 12 + datepart(month, @123)) * 32 - datepart(day, @123)) / 32, @123), @122), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @124) * 12 + datepart(month, @124)) * 32 + datepart(day, @124) - (datepart(year, @125) * 12 + datepart(month, @125)) * 32 - datepart(day, @125)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @124) * 12 + datepart(month, @124)) * 32 + datepart(day, @124) - (datepart(year, @125) * 12 + datepart(month, @125)) * 32 - datepart(day, @125)) / 32, @125), @124), 0, 'hour') end, 1, 1) in ('-', '+') then substring(case when substring(dbo.tsq_duration_text(0, ((datepart(year, @126) * 12 + datepart(month, @126)) * 32 + datepart(day, @126) - (datepart(year, @127) * 12 + datepart(month, @127)) * 32 - datepart(day, @127)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @126) * 12 + datepart(month, @126)) * 32 + datepart(day, @126) - (datepart(year, @127) * 12 + datepart(month, @127)) * 32 - datepart(day, @127)) / 32, @127), @126), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @128) * 12 + datepart(month, @128)) * 32 + datepart(day, @128) - (datepart(year, @129) * 12 + datepart(month, @129)) * 32 - datepart(day, @129)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @128) * 12 + datepart(month, @128)) * 32 + datepart(day, @128) - (datepart(year, @129) * 12 + datepart(month, @129)) * 32 - datepart(day, @129)) / 32, @129), @128), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @130) * 12 + datepart(month, @130)) * 32 + datepart(day, @130) - (datepart(year, @131) * 12 + datepart(month, @131)) * 32 - datepart(day, @131)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @130) * 12 + datepart(month, @130)) * 32 + datepart(day, @130) - (datepart(year, @131) * 12 + datepart(month, @131)) * 32 - datepart(day, @131)) / 32, @131), @130), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @132) * 12 + datepart(month, @132)) * 32 + datepart(day, @132) - (datepart(year, @133) * 12 + datepart(month, @133)) * 32 - datepart(day, @133)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @132) * 12 + datepart(month, @132)) * 32 + datepart(day, @132) - (datepart(year, @133) * 12 + datepart(month, @133)) * 32 - datepart(day, @133)) / 32, @133), @132), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @134) * 12 + datepart(month, @134)) * 32 + datepart(day, @134) - (datepart(year, @135) * 12 + datepart(month, @135)) * 32 - datepart(day, @135)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @134) * 12 + datepart(month, @134)) * 32 + datepart(day, @134) - (datepart(year, @135) * 12 + datepart(month, @135)) * 32 - datepart(day, @135)) / 32, @135), @134), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @136) * 12 + datepart(month, @136)) * 32 + datepart(day, @136) - (datepart(year, @137) * 12 + datepart(month, @137)) * 32 - datepart(day, @137)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @136) * 12 + datepart(month, @136)) * 32 + datepart(day, @136) - (datepart(year, @137) * 12 + datepart(month, @137)) * 32 - datepart(day, @137)) / 32, @137), @136), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @138) * 12 + datepart(month, @138)) * 32 + datepart(day, @138) - (datepart(year, @139) * 12 + datepart(month, @139)) * 32 - datepart(day, @139)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @138) * 12 + datepart(month, @138)) * 32 + datepart(day, @138) - (datepart(year, @139) * 12 + datepart(month, @139)) * 32 - datepart(day, @139)) / 32, @139), @138), 0, 'hour') end, 2, 100) else case when substring(dbo.tsq_duration_text(0, ((datepart(year, @140) * 12 + datepart(month, @140)) * 32 + datepart(day, @140) - (datepart(year, @141) * 12 + datepart(month, @141)) * 32 - datepart(day, @141)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @140) * 12 + datepart(month, @140)) * 32 + datepart(day, @140) - (datepart(year, @141) * 12 + datepart(month, @141)) * 32 - datepart(day, @141)) / 32, @141), @140), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @142) * 12 + datepart(month, @142)) * 32 + datepart(day, @142) - (datepart(year, @143) * 12 + datepart(month, @143)) * 32 - datepart(day, @143)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @142) * 12 + datepart(month, @142)) * 32 + datepart(day, @142) - (datepart(year, @143) * 12 + datepart(month, @143)) * 32 - datepart(day, @143)) / 32, @143), @142), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @144) * 12 + datepart(month, @144)) * 32 + datepart(day, @144) - (datepart(year, @145) * 12 + datepart(month, @145)) * 32 - datepart(day, @145)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @144) * 12 + datepart(month, @144)) * 32 + datepart(day, @144) - (datepart(year, @145) * 12 + datepart(month, @145)) * 32 - datepart(day, @145)) / 32, @145), @144), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @146) * 12 + datepart(month, @146)) * 32 + datepart(day, @146) - (datepart(year, @147) * 12 + datepart(month, @147)) * 32 - datepart(day, @147)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @146) * 12 + datepart(month, @146)) * 32 + datepart(day, @146) - (datepart(year, @147) * 12 + datepart(month, @147)) * 32 - datepart(day, @147)) / 32, @147), @146), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @148) * 12 + datepart(month, @148)) * 32 + datepart(day, @148) - (datepart(year, @149) * 12 + datepart(month, @149)) * 32 - datepart(day, @149)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @148) * 12 + datepart(month, @148)) * 32 + datepart(day, @148) - (datepart(year, @149) * 12 + datepart(month, @149)) * 32 - datepart(day, @149)) / 32, @149), @148), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @150) * 12 + datepart(month, @150)) * 32 + datepart(day, @150) - (datepart(year, @151) * 12 + datepart(month, @151)) * 32 - datepart(day, @151)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @150) * 12 + datepart(month, @150)) * 32 + datepart(day, @150) - (datepart(year, @151) * 12 + datepart(month, @151)) * 32 - datepart(day, @151)) / 32, @151), @150), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @152) * 12 + datepart(month, @152)) * 32 + datepart(day, @152) - (datepart(year, @153) * 12 + datepart(month, @153)) * 32 - datepart(day, @153)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @152) * 12 + datepart(month, @152)) * 32 + datepart(day, @152) - (datepart(year, @153) * 12 + datepart(month, @153)) * 32 - datepart(day, @153)) / 32, @153), @152), 0, 'hour') end end, 'days'), dbo.tsq_duration_part(case when substring(case when substring(dbo.tsq_duration_text(0, ((datepart(year, @154) * 12 + datepart(month, @154)) * 32 + datepart(day, @154) - (datepart(year, @155) * 12 + datepart(month, @155)) * 32 - datepart(day, @155)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @154) * 12 + datepart(month, @154)) * 32 + datepart(day, @154) - (datepart(year, @155) * 12 + datepart(month, @155)) * 32 - datepart(day, @155)) / 32, @155), @154), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @156) * 12 + datepart(month, @156)) * 32 + datepart(day, @156) - (datepart(year, @157) * 12 + datepart(month, @157)) * 32 - datepart(day, @157)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @156) * 12 + datepart(month, @156)) * 32 + datepart(day, @156) - (datepart(year, @157) * 12 + datepart(month, @157)) * 32 - datepart(day, @157)) / 32, @157), @156), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @158) * 12 + datepart(month, @158)) * 32 + datepart(day, @158) - (datepart(year, @159) * 12 + datepart(month, @159)) * 32 - datepart(day, @159)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @158) * 12 + datepart(month, @158)) * 32 + datepart(day, @158) - (datepart(year, @159) * 12 + datepart(month, @159)) * 32 - datepart(day, @159)) / 32, @159), @158), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @160) * 12 + datepart(month, @160)) * 32 + datepart(day, @160) - (datepart(year, @161) * 12 + datepart(month, @161)) * 32 - datepart(day, @161)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @160) * 12 + datepart(month, @160)) * 32 + datepart(day, @160) - (datepart(year, @161) * 12 + datepart(month, @161)) * 32 - datepart(day, @161)) / 32, @161), @160), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @162) * 12 + datepart(month, @162)) * 32 + datepart(day, @162) - (datepart(year, @163) * 12 + datepart(month, @163)) * 32 - datepart(day, @163)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @162) * 12 + datepart(month, @162)) * 32 + datepart(day, @162) - (datepart(year, @163) * 12 + datepart(month, @163)) * 32 - datepart(day, @163)) / 32, @163), @162), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @164) * 12 + datepart(month, @164)) * 32 + datepart(day, @164) - (datepart(year, @165) * 12 + datepart(month, @165)) * 32 - datepart(day, @165)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @164) * 12 + datepart(month, @164)) * 32 + datepart(day, @164) - (datepart(year, @165) * 12 + datepart(month, @165)) * 32 - datepart(day, @165)) / 32, @165), @164), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @166) * 12 + datepart(month, @166)) * 32 + datepart(day, @166) - (datepart(year, @167) * 12 + datepart(month, @167)) * 32 - datepart(day, @167)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @166) * 12 + datepart(month, @166)) * 32 + datepart(day, @166) - (datepart(year, @167) * 12 + datepart(month, @167)) * 32 - datepart(day, @167)) / 32, @167), @166), 0, 'hour') end, 1, 1) in ('-', '+') then substring(case when substring(dbo.tsq_duration_text(0, ((datepart(year, @168) * 12 + datepart(month, @168)) * 32 + datepart(day, @168) - (datepart(year, @169) * 12 + datepart(month, @169)) * 32 - datepart(day, @169)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @168) * 12 + datepart(month, @168)) * 32 + datepart(day, @168) - (datepart(year, @169) * 12 + datepart(month, @169)) * 32 - datepart(day, @169)) / 32, @169), @168), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @170) * 12 + datepart(month, @170)) * 32 + datepart(day, @170) - (datepart(year, @171) * 12 + datepart(month, @171)) * 32 - datepart(day, @171)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @170) * 12 + datepart(month, @170)) * 32 + datepart(day, @170) - (datepart(year, @171) * 12 + datepart(month, @171)) * 32 - datepart(day, @171)) / 32, @171), @170), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @172) * 12 + datepart(month, @172)) * 32 + datepart(day, @172) - (datepart(year, @173) * 12 + datepart(month, @173)) * 32 - datepart(day, @173)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @172) * 12 + datepart(month, @172)) * 32 + datepart(day, @172) - (datepart(year, @173) * 12 + datepart(month, @173)) * 32 - datepart(day, @173)) / 32, @173), @172), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @174) * 12 + datepart(month, @174)) * 32 + datepart(day, @174) - (datepart(year, @175) * 12 + datepart(month, @175)) * 32 - datepart(day, @175)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @174) * 12 + datepart(month, @174)) * 32 + datepart(day, @174) - (datepart(year, @175) * 12 + datepart(month, @175)) * 32 - datepart(day, @175)) / 32, @175), @174), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @176) * 12 + datepart(month, @176)) * 32 + datepart(day, @176) - (datepart(year, @177) * 12 + datepart(month, @177)) * 32 - datepart(day, @177)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @176) * 12 + datepart(month, @176)) * 32 + datepart(day, @176) - (datepart(year, @177) * 12 + datepart(month, @177)) * 32 - datepart(day, @177)) / 32, @177), @176), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @178) * 12 + datepart(month, @178)) * 32 + datepart(day, @178) - (datepart(year, @179) * 12 + datepart(month, @179)) * 32 - datepart(day, @179)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @178) * 12 + datepart(month, @178)) * 32 + datepart(day, @178) - (datepart(year, @179) * 12 + datepart(month, @179)) * 32 - datepart(day, @179)) / 32, @179), @178), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @180) * 12 + datepart(month, @180)) * 32 + datepart(day, @180) - (datepart(year, @181) * 12 + datepart(month, @181)) * 32 - datepart(day, @181)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @180) * 12 + datepart(month, @180)) * 32 + datepart(day, @180) - (datepart(year, @181) * 12 + datepart(month, @181)) * 32 - datepart(day, @181)) / 32, @181), @180), 0, 'hour') end, 2, 100) else case when substring(dbo.tsq_duration_text(0, ((datepart(year, @182) * 12 + datepart(month, @182)) * 32 + datepart(day, @182) - (datepart(year, @183) * 12 + datepart(month, @183)) * 32 - datepart(day, @183)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @182) * 12 + datepart(month, @182)) * 32 + datepart(day, @182) - (datepart(year, @183) * 12 + datepart(month, @183)) * 32 - datepart(day, @183)) / 32, @183), @182), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @184) * 12 + datepart(month, @184)) * 32 + datepart(day, @184) - (datepart(year, @185) * 12 + datepart(month, @185)) * 32 - datepart(day, @185)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @184) * 12 + datepart(month, @184)) * 32 + datepart(day, @184) - (datepart(year, @185) * 12 + datepart(month, @185)) * 32 - datepart(day, @185)) / 32, @185), @184), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @186) * 12 + datepart(month, @186)) * 32 + datepart(day, @186) - (datepart(year, @187) * 12 + datepart(month, @187)) * 32 - datepart(day, @187)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @186) * 12 + datepart(month, @186)) * 32 + datepart(day, @186) - (datepart(year, @187) * 12 + datepart(month, @187)) * 32 - datepart(day, @187)) / 32, @187), @186), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @188) * 12 + datepart(month, @188)) * 32 + datepart(day, @188) - (datepart(year, @189) * 12 + datepart(month, @189)) * 32 - datepart(day, @189)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @188) * 12 + datepart(month, @188)) * 32 + datepart(day, @188) - (datepart(year, @189) * 12 + datepart(month, @189)) * 32 - datepart(day, @189)) / 32, @189), @188), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @190) * 12 + datepart(month, @190)) * 32 + datepart(day, @190) - (datepart(year, @191) * 12 + datepart(month, @191)) * 32 - datepart(day, @191)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @190) * 12 + datepart(month, @190)) * 32 + datepart(day, @190) - (datepart(year, @191) * 12 + datepart(month, @191)) * 32 - datepart(day, @191)) / 32, @191), @190), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @192) * 12 + datepart(month, @192)) * 32 + datepart(day, @192) - (datepart(year, @193) * 12 + datepart(month, @193)) * 32 - datepart(day, @193)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @192) * 12 + datepart(month, @192)) * 32 + datepart(day, @192) - (datepart(year, @193) * 12 + datepart(month, @193)) * 32 - datepart(day, @193)) / 32, @193), @192), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @194) * 12 + datepart(month, @194)) * 32 + datepart(day, @194) - (datepart(year, @195) * 12 + datepart(month, @195)) * 32 - datepart(day, @195)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @194) * 12 + datepart(month, @194)) * 32 + datepart(day, @194) - (datepart(year, @195) * 12 + datepart(month, @195)) * 32 - datepart(day, @195)) / 32, @195), @194), 0, 'hour') end end, 'S'), dbo.tsq_duration_part(case when substring(case when substring(dbo.tsq_duration_text(0, ((datepart(year, @196) * 12 + datepart(month, @196)) * 32 + datepart(day, @196) - (datepart(year, @197) * 12 + datepart(month, @197)) * 32 - datepart(day, @197)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @196) * 12 + datepart(month, @196)) * 32 + datepart(day, @196) - (datepart(year, @197) * 12 + datepart(month, @197)) * 32 - datepart(day, @197)) / 32, @197), @196), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @198) * 12 + datepart(month, @198)) * 32 + datepart(day, @198) - (datepart(year, @199) * 12 + datepart(month, @199)) * 32 - datepart(day, @199)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @198) * 12 + datepart(month, @198)) * 32 + datepart(day, @198) - (datepart(year, @199) * 12 + datepart(month, @199)) * 32 - datepart(day, @199)) / 32, @199), @198), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @200) * 12 + datepart(month, @200)) * 32 + datepart(day, @200) - (datepart(year, @201) * 12 + datepart(month, @201)) * 32 - datepart(day, @201)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @200) * 12 + datepart(month, @200)) * 32 + datepart(day, @200) - (datepart(year, @201) * 12 + datepart(month, @201)) * 32 - datepart(day, @201)) / 32, @201), @200), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @202) * 12 + datepart(month, @202)) * 32 + datepart(day, @202) - (datepart(year, @203) * 12 + datepart(month, @203)) * 32 - datepart(day, @203)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @202) * 12 + datepart(month, @202)) * 32 + datepart(day, @202) - (datepart(year, @203) * 12 + datepart(month, @203)) * 32 - datepart(day, @203)) / 32, @203), @202), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @204) * 12 + datepart(month, @204)) * 32 + datepart(day, @204) - (datepart(year, @205) * 12 + datepart(month, @205)) * 32 - datepart(day, @205)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @204) * 12 + datepart(month, @204)) * 32 + datepart(day, @204) - (datepart(year, @205) * 12 + datepart(month, @205)) * 32 - datepart(day, @205)) / 32, @205), @204), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @206) * 12 + datepart(month, @206)) * 32 + datepart(day, @206) - (datepart(year, @207) * 12 + datepart(month, @207)) * 32 - datepart(day, @207)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @206) * 12 + datepart(month, @206)) * 32 + datepart(day, @206) - (datepart(year, @207) * 12 + datepart(month, @207)) * 32 - datepart(day, @207)) / 32, @207), @206), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @208) * 12 + datepart(month, @208)) * 32 + datepart(day, @208) - (datepart(year, @209) * 12 + datepart(month, @209)) * 32 - datepart(day, @209)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @208) * 12 + datepart(month, @208)) * 32 + datepart(day, @208) - (datepart(year, @209) * 12 + datepart(month, @209)) * 32 - datepart(day, @209)) / 32, @209), @208), 0, 'hour') end, 1, 1) in ('-', '+') then substring(case when substring(dbo.tsq_duration_text(0, ((datepart(year, @210) * 12 + datepart(month, @210)) * 32 + datepart(day, @210) - (datepart(year, @211) * 12 + datepart(month, @211)) * 32 - datepart(day, @211)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @210) * 12 + datepart(month, @210)) * 32 + datepart(day, @210) - (datepart(year, @211) * 12 + datepart(month, @211)) * 32 - datepart(day, @211)) / 32, @211), @210), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @212) * 12 + datepart(month, @212)) * 32 + datepart(day, @212) - (datepart(year, @213) * 12 + datepart(month, @213)) * 32 - datepart(day, @213)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @212) * 12 + datepart(month, @212)) * 32 + datepart(day, @212) - (datepart(year, @213) * 12 + datepart(month, @213)) * 32 - datepart(day, @213)) / 32, @213), @212), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @214) * 12 + datepart(month, @214)) * 32 + datepart(day, @214) - (datepart(year, @215) * 12 + datepart(month, @215)) * 32 - datepart(day, @215)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @214) * 12 + datepart(month, @214)) * 32 + datepart(day, @214) - (datepart(year, @215) * 12 + datepart(month, @215)) * 32 - datepart(day, @215)) / 32, @215), @214), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @216) * 12 + datepart(month, @216)) * 32 + datepart(day, @216) - (datepart(year, @217) * 12 + datepart(month, @217)) * 32 - datepart(day, @217)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @216) * 12 + datepart(month, @216)) * 32 + datepart(day, @216) - (datepart(year, @217) * 12 + datepart(month, @217)) * 32 - datepart(day, @217)) / 32, @217), @216), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @218) * 12 + datepart(month, @218)) * 32 + datepart(day, @218) - (datepart(year, @219) * 12 + datepart(month, @219)) * 32 - datepart(day, @219)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @218) * 12 + datepart(month, @218)) * 32 + datepart(day, @218) - (datepart(year, @219) * 12 + datepart(month, @219)) * 32 - datepart(day, @219)) / 32, @219), @218), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @220) * 12 + datepart(month, @220)) * 32 + datepart(day, @220) - (datepart(year, @221) * 12 + datepart(month, @221)) * 32 - datepart(day, @221)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @220) * 12 + datepart(month, @220)) * 32 + datepart(day, @220) - (datepart(year, @221) * 12 + datepart(month, @221)) * 32 - datepart(day, @221)) / 32, @221), @220), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @222) * 12 + datepart(month, @222)) * 32 + datepart(day, @222) - (datepart(year, @223) * 12 + datepart(month, @223)) * 32 - datepart(day, @223)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @222) * 12 + datepart(month, @222)) * 32 + datepart(day, @222) - (datepart(year, @223) * 12 + datepart(month, @223)) * 32 - datepart(day, @223)) / 32, @223), @222), 0, 'hour') end, 2, 100) else case when substring(dbo.tsq_duration_text(0, ((datepart(year, @224) * 12 + datepart(month, @224)) * 32 + datepart(day, @224) - (datepart(year, @225) * 12 + datepart(month, @225)) * 32 - datepart(day, @225)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @224) * 12 + datepart(month, @224)) * 32 + datepart(day, @224) - (datepart(year, @225) * 12 + datepart(month, @225)) * 32 - datepart(day, @225)) / 32, @225), @224), 0, 'hour'), 1, 1) = '-' then substring(dbo.tsq_duration_text(0, ((datepart(year, @226) * 12 + datepart(month, @226)) * 32 + datepart(day, @226) - (datepart(year, @227) * 12 + datepart(month, @227)) * 32 - datepart(day, @227)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @226) * 12 + datepart(month, @226)) * 32 + datepart(day, @226) - (datepart(year, @227) * 12 + datepart(month, @227)) * 32 - datepart(day, @227)) / 32, @227), @226), 0, 'hour'), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_text(0, ((datepart(year, @228) * 12 + datepart(month, @228)) * 32 + datepart(day, @228) - (datepart(year, @229) * 12 + datepart(month, @229)) * 32 - datepart(day, @229)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @228) * 12 + datepart(month, @228)) * 32 + datepart(day, @228) - (datepart(year, @229) * 12 + datepart(month, @229)) * 32 - datepart(day, @229)) / 32, @229), @228), 0, 'hour'), 'sign') = 0 then dbo.tsq_duration_text(0, ((datepart(year, @230) * 12 + datepart(month, @230)) * 32 + datepart(day, @230) - (datepart(year, @231) * 12 + datepart(month, @231)) * 32 - datepart(day, @231)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @230) * 12 + datepart(month, @230)) * 32 + datepart(day, @230) - (datepart(year, @231) * 12 + datepart(month, @231)) * 32 - datepart(day, @231)) / 32, @231), @230), 0, 'hour') when substring(dbo.tsq_duration_text(0, ((datepart(year, @232) * 12 + datepart(month, @232)) * 32 + datepart(day, @232) - (datepart(year, @233) * 12 + datepart(month, @233)) * 32 - datepart(day, @233)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @232) * 12 + datepart(month, @232)) * 32 + datepart(day, @232) - (datepart(year, @233) * 12 + datepart(month, @233)) * 32 - datepart(day, @233)) / 32, @233), @232), 0, 'hour'), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_text(0, ((datepart(year, @234) * 12 + datepart(month, @234)) * 32 + datepart(day, @234) - (datepart(year, @235) * 12 + datepart(month, @235)) * 32 - datepart(day, @235)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @234) * 12 + datepart(month, @234)) * 32 + datepart(day, @234) - (datepart(year, @235) * 12 + datepart(month, @235)) * 32 - datepart(day, @235)) / 32, @235), @234), 0, 'hour'), 2, 100) else '-' + dbo.tsq_duration_text(0, ((datepart(year, @236) * 12 + datepart(month, @236)) * 32 + datepart(day, @236) - (datepart(year, @237) * 12 + datepart(month, @237)) * 32 - datepart(day, @237)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @236) * 12 + datepart(month, @236)) * 32 + datepart(day, @236) - (datepart(year, @237) * 12 + datepart(month, @237)) * 32 - datepart(day, @237)) / 32, @237), @236), 0, 'hour') end end, 'N'), datepart(year, @238), datepart(month, @238), datepart(day, @238), 'day') as total"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dbo.tsq_duration_part(dbo.tsq_duration_text(((datepart(year, @0) * 12 + datepart(month, @0)) * 32 + datepart(day, @0) - (datepart(year, @1) * 12 + datepart(month, @1)) * 32 - datepart(day, @1)) / 32 / 12, (((datepart(year, @0) * 12 + datepart(month, @0)) * 32 + datepart(day, @0) - (datepart(year, @1) * 12 + datepart(month, @1)) * 32 - datepart(day, @1)) / 32 % 12), 0, datediff(day, dateadd(month, ((datepart(year, @0) * 12 + datepart(month, @0)) * 32 + datepart(day, @0) - (datepart(year, @1) * 12 + datepart(month, @1)) * 32 - datepart(day, @1)) / 32, @1), @0), 0, 'hour'), 'years') as years, dbo.tsq_duration_part(dbo.tsq_duration_text(((datepart(year, @2) * 12 + datepart(month, @2)) * 32 + datepart(day, @2) - (datepart(year, @3) * 12 + datepart(month, @3)) * 32 - datepart(day, @3)) / 32 / 12, (((datepart(year, @2) * 12 + datepart(month, @2)) * 32 + datepart(day, @2) - (datepart(year, @3) * 12 + datepart(month, @3)) * 32 - datepart(day, @3)) / 32 % 12), 0, datediff(day, dateadd(month, ((datepart(year, @2) * 12 + datepart(month, @2)) * 32 + datepart(day, @2) - (datepart(year, @3) * 12 + datepart(month, @3)) * 32 - datepart(day, @3)) / 32, @3), @2), 0, 'hour'), 'months') as months, dbo.tsq_duration_part(dbo.tsq_duration_text(((datepart(year, @4) * 12 + datepart(month, @4)) * 32 + datepart(day, @4) - (datepart(year, @5) * 12 + datepart(month, @5)) * 32 - datepart(day, @5)) / 32 / 12, (((datepart(year, @4) * 12 + datepart(month, @4)) * 32 + datepart(day, @4) - (datepart(year, @5) * 12 + datepart(month, @5)) * 32 - datepart(day, @5)) / 32 % 12), 0, datediff(day, dateadd(month, ((datepart(year, @4) * 12 + datepart(month, @4)) * 32 + datepart(day, @4) - (datepart(year, @5) * 12 + datepart(month, @5)) * 32 - datepart(day, @5)) / 32, @5), @4), 0, 'hour'), 'days') as days, dbo.tsq_duration_part(dbo.tsq_duration_text(0, 0, 0, -datediff(day, @7, @6), 0, 'hour'), 'sign') as sign"`)
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
