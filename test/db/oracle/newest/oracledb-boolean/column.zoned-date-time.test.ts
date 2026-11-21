// An exact moment in a time zone (Temporal.ZonedDateTime), which only a database that keeps a zone with each value has:
// kept, read, its parts, an instant or a wall clock taken to a zone with Temporal's disambiguation, and compared by its
// instant. zoned_value row 1 is 2024-10-27T02:30:00.123456789+02:00[Europe/Madrid] with the wall clock 2024-10-27 02:30,
// which Madrid repeats; row 2 is 2024-01-14T14:45:30.123456789+05:30[Asia/Kolkata] with 2024-03-31 02:30, which Madrid
// skips, and the zone America/New_York; row 3 is 1969-07-20T15:17:40-05:00[-05:00] with 2024-01-14 10:00, without zone.
// Every value expected is the one Temporal gives, with the functions of the library (temporalFunctions); without them a
// wall clock the zone repeats is the later instant, and one it skips makes the query fail, as Oracle takes them.

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
            await ctx.withTemporalFunctions().insertInto(tZonedValue).set({ id: 10, zonedAt: summer }).executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into zoned_value (id, zoned_at) values (:0, (from_tz(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), '+00:00') at time zone 'Europe/Madrid'))"`)
            expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
              [
                "10",
                "2024-07-01T12:00:00.987654321+02:00[Europe/Madrid]",
              ]
            `)
            ctx.mockNext([...zoned, summer].map((value, i) => ({ id: i < 3 ? i + 1 : 10, zonedAt: value.toInstant().toString() + ' AD[' + value.timeZoneId.toUpperCase() + ']' })))
            const rows = await ctx.withTemporalFunctions().selectFrom(tZonedValue)
                .select({ id: tZonedValue.id, zonedAt: tZonedValue.zonedAt })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(zoned_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "zonedAt" from zoned_value order by "id""`)
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
        const rows = await ctx.withTemporalFunctions().selectFrom(tZonedValue)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "instant", to_char(cast(zoned_at as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "wall", to_char(trunc(cast(zoned_at as timestamp(9))), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "day", to_char(cast(timestamp '1972-01-01 00:00:00' + (cast(zoned_at as timestamp(9)) - trunc(cast(zoned_at as timestamp(9)))) as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "time", coalesce((select min(tzname) from v$timezone_names where upper(tzname) = to_char(zoned_at, 'TZR')), to_char(zoned_at, 'TZR')) as "zone", to_char(zoned_at, 'TZH:TZM') as "offset", (extract(timezone_hour from zoned_at) * 3600 + extract(timezone_minute from zoned_at) * 60) * 1000000000 as "offsetNanoseconds", (trunc(timestamp '1970-01-01 00:00:00' + (zoned_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (zoned_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "milliseconds", (trunc(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone))) - date '1970-01-01') * 86400000000000 + to_number(to_char(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), 'SSSSSFF9')) as "nanoseconds", extract(year from cast(zoned_at as timestamp(9))) as "year", extract(month from cast(zoned_at as timestamp(9))) as "month", extract(day from cast(zoned_at as timestamp(9))) as "dayOfMonth", trunc(cast(zoned_at as timestamp(9))) - trunc(cast(zoned_at as timestamp(9)), 'IW') + 1 as "dayOfWeek", to_number(to_char(cast(zoned_at as timestamp(9)), 'DDD')) as "dayOfYear", extract(hour from cast(zoned_at as timestamp(9))) as "hour", extract(minute from cast(zoned_at as timestamp(9))) as "minute", trunc(extract(second from cast(zoned_at as timestamp(9)))) as "second", to_number(to_char(cast(zoned_at as timestamp(9)), 'FF3')) as "millisecond", mod(to_number(to_char(cast(zoned_at as timestamp(9)), 'FF6')), 1000) as "microsecond" from zoned_value order by "id""`)
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
        const rows = await ctx.withTemporalFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                tokyo: tZonedValue.zonedAt.withTimeZone('Asia/Tokyo'),
                ofColumn: tZonedValue.zonedAt.withTimeZone(tZonedValue.zoneName),
                newYork: tZonedValue.zonedAt.toInstant().toZonedDateTimeISO('America/New_York'),
                offsetZone: ctx.withTemporalFunctions().const(Temporal.Instant.from('2024-01-14T09:15:30.123456789Z'), 'instant').toZonedDateTimeISO('+05:30'),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(from_tz(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), '+00:00') at time zone 'Asia/Tokyo', 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "tokyo", to_char(from_tz(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), '+00:00') at time zone zone_name, 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "ofColumn", to_char(from_tz(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), '+00:00') at time zone 'America/New_York', 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "newYork", to_char(from_tz(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), '+00:00') at time zone '+05:30', 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "offsetZone" from zoned_value order by "id""`)
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
        const rows = await ctx.withTemporalFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                compatible: tZonedValue.wallAt.toZonedDateTime('Europe/Madrid'),
                earlier: tZonedValue.wallAt.toZonedDateTime('Europe/Madrid', { disambiguation: 'earlier' }),
                later: tZonedValue.wallAt.toZonedDateTime('Europe/Madrid', { disambiguation: 'later' }),
                ofColumn: tZonedValue.wallAt.toZonedDateTime(tZonedValue.zoneName),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(tsq_zoned_of_wall(cast(wall_at as timestamp(9)), 'Europe/Madrid', 'compatible'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "compatible", to_char(tsq_zoned_of_wall(cast(wall_at as timestamp(9)), 'Europe/Madrid', 'earlier'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "earlier", to_char(tsq_zoned_of_wall(cast(wall_at as timestamp(9)), 'Europe/Madrid', 'later'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "later", to_char(tsq_zoned_of_wall(cast(wall_at as timestamp(9)), zone_name, 'compatible'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "ofColumn" from zoned_value order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; compatible?: Temporal.ZonedDateTime; earlier?: Temporal.ZonedDateTime; later?: Temporal.ZonedDateTime; ofColumn?: Temporal.ZonedDateTime }>>>()
        expect(rows.map(row => [row.id, row.compatible?.toString(), row.earlier?.toString(), row.later?.toString(), row.ofColumn?.toString()])).toEqual(walls.map((wall, i) => [
            i + 1, wall.toZonedDateTime('Europe/Madrid').toString(), wall.toZonedDateTime('Europe/Madrid', { disambiguation: 'earlier' }).toString(), wall.toZonedDateTime('Europe/Madrid', { disambiguation: 'later' }).toString(),
            zoneNames[i] === undefined ? undefined : wall.toZonedDateTime(zoneNames[i]!).toString(),
        ]))
        // Without the functions of the library, the instant Oracle gives: the later one of row 1's wall clock, which Madrid
        // repeats, as Temporal's 'later'; row 2's, which Madrid skips, makes the query fail (ORA-01878); 'earlier' and
        // 'reject' need the functions
        ctx.mockNext([walls[0], walls[2]].map((wall, i) => ({ id: i === 0 ? 1 : 3, compatible: wall!.toZonedDateTime('Europe/Madrid', { disambiguation: 'later' }).toInstant().toString() + ' AD[EUROPE/MADRID]' })))
        const native = await ctx.conn.selectFrom(tZonedValue)
            .where(tZonedValue.id.in([1, 3]))
            .select({ id: tZonedValue.id, compatible: tZonedValue.wallAt.toZonedDateTime('Europe/Madrid') })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(from_tz(cast(wall_at as timestamp(9)), 'Europe/Madrid'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "compatible" from zoned_value where id in (:0, :1) order by "id""`)
        expect(native.map(row => [row.id, row.compatible?.toString()])).toEqual([1, 3].map(id => [id, walls[id - 1]!.toZonedDateTime('Europe/Madrid', { disambiguation: 'later' }).toString()]))
        ctx.mockNext([])
        expect(await failureOf(ctx.conn.selectFrom(tZonedValue).where(tZonedValue.id.equals(2)).selectOneColumn(tZonedValue.wallAt.toZonedDateTime('Europe/Madrid')).executeSelectMany())).toBe(ctx.realDbEnabled)
        expect(await reasonOf(() => ctx.conn.selectFrom(tZonedValue).selectOneColumn(tZonedValue.wallAt.toZonedDateTime('Europe/Madrid', { disambiguation: 'earlier' })).executeSelectMany())).toBe('UNSUPPORTED_QUERY')
        expect(await reasonOf(() => ctx.conn.selectFrom(tZonedValue).selectOneColumn(tZonedValue.wallAt.toZonedDateTime('Europe/Madrid', { disambiguation: 'reject' })).executeSelectMany())).toBe('UNSUPPORTED_QUERY')
    })

    test('reject-fails-for-a-wall-clock-the-zone-repeats-or-skips', async () => {
        // As Temporal: row 1's wall clock is repeated in Madrid and row 2's skipped; row 3's is a wall clock of Madrid
        const failures: boolean[] = []
        for (const id of [1, 2, 3]) {
            ctx.mockNext([walls[id - 1]!.toZonedDateTime('Europe/Madrid').toInstant().toString() + ' AD[EUROPE/MADRID]'])
            failures.push(await failureOf(ctx.withTemporalFunctions().selectFrom(tZonedValue)
                .where(tZonedValue.id.equals(id))
                .selectOneColumn(tZonedValue.wallAt.toZonedDateTime('Europe/Madrid', { disambiguation: 'reject' }))
                .executeSelectMany()))
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(tsq_zoned_of_wall(cast(wall_at as timestamp(9)), 'Europe/Madrid', 'reject'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "result" from zoned_value where id = :0"`)
        expect(failures).toEqual([ctx.realDbEnabled, ctx.realDbEnabled, false])
    })

    test('zoned-date-and-times-compared-by-their-instant', async () => {
        // Compared and ordered by their instant, as Temporal's compare: row 2 in Tokyo is row 2 (Temporal's equals also
        // compares the zone)
        ctx.mockNext([1])
        const later = await ctx.withTemporalFunctions().selectFrom(tZonedValue)
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
        const same = await ctx.withTemporalFunctions().selectFrom(tZonedValue)
            .where(tZonedValue.zonedAt.equals(zoned[1]!.withTimeZone('Asia/Tokyo')))
            .selectOneColumn(tZonedValue.id)
            .executeSelectMany()
        ctx.mockNext([3, 2, 1].map(id => ({ id, at: zoned[id - 1]!.toInstant().toString() + ' AD[' + zoned[id - 1]!.timeZoneId.toUpperCase() + ']' })))
        const ordered = (await ctx.withTemporalFunctions().selectFrom(tZonedValue)
            .select({ id: tZonedValue.id, at: tZonedValue.zonedAt })
            .orderBy('at')
            .executeSelectMany()).map(row => row.id)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(zoned_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "at" from zoned_value order by zoned_value.zoned_at"`)
        expect([later, same, ordered]).toEqual([
            zoned.flatMap((value, i) => Temporal.ZonedDateTime.compare(value, zoned[1]!) > 0 ? [i + 1] : []),
            [2],
            zoned.map((value, i) => ({ value, id: i + 1 })).sort((a, b) => Temporal.ZonedDateTime.compare(a.value, b.value)).map(entry => entry.id),
        ])
    })

    test('a-zoned-date-and-time-plus-a-duration', async () => {
        // Days are added to the wall clock in the zone: row 1 plus a day is 02:30 on the next day, an hour later in UTC,
        // as Madrid goes back an hour; hours are added to the instant; a duration value source as well
        const duration = Temporal.Duration.from('P1DT2H')
        const text = (value: Temporal.ZonedDateTime) => value.toInstant().toString() + ' AD[' + value.timeZoneId.toUpperCase() + ']'
        ctx.mockNext(zoned.map((value, i) => ({
            id: i + 1, nextDay: text(value.add({ days: 1 })), twoHoursBefore: text(value.subtract({ hours: 2 })), monthAndHour: text(value.add({ months: 1, hours: 1 })), ofDuration: text(value.add(duration)),
        })))
        const rows = await ctx.withTemporalFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                nextDay: tZonedValue.zonedAt.add({ days: 1 }),
                twoHoursBefore: tZonedValue.zonedAt.subtract({ hours: 2 }),
                monthAndHour: tZonedValue.zonedAt.add({ months: 1, hours: 1 }),
                ofDuration: tZonedValue.zonedAt.add(ctx.withTemporalFunctions().const(duration, 'duration')),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(tsq_zoned_of_wall((cast(zoned_at as timestamp(9)) + numtodsinterval(:0, 'day')), to_char(zoned_at, 'TZR'), 'compatible'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "nextDay", to_char((zoned_at + numtodsinterval(:1, 'second')), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "twoHoursBefore", to_char((tsq_zoned_of_wall((cast((add_months(trunc(cast(zoned_at as timestamp(9))), :3) - greatest(0, extract(day from add_months(trunc(cast(zoned_at as timestamp(9))), :3)) - extract(day from trunc(cast(zoned_at as timestamp(9)))))) as timestamp(9)) + (cast(zoned_at as timestamp(9)) - trunc(cast(zoned_at as timestamp(9))))), to_char(zoned_at, 'TZR'), 'compatible') + numtodsinterval(:2, 'second')), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "monthAndHour", to_char((select ((case when extract(day from tsq_z.d) <> 0 then tsq_zoned_of_wall((cast(zoned_at as timestamp(9)) + numtodsinterval(extract(day from tsq_z.d), 'day')), to_char(zoned_at, 'TZR'), 'compatible') else zoned_at end) + (tsq_z.d - numtodsinterval(extract(day from tsq_z.d), 'day'))) from (select to_dsinterval(:4) as d from dual where rownum = 1) tsq_z), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "ofDuration" from zoned_value order by "id""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1",
            "-7200",
            "3600",
            "1",
            "P1DT2H",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; nextDay: Temporal.ZonedDateTime; twoHoursBefore: Temporal.ZonedDateTime; monthAndHour: Temporal.ZonedDateTime; ofDuration: Temporal.ZonedDateTime }>>>()
        expect(rows.map(row => [row.id, row.nextDay.toString(), row.twoHoursBefore.toString(), row.monthAndHour.toString(), row.ofDuration.toString()])).toEqual(zoned.map((value, i) => [
            i + 1, value.add({ days: 1 }).toString(), value.subtract({ hours: 2 }).toString(), value.add({ months: 1, hours: 1 }).toString(), value.add(duration).toString(),
        ]))
    })

    test('a-zoned-date-and-time-with-other-fields-rounded-and-at-the-start-of-its-day', async () => {
        // Row 1 is in the first 02:30 of a day Madrid repeats, with 25 hours: with keeps its offset when the zone still
        // has it, round rounds its wall clock, round to a day takes the start of its day or of the next one
        const noon = Temporal.PlainTime.from('12:00')
        const text = (value: Temporal.ZonedDateTime) => value.toInstant().toString() + ' AD[' + value.timeZoneId.toUpperCase() + ']'
        ctx.mockNext(zoned.map((value, i) => ({
            id: i + 1, quarterTo: text(value.with({ minute: 45 })), later: text(value.with({ minute: 45 }, { offset: 'ignore', disambiguation: 'later' })), hour: text(value.round('hour')),
            day: text(value.round('day')), start: text(value.startOfDay()), atNoon: text(value.withPlainTime(noon)), hoursInDay: value.hoursInDay,
        })))
        const rows = await ctx.withTemporalFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                quarterTo: tZonedValue.zonedAt.with({ minute: 45 }),
                later: tZonedValue.zonedAt.with({ minute: 45 }, { offset: 'ignore', disambiguation: 'later' }),
                hour: tZonedValue.zonedAt.round('hour'),
                day: tZonedValue.zonedAt.round('day'),
                start: tZonedValue.zonedAt.startOfDay(),
                atNoon: tZonedValue.zonedAt.withPlainTime(noon),
                hoursInDay: tZonedValue.zonedAt.hoursInDay(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(tsq_zoned_of_wall(cast(cast(zoned_at as timestamp(9)) + numtodsinterval((45 - extract(minute from cast(zoned_at as timestamp(9)))) * 60, 'second') as timestamp(9)), to_char(zoned_at, 'TZR'), 'compatible', to_char(zoned_at, 'TZH:TZM')), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "quarterTo", to_char(tsq_zoned_of_wall(cast(cast(zoned_at as timestamp(9)) + numtodsinterval((45 - extract(minute from cast(zoned_at as timestamp(9)))) * 60, 'second') as timestamp(9)), to_char(zoned_at, 'TZR'), 'later'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "later", to_char(tsq_zoned_of_wall(cast(cast(trunc(cast(zoned_at as timestamp(9))) as timestamp(9)) + numtodsinterval((trunc((2 * to_number(to_char(cast(zoned_at as timestamp(9)), 'SSSSSFF9')) + 3600000000000) / 7200000000000) * 3600000000000) / 1000000000, 'second') as timestamp(9)), to_char(zoned_at, 'TZR'), 'compatible', to_char(zoned_at, 'TZH:TZM')), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "hour", to_char((case when (zoned_at - tsq_zoned_of_wall(cast(trunc(cast(zoned_at as timestamp(9))) as timestamp(9)), to_char(zoned_at, 'TZR'), 'compatible')) * 2 >= (tsq_zoned_of_wall(cast(trunc(cast(zoned_at as timestamp(9))) + 1 as timestamp(9)), to_char(zoned_at, 'TZR'), 'compatible') - tsq_zoned_of_wall(cast(trunc(cast(zoned_at as timestamp(9))) as timestamp(9)), to_char(zoned_at, 'TZR'), 'compatible')) then tsq_zoned_of_wall(cast(trunc(cast(zoned_at as timestamp(9))) + 1 as timestamp(9)), to_char(zoned_at, 'TZR'), 'compatible') else tsq_zoned_of_wall(cast(trunc(cast(zoned_at as timestamp(9))) as timestamp(9)), to_char(zoned_at, 'TZR'), 'compatible') end), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "day", to_char(tsq_zoned_of_wall(cast(cast(trunc(cast(zoned_at as timestamp(9))) as timestamp(9)) as timestamp(9)), to_char(zoned_at, 'TZR'), 'compatible'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "start", to_char(tsq_zoned_of_wall(cast(cast(trunc(cast(zoned_at as timestamp(9))) as timestamp(9)) + to_dsinterval('0 ' || to_char(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9)), 'HH24:MI:SS.FF9')) as timestamp(9)), to_char(zoned_at, 'TZR'), 'compatible'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "atNoon", (cast(sys_extract_utc(tsq_zoned_of_wall(cast(trunc(cast(zoned_at as timestamp(9))) + 1 as timestamp(9)), to_char(zoned_at, 'TZR'), 'compatible')) as date) - cast(sys_extract_utc(tsq_zoned_of_wall(cast(trunc(cast(zoned_at as timestamp(9))) as timestamp(9)), to_char(zoned_at, 'TZR'), 'compatible')) as date)) * 24 as "hoursInDay" from zoned_value order by "id""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "12:00:00",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; quarterTo: Temporal.ZonedDateTime; later: Temporal.ZonedDateTime; hour: Temporal.ZonedDateTime; day: Temporal.ZonedDateTime; start: Temporal.ZonedDateTime; atNoon: Temporal.ZonedDateTime; hoursInDay: number }>>>()
        expect(rows.map(row => [row.id, row.quarterTo.toString(), row.later.toString(), row.hour.toString(), row.day.toString(), row.start.toString(), row.atNoon.toString(), row.hoursInDay])).toEqual(zoned.map((value, i) => [
            i + 1, value.with({ minute: 45 }).toString(), value.with({ minute: 45 }, { offset: 'ignore', disambiguation: 'later' }).toString(), value.round('hour').toString(),
            value.round('day').toString(), value.startOfDay().toString(), value.withPlainTime(noon).toString(), value.hoursInDay,
        ]))
        // Without the functions of the library a wall clock the zone repeats is the later instant: the start of a day of
        // Havana that repeats its midnight (and its hours, from it), and 02:30 of the day Madrid repeats it, a day after the
        // day before and at that time of the day
        const havana = Temporal.ZonedDateTime.from('2012-11-04T12:00:00-05:00[America/Havana]')
        const madrid = Temporal.ZonedDateTime.from('2024-10-26T02:30:00+02:00[Europe/Madrid]')
        const laterStart = havana.toPlainDate().toPlainDateTime().toZonedDateTime('America/Havana', { disambiguation: 'later' })
        const laterNextDay = madrid.toPlainDateTime().add({ days: 1 }).toZonedDateTime('Europe/Madrid', { disambiguation: 'later' })
        const laterNextStart = havana.toPlainDate().add({ days: 1 }).toPlainDateTime().toZonedDateTime('America/Havana', { disambiguation: 'later' })
        const laterAtHalfPastTwo = madrid.toPlainDate().add({ days: 1 }).toPlainDateTime(Temporal.PlainTime.from('02:30')).toZonedDateTime('Europe/Madrid', { disambiguation: 'later' })
        ctx.mockNext({ start: text(laterStart), nextDay: text(laterNextDay), hoursInDay: laterNextStart.since(laterStart).total('hours'), atHalfPastTwo: text(laterAtHalfPastTwo) })
        const native = await ctx.conn.selectFromNoTable()
            .select({
                start: ctx.conn.const(havana, 'zonedDateTime').startOfDay(),
                nextDay: ctx.conn.const(madrid, 'zonedDateTime').add({ days: 1 }),
                hoursInDay: ctx.conn.const(havana, 'zonedDateTime').hoursInDay(),
                atHalfPastTwo: ctx.conn.const(madrid, 'zonedDateTime').add({ hours: 24 }).withPlainTime(Temporal.PlainTime.from('02:30')),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char((select from_tz(cast(cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) as timestamp(9)), to_char(tsq_z.x, 'TZR')) from (select (from_tz(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), '+00:00') at time zone 'America/Havana') as x from dual where rownum = 1) tsq_z), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "start", to_char((select from_tz((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:1, 'day')), to_char(tsq_z.x, 'TZR')) from (select (from_tz(to_timestamp(:2, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), '+00:00') at time zone 'Europe/Madrid') as x from dual where rownum = 1) tsq_z), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "nextDay", (select (cast(sys_extract_utc(from_tz(cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)), to_char(tsq_z.x, 'TZR'))) as date) - cast(sys_extract_utc(from_tz(cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)), to_char(tsq_z.x, 'TZR'))) as date)) * 24 from (select (from_tz(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), '+00:00') at time zone 'America/Havana') as x from dual where rownum = 1) tsq_z) as "hoursInDay", to_char((select from_tz(cast(cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + to_dsinterval('0 ' || to_char(cast(to_timestamp(:4, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9)), 'HH24:MI:SS.FF9')) as timestamp(9)), to_char(tsq_z.x, 'TZR')) from (select (select (tsq_z.x + numtodsinterval(:5, 'second')) from (select (from_tz(to_timestamp(:6, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), '+00:00') at time zone 'Europe/Madrid') as x from dual where rownum = 1) tsq_z) as x from dual where rownum = 1) tsq_z), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "atHalfPastTwo" from dual"`)
        expect([native.start.toString(), native.nextDay.toString(), native.hoursInDay, native.atHalfPastTwo.toString()]).toEqual([laterStart.toString(), laterNextDay.toString(), laterNextStart.since(laterStart).total('hours'), laterAtHalfPastTwo.toString()])
        expect([havana.startOfDay().toString(), madrid.add({ days: 1 }).toString()]).not.toEqual([laterStart.toString(), laterNextDay.toString()])
    })

    test('operations-on-a-computed-zoned-date-and-time', async () => {
        // A value computed from another one is computed once and named in the query; each operation is Temporal's
        const text = (value: Temporal.ZonedDateTime) => value.toInstant().toString() + ' AD[' + value.timeZoneId.toUpperCase() + ']'
        const chain = (value: Temporal.ZonedDateTime) => value.add({ days: 1 }).with({ hour: 3 }).round('hour')
        ctx.mockNext(zoned.map((value, i) => ({ id: i + 1, chained: text(chain(value).startOfDay()), hoursInDay: chain(value).hoursInDay })))
        const rows = await ctx.withTemporalFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                chained: tZonedValue.zonedAt.add({ days: 1 }).with({ hour: 3 }).round('hour').startOfDay(),
                hoursInDay: tZonedValue.zonedAt.add({ days: 1 }).with({ hour: 3 }).round('hour').hoursInDay(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char((select tsq_zoned_of_wall(cast(cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) as timestamp(9)), to_char(tsq_z.x, 'TZR'), 'compatible') from (select (select tsq_zoned_of_wall(cast(cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + numtodsinterval((trunc((2 * to_number(to_char(cast(tsq_z.x as timestamp(9)), 'SSSSSFF9')) + 3600000000000) / 7200000000000) * 3600000000000) / 1000000000, 'second') as timestamp(9)), to_char(tsq_z.x, 'TZR'), 'compatible', to_char(tsq_z.x, 'TZH:TZM')) from (select (select tsq_zoned_of_wall(cast(cast(tsq_z.x as timestamp(9)) + numtodsinterval((3 - extract(hour from cast(tsq_z.x as timestamp(9)))) * 3600, 'second') as timestamp(9)), to_char(tsq_z.x, 'TZR'), 'compatible', to_char(tsq_z.x, 'TZH:TZM')) from (select tsq_zoned_of_wall((cast(zoned_at as timestamp(9)) + numtodsinterval(:0, 'day')), to_char(zoned_at, 'TZR'), 'compatible') as x from dual where rownum = 1) tsq_z) as x from dual where rownum = 1) tsq_z) as x from dual where rownum = 1) tsq_z), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "chained", (select (cast(sys_extract_utc(tsq_zoned_of_wall(cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)), to_char(tsq_z.x, 'TZR'), 'compatible')) as date) - cast(sys_extract_utc(tsq_zoned_of_wall(cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)), to_char(tsq_z.x, 'TZR'), 'compatible')) as date)) * 24 from (select (select tsq_zoned_of_wall(cast(cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + numtodsinterval((trunc((2 * to_number(to_char(cast(tsq_z.x as timestamp(9)), 'SSSSSFF9')) + 3600000000000) / 7200000000000) * 3600000000000) / 1000000000, 'second') as timestamp(9)), to_char(tsq_z.x, 'TZR'), 'compatible', to_char(tsq_z.x, 'TZH:TZM')) from (select (select tsq_zoned_of_wall(cast(cast(tsq_z.x as timestamp(9)) + numtodsinterval((3 - extract(hour from cast(tsq_z.x as timestamp(9)))) * 3600, 'second') as timestamp(9)), to_char(tsq_z.x, 'TZR'), 'compatible', to_char(tsq_z.x, 'TZH:TZM')) from (select tsq_zoned_of_wall((cast(zoned_at as timestamp(9)) + numtodsinterval(:1, 'day')), to_char(zoned_at, 'TZR'), 'compatible') as x from dual where rownum = 1) tsq_z) as x from dual where rownum = 1) tsq_z) as x from dual where rownum = 1) tsq_z) as "hoursInDay" from zoned_value order by "id""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1",
            "1",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; chained: Temporal.ZonedDateTime; hoursInDay: number }>>>()
        expect(rows.map(row => [row.id, row.chained.toString(), row.hoursInDay])).toEqual(zoned.map((value, i) => [i + 1, chain(value).startOfDay().toString(), chain(value).hoursInDay]))
    })

    test('reject-fails-for-a-day-the-month-has-not-or-an-offset-the-zone-has-not', async () => {
        // As Temporal: row 1 is in October, a month later November has its day 27; February has no day 30; Madrid has
        // no offset +05:00
        const failures: boolean[] = []
        const value = zoned[0]!
        const text = (zonedValue: Temporal.ZonedDateTime) => zonedValue.toInstant().toString() + ' AD[' + zonedValue.timeZoneId.toUpperCase() + ']'
        ctx.mockNext([text(value.add({ months: 1 }, { overflow: 'reject' }))])
        failures.push(await failureOf(ctx.withTemporalFunctions().selectFrom(tZonedValue).where(tZonedValue.id.equals(1)).selectOneColumn(tZonedValue.zonedAt.add({ months: 1 }, { overflow: 'reject' })).executeSelectMany()))
        ctx.mockNext([])
        failures.push(await failureOf(ctx.withTemporalFunctions().selectFrom(tZonedValue).where(tZonedValue.id.equals(1)).selectOneColumn(tZonedValue.zonedAt.with({ month: 2, day: 30 }, { overflow: 'reject' })).executeSelectMany()))
        ctx.mockNext([])
        failures.push(await failureOf(ctx.withTemporalFunctions().selectFrom(tZonedValue).where(tZonedValue.id.equals(1)).selectOneColumn(tZonedValue.zonedAt.with({ offset: '+05:00' }, { offset: 'reject' })).executeSelectMany()))
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(from_tz((cast(cast(zoned_at as timestamp(9)) as timestamp(9)) - numtodsinterval(18000, 'second')) + numtodsinterval((extract(day from to_date((2001) || '-' || (2) || '-' || (case when cast((from_tz((cast(cast(zoned_at as timestamp(9)) as timestamp(9)) - numtodsinterval(18000, 'second')), '+00:00') at time zone to_char(zoned_at, 'TZR')) as timestamp(9)) = cast(cast(zoned_at as timestamp(9)) as timestamp(9)) then 28 else 29 end), 'YYYY-MM-DD')) - 28), 'day'), '+00:00') at time zone to_char(zoned_at, 'TZR'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "result" from zoned_value where id = :0"`)
        expect(failures).toEqual([false, ctx.realDbEnabled, ctx.realDbEnabled])
    })

    test('the-duration-between-two-zoned-dates-and-times', async () => {
        // In hours by default, the difference of their instants; in days, the days of the calendar in their zone: row 1
        // to two days later in Madrid is 2 days and 1 hour, which a day of 25 hours makes 49 hours
        const later = (value: Temporal.ZonedDateTime) => value.add({ days: 2, hours: 1 })
        ctx.mockNext(zoned.map((value, i) => ({
            id: i + 1, hours: value.until(later(value)).toString(), days: value.until(later(value), { largestUnit: 'day' }).toString(),
            months: value.since(value.subtract({ months: 1, days: 10 }), { largestUnit: 'month', smallestUnit: 'month', roundingMode: 'halfExpand' }).toString(),
        })))
        const rows = await ctx.withTemporalFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                hours: tZonedValue.zonedAt.until(tZonedValue.zonedAt.add({ days: 2, hours: 1 })),
                days: tZonedValue.zonedAt.until(tZonedValue.zonedAt.add({ days: 2, hours: 1 }), { largestUnit: 'day' }),
                months: tZonedValue.zonedAt.since(tZonedValue.zonedAt.subtract({ months: 1, days: 10 }), { largestUnit: 'month', smallestUnit: 'month', roundingMode: 'halfExpand' }),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", tsq_duration_text(0, 0, 0, 0, ((trunc(sys_extract_utc((tsq_zoned_of_wall((cast(zoned_at as timestamp(9)) + numtodsinterval(:1, 'day')), to_char(zoned_at, 'TZR'), 'compatible') + numtodsinterval(:0, 'second')))) - trunc(sys_extract_utc(zoned_at))) * 86400000000000 + (to_number(to_char(sys_extract_utc((tsq_zoned_of_wall((cast(zoned_at as timestamp(9)) + numtodsinterval(:3, 'day')), to_char(zoned_at, 'TZR'), 'compatible') + numtodsinterval(:2, 'second'))), 'SSSSSFF9')) - to_number(to_char(sys_extract_utc(zoned_at), 'SSSSSFF9')))), 'hour') as "hours", tsq_zoned_until(zoned_at, (tsq_zoned_of_wall((cast(zoned_at as timestamp(9)) + numtodsinterval(:5, 'day')), to_char(zoned_at, 'TZR'), 'compatible') + numtodsinterval(:4, 'second')), 'day', 'nanosecond', 1, 'trunc', 1) as "days", tsq_zoned_until(zoned_at, tsq_zoned_of_wall((cast((add_months(trunc(cast(zoned_at as timestamp(9))), :6) - greatest(0, extract(day from add_months(trunc(cast(zoned_at as timestamp(9))), :6)) - extract(day from trunc(cast(zoned_at as timestamp(9)))))) as timestamp(9)) + (cast(zoned_at as timestamp(9)) - trunc(cast(zoned_at as timestamp(9)))) + numtodsinterval(:7, 'day')), to_char(zoned_at, 'TZR'), 'compatible'), 'month', 'month', 1, 'halfExpand', -1) as "months" from zoned_value order by "id""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "3600",
            "2",
            "3600",
            "2",
            "3600",
            "2",
            "-1",
            "-10",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; hours: Temporal.Duration; days: Temporal.Duration; months: Temporal.Duration }>>>()
        expect(rows.map(row => [row.id, row.hours.toString(), row.days.toString(), row.months.toString()])).toEqual(zoned.map((value, i) => [
            i + 1, value.until(later(value)).toString(), value.until(later(value), { largestUnit: 'day' }).toString(),
            value.since(value.subtract({ months: 1, days: 10 }), { largestUnit: 'month', smallestUnit: 'month', roundingMode: 'halfExpand' }).toString(),
        ]))
    })

    test('a-difference-in-days-needs-the-same-zone', async () => {
        // As Temporal, which rejects it: row 2 is in Kolkata, the other value in Madrid; in hours any two are compared
        const madrid = Temporal.ZonedDateTime.from('2024-02-01T00:00:00+01:00[Europe/Madrid]')
        ctx.mockNext([])
        const failure = await failureOf(ctx.withTemporalFunctions().selectFrom(tZonedValue).where(tZonedValue.id.equals(2)).selectOneColumn(tZonedValue.zonedAt.until(madrid, { largestUnit: 'day' })).executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select tsq_zoned_until(zoned_at, (from_tz(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), '+00:00') at time zone 'Europe/Madrid'), 'day', 'nanosecond', 1, 'trunc', 1) as "result" from zoned_value where id = :1"`)
        ctx.mockNext(zoned[1]!.until(madrid).toString())
        const hours = await ctx.withTemporalFunctions().selectFrom(tZonedValue).where(tZonedValue.id.equals(2)).selectOneColumn(tZonedValue.zonedAt.until(madrid)).executeSelectOne()
        expect([failure, hours.toString()]).toEqual([ctx.realDbEnabled, zoned[1]!.until(madrid).toString()])
    })

    test('a-zoned-date-and-time-kept-and-computed-with-the-zones', async () => {
        // A column that keeps its zone, computed with the rules of its zone: row 1 plus a day is 02:30 on the next
        // day, an hour later in UTC, as Madrid goes back an hour; they are ordered by their instant
        const kept = [
            Temporal.ZonedDateTime.from('2024-10-27T02:30:00.123456789+02:00[Europe/Madrid]'),
            Temporal.ZonedDateTime.from('2024-01-14T14:45:30.123456789+05:30[Asia/Kolkata]'),
            Temporal.ZonedDateTime.from('1969-07-20T15:17:40-05:00[-05:00]'),
        ]
        const summer = Temporal.ZonedDateTime.from('2024-07-01T12:00:00.987654+02:00[Europe/Madrid]')
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tZonedValue).set({ zonedAt: summer }).where(tZonedValue.id.equals(3)).executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update zoned_value set zoned_at = (from_tz(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), '+00:00') at time zone 'Europe/Madrid') where id = :1"`)
            expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
              [
                "2024-07-01T12:00:00.987654+02:00[Europe/Madrid]",
                "3",
              ]
            `)
            ctx.mockNext(1)
            await ctx.conn.update(tZonedValue).set({ zonedAt: tZonedValue.zonedAt.add({ days: 1 }) }).where(tZonedValue.id.equals(1)).executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update zoned_value set zoned_at = from_tz((cast(zoned_at as timestamp(9)) + numtodsinterval(:0, 'day')), to_char(zoned_at, 'TZR')) where id = :1"`)
            const expected = [kept[0]!.add({ days: 1 }), kept[1]!, summer]
            const ordered = expected.map((value, i) => ({ id: i + 1, value })).sort((a, b) => Temporal.ZonedDateTime.compare(a.value, b.value))
            ctx.mockNext(ordered.map(({ id, value }) => ({
                id, zonedAt: value.toInstant().toString() + ' AD[' + value.timeZoneId.toUpperCase() + ']', hour: value.hour,
                inTokyo: value.toInstant().toString() + ' AD[ASIA/TOKYO]', hoursInDay: value.hoursInDay,
            })))
            const rows = await ctx.conn.selectFrom(tZonedValue)
                .select({
                    id: tZonedValue.id,
                    zonedAt: tZonedValue.zonedAt,
                    hour: tZonedValue.zonedAt.hour(),
                    inTokyo: tZonedValue.zonedAt.withTimeZone('Asia/Tokyo'),
                    hoursInDay: tZonedValue.zonedAt.hoursInDay(),
                })
                .orderBy('zonedAt')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(zoned_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "zonedAt", extract(hour from cast(zoned_at as timestamp(9))) as "hour", to_char(from_tz(sys_extract_utc(cast(zoned_at as timestamp(9) with time zone)), '+00:00') at time zone 'Asia/Tokyo', 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM BC"["TZR"]"', 'NLS_DATE_LANGUAGE=AMERICAN') as "inTokyo", (cast(sys_extract_utc(from_tz(cast(trunc(cast(zoned_at as timestamp(9))) + 1 as timestamp(9)), to_char(zoned_at, 'TZR'))) as date) - cast(sys_extract_utc(from_tz(cast(trunc(cast(zoned_at as timestamp(9))) as timestamp(9)), to_char(zoned_at, 'TZR'))) as date)) * 24 as "hoursInDay" from zoned_value order by zoned_value.zoned_at"`)
            expect(rows.map(row => [row.id, row.zonedAt?.toString(), row.hour, row.inTokyo?.toString(), row.hoursInDay])).toEqual(ordered.map(({ id, value }) => [id, value.toString(), value.hour, value.withTimeZone('Asia/Tokyo').toString(), value.hoursInDay]))
        })
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
