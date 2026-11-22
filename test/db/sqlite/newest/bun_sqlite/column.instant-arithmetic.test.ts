// The arithmetic of an instant (Temporal.Instant), as Temporal's: plus and minus a duration of the time, the duration
// between two instants, and rounded. instant_value row 1 is 2024-01-14T09:15:30.123Z (SQLite keeps milliseconds) and
// row 2 is 1969-07-20T20:17:40Z. Every value expected is the one Temporal gives; a duration is compared as Temporal
// compares two of them.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tInstantValue, tDurationValue } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'

const deployed = Temporal.Instant.from('2024-01-14T09:15:30.123Z')
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
        ctx.mockNext([{ plus: '2024-01-15 10:45:30.623', minus: '2024-01-14 08:15:30.122' }])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.id.equals(1))
            .select({
                plus: tInstantValue.instantAt.add({ hours: 25, minutes: 30, milliseconds: 500 }),
                minus: tInstantValue.instantAt.subtract(Temporal.Duration.from('PT1H0.001S')),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%Y-%m-%d %H:%M:%f', instant_at, ?1) as plus, strftime('%Y-%m-%d %H:%M:%f', instant_at, ?2) as minus from instant_value where id = ?3"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "91800.5 seconds",
            "-3600.001 seconds",
            "1",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ plus: Temporal.Instant; minus: Temporal.Instant }>>>()
        expect(rows.map(row => [row.plus.toString(), row.minus.toString()])).toEqual([[
            deployed.add({ hours: 25, minutes: 30, milliseconds: 500 }).toString(),
            deployed.subtract(Temporal.Duration.from('PT1H0.001S')).toString(),
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
            { id: 1, plus: '2024-01-14 10:45:30.123', minus: '2024-01-14 07:45:30.123' },
            { id: 2, plus: '1969-07-20 21:47:40', minus: '1969-07-20 18:47:40' },
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select instant_value.id as id, case when tsq_duration_part(duration_value.span, 'M') <> 0 or tsq_duration_part(duration_value.span, 'D') <> 0 then abs(-9223372036854775807 - 1) else strftime('%Y-%m-%d %H:%M:%f', date(date(instant_value.instant_at, 'start of month', (tsq_duration_part(duration_value.span, 'M')) || ' months'), (min(cast(strftime('%d', instant_value.instant_at) as integer), cast(strftime('%d', date(instant_value.instant_at, 'start of month', (tsq_duration_part(duration_value.span, 'M')) || ' months'), '+1 months', '-1 days') as integer)) - 1) || ' days') || ' ' || strftime('%H:%M:%f', instant_value.instant_at), (tsq_duration_part(duration_value.span, 'D')) || ' days', (tsq_duration_part(duration_value.span, 'S') + tsq_duration_part(duration_value.span, 'N') / 1000000000.0) || ' seconds') end as plus, case when tsq_duration_part(duration_value.span_text, 'M') <> 0 or tsq_duration_part(duration_value.span_text, 'D') <> 0 then abs(-9223372036854775807 - 1) else strftime('%Y-%m-%d %H:%M:%f', date(date(instant_value.instant_at, 'start of month', (-tsq_duration_part(duration_value.span_text, 'M')) || ' months'), (min(cast(strftime('%d', instant_value.instant_at) as integer), cast(strftime('%d', date(instant_value.instant_at, 'start of month', (-tsq_duration_part(duration_value.span_text, 'M')) || ' months'), '+1 months', '-1 days') as integer)) - 1) || ' days') || ' ' || strftime('%H:%M:%f', instant_value.instant_at), (-tsq_duration_part(duration_value.span_text, 'D')) || ' days', (-tsq_duration_part(duration_value.span_text, 'S') + -tsq_duration_part(duration_value.span_text, 'N') / 1000000000.0) || ' seconds') end as minus from instant_value join duration_value on duration_value.id = ?1 order by id"`)
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
        ctx.mockNext([{ at: '2024-01-17 13:20:36.912' }])
        const withDays = await failureOf(ctx.conn.selectFrom(tInstantValue)
            .join(tDurationValue).on(tDurationValue.id.equals(1))
            .where(tInstantValue.id.equals(1))
            .select({ at: tInstantValue.instantAt.add(tDurationValue.spanText) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when tsq_duration_part(duration_value.span_text, 'M') <> 0 or tsq_duration_part(duration_value.span_text, 'D') <> 0 then abs(-9223372036854775807 - 1) else strftime('%Y-%m-%d %H:%M:%f', date(date(instant_value.instant_at, 'start of month', (tsq_duration_part(duration_value.span_text, 'M')) || ' months'), (min(cast(strftime('%d', instant_value.instant_at) as integer), cast(strftime('%d', date(instant_value.instant_at, 'start of month', (tsq_duration_part(duration_value.span_text, 'M')) || ' months'), '+1 months', '-1 days') as integer)) - 1) || ' days') || ' ' || strftime('%H:%M:%f', instant_value.instant_at), (tsq_duration_part(duration_value.span_text, 'D')) || ' days', (tsq_duration_part(duration_value.span_text, 'S') + tsq_duration_part(duration_value.span_text, 'N') / 1000000000.0) || ' seconds') end as at from instant_value join duration_value on duration_value.id = ?1 where instant_value.id = ?2"`)
        expect(withDays).toBe(ctx.realDbEnabled)
        ctx.mockNext([{ at: '2024-01-15 11:15:30.123' }])
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_text(0, 0, 0, 0, cast(cast(round((julianday(?1) - julianday(instant_at)) * 86400000) as integer) * 1000000 as text), 'second') as seconds, tsq_duration_text(0, 0, 0, 0, cast(cast(round((julianday(?2) - julianday(instant_at)) * 86400000) as integer) * 1000000 as text), 'hour') as hours, tsq_duration_text(0, 0, 0, 0, cast(-(cast((cast(round((julianday(?3) - julianday(instant_at)) * 86400000) as integer) + case when cast(round((julianday(?4) - julianday(instant_at)) * 86400000) as integer) > 0 then 59999 else 0 end) / 60000 as integer) * 60000) * 1000000 as text), 'minute') as minutes from instant_value order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2124-03-15 10:00:00.123",
            "2124-03-15 10:00:00.123",
            "2124-03-15 10:00:00.123",
            "2124-03-15 10:00:00.123",
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

    // NOT-SUPPORTED: SQLite computes with 64-bit integers: a difference of more than 292 years in nanoseconds overflows them, and the query fails
    /*
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        const expected = [from.until(to), from.until(to, { largestUnit: 'hour' }), from.since(to, { largestUnit: 'minute', smallestUnit: 'minute', roundingMode: 'halfEven' }), fromDateTime.until(toDateTime)]
        const got = [row.seconds, row.hours, row.minutes, row.days]
        expect(expected.flatMap((duration, i) => Temporal.Duration.compare(duration, got[i]!, { relativeTo: fromDateTime }) === 0 ? [] : [i + ': ' + duration.toString() + ' got ' + got[i]!.toString()])).toEqual([])
        expect(row.total).toBe(from.until(to, { largestUnit: 'hour' }).total('hours'))
    })
    */

    test('an-instant-rounded', async () => {
        ctx.mockNext([{ id: 1, hour: '2024-01-14 09:00:00.000', ninety: '2024-01-14 09:00:00.000', floor: '2024-01-14 09:15:30.000' }, { id: 2, hour: '1969-07-20 20:00:00.000', ninety: '1969-07-20 21:00:00.000', floor: '1969-07-20 20:17:40.000' }])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .select({
                id: tInstantValue.id,
                hour: tInstantValue.instantAt.round('hour'),
                ninety: tInstantValue.instantAt.round({ smallestUnit: 'minute', roundingIncrement: 90 }),
                floor: tInstantValue.instantAt.round({ smallestUnit: 'second', roundingMode: 'floor' }),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, strftime('%Y-%m-%d %H:%M:%f', date(instant_at), ((cast((2 * cast(round((julianday(instant_at) - julianday(date(instant_at))) * 86400000) as integer) + 3600000) / 7200000 as integer) * 3600000) / 1000.0) || ' seconds') as hour, strftime('%Y-%m-%d %H:%M:%f', date(instant_at), ((cast((2 * cast(round((julianday(instant_at) - julianday(date(instant_at))) * 86400000) as integer) + 5400000) / 10800000 as integer) * 5400000) / 1000.0) || ' seconds') as ninety, strftime('%Y-%m-%d %H:%M:%f', date(instant_at), ((cast(cast(round((julianday(instant_at) - julianday(date(instant_at))) * 86400000) as integer) / 1000 as integer) * 1000) / 1000.0) || ' seconds') as floor from instant_value order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; hour: Temporal.Instant; ninety: Temporal.Instant; floor: Temporal.Instant }>>>()
        expect(rows.map(row => [row.id, row.hour.toString(), row.ninety.toString(), row.floor.toString()])).toEqual([deployed, landed].map((instant, i) => [
            i + 1, instant.round('hour').toString(), instant.round({ smallestUnit: 'minute', roundingIncrement: 90 }).toString(), instant.round({ smallestUnit: 'second', roundingMode: 'floor' }).toString(),
        ]))
    })

    test('an-instant-computed-as-a-date-and-time-of-the-database', async () => {
        // An instant rounded, plus a duration, or of its epoch, taken to its date and time in the zone of the database (UTC)
        ctx.mockNext([{ hour: '2024-01-14 09:00:00.000', later: '2024-01-14 10:15:30.123', earlier: '2024-01-14', day: '2024-01-14', dayOfNanoseconds: '2024-01-14' }])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.id.equals(1))
            .select({
                hour: tInstantValue.instantAt.round('hour').toPlainDateTime(),
                later: tInstantValue.instantAt.add({ hours: 1 }).toPlainDateTime(),
                earlier: tInstantValue.instantAt.subtract({ minutes: 30 }).toPlainDate(),
                day: ctx.conn.instantFromEpochMilliseconds(tInstantValue.instantAt.epochMilliseconds()).toPlainDate(),
                dayOfNanoseconds: ctx.conn.instantFromEpochNanoseconds(tInstantValue.instantAt.epochNanoseconds()).toPlainDate(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%Y-%m-%d %H:%M:%f', date(instant_at), ((cast((2 * cast(round((julianday(instant_at) - julianday(date(instant_at))) * 86400000) as integer) + 3600000) / 7200000 as integer) * 3600000) / 1000.0) || ' seconds') as hour, strftime('%Y-%m-%d %H:%M:%f', instant_at, ?1) as later, date(strftime('%Y-%m-%d %H:%M:%f', instant_at, ?2)) as earlier, date(strftime('%Y-%m-%d %H:%M:%f', date('1970-01-01', (cast((round(unixepoch(instant_at, 'subsec') * 1000) - ((round(unixepoch(instant_at, 'subsec') * 1000) % 86400000 + 86400000) % 86400000)) / 86400000 as integer)) || ' days'), ((((round(unixepoch(instant_at, 'subsec') * 1000) % 86400000 + 86400000) % 86400000) * 1000000) / 1000000000.0) || ' seconds')) as day, date(strftime('%Y-%m-%d %H:%M:%f', date('1970-01-01', (cast(((cast(round(unixepoch(instant_at, 'subsec') * 1000) as integer) * 1000000) - (((cast(round(unixepoch(instant_at, 'subsec') * 1000) as integer) * 1000000) % 86400000000000 + 86400000000000) % 86400000000000)) / 86400000000000 as integer)) || ' days'), (((((cast(round(unixepoch(instant_at, 'subsec') * 1000) as integer) * 1000000) % 86400000000000 + 86400000000000) % 86400000000000)) / 1000000000.0) || ' seconds')) as dayOfNanoseconds from instant_value where id = ?3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "3600 seconds",
            "-1800 seconds",
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ hour: Temporal.PlainDateTime; later: Temporal.PlainDateTime; earlier: Temporal.PlainDate; day: Temporal.PlainDate; dayOfNanoseconds: Temporal.PlainDate }>>>()
        expect(rows.map(row => [row.hour.toString(), row.later.toString(), row.earlier.toString(), row.day.toString(), row.dayOfNanoseconds.toString()])).toEqual([[
            deployed.round('hour').toZonedDateTimeISO('UTC').toPlainDateTime().toString(),
            deployed.add({ hours: 1 }).toZonedDateTimeISO('UTC').toPlainDateTime().toString(),
            deployed.subtract({ minutes: 30 }).toZonedDateTimeISO('UTC').toPlainDate().toString(),
            deployed.toZonedDateTimeISO('UTC').toPlainDate().toString(),
            deployed.toZonedDateTimeISO('UTC').toPlainDate().toString(),
        ]])
    })

    test('an-instant-before-1970-rounded-as-temporal', async () => {
        // Temporal rounds an instant as if it were positive: before 1970 trunc is floor too
        const instant = Temporal.Instant.from('1969-12-31T23:59:30.5Z')
        ctx.mockNext({ trunc: '1969-12-31 23:59:00.000', ceil: '1970-01-01 00:00:00.000', day: '1970-01-01 00:00:00.000' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                trunc: ctx.conn.const(instant, 'instant').round({ smallestUnit: 'minute', roundingMode: 'trunc' }),
                ceil: ctx.conn.const(instant, 'instant').round({ smallestUnit: 'minute', roundingMode: 'ceil' }),
                day: ctx.conn.const(instant, 'instant').round({ smallestUnit: 'hour', roundingIncrement: 24 }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%Y-%m-%d %H:%M:%f', date(?1), ((cast(cast(round((julianday(?2) - julianday(date(?2))) * 86400000) as integer) / 60000 as integer) * 60000) / 1000.0) || ' seconds') as trunc, strftime('%Y-%m-%d %H:%M:%f', date(?3), ((cast((cast(round((julianday(?4) - julianday(date(?4))) * 86400000) as integer) + 59999) / 60000 as integer) * 60000) / 1000.0) || ' seconds') as ceil, strftime('%Y-%m-%d %H:%M:%f', date(?5), ((cast((2 * cast(round((julianday(?6) - julianday(date(?6))) * 86400000) as integer) + 86400000) / 172800000 as integer) * 86400000) / 1000.0) || ' seconds') as day"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1969-12-31 23:59:30.500",
            "1969-12-31 23:59:30.500",
            "1969-12-31 23:59:30.500",
            "1969-12-31 23:59:30.500",
            "1969-12-31 23:59:30.500",
            "1969-12-31 23:59:30.500",
          ]
        `)
        expect([row.trunc.toString(), row.ceil.toString(), row.day.toString()]).toEqual([
            instant.round({ smallestUnit: 'minute', roundingMode: 'trunc' }).toString(),
            instant.round({ smallestUnit: 'minute', roundingMode: 'ceil' }).toString(),
            instant.round({ smallestUnit: 'hour', roundingIncrement: 24 }).toString(),
        ])
    })
})
