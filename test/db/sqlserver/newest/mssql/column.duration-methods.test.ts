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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dbo.tsq_duration_part(case when substring(dbo.tsq_duration_round(datepart(year, @0), datepart(month, @0), datepart(day, @0), 0, datepart(year, @1), datepart(month, @1), datepart(day, @1), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @2), datepart(month, @2), datepart(day, @2), 0, datepart(year, @3), datepart(month, @3), datepart(day, @3), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @4), datepart(month, @4), datepart(day, @4), 0, datepart(year, @5), datepart(month, @5), datepart(day, @5), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @6), datepart(month, @6), datepart(day, @6), 0, datepart(year, @7), datepart(month, @7), datepart(day, @7), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @8), datepart(month, @8), datepart(day, @8), 0, datepart(year, @9), datepart(month, @9), datepart(day, @9), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @10), datepart(month, @10), datepart(day, @10), 0, datepart(year, @11), datepart(month, @11), datepart(day, @11), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @12), datepart(month, @12), datepart(day, @12), 0, datepart(year, @13), datepart(month, @13), datepart(day, @13), 0, 'month', 'day', 1, 'trunc', 1) end, 'months') as months, dbo.tsq_duration_part(case when substring(dbo.tsq_duration_round(datepart(year, @14), datepart(month, @14), datepart(day, @14), 0, datepart(year, @15), datepart(month, @15), datepart(day, @15), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @16), datepart(month, @16), datepart(day, @16), 0, datepart(year, @17), datepart(month, @17), datepart(day, @17), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @18), datepart(month, @18), datepart(day, @18), 0, datepart(year, @19), datepart(month, @19), datepart(day, @19), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @20), datepart(month, @20), datepart(day, @20), 0, datepart(year, @21), datepart(month, @21), datepart(day, @21), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @22), datepart(month, @22), datepart(day, @22), 0, datepart(year, @23), datepart(month, @23), datepart(day, @23), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @24), datepart(month, @24), datepart(day, @24), 0, datepart(year, @25), datepart(month, @25), datepart(day, @25), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @26), datepart(month, @26), datepart(day, @26), 0, datepart(year, @27), datepart(month, @27), datepart(day, @27), 0, 'month', 'day', 1, 'trunc', 1) end, 'days') as days, dbo.tsq_duration_total(dbo.tsq_duration_part(case when substring(case when substring(dbo.tsq_duration_round(datepart(year, @28), datepart(month, @28), datepart(day, @28), 0, datepart(year, @29), datepart(month, @29), datepart(day, @29), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @30), datepart(month, @30), datepart(day, @30), 0, datepart(year, @31), datepart(month, @31), datepart(day, @31), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @32), datepart(month, @32), datepart(day, @32), 0, datepart(year, @33), datepart(month, @33), datepart(day, @33), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @34), datepart(month, @34), datepart(day, @34), 0, datepart(year, @35), datepart(month, @35), datepart(day, @35), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @36), datepart(month, @36), datepart(day, @36), 0, datepart(year, @37), datepart(month, @37), datepart(day, @37), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @38), datepart(month, @38), datepart(day, @38), 0, datepart(year, @39), datepart(month, @39), datepart(day, @39), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @40), datepart(month, @40), datepart(day, @40), 0, datepart(year, @41), datepart(month, @41), datepart(day, @41), 0, 'month', 'day', 1, 'trunc', 1) end, 1, 1) in ('-', '+') then substring(case when substring(dbo.tsq_duration_round(datepart(year, @42), datepart(month, @42), datepart(day, @42), 0, datepart(year, @43), datepart(month, @43), datepart(day, @43), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @44), datepart(month, @44), datepart(day, @44), 0, datepart(year, @45), datepart(month, @45), datepart(day, @45), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @46), datepart(month, @46), datepart(day, @46), 0, datepart(year, @47), datepart(month, @47), datepart(day, @47), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @48), datepart(month, @48), datepart(day, @48), 0, datepart(year, @49), datepart(month, @49), datepart(day, @49), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @50), datepart(month, @50), datepart(day, @50), 0, datepart(year, @51), datepart(month, @51), datepart(day, @51), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @52), datepart(month, @52), datepart(day, @52), 0, datepart(year, @53), datepart(month, @53), datepart(day, @53), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @54), datepart(month, @54), datepart(day, @54), 0, datepart(year, @55), datepart(month, @55), datepart(day, @55), 0, 'month', 'day', 1, 'trunc', 1) end, 2, 100) else case when substring(dbo.tsq_duration_round(datepart(year, @56), datepart(month, @56), datepart(day, @56), 0, datepart(year, @57), datepart(month, @57), datepart(day, @57), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @58), datepart(month, @58), datepart(day, @58), 0, datepart(year, @59), datepart(month, @59), datepart(day, @59), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @60), datepart(month, @60), datepart(day, @60), 0, datepart(year, @61), datepart(month, @61), datepart(day, @61), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @62), datepart(month, @62), datepart(day, @62), 0, datepart(year, @63), datepart(month, @63), datepart(day, @63), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @64), datepart(month, @64), datepart(day, @64), 0, datepart(year, @65), datepart(month, @65), datepart(day, @65), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @66), datepart(month, @66), datepart(day, @66), 0, datepart(year, @67), datepart(month, @67), datepart(day, @67), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @68), datepart(month, @68), datepart(day, @68), 0, datepart(year, @69), datepart(month, @69), datepart(day, @69), 0, 'month', 'day', 1, 'trunc', 1) end end, 'M'), dbo.tsq_duration_part(case when substring(case when substring(dbo.tsq_duration_round(datepart(year, @70), datepart(month, @70), datepart(day, @70), 0, datepart(year, @71), datepart(month, @71), datepart(day, @71), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @72), datepart(month, @72), datepart(day, @72), 0, datepart(year, @73), datepart(month, @73), datepart(day, @73), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @74), datepart(month, @74), datepart(day, @74), 0, datepart(year, @75), datepart(month, @75), datepart(day, @75), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @76), datepart(month, @76), datepart(day, @76), 0, datepart(year, @77), datepart(month, @77), datepart(day, @77), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @78), datepart(month, @78), datepart(day, @78), 0, datepart(year, @79), datepart(month, @79), datepart(day, @79), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @80), datepart(month, @80), datepart(day, @80), 0, datepart(year, @81), datepart(month, @81), datepart(day, @81), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @82), datepart(month, @82), datepart(day, @82), 0, datepart(year, @83), datepart(month, @83), datepart(day, @83), 0, 'month', 'day', 1, 'trunc', 1) end, 1, 1) in ('-', '+') then substring(case when substring(dbo.tsq_duration_round(datepart(year, @84), datepart(month, @84), datepart(day, @84), 0, datepart(year, @85), datepart(month, @85), datepart(day, @85), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @86), datepart(month, @86), datepart(day, @86), 0, datepart(year, @87), datepart(month, @87), datepart(day, @87), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @88), datepart(month, @88), datepart(day, @88), 0, datepart(year, @89), datepart(month, @89), datepart(day, @89), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @90), datepart(month, @90), datepart(day, @90), 0, datepart(year, @91), datepart(month, @91), datepart(day, @91), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @92), datepart(month, @92), datepart(day, @92), 0, datepart(year, @93), datepart(month, @93), datepart(day, @93), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @94), datepart(month, @94), datepart(day, @94), 0, datepart(year, @95), datepart(month, @95), datepart(day, @95), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @96), datepart(month, @96), datepart(day, @96), 0, datepart(year, @97), datepart(month, @97), datepart(day, @97), 0, 'month', 'day', 1, 'trunc', 1) end, 2, 100) else case when substring(dbo.tsq_duration_round(datepart(year, @98), datepart(month, @98), datepart(day, @98), 0, datepart(year, @99), datepart(month, @99), datepart(day, @99), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @100), datepart(month, @100), datepart(day, @100), 0, datepart(year, @101), datepart(month, @101), datepart(day, @101), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @102), datepart(month, @102), datepart(day, @102), 0, datepart(year, @103), datepart(month, @103), datepart(day, @103), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @104), datepart(month, @104), datepart(day, @104), 0, datepart(year, @105), datepart(month, @105), datepart(day, @105), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @106), datepart(month, @106), datepart(day, @106), 0, datepart(year, @107), datepart(month, @107), datepart(day, @107), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @108), datepart(month, @108), datepart(day, @108), 0, datepart(year, @109), datepart(month, @109), datepart(day, @109), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @110), datepart(month, @110), datepart(day, @110), 0, datepart(year, @111), datepart(month, @111), datepart(day, @111), 0, 'month', 'day', 1, 'trunc', 1) end end, 'weeks'), dbo.tsq_duration_part(case when substring(case when substring(dbo.tsq_duration_round(datepart(year, @112), datepart(month, @112), datepart(day, @112), 0, datepart(year, @113), datepart(month, @113), datepart(day, @113), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @114), datepart(month, @114), datepart(day, @114), 0, datepart(year, @115), datepart(month, @115), datepart(day, @115), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @116), datepart(month, @116), datepart(day, @116), 0, datepart(year, @117), datepart(month, @117), datepart(day, @117), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @118), datepart(month, @118), datepart(day, @118), 0, datepart(year, @119), datepart(month, @119), datepart(day, @119), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @120), datepart(month, @120), datepart(day, @120), 0, datepart(year, @121), datepart(month, @121), datepart(day, @121), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @122), datepart(month, @122), datepart(day, @122), 0, datepart(year, @123), datepart(month, @123), datepart(day, @123), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @124), datepart(month, @124), datepart(day, @124), 0, datepart(year, @125), datepart(month, @125), datepart(day, @125), 0, 'month', 'day', 1, 'trunc', 1) end, 1, 1) in ('-', '+') then substring(case when substring(dbo.tsq_duration_round(datepart(year, @126), datepart(month, @126), datepart(day, @126), 0, datepart(year, @127), datepart(month, @127), datepart(day, @127), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @128), datepart(month, @128), datepart(day, @128), 0, datepart(year, @129), datepart(month, @129), datepart(day, @129), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @130), datepart(month, @130), datepart(day, @130), 0, datepart(year, @131), datepart(month, @131), datepart(day, @131), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @132), datepart(month, @132), datepart(day, @132), 0, datepart(year, @133), datepart(month, @133), datepart(day, @133), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @134), datepart(month, @134), datepart(day, @134), 0, datepart(year, @135), datepart(month, @135), datepart(day, @135), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @136), datepart(month, @136), datepart(day, @136), 0, datepart(year, @137), datepart(month, @137), datepart(day, @137), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @138), datepart(month, @138), datepart(day, @138), 0, datepart(year, @139), datepart(month, @139), datepart(day, @139), 0, 'month', 'day', 1, 'trunc', 1) end, 2, 100) else case when substring(dbo.tsq_duration_round(datepart(year, @140), datepart(month, @140), datepart(day, @140), 0, datepart(year, @141), datepart(month, @141), datepart(day, @141), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @142), datepart(month, @142), datepart(day, @142), 0, datepart(year, @143), datepart(month, @143), datepart(day, @143), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @144), datepart(month, @144), datepart(day, @144), 0, datepart(year, @145), datepart(month, @145), datepart(day, @145), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @146), datepart(month, @146), datepart(day, @146), 0, datepart(year, @147), datepart(month, @147), datepart(day, @147), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @148), datepart(month, @148), datepart(day, @148), 0, datepart(year, @149), datepart(month, @149), datepart(day, @149), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @150), datepart(month, @150), datepart(day, @150), 0, datepart(year, @151), datepart(month, @151), datepart(day, @151), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @152), datepart(month, @152), datepart(day, @152), 0, datepart(year, @153), datepart(month, @153), datepart(day, @153), 0, 'month', 'day', 1, 'trunc', 1) end end, 'days'), dbo.tsq_duration_part(case when substring(case when substring(dbo.tsq_duration_round(datepart(year, @154), datepart(month, @154), datepart(day, @154), 0, datepart(year, @155), datepart(month, @155), datepart(day, @155), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @156), datepart(month, @156), datepart(day, @156), 0, datepart(year, @157), datepart(month, @157), datepart(day, @157), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @158), datepart(month, @158), datepart(day, @158), 0, datepart(year, @159), datepart(month, @159), datepart(day, @159), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @160), datepart(month, @160), datepart(day, @160), 0, datepart(year, @161), datepart(month, @161), datepart(day, @161), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @162), datepart(month, @162), datepart(day, @162), 0, datepart(year, @163), datepart(month, @163), datepart(day, @163), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @164), datepart(month, @164), datepart(day, @164), 0, datepart(year, @165), datepart(month, @165), datepart(day, @165), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @166), datepart(month, @166), datepart(day, @166), 0, datepart(year, @167), datepart(month, @167), datepart(day, @167), 0, 'month', 'day', 1, 'trunc', 1) end, 1, 1) in ('-', '+') then substring(case when substring(dbo.tsq_duration_round(datepart(year, @168), datepart(month, @168), datepart(day, @168), 0, datepart(year, @169), datepart(month, @169), datepart(day, @169), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @170), datepart(month, @170), datepart(day, @170), 0, datepart(year, @171), datepart(month, @171), datepart(day, @171), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @172), datepart(month, @172), datepart(day, @172), 0, datepart(year, @173), datepart(month, @173), datepart(day, @173), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @174), datepart(month, @174), datepart(day, @174), 0, datepart(year, @175), datepart(month, @175), datepart(day, @175), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @176), datepart(month, @176), datepart(day, @176), 0, datepart(year, @177), datepart(month, @177), datepart(day, @177), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @178), datepart(month, @178), datepart(day, @178), 0, datepart(year, @179), datepart(month, @179), datepart(day, @179), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @180), datepart(month, @180), datepart(day, @180), 0, datepart(year, @181), datepart(month, @181), datepart(day, @181), 0, 'month', 'day', 1, 'trunc', 1) end, 2, 100) else case when substring(dbo.tsq_duration_round(datepart(year, @182), datepart(month, @182), datepart(day, @182), 0, datepart(year, @183), datepart(month, @183), datepart(day, @183), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @184), datepart(month, @184), datepart(day, @184), 0, datepart(year, @185), datepart(month, @185), datepart(day, @185), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @186), datepart(month, @186), datepart(day, @186), 0, datepart(year, @187), datepart(month, @187), datepart(day, @187), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @188), datepart(month, @188), datepart(day, @188), 0, datepart(year, @189), datepart(month, @189), datepart(day, @189), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @190), datepart(month, @190), datepart(day, @190), 0, datepart(year, @191), datepart(month, @191), datepart(day, @191), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @192), datepart(month, @192), datepart(day, @192), 0, datepart(year, @193), datepart(month, @193), datepart(day, @193), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @194), datepart(month, @194), datepart(day, @194), 0, datepart(year, @195), datepart(month, @195), datepart(day, @195), 0, 'month', 'day', 1, 'trunc', 1) end end, 'S'), dbo.tsq_duration_part(case when substring(case when substring(dbo.tsq_duration_round(datepart(year, @196), datepart(month, @196), datepart(day, @196), 0, datepart(year, @197), datepart(month, @197), datepart(day, @197), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @198), datepart(month, @198), datepart(day, @198), 0, datepart(year, @199), datepart(month, @199), datepart(day, @199), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @200), datepart(month, @200), datepart(day, @200), 0, datepart(year, @201), datepart(month, @201), datepart(day, @201), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @202), datepart(month, @202), datepart(day, @202), 0, datepart(year, @203), datepart(month, @203), datepart(day, @203), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @204), datepart(month, @204), datepart(day, @204), 0, datepart(year, @205), datepart(month, @205), datepart(day, @205), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @206), datepart(month, @206), datepart(day, @206), 0, datepart(year, @207), datepart(month, @207), datepart(day, @207), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @208), datepart(month, @208), datepart(day, @208), 0, datepart(year, @209), datepart(month, @209), datepart(day, @209), 0, 'month', 'day', 1, 'trunc', 1) end, 1, 1) in ('-', '+') then substring(case when substring(dbo.tsq_duration_round(datepart(year, @210), datepart(month, @210), datepart(day, @210), 0, datepart(year, @211), datepart(month, @211), datepart(day, @211), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @212), datepart(month, @212), datepart(day, @212), 0, datepart(year, @213), datepart(month, @213), datepart(day, @213), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @214), datepart(month, @214), datepart(day, @214), 0, datepart(year, @215), datepart(month, @215), datepart(day, @215), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @216), datepart(month, @216), datepart(day, @216), 0, datepart(year, @217), datepart(month, @217), datepart(day, @217), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @218), datepart(month, @218), datepart(day, @218), 0, datepart(year, @219), datepart(month, @219), datepart(day, @219), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @220), datepart(month, @220), datepart(day, @220), 0, datepart(year, @221), datepart(month, @221), datepart(day, @221), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @222), datepart(month, @222), datepart(day, @222), 0, datepart(year, @223), datepart(month, @223), datepart(day, @223), 0, 'month', 'day', 1, 'trunc', 1) end, 2, 100) else case when substring(dbo.tsq_duration_round(datepart(year, @224), datepart(month, @224), datepart(day, @224), 0, datepart(year, @225), datepart(month, @225), datepart(day, @225), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substring(dbo.tsq_duration_round(datepart(year, @226), datepart(month, @226), datepart(day, @226), 0, datepart(year, @227), datepart(month, @227), datepart(day, @227), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) when dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @228), datepart(month, @228), datepart(day, @228), 0, datepart(year, @229), datepart(month, @229), datepart(day, @229), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then dbo.tsq_duration_round(datepart(year, @230), datepart(month, @230), datepart(day, @230), 0, datepart(year, @231), datepart(month, @231), datepart(day, @231), 0, 'month', 'day', 1, 'trunc', 1) when substring(dbo.tsq_duration_round(datepart(year, @232), datepart(month, @232), datepart(day, @232), 0, datepart(year, @233), datepart(month, @233), datepart(day, @233), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' + substring(dbo.tsq_duration_round(datepart(year, @234), datepart(month, @234), datepart(day, @234), 0, datepart(year, @235), datepart(month, @235), datepart(day, @235), 0, 'month', 'day', 1, 'trunc', 1), 2, 100) else '-' + dbo.tsq_duration_round(datepart(year, @236), datepart(month, @236), datepart(day, @236), 0, datepart(year, @237), datepart(month, @237), datepart(day, @237), 0, 'month', 'day', 1, 'trunc', 1) end end, 'N'), datepart(year, @238), datepart(month, @238), datepart(day, @238), 'day') as total"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
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
            "2024-03-30",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @0), datepart(month, @0), datepart(day, @0), 0, datepart(year, @1), datepart(month, @1), datepart(day, @1), 0, 'year', 'day', 1, 'trunc', 1), 'years') as years, dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @2), datepart(month, @2), datepart(day, @2), 0, datepart(year, @3), datepart(month, @3), datepart(day, @3), 0, 'year', 'day', 1, 'trunc', 1), 'months') as months, dbo.tsq_duration_part(dbo.tsq_duration_round(datepart(year, @4), datepart(month, @4), datepart(day, @4), 0, datepart(year, @5), datepart(month, @5), datepart(day, @5), 0, 'year', 'day', 1, 'trunc', 1), 'days') as days, dbo.tsq_duration_part(dbo.tsq_duration_text(0, 0, 0, -datediff(day, @7, @6), 0, 'day'), 'sign') as sign"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-31",
            "2025-03-30",
            "2024-01-31",
            "2025-03-30",
            "2024-01-31",
            "2025-03-30",
            "2025-03-30",
            "2024-01-31",
          ]
        `)
        expect([row.years, row.months, row.days, row.sign]).toEqual([1, 1, 30, -1])
    })
})
