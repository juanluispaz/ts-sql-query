// An exact moment in a time zone (Temporal.ZonedDateTime), which PostgreSQL computes in the query: it keeps no zone with
// a value, so zonedAt is the instant of zoned_value in the zone of the row, and its parts, its instant or a wall clock
// taken to a zone with Temporal's disambiguation, and its arithmetic, are computed by the database, compared by its
// instant. zoned_value row 1 is 2024-10-27T02:30:00.123456+02:00[Europe/Madrid] with the wall clock 2024-10-27 02:30,
// which Madrid repeats; row 2 is 2024-01-14T14:45:30.123456+05:30[Asia/Kolkata] with 2024-03-31 02:30, which Madrid
// skips, and the zone America/New_York; row 3 is 1969-07-20T15:17:40-05:00[-05:00] with 2024-01-14 10:00, without zone.
// Every value expected is the one Temporal gives, with the functions of the library (libraryFunctions); without them a
// wall clock the zone repeats is the later instant, as PostgreSQL takes it.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'
import { tInstantValue, tZonedValue } from '../../domain/connection.js'
import { ctx } from './setup.js'

const zoned = [
    Temporal.ZonedDateTime.from('2024-10-27T02:30:00.123456+02:00[Europe/Madrid]'),
    Temporal.Instant.from('2024-01-14T09:15:30.123456Z').toZonedDateTimeISO('Asia/Kolkata'),
    Temporal.ZonedDateTime.from('1969-07-20T15:17:40-05:00[-05:00]'),
]
const walls = [Temporal.PlainDateTime.from('2024-10-27T02:30:00'), Temporal.PlainDateTime.from('2024-03-31T02:30:00'), Temporal.PlainDateTime.from('2024-01-14T10:00:00')]
const zoneNames = ['Europe/Madrid', 'America/New_York', undefined]
const zonedAt = tZonedValue.instantAt.toZonedDateTimeISO(tZonedValue.valueZone)

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
        // PostgreSQL keeps its instant and the query its zone: a zoned date and time sent comes back, and so does the one
        // of each row
        const summer = Temporal.ZonedDateTime.from('2024-07-01T12:00:00.987654+02:00[Europe/Madrid]')
        ctx.mockNext({ sent: summer.toInstant().toString() + ' AD[EUROPE/MADRID]' })
        const sent = await ctx.withLibraryFunctions().selectFromNoTable().select({ sent: ctx.withLibraryFunctions().const(summer, 'zonedDateTime') }).executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char($1::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as sent"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-07-01T12:00:00.987654+02:00[Europe/Madrid]",
          ]
        `)
        ctx.mockNext(zoned.map((value, i) => ({ id: i + 1, zonedAt: value.toInstant().toString() + ' AD[' + value.timeZoneId + ']' })))
        const rows = await ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .select({ id: tZonedValue.id, zonedAt: zonedAt })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, to_char((instant_at::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as "zonedAt" from zoned_value order by id"`)
        assertType<Exact<typeof rows, Array<{ id: number; zonedAt: Temporal.ZonedDateTime }>>>()
        expect([sent.sent.toString(), ...rows.map(row => [row.id, row.zonedAt.toString()])]).toEqual([summer.toString(), [1, zoned[0]!.toString()], [2, zoned[1]!.toString()], [3, zoned[2]!.toString()]])
    })

    test('the-parts-of-a-zoned-date-and-time', async () => {
        ctx.mockNext(zoned.map((value, i) => ({
            id: i + 1, instant: value.toInstant().toString() + ' AD', wall: value.toPlainDateTime().toString() + ' AD', day: value.toPlainDate().toString() + ' AD', time: '1970-01-01T' + value.toPlainTime().toString() + ' AD',
            zone: value.timeZoneId, offset: value.offset, offsetNanoseconds: value.offsetNanoseconds, milliseconds: value.epochMilliseconds, nanoseconds: String(value.epochNanoseconds),
            year: value.year, month: value.month, dayOfMonth: value.day, dayOfWeek: value.dayOfWeek, dayOfYear: value.dayOfYear, hour: value.hour, minute: value.minute, second: value.second, millisecond: value.millisecond, microsecond: value.microsecond,
        })))
        const rows = await ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                instant: zonedAt.toInstant(),
                wall: zonedAt.toPlainDateTime(),
                day: zonedAt.toPlainDate(),
                time: zonedAt.toPlainTime(),
                zone: zonedAt.timeZoneId(),
                offset: zonedAt.offset(),
                offsetNanoseconds: zonedAt.offsetNanoseconds(),
                milliseconds: zonedAt.epochMilliseconds(),
                nanoseconds: zonedAt.epochNanoseconds(),
                year: zonedAt.year(),
                month: zonedAt.month(),
                dayOfMonth: zonedAt.day(),
                dayOfWeek: zonedAt.dayOfWeek(),
                dayOfYear: zonedAt.dayOfYear(),
                hour: zonedAt.hour(),
                minute: zonedAt.minute(),
                second: zonedAt.second(),
                millisecond: zonedAt.millisecond(),
                microsecond: zonedAt.microsecond(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, instant_at::timestamptz as instant, (instant_at::timestamptz at time zone tsq_zone(value_zone)) as wall, cast((instant_at::timestamptz at time zone tsq_zone(value_zone)) as date) as day, cast((instant_at::timestamptz at time zone tsq_zone(value_zone)) as time) as time, value_zone as zone, tsq_zoned_offset(instant_at::timestamptz, value_zone) as "offset", (extract(epoch from (instant_at::timestamptz at time zone tsq_zone(value_zone)) - (instant_at::timestamptz at time zone 'UTC')) * 1000000000)::bigint as "offsetNanoseconds", floor(extract(epoch from instant_at::timestamptz) * 1000) as milliseconds, trunc(extract(epoch from instant_at::timestamptz) * 1000000000) as nanoseconds, extract(year from (instant_at::timestamptz at time zone tsq_zone(value_zone))) as year, extract(month from (instant_at::timestamptz at time zone tsq_zone(value_zone))) as month, extract(day from (instant_at::timestamptz at time zone tsq_zone(value_zone))) as "dayOfMonth", extract(isodow from (instant_at::timestamptz at time zone tsq_zone(value_zone))) as "dayOfWeek", extract(doy from (instant_at::timestamptz at time zone tsq_zone(value_zone))) as "dayOfYear", extract(hour from (instant_at::timestamptz at time zone tsq_zone(value_zone))) as hour, extract(minute from (instant_at::timestamptz at time zone tsq_zone(value_zone))) as minute, trunc(extract(second from (instant_at::timestamptz at time zone tsq_zone(value_zone))))::integer as second, trunc(extract(millisecond from (instant_at::timestamptz at time zone tsq_zone(value_zone))))::integer % 1000 as millisecond, trunc(extract(microseconds from (instant_at::timestamptz at time zone tsq_zone(value_zone))))::integer % 1000 as microsecond from zoned_value order by id"`)
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
            offsetZone: '2024-01-14T09:15:30.123456Z AD[+05:30]',
        })))
        const rows = await ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                tokyo: zonedAt.withTimeZone('Asia/Tokyo'),
                ofColumn: zonedAt.withTimeZone(tZonedValue.zoneName),
                newYork: zonedAt.toInstant().toZonedDateTimeISO('America/New_York'),
                offsetZone: ctx.withLibraryFunctions().const(Temporal.Instant.from('2024-01-14T09:15:30.123456Z'), 'instant').toZonedDateTimeISO('+05:30'),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, to_char((instant_at::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Asia/Tokyo]' as tokyo, to_char((instant_at::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || zone_name || ']' as "ofColumn", to_char((instant_at::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[America/New_York]' as "newYork", to_char($1::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[+05:30]' as "offsetZone" from zoned_value order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-14T09:15:30.123456Z",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; tokyo: Temporal.ZonedDateTime; ofColumn?: Temporal.ZonedDateTime; newYork: Temporal.ZonedDateTime; offsetZone: Temporal.ZonedDateTime }>>>()
        expect(rows.map(row => [row.id, row.tokyo.toString(), row.ofColumn?.toString(), row.newYork.toString(), row.offsetZone.toString()])).toEqual(zoned.map((value, i) => [
            i + 1, value.withTimeZone('Asia/Tokyo').toString(), zoneNames[i] === undefined ? undefined : value.withTimeZone(zoneNames[i]!).toString(), value.toInstant().toZonedDateTimeISO('America/New_York').toString(),
            Temporal.Instant.from('2024-01-14T09:15:30.123456Z').toZonedDateTimeISO('+05:30').toString(),
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
        const rows = await ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                compatible: tZonedValue.wallAt.toZonedDateTime('Europe/Madrid'),
                earlier: tZonedValue.wallAt.toZonedDateTime('Europe/Madrid', { disambiguation: 'earlier' }),
                later: tZonedValue.wallAt.toZonedDateTime('Europe/Madrid', { disambiguation: 'later' }),
                ofColumn: tZonedValue.wallAt.toZonedDateTime(tZonedValue.zoneName),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, to_char((tsq_zoned_of_wall(wall_at, 'Europe/Madrid', 'compatible')) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as compatible, to_char((tsq_zoned_of_wall(wall_at, 'Europe/Madrid', 'earlier')) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as earlier, to_char((tsq_zoned_of_wall(wall_at, 'Europe/Madrid', 'later')) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as later, to_char((tsq_zoned_of_wall(wall_at, zone_name, 'compatible')) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || zone_name || ']' as "ofColumn" from zoned_value order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; compatible?: Temporal.ZonedDateTime; earlier?: Temporal.ZonedDateTime; later?: Temporal.ZonedDateTime; ofColumn?: Temporal.ZonedDateTime }>>>()
        expect(rows.map(row => [row.id, row.compatible?.toString(), row.earlier?.toString(), row.later?.toString(), row.ofColumn?.toString()])).toEqual(walls.map((wall, i) => [
            i + 1, wall.toZonedDateTime('Europe/Madrid').toString(), wall.toZonedDateTime('Europe/Madrid', { disambiguation: 'earlier' }).toString(), wall.toZonedDateTime('Europe/Madrid', { disambiguation: 'later' }).toString(),
            zoneNames[i] === undefined ? undefined : wall.toZonedDateTime(zoneNames[i]!).toString(),
        ]))
        // Without the functions of the library, the instant PostgreSQL gives: the later one of row 1's wall clock, which
        // Madrid repeats, as Temporal's 'later'; 'earlier' and 'reject' need the functions
        ctx.mockNext(walls.map((wall, i) => ({ id: i + 1, compatible: wall.toZonedDateTime('Europe/Madrid', { disambiguation: 'later' }).toInstant().toString() + ' AD[EUROPE/MADRID]' })))
        const native = await ctx.conn.selectFrom(tZonedValue)
            .select({ id: tZonedValue.id, compatible: tZonedValue.wallAt.toZonedDateTime('Europe/Madrid') })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, to_char((wall_at at time zone 'Europe/Madrid') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as compatible from zoned_value order by id"`)
        expect(native.map(row => [row.id, row.compatible?.toString()])).toEqual(walls.map((wall, i) => [i + 1, wall.toZonedDateTime('Europe/Madrid', { disambiguation: 'later' }).toString()]))
        expect(await reasonOf(() => ctx.conn.selectFrom(tZonedValue).selectOneColumn(tZonedValue.wallAt.toZonedDateTime('Europe/Madrid', { disambiguation: 'earlier' })).executeSelectMany())).toBe('UNSUPPORTED_QUERY')
        expect(await reasonOf(() => ctx.conn.selectFrom(tZonedValue).selectOneColumn(tZonedValue.wallAt.toZonedDateTime('Europe/Madrid', { disambiguation: 'reject' })).executeSelectMany())).toBe('UNSUPPORTED_QUERY')
    })

    test('reject-fails-for-a-wall-clock-the-zone-repeats-or-skips', async () => {
        // As Temporal: row 1's wall clock is repeated in Madrid and row 2's skipped; row 3's is a wall clock of Madrid
        const failures: boolean[] = []
        for (const id of [1, 2, 3]) {
            ctx.mockNext([walls[id - 1]!.toZonedDateTime('Europe/Madrid').toInstant().toString() + ' AD[EUROPE/MADRID]'])
            failures.push(await failureOf(ctx.withLibraryFunctions().selectFrom(tZonedValue)
                .where(tZonedValue.id.equals(id))
                .selectOneColumn(tZonedValue.wallAt.toZonedDateTime('Europe/Madrid', { disambiguation: 'reject' }))
                .executeSelectMany()))
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char((tsq_zoned_of_wall(wall_at, 'Europe/Madrid', 'reject')) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as result from zoned_value where id = $1"`)
        expect(failures).toEqual([ctx.realDbEnabled, ctx.realDbEnabled, false])
    })

    test('zoned-date-and-times-compared-by-their-instant', async () => {
        // Compared and ordered by their instant, as Temporal's compare: row 2 in Tokyo is row 2 (Temporal's equals also
        // compares the zone)
        ctx.mockNext([1])
        const later = await ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .where(zonedAt.greaterThan(zoned[1]!.withTimeZone('UTC')))
            .selectOneColumn(tZonedValue.id)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from zoned_value where instant_at::timestamptz > $1"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-14T09:15:30.123456+00:00[UTC]",
          ]
        `)
        ctx.mockNext([2])
        const same = await ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .where(zonedAt.equals(zoned[1]!.withTimeZone('Asia/Tokyo')))
            .selectOneColumn(tZonedValue.id)
            .executeSelectMany()
        ctx.mockNext([3, 2, 1].map(id => ({ id, at: zoned[id - 1]!.toInstant().toString() + ' AD[' + zoned[id - 1]!.timeZoneId.toUpperCase() + ']' })))
        const ordered = (await ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .select({ id: tZonedValue.id, at: zonedAt })
            .orderBy('at')
            .executeSelectMany()).map(row => row.id)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, to_char((instant_at::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as at from zoned_value order by zoned_value.instant_at::timestamptz"`)
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
        const rows = await ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                nextDay: zonedAt.add({ days: 1 }),
                twoHoursBefore: zonedAt.subtract({ hours: 2 }),
                monthAndHour: zonedAt.add({ months: 1, hours: 1 }),
                ofDuration: zonedAt.add(ctx.withLibraryFunctions().const(duration, 'duration')),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, to_char((tsq_zoned_plus_date(instant_at::timestamptz, value_zone, 0, $1, 0)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as "nextDay", to_char((instant_at::timestamptz + $2::interval) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as "twoHoursBefore", to_char((tsq_zoned_plus_date(instant_at::timestamptz, value_zone, $3, 0, 0) + $4::interval) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as "monthAndHour", to_char((select (tsq_zoned_plus_date(instant_at::timestamptz, value_zone, (extract(year from tsq_z.d) * 12 + extract(month from tsq_z.d))::integer, extract(day from tsq_z.d)::integer, 0) + (tsq_z.d - date_trunc('day', tsq_z.d))) from (select $5::interval as d offset 0) tsq_z) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as "ofDuration" from zoned_value order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1",
            "-PT7200S",
            "1",
            "PT3600S",
            "P1DT2H",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; nextDay: Temporal.ZonedDateTime; twoHoursBefore: Temporal.ZonedDateTime; monthAndHour: Temporal.ZonedDateTime; ofDuration: Temporal.ZonedDateTime }>>>()
        expect(rows.map(row => [row.id, row.nextDay.toString(), row.twoHoursBefore.toString(), row.monthAndHour.toString(), row.ofDuration.toString()])).toEqual(zoned.map((value, i) => [
            i + 1, value.add({ days: 1 }).toString(), value.subtract({ hours: 2 }).toString(), value.add({ months: 1, hours: 1 }).toString(), value.add(duration).toString(),
        ]))
    })

    test('a-zoned-date-and-time-plus-a-duration-with-and-without-the-functions-of-the-library', async () => {
        // With the functions of the library, tsq_zoned_plus_date adds the years, months, weeks and days to the wall clock
        // in its zone and takes it back to the zone, writing the value once: the values are the ones of Temporal, with and
        // without the functions; a wall clock the zone skips (row 1 plus 5 months and 3 days is 2025-03-30 02:30, which
        // Madrid skips) moves as Temporal moves it with the functions (the mock answers no rows: there it is the SQL that
        // is checked)
        const duration = Temporal.Duration.from('P2DT3H')
        const query = (conn: typeof ctx.conn) => conn.selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                weeksAndHours: zonedAt.add({ weeks: 2, hours: 3 }),
                yearBefore: zonedAt.subtract({ years: 1, days: 1 }),
                rejecting: zonedAt.add({ months: 4 }, { overflow: 'reject' }),
                ofDuration: zonedAt.add(conn.const(duration, 'duration')),
            })
            .orderBy('id')
            .executeSelectMany()
        ctx.mockNext([])
        const withFunctions = await query(ctx.withLibraryFunctions())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, to_char((tsq_zoned_plus_date(instant_at::timestamptz, value_zone, 0, $1, 0) + $2::interval) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as "weeksAndHours", to_char((tsq_zoned_plus_date(instant_at::timestamptz, value_zone, $3, $4, 0)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as "yearBefore", to_char((tsq_zoned_plus_date(instant_at::timestamptz, value_zone, $5, 0, 1)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as rejecting, to_char((select (tsq_zoned_plus_date(instant_at::timestamptz, value_zone, (extract(year from tsq_z.d) * 12 + extract(month from tsq_z.d))::integer, extract(day from tsq_z.d)::integer, 0) + (tsq_z.d - date_trunc('day', tsq_z.d))) from (select $6::interval as d offset 0) tsq_z) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as "ofDuration" from zoned_value order by id"`)
        ctx.mockNext([])
        const withoutFunctions = await query(ctx.conn)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, to_char(((((instant_at::timestamptz at time zone (case when value_zone ~ '^[+-]' then translate(value_zone, '+-', '-+') else value_zone end)) + make_interval(days => $1)) at time zone (case when value_zone ~ '^[+-]' then translate(value_zone, '+-', '-+') else value_zone end)) + $2::interval) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as "weeksAndHours", to_char((((instant_at::timestamptz at time zone (case when value_zone ~ '^[+-]' then translate(value_zone, '+-', '-+') else value_zone end)) + make_interval(months => $3, days => $4)) at time zone (case when value_zone ~ '^[+-]' then translate(value_zone, '+-', '-+') else value_zone end)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as "yearBefore", to_char((((instant_at::timestamptz at time zone (case when value_zone ~ '^[+-]' then translate(value_zone, '+-', '-+') else value_zone end)) + make_interval(months => $5) + make_interval(days => (extract(day from make_date(((extract(year from (instant_at::timestamptz at time zone (case when value_zone ~ '^[+-]' then translate(value_zone, '+-', '-+') else value_zone end)))::integer * 12 + extract(month from (instant_at::timestamptz at time zone (case when value_zone ~ '^[+-]' then translate(value_zone, '+-', '-+') else value_zone end)))::integer - 1 + $5) / 12), (extract(year from (instant_at::timestamptz at time zone (case when value_zone ~ '^[+-]' then translate(value_zone, '+-', '-+') else value_zone end)))::integer * 12 + extract(month from (instant_at::timestamptz at time zone (case when value_zone ~ '^[+-]' then translate(value_zone, '+-', '-+') else value_zone end)))::integer - 1 + $5) % 12 + 1, extract(day from (instant_at::timestamptz at time zone (case when value_zone ~ '^[+-]' then translate(value_zone, '+-', '-+') else value_zone end)))::integer))::integer - extract(day from (instant_at::timestamptz at time zone (case when value_zone ~ '^[+-]' then translate(value_zone, '+-', '-+') else value_zone end)))::integer))) at time zone (case when value_zone ~ '^[+-]' then translate(value_zone, '+-', '-+') else value_zone end)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as rejecting, to_char((select ((case when (extract(year from tsq_z.d) * 12 + extract(month from tsq_z.d))::integer <> 0 or extract(day from tsq_z.d)::integer <> 0 then (((tsq_z.x at time zone (case when value_zone ~ '^[+-]' then translate(value_zone, '+-', '-+') else value_zone end)) + make_interval(months => (extract(year from tsq_z.d) * 12 + extract(month from tsq_z.d))::integer, days => extract(day from tsq_z.d)::integer)) at time zone (case when value_zone ~ '^[+-]' then translate(value_zone, '+-', '-+') else value_zone end)) else tsq_z.x end) + (tsq_z.d - date_trunc('day', tsq_z.d))) from (select instant_at::timestamptz as x, $6::interval as d offset 0) tsq_z) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as "ofDuration" from zoned_value order by id"`)
        expect(withFunctions.length).toBe(ctx.realDbEnabled ? 3 : 0)
        const ofTemporal = zoned.map((value, i) => [
            i + 1, value.add({ weeks: 2, hours: 3 }).toString(), value.subtract({ years: 1, days: 1 }).toString(), value.add({ months: 4 }, { overflow: 'reject' }).toString(), value.add(duration).toString(),
        ])
        type Row = (typeof withFunctions)[number]
        const read = (row: Row) => [row.id, row.weeksAndHours.toString(), row.yearBefore.toString(), row.rejecting.toString(), row.ofDuration.toString()]
        expect(withFunctions.map(read)).toEqual(ofTemporal.slice(0, withFunctions.length))
        expect(withoutFunctions.map(read)).toEqual(ofTemporal.slice(0, withoutFunctions.length))
        ctx.mockNext([])
        const skipped = await ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .where(tZonedValue.id.equals(1))
            .select({ gap: zonedAt.add({ months: 5, days: 3 }) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char((tsq_zoned_plus_date(instant_at::timestamptz, value_zone, $1, $2, 0)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as gap from zoned_value where id = $3"`)
        expect(skipped.map(row => row.gap.toString())).toEqual(ctx.realDbEnabled ? [zoned[0]!.add({ months: 5, days: 3 }).toString()] : [])
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
        const rows = await ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                quarterTo: zonedAt.with({ minute: 45 }),
                later: zonedAt.with({ minute: 45 }, { offset: 'ignore', disambiguation: 'later' }),
                hour: zonedAt.round('hour'),
                day: zonedAt.round('day'),
                start: zonedAt.startOfDay(),
                atNoon: zonedAt.withPlainTime(noon),
                hoursInDay: zonedAt.hoursInDay(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, to_char((select tsq_zoned_of_wall((tsq_z.x at time zone tsq_zone(value_zone)) + make_interval(secs => (45 - cast(extract(minute from (tsq_z.x at time zone tsq_zone(value_zone))) as integer)) * 60), value_zone, 'compatible', ((tsq_z.x at time zone tsq_zone(value_zone)) - (tsq_z.x at time zone 'UTC'))) from (select instant_at::timestamptz as x offset 0) tsq_z) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as "quarterTo", to_char((select tsq_zoned_of_wall((tsq_z.x at time zone tsq_zone(value_zone)) + make_interval(secs => (45 - cast(extract(minute from (tsq_z.x at time zone tsq_zone(value_zone))) as integer)) * 60), value_zone, 'later') from (select instant_at::timestamptz as x offset 0) tsq_z) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as later, to_char((select tsq_zoned_of_wall(date_bin(interval '1 hours', (tsq_z.x at time zone tsq_zone(value_zone)) + interval '30 minutes', date_trunc('day', (tsq_z.x at time zone tsq_zone(value_zone)))), value_zone, 'compatible', ((tsq_z.x at time zone tsq_zone(value_zone)) - (tsq_z.x at time zone 'UTC'))) from (select instant_at::timestamptz as x offset 0) tsq_z) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as hour, to_char((tsq_zoned_round_day(instant_at::timestamptz, value_zone, 'halfExpand')) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as day, to_char((select tsq_zoned_of_wall(cast(cast((tsq_z.x at time zone tsq_zone(value_zone)) as date) as timestamp), value_zone, 'compatible') from (select instant_at::timestamptz as x offset 0) tsq_z) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as start, to_char((select tsq_zoned_of_wall((cast((tsq_z.x at time zone tsq_zone(value_zone)) as date) + $1::time), value_zone, 'compatible') from (select instant_at::timestamptz as x offset 0) tsq_z) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as "atNoon", tsq_zoned_hours_in_day(instant_at::timestamptz, value_zone) as "hoursInDay" from zoned_value order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char((select (cast(cast((tsq_z.x at time zone 'America/Havana') as date) as timestamp) at time zone 'America/Havana') from (select $1::timestamptz as x offset 0) tsq_z) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[America/Havana]' as start, to_char(((($3::timestamptz at time zone 'Europe/Madrid') + make_interval(days => $2)) at time zone 'Europe/Madrid') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as "nextDay", (select (extract(epoch from ((date_trunc('day', (tsq_z.x at time zone 'America/Havana')) + interval '1 day') at time zone 'America/Havana') - ((date_trunc('day', (tsq_z.x at time zone 'America/Havana'))) at time zone 'America/Havana')) / 3600)::float8 from (select $4::timestamptz as x offset 0) tsq_z) as "hoursInDay", to_char((select ((cast((tsq_z.x at time zone 'Europe/Madrid') as date) + $5::time) at time zone 'Europe/Madrid') from (select ($7::timestamptz + $6::interval) as x offset 0) tsq_z) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as "atHalfPastTwo""`)
        expect([native.start.toString(), native.nextDay.toString(), native.hoursInDay, native.atHalfPastTwo.toString()]).toEqual([laterStart.toString(), laterNextDay.toString(), laterNextStart.since(laterStart).total('hours'), laterAtHalfPastTwo.toString()])
        expect([havana.startOfDay().toString(), madrid.add({ days: 1 }).toString()]).not.toEqual([laterStart.toString(), laterNextDay.toString()])
    })

    test('operations-on-a-computed-zoned-date-and-time', async () => {
        // A value computed from another one is computed once and named in the query; each operation is Temporal's
        const text = (value: Temporal.ZonedDateTime) => value.toInstant().toString() + ' AD[' + value.timeZoneId.toUpperCase() + ']'
        const chain = (value: Temporal.ZonedDateTime) => value.add({ days: 1 }).with({ hour: 3 }).round('hour')
        ctx.mockNext(zoned.map((value, i) => ({ id: i + 1, chained: text(chain(value).startOfDay()), hoursInDay: chain(value).hoursInDay })))
        const rows = await ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                chained: zonedAt.add({ days: 1 }).with({ hour: 3 }).round('hour').startOfDay(),
                hoursInDay: zonedAt.add({ days: 1 }).with({ hour: 3 }).round('hour').hoursInDay(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, to_char((select tsq_zoned_of_wall(cast(cast((tsq_z.x at time zone tsq_zone(value_zone)) as date) as timestamp), value_zone, 'compatible') from (select (select tsq_zoned_of_wall(date_bin(interval '1 hours', (tsq_z.x at time zone tsq_zone(value_zone)) + interval '30 minutes', date_trunc('day', (tsq_z.x at time zone tsq_zone(value_zone)))), value_zone, 'compatible', ((tsq_z.x at time zone tsq_zone(value_zone)) - (tsq_z.x at time zone 'UTC'))) from (select (select tsq_zoned_of_wall((tsq_z.x at time zone tsq_zone(value_zone)) + make_interval(secs => (3 - cast(extract(hour from (tsq_z.x at time zone tsq_zone(value_zone))) as integer)) * 3600), value_zone, 'compatible', ((tsq_z.x at time zone tsq_zone(value_zone)) - (tsq_z.x at time zone 'UTC'))) from (select tsq_zoned_plus_date(instant_at::timestamptz, value_zone, 0, $1, 0) as x offset 0) tsq_z) as x offset 0) tsq_z) as x offset 0) tsq_z) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as chained, tsq_zoned_hours_in_day(((select tsq_zoned_of_wall(date_bin(interval '1 hours', (tsq_z.x at time zone tsq_zone(value_zone)) + interval '30 minutes', date_trunc('day', (tsq_z.x at time zone tsq_zone(value_zone)))), value_zone, 'compatible', ((tsq_z.x at time zone tsq_zone(value_zone)) - (tsq_z.x at time zone 'UTC'))) from (select (select tsq_zoned_of_wall((tsq_z.x at time zone tsq_zone(value_zone)) + make_interval(secs => (3 - cast(extract(hour from (tsq_z.x at time zone tsq_zone(value_zone))) as integer)) * 3600), value_zone, 'compatible', ((tsq_z.x at time zone tsq_zone(value_zone)) - (tsq_z.x at time zone 'UTC'))) from (select tsq_zoned_plus_date(instant_at::timestamptz, value_zone, 0, $2, 0) as x offset 0) tsq_z) as x offset 0) tsq_z)), value_zone) as "hoursInDay" from zoned_value order by id"`)
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
        failures.push(await failureOf(ctx.withLibraryFunctions().selectFrom(tZonedValue).where(tZonedValue.id.equals(1)).selectOneColumn(zonedAt.add({ months: 1 }, { overflow: 'reject' })).executeSelectMany()))
        ctx.mockNext([])
        failures.push(await failureOf(ctx.withLibraryFunctions().selectFrom(tZonedValue).where(tZonedValue.id.equals(1)).selectOneColumn(zonedAt.with({ month: 2, day: 30 }, { overflow: 'reject' })).executeSelectMany()))
        ctx.mockNext([])
        failures.push(await failureOf(ctx.withLibraryFunctions().selectFrom(tZonedValue).where(tZonedValue.id.equals(1)).selectOneColumn(zonedAt.with({ offset: '+05:00' }, { offset: 'reject' })).executeSelectMany()))
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char((select (((tsq_z.x at time zone tsq_zone(value_zone)) - make_interval(secs => 18000)) + make_interval(days => (extract(day from make_date(2001, 2, case when ((((tsq_z.x at time zone tsq_zone(value_zone)) - make_interval(secs => 18000)) at time zone 'UTC') at time zone tsq_zone(value_zone)) = (tsq_z.x at time zone tsq_zone(value_zone)) then 28 else 29 end))::integer - 28))) at time zone 'UTC' from (select instant_at::timestamptz as x offset 0) tsq_z) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || value_zone || ']' as result from zoned_value where id = $1"`)
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
        const rows = await ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                hours: zonedAt.until(zonedAt.add({ days: 2, hours: 1 })),
                days: zonedAt.until(zonedAt.add({ days: 2, hours: 1 }), { largestUnit: 'day' }),
                months: zonedAt.since(zonedAt.subtract({ months: 1, days: 10 }), { largestUnit: 'month', smallestUnit: 'month', roundingMode: 'halfExpand' }),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (extract(epoch from (((tsq_zoned_plus_date(instant_at::timestamptz, value_zone, 0, $1, 0) + $2::interval)) at time zone 'UTC') - (instant_at::timestamptz at time zone 'UTC')) || ' seconds')::interval as hours, tsq_zoned_until(instant_at::timestamptz, value_zone, ((tsq_zoned_plus_date(instant_at::timestamptz, value_zone, 0, $3, 0) + $4::interval)), value_zone, 'day', 'nanosecond', 1, 'trunc', 1) as days, tsq_zoned_until(instant_at::timestamptz, value_zone, (tsq_zoned_plus_date(instant_at::timestamptz, value_zone, $5, $6, 0)), value_zone, 'month', 'month', 1, 'halfExpand', -1) as months from zoned_value order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2",
            "PT3600S",
            "2",
            "PT3600S",
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
        const failure = await failureOf(ctx.withLibraryFunctions().selectFrom(tZonedValue).where(tZonedValue.id.equals(2)).selectOneColumn(zonedAt.until(madrid, { largestUnit: 'day' })).executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select tsq_zoned_until(instant_at::timestamptz, value_zone, $1::timestamptz, 'Europe/Madrid', 'day', 'nanosecond', 1, 'trunc', 1) as result from zoned_value where id = $2"`)
        ctx.mockNext(zoned[1]!.until(madrid).toString())
        const hours = await ctx.withLibraryFunctions().selectFrom(tZonedValue).where(tZonedValue.id.equals(2)).selectOneColumn(zonedAt.until(madrid)).executeSelectOne()
        expect([failure, hours.toString()]).toEqual([ctx.realDbEnabled, zoned[1]!.until(madrid).toString()])
    })

    test('a-zoned-date-and-time-kept-and-computed-with-the-zones', async () => {
        // A column that keeps its RFC 9557 text, computed with the rules of its zone: row 1 plus a day is 02:30 on the next
        // day, an hour later in UTC, as Madrid goes back an hour. A value sent is the text of Temporal's toString, and
        // one computed in the query is kept as its instant in UTC with a Z; they are ordered by their instant
        const kept = [
            Temporal.ZonedDateTime.from('2024-10-27T02:30:00.123456+02:00[Europe/Madrid]'),
            Temporal.ZonedDateTime.from('2024-01-14T14:45:30.123456+05:30[Asia/Kolkata]'),
            Temporal.ZonedDateTime.from('1969-07-20T15:17:40-05:00[-05:00]'),
        ]
        const summer = Temporal.ZonedDateTime.from('2024-07-01T12:00:00.987654+02:00[Europe/Madrid]')
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tZonedValue).set({ zonedAt: summer }).where(tZonedValue.id.equals(3)).executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update zoned_value set zoned_at = $1 where id = $2"`)
            expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
              [
                "2024-07-01T12:00:00.987654+02:00[Europe/Madrid]",
                "3",
              ]
            `)
            ctx.mockNext(1)
            await ctx.conn.update(tZonedValue).set({ zonedAt: tZonedValue.zonedAt.add({ days: 1 }) }).where(tZonedValue.id.equals(1)).executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update zoned_value set zoned_at = (to_char(((((split_part(zoned_at, '[', 1)::timestamptz at time zone (case when rtrim(split_part(zoned_at, '[', 2), ']') ~ '^[+-]' then translate(rtrim(split_part(zoned_at, '[', 2), ']'), '+-', '-+') else rtrim(split_part(zoned_at, '[', 2), ']') end)) + make_interval(days => $1)) at time zone (case when rtrim(split_part(zoned_at, '[', 2), ']') ~ '^[+-]' then translate(rtrim(split_part(zoned_at, '[', 2), ']'), '+-', '-+') else rtrim(split_part(zoned_at, '[', 2), ']') end))) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '[' || rtrim(split_part(zoned_at, '[', 2), ']') || ']') where id = $2"`)
            const expected = [kept[0]!.add({ days: 1 }), kept[1]!, summer]
            const ordered = expected.map((value, i) => ({ id: i + 1, value })).sort((a, b) => Temporal.ZonedDateTime.compare(a.value, b.value))
            ctx.mockNext(ordered.map(({ id, value }) => ({
                id, zonedAt: value.toInstant().toString() + ' AD[' + value.timeZoneId + ']', hour: value.hour,
                inTokyo: value.toInstant().toString() + ' AD[Asia/Tokyo]', hoursInDay: value.hoursInDay,
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, to_char((split_part(zoned_at, '[', 1)::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || rtrim(split_part(zoned_at, '[', 2), ']') || ']' as "zonedAt", extract(hour from (split_part(zoned_at, '[', 1)::timestamptz at time zone (case when rtrim(split_part(zoned_at, '[', 2), ']') ~ '^[+-]' then translate(rtrim(split_part(zoned_at, '[', 2), ']'), '+-', '-+') else rtrim(split_part(zoned_at, '[', 2), ']') end))) as hour, to_char((split_part(zoned_at, '[', 1)::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Asia/Tokyo]' as "inTokyo", (extract(epoch from ((date_trunc('day', (split_part(zoned_at, '[', 1)::timestamptz at time zone (case when rtrim(split_part(zoned_at, '[', 2), ']') ~ '^[+-]' then translate(rtrim(split_part(zoned_at, '[', 2), ']'), '+-', '-+') else rtrim(split_part(zoned_at, '[', 2), ']') end))) + interval '1 day') at time zone (case when rtrim(split_part(zoned_at, '[', 2), ']') ~ '^[+-]' then translate(rtrim(split_part(zoned_at, '[', 2), ']'), '+-', '-+') else rtrim(split_part(zoned_at, '[', 2), ']') end)) - ((date_trunc('day', (split_part(zoned_at, '[', 1)::timestamptz at time zone (case when rtrim(split_part(zoned_at, '[', 2), ']') ~ '^[+-]' then translate(rtrim(split_part(zoned_at, '[', 2), ']'), '+-', '-+') else rtrim(split_part(zoned_at, '[', 2), ']') end)))) at time zone (case when rtrim(split_part(zoned_at, '[', 2), ']') ~ '^[+-]' then translate(rtrim(split_part(zoned_at, '[', 2), ']'), '+-', '-+') else rtrim(split_part(zoned_at, '[', 2), ']') end))) / 3600)::float8 as "hoursInDay" from zoned_value order by split_part(zoned_value.zoned_at, '[', 1)::timestamptz"`)
            expect(rows.map(row => [row.id, row.zonedAt?.toString(), row.hour, row.inTokyo?.toString(), row.hoursInDay])).toEqual(ordered.map(({ id, value }) => [id, value.toString(), value.hour, value.withTimeZone('Asia/Tokyo').toString(), value.hoursInDay]))
        })
    })

    test('a-zoned-date-and-time-in-a-column-of-text', async () => {
        // A column declared to keep its RFC 9557 text by its SQL data type: a value sent is the text of Temporal's
        // toString, one computed in the query its instant in UTC with a Z and its zone; it is read, compared and
        // ordered by its instant (PostgreSQL reads it through its instant, to the microsecond)
        const summer = Temporal.ZonedDateTime.from('2024-07-01T12:00:00.987654+02:00[Europe/Madrid]')
        const since = Temporal.ZonedDateTime.from('2024-01-01T00:00:00+00:00[UTC]')
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tZonedValue).set({ zonedText: summer }).where(tZonedValue.id.equals(3)).executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update zoned_value set zoned_at = $1 where id = $2"`)
            expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
              [
                "2024-07-01T12:00:00.987654+02:00[Europe/Madrid]",
                "3",
              ]
            `)
            ctx.mockNext(1)
            await ctx.conn.update(tZonedValue).set({ zonedText: tZonedValue.zonedText.withTimeZone('Asia/Tokyo') }).where(tZonedValue.id.equals(1)).executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update zoned_value set zoned_at = (to_char(split_part(zoned_at, '[', 1)::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '[Asia/Tokyo]') where id = $1"`)
            const values = [zoned[0]!.withTimeZone('Asia/Tokyo'), zoned[1]!, summer]
            const ordered = values.map((value, i) => ({ id: i + 1, value })).filter(entry => Temporal.ZonedDateTime.compare(entry.value, since) >= 0).sort((a, b) => Temporal.ZonedDateTime.compare(a.value, b.value))
            ctx.mockNext(ordered.map(({ id, value }) => ({ id, zonedText: value.toInstant().toString() + ' AD[' + value.timeZoneId + ']' })))
            const rows = await ctx.conn.selectFrom(tZonedValue)
                .where(tZonedValue.zonedText.greaterOrEqual(since))
                .select({ id: tZonedValue.id, zonedText: tZonedValue.zonedText })
                .orderBy('zonedText')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, to_char((split_part(zoned_at, '[', 1)::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || rtrim(split_part(zoned_at, '[', 2), ']') || ']' as "zonedText" from zoned_value where split_part(zoned_at, '[', 1)::timestamptz >= $1 order by split_part(zoned_value.zoned_at, '[', 1)::timestamptz"`)
            expect(rows.map(row => [row.id, row.zonedText?.toString()])).toEqual(ordered.map(({ id, value }) => [id, value.toString()]))
        })
    })

    test('a-zoned-date-and-time-in-a-column-of-text-with-the-functions-of-the-library', async () => {
        // With the functions of the library installed the text is read writing it once: its hour, its offset and the
        // milliseconds of its instant are the ones of Temporal, and the same as without the functions
        const query = (conn: typeof ctx.conn) => conn.selectFrom(tZonedValue)
            .where(tZonedValue.zonedText.greaterOrEqual(Temporal.ZonedDateTime.from('1960-01-01T00:00:00+00:00[UTC]')))
            .select({
                id: tZonedValue.id,
                hour: tZonedValue.zonedText.hour(),
                offset: tZonedValue.zonedText.offset(),
                epochMilliseconds: tZonedValue.zonedText.epochMilliseconds(),
            })
            .orderBy('id')
            .executeSelectMany()
        const expected = zoned.map((value, i) => ({ id: i + 1, hour: value.hour, offset: value.offset, epochMilliseconds: value.epochMilliseconds }))
        ctx.mockNext(expected)
        const withFunctions = await query(ctx.withLibraryFunctions())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, extract(hour from (split_part(zoned_at, '[', 1)::timestamptz at time zone tsq_zone(rtrim(split_part(zoned_at, '[', 2), ']')))) as hour, tsq_zoned_offset(split_part(zoned_at, '[', 1)::timestamptz, rtrim(split_part(zoned_at, '[', 2), ']')) as "offset", floor(extract(epoch from split_part(zoned_at, '[', 1)::timestamptz) * 1000) as "epochMilliseconds" from zoned_value where split_part(zoned_at, '[', 1)::timestamptz >= $1 order by id"`)
        ctx.mockNext(expected)
        const withoutFunctions = await query(ctx.conn)
        expect(withFunctions).toEqual(expected)
        expect(withoutFunctions).toEqual(expected)
    })

    test('zoned-dates-and-times-in-an-aggregated-array', async () => {
        // Inside the JSON of an aggregated array a zoned date and time keeps its zone: a column kept as its text
        ctx.mockNext({ ats: zoned.map((value, i) => ({ id: i + 1, at: value.toInstant().toString() + ' AD[' + value.timeZoneId + ']' })) })
        const row = await ctx.conn.selectFrom(tZonedValue)
            .select({ ats: ctx.conn.aggregateAsArray({ id: tZonedValue.id, at: tZonedValue.zonedText }) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (json_agg(json_build_object('id', id, 'at', to_char((split_part(zoned_at, '[', 1)::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[' || rtrim(split_part(zoned_at, '[', 2), ']') || ']')))::text as ats from zoned_value"`)
        expect(row.ats.map(entry => [entry.id, entry.at?.toString()]).sort((a, b) => Number(a[0]) - Number(b[0]))).toEqual(zoned.map((value, i) => [i + 1, value.toString()]))
    })

    test('a-zoned-date-and-time-needs-a-database-with-zones', async () => {
        // PostgreSQL computes a zoned date and time in the query: the query is built
        ctx.mockNext([{ id: 1, at: '2024-01-14T09:15:30.123456Z AD[EUROPE/MADRID]' }])
        const reason = await reasonOf(() => ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.id.equals(1))
            .select({ id: tInstantValue.id, at: tInstantValue.instantAt.toZonedDateTimeISO('Europe/Madrid') })
            .executeSelectMany())
        expect(reason).toBe('no error')
    })
})
