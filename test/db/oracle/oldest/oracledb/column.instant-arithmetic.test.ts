// The arithmetic of an instant (Temporal.Instant), as Temporal's: plus and minus a duration of the time, the duration
// between two instants, and rounded. instant_value row 1 is 2024-01-14T09:15:30.123456Z, written with the offset +09:00
// where the column keeps one, and row 2 is 1969-07-20T20:17:40Z. Every value expected is the one Temporal gives; a
// duration is compared as Temporal compares two of them (PostgreSQL keeps it in an interval, without its fields).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tInstantValue } from '../../domain/connection.js'
import { ctx } from './setup.js'

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(sys_extract_utc(cast(from_tz(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) + numtodsinterval(:0 + :1 / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "plus", to_char(sys_extract_utc(cast(from_tz(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) + numtodsinterval(:2 + :3 / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "minus" from instant_value where id = :4"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "91800",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", tsq_duration_text(0, 0, 0, 0, ((trunc(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))) * 86400000000000 + ((extract(hour from (cast(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))))) * 1000000000 - (extract(hour from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))))) * 1000000000)), 'second') as "seconds", tsq_duration_text(0, 0, 0, 0, ((trunc(sys_extract_utc(cast(to_timestamp(:2, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))) * 86400000000000 + ((extract(hour from (cast(sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))))) * 1000000000 - (extract(hour from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))))) * 1000000000)), 'hour') as "hours", tsq_duration_text(0, 0, 0, 0, -(((trunc(sys_extract_utc(cast(to_timestamp(:4, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))) * 86400000000000 + ((extract(hour from (cast(sys_extract_utc(cast(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))))) * 1000000000 - (extract(hour from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))))) * 1000000000)) - (mod(((trunc(sys_extract_utc(cast(to_timestamp(:6, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))) * 86400000000000 + ((extract(hour from (cast(sys_extract_utc(cast(to_timestamp(:7, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:7, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(to_timestamp(:7, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:7, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(to_timestamp(:7, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:7, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))))) * 1000000000 - (extract(hour from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))))) * 1000000000)), 60000000000)) + case when (mod(((trunc(sys_extract_utc(cast(to_timestamp(:8, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))) * 86400000000000 + ((extract(hour from (cast(sys_extract_utc(cast(to_timestamp(:9, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:9, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(to_timestamp(:9, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:9, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(to_timestamp(:9, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:9, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))))) * 1000000000 - (extract(hour from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))))) * 1000000000)), 60000000000)) > 0 then 60000000000 else 0 end), 'minute') as "minutes" from instant_value order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc((2 * (extract(hour from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))))) * 1000000000 + 3600000000000) / 7200000000000) * 3600000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "hour", to_char(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc((2 * (extract(hour from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))))) * 1000000000 + 5400000000000) / 10800000000000) * 5400000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "ninety", to_char(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc((extract(hour from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))))) * 1000000000 / 1000000000) * 1000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "floor" from instant_value order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; hour: Temporal.Instant; ninety: Temporal.Instant; floor: Temporal.Instant }>>>()
        expect(rows.map(row => [row.id, row.hour.toString(), row.ninety.toString(), row.floor.toString()])).toEqual([deployed, landed].map((instant, i) => [
            i + 1, instant.round('hour').toString(), instant.round({ smallestUnit: 'minute', roundingIncrement: 90 }).toString(), instant.round({ smallestUnit: 'second', roundingMode: 'floor' }).toString(),
        ]))
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc((extract(hour from (cast(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))))) * 1000000000 / 60000000000) * 60000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "trunc", to_char(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(to_timestamp(:2, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc(((extract(hour from (cast(sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))))) * 1000000000 + 59999999999) / 60000000000) * 60000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "ceil", to_char(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(to_timestamp(:4, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc((2 * (extract(hour from (cast(sys_extract_utc(cast(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))))) * 1000000000 + 86400000000000) / 172800000000000) * 86400000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "day" from dual"`)
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
