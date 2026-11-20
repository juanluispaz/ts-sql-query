// An exact moment in a time zone (Temporal.ZonedDateTime), which only a database that keeps a zone with each value has:
// this one has none, and a query with one fails when it is built.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'
import { tInstantValue } from '../../domain/connection.js'
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

void zoned
void walls
void zoneNames
void failureOf

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-SUPPORTED: this database keeps no time zone with each value: a zonedDateTime is only kept and computed on Oracle
    /*
    test('a-zoned-date-and-time-kept-and-read', async () => {
        // A zoned date and time sent keeps its instant and its zone; one read is the one kept
        await ctx.withRollback(async () => {
            const summer = Temporal.ZonedDateTime.from('2024-07-01T12:00:00.987654321+02:00[Europe/Madrid]')
            ctx.mockNext(1)
            await ctx.conn.insertInto(tZonedValue).set({ id: 10, zonedAt: summer }).executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
            ctx.mockNext([...zoned, summer].map((value, i) => ({ id: i < 3 ? i + 1 : 10, zonedAt: value.toInstant().toString() + ' AD[' + value.timeZoneId.toUpperCase() + ']' })))
            const rows = await ctx.conn.selectFrom(tZonedValue)
                .select({ id: tZonedValue.id, zonedAt: tZonedValue.zonedAt })
                .orderBy('id')
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot()
            assertType<Exact<typeof rows, Array<{ id: number; zonedAt: Temporal.ZonedDateTime }>>>()
            expect(rows.map(row => [row.id, row.zonedAt.toString()])).toEqual([[1, zoned[0]!.toString()], [2, zoned[1]!.toString()], [3, zoned[2]!.toString()], [10, summer.toString()]])
        })
    })
    */

    // NOT-SUPPORTED: this database keeps no time zone with each value: a zonedDateTime is only kept and computed on Oracle
    /*
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        expect(rows.map(row => [row.id, row.instant.toString(), row.wall.toString(), row.day.toString(), row.time.toString(), row.zone, row.offset, row.offsetNanoseconds, row.milliseconds, row.nanoseconds,
            row.year, row.month, row.dayOfMonth, row.dayOfWeek, row.dayOfYear, row.hour, row.minute, row.second, row.millisecond, row.microsecond])).toEqual(zoned.map((value, i) => [
            i + 1, value.toInstant().toString(), value.toPlainDateTime().toString(), value.toPlainDate().toString(), value.toPlainTime().toString(), value.timeZoneId, value.offset, value.offsetNanoseconds, value.epochMilliseconds, value.epochNanoseconds,
            value.year, value.month, value.day, value.dayOfWeek, value.dayOfYear, value.hour, value.minute, value.second, value.millisecond, value.microsecond,
        ]))
    })
    */

    // NOT-SUPPORTED: this database keeps no time zone with each value: a zonedDateTime is only kept and computed on Oracle
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; tokyo: Temporal.ZonedDateTime; ofColumn?: Temporal.ZonedDateTime; newYork: Temporal.ZonedDateTime; offsetZone: Temporal.ZonedDateTime }>>>()
        expect(rows.map(row => [row.id, row.tokyo.toString(), row.ofColumn?.toString(), row.newYork.toString(), row.offsetZone.toString()])).toEqual(zoned.map((value, i) => [
            i + 1, value.withTimeZone('Asia/Tokyo').toString(), zoneNames[i] === undefined ? undefined : value.withTimeZone(zoneNames[i]!).toString(), value.toInstant().toZonedDateTimeISO('America/New_York').toString(),
            Temporal.Instant.from('2024-01-14T09:15:30.123456789Z').toZonedDateTimeISO('+05:30').toString(),
        ]))
    })
    */

    // NOT-SUPPORTED: this database keeps no time zone with each value: a zonedDateTime is only kept and computed on Oracle
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; compatible?: Temporal.ZonedDateTime; earlier?: Temporal.ZonedDateTime; later?: Temporal.ZonedDateTime; ofColumn?: Temporal.ZonedDateTime }>>>()
        expect(rows.map(row => [row.id, row.compatible?.toString(), row.earlier?.toString(), row.later?.toString(), row.ofColumn?.toString()])).toEqual(walls.map((wall, i) => [
            i + 1, wall.toZonedDateTime('Europe/Madrid').toString(), wall.toZonedDateTime('Europe/Madrid', { disambiguation: 'earlier' }).toString(), wall.toZonedDateTime('Europe/Madrid', { disambiguation: 'later' }).toString(),
            zoneNames[i] === undefined ? undefined : wall.toZonedDateTime(zoneNames[i]!).toString(),
        ]))
    })
    */

    // NOT-SUPPORTED: this database keeps no time zone with each value: a zonedDateTime is only kept and computed on Oracle
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

    // NOT-SUPPORTED: this database keeps no time zone with each value: a zonedDateTime is only kept and computed on Oracle
    /*
    test('zoned-date-and-times-compared-by-their-instant', async () => {
        // Compared and ordered by their instant, as Temporal's compare: row 2 in Tokyo is row 2 (Temporal's equals also
        // compares the zone)
        ctx.mockNext([1])
        const later = await ctx.conn.selectFrom(tZonedValue)
            .where(tZonedValue.zonedAt.greaterThan(zoned[1]!.withTimeZone('UTC')))
            .selectOneColumn(tZonedValue.id)
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect([later, same, ordered]).toEqual([
            zoned.flatMap((value, i) => Temporal.ZonedDateTime.compare(value, zoned[1]!) > 0 ? [i + 1] : []),
            [2],
            zoned.map((value, i) => ({ value, id: i + 1 })).sort((a, b) => Temporal.ZonedDateTime.compare(a.value, b.value)).map(entry => entry.id),
        ])
    })
    */

    // NOT-SUPPORTED: this database keeps no time zone with each value: a zonedDateTime is only kept and computed on Oracle
    /*
    test('a-zoned-date-and-time-plus-a-duration', async () => {
        // Days are added to the wall clock in the zone: row 1 plus a day is 02:30 on the next day, an hour later in UTC,
        // as Madrid goes back an hour; hours are added to the instant; a duration value source as well
        const duration = Temporal.Duration.from('P1DT2H')
        const text = (value: Temporal.ZonedDateTime) => value.toInstant().toString() + ' AD[' + value.timeZoneId.toUpperCase() + ']'
        ctx.mockNext(zoned.map((value, i) => ({
            id: i + 1, nextDay: text(value.add({ days: 1 })), twoHoursBefore: text(value.subtract({ hours: 2 })), monthAndHour: text(value.add({ months: 1, hours: 1 })), ofDuration: text(value.add(duration)),
        })))
        const rows = await ctx.conn.selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                nextDay: tZonedValue.zonedAt.add({ days: 1 }),
                twoHoursBefore: tZonedValue.zonedAt.subtract({ hours: 2 }),
                monthAndHour: tZonedValue.zonedAt.add({ months: 1, hours: 1 }),
                ofDuration: tZonedValue.zonedAt.add(ctx.conn.const(duration, 'duration')),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; nextDay: Temporal.ZonedDateTime; twoHoursBefore: Temporal.ZonedDateTime; monthAndHour: Temporal.ZonedDateTime; ofDuration: Temporal.ZonedDateTime }>>>()
        expect(rows.map(row => [row.id, row.nextDay.toString(), row.twoHoursBefore.toString(), row.monthAndHour.toString(), row.ofDuration.toString()])).toEqual(zoned.map((value, i) => [
            i + 1, value.add({ days: 1 }).toString(), value.subtract({ hours: 2 }).toString(), value.add({ months: 1, hours: 1 }).toString(), value.add(duration).toString(),
        ]))
    })
    */

    // NOT-SUPPORTED: this database keeps no time zone with each value: a zonedDateTime is only kept and computed on Oracle
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
        const rows = await ctx.conn.selectFrom(tZonedValue)
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; quarterTo: Temporal.ZonedDateTime; later: Temporal.ZonedDateTime; hour: Temporal.ZonedDateTime; day: Temporal.ZonedDateTime; start: Temporal.ZonedDateTime; atNoon: Temporal.ZonedDateTime; hoursInDay: number }>>>()
        expect(rows.map(row => [row.id, row.quarterTo.toString(), row.later.toString(), row.hour.toString(), row.day.toString(), row.start.toString(), row.atNoon.toString(), row.hoursInDay])).toEqual(zoned.map((value, i) => [
            i + 1, value.with({ minute: 45 }).toString(), value.with({ minute: 45 }, { offset: 'ignore', disambiguation: 'later' }).toString(), value.round('hour').toString(),
            value.round('day').toString(), value.startOfDay().toString(), value.withPlainTime(noon).toString(), value.hoursInDay,
        ]))
    })
    */

    // NOT-SUPPORTED: this database keeps no time zone with each value: a zonedDateTime is only kept and computed on Oracle
    /*
    test('operations-on-a-computed-zoned-date-and-time', async () => {
        // A value computed from another one is computed once and named in the query; each operation is Temporal's
        const text = (value: Temporal.ZonedDateTime) => value.toInstant().toString() + ' AD[' + value.timeZoneId.toUpperCase() + ']'
        const chain = (value: Temporal.ZonedDateTime) => value.add({ days: 1 }).with({ hour: 3 }).round('hour')
        ctx.mockNext(zoned.map((value, i) => ({ id: i + 1, chained: text(chain(value).startOfDay()), hoursInDay: chain(value).hoursInDay })))
        const rows = await ctx.conn.selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                chained: tZonedValue.zonedAt.add({ days: 1 }).with({ hour: 3 }).round('hour').startOfDay(),
                hoursInDay: tZonedValue.zonedAt.add({ days: 1 }).with({ hour: 3 }).round('hour').hoursInDay(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; chained: Temporal.ZonedDateTime; hoursInDay: number }>>>()
        expect(rows.map(row => [row.id, row.chained.toString(), row.hoursInDay])).toEqual(zoned.map((value, i) => [i + 1, chain(value).startOfDay().toString(), chain(value).hoursInDay]))
    })
    */

    // NOT-SUPPORTED: this database keeps no time zone with each value: a zonedDateTime is only kept and computed on Oracle
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

    // NOT-SUPPORTED: this database keeps no time zone with each value: a zonedDateTime is only kept and computed on Oracle
    /*
    test('the-duration-between-two-zoned-dates-and-times', async () => {
        // In hours by default, the difference of their instants; in days, the days of the calendar in their zone: row 1
        // to two days later in Madrid is 2 days and 1 hour, which a day of 25 hours makes 49 hours
        const later = (value: Temporal.ZonedDateTime) => value.add({ days: 2, hours: 1 })
        ctx.mockNext(zoned.map((value, i) => ({
            id: i + 1, hours: value.until(later(value)).toString(), days: value.until(later(value), { largestUnit: 'day' }).toString(),
            months: value.since(value.subtract({ months: 1, days: 10 }), { largestUnit: 'month', smallestUnit: 'month', roundingMode: 'halfExpand' }).toString(),
        })))
        const rows = await ctx.conn.selectFrom(tZonedValue)
            .select({
                id: tZonedValue.id,
                hours: tZonedValue.zonedAt.until(tZonedValue.zonedAt.add({ days: 2, hours: 1 })),
                days: tZonedValue.zonedAt.until(tZonedValue.zonedAt.add({ days: 2, hours: 1 }), { largestUnit: 'day' }),
                months: tZonedValue.zonedAt.since(tZonedValue.zonedAt.subtract({ months: 1, days: 10 }), { largestUnit: 'month', smallestUnit: 'month', roundingMode: 'halfExpand' }),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; hours: Temporal.Duration; days: Temporal.Duration; months: Temporal.Duration }>>>()
        expect(rows.map(row => [row.id, row.hours.toString(), row.days.toString(), row.months.toString()])).toEqual(zoned.map((value, i) => [
            i + 1, value.until(later(value)).toString(), value.until(later(value), { largestUnit: 'day' }).toString(),
            value.since(value.subtract({ months: 1, days: 10 }), { largestUnit: 'month', smallestUnit: 'month', roundingMode: 'halfExpand' }).toString(),
        ]))
    })
    */

    // NOT-SUPPORTED: this database keeps no time zone with each value: a zonedDateTime is only kept and computed on Oracle
    /*
    test('a-difference-in-days-needs-the-same-zone', async () => {
        // As Temporal, which rejects it: row 2 is in Kolkata, the other value in Madrid; in hours any two are compared
        const madrid = Temporal.ZonedDateTime.from('2024-02-01T00:00:00+01:00[Europe/Madrid]')
        ctx.mockNext([])
        const failure = await failureOf(ctx.conn.selectFrom(tZonedValue).where(tZonedValue.id.equals(2)).selectOneColumn(tZonedValue.zonedAt.until(madrid, { largestUnit: 'day' })).executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot()
        ctx.mockNext(zoned[1]!.until(madrid).toString())
        const hours = await ctx.conn.selectFrom(tZonedValue).where(tZonedValue.id.equals(2)).selectOneColumn(tZonedValue.zonedAt.until(madrid)).executeSelectOne()
        expect([failure, hours.toString()]).toEqual([ctx.realDbEnabled, zoned[1]!.until(madrid).toString()])
    })
    */

    test('a-zoned-date-and-time-needs-a-database-with-zones', async () => {
        // This database keeps no zone with each value: the query isn't sent
        const reason = await reasonOf(() => ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.id.equals(1))
            .select({ id: tInstantValue.id, at: tInstantValue.instantAt.toZonedDateTimeISO('Europe/Madrid') })
            .executeSelectMany())
        expect(reason).toBe('UNSUPPORTED_QUERY')
    })
})
