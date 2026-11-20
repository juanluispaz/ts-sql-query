// The fields, the sign, the negation and the absolute value of a duration, as Temporal reads the duration kept. Every
// expected value is the one Temporal gives. duration_value: span is 1 3 days 04:05:06.789, 2 -1 day -2 hours, 3 01:30
// (kept as its ISO 8601 text P3DT4H5M6.789S, -P1DT2H and PT1H30M); span_text is the ISO 8601 text P1Y2M3DT4H5M6.789S,
// -PT26H and PT90M, whose fields are the ones written.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-SUPPORTED: Bun SQL's sqlite adapter exposes neither a user-defined-function API nor its bun:sqlite `Database`, so the tsq_duration_part UDF can't be registered
    /*
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<(typeof rows)[number]['years'], number | undefined>>()
        expect(rows.map(row => [row.id, row.years, row.months, row.weeks, row.days, row.hours, row.minutes, row.seconds, row.milliseconds, row.microseconds, row.nanoseconds])).toEqual([
            [1, 1, 2, 0, 3, 4, 5, 6, 789, 0, 0],
            [2, 0, 0, 0, 0, -26, 0, 0, 0, 0, 0],
            [3, 0, 0, 0, 0, 0, 90, 0, 0, 0, 0],
        ])
    })
    */

    // NOT-SUPPORTED: Bun SQL's sqlite adapter exposes neither a user-defined-function API nor its bun:sqlite `Database`, so the tsq_duration_part UDF can't be registered
    /*
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; days: number; hours: number; minutes: number; seconds: number; milliseconds: number }>>>()
        expect(rows.map(row => [row.id, row.days, row.hours, row.minutes, row.seconds, row.milliseconds])).toEqual([
            [1, 3, 4, 5, 6, 789],
            [2, -1, -2, 0, 0, 0],
            [3, 0, 1, 30, 0, 0],
        ])
    })
    */

    // NOT-SUPPORTED: Bun SQL's sqlite adapter exposes neither a user-defined-function API nor its bun:sqlite `Database`, so the tsq_duration_part UDF can't be registered
    /*
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<(typeof rows)[number]['negated'], Temporal.Duration>>()
        expect(rows.map(row => [row.id, row.sign, row.textSign, row.negated.toString(), row.textNegated?.toString(), row.abs.toString(), row.textAbs?.toString()])).toEqual([
            [1, 1, 1, '-P3DT4H5M6.789S', '-P1Y2M3DT4H5M6.789S', 'P3DT4H5M6.789S', 'P1Y2M3DT4H5M6.789S'],
            [2, -1, -1, 'P1DT2H', 'PT26H', 'P1DT2H', 'PT26H'],
            [3, 1, 1, '-PT1H30M', '-PT90M', 'PT1H30M', 'PT90M'],
        ])
    })
    */

    // NOT-SUPPORTED: Bun SQL's sqlite adapter exposes neither a user-defined-function API nor its bun:sqlite `Database`, so the tsq_duration_part UDF can't be registered
    /*
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        expect([row.months, row.days, row.total]).toEqual([-1, -30, 59])
    })
    */

    // NOT-SUPPORTED: Bun SQL's sqlite adapter exposes neither a user-defined-function API nor its bun:sqlite `Database`, so the tsq_duration_part UDF can't be registered
    /*
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        expect([row.years, row.months, row.days, row.sign]).toEqual([1, 1, 30, -1])
    })
    */
})
