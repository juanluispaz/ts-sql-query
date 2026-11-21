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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select instant_value.id as "id", to_char(sys_extract_utc(cast(from_tz(sys_extract_utc(cast(instant_value.instant_at as timestamp(9) with time zone)) + duration_value.span + numtodsinterval((extract(day from to_date((2001) || '-' || (2) || '-' || (case when extract(day from duration_value.span) <> 0 then 29 else 28 end), 'YYYY-MM-DD')) - 28), 'day'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "plus", to_char(sys_extract_utc(cast(from_tz(cast((add_months(trunc(sys_extract_utc(cast(instant_value.instant_at as timestamp(9) with time zone))), -tsq_duration_part(duration_value.span_text, 'M')) - greatest(0, extract(day from add_months(trunc(sys_extract_utc(cast(instant_value.instant_at as timestamp(9) with time zone))), -tsq_duration_part(duration_value.span_text, 'M'))) - extract(day from trunc(sys_extract_utc(cast(instant_value.instant_at as timestamp(9) with time zone)))))) as timestamp(9)) + (cast(sys_extract_utc(cast(instant_value.instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_value.instant_at as timestamp(9) with time zone)))) + numtodsinterval(-tsq_duration_part(duration_value.span_text, 'D'), 'day') + numtodsinterval((-tsq_duration_part(duration_value.span_text, 'S') + -tsq_duration_part(duration_value.span_text, 'N') / 1000000000), 'second') + numtodsinterval((extract(day from to_date((2001) || '-' || (2) || '-' || (case when tsq_duration_part(duration_value.span_text, 'M') <> 0 or tsq_duration_part(duration_value.span_text, 'D') <> 0 then 29 else 28 end), 'YYYY-MM-DD')) - 28), 'day'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "minus" from instant_value join duration_value on duration_value.id = :0 order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(sys_extract_utc(cast(from_tz(cast((add_months(trunc(sys_extract_utc(cast(instant_value.instant_at as timestamp(9) with time zone))), tsq_duration_part(duration_value.span_text, 'M')) - greatest(0, extract(day from add_months(trunc(sys_extract_utc(cast(instant_value.instant_at as timestamp(9) with time zone))), tsq_duration_part(duration_value.span_text, 'M'))) - extract(day from trunc(sys_extract_utc(cast(instant_value.instant_at as timestamp(9) with time zone)))))) as timestamp(9)) + (cast(sys_extract_utc(cast(instant_value.instant_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(instant_value.instant_at as timestamp(9) with time zone)))) + numtodsinterval(tsq_duration_part(duration_value.span_text, 'D'), 'day') + numtodsinterval((tsq_duration_part(duration_value.span_text, 'S') + tsq_duration_part(duration_value.span_text, 'N') / 1000000000), 'second') + numtodsinterval((extract(day from to_date((2001) || '-' || (2) || '-' || (case when tsq_duration_part(duration_value.span_text, 'M') <> 0 or tsq_duration_part(duration_value.span_text, 'D') <> 0 then 29 else 28 end), 'YYYY-MM-DD')) - 28), 'day'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "at" from instant_value join duration_value on duration_value.id = :0 where instant_value.id = :1"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", tsq_duration_text(0, 0, 0, 0, ((trunc(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))) * 86400000000000 + (to_number(to_char(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) - to_number(to_char(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)), 'SSSSSFF9')))), 'second') as "seconds", tsq_duration_text(0, 0, 0, 0, ((trunc(sys_extract_utc(cast(to_timestamp(:2, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))) * 86400000000000 + (to_number(to_char(sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) - to_number(to_char(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)), 'SSSSSFF9')))), 'hour') as "hours", tsq_duration_text(0, 0, 0, 0, -(trunc((((trunc(sys_extract_utc(cast(to_timestamp(:4, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))) * 86400000000000 + (to_number(to_char(sys_extract_utc(cast(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) - to_number(to_char(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)), 'SSSSSFF9')))) + case when ((trunc(sys_extract_utc(cast(to_timestamp(:6, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)))) * 86400000000000 + (to_number(to_char(sys_extract_utc(cast(to_timestamp(:7, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) - to_number(to_char(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)), 'SSSSSFF9')))) > 0 then 59999999999 else 0 end) / 60000000000) * 60000000000), 'minute') as "minutes" from instant_value order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select tsq_duration_text(0, 0, 0, 0, ((trunc(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))) * 86400000000000 + (to_number(to_char(sys_extract_utc(cast(to_timestamp(:2, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) - to_number(to_char(sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')))), 'second') as "seconds", tsq_duration_text(0, 0, 0, 0, ((trunc(sys_extract_utc(cast(to_timestamp(:4, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))) * 86400000000000 + (to_number(to_char(sys_extract_utc(cast(to_timestamp(:6, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) - to_number(to_char(sys_extract_utc(cast(to_timestamp(:7, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')))), 'hour') as "hours", tsq_duration_text(0, 0, 0, 0, -(sign(((trunc(sys_extract_utc(cast(to_timestamp(:8, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(to_timestamp(:9, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))) * 86400000000000 + (to_number(to_char(sys_extract_utc(cast(to_timestamp(:10, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) - to_number(to_char(sys_extract_utc(cast(to_timestamp(:11, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9'))))) * (trunc((2 * abs(((trunc(sys_extract_utc(cast(to_timestamp(:12, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(to_timestamp(:13, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))) * 86400000000000 + (to_number(to_char(sys_extract_utc(cast(to_timestamp(:14, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) - to_number(to_char(sys_extract_utc(cast(to_timestamp(:15, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9'))))) + 60000000000) / 120000000000) - case when mod((2 * abs(((trunc(sys_extract_utc(cast(to_timestamp(:16, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(to_timestamp(:17, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))) * 86400000000000 + (to_number(to_char(sys_extract_utc(cast(to_timestamp(:18, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) - to_number(to_char(sys_extract_utc(cast(to_timestamp(:19, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9'))))) + 60000000000), 240000000000) = 120000000000 then 1 else 0 end) * 60000000000), 'minute') as "minutes", tsq_duration_total(0, 0, 0, trunc(((trunc(sys_extract_utc(cast(to_timestamp(:20, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(to_timestamp(:21, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))) * 86400000000000 + (to_number(to_char(sys_extract_utc(cast(to_timestamp(:22, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) - to_number(to_char(sys_extract_utc(cast(to_timestamp(:23, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')))) / 1000000000), (mod(((trunc(sys_extract_utc(cast(to_timestamp(:24, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(to_timestamp(:25, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))) * 86400000000000 + (to_number(to_char(sys_extract_utc(cast(to_timestamp(:26, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) - to_number(to_char(sys_extract_utc(cast(to_timestamp(:27, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')))), 1000000000)), 0, 0, 0, 'hour') as "total", tsq_duration_text(0, 0, 0, 0, ((trunc(to_timestamp(:28, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - trunc(to_timestamp(:29, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 86400000000000 + (to_number(to_char(to_timestamp(:28, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) - to_number(to_char(to_timestamp(:29, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')))), 'day') as "days" from dual"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc((2 * to_number(to_char(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)), 'SSSSSFF9')) + 3600000000000) / 7200000000000) * 3600000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "hour", to_char(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc((2 * to_number(to_char(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)), 'SSSSSFF9')) + 5400000000000) / 10800000000000) * 5400000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "ninety", to_char(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc(to_number(to_char(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)), 'SSSSSFF9')) / 1000000000) * 1000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "floor" from instant_value order by "id""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(cast(cast(from_tz(cast(trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc((2 * to_number(to_char(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)), 'SSSSSFF9')) + 3600000000000) / 7200000000000) * 3600000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone) at local as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "hour", to_char(cast(cast(from_tz(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)) + numtodsinterval(:0, 'second'), '+00:00') as timestamp(9) with time zone) at local as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "later", to_char(trunc(cast(cast(from_tz(cast((date '1970-01-01' + trunc(((trunc(timestamp '1970-01-01 00:00:00' + (instant_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (instant_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) - (mod((mod((trunc(timestamp '1970-01-01 00:00:00' + (instant_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (instant_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')), 86400000) + 86400000), 86400000))) / 86400000)) as timestamp(9)) + numtodsinterval(((mod((mod((trunc(timestamp '1970-01-01 00:00:00' + (instant_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (instant_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')), 86400000) + 86400000), 86400000)) * 1000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone) at local as timestamp(9))), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "day" from instant_value where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3600n,
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc(to_number(to_char(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) / 60000000000) * 60000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "trunc", to_char(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(to_timestamp(:2, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc((to_number(to_char(sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) + 59999999999) / 60000000000) * 60000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "ceil", to_char(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(to_timestamp(:4, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc((2 * to_number(to_char(sys_extract_utc(cast(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) + 86400000000000) / 172800000000000) * 86400000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "day" from dual"`)
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
