// The arithmetic of an instant (Temporal.Instant), as Temporal's: plus and minus a duration of the time, the duration
// between two instants, and rounded. instant_value row 1 is 2024-01-14T09:15:30.123456Z, written with the offset +09:00
// where the column keeps one, and row 2 is 1969-07-20T20:17:40Z. Every value expected is the one Temporal gives; a
// duration is compared as Temporal compares two of them (PostgreSQL keeps it in an interval, without its fields).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tInstantValue, tDurationValue } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'

const deployed = Temporal.Instant.from('2024-01-14T09:15:30.123456Z')
const landed = Temporal.Instant.from('1969-07-20T20:17:40Z')
const later = Temporal.Instant.from('2124-03-15T10:00:00.123Z')

/** The reason of the error the query building throws */
function rejectionOf(build: () => unknown): string {
    try {
        build()
        return 'no error'
    } catch (error) {
        return (error as { errorReason?: { reason?: string } }).errorReason?.reason ?? String(error)
    }
}

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

    test('an-instant-plus-and-minus-a-duration-of-the-time', async () => {
        ctx.mockNext([{ plus: '2024-01-15 10:45:30.623456+00', minus: '2024-01-14 08:15:30.123455+00' }])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.id.equals(1))
            .select({
                plus: tInstantValue.instantAt.add({ hours: 25, minutes: 30, milliseconds: 500 }),
                minus: tInstantValue.instantAt.subtract(Temporal.Duration.from('PT1H0.000001S')),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(nanosecond, @2, cast(dateadd(second, @1, dateadd(day, @0, cast(switchoffset(instant_at, '+00:00') as datetime2))) as datetime2)) as plus, dateadd(nanosecond, @4, cast(dateadd(second, @3, cast(switchoffset(instant_at, '+00:00') as datetime2)) as datetime2)) as minus from instant_value where id = @5"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1",
            "5400",
            "500000000",
            "-3600",
            "-1000",
            "1",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ plus: Temporal.Instant; minus: Temporal.Instant }>>>()
        expect(rows.map(row => [row.plus.toString(), row.minus.toString()])).toEqual([[
            deployed.add({ hours: 25, minutes: 30, milliseconds: 500 }).toString(),
            deployed.subtract(Temporal.Duration.from('PT1H0.000001S')).toString(),
        ]])
    })

    test('a-duration-with-days-isnt-added-to-an-instant', () => {
        // As Temporal: a day has no fixed length without a zone
        expect(rejectionOf(() => tInstantValue.instantAt.add({ days: 1 } as never))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(rejectionOf(() => tInstantValue.instantAt.subtract(Temporal.Duration.from('P1W')))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(rejectionOf(() => tInstantValue.instantAt.add(Temporal.Duration.from('PT48H')))).toBe('no error')
    })

    test('an-instant-plus-and-minus-a-duration-of-a-column', async () => {
        // duration_value row 3 is PT90M, in span and in span_text
        const span = Temporal.Duration.from('PT90M')
        ctx.mockNext([
            { id: 1, plus: '2024-01-14 10:45:30.123456+00', minus: '2024-01-14 07:45:30.123456+00' },
            { id: 2, plus: '1969-07-20 21:47:40+00', minus: '1969-07-20 18:47:40+00' },
        ])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .join(tDurationValue).on(tDurationValue.id.equals(3))
            .select({
                id: tInstantValue.id,
                plus: tInstantValue.instantAt.add(tDurationValue.span),
                minus: tInstantValue.instantAt.subtract(tDurationValue.spanText),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select instant_value.id as id, dateadd(day, (day(datefromparts(2001, 2, case when dbo.tsq_duration_part(duration_value.span, 'M') <> 0 or dbo.tsq_duration_part(duration_value.span, 'D') <> 0 then 29 else 28 end)) - 28), dateadd(nanosecond, dbo.tsq_duration_part(duration_value.span, 'N'), cast(dateadd(second, dbo.tsq_duration_part(duration_value.span, 'S') % 86400, dateadd(day, (dbo.tsq_duration_part(duration_value.span, 'D') + dbo.tsq_duration_part(duration_value.span, 'S') / 86400), dateadd(month, dbo.tsq_duration_part(duration_value.span, 'M'), cast(switchoffset(instant_value.instant_at, '+00:00') as datetime2)))) as datetime2))) as plus, dateadd(day, (day(datefromparts(2001, 2, case when dbo.tsq_duration_part(duration_value.span_text, 'M') <> 0 or dbo.tsq_duration_part(duration_value.span_text, 'D') <> 0 then 29 else 28 end)) - 28), dateadd(nanosecond, -dbo.tsq_duration_part(duration_value.span_text, 'N'), cast(dateadd(second, -dbo.tsq_duration_part(duration_value.span_text, 'S') % 86400, dateadd(day, (-dbo.tsq_duration_part(duration_value.span_text, 'D') + -dbo.tsq_duration_part(duration_value.span_text, 'S') / 86400), dateadd(month, -dbo.tsq_duration_part(duration_value.span_text, 'M'), cast(switchoffset(instant_value.instant_at, '+00:00') as datetime2)))) as datetime2))) as minus from instant_value join duration_value on duration_value.id = @0 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; plus: Temporal.Instant; minus?: Temporal.Instant }>>>()
        expect(rows.map(row => [row.id, row.plus.toString(), row.minus?.toString()])).toEqual([deployed, landed].map((instant, i) => [
            i + 1, instant.add(span).toString(), instant.subtract(span).toString(),
        ]))
    })

    test('a-duration-of-a-column-with-days-makes-the-query-fail', async () => {
        // As Temporal: duration_value row 1 has 3 days, row 2 is -PT26H, kept in span as -1 day -2 hours where it is an
        // interval, and as it is in span_text
        ctx.mockNext([{ at: '2024-01-17 13:20:36.912456+00' }])
        const withDays = await failureOf(ctx.conn.selectFrom(tInstantValue)
            .join(tDurationValue).on(tDurationValue.id.equals(1))
            .where(tInstantValue.id.equals(1))
            .select({ at: tInstantValue.instantAt.add(tDurationValue.spanText) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(day, (day(datefromparts(2001, 2, case when dbo.tsq_duration_part(duration_value.span_text, 'M') <> 0 or dbo.tsq_duration_part(duration_value.span_text, 'D') <> 0 then 29 else 28 end)) - 28), dateadd(nanosecond, dbo.tsq_duration_part(duration_value.span_text, 'N'), cast(dateadd(second, dbo.tsq_duration_part(duration_value.span_text, 'S') % 86400, dateadd(day, (dbo.tsq_duration_part(duration_value.span_text, 'D') + dbo.tsq_duration_part(duration_value.span_text, 'S') / 86400), dateadd(month, dbo.tsq_duration_part(duration_value.span_text, 'M'), cast(switchoffset(instant_value.instant_at, '+00:00') as datetime2)))) as datetime2))) as at from instant_value join duration_value on duration_value.id = @0 where instant_value.id = @1"`)
        expect(withDays).toBe(ctx.realDbEnabled)
        ctx.mockNext([{ at: '2024-01-15 11:15:30.123456+00' }])
        const hours = await ctx.conn.selectFrom(tInstantValue)
            .join(tDurationValue).on(tDurationValue.id.equals(2))
            .where(tInstantValue.id.equals(1))
            .select({ at: tInstantValue.instantAt.subtract(tDurationValue.spanText) })
            .executeSelectMany()
        expect(hours.map(row => row.at?.toString())).toEqual([deployed.subtract(Temporal.Duration.from('-PT26H')).toString()])
    })

    test('the-duration-between-two-instants', async () => {
        ctx.mockNext([deployed, landed].map((instant, i) => ({
            id: i + 1,
            seconds: instant.until(later).toString(),
            hours: instant.until(later, { largestUnit: 'hour' }).toString(),
            minutes: instant.since(later, { smallestUnit: 'minute', roundingMode: 'floor' }).toString(),
        })))
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .select({
                id: tInstantValue.id,
                seconds: tInstantValue.instantAt.until(later),
                hours: tInstantValue.instantAt.until(later, { largestUnit: 'hour' }),
                minutes: tInstantValue.instantAt.since(later, { smallestUnit: 'minute', roundingMode: 'floor' }),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, dbo.tsq_duration_text(0, 0, 0, 0, (datediff(day, cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date), cast(cast(switchoffset(@0, '+00:00') as datetime2) as date)) * cast(86400000000000 as decimal(38)) + (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@1, '+00:00') as datetime2) as time)) - datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)))), 'second') as seconds, dbo.tsq_duration_text(0, 0, 0, 0, (datediff(day, cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date), cast(cast(switchoffset(@2, '+00:00') as datetime2) as date)) * cast(86400000000000 as decimal(38)) + (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@3, '+00:00') as datetime2) as time)) - datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)))), 'hour') as hours, dbo.tsq_duration_text(0, 0, 0, 0, -(round(((datediff(day, cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date), cast(cast(switchoffset(@4, '+00:00') as datetime2) as date)) * cast(86400000000000 as decimal(38)) + (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@5, '+00:00') as datetime2) as time)) - datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)))) + case when (datediff(day, cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date), cast(cast(switchoffset(@6, '+00:00') as datetime2) as date)) * cast(86400000000000 as decimal(38)) + (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@7, '+00:00') as datetime2) as time)) - datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)))) > 0 then cast(59999999999 as bigint) else 0 end) / cast(60000000000 as bigint), 0, 1) * cast(60000000000 as bigint)), 'minute') as minutes from instant_value order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2124-03-15T10:00:00.123Z",
            "2124-03-15T10:00:00.123Z",
            "2124-03-15T10:00:00.123Z",
            "2124-03-15T10:00:00.123Z",
            "2124-03-15T10:00:00.123Z",
            "2124-03-15T10:00:00.123Z",
            "2124-03-15T10:00:00.123Z",
            "2124-03-15T10:00:00.123Z",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; seconds: Temporal.Duration; hours: Temporal.Duration; minutes: Temporal.Duration }>>>()
        const differences: string[] = []
        for (const row of rows) {
            const instant = row.id === 1 ? deployed : landed
            const expected = [instant.until(later), instant.until(later, { largestUnit: 'hour' }), instant.since(later, { smallestUnit: 'minute', roundingMode: 'floor' })]
            const got = [row.seconds, row.hours, row.minutes]
            expected.forEach((duration, i) => {
                if (Temporal.Duration.compare(duration, got[i]!) !== 0) {
                    differences.push(row.id + ': ' + duration.toString() + ' got ' + got[i]!.toString())
                }
            })
        }
        expect(differences).toEqual([])
    })

    test('the-duration-between-two-instants-more-than-292-years-apart', async () => {
        // More nanoseconds than a 64-bit integer holds; and two dates and times as far apart, in days
        const from = Temporal.Instant.from('1700-01-01T00:00:00.000001Z')
        const to = Temporal.Instant.from('2100-06-15T12:30:45.123456Z')
        const fromDateTime = from.toZonedDateTimeISO('UTC').toPlainDateTime()
        const toDateTime = to.toZonedDateTimeISO('UTC').toPlainDateTime()
        ctx.mockNext({ seconds: '3510300:30:45.123455', hours: '3510300:30:45.123455', minutes: '-3510300:31:00', total: 3510300.512534293, days: '146262 days 12:30:45.123455' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                seconds: ctx.conn.const(from, 'instant').until(to),
                hours: ctx.conn.const(from, 'instant').until(to, { largestUnit: 'hour' }),
                minutes: ctx.conn.const(from, 'instant').since(to, { largestUnit: 'minute', smallestUnit: 'minute', roundingMode: 'halfEven' }),
                total: ctx.conn.const(from, 'instant').until(to, { largestUnit: 'hour' }).total('hours'),
                days: ctx.conn.const(fromDateTime, 'plainDateTime').until(toDateTime),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dbo.tsq_duration_text(0, 0, 0, 0, (datediff(day, cast(cast(switchoffset(@1, '+00:00') as datetime2) as date), cast(cast(switchoffset(@0, '+00:00') as datetime2) as date)) * cast(86400000000000 as decimal(38)) + (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@2, '+00:00') as datetime2) as time)) - datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@3, '+00:00') as datetime2) as time)))), 'second') as seconds, dbo.tsq_duration_text(0, 0, 0, 0, (datediff(day, cast(cast(switchoffset(@5, '+00:00') as datetime2) as date), cast(cast(switchoffset(@4, '+00:00') as datetime2) as date)) * cast(86400000000000 as decimal(38)) + (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@6, '+00:00') as datetime2) as time)) - datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@7, '+00:00') as datetime2) as time)))), 'hour') as hours, dbo.tsq_duration_text(0, 0, 0, 0, -(sign((datediff(day, cast(cast(switchoffset(@9, '+00:00') as datetime2) as date), cast(cast(switchoffset(@8, '+00:00') as datetime2) as date)) * cast(86400000000000 as decimal(38)) + (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@10, '+00:00') as datetime2) as time)) - datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@11, '+00:00') as datetime2) as time))))) * (round((2 * abs((datediff(day, cast(cast(switchoffset(@13, '+00:00') as datetime2) as date), cast(cast(switchoffset(@12, '+00:00') as datetime2) as date)) * cast(86400000000000 as decimal(38)) + (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@14, '+00:00') as datetime2) as time)) - datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@15, '+00:00') as datetime2) as time))))) + cast(60000000000 as bigint)) / cast(120000000000 as bigint), 0, 1) - case when (2 * abs((datediff(day, cast(cast(switchoffset(@17, '+00:00') as datetime2) as date), cast(cast(switchoffset(@16, '+00:00') as datetime2) as date)) * cast(86400000000000 as decimal(38)) + (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@18, '+00:00') as datetime2) as time)) - datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@19, '+00:00') as datetime2) as time))))) + cast(60000000000 as bigint)) % cast(240000000000 as bigint) = cast(120000000000 as bigint) then 1 else 0 end) * cast(60000000000 as bigint)), 'minute') as minutes, dbo.tsq_duration_total(0, 0, 0, cast(round((datediff(day, cast(cast(switchoffset(@21, '+00:00') as datetime2) as date), cast(cast(switchoffset(@20, '+00:00') as datetime2) as date)) * cast(86400000000000 as decimal(38)) + (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@22, '+00:00') as datetime2) as time)) - datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@23, '+00:00') as datetime2) as time)))) / 1000000000, 0, 1) as bigint), cast((datediff(day, cast(cast(switchoffset(@25, '+00:00') as datetime2) as date), cast(cast(switchoffset(@24, '+00:00') as datetime2) as date)) * cast(86400000000000 as decimal(38)) + (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@26, '+00:00') as datetime2) as time)) - datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@27, '+00:00') as datetime2) as time)))) % 1000000000 as bigint), 0, 0, 0, 'hour') as total, dbo.tsq_duration_text(0, 0, 0, round((datediff(day, cast(@29 as date), cast(@28 as date)) * cast(86400000000000 as decimal(38)) + (datediff_big(nanosecond, cast('00:00' as time), cast(@28 as time)) - datediff_big(nanosecond, cast('00:00' as time), cast(@29 as time)))) / cast(86400000000000 as bigint), 0, 1), ((datediff(day, cast(@29 as date), cast(@28 as date)) * cast(86400000000000 as decimal(38)) + (datediff_big(nanosecond, cast('00:00' as time), cast(@28 as time)) - datediff_big(nanosecond, cast('00:00' as time), cast(@29 as time)))) % cast(86400000000000 as bigint)), 'hour') as days"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2100-06-15T12:30:45.123456Z",
            "1700-01-01T00:00:00.000001Z",
            "2100-06-15T12:30:45.123456Z",
            "1700-01-01T00:00:00.000001Z",
            "2100-06-15T12:30:45.123456Z",
            "1700-01-01T00:00:00.000001Z",
            "2100-06-15T12:30:45.123456Z",
            "1700-01-01T00:00:00.000001Z",
            "2100-06-15T12:30:45.123456Z",
            "1700-01-01T00:00:00.000001Z",
            "2100-06-15T12:30:45.123456Z",
            "1700-01-01T00:00:00.000001Z",
            "2100-06-15T12:30:45.123456Z",
            "1700-01-01T00:00:00.000001Z",
            "2100-06-15T12:30:45.123456Z",
            "1700-01-01T00:00:00.000001Z",
            "2100-06-15T12:30:45.123456Z",
            "1700-01-01T00:00:00.000001Z",
            "2100-06-15T12:30:45.123456Z",
            "1700-01-01T00:00:00.000001Z",
            "2100-06-15T12:30:45.123456Z",
            "1700-01-01T00:00:00.000001Z",
            "2100-06-15T12:30:45.123456Z",
            "1700-01-01T00:00:00.000001Z",
            "2100-06-15T12:30:45.123456Z",
            "1700-01-01T00:00:00.000001Z",
            "2100-06-15T12:30:45.123456Z",
            "1700-01-01T00:00:00.000001Z",
            "2100-06-15T12:30:45.123456",
            "1700-01-01T00:00:00.000001",
          ]
        `)
        const expected = [from.until(to), from.until(to, { largestUnit: 'hour' }), from.since(to, { largestUnit: 'minute', smallestUnit: 'minute', roundingMode: 'halfEven' }), fromDateTime.until(toDateTime)]
        const got = [row.seconds, row.hours, row.minutes, row.days]
        expect(expected.flatMap((duration, i) => Temporal.Duration.compare(duration, got[i]!, { relativeTo: fromDateTime }) === 0 ? [] : [i + ': ' + duration.toString() + ' got ' + got[i]!.toString()])).toEqual([])
        expect(row.total).toBe(from.until(to, { largestUnit: 'hour' }).total('hours'))
    })

    test('an-instant-rounded', async () => {
        ctx.mockNext([{ id: 1, hour: '2024-01-14 09:00:00+00', ninety: '2024-01-14 09:00:00+00', floor: '2024-01-14 09:15:30+00' }, { id: 2, hour: '1969-07-20 20:00:00+00', ninety: '1969-07-20 21:00:00+00', floor: '1969-07-20 20:17:40+00' }])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .select({
                id: tInstantValue.id,
                hour: tInstantValue.instantAt.round('hour'),
                ninety: tInstantValue.instantAt.round({ smallestUnit: 'minute', roundingIncrement: 90 }),
                floor: tInstantValue.instantAt.round({ smallestUnit: 'second', roundingMode: 'floor' }),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, dateadd(nanosecond, ((2 * (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) / 100) + cast(36000000000 as bigint)) / cast(72000000000 as bigint) * cast(36000000000 as bigint)) % 10000000 * 100, dateadd(second, ((2 * (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) / 100) + cast(36000000000 as bigint)) / cast(72000000000 as bigint) * cast(36000000000 as bigint)) / 10000000, cast(cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date) as datetime2))) as hour, dateadd(nanosecond, ((2 * (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) / 100) + cast(54000000000 as bigint)) / cast(108000000000 as bigint) * cast(54000000000 as bigint)) % 10000000 * 100, dateadd(second, ((2 * (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) / 100) + cast(54000000000 as bigint)) / cast(108000000000 as bigint) * cast(54000000000 as bigint)) / 10000000, cast(cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date) as datetime2))) as ninety, dateadd(nanosecond, ((datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) / 100) / 10000000 * 10000000) % 10000000 * 100, dateadd(second, ((datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) / 100) / 10000000 * 10000000) / 10000000, cast(cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date) as datetime2))) as floor from instant_value order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; hour: Temporal.Instant; ninety: Temporal.Instant; floor: Temporal.Instant }>>>()
        expect(rows.map(row => [row.id, row.hour.toString(), row.ninety.toString(), row.floor.toString()])).toEqual([deployed, landed].map((instant, i) => [
            i + 1, instant.round('hour').toString(), instant.round({ smallestUnit: 'minute', roundingIncrement: 90 }).toString(), instant.round({ smallestUnit: 'second', roundingMode: 'floor' }).toString(),
        ]))
    })

    test('an-instant-computed-as-a-date-and-time-of-the-database', async () => {
        // An instant rounded, plus a duration, or of its epoch, taken to its date and time in the zone of the database (UTC)
        ctx.mockNext([{ hour: '2024-01-14 09:00:00', later: '2024-01-14 10:15:30.123456', day: '2024-01-14' }])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.id.equals(1))
            .select({
                hour: tInstantValue.instantAt.round('hour').toPlainDateTime(),
                later: tInstantValue.instantAt.add({ hours: 1 }).toPlainDateTime(),
                day: ctx.conn.instantFromEpochMilliseconds(tInstantValue.instantAt.epochMilliseconds()).toPlainDate(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(switchoffset(dateadd(nanosecond, ((2 * (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) / 100) + cast(36000000000 as bigint)) / cast(72000000000 as bigint) * cast(36000000000 as bigint)) % 10000000 * 100, dateadd(second, ((2 * (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) / 100) + cast(36000000000 as bigint)) / cast(72000000000 as bigint) * cast(36000000000 as bigint)) / 10000000, cast(cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date) as datetime2))), '+00:00') as datetime2) as hour, cast(switchoffset(dateadd(second, @0, cast(switchoffset(instant_at, '+00:00') as datetime2)), '+00:00') as datetime2) as later, cast(cast(switchoffset(dateadd(nanosecond, (((cast(datediff_big(millisecond, '1970-01-01 00:00:00', instant_at) as bigint) % 86400000 + 86400000) % 86400000) * 1000000) % 1000000000, dateadd(second, (((cast(datediff_big(millisecond, '1970-01-01 00:00:00', instant_at) as bigint) % 86400000 + 86400000) % 86400000) * 1000000) / 1000000000, cast(dateadd(day, (cast(datediff_big(millisecond, '1970-01-01 00:00:00', instant_at) as bigint) - ((cast(datediff_big(millisecond, '1970-01-01 00:00:00', instant_at) as bigint) % 86400000 + 86400000) % 86400000)) / 86400000, cast('1970-01-01' as date)) as datetime2))), '+00:00') as datetime2) as date) as day from instant_value where id = @1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3600,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ hour: Temporal.PlainDateTime; later: Temporal.PlainDateTime; day: Temporal.PlainDate }>>>()
        expect(rows.map(row => [row.hour.toString(), row.later.toString(), row.day.toString()])).toEqual([[
            deployed.round('hour').toZonedDateTimeISO('UTC').toPlainDateTime().toString(),
            deployed.add({ hours: 1 }).toZonedDateTimeISO('UTC').toPlainDateTime().toString(),
            deployed.toZonedDateTimeISO('UTC').toPlainDate().toString(),
        ]])
    })

    test('an-instant-before-1970-rounded-as-temporal', async () => {
        // Temporal rounds an instant as if it were positive: before 1970 trunc is floor too
        const instant = Temporal.Instant.from('1969-12-31T23:59:30.5Z')
        ctx.mockNext({ trunc: '1969-12-31 23:59:00+00', ceil: '1970-01-01 00:00:00+00', day: '1970-01-01 00:00:00+00' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                trunc: ctx.conn.const(instant, 'instant').round({ smallestUnit: 'minute', roundingMode: 'trunc' }),
                ceil: ctx.conn.const(instant, 'instant').round({ smallestUnit: 'minute', roundingMode: 'ceil' }),
                day: ctx.conn.const(instant, 'instant').round({ smallestUnit: 'hour', roundingIncrement: 24 }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(nanosecond, ((datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@1, '+00:00') as datetime2) as time)) / 100) / 600000000 * 600000000) % 10000000 * 100, dateadd(second, ((datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@1, '+00:00') as datetime2) as time)) / 100) / 600000000 * 600000000) / 10000000, cast(cast(cast(switchoffset(@0, '+00:00') as datetime2) as date) as datetime2))) as trunc, dateadd(nanosecond, (((datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@3, '+00:00') as datetime2) as time)) / 100) + 599999999) / 600000000 * 600000000) % 10000000 * 100, dateadd(second, (((datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@3, '+00:00') as datetime2) as time)) / 100) + 599999999) / 600000000 * 600000000) / 10000000, cast(cast(cast(switchoffset(@2, '+00:00') as datetime2) as date) as datetime2))) as ceil, dateadd(nanosecond, ((2 * (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@5, '+00:00') as datetime2) as time)) / 100) + cast(864000000000 as bigint)) / cast(1728000000000 as bigint) * cast(864000000000 as bigint)) % 10000000 * 100, dateadd(second, ((2 * (datediff_big(nanosecond, cast('00:00' as time), cast(cast(switchoffset(@5, '+00:00') as datetime2) as time)) / 100) + cast(864000000000 as bigint)) / cast(1728000000000 as bigint) * cast(864000000000 as bigint)) / 10000000, cast(cast(cast(switchoffset(@4, '+00:00') as datetime2) as date) as datetime2))) as day"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1969-12-31T23:59:30.5Z",
            "1969-12-31T23:59:30.5Z",
            "1969-12-31T23:59:30.5Z",
            "1969-12-31T23:59:30.5Z",
            "1969-12-31T23:59:30.5Z",
            "1969-12-31T23:59:30.5Z",
          ]
        `)
        expect([row.trunc.toString(), row.ceil.toString(), row.day.toString()]).toEqual([
            instant.round({ smallestUnit: 'minute', roundingMode: 'trunc' }).toString(),
            instant.round({ smallestUnit: 'minute', roundingMode: 'ceil' }).toString(),
            instant.round({ smallestUnit: 'hour', roundingIncrement: 24 }).toString(),
        ])
    })
})
