// An exact moment in a time zone (Temporal.ZonedDateTime), which only a database that keeps a zone with each value has:
// kept, read, its parts, an instant or a wall clock taken to a zone with Temporal's disambiguation, and compared by its
// instant. zoned_value row 1 is 2024-10-27T02:30:00.123456789+02:00[Europe/Madrid] with the wall clock 2024-10-27 02:30,
// which Madrid repeats; row 2 is 2024-01-14T14:45:30.123456789+05:30[Asia/Kolkata] with 2024-03-31 02:30, which Madrid
// skips, and the zone America/New_York; row 3 is 1969-07-20T15:17:40-05:00[-05:00] with 2024-01-14 10:00, without zone.
// Every value expected is the one Temporal gives.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'
import { tInstantValue, tZonedValue } from '../../domain/connection.js'
import { ctx } from './setup.js'

const zoned = [
    Temporal.ZonedDateTime.from('2024-10-27T02:30:00.123456789+02:00[Europe/Madrid]'),
    Temporal.Instant.from('2024-01-14T09:15:30.123456789Z').toZonedDateTimeISO('Asia/Kolkata'),
    Temporal.ZonedDateTime.from('1969-07-20T15:17:40-05:00[-05:00]'),
]
const walls = [Temporal.PlainDateTime.from('2024-10-27T02:30:00'), Temporal.PlainDateTime.from('2024-03-31T02:30:00'), Temporal.PlainDateTime.from('2024-01-14T10:00:00')]
const zoneNames = ['Europe/Madrid', 'America/New_York', undefined]

/** The reason of the error the construction of the query throws, or 'no error' */
async function reasonOf(query: () => unknown): Promise<string> {
    try {
        await query()
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

    test('a-zoned-date-and-time-kept-and-read', async () => {
        // A zoned date and time sent keeps its instant and its zone; one read is the one kept
        await ctx.withRollback(async () => {
            const summer = Temporal.ZonedDateTime.from('2024-07-01T12:00:00.987654321+02:00[Europe/Madrid]')
            ctx.mockNext(1)
            await ctx.conn.insertInto(tZonedValue).set({ id: 10, zonedAt: summer }).executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into zoned_value (id, zoned_at) values (:0, (from_tz(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), '+00:00') at time zone 'Europe/Madrid'))"`)
            expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
              [
                "10",
                "2024-07-01T12:00:00.987654321+02:00[Europe/Madrid]",
              ]
            `)
            ctx.mockNext([...zoned, summer].map((value, i) => ({ id: i < 3 ? i + 1 : 10, zonedAt: value.toInstant().toString() + ' AD[' + value.timeZoneId.toUpperCase() + ']' })))
            const rows = await ctx.conn.selectFrom(tZonedValue)
                .select({ id: tZonedValue.id, zonedAt: tZonedValue.zonedAt })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when zoned_at is not null then to_char(sys_extract_utc(zoned_at), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char(zoned_at, 'TZR') || ']' end as "zonedAt" from zoned_value order by "id""`)
            assertType<Exact<typeof rows, Array<{ id: number; zonedAt: Temporal.ZonedDateTime }>>>()
            expect(rows.map(row => [row.id, row.zonedAt.toString()])).toEqual([[1, zoned[0]!.toString()], [2, zoned[1]!.toString()], [3, zoned[2]!.toString()], [10, summer.toString()]])
        })
    })

    test('the-parts-of-a-zoned-date-and-time', async () => {
        ctx.mockNext(zoned.map((value, i) => ({
            id: i + 1, instant: value.toInstant().toString() + ' AD', wall: value.toPlainDateTime().toString() + ' AD', day: value.toPlainDate().toString() + ' AD', time: '1970-01-01T' + value.toPlainTime().toString() + ' AD',
            zone: value.timeZoneId, offset: value.offset, offsetNanoseconds: value.offsetNanoseconds, milliseconds: value.epochMilliseconds, nanoseconds: String(value.epochNanoseconds),
            year: value.year, month: value.month, dayOfMonth: value.day, dayOfWeek: value.dayOfWeek, dayOfYear: value.dayOfYear, hour: value.hour, minute: value.minute, second: value.second, millisecond: value.millisecond, microsecond: value.microsecond,
        })))
        const rows = await ctx.conn.selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                instant: tZonedValue.zonedAt.toInstant(),
                wall: tZonedValue.zonedAt.toPlainDateTime(),
                day: tZonedValue.zonedAt.toPlainDate(),
                time: tZonedValue.zonedAt.toPlainTime(),
                zone: tZonedValue.zonedAt.timeZoneId(),
                offset: tZonedValue.zonedAt.offset(),
                offsetNanoseconds: tZonedValue.zonedAt.offsetNanoseconds(),
                milliseconds: tZonedValue.zonedAt.epochMilliseconds(),
                nanoseconds: tZonedValue.zonedAt.epochNanoseconds(),
                year: tZonedValue.zonedAt.year(),
                month: tZonedValue.zonedAt.month(),
                dayOfMonth: tZonedValue.zonedAt.day(),
                dayOfWeek: tZonedValue.zonedAt.dayOfWeek(),
                dayOfYear: tZonedValue.zonedAt.dayOfYear(),
                hour: tZonedValue.zonedAt.hour(),
                minute: tZonedValue.zonedAt.minute(),
                second: tZonedValue.zonedAt.second(),
                millisecond: tZonedValue.zonedAt.millisecond(),
                microsecond: tZonedValue.zonedAt.microsecond(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "instant", to_char(cast(zoned_at as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "wall", to_char(trunc(cast(zoned_at as timestamp(9))), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "day", to_char(cast(timestamp '1970-01-01 00:00:00' + (cast(zoned_at as timestamp(9)) - trunc(cast(zoned_at as timestamp(9)))) as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "time", coalesce((select min(tzname) from v$timezone_names where upper(tzname) = to_char(zoned_at, 'TZR')), to_char(zoned_at, 'TZR')) as "zone", to_char(zoned_at, 'TZH:TZM') as "offset", (extract(timezone_hour from zoned_at) * 3600 + extract(timezone_minute from zoned_at) * 60) * 1000000000 as "offsetNanoseconds", (trunc(timestamp '1970-01-01 00:00:00' + (zoned_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (zoned_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "milliseconds", (trunc(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone))) - date '1970-01-01') * 86400000000000 + to_number(to_char(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), 'SSSSSFF9')) as "nanoseconds", extract(year from cast(zoned_at as timestamp(9))) as "year", extract(month from cast(zoned_at as timestamp(9))) as "month", extract(day from cast(zoned_at as timestamp(9))) as "dayOfMonth", trunc(cast(zoned_at as timestamp(9))) - trunc(cast(zoned_at as timestamp(9)), 'IW') + 1 as "dayOfWeek", to_number(to_char(cast(zoned_at as timestamp(9)), 'DDD')) as "dayOfYear", extract(hour from cast(zoned_at as timestamp(9))) as "hour", extract(minute from cast(zoned_at as timestamp(9))) as "minute", trunc(extract(second from cast(zoned_at as timestamp(9)))) as "second", to_number(to_char(cast(zoned_at as timestamp(9)), 'FF3')) as "millisecond", mod(to_number(to_char(cast(zoned_at as timestamp(9)), 'FF6')), 1000) as "microsecond" from zoned_value order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows.map(row => [row.id, row.instant.toString(), row.wall.toString(), row.day.toString(), row.time.toString(), row.zone, row.offset, row.offsetNanoseconds, row.milliseconds, row.nanoseconds,
            row.year, row.month, row.dayOfMonth, row.dayOfWeek, row.dayOfYear, row.hour, row.minute, row.second, row.millisecond, row.microsecond])).toEqual(zoned.map((value, i) => [
            i + 1, value.toInstant().toString(), value.toPlainDateTime().toString(), value.toPlainDate().toString(), value.toPlainTime().toString(), value.timeZoneId, value.offset, value.offsetNanoseconds, value.epochMilliseconds, value.epochNanoseconds,
            value.year, value.month, value.day, value.dayOfWeek, value.dayOfYear, value.hour, value.minute, value.second, value.millisecond, value.microsecond,
        ]))
    })

    test('an-instant-in-a-zone', async () => {
        // The same instant in another zone, in the zone of a column (none in row 3), and an instant given in an offset zone
        ctx.mockNext(zoned.map((value, i) => ({
            id: i + 1,
            tokyo: value.toInstant().toString() + ' AD[ASIA/TOKYO]',
            ofColumn: zoneNames[i] === undefined ? null : value.toInstant().toString() + ' AD[' + zoneNames[i]!.toUpperCase() + ']',
            newYork: value.toInstant().toString() + ' AD[AMERICA/NEW_YORK]',
            offsetZone: '2024-01-14T09:15:30.123456789Z AD[+05:30]',
        })))
        const rows = await ctx.conn.selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                tokyo: tZonedValue.zonedAt.withTimeZone('Asia/Tokyo'),
                ofColumn: tZonedValue.zonedAt.withTimeZone(tZonedValue.zoneName),
                newYork: tZonedValue.zonedAt.toInstant().toZonedDateTimeISO('America/New_York'),
                offsetZone: ctx.conn.const(Temporal.Instant.from('2024-01-14T09:15:30.123456789Z'), 'instant').toZonedDateTimeISO('+05:30'),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when (from_tz(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), '+00:00') at time zone 'Asia/Tokyo') is not null then to_char(sys_extract_utc((from_tz(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), '+00:00') at time zone 'Asia/Tokyo')), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char((from_tz(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), '+00:00') at time zone 'Asia/Tokyo'), 'TZR') || ']' end as "tokyo", case when (from_tz(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), '+00:00') at time zone zone_name) is not null then to_char(sys_extract_utc((from_tz(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), '+00:00') at time zone zone_name)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char((from_tz(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), '+00:00') at time zone zone_name), 'TZR') || ']' end as "ofColumn", case when (from_tz(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), '+00:00') at time zone 'America/New_York') is not null then to_char(sys_extract_utc((from_tz(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), '+00:00') at time zone 'America/New_York')), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char((from_tz(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), '+00:00') at time zone 'America/New_York'), 'TZR') || ']' end as "newYork", case when (from_tz(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), '+00:00') at time zone '+05:30') is not null then to_char(sys_extract_utc((from_tz(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), '+00:00') at time zone '+05:30')), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char((from_tz(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), '+00:00') at time zone '+05:30'), 'TZR') || ']' end as "offsetZone" from zoned_value order by "id""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-14T09:15:30.123456789Z",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; tokyo: Temporal.ZonedDateTime; ofColumn?: Temporal.ZonedDateTime; newYork: Temporal.ZonedDateTime; offsetZone: Temporal.ZonedDateTime }>>>()
        expect(rows.map(row => [row.id, row.tokyo.toString(), row.ofColumn?.toString(), row.newYork.toString(), row.offsetZone.toString()])).toEqual(zoned.map((value, i) => [
            i + 1, value.withTimeZone('Asia/Tokyo').toString(), zoneNames[i] === undefined ? undefined : value.withTimeZone(zoneNames[i]!).toString(), value.toInstant().toZonedDateTimeISO('America/New_York').toString(),
            Temporal.Instant.from('2024-01-14T09:15:30.123456789Z').toZonedDateTimeISO('+05:30').toString(),
        ]))
    })

    test('a-wall-clock-in-a-zone-with-each-disambiguation', async () => {
        // Row 1's wall clock is repeated in Madrid, row 2's skipped: compatible takes the earlier of a repeated one and
        // the later of a skipped one, earlier and later what they say; in the zone of a column, compatible
        ctx.mockNext(walls.map((wall, i) => ({
            id: i + 1,
            compatible: wall.toZonedDateTime('Europe/Madrid').toInstant().toString() + ' AD[EUROPE/MADRID]',
            earlier: wall.toZonedDateTime('Europe/Madrid', { disambiguation: 'earlier' }).toInstant().toString() + ' AD[EUROPE/MADRID]',
            later: wall.toZonedDateTime('Europe/Madrid', { disambiguation: 'later' }).toInstant().toString() + ' AD[EUROPE/MADRID]',
            ofColumn: zoneNames[i] === undefined ? null : wall.toZonedDateTime(zoneNames[i]!).toInstant().toString() + ' AD[' + zoneNames[i]!.toUpperCase() + ']',
        })))
        const rows = await ctx.conn.selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                compatible: tZonedValue.wallAt.toZonedDateTime('Europe/Madrid'),
                earlier: tZonedValue.wallAt.toZonedDateTime('Europe/Madrid', { disambiguation: 'earlier' }),
                later: tZonedValue.wallAt.toZonedDateTime('Europe/Madrid', { disambiguation: 'later' }),
                ofColumn: tZonedValue.wallAt.toZonedDateTime(tZonedValue.zoneName),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when (from_tz(case when not (cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9))) and cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) then (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) else (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid') is not null then to_char(sys_extract_utc((from_tz(case when not (cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9))) and cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) then (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) else (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid')), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char((from_tz(case when not (cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9))) and cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) then (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) else (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid'), 'TZR') || ']' end as "compatible", case when (from_tz(case when cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) then (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) else (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid') is not null then to_char(sys_extract_utc((from_tz(case when cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) then (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) else (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid')), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char((from_tz(case when cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) then (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) else (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid'), 'TZR') || ']' end as "earlier", case when (from_tz(case when cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) then (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) else (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid') is not null then to_char(sys_extract_utc((from_tz(case when cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) then (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) else (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid')), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char((from_tz(case when cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) then (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) else (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid'), 'TZR') || ']' end as "later", case when (from_tz(case when not (cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone zone_name) as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone zone_name) as timestamp(9)) = cast(wall_at as timestamp(9))) and cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone zone_name) as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone zone_name) as timestamp(9)) = cast(wall_at as timestamp(9)) then (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone zone_name) as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) else (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone zone_name) as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone zone_name) is not null then to_char(sys_extract_utc((from_tz(case when not (cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone zone_name) as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone zone_name) as timestamp(9)) = cast(wall_at as timestamp(9))) and cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone zone_name) as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone zone_name) as timestamp(9)) = cast(wall_at as timestamp(9)) then (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone zone_name) as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) else (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone zone_name) as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone zone_name)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char((from_tz(case when not (cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone zone_name) as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone zone_name) as timestamp(9)) = cast(wall_at as timestamp(9))) and cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone zone_name) as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone zone_name) as timestamp(9)) = cast(wall_at as timestamp(9)) then (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone zone_name) as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) else (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone zone_name) as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone zone_name), 'TZR') || ']' end as "ofColumn" from zoned_value order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; compatible?: Temporal.ZonedDateTime; earlier?: Temporal.ZonedDateTime; later?: Temporal.ZonedDateTime; ofColumn?: Temporal.ZonedDateTime }>>>()
        expect(rows.map(row => [row.id, row.compatible?.toString(), row.earlier?.toString(), row.later?.toString(), row.ofColumn?.toString()])).toEqual(walls.map((wall, i) => [
            i + 1, wall.toZonedDateTime('Europe/Madrid').toString(), wall.toZonedDateTime('Europe/Madrid', { disambiguation: 'earlier' }).toString(), wall.toZonedDateTime('Europe/Madrid', { disambiguation: 'later' }).toString(),
            zoneNames[i] === undefined ? undefined : wall.toZonedDateTime(zoneNames[i]!).toString(),
        ]))
    })

    test('reject-fails-for-a-wall-clock-the-zone-repeats-or-skips', async () => {
        // As Temporal: row 1's wall clock is repeated in Madrid and row 2's skipped; row 3's is a wall clock of Madrid
        const failures: boolean[] = []
        for (const id of [1, 2, 3]) {
            ctx.mockNext([walls[id - 1]!.toZonedDateTime('Europe/Madrid').toInstant().toString() + ' AD[EUROPE/MADRID]'])
            failures.push(await failureOf(ctx.conn.selectFrom(tZonedValue)
                .where(tZonedValue.id.equals(id))
                .selectOneColumn(tZonedValue.wallAt.toZonedDateTime('Europe/Madrid', { disambiguation: 'reject' }))
                .executeSelectMany()))
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when (from_tz((case when cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) then (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) else (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) end) + numtodsinterval((extract(day from to_date((2001) || '-' || (2) || '-' || (case when cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) and cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) and (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) <> (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) or not (cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9))) and not (cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9))) then 29 else 28 end), 'YYYY-MM-DD')) - 28), 'day'), '+00:00') at time zone 'Europe/Madrid') is not null then to_char(sys_extract_utc((from_tz((case when cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) then (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) else (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) end) + numtodsinterval((extract(day from to_date((2001) || '-' || (2) || '-' || (case when cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) and cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) and (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) <> (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) or not (cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9))) and not (cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9))) then 29 else 28 end), 'YYYY-MM-DD')) - 28), 'day'), '+00:00') at time zone 'Europe/Madrid')), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char((from_tz((case when cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) then (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) else (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) end) + numtodsinterval((extract(day from to_date((2001) || '-' || (2) || '-' || (case when cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) and cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9)) and (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))) <> (cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))) or not (cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9))) and not (cast((from_tz((cast(wall_at as timestamp(9)) - (cast((from_tz((cast(wall_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(wall_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(wall_at as timestamp(9))) then 29 else 28 end), 'YYYY-MM-DD')) - 28), 'day'), '+00:00') at time zone 'Europe/Madrid'), 'TZR') || ']' end as "result" from zoned_value where id = :0"`)
        expect(failures).toEqual([ctx.realDbEnabled, ctx.realDbEnabled, false])
    })

    test('zoned-date-and-times-compared-by-their-instant', async () => {
        // Compared and ordered by their instant, as Temporal's compare: row 2 in Tokyo is row 2 (Temporal's equals also
        // compares the zone)
        ctx.mockNext([1])
        const later = await ctx.conn.selectFrom(tZonedValue)
            .where(tZonedValue.zonedAt.greaterThan(zoned[1]!.withTimeZone('UTC')))
            .selectOneColumn(tZonedValue.id)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "result" from zoned_value where zoned_at > (from_tz(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), '+00:00') at time zone 'UTC')"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-14T09:15:30.123456789+00:00[UTC]",
          ]
        `)
        ctx.mockNext([2])
        const same = await ctx.conn.selectFrom(tZonedValue)
            .where(tZonedValue.zonedAt.equals(zoned[1]!.withTimeZone('Asia/Tokyo')))
            .selectOneColumn(tZonedValue.id)
            .executeSelectMany()
        ctx.mockNext([3, 2, 1].map(id => ({ id, at: zoned[id - 1]!.toInstant().toString() + ' AD[' + zoned[id - 1]!.timeZoneId.toUpperCase() + ']' })))
        const ordered = (await ctx.conn.selectFrom(tZonedValue)
            .select({ id: tZonedValue.id, at: tZonedValue.zonedAt })
            .orderBy('at')
            .executeSelectMany()).map(row => row.id)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", case when zoned_at is not null then to_char(sys_extract_utc(zoned_at), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char(zoned_at, 'TZR') || ']' end as "at" from zoned_value order by zoned_value.zoned_at"`)
        expect([later, same, ordered]).toEqual([
            zoned.flatMap((value, i) => Temporal.ZonedDateTime.compare(value, zoned[1]!) > 0 ? [i + 1] : []),
            [2],
            zoned.map((value, i) => ({ value, id: i + 1 })).sort((a, b) => Temporal.ZonedDateTime.compare(a.value, b.value)).map(entry => entry.id),
        ])
    })

    test('a-zoned-date-and-time-needs-a-database-with-zones', async () => {
        // Oracle keeps a zone with each value: the query is built
        ctx.mockNext([{ id: 1, at: '2024-01-14T09:15:30.123456Z AD[EUROPE/MADRID]' }])
        const reason = await reasonOf(() => ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.id.equals(1))
            .select({ id: tInstantValue.id, at: tInstantValue.instantAt.toZonedDateTimeISO('Europe/Madrid') })
            .executeSelectMany())
        expect(reason).toBe('no error')
    })
})
