// The arithmetic of an instant (Temporal.Instant), as Temporal's: plus and minus a duration of the time, the duration
// between two instants, and rounded. instant_value row 1 is 2024-01-14T09:15:30.123456Z, written with the offset +09:00
// where the column keeps one, and row 2 is 1969-07-20T20:17:40Z. Every value expected is the one Temporal gives; a
// duration is compared as Temporal compares two of them (PostgreSQL keeps it in an interval, without its fields).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'
import { tDurationValue, tInstantValue } from '../../domain/connection.js'
import { ctx } from './setup.js'

const deployed = Temporal.Instant.from('2024-01-14T09:15:30.123456Z')
const landed = Temporal.Instant.from('1969-07-20T20:17:40Z')
const later = Temporal.Instant.from('2124-03-15T10:00:00.123Z')

/** Whether the query fails with an error of the database */
async function failureOf(query: Promise<unknown>): Promise<boolean> {
    try {
        await query
        return false
    } catch (error) {
        return error instanceof TsSqlError
    }
}

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select instant_at + $1::interval as plus, instant_at + $2::interval as minus from instant_value where id = $3"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "PT91800.5S",
            "-PT3600.000001S",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select instant_value.id as id, instant_value.instant_at + duration_value.span + make_interval(days => (extract(day from make_date(2001, 2, case when extract(year from duration_value.span) <> 0 or extract(month from duration_value.span) <> 0 or extract(day from duration_value.span) <> 0 then 29 else 28 end))::integer - 28)) as plus, instant_value.instant_at - make_interval(months => tsq_duration_part(duration_value.span_text, 'M')::integer, days => tsq_duration_part(duration_value.span_text, 'D')::integer, secs => tsq_duration_part(duration_value.span_text, 'S') + tsq_duration_part(duration_value.span_text, 'N') / 1000000000.0) + make_interval(days => (extract(day from make_date(2001, 2, case when tsq_duration_part(duration_value.span_text, 'M') <> 0 or tsq_duration_part(duration_value.span_text, 'D') <> 0 then 29 else 28 end))::integer - 28)) as minus from instant_value join duration_value on duration_value.id = $1 order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select instant_value.instant_at + make_interval(months => tsq_duration_part(duration_value.span_text, 'M')::integer, days => tsq_duration_part(duration_value.span_text, 'D')::integer, secs => tsq_duration_part(duration_value.span_text, 'S') + tsq_duration_part(duration_value.span_text, 'N') / 1000000000.0) + make_interval(days => (extract(day from make_date(2001, 2, case when tsq_duration_part(duration_value.span_text, 'M') <> 0 or tsq_duration_part(duration_value.span_text, 'D') <> 0 then 29 else 28 end))::integer - 28)) as at from instant_value join duration_value on duration_value.id = $1 where instant_value.id = $2"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, make_interval(hours => cast(div(((cast($1::timestamptz as date) - cast(instant_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($2::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(instant_at as time)) * 1000000)::bigint * 1000))), 3600000000000) as integer), secs => ((cast($3::timestamptz as date) - cast(instant_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($4::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(instant_at as time)) * 1000000)::bigint * 1000))) % 3600000000000 / 1000000000.0) as seconds, make_interval(hours => cast(div(((cast($5::timestamptz as date) - cast(instant_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($6::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(instant_at as time)) * 1000000)::bigint * 1000))), 3600000000000) as integer), secs => ((cast($7::timestamptz as date) - cast(instant_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($8::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(instant_at as time)) * 1000000)::bigint * 1000))) % 3600000000000 / 1000000000.0) as hours, make_interval(hours => cast(div(-(((cast($9::timestamptz as date) - cast(instant_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($10::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(instant_at as time)) * 1000000)::bigint * 1000))) - (((cast($11::timestamptz as date) - cast(instant_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($12::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(instant_at as time)) * 1000000)::bigint * 1000))) % 60000000000) + case when (((cast($13::timestamptz as date) - cast(instant_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($14::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(instant_at as time)) * 1000000)::bigint * 1000))) % 60000000000) > 0 then 60000000000 else 0 end), 3600000000000) as integer), secs => -(((cast($15::timestamptz as date) - cast(instant_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($16::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(instant_at as time)) * 1000000)::bigint * 1000))) - (((cast($17::timestamptz as date) - cast(instant_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($18::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(instant_at as time)) * 1000000)::bigint * 1000))) % 60000000000) + case when (((cast($19::timestamptz as date) - cast(instant_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($20::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(instant_at as time)) * 1000000)::bigint * 1000))) % 60000000000) > 0 then 60000000000 else 0 end) % 3600000000000 / 1000000000.0) as minutes from instant_value order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select make_interval(hours => cast(div(((cast($1::timestamptz as date) - cast($2::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($3::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($4::timestamptz as time)) * 1000000)::bigint * 1000))), 3600000000000) as integer), secs => ((cast($5::timestamptz as date) - cast($6::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($7::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($8::timestamptz as time)) * 1000000)::bigint * 1000))) % 3600000000000 / 1000000000.0) as seconds, make_interval(hours => cast(div(((cast($9::timestamptz as date) - cast($10::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($11::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($12::timestamptz as time)) * 1000000)::bigint * 1000))), 3600000000000) as integer), secs => ((cast($13::timestamptz as date) - cast($14::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($15::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($16::timestamptz as time)) * 1000000)::bigint * 1000))) % 3600000000000 / 1000000000.0) as hours, make_interval(hours => cast(div(-(((cast($17::timestamptz as date) - cast($18::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($19::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($20::timestamptz as time)) * 1000000)::bigint * 1000))) - (((cast($21::timestamptz as date) - cast($22::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($23::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($24::timestamptz as time)) * 1000000)::bigint * 1000))) % 60000000000) + case when 2 * (((cast($25::timestamptz as date) - cast($26::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($27::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($28::timestamptz as time)) * 1000000)::bigint * 1000))) % 60000000000) > 60000000000 or 2 * (((cast($29::timestamptz as date) - cast($30::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($31::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($32::timestamptz as time)) * 1000000)::bigint * 1000))) % 60000000000) = 60000000000 and div(((cast($33::timestamptz as date) - cast($34::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($35::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($36::timestamptz as time)) * 1000000)::bigint * 1000))), 60000000000) % 2 <> 0 then 60000000000 when 2 * (((cast($37::timestamptz as date) - cast($38::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($39::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($40::timestamptz as time)) * 1000000)::bigint * 1000))) % 60000000000) < -60000000000 or 2 * (((cast($41::timestamptz as date) - cast($42::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($43::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($44::timestamptz as time)) * 1000000)::bigint * 1000))) % 60000000000) = -60000000000 and div(((cast($45::timestamptz as date) - cast($46::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($47::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($48::timestamptz as time)) * 1000000)::bigint * 1000))), 60000000000) % 2 <> 0 then -60000000000 else 0 end), 3600000000000) as integer), secs => -(((cast($49::timestamptz as date) - cast($50::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($51::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($52::timestamptz as time)) * 1000000)::bigint * 1000))) - (((cast($53::timestamptz as date) - cast($54::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($55::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($56::timestamptz as time)) * 1000000)::bigint * 1000))) % 60000000000) + case when 2 * (((cast($57::timestamptz as date) - cast($58::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($59::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($60::timestamptz as time)) * 1000000)::bigint * 1000))) % 60000000000) > 60000000000 or 2 * (((cast($61::timestamptz as date) - cast($62::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($63::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($64::timestamptz as time)) * 1000000)::bigint * 1000))) % 60000000000) = 60000000000 and div(((cast($65::timestamptz as date) - cast($66::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($67::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($68::timestamptz as time)) * 1000000)::bigint * 1000))), 60000000000) % 2 <> 0 then 60000000000 when 2 * (((cast($69::timestamptz as date) - cast($70::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($71::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($72::timestamptz as time)) * 1000000)::bigint * 1000))) % 60000000000) < -60000000000 or 2 * (((cast($73::timestamptz as date) - cast($74::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($75::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($76::timestamptz as time)) * 1000000)::bigint * 1000))) % 60000000000) = -60000000000 and div(((cast($77::timestamptz as date) - cast($78::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($79::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($80::timestamptz as time)) * 1000000)::bigint * 1000))), 60000000000) % 2 <> 0 then -60000000000 else 0 end) % 3600000000000 / 1000000000.0) as minutes, tsq_duration_total(0, 0, 0, cast(div(((cast($81::timestamptz as date) - cast($82::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($83::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($84::timestamptz as time)) * 1000000)::bigint * 1000))), 1000000000) as bigint), cast(((cast($85::timestamptz as date) - cast($86::timestamptz as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($87::timestamptz as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($88::timestamptz as time)) * 1000000)::bigint * 1000))) % 1000000000 as bigint), 0, 0, 0, 'hour') as total, make_interval(days => cast(div(((cast($89::timestamp as date) - cast($90::timestamp as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($89::timestamp as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($90::timestamp as time)) * 1000000)::bigint * 1000))), 86400000000000) as integer), secs => (((cast($89::timestamp as date) - cast($90::timestamp as date)) * 86400000000000::numeric + ((round(extract(epoch from cast($89::timestamp as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast($90::timestamp as time)) * 1000000)::bigint * 1000))) % 86400000000000) / 1000000000.0) as days"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(instant_at as date) + make_interval(secs => (((2 * (round(extract(epoch from cast(instant_at as time)) * 1000000)::bigint * 1000) + 3600000000000) / 7200000000000) * 3600000000000) / 1000000000.0) as hour, cast(instant_at as date) + make_interval(secs => (((2 * (round(extract(epoch from cast(instant_at as time)) * 1000000)::bigint * 1000) + 5400000000000) / 10800000000000) * 5400000000000) / 1000000000.0) as ninety, cast(instant_at as date) + make_interval(secs => (((round(extract(epoch from cast(instant_at as time)) * 1000000)::bigint * 1000) / 1000000000) * 1000000000) / 1000000000.0) as floor from instant_value order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (cast(instant_at as date) + make_interval(secs => (((2 * (round(extract(epoch from cast(instant_at as time)) * 1000000)::bigint * 1000) + 3600000000000) / 7200000000000) * 3600000000000) / 1000000000.0))::timestamp as hour, (instant_at + $1::interval)::timestamp as later, cast(((date '1970-01-01' + cast(((cast(floor(extract(epoch from instant_at) * 1000) as bigint) - ((cast(floor(extract(epoch from instant_at) * 1000) as bigint) % 86400000 + 86400000) % 86400000)) / 86400000) as integer)) + make_interval(secs => (((cast(floor(extract(epoch from instant_at) * 1000) as bigint) % 86400000 + 86400000) % 86400000) * 1000000) / 1000000000.0))::timestamp as date) as day from instant_value where id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            Duration {},
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast($1::timestamptz as date) + make_interval(secs => (((round(extract(epoch from cast($2::timestamptz as time)) * 1000000)::bigint * 1000) / 60000000000) * 60000000000) / 1000000000.0) as trunc, cast($3::timestamptz as date) + make_interval(secs => ((((round(extract(epoch from cast($4::timestamptz as time)) * 1000000)::bigint * 1000) + 59999999999) / 60000000000) * 60000000000) / 1000000000.0) as ceil, cast($5::timestamptz as date) + make_interval(secs => (((2 * (round(extract(epoch from cast($6::timestamptz as time)) * 1000000)::bigint * 1000) + 86400000000000) / 172800000000000) * 86400000000000) / 1000000000.0) as day"`)
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
