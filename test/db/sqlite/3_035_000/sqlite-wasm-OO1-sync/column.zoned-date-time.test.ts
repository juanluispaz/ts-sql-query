// An exact moment in a time zone (Temporal.ZonedDateTime), which this database keeps as its RFC 9557 text, the one of
// Temporal's toString: kept, read, its parts and compared by its instant, which need no rules of the zones; what needs
// them fails when the query is built. zoned_value row 1 is 2024-10-27T02:30:00.123456789+02:00[Europe/Madrid], row 2 is
// 2024-01-14T14:45:30.123456789+05:30[Asia/Kolkata] and row 3 is 1969-07-20T15:17:40-05:00[-05:00]. Every value expected
// is the one Temporal gives, of the value rounded to the millisecond where the database computes it (atDatabase).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'
import { tInstantValue, tZonedValue } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'

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

void walls
void zoneNames
void failureOf
void reasonOf

/** The value as the database computes it, to the millisecond: SQLite rounds the digits below */
function atDatabase(value: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
    return value.round({ smallestUnit: 'millisecond', roundingMode: 'halfExpand' })
}

// Used by the commented-out tests below; the cells where they run use them for real.
void tInstantValue

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('a-zoned-date-and-time-kept-and-read', async () => {
        // A zoned date and time sent keeps its instant and its zone; one read is the one kept
        await ctx.withRollback(async () => {
            const summer = Temporal.ZonedDateTime.from('2024-07-01T12:00:00.987654321+02:00[Europe/Madrid]')
            ctx.mockNext(1)
            sync(ctx.conn.insertInto(tZonedValue).set({ id: 10, zonedAt: summer }).executeInsert())
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into zoned_value (id, zoned_at) values (?1, ?2)"`)
            expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
              [
                "10",
                "2024-07-01T12:00:00.987654321+02:00[Europe/Madrid]",
              ]
            `)
            ctx.mockNext([...zoned, summer].map((value, i) => ({ id: i < 3 ? i + 1 : 10, zonedAt: value.toString() })))
            const rows = sync(ctx.conn.selectFrom(tZonedValue)
                .select({ id: tZonedValue.id, zonedAt: tZonedValue.zonedAt })
                .orderBy('id')
                .executeSelectMany())
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, zoned_at as zonedAt from zoned_value order by id"`)
            assertType<Exact<typeof rows, Array<{ id: number; zonedAt: Temporal.ZonedDateTime }>>>()
            expect(rows.map(row => [row.id, row.zonedAt.toString()])).toEqual([[1, zoned[0]!.toString()], [2, zoned[1]!.toString()], [3, zoned[2]!.toString()], [10, summer.toString()]])
        })
    })

    test('the-parts-of-a-zoned-date-and-time', async () => {
        ctx.mockNext(zoned.map(atDatabase).map((value, i) => ({
            id: i + 1, instant: value.toInstant().toString(), wall: value.toPlainDateTime().toString(), day: value.toPlainDate().toString(), time: value.toPlainTime().toString(),
            zone: value.timeZoneId, offset: value.offset, offsetNanoseconds: value.offsetNanoseconds, milliseconds: value.epochMilliseconds, nanoseconds: 1,
            year: value.year, month: value.month, dayOfMonth: value.day, dayOfWeek: value.dayOfWeek, dayOfYear: value.dayOfYear, hour: value.hour, minute: value.minute, second: value.second, millisecond: value.millisecond, microsecond: value.microsecond,
        })))
        const rows = sync(ctx.conn.selectFrom(tZonedValue)
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
                // An integer beyond 2^53 is read as a rounded number: its nanoseconds are compared in the query
                nanoseconds: tZonedValue.zonedAt.epochNanoseconds().in(zoned.map(value => atDatabase(value).epochNanoseconds)),
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
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, strftime('%Y-%m-%d %H:%M:%f', substr(zoned_at, 1, instr(zoned_at, '[') - 1)) as instant, strftime('%Y-%m-%d %H:%M:%f', substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), 1, length(substr(zoned_at, 1, instr(zoned_at, '[') - 1)) - case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 1 else 6 end)) as wall, date(strftime('%Y-%m-%d %H:%M:%f', substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), 1, length(substr(zoned_at, 1, instr(zoned_at, '[') - 1)) - case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 1 else 6 end))) as day, strftime('%H:%M:%f', strftime('%Y-%m-%d %H:%M:%f', substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), 1, length(substr(zoned_at, 1, instr(zoned_at, '[') - 1)) - case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 1 else 6 end))) as time, rtrim(substr(zoned_at, instr(zoned_at, '[') + 1), ']') as zone, case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then '+00:00' else substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), -6) end as offset, (case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 0 else (case when substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), -6, 1) = '-' then -1 else 1 end) * (cast(substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), -5, 2) as integer) * 3600 + cast(substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), -2, 2) as integer) * 60) end * 1000000000) as offsetNanoseconds, round((julianday(strftime('%Y-%m-%d %H:%M:%f', substr(zoned_at, 1, instr(zoned_at, '[') - 1))) - 2440587.5) * 86400000.0) as milliseconds, (cast(round((julianday(strftime('%Y-%m-%d %H:%M:%f', substr(zoned_at, 1, instr(zoned_at, '[') - 1))) - 2440587.5) * 86400000.0) as integer) * 1000000) in (?1, ?2, ?3) as nanoseconds, cast(strftime('%Y', strftime('%Y-%m-%d %H:%M:%f', substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), 1, length(substr(zoned_at, 1, instr(zoned_at, '[') - 1)) - case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 1 else 6 end))) as integer) as year, cast(strftime('%m', strftime('%Y-%m-%d %H:%M:%f', substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), 1, length(substr(zoned_at, 1, instr(zoned_at, '[') - 1)) - case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 1 else 6 end))) as integer) as month, cast(strftime('%d', strftime('%Y-%m-%d %H:%M:%f', substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), 1, length(substr(zoned_at, 1, instr(zoned_at, '[') - 1)) - case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 1 else 6 end))) as integer) as dayOfMonth, (cast(strftime('%w', strftime('%Y-%m-%d %H:%M:%f', substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), 1, length(substr(zoned_at, 1, instr(zoned_at, '[') - 1)) - case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 1 else 6 end))) as integer) + 6) % 7 + 1 as dayOfWeek, cast(strftime('%j', strftime('%Y-%m-%d %H:%M:%f', substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), 1, length(substr(zoned_at, 1, instr(zoned_at, '[') - 1)) - case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 1 else 6 end))) as integer) as dayOfYear, cast(strftime('%H', strftime('%Y-%m-%d %H:%M:%f', substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), 1, length(substr(zoned_at, 1, instr(zoned_at, '[') - 1)) - case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 1 else 6 end))) as integer) as hour, cast(strftime('%M', strftime('%Y-%m-%d %H:%M:%f', substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), 1, length(substr(zoned_at, 1, instr(zoned_at, '[') - 1)) - case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 1 else 6 end))) as integer) as minute, cast(strftime('%S', strftime('%Y-%m-%d %H:%M:%f', substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), 1, length(substr(zoned_at, 1, instr(zoned_at, '[') - 1)) - case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 1 else 6 end))) as integer) as second, cast(round(strftime('%f', strftime('%Y-%m-%d %H:%M:%f', substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), 1, length(substr(zoned_at, 1, instr(zoned_at, '[') - 1)) - case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 1 else 6 end))) * 1000) as integer) % 1000 as millisecond, case when instr(strftime('%Y-%m-%d %H:%M:%f', substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), 1, length(substr(zoned_at, 1, instr(zoned_at, '[') - 1)) - case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 1 else 6 end)), '.') = 0 then 0 else cast(substr(strftime('%Y-%m-%d %H:%M:%f', substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), 1, length(substr(zoned_at, 1, instr(zoned_at, '[') - 1)) - case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 1 else 6 end)) || '000000', instr(strftime('%Y-%m-%d %H:%M:%f', substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), 1, length(substr(zoned_at, 1, instr(zoned_at, '[') - 1)) - case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then 1 else 6 end)), '.') + 4, 3) as integer) end as microsecond from zoned_value order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1729989000123000000n,
            1705223730123000000n,
            -14182940000000000n,
          ]
        `)
        expect(rows.map(row => [row.id, row.instant.toString(), row.wall.toString(), row.day.toString(), row.time.toString(), row.zone, row.offset, row.offsetNanoseconds, row.milliseconds, row.nanoseconds,
            row.year, row.month, row.dayOfMonth, row.dayOfWeek, row.dayOfYear, row.hour, row.minute, row.second, row.millisecond, row.microsecond])).toEqual(zoned.map(atDatabase).map((value, i) => [
            i + 1, value.toInstant().toString(), value.toPlainDateTime().toString(), value.toPlainDate().toString(), value.toPlainTime().toString(), value.timeZoneId, value.offset, value.offsetNanoseconds, value.epochMilliseconds, true,
            value.year, value.month, value.day, value.dayOfWeek, value.dayOfYear, value.hour, value.minute, value.second, value.millisecond, value.microsecond,
        ]))
    })

    // NOT-APPLICABLE: this database keeps a zonedDateTime as its text and computes no time zone with the rules of IANA: what needs them is not offered here
    /*
    test('an-instant-in-a-zone', async () => {
        // The same instant in another zone, in the zone of a column (none in row 3), and an instant given in an offset zone
        ctx.mockNext(zoned.map((value, i) => ({
            id: i + 1,
            tokyo: value.toInstant().toString() + ' AD[ASIA/TOKYO]',
            ofColumn: zoneNames[i] === undefined ? null : value.toInstant().toString() + ' AD[' + zoneNames[i]!.toUpperCase() + ']',
            newYork: value.toInstant().toString() + ' AD[AMERICA/NEW_YORK]',
            offsetZone: '2024-01-14T09:15:30.123456789Z AD[+05:30]',
        })))
        const rows = sync(ctx.conn.selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                tokyo: tZonedValue.zonedAt.withTimeZone('Asia/Tokyo'),
                ofColumn: tZonedValue.zonedAt.withTimeZone(tZonedValue.zoneName),
                newYork: tZonedValue.zonedAt.toInstant().toZonedDateTimeISO('America/New_York'),
                offsetZone: ctx.conn.const(Temporal.Instant.from('2024-01-14T09:15:30.123456789Z'), 'instant').toZonedDateTimeISO('+05:30'),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; tokyo: Temporal.ZonedDateTime; ofColumn?: Temporal.ZonedDateTime; newYork: Temporal.ZonedDateTime; offsetZone: Temporal.ZonedDateTime }>>>()
        expect(rows.map(row => [row.id, row.tokyo.toString(), row.ofColumn?.toString(), row.newYork.toString(), row.offsetZone.toString()])).toEqual(zoned.map((value, i) => [
            i + 1, value.withTimeZone('Asia/Tokyo').toString(), zoneNames[i] === undefined ? undefined : value.withTimeZone(zoneNames[i]!).toString(), value.toInstant().toZonedDateTimeISO('America/New_York').toString(),
            Temporal.Instant.from('2024-01-14T09:15:30.123456789Z').toZonedDateTimeISO('+05:30').toString(),
        ]))
    })
    */

    // NOT-APPLICABLE: this database keeps a zonedDateTime as its text and computes no time zone with the rules of IANA: what needs them is not offered here
    /*
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
        const rows = sync(ctx.conn.selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                compatible: tZonedValue.wallAt.toZonedDateTime('Europe/Madrid'),
                earlier: tZonedValue.wallAt.toZonedDateTime('Europe/Madrid', { disambiguation: 'earlier' }),
                later: tZonedValue.wallAt.toZonedDateTime('Europe/Madrid', { disambiguation: 'later' }),
                ofColumn: tZonedValue.wallAt.toZonedDateTime(tZonedValue.zoneName),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; compatible?: Temporal.ZonedDateTime; earlier?: Temporal.ZonedDateTime; later?: Temporal.ZonedDateTime; ofColumn?: Temporal.ZonedDateTime }>>>()
        expect(rows.map(row => [row.id, row.compatible?.toString(), row.earlier?.toString(), row.later?.toString(), row.ofColumn?.toString()])).toEqual(walls.map((wall, i) => [
            i + 1, wall.toZonedDateTime('Europe/Madrid').toString(), wall.toZonedDateTime('Europe/Madrid', { disambiguation: 'earlier' }).toString(), wall.toZonedDateTime('Europe/Madrid', { disambiguation: 'later' }).toString(),
            zoneNames[i] === undefined ? undefined : wall.toZonedDateTime(zoneNames[i]!).toString(),
        ]))
    })
    */

    // NOT-APPLICABLE: this database keeps a zonedDateTime as its text and computes no time zone with the rules of IANA: what needs them is not offered here
    /*
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(failures).toEqual([ctx.realDbEnabled, ctx.realDbEnabled, false])
    })
    */

    test('zoned-date-and-times-compared-by-their-instant', async () => {
        // Compared and ordered by their instant, as Temporal's compare: row 2 in Tokyo is row 2 (Temporal's equals also
        // compares the zone)
        ctx.mockNext([1])
        const later = sync(ctx.conn.selectFrom(tZonedValue)
            .where(tZonedValue.zonedAt.greaterThan(zoned[1]!.withTimeZone('UTC')))
            .selectOneColumn(tZonedValue.id)
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as result from zoned_value where strftime('%Y-%m-%d %H:%M:%f', substr(zoned_at, 1, instr(zoned_at, '[') - 1)) > ?1"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-14 09:15:30.123",
          ]
        `)
        ctx.mockNext([2])
        const same = sync(ctx.conn.selectFrom(tZonedValue)
            .where(tZonedValue.zonedAt.equals(zoned[1]!.withTimeZone('Asia/Tokyo')))
            .selectOneColumn(tZonedValue.id)
            .executeSelectMany())
        ctx.mockNext([3, 2, 1].map(id => ({ id, at: zoned[id - 1]!.toString() })))
        const ordered = (sync(ctx.conn.selectFrom(tZonedValue)
            .select({ id: tZonedValue.id, at: tZonedValue.zonedAt })
            .orderBy('at')
            .executeSelectMany())).map(row => row.id)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, zoned_at as at from zoned_value order by strftime('%Y-%m-%d %H:%M:%f', substr(zoned_at, 1, instr(zoned_at, '[') - 1))"`)
        expect([later, same, ordered]).toEqual([
            zoned.flatMap((value, i) => Temporal.ZonedDateTime.compare(value, zoned[1]!) > 0 ? [i + 1] : []),
            [2],
            zoned.map((value, i) => ({ value, id: i + 1 })).sort((a, b) => Temporal.ZonedDateTime.compare(a.value, b.value)).map(entry => entry.id),
        ])
    })

    // NOT-APPLICABLE: this database keeps a zonedDateTime as its text and computes no time zone with the rules of IANA: what needs them is not offered here
    /*
    test('a-zoned-date-and-time-plus-a-duration', async () => {
        // Days are added to the wall clock in the zone: row 1 plus a day is 02:30 on the next day, an hour later in UTC,
        // as Madrid goes back an hour; hours are added to the instant; a duration value source as well
        const duration = Temporal.Duration.from('P1DT2H')
        const text = (value: Temporal.ZonedDateTime) => value.toInstant().toString() + ' AD[' + value.timeZoneId.toUpperCase() + ']'
        ctx.mockNext(zoned.map((value, i) => ({
            id: i + 1, nextDay: text(value.add({ days: 1 })), twoHoursBefore: text(value.subtract({ hours: 2 })), monthAndHour: text(value.add({ months: 1, hours: 1 })), ofDuration: text(value.add(duration)),
        })))
        const rows = sync(ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                nextDay: zonedAt.add({ days: 1 }),
                twoHoursBefore: zonedAt.subtract({ hours: 2 }),
                monthAndHour: zonedAt.add({ months: 1, hours: 1 }),
                ofDuration: zonedAt.add(ctx.withLibraryFunctions().const(duration, 'duration')),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; nextDay: Temporal.ZonedDateTime; twoHoursBefore: Temporal.ZonedDateTime; monthAndHour: Temporal.ZonedDateTime; ofDuration: Temporal.ZonedDateTime }>>>()
        expect(rows.map(row => [row.id, row.nextDay.toString(), row.twoHoursBefore.toString(), row.monthAndHour.toString(), row.ofDuration.toString()])).toEqual(zoned.map((value, i) => [
            i + 1, value.add({ days: 1 }).toString(), value.subtract({ hours: 2 }).toString(), value.add({ months: 1, hours: 1 }).toString(), value.add(duration).toString(),
        ]))
    })
    */

    // NOT-APPLICABLE: this database keeps a zonedDateTime as its text and computes no time zone with the rules of IANA: what needs them is not offered here
    /*
    test('a-zoned-date-and-time-plus-a-duration-with-and-without-the-functions-of-the-library', async () => {
        // With the functions of the library, tsq_zoned_plus_date adds the years, months, weeks and days to the wall clock
        // in its zone and takes it back to the zone, writing the value once: the values are the ones of Temporal, with and
        // without the functions; a wall clock the zone skips (row 1 plus 5 months and 3 days is 2025-03-30 02:30, which
        // Madrid skips) moves as Temporal moves it with the functions (the mock answers no rows: there it is the SQL that
        // is checked)
        const duration = Temporal.Duration.from('P2DT3H')
        const query = (conn: typeof ctx.conn) => sync(conn.selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                weeksAndHours: zonedAt.add({ weeks: 2, hours: 3 }),
                yearBefore: zonedAt.subtract({ years: 1, days: 1 }),
                rejecting: zonedAt.add({ months: 4 }, { overflow: 'reject' }),
                ofDuration: zonedAt.add(conn.const(duration, 'duration')),
            })
            .orderBy('id')
            .executeSelectMany())
        ctx.mockNext([])
        const withFunctions = await query(ctx.withLibraryFunctions())
        expect(ctx.lastSql).toMatchInlineSnapshot()
        ctx.mockNext([])
        const withoutFunctions = await query(ctx.conn)
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(withFunctions.length).toBe(ctx.realDbEnabled ? 3 : 0)
        const ofTemporal = zoned.map((value, i) => [
            i + 1, value.add({ weeks: 2, hours: 3 }).toString(), value.subtract({ years: 1, days: 1 }).toString(), value.add({ months: 4 }, { overflow: 'reject' }).toString(), value.add(duration).toString(),
        ])
        type Row = (typeof withFunctions)[number]
        const read = (row: Row) => [row.id, row.weeksAndHours.toString(), row.yearBefore.toString(), row.rejecting.toString(), row.ofDuration.toString()]
        expect(withFunctions.map(read)).toEqual(ofTemporal.slice(0, withFunctions.length))
        expect(withoutFunctions.map(read)).toEqual(ofTemporal.slice(0, withoutFunctions.length))
        ctx.mockNext([])
        const skipped = sync(ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .where(tZonedValue.id.equals(1))
            .select({ gap: zonedAt.add({ months: 5, days: 3 }) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(skipped.map(row => row.gap.toString())).toEqual(ctx.realDbEnabled ? [zoned[0]!.add({ months: 5, days: 3 }).toString()] : [])
    })
    */

    // NOT-APPLICABLE: this database keeps a zonedDateTime as its text and computes no time zone with the rules of IANA: what needs them is not offered here
    /*
    test('a-zoned-date-and-time-plus-a-duration-of-fields-of-the-query', async () => {
        // The int 42 of col_matrix row 1 as days, months and hours: the date added to the wall clock in its zone, the
        // time to the instant, as Temporal; with and without the functions of the library (the mock answers no rows:
        // there it is the SQL that is checked)
        const query = (conn: typeof ctx.conn) => sync(conn.selectFrom(tZonedValue)
            .join(tColMatrixPlain).on(tColMatrixPlain.id.equals(1))
            .select({
                id: tZonedValue.id,
                plusDays: zonedAt.add({ days: tColMatrixPlain.mInt }),
                minusHours: zonedAt.subtract({ hours: tColMatrixPlain.mInt, minutes: 30 }),
                monthsAndHour: zonedAt.add({ months: tColMatrixPlain.mInt, hours: 1 }),
            })
            .orderBy('id')
            .executeSelectMany())
        ctx.mockNext([])
        const withFunctions = await query(ctx.withLibraryFunctions())
        expect(ctx.lastSql).toMatchInlineSnapshot()
        ctx.mockNext([])
        const withoutFunctions = await query(ctx.conn)
        expect(ctx.lastSql).toMatchInlineSnapshot()
        assertType<Exact<typeof withFunctions, Array<{ id: number; plusDays: Temporal.ZonedDateTime; minusHours: Temporal.ZonedDateTime; monthsAndHour: Temporal.ZonedDateTime }>>>()
        expect(withFunctions.length).toBe(ctx.realDbEnabled ? 3 : 0)
        const ofTemporal = zoned.map((value, i) => [i + 1, value.add({ days: 42 }).toString(), value.subtract({ hours: 42, minutes: 30 }).toString(), value.add({ months: 42, hours: 1 }).toString()])
        type Row = (typeof withFunctions)[number]
        const read = (row: Row) => [row.id, row.plusDays.toString(), row.minusHours.toString(), row.monthsAndHour.toString()]
        expect(withFunctions.map(read)).toEqual(ofTemporal.slice(0, withFunctions.length))
        expect(withoutFunctions.map(read)).toEqual(ofTemporal.slice(0, withoutFunctions.length))
    })
    */

    // NOT-APPLICABLE: this database keeps a zonedDateTime as its text and computes no time zone with the rules of IANA: what needs them is not offered here
    /*
    test('a-zoned-date-and-time-with-fields-of-the-query', async () => {
        // The int 42 of col_matrix row 1 minus 30 as the hour: the wall clock at 12 in its zone, taken back to the zone
        // as Temporal takes it; with and without the functions of the library (the mock answers no rows: there it is the
        // SQL that is checked)
        const query = (conn: typeof ctx.conn) => sync(conn.selectFrom(tZonedValue)
            .join(tColMatrixPlain).on(tColMatrixPlain.id.equals(1))
            .select({
                id: tZonedValue.id,
                atNoon: zonedAt.with({ hour: tColMatrixPlain.mInt.subtract(conn.const(30, 'int')), minute: 0 }),
            })
            .orderBy('id')
            .executeSelectMany())
        ctx.mockNext([])
        const withFunctions = await query(ctx.withLibraryFunctions())
        expect(ctx.lastSql).toMatchInlineSnapshot()
        ctx.mockNext([])
        const withoutFunctions = await query(ctx.conn)
        expect(ctx.lastSql).toMatchInlineSnapshot()
        assertType<Exact<typeof withFunctions, Array<{ id: number; atNoon: Temporal.ZonedDateTime }>>>()
        expect(withFunctions.length).toBe(ctx.realDbEnabled ? 3 : 0)
        const ofTemporal = zoned.map((value, i) => [i + 1, value.with({ hour: 12, minute: 0 }).toString()])
        type Row = (typeof withFunctions)[number]
        const read = (row: Row) => [row.id, row.atNoon.toString()]
        expect(withFunctions.map(read)).toEqual(ofTemporal.slice(0, withFunctions.length))
        expect(withoutFunctions.map(read)).toEqual(ofTemporal.slice(0, withoutFunctions.length))
    })
    */

    // NOT-APPLICABLE: this database keeps a zonedDateTime as its text and computes no time zone with the rules of IANA: what needs them is not offered here
    /*
    test('a-zoned-date-and-time-with-other-fields-rounded-and-at-the-start-of-its-day', async () => {
        // Row 1 is in the first 02:30 of a day Madrid repeats, with 25 hours: with keeps its offset when the zone still
        // has it, round rounds its wall clock, round to a day takes the start of its day or of the next one
        const noon = Temporal.PlainTime.from('12:00')
        const text = (value: Temporal.ZonedDateTime) => value.toInstant().toString() + ' AD[' + value.timeZoneId.toUpperCase() + ']'
        ctx.mockNext(zoned.map((value, i) => ({
            id: i + 1, quarterTo: text(value.with({ minute: 45 })), later: text(value.with({ minute: 45 }, { offset: 'ignore', disambiguation: 'later' })), hour: text(value.round('hour')),
            day: text(value.round('day')), start: text(value.startOfDay()), atNoon: text(value.withPlainTime(noon)), hoursInDay: value.hoursInDay,
        })))
        const rows = sync(ctx.conn.selectFrom(tZonedValue)
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
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; quarterTo: Temporal.ZonedDateTime; later: Temporal.ZonedDateTime; hour: Temporal.ZonedDateTime; day: Temporal.ZonedDateTime; start: Temporal.ZonedDateTime; atNoon: Temporal.ZonedDateTime; hoursInDay: number }>>>()
        expect(rows.map(row => [row.id, row.quarterTo.toString(), row.later.toString(), row.hour.toString(), row.day.toString(), row.start.toString(), row.atNoon.toString(), row.hoursInDay])).toEqual(zoned.map((value, i) => [
            i + 1, value.with({ minute: 45 }).toString(), value.with({ minute: 45 }, { offset: 'ignore', disambiguation: 'later' }).toString(), value.round('hour').toString(),
            value.round('day').toString(), value.startOfDay().toString(), value.withPlainTime(noon).toString(), value.hoursInDay,
        ]))
    })
    */

    // NOT-APPLICABLE: this database keeps a zonedDateTime as its text and computes no time zone with the rules of IANA: what needs them is not offered here
    /*
    test('operations-on-a-computed-zoned-date-and-time', async () => {
        // A value computed from another one is computed once and named in the query; each operation is Temporal's
        const text = (value: Temporal.ZonedDateTime) => value.toInstant().toString() + ' AD[' + value.timeZoneId.toUpperCase() + ']'
        const chain = (value: Temporal.ZonedDateTime) => value.add({ days: 1 }).with({ hour: 3 }).round('hour')
        ctx.mockNext(zoned.map((value, i) => ({ id: i + 1, chained: text(chain(value).startOfDay()), hoursInDay: chain(value).hoursInDay })))
        const rows = sync(ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                chained: zonedAt.add({ days: 1 }).with({ hour: 3 }).round('hour').startOfDay(),
                hoursInDay: zonedAt.add({ days: 1 }).with({ hour: 3 }).round('hour').hoursInDay(),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; chained: Temporal.ZonedDateTime; hoursInDay: number }>>>()
        expect(rows.map(row => [row.id, row.chained.toString(), row.hoursInDay])).toEqual(zoned.map((value, i) => [i + 1, chain(value).startOfDay().toString(), chain(value).hoursInDay]))
    })
    */

    // NOT-APPLICABLE: this database keeps a zonedDateTime as its text and computes no time zone with the rules of IANA: what needs them is not offered here
    /*
    test('reject-fails-for-a-day-the-month-has-not-or-an-offset-the-zone-has-not', async () => {
        // As Temporal: row 1 is in October, a month later November has its day 27; February has no day 30; Madrid has
        // no offset +05:00
        const failures: boolean[] = []
        const value = zoned[0]!
        const text = (zonedValue: Temporal.ZonedDateTime) => zonedValue.toInstant().toString() + ' AD[' + zonedValue.timeZoneId.toUpperCase() + ']'
        ctx.mockNext([text(value.add({ months: 1 }, { overflow: 'reject' }))])
        failures.push(await failureOf(ctx.conn.selectFrom(tZonedValue).where(tZonedValue.id.equals(1)).selectOneColumn(tZonedValue.zonedAt.add({ months: 1 }, { overflow: 'reject' })).executeSelectMany()))
        ctx.mockNext([])
        failures.push(await failureOf(ctx.conn.selectFrom(tZonedValue).where(tZonedValue.id.equals(1)).selectOneColumn(tZonedValue.zonedAt.with({ month: 2, day: 30 }, { overflow: 'reject' })).executeSelectMany()))
        ctx.mockNext([])
        failures.push(await failureOf(ctx.conn.selectFrom(tZonedValue).where(tZonedValue.id.equals(1)).selectOneColumn(tZonedValue.zonedAt.with({ offset: '+05:00' }, { offset: 'reject' })).executeSelectMany()))
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(failures).toEqual([false, ctx.realDbEnabled, ctx.realDbEnabled])
    })
    */

    // NOT-APPLICABLE: this database keeps a zonedDateTime as its text and computes no time zone with the rules of IANA: what needs them is not offered here
    /*
    test('the-duration-between-two-zoned-dates-and-times', async () => {
        // In hours by default, the difference of their instants; in days, the days of the calendar in their zone: row 1
        // to two days later in Madrid is 2 days and 1 hour, which a day of 25 hours makes 49 hours
        const later = (value: Temporal.ZonedDateTime) => value.add({ days: 2, hours: 1 })
        ctx.mockNext(zoned.map((value, i) => ({
            id: i + 1, hours: value.until(later(value)).toString(), days: value.until(later(value), { largestUnit: 'day' }).toString(),
            months: value.since(value.subtract({ months: 1, days: 10 }), { largestUnit: 'month', smallestUnit: 'month', roundingMode: 'halfExpand' }).toString(),
        })))
        const rows = sync(ctx.withLibraryFunctions().selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                hours: zonedAt.until(zonedAt.add({ days: 2, hours: 1 })),
                days: zonedAt.until(zonedAt.add({ days: 2, hours: 1 }), { largestUnit: 'day' }),
                months: zonedAt.since(zonedAt.subtract({ months: 1, days: 10 }), { largestUnit: 'month', smallestUnit: 'month', roundingMode: 'halfExpand' }),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; hours: Temporal.Duration; days: Temporal.Duration; months: Temporal.Duration }>>>()
        expect(rows.map(row => [row.id, row.hours.toString(), row.days.toString(), row.months.toString()])).toEqual(zoned.map((value, i) => [
            i + 1, value.until(later(value)).toString(), value.until(later(value), { largestUnit: 'day' }).toString(),
            value.since(value.subtract({ months: 1, days: 10 }), { largestUnit: 'month', smallestUnit: 'month', roundingMode: 'halfExpand' }).toString(),
        ]))
    })
    */

    // NOT-APPLICABLE: this database keeps a zonedDateTime as its text and computes no time zone with the rules of IANA: what needs them is not offered here
    /*
    test('a-difference-in-days-needs-the-same-zone', async () => {
        // As Temporal, which rejects it: row 2 is in Kolkata, the other value in Madrid; in hours any two are compared
        const madrid = Temporal.ZonedDateTime.from('2024-02-01T00:00:00+01:00[Europe/Madrid]')
        ctx.mockNext([])
        const failure = await failureOf(ctx.conn.selectFrom(tZonedValue).where(tZonedValue.id.equals(2)).selectOneColumn(tZonedValue.zonedAt.until(madrid, { largestUnit: 'day' })).executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot()
        ctx.mockNext(zoned[1]!.until(madrid).toString())
        const hours = sync(ctx.conn.selectFrom(tZonedValue).where(tZonedValue.id.equals(2)).selectOneColumn(tZonedValue.zonedAt.until(madrid)).executeSelectOne())
        expect([failure, hours.toString()]).toEqual([ctx.realDbEnabled, zoned[1]!.until(madrid).toString()])
    })
    */

    // NOT-APPLICABLE: this database keeps a zonedDateTime as its text and computes no time zone with the rules of IANA: what needs them is not offered here
    /*
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
            sync(ctx.conn.update(tZonedValue).set({ zonedAt: summer }).where(tZonedValue.id.equals(3)).executeUpdate())
            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
            ctx.mockNext(1)
            sync(ctx.conn.update(tZonedValue).set({ zonedAt: tZonedValue.zonedAt.add({ days: 1 }) }).where(tZonedValue.id.equals(1)).executeUpdate())
            expect(ctx.lastSql).toMatchInlineSnapshot()
            const expected = [kept[0]!.add({ days: 1 }), kept[1]!, summer]
            const ordered = expected.map((value, i) => ({ id: i + 1, value })).sort((a, b) => Temporal.ZonedDateTime.compare(a.value, b.value))
            ctx.mockNext(ordered.map(({ id, value }) => ({
                id, zonedAt: value.toInstant().toString() + ' AD[' + value.timeZoneId + ']', hour: value.hour,
                inTokyo: value.toInstant().toString() + ' AD[Asia/Tokyo]', hoursInDay: value.hoursInDay,
            })))
            const rows = sync(ctx.conn.selectFrom(tZonedValue)
                .select({
                    id: tZonedValue.id,
                    zonedAt: tZonedValue.zonedAt,
                    hour: tZonedValue.zonedAt.hour(),
                    inTokyo: tZonedValue.zonedAt.withTimeZone('Asia/Tokyo'),
                    hoursInDay: tZonedValue.zonedAt.hoursInDay(),
                })
                .orderBy('zonedAt')
                .executeSelectMany())
            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(rows.map(row => [row.id, row.zonedAt?.toString(), row.hour, row.inTokyo?.toString(), row.hoursInDay])).toEqual(ordered.map(({ id, value }) => [id, value.toString(), value.hour, value.withTimeZone('Asia/Tokyo').toString(), value.hoursInDay]))
        })
    })
    */

    test('a-zoned-date-and-time-in-a-column-of-text', async () => {
        // A column declared to keep its RFC 9557 text by its SQL data type: a value sent is the text of Temporal's
        // toString; it is read, compared and ordered by its instant
        const summer = Temporal.ZonedDateTime.from('2024-07-01T12:00:00.987654321+02:00[Europe/Madrid]')
        const since = Temporal.ZonedDateTime.from('2024-01-01T00:00:00+00:00[UTC]')
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            sync(ctx.conn.update(tZonedValue).set({ zonedText: summer }).where(tZonedValue.id.equals(3)).executeUpdate())
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update zoned_value set zoned_at = ?1 where id = ?2"`)
            expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
              [
                "2024-07-01T12:00:00.987654321+02:00[Europe/Madrid]",
                "3",
              ]
            `)
            const values = [zoned[0]!, zoned[1]!, summer]
            const ordered = values.map((value, i) => ({ id: i + 1, value })).filter(entry => Temporal.ZonedDateTime.compare(entry.value, since) >= 0).sort((a, b) => Temporal.ZonedDateTime.compare(a.value, b.value))
            ctx.mockNext(ordered.map(({ id, value }) => ({ id, zonedText: value.toString() })))
            const rows = sync(ctx.conn.selectFrom(tZonedValue)
                .where(tZonedValue.zonedText.greaterOrEqual(since))
                .select({ id: tZonedValue.id, zonedText: tZonedValue.zonedText })
                .orderBy('zonedText')
                .executeSelectMany())
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, zoned_at as zonedText from zoned_value where strftime('%Y-%m-%d %H:%M:%f', substr(zoned_at, 1, instr(zoned_at, '[') - 1)) >= ?1 order by strftime('%Y-%m-%d %H:%M:%f', substr(zoned_at, 1, instr(zoned_at, '[') - 1))"`)
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
        const withFunctions = sync(query(ctx.withLibraryFunctions()))
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(strftime('%H', strftime('%Y-%m-%d %H:%M:%f', tsq_zoned_wall(zoned_at))) as integer) as hour, case when substr(zoned_at, 1, instr(zoned_at, '[') - 1) like '%Z' then '+00:00' else substr(substr(zoned_at, 1, instr(zoned_at, '[') - 1), -6) end as offset, round((julianday(strftime('%Y-%m-%d %H:%M:%f', substr(zoned_at, 1, instr(zoned_at, '[') - 1))) - 2440587.5) * 86400000.0) as epochMilliseconds from zoned_value where strftime('%Y-%m-%d %H:%M:%f', substr(zoned_at, 1, instr(zoned_at, '[') - 1)) >= ?1 order by id"`)
        ctx.mockNext(expected)
        const withoutFunctions = sync(query(ctx.conn))
        expect(withFunctions).toEqual(expected)
        expect(withoutFunctions).toEqual(expected)
    })

    test('zoned-dates-and-times-in-an-aggregated-array', async () => {
        // Inside the JSON of an aggregated array a zoned date and time keeps its zone: a column kept as its text
        ctx.mockNext({ ats: zoned.map((value, i) => ({ id: i + 1, at: value.toString() })) })
        const row = sync(ctx.conn.selectFrom(tZonedValue)
            .select({ ats: ctx.conn.aggregateAsArray({ id: tZonedValue.id, at: tZonedValue.zonedText }) })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select json_group_array(json_object('id', id, 'at', zoned_at)) as ats from zoned_value"`)
        expect(row.ats.map(entry => [entry.id, entry.at?.toString()]).sort((a, b) => Number(a[0]) - Number(b[0]))).toEqual(zoned.map((value, i) => [i + 1, value.toString()]))
    })

    // NOT-APPLICABLE: this database keeps a zonedDateTime as its text and computes no time zone with the rules of IANA: what needs them is not offered here
    /*
    test('a-zoned-date-and-time-needs-a-database-with-zones', async () => {
        // This database keeps no zone with each value: the query isn't sent
        const reason = await reasonOf(() => sync(ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.id.equals(1))
            .select({ id: tInstantValue.id, at: tInstantValue.instantAt.toZonedDateTimeISO('Europe/Madrid') })
            .executeSelectMany()))
        expect(reason).toBe('UNSUPPORTED_QUERY')
    })
    */
})
