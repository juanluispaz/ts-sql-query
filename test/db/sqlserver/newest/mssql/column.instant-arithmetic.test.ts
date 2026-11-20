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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, dbo.tsq_duration_text(0, 0, 0, 0, (datediff(day, cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date), cast(cast(switchoffset(@0, '+00:00') as datetime2) as date)) * cast(86400000000000 as bigint) + ((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(@1, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(@2, '+00:00') as datetime2))) - (cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(instant_at, '+00:00') as datetime2))))), 'second') as seconds, dbo.tsq_duration_text(0, 0, 0, 0, (datediff(day, cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date), cast(cast(switchoffset(@3, '+00:00') as datetime2) as date)) * cast(86400000000000 as bigint) + ((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(@4, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(@5, '+00:00') as datetime2))) - (cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(instant_at, '+00:00') as datetime2))))), 'hour') as hours, dbo.tsq_duration_text(0, 0, 0, 0, -((datediff(day, cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date), cast(cast(switchoffset(@6, '+00:00') as datetime2) as date)) * cast(86400000000000 as bigint) + ((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(@7, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(@8, '+00:00') as datetime2))) - (cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(instant_at, '+00:00') as datetime2))))) - ((datediff(day, cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date), cast(cast(switchoffset(@9, '+00:00') as datetime2) as date)) * cast(86400000000000 as bigint) + ((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(@10, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(@11, '+00:00') as datetime2))) - (cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(instant_at, '+00:00') as datetime2))))) % cast(60000000000 as bigint)) + case when ((datediff(day, cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date), cast(cast(switchoffset(@12, '+00:00') as datetime2) as date)) * cast(86400000000000 as bigint) + ((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(@13, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(@14, '+00:00') as datetime2))) - (cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(instant_at, '+00:00') as datetime2))))) % cast(60000000000 as bigint)) > 0 then cast(60000000000 as bigint) else 0 end), 'minute') as minutes from instant_value order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, dateadd(nanosecond, ((2 * (cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(instant_at, '+00:00') as datetime2))) + cast(3600000000000 as bigint)) / cast(7200000000000 as bigint) * cast(3600000000000 as bigint)) % 1000000000, dateadd(second, ((2 * (cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(instant_at, '+00:00') as datetime2))) + cast(3600000000000 as bigint)) / cast(7200000000000 as bigint) * cast(3600000000000 as bigint)) / 1000000000, cast(cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date) as datetime2))) as hour, dateadd(nanosecond, ((2 * (cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(instant_at, '+00:00') as datetime2))) + cast(5400000000000 as bigint)) / cast(10800000000000 as bigint) * cast(5400000000000 as bigint)) % 1000000000, dateadd(second, ((2 * (cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(instant_at, '+00:00') as datetime2))) + cast(5400000000000 as bigint)) / cast(10800000000000 as bigint) * cast(5400000000000 as bigint)) / 1000000000, cast(cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date) as datetime2))) as ninety, dateadd(nanosecond, ((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(instant_at, '+00:00') as datetime2))) / 1000000000 * 1000000000) % 1000000000, dateadd(second, ((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(instant_at, '+00:00') as datetime2))) / 1000000000 * 1000000000) / 1000000000, cast(cast(cast(switchoffset(instant_at, '+00:00') as datetime2) as date) as datetime2))) as floor from instant_value order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(nanosecond, ((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(@1, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(@2, '+00:00') as datetime2))) / cast(60000000000 as bigint) * cast(60000000000 as bigint)) % 1000000000, dateadd(second, ((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(@1, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(@2, '+00:00') as datetime2))) / cast(60000000000 as bigint) * cast(60000000000 as bigint)) / 1000000000, cast(cast(cast(switchoffset(@0, '+00:00') as datetime2) as date) as datetime2))) as trunc, dateadd(nanosecond, (((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(@4, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(@5, '+00:00') as datetime2))) + cast(59999999999 as bigint)) / cast(60000000000 as bigint) * cast(60000000000 as bigint)) % 1000000000, dateadd(second, (((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(@4, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(@5, '+00:00') as datetime2))) + cast(59999999999 as bigint)) / cast(60000000000 as bigint) * cast(60000000000 as bigint)) / 1000000000, cast(cast(cast(switchoffset(@3, '+00:00') as datetime2) as date) as datetime2))) as ceil, dateadd(nanosecond, ((2 * (cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(@7, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(@8, '+00:00') as datetime2))) + cast(86400000000000 as bigint)) / cast(172800000000000 as bigint) * cast(86400000000000 as bigint)) % 1000000000, dateadd(second, ((2 * (cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(@7, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(@8, '+00:00') as datetime2))) + cast(86400000000000 as bigint)) / cast(172800000000000 as bigint) * cast(86400000000000 as bigint)) / 1000000000, cast(cast(cast(switchoffset(@6, '+00:00') as datetime2) as date) as datetime2))) as day"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1969-12-31T23:59:30.5Z",
            "1969-12-31T23:59:30.5Z",
            "1969-12-31T23:59:30.5Z",
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
