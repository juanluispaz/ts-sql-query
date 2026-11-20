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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_part(span_text, 'years') as years, tsq_duration_part(span_text, 'months') as months, tsq_duration_part(span_text, 'weeks') as weeks, tsq_duration_part(span_text, 'days') as days, tsq_duration_part(span_text, 'hours') as hours, tsq_duration_part(span_text, 'minutes') as minutes, tsq_duration_part(span_text, 'seconds') as seconds, (cast(tsq_duration_part(span_text, 'N') / 1000000 as integer)) as milliseconds, (cast(tsq_duration_part(span_text, 'N') / 1000 as integer) % 1000) as microseconds, (tsq_duration_part(span_text, 'N') % 1000) as nanoseconds from duration_value order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_part(span, 'days') as days, tsq_duration_part(span, 'hours') as hours, tsq_duration_part(span, 'minutes') as minutes, tsq_duration_part(span, 'seconds') as seconds, (cast(tsq_duration_part(span, 'N') / 1000000 as integer)) as milliseconds from duration_value order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_part(span, 'sign') as sign, tsq_duration_part(span_text, 'sign') as textSign, case when substr(span, 1, 1) = '-' then substr(span, 2) when tsq_duration_part(span, 'sign') = 0 then span when substr(span, 1, 1) = '+' then '-' || substr(span, 2) else '-' || span end as negated, case when substr(span_text, 1, 1) = '-' then substr(span_text, 2) when tsq_duration_part(span_text, 'sign') = 0 then span_text when substr(span_text, 1, 1) = '+' then '-' || substr(span_text, 2) else '-' || span_text end as textNegated, case when substr(span, 1, 1) in ('-', '+') then substr(span, 2) else span end as abs, case when substr(span_text, 1, 1) in ('-', '+') then substr(span_text, 2) else span_text end as textAbs from duration_value order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_part(case when substr(span_text, 1, 1) = '-' then substr(span_text, 2) when tsq_duration_part(span_text, 'sign') = 0 then span_text when substr(span_text, 1, 1) = '+' then '-' || substr(span_text, 2) else '-' || span_text end, 'hours') as hours, tsq_duration_part(case when substr(span_text, 1, 1) = '-' then substr(span_text, 2) when tsq_duration_part(span_text, 'sign') = 0 then span_text when substr(span_text, 1, 1) = '+' then '-' || substr(span_text, 2) else '-' || span_text end, 'minutes') as minutes, tsq_duration_total(tsq_duration_part(case when substr(span_text, 1, 1) in ('-', '+') then substr(span_text, 2) else span_text end, 'M'), tsq_duration_part(case when substr(span_text, 1, 1) in ('-', '+') then substr(span_text, 2) else span_text end, 'weeks'), tsq_duration_part(case when substr(span_text, 1, 1) in ('-', '+') then substr(span_text, 2) else span_text end, 'days'), tsq_duration_part(case when substr(span_text, 1, 1) in ('-', '+') then substr(span_text, 2) else span_text end, 'S'), tsq_duration_part(case when substr(span_text, 1, 1) in ('-', '+') then substr(span_text, 2) else span_text end, 'N'), 0, 0, 0, 'minute') as total from duration_value where id > ?1 order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select tsq_duration_part(case when substr(tsq_duration_round(cast(strftime('%Y', ?1) as integer), cast(strftime('%m', ?1) as integer), cast(strftime('%d', ?1) as integer), 0, cast(strftime('%Y', ?2) as integer), cast(strftime('%m', ?2) as integer), cast(strftime('%d', ?2) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?3) as integer), cast(strftime('%m', ?3) as integer), cast(strftime('%d', ?3) as integer), 0, cast(strftime('%Y', ?4) as integer), cast(strftime('%m', ?4) as integer), cast(strftime('%d', ?4) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?5) as integer), cast(strftime('%m', ?5) as integer), cast(strftime('%d', ?5) as integer), 0, cast(strftime('%Y', ?6) as integer), cast(strftime('%m', ?6) as integer), cast(strftime('%d', ?6) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?7) as integer), cast(strftime('%m', ?7) as integer), cast(strftime('%d', ?7) as integer), 0, cast(strftime('%Y', ?8) as integer), cast(strftime('%m', ?8) as integer), cast(strftime('%d', ?8) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?9) as integer), cast(strftime('%m', ?9) as integer), cast(strftime('%d', ?9) as integer), 0, cast(strftime('%Y', ?10) as integer), cast(strftime('%m', ?10) as integer), cast(strftime('%d', ?10) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?11) as integer), cast(strftime('%m', ?11) as integer), cast(strftime('%d', ?11) as integer), 0, cast(strftime('%Y', ?12) as integer), cast(strftime('%m', ?12) as integer), cast(strftime('%d', ?12) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?13) as integer), cast(strftime('%m', ?13) as integer), cast(strftime('%d', ?13) as integer), 0, cast(strftime('%Y', ?14) as integer), cast(strftime('%m', ?14) as integer), cast(strftime('%d', ?14) as integer), 0, 'month', 'day', 1, 'trunc', 1) end, 'months') as months, tsq_duration_part(case when substr(tsq_duration_round(cast(strftime('%Y', ?15) as integer), cast(strftime('%m', ?15) as integer), cast(strftime('%d', ?15) as integer), 0, cast(strftime('%Y', ?16) as integer), cast(strftime('%m', ?16) as integer), cast(strftime('%d', ?16) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?17) as integer), cast(strftime('%m', ?17) as integer), cast(strftime('%d', ?17) as integer), 0, cast(strftime('%Y', ?18) as integer), cast(strftime('%m', ?18) as integer), cast(strftime('%d', ?18) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?19) as integer), cast(strftime('%m', ?19) as integer), cast(strftime('%d', ?19) as integer), 0, cast(strftime('%Y', ?20) as integer), cast(strftime('%m', ?20) as integer), cast(strftime('%d', ?20) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?21) as integer), cast(strftime('%m', ?21) as integer), cast(strftime('%d', ?21) as integer), 0, cast(strftime('%Y', ?22) as integer), cast(strftime('%m', ?22) as integer), cast(strftime('%d', ?22) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?23) as integer), cast(strftime('%m', ?23) as integer), cast(strftime('%d', ?23) as integer), 0, cast(strftime('%Y', ?24) as integer), cast(strftime('%m', ?24) as integer), cast(strftime('%d', ?24) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?25) as integer), cast(strftime('%m', ?25) as integer), cast(strftime('%d', ?25) as integer), 0, cast(strftime('%Y', ?26) as integer), cast(strftime('%m', ?26) as integer), cast(strftime('%d', ?26) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?27) as integer), cast(strftime('%m', ?27) as integer), cast(strftime('%d', ?27) as integer), 0, cast(strftime('%Y', ?28) as integer), cast(strftime('%m', ?28) as integer), cast(strftime('%d', ?28) as integer), 0, 'month', 'day', 1, 'trunc', 1) end, 'days') as days, tsq_duration_total(tsq_duration_part(case when substr(case when substr(tsq_duration_round(cast(strftime('%Y', ?29) as integer), cast(strftime('%m', ?29) as integer), cast(strftime('%d', ?29) as integer), 0, cast(strftime('%Y', ?30) as integer), cast(strftime('%m', ?30) as integer), cast(strftime('%d', ?30) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?31) as integer), cast(strftime('%m', ?31) as integer), cast(strftime('%d', ?31) as integer), 0, cast(strftime('%Y', ?32) as integer), cast(strftime('%m', ?32) as integer), cast(strftime('%d', ?32) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?33) as integer), cast(strftime('%m', ?33) as integer), cast(strftime('%d', ?33) as integer), 0, cast(strftime('%Y', ?34) as integer), cast(strftime('%m', ?34) as integer), cast(strftime('%d', ?34) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?35) as integer), cast(strftime('%m', ?35) as integer), cast(strftime('%d', ?35) as integer), 0, cast(strftime('%Y', ?36) as integer), cast(strftime('%m', ?36) as integer), cast(strftime('%d', ?36) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?37) as integer), cast(strftime('%m', ?37) as integer), cast(strftime('%d', ?37) as integer), 0, cast(strftime('%Y', ?38) as integer), cast(strftime('%m', ?38) as integer), cast(strftime('%d', ?38) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?39) as integer), cast(strftime('%m', ?39) as integer), cast(strftime('%d', ?39) as integer), 0, cast(strftime('%Y', ?40) as integer), cast(strftime('%m', ?40) as integer), cast(strftime('%d', ?40) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?41) as integer), cast(strftime('%m', ?41) as integer), cast(strftime('%d', ?41) as integer), 0, cast(strftime('%Y', ?42) as integer), cast(strftime('%m', ?42) as integer), cast(strftime('%d', ?42) as integer), 0, 'month', 'day', 1, 'trunc', 1) end, 1, 1) in ('-', '+') then substr(case when substr(tsq_duration_round(cast(strftime('%Y', ?43) as integer), cast(strftime('%m', ?43) as integer), cast(strftime('%d', ?43) as integer), 0, cast(strftime('%Y', ?44) as integer), cast(strftime('%m', ?44) as integer), cast(strftime('%d', ?44) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?45) as integer), cast(strftime('%m', ?45) as integer), cast(strftime('%d', ?45) as integer), 0, cast(strftime('%Y', ?46) as integer), cast(strftime('%m', ?46) as integer), cast(strftime('%d', ?46) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?47) as integer), cast(strftime('%m', ?47) as integer), cast(strftime('%d', ?47) as integer), 0, cast(strftime('%Y', ?48) as integer), cast(strftime('%m', ?48) as integer), cast(strftime('%d', ?48) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?49) as integer), cast(strftime('%m', ?49) as integer), cast(strftime('%d', ?49) as integer), 0, cast(strftime('%Y', ?50) as integer), cast(strftime('%m', ?50) as integer), cast(strftime('%d', ?50) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?51) as integer), cast(strftime('%m', ?51) as integer), cast(strftime('%d', ?51) as integer), 0, cast(strftime('%Y', ?52) as integer), cast(strftime('%m', ?52) as integer), cast(strftime('%d', ?52) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?53) as integer), cast(strftime('%m', ?53) as integer), cast(strftime('%d', ?53) as integer), 0, cast(strftime('%Y', ?54) as integer), cast(strftime('%m', ?54) as integer), cast(strftime('%d', ?54) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?55) as integer), cast(strftime('%m', ?55) as integer), cast(strftime('%d', ?55) as integer), 0, cast(strftime('%Y', ?56) as integer), cast(strftime('%m', ?56) as integer), cast(strftime('%d', ?56) as integer), 0, 'month', 'day', 1, 'trunc', 1) end, 2) else case when substr(tsq_duration_round(cast(strftime('%Y', ?57) as integer), cast(strftime('%m', ?57) as integer), cast(strftime('%d', ?57) as integer), 0, cast(strftime('%Y', ?58) as integer), cast(strftime('%m', ?58) as integer), cast(strftime('%d', ?58) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?59) as integer), cast(strftime('%m', ?59) as integer), cast(strftime('%d', ?59) as integer), 0, cast(strftime('%Y', ?60) as integer), cast(strftime('%m', ?60) as integer), cast(strftime('%d', ?60) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?61) as integer), cast(strftime('%m', ?61) as integer), cast(strftime('%d', ?61) as integer), 0, cast(strftime('%Y', ?62) as integer), cast(strftime('%m', ?62) as integer), cast(strftime('%d', ?62) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?63) as integer), cast(strftime('%m', ?63) as integer), cast(strftime('%d', ?63) as integer), 0, cast(strftime('%Y', ?64) as integer), cast(strftime('%m', ?64) as integer), cast(strftime('%d', ?64) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?65) as integer), cast(strftime('%m', ?65) as integer), cast(strftime('%d', ?65) as integer), 0, cast(strftime('%Y', ?66) as integer), cast(strftime('%m', ?66) as integer), cast(strftime('%d', ?66) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?67) as integer), cast(strftime('%m', ?67) as integer), cast(strftime('%d', ?67) as integer), 0, cast(strftime('%Y', ?68) as integer), cast(strftime('%m', ?68) as integer), cast(strftime('%d', ?68) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?69) as integer), cast(strftime('%m', ?69) as integer), cast(strftime('%d', ?69) as integer), 0, cast(strftime('%Y', ?70) as integer), cast(strftime('%m', ?70) as integer), cast(strftime('%d', ?70) as integer), 0, 'month', 'day', 1, 'trunc', 1) end end, 'M'), tsq_duration_part(case when substr(case when substr(tsq_duration_round(cast(strftime('%Y', ?71) as integer), cast(strftime('%m', ?71) as integer), cast(strftime('%d', ?71) as integer), 0, cast(strftime('%Y', ?72) as integer), cast(strftime('%m', ?72) as integer), cast(strftime('%d', ?72) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?73) as integer), cast(strftime('%m', ?73) as integer), cast(strftime('%d', ?73) as integer), 0, cast(strftime('%Y', ?74) as integer), cast(strftime('%m', ?74) as integer), cast(strftime('%d', ?74) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?75) as integer), cast(strftime('%m', ?75) as integer), cast(strftime('%d', ?75) as integer), 0, cast(strftime('%Y', ?76) as integer), cast(strftime('%m', ?76) as integer), cast(strftime('%d', ?76) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?77) as integer), cast(strftime('%m', ?77) as integer), cast(strftime('%d', ?77) as integer), 0, cast(strftime('%Y', ?78) as integer), cast(strftime('%m', ?78) as integer), cast(strftime('%d', ?78) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?79) as integer), cast(strftime('%m', ?79) as integer), cast(strftime('%d', ?79) as integer), 0, cast(strftime('%Y', ?80) as integer), cast(strftime('%m', ?80) as integer), cast(strftime('%d', ?80) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?81) as integer), cast(strftime('%m', ?81) as integer), cast(strftime('%d', ?81) as integer), 0, cast(strftime('%Y', ?82) as integer), cast(strftime('%m', ?82) as integer), cast(strftime('%d', ?82) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?83) as integer), cast(strftime('%m', ?83) as integer), cast(strftime('%d', ?83) as integer), 0, cast(strftime('%Y', ?84) as integer), cast(strftime('%m', ?84) as integer), cast(strftime('%d', ?84) as integer), 0, 'month', 'day', 1, 'trunc', 1) end, 1, 1) in ('-', '+') then substr(case when substr(tsq_duration_round(cast(strftime('%Y', ?85) as integer), cast(strftime('%m', ?85) as integer), cast(strftime('%d', ?85) as integer), 0, cast(strftime('%Y', ?86) as integer), cast(strftime('%m', ?86) as integer), cast(strftime('%d', ?86) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?87) as integer), cast(strftime('%m', ?87) as integer), cast(strftime('%d', ?87) as integer), 0, cast(strftime('%Y', ?88) as integer), cast(strftime('%m', ?88) as integer), cast(strftime('%d', ?88) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?89) as integer), cast(strftime('%m', ?89) as integer), cast(strftime('%d', ?89) as integer), 0, cast(strftime('%Y', ?90) as integer), cast(strftime('%m', ?90) as integer), cast(strftime('%d', ?90) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?91) as integer), cast(strftime('%m', ?91) as integer), cast(strftime('%d', ?91) as integer), 0, cast(strftime('%Y', ?92) as integer), cast(strftime('%m', ?92) as integer), cast(strftime('%d', ?92) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?93) as integer), cast(strftime('%m', ?93) as integer), cast(strftime('%d', ?93) as integer), 0, cast(strftime('%Y', ?94) as integer), cast(strftime('%m', ?94) as integer), cast(strftime('%d', ?94) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?95) as integer), cast(strftime('%m', ?95) as integer), cast(strftime('%d', ?95) as integer), 0, cast(strftime('%Y', ?96) as integer), cast(strftime('%m', ?96) as integer), cast(strftime('%d', ?96) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?97) as integer), cast(strftime('%m', ?97) as integer), cast(strftime('%d', ?97) as integer), 0, cast(strftime('%Y', ?98) as integer), cast(strftime('%m', ?98) as integer), cast(strftime('%d', ?98) as integer), 0, 'month', 'day', 1, 'trunc', 1) end, 2) else case when substr(tsq_duration_round(cast(strftime('%Y', ?99) as integer), cast(strftime('%m', ?99) as integer), cast(strftime('%d', ?99) as integer), 0, cast(strftime('%Y', ?100) as integer), cast(strftime('%m', ?100) as integer), cast(strftime('%d', ?100) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?101) as integer), cast(strftime('%m', ?101) as integer), cast(strftime('%d', ?101) as integer), 0, cast(strftime('%Y', ?102) as integer), cast(strftime('%m', ?102) as integer), cast(strftime('%d', ?102) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?103) as integer), cast(strftime('%m', ?103) as integer), cast(strftime('%d', ?103) as integer), 0, cast(strftime('%Y', ?104) as integer), cast(strftime('%m', ?104) as integer), cast(strftime('%d', ?104) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?105) as integer), cast(strftime('%m', ?105) as integer), cast(strftime('%d', ?105) as integer), 0, cast(strftime('%Y', ?106) as integer), cast(strftime('%m', ?106) as integer), cast(strftime('%d', ?106) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?107) as integer), cast(strftime('%m', ?107) as integer), cast(strftime('%d', ?107) as integer), 0, cast(strftime('%Y', ?108) as integer), cast(strftime('%m', ?108) as integer), cast(strftime('%d', ?108) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?109) as integer), cast(strftime('%m', ?109) as integer), cast(strftime('%d', ?109) as integer), 0, cast(strftime('%Y', ?110) as integer), cast(strftime('%m', ?110) as integer), cast(strftime('%d', ?110) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?111) as integer), cast(strftime('%m', ?111) as integer), cast(strftime('%d', ?111) as integer), 0, cast(strftime('%Y', ?112) as integer), cast(strftime('%m', ?112) as integer), cast(strftime('%d', ?112) as integer), 0, 'month', 'day', 1, 'trunc', 1) end end, 'weeks'), tsq_duration_part(case when substr(case when substr(tsq_duration_round(cast(strftime('%Y', ?113) as integer), cast(strftime('%m', ?113) as integer), cast(strftime('%d', ?113) as integer), 0, cast(strftime('%Y', ?114) as integer), cast(strftime('%m', ?114) as integer), cast(strftime('%d', ?114) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?115) as integer), cast(strftime('%m', ?115) as integer), cast(strftime('%d', ?115) as integer), 0, cast(strftime('%Y', ?116) as integer), cast(strftime('%m', ?116) as integer), cast(strftime('%d', ?116) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?117) as integer), cast(strftime('%m', ?117) as integer), cast(strftime('%d', ?117) as integer), 0, cast(strftime('%Y', ?118) as integer), cast(strftime('%m', ?118) as integer), cast(strftime('%d', ?118) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?119) as integer), cast(strftime('%m', ?119) as integer), cast(strftime('%d', ?119) as integer), 0, cast(strftime('%Y', ?120) as integer), cast(strftime('%m', ?120) as integer), cast(strftime('%d', ?120) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?121) as integer), cast(strftime('%m', ?121) as integer), cast(strftime('%d', ?121) as integer), 0, cast(strftime('%Y', ?122) as integer), cast(strftime('%m', ?122) as integer), cast(strftime('%d', ?122) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?123) as integer), cast(strftime('%m', ?123) as integer), cast(strftime('%d', ?123) as integer), 0, cast(strftime('%Y', ?124) as integer), cast(strftime('%m', ?124) as integer), cast(strftime('%d', ?124) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?125) as integer), cast(strftime('%m', ?125) as integer), cast(strftime('%d', ?125) as integer), 0, cast(strftime('%Y', ?126) as integer), cast(strftime('%m', ?126) as integer), cast(strftime('%d', ?126) as integer), 0, 'month', 'day', 1, 'trunc', 1) end, 1, 1) in ('-', '+') then substr(case when substr(tsq_duration_round(cast(strftime('%Y', ?127) as integer), cast(strftime('%m', ?127) as integer), cast(strftime('%d', ?127) as integer), 0, cast(strftime('%Y', ?128) as integer), cast(strftime('%m', ?128) as integer), cast(strftime('%d', ?128) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?129) as integer), cast(strftime('%m', ?129) as integer), cast(strftime('%d', ?129) as integer), 0, cast(strftime('%Y', ?130) as integer), cast(strftime('%m', ?130) as integer), cast(strftime('%d', ?130) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?131) as integer), cast(strftime('%m', ?131) as integer), cast(strftime('%d', ?131) as integer), 0, cast(strftime('%Y', ?132) as integer), cast(strftime('%m', ?132) as integer), cast(strftime('%d', ?132) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?133) as integer), cast(strftime('%m', ?133) as integer), cast(strftime('%d', ?133) as integer), 0, cast(strftime('%Y', ?134) as integer), cast(strftime('%m', ?134) as integer), cast(strftime('%d', ?134) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?135) as integer), cast(strftime('%m', ?135) as integer), cast(strftime('%d', ?135) as integer), 0, cast(strftime('%Y', ?136) as integer), cast(strftime('%m', ?136) as integer), cast(strftime('%d', ?136) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?137) as integer), cast(strftime('%m', ?137) as integer), cast(strftime('%d', ?137) as integer), 0, cast(strftime('%Y', ?138) as integer), cast(strftime('%m', ?138) as integer), cast(strftime('%d', ?138) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?139) as integer), cast(strftime('%m', ?139) as integer), cast(strftime('%d', ?139) as integer), 0, cast(strftime('%Y', ?140) as integer), cast(strftime('%m', ?140) as integer), cast(strftime('%d', ?140) as integer), 0, 'month', 'day', 1, 'trunc', 1) end, 2) else case when substr(tsq_duration_round(cast(strftime('%Y', ?141) as integer), cast(strftime('%m', ?141) as integer), cast(strftime('%d', ?141) as integer), 0, cast(strftime('%Y', ?142) as integer), cast(strftime('%m', ?142) as integer), cast(strftime('%d', ?142) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?143) as integer), cast(strftime('%m', ?143) as integer), cast(strftime('%d', ?143) as integer), 0, cast(strftime('%Y', ?144) as integer), cast(strftime('%m', ?144) as integer), cast(strftime('%d', ?144) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?145) as integer), cast(strftime('%m', ?145) as integer), cast(strftime('%d', ?145) as integer), 0, cast(strftime('%Y', ?146) as integer), cast(strftime('%m', ?146) as integer), cast(strftime('%d', ?146) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?147) as integer), cast(strftime('%m', ?147) as integer), cast(strftime('%d', ?147) as integer), 0, cast(strftime('%Y', ?148) as integer), cast(strftime('%m', ?148) as integer), cast(strftime('%d', ?148) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?149) as integer), cast(strftime('%m', ?149) as integer), cast(strftime('%d', ?149) as integer), 0, cast(strftime('%Y', ?150) as integer), cast(strftime('%m', ?150) as integer), cast(strftime('%d', ?150) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?151) as integer), cast(strftime('%m', ?151) as integer), cast(strftime('%d', ?151) as integer), 0, cast(strftime('%Y', ?152) as integer), cast(strftime('%m', ?152) as integer), cast(strftime('%d', ?152) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?153) as integer), cast(strftime('%m', ?153) as integer), cast(strftime('%d', ?153) as integer), 0, cast(strftime('%Y', ?154) as integer), cast(strftime('%m', ?154) as integer), cast(strftime('%d', ?154) as integer), 0, 'month', 'day', 1, 'trunc', 1) end end, 'days'), tsq_duration_part(case when substr(case when substr(tsq_duration_round(cast(strftime('%Y', ?155) as integer), cast(strftime('%m', ?155) as integer), cast(strftime('%d', ?155) as integer), 0, cast(strftime('%Y', ?156) as integer), cast(strftime('%m', ?156) as integer), cast(strftime('%d', ?156) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?157) as integer), cast(strftime('%m', ?157) as integer), cast(strftime('%d', ?157) as integer), 0, cast(strftime('%Y', ?158) as integer), cast(strftime('%m', ?158) as integer), cast(strftime('%d', ?158) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?159) as integer), cast(strftime('%m', ?159) as integer), cast(strftime('%d', ?159) as integer), 0, cast(strftime('%Y', ?160) as integer), cast(strftime('%m', ?160) as integer), cast(strftime('%d', ?160) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?161) as integer), cast(strftime('%m', ?161) as integer), cast(strftime('%d', ?161) as integer), 0, cast(strftime('%Y', ?162) as integer), cast(strftime('%m', ?162) as integer), cast(strftime('%d', ?162) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?163) as integer), cast(strftime('%m', ?163) as integer), cast(strftime('%d', ?163) as integer), 0, cast(strftime('%Y', ?164) as integer), cast(strftime('%m', ?164) as integer), cast(strftime('%d', ?164) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?165) as integer), cast(strftime('%m', ?165) as integer), cast(strftime('%d', ?165) as integer), 0, cast(strftime('%Y', ?166) as integer), cast(strftime('%m', ?166) as integer), cast(strftime('%d', ?166) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?167) as integer), cast(strftime('%m', ?167) as integer), cast(strftime('%d', ?167) as integer), 0, cast(strftime('%Y', ?168) as integer), cast(strftime('%m', ?168) as integer), cast(strftime('%d', ?168) as integer), 0, 'month', 'day', 1, 'trunc', 1) end, 1, 1) in ('-', '+') then substr(case when substr(tsq_duration_round(cast(strftime('%Y', ?169) as integer), cast(strftime('%m', ?169) as integer), cast(strftime('%d', ?169) as integer), 0, cast(strftime('%Y', ?170) as integer), cast(strftime('%m', ?170) as integer), cast(strftime('%d', ?170) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?171) as integer), cast(strftime('%m', ?171) as integer), cast(strftime('%d', ?171) as integer), 0, cast(strftime('%Y', ?172) as integer), cast(strftime('%m', ?172) as integer), cast(strftime('%d', ?172) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?173) as integer), cast(strftime('%m', ?173) as integer), cast(strftime('%d', ?173) as integer), 0, cast(strftime('%Y', ?174) as integer), cast(strftime('%m', ?174) as integer), cast(strftime('%d', ?174) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?175) as integer), cast(strftime('%m', ?175) as integer), cast(strftime('%d', ?175) as integer), 0, cast(strftime('%Y', ?176) as integer), cast(strftime('%m', ?176) as integer), cast(strftime('%d', ?176) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?177) as integer), cast(strftime('%m', ?177) as integer), cast(strftime('%d', ?177) as integer), 0, cast(strftime('%Y', ?178) as integer), cast(strftime('%m', ?178) as integer), cast(strftime('%d', ?178) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?179) as integer), cast(strftime('%m', ?179) as integer), cast(strftime('%d', ?179) as integer), 0, cast(strftime('%Y', ?180) as integer), cast(strftime('%m', ?180) as integer), cast(strftime('%d', ?180) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?181) as integer), cast(strftime('%m', ?181) as integer), cast(strftime('%d', ?181) as integer), 0, cast(strftime('%Y', ?182) as integer), cast(strftime('%m', ?182) as integer), cast(strftime('%d', ?182) as integer), 0, 'month', 'day', 1, 'trunc', 1) end, 2) else case when substr(tsq_duration_round(cast(strftime('%Y', ?183) as integer), cast(strftime('%m', ?183) as integer), cast(strftime('%d', ?183) as integer), 0, cast(strftime('%Y', ?184) as integer), cast(strftime('%m', ?184) as integer), cast(strftime('%d', ?184) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?185) as integer), cast(strftime('%m', ?185) as integer), cast(strftime('%d', ?185) as integer), 0, cast(strftime('%Y', ?186) as integer), cast(strftime('%m', ?186) as integer), cast(strftime('%d', ?186) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?187) as integer), cast(strftime('%m', ?187) as integer), cast(strftime('%d', ?187) as integer), 0, cast(strftime('%Y', ?188) as integer), cast(strftime('%m', ?188) as integer), cast(strftime('%d', ?188) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?189) as integer), cast(strftime('%m', ?189) as integer), cast(strftime('%d', ?189) as integer), 0, cast(strftime('%Y', ?190) as integer), cast(strftime('%m', ?190) as integer), cast(strftime('%d', ?190) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?191) as integer), cast(strftime('%m', ?191) as integer), cast(strftime('%d', ?191) as integer), 0, cast(strftime('%Y', ?192) as integer), cast(strftime('%m', ?192) as integer), cast(strftime('%d', ?192) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?193) as integer), cast(strftime('%m', ?193) as integer), cast(strftime('%d', ?193) as integer), 0, cast(strftime('%Y', ?194) as integer), cast(strftime('%m', ?194) as integer), cast(strftime('%d', ?194) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?195) as integer), cast(strftime('%m', ?195) as integer), cast(strftime('%d', ?195) as integer), 0, cast(strftime('%Y', ?196) as integer), cast(strftime('%m', ?196) as integer), cast(strftime('%d', ?196) as integer), 0, 'month', 'day', 1, 'trunc', 1) end end, 'S'), tsq_duration_part(case when substr(case when substr(tsq_duration_round(cast(strftime('%Y', ?197) as integer), cast(strftime('%m', ?197) as integer), cast(strftime('%d', ?197) as integer), 0, cast(strftime('%Y', ?198) as integer), cast(strftime('%m', ?198) as integer), cast(strftime('%d', ?198) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?199) as integer), cast(strftime('%m', ?199) as integer), cast(strftime('%d', ?199) as integer), 0, cast(strftime('%Y', ?200) as integer), cast(strftime('%m', ?200) as integer), cast(strftime('%d', ?200) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?201) as integer), cast(strftime('%m', ?201) as integer), cast(strftime('%d', ?201) as integer), 0, cast(strftime('%Y', ?202) as integer), cast(strftime('%m', ?202) as integer), cast(strftime('%d', ?202) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?203) as integer), cast(strftime('%m', ?203) as integer), cast(strftime('%d', ?203) as integer), 0, cast(strftime('%Y', ?204) as integer), cast(strftime('%m', ?204) as integer), cast(strftime('%d', ?204) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?205) as integer), cast(strftime('%m', ?205) as integer), cast(strftime('%d', ?205) as integer), 0, cast(strftime('%Y', ?206) as integer), cast(strftime('%m', ?206) as integer), cast(strftime('%d', ?206) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?207) as integer), cast(strftime('%m', ?207) as integer), cast(strftime('%d', ?207) as integer), 0, cast(strftime('%Y', ?208) as integer), cast(strftime('%m', ?208) as integer), cast(strftime('%d', ?208) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?209) as integer), cast(strftime('%m', ?209) as integer), cast(strftime('%d', ?209) as integer), 0, cast(strftime('%Y', ?210) as integer), cast(strftime('%m', ?210) as integer), cast(strftime('%d', ?210) as integer), 0, 'month', 'day', 1, 'trunc', 1) end, 1, 1) in ('-', '+') then substr(case when substr(tsq_duration_round(cast(strftime('%Y', ?211) as integer), cast(strftime('%m', ?211) as integer), cast(strftime('%d', ?211) as integer), 0, cast(strftime('%Y', ?212) as integer), cast(strftime('%m', ?212) as integer), cast(strftime('%d', ?212) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?213) as integer), cast(strftime('%m', ?213) as integer), cast(strftime('%d', ?213) as integer), 0, cast(strftime('%Y', ?214) as integer), cast(strftime('%m', ?214) as integer), cast(strftime('%d', ?214) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?215) as integer), cast(strftime('%m', ?215) as integer), cast(strftime('%d', ?215) as integer), 0, cast(strftime('%Y', ?216) as integer), cast(strftime('%m', ?216) as integer), cast(strftime('%d', ?216) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?217) as integer), cast(strftime('%m', ?217) as integer), cast(strftime('%d', ?217) as integer), 0, cast(strftime('%Y', ?218) as integer), cast(strftime('%m', ?218) as integer), cast(strftime('%d', ?218) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?219) as integer), cast(strftime('%m', ?219) as integer), cast(strftime('%d', ?219) as integer), 0, cast(strftime('%Y', ?220) as integer), cast(strftime('%m', ?220) as integer), cast(strftime('%d', ?220) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?221) as integer), cast(strftime('%m', ?221) as integer), cast(strftime('%d', ?221) as integer), 0, cast(strftime('%Y', ?222) as integer), cast(strftime('%m', ?222) as integer), cast(strftime('%d', ?222) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?223) as integer), cast(strftime('%m', ?223) as integer), cast(strftime('%d', ?223) as integer), 0, cast(strftime('%Y', ?224) as integer), cast(strftime('%m', ?224) as integer), cast(strftime('%d', ?224) as integer), 0, 'month', 'day', 1, 'trunc', 1) end, 2) else case when substr(tsq_duration_round(cast(strftime('%Y', ?225) as integer), cast(strftime('%m', ?225) as integer), cast(strftime('%d', ?225) as integer), 0, cast(strftime('%Y', ?226) as integer), cast(strftime('%m', ?226) as integer), cast(strftime('%d', ?226) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '-' then substr(tsq_duration_round(cast(strftime('%Y', ?227) as integer), cast(strftime('%m', ?227) as integer), cast(strftime('%d', ?227) as integer), 0, cast(strftime('%Y', ?228) as integer), cast(strftime('%m', ?228) as integer), cast(strftime('%d', ?228) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) when tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?229) as integer), cast(strftime('%m', ?229) as integer), cast(strftime('%d', ?229) as integer), 0, cast(strftime('%Y', ?230) as integer), cast(strftime('%m', ?230) as integer), cast(strftime('%d', ?230) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'sign') = 0 then tsq_duration_round(cast(strftime('%Y', ?231) as integer), cast(strftime('%m', ?231) as integer), cast(strftime('%d', ?231) as integer), 0, cast(strftime('%Y', ?232) as integer), cast(strftime('%m', ?232) as integer), cast(strftime('%d', ?232) as integer), 0, 'month', 'day', 1, 'trunc', 1) when substr(tsq_duration_round(cast(strftime('%Y', ?233) as integer), cast(strftime('%m', ?233) as integer), cast(strftime('%d', ?233) as integer), 0, cast(strftime('%Y', ?234) as integer), cast(strftime('%m', ?234) as integer), cast(strftime('%d', ?234) as integer), 0, 'month', 'day', 1, 'trunc', 1), 1, 1) = '+' then '-' || substr(tsq_duration_round(cast(strftime('%Y', ?235) as integer), cast(strftime('%m', ?235) as integer), cast(strftime('%d', ?235) as integer), 0, cast(strftime('%Y', ?236) as integer), cast(strftime('%m', ?236) as integer), cast(strftime('%d', ?236) as integer), 0, 'month', 'day', 1, 'trunc', 1), 2) else '-' || tsq_duration_round(cast(strftime('%Y', ?237) as integer), cast(strftime('%m', ?237) as integer), cast(strftime('%d', ?237) as integer), 0, cast(strftime('%Y', ?238) as integer), cast(strftime('%m', ?238) as integer), cast(strftime('%d', ?238) as integer), 0, 'month', 'day', 1, 'trunc', 1) end end, 'N'), cast(strftime('%Y', ?239) as integer), cast(strftime('%m', ?239) as integer), cast(strftime('%d', ?239) as integer), 'day') as total"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?1) as integer), cast(strftime('%m', ?1) as integer), cast(strftime('%d', ?1) as integer), 0, cast(strftime('%Y', ?2) as integer), cast(strftime('%m', ?2) as integer), cast(strftime('%d', ?2) as integer), 0, 'year', 'day', 1, 'trunc', 1), 'years') as years, tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?3) as integer), cast(strftime('%m', ?3) as integer), cast(strftime('%d', ?3) as integer), 0, cast(strftime('%Y', ?4) as integer), cast(strftime('%m', ?4) as integer), cast(strftime('%d', ?4) as integer), 0, 'year', 'day', 1, 'trunc', 1), 'months') as months, tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?5) as integer), cast(strftime('%m', ?5) as integer), cast(strftime('%d', ?5) as integer), 0, cast(strftime('%Y', ?6) as integer), cast(strftime('%m', ?6) as integer), cast(strftime('%d', ?6) as integer), 0, 'year', 'day', 1, 'trunc', 1), 'days') as days, tsq_duration_part(tsq_duration_text(0, 0, 0, -cast(julianday(date(?7)) - julianday(date(?8)) as integer), 0, 'hour'), 'sign') as sign"`)
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
