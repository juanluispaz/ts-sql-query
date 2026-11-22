// Durations added and subtracted together, as Temporal's add and subtract: a day is 24 hours, the sum is balanced up to
// the largest field of the two, and a duration with years, months or weeks fails the query. Every expected value is the
// one Temporal gives. duration_value: span is 1 3 days 04:05:06.789, 2 -1 day -2 hours, 3 01:30; span_text is the ISO
// 8601 text P1Y2M3DT4H5M6.789S, -PT26H and PT90M. project_release: rollout_time 1 day 12:00:00, 00:45:00 and 2 days,
// for the versions 1.2.0, 1.3.0-beta.1 and 0.9.0.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'
import { tDurationValue, tRelease, tColMatrixPlain } from '../../domain/connection.js'
import { ctx } from './setup.js'

async function rejectionOf(query: Promise<unknown>): Promise<boolean> {
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

    test('a-duration-plus-and-minus-a-duration-given', async () => {
        ctx.mockNext([
            { version: '0.9.0', later: '2 days 12:00:00', earlier: '1 day' },
            { version: '1.2.0', later: '2 days', earlier: '12:00:00' },
            { version: '1.3.0-beta.1', later: '12:45:00', earlier: '-23:15:00' },
        ])
        const rows = await ctx.conn.selectFrom(tRelease)
            .select({
                version: tRelease.version,
                later: tRelease.rolloutTime.add(Temporal.Duration.from('PT12H')),
                earlier: tRelease.rolloutTime.subtract({ days: 1 }),
            })
            .orderBy('version')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", tsq_duration_add(case when extract(day from rollout_time) <> 0 then 3 when extract(hour from rollout_time) <> 0 then 4 when extract(minute from rollout_time) <> 0 then 5 when trunc(extract(second from rollout_time)) <> 0 then 6 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) >= 1000000 then 7 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) >= 1000 then 8 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) <> 0 then 9 else 10 end, extract(day from rollout_time), extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)), mod(extract(second from rollout_time) * 1000000000, 1000000000), 4, 0, 43200, 0, 1) as "later", tsq_duration_add(case when extract(day from rollout_time) <> 0 then 3 when extract(hour from rollout_time) <> 0 then 4 when extract(minute from rollout_time) <> 0 then 5 when trunc(extract(second from rollout_time)) <> 0 then 6 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) >= 1000000 then 7 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) >= 1000 then 8 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) <> 0 then 9 else 10 end, extract(day from rollout_time), extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)), mod(extract(second from rollout_time) * 1000000000, 1000000000), 3, 1, 0, 0, -1) as "earlier" from project_release order by "version""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<(typeof rows)[number]['later'], Temporal.Duration | undefined>>()
        expect(rows.map(row => [row.version, row.later?.toString(), row.earlier?.toString()])).toEqual([
            ['0.9.0', 'P2DT12H', 'P1D'],
            ['1.2.0', 'P2D', 'PT12H'],
            ['1.3.0-beta.1', 'PT12H45M', '-PT23H15M'],
        ])
    })

    test('a-duration-plus-and-minus-another-of-the-database', async () => {
        ctx.mockNext([
            { id: 1, twice: '6 days 08:10:13.578', none: '00:00:00' },
            { id: 2, twice: '-2 days -04:00:00', none: '00:00:00' },
            { id: 3, twice: '03:00:00', none: '00:00:00' },
        ])
        const rows = await ctx.conn.selectFrom(tDurationValue)
            .select({
                id: tDurationValue.id,
                twice: tDurationValue.span.add(tDurationValue.span),
                none: tDurationValue.span.subtract(tDurationValue.span),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", tsq_duration_add(case when extract(day from span) <> 0 then 3 when extract(hour from span) <> 0 then 4 when extract(minute from span) <> 0 then 5 when trunc(extract(second from span)) <> 0 then 6 when mod(abs(extract(second from span)) * 1000000000, 1000000000) >= 1000000 then 7 when mod(abs(extract(second from span)) * 1000000000, 1000000000) >= 1000 then 8 when mod(abs(extract(second from span)) * 1000000000, 1000000000) <> 0 then 9 else 10 end, extract(day from span), extract(hour from span) * 3600 + extract(minute from span) * 60 + trunc(extract(second from span)), mod(extract(second from span) * 1000000000, 1000000000), case when extract(day from span) <> 0 then 3 when extract(hour from span) <> 0 then 4 when extract(minute from span) <> 0 then 5 when trunc(extract(second from span)) <> 0 then 6 when mod(abs(extract(second from span)) * 1000000000, 1000000000) >= 1000000 then 7 when mod(abs(extract(second from span)) * 1000000000, 1000000000) >= 1000 then 8 when mod(abs(extract(second from span)) * 1000000000, 1000000000) <> 0 then 9 else 10 end, extract(day from span), extract(hour from span) * 3600 + extract(minute from span) * 60 + trunc(extract(second from span)), mod(extract(second from span) * 1000000000, 1000000000), 1) as "twice", tsq_duration_add(case when extract(day from span) <> 0 then 3 when extract(hour from span) <> 0 then 4 when extract(minute from span) <> 0 then 5 when trunc(extract(second from span)) <> 0 then 6 when mod(abs(extract(second from span)) * 1000000000, 1000000000) >= 1000000 then 7 when mod(abs(extract(second from span)) * 1000000000, 1000000000) >= 1000 then 8 when mod(abs(extract(second from span)) * 1000000000, 1000000000) <> 0 then 9 else 10 end, extract(day from span), extract(hour from span) * 3600 + extract(minute from span) * 60 + trunc(extract(second from span)), mod(extract(second from span) * 1000000000, 1000000000), case when extract(day from span) <> 0 then 3 when extract(hour from span) <> 0 then 4 when extract(minute from span) <> 0 then 5 when trunc(extract(second from span)) <> 0 then 6 when mod(abs(extract(second from span)) * 1000000000, 1000000000) >= 1000000 then 7 when mod(abs(extract(second from span)) * 1000000000, 1000000000) >= 1000 then 8 when mod(abs(extract(second from span)) * 1000000000, 1000000000) <> 0 then 9 else 10 end, extract(day from span), extract(hour from span) * 3600 + extract(minute from span) * 60 + trunc(extract(second from span)), mod(extract(second from span) * 1000000000, 1000000000), -1) as "none" from duration_value order by "id""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<(typeof rows)[number]['twice'], Temporal.Duration>>()
        expect(rows.map(row => [row.id, row.twice.toString(), row.none.toString()])).toEqual([
            [1, 'P6DT8H10M13.578S', 'PT0S'],
            [2, '-P2DT4H', 'PT0S'],
            [3, 'PT3H', 'PT0S'],
        ])
    })

    test('the-sum-is-balanced-up-to-the-largest-field-of-the-two', async () => {
        // -PT26H and PT90M plus PT1H are in hours; PT90M plus PT30M in minutes
        ctx.mockNext([
            { id: 2, plusAnHour: '-25:00:00', minusAnHour: '-27:00:00', plusHalfAnHour: '-25:30:00' },
            { id: 3, plusAnHour: '02:30:00', minusAnHour: '00:30:00', plusHalfAnHour: 'PT120M' },
        ])
        const rows = await ctx.conn.selectFrom(tDurationValue)
            .where(tDurationValue.id.greaterThan(1))
            .select({
                id: tDurationValue.id,
                plusAnHour: tDurationValue.spanText.add({ hours: 1 }),
                minusAnHour: tDurationValue.spanText.subtract({ hours: 1 }),
                plusHalfAnHour: tDurationValue.spanText.add({ minutes: 30 }),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", tsq_duration_add(tsq_duration_part(span_text, 'largest'), tsq_duration_part(span_text, 'days'), tsq_duration_part(span_text, 'S'), tsq_duration_part(span_text, 'N'), 4, 0, 3600, 0, 1) as "plusAnHour", tsq_duration_add(tsq_duration_part(span_text, 'largest'), tsq_duration_part(span_text, 'days'), tsq_duration_part(span_text, 'S'), tsq_duration_part(span_text, 'N'), 4, 0, 3600, 0, -1) as "minusAnHour", tsq_duration_add(tsq_duration_part(span_text, 'largest'), tsq_duration_part(span_text, 'days'), tsq_duration_part(span_text, 'S'), tsq_duration_part(span_text, 'N'), 5, 0, 1800, 0, 1) as "plusHalfAnHour" from duration_value where id > :0 order by "id""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1",
          ]
        `)
        expect(rows.map(row => [row.id, row.plusAnHour?.toString(), row.minusAnHour?.toString(), row.plusHalfAnHour?.toString()])).toEqual([
            [2, '-PT25H', '-PT27H', '-PT25H30M'],
            [3, 'PT2H30M', 'PT30M', 'PT120M'],
        ])
    })

    test('a-duration-with-months-fails-the-query', async () => {
        // P1Y2M3DT4H5M6.789S has years and months: Temporal can't add it
        ctx.mockNext([{ id: 1, later: 'P1Y2M3DT5H5M6.789S' }])
        const rejected = await rejectionOf(ctx.conn.selectFrom(tDurationValue)
            .where(tDurationValue.id.equals(1))
            .select({ id: tDurationValue.id, later: tDurationValue.spanText.add({ hours: 1 }) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", tsq_duration_add(tsq_duration_part(span_text, 'largest'), tsq_duration_part(span_text, 'days'), tsq_duration_part(span_text, 'S'), tsq_duration_part(span_text, 'N'), 4, 0, 3600, 0, 1) as "later" from duration_value where id = :0"`)
        expect(rejected).toBe(ctx.realDbEnabled)
        ctx.mockNext([{ later: '1 day' }])
        const rejectedValue = await rejectionOf(ctx.conn.selectFrom(tRelease)
            .where(tRelease.id.equals(3))
            .select({ later: tRelease.rolloutTime.add({ months: 1 }) })
            .executeSelectMany())
        expect(rejectedValue).toBe(ctx.realDbEnabled)
    })

    test('a-difference-plus-a-duration', async () => {
        // 2024-01-31 until 2024-03-30 is P59D
        ctx.mockNext({ later: '59 days 12:00:00' })
        const january31 = ctx.conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate')
        const row = await ctx.conn.selectFromNoTable()
            .select({ later: january31.until(Temporal.PlainDate.from('2024-03-30')).add({ hours: 12 }) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select tsq_duration_add(tsq_duration_part(tsq_duration_text(0, 0, 0, (to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') - to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')), 0, 0, 0, 'day'), 'largest'), tsq_duration_part(tsq_duration_text(0, 0, 0, (to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') - to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')), 0, 0, 0, 'day'), 'days'), tsq_duration_part(tsq_duration_text(0, 0, 0, (to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') - to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')), 0, 0, 0, 'day'), 'S'), tsq_duration_part(tsq_duration_text(0, 0, 0, (to_date(:6, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') - to_date(:7, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')), 0, 0, 0, 'day'), 'N'), 4, 0, 43200, 0, 1) as "later" from dual"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
          ]
        `)
        assertType<Exact<typeof row, { later: Temporal.Duration }>>()
        expect(row.later.toString()).toBe('P59DT12H')
    })

    test('durations-added-their-totals-and-differences-in-months-with-the-functions-of-the-library', async () => {
        // With the functions of the library installed a duration and the values of a difference in months are given whole
        // to the function, written once: the values are the ones of Temporal for the values read, with and without the
        // functions (the mock answers no rows: there it is the SQL that is checked)
        const lastDay = Temporal.PlainDate.from('2024-06-30')
        const nextYear = Temporal.PlainDateTime.from('2025-05-17T00:00:00')
        const query = (conn: typeof ctx.conn) => conn.selectFrom(tRelease)
            .where(tRelease.rolloutTime.isNotNull())
            .select({
                version: tRelease.version,
                releasedOn: tRelease.releasedOn,
                publishedAt: tRelease.publishedAt,
                rolloutTime: tRelease.rolloutTime,
                twice: tRelease.rolloutTime.add(tRelease.rolloutTime),
                lessHalfADay: tRelease.rolloutTime.subtract({ hours: 12 }),
                hours: tRelease.rolloutTime.total('hours'),
                daysFromRelease: tRelease.rolloutTime.total({ unit: 'days', relativeTo: tRelease.releasedOn }),
                toLastDay: tRelease.releasedOn.until(lastDay, { largestUnit: 'month' }),
                toNextYear: tRelease.publishedAt.until(nextYear, { largestUnit: 'year', smallestUnit: 'month', roundingMode: 'halfExpand' }),
            })
            .orderBy('version')
            .executeSelectMany()
        ctx.mockNext([])
        const withFunctions = await query(ctx.withLibraryFunctions())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", to_char(released_on, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "releasedOn", to_char(cast(published_at as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "publishedAt", rollout_time as "rolloutTime", tsq_duration_sum(tsq_ds_interval_text(rollout_time), tsq_ds_interval_text(rollout_time), 1) as "twice", tsq_duration_sum(tsq_ds_interval_text(rollout_time), 'PT12H', -1) as "lessHalfADay", tsq_duration_total_of(tsq_ds_interval_text(rollout_time), 0, 0, 0, 'hour') as "hours", tsq_duration_total_of(tsq_ds_interval_text(rollout_time), extract(year from released_on), extract(month from released_on), extract(day from released_on), 'day') as "daysFromRelease", tsq_duration_round_of(released_on, to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'month', 'day', 1, 'trunc', 1) as "toLastDay", tsq_duration_round_of(published_at, to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'year', 'month', 1, 'halfExpand', 1) as "toNextYear" from project_release where rollout_time is not null order by "version""`)
        ctx.mockNext([])
        const withoutFunctions = await query(ctx.conn)
        expect(withFunctions.length).toBe(ctx.realDbEnabled ? 3 : 0)
        type Row = (typeof withFunctions)[number]
        const months = (d: Temporal.Duration | undefined) => d === undefined ? undefined : [d.years * 12 + d.months, d.weeks * 7 + d.days]
        const read = (row: Row) => ({
            version: row.version,
            twice: row.twice?.total('second'),
            lessHalfADay: row.lessHalfADay?.total('second'),
            hours: row.hours,
            daysFromRelease: row.daysFromRelease,
            toLastDay: months(row.toLastDay),
            toNextYear: months(row.toNextYear),
        })
        const ofTemporal = (row: Row) => ({
            version: row.version,
            twice: row.rolloutTime?.add(row.rolloutTime).total('second'),
            lessHalfADay: row.rolloutTime?.subtract({ hours: 12 }).total('second'),
            hours: row.rolloutTime?.total('hours'),
            daysFromRelease: row.rolloutTime?.total({ unit: 'days', relativeTo: row.releasedOn }),
            toLastDay: months(row.releasedOn.until(lastDay, { largestUnit: 'month' })),
            toNextYear: months(row.publishedAt.until(nextYear, { largestUnit: 'year', smallestUnit: 'month', roundingMode: 'halfExpand' })),
        })
        expect(withFunctions.map(read)).toEqual(withFunctions.map(ofTemporal))
        expect(withoutFunctions.map(read)).toEqual(withoutFunctions.map(ofTemporal))
    })

    test('values-plus-a-duration-of-the-query-and-negated-with-the-functions-of-the-library', async () => {
        // With the functions of the library installed a duration of the query added to a date, a time, a date and time or
        // an instant, and negated, is written once: the values are the ones of Temporal for the values read, with and
        // without the functions, and an instant plus a duration with days fails with and without them (the mock answers
        // no rows: there it is the SQL that is checked)
        const at = Temporal.Instant.from('2024-01-16T09:30:15Z')
        const query = (conn: typeof ctx.conn) => conn.selectFrom(tRelease)
            .where(tRelease.rolloutTime.isNotNull())
            .select({
                version: tRelease.version,
                releasedOn: tRelease.releasedOn,
                cutoffTime: tRelease.cutoffTime,
                publishedAt: tRelease.publishedAt,
                rolloutTime: tRelease.rolloutTime,
                dayAfter: tRelease.releasedOn.add(tRelease.rolloutTime),
                timeAfter: tRelease.cutoffTime.add(tRelease.rolloutTime),
                after: tRelease.publishedAt.add(tRelease.rolloutTime),
                before: tRelease.publishedAt.subtract(tRelease.rolloutTime),
                back: tRelease.rolloutTime.negated(),
            })
            .orderBy('version')
            .executeSelectMany()
        const instantQuery = (conn: typeof ctx.conn, id: number) => conn.selectFrom(tDurationValue)
            .where(tDurationValue.id.equals(id))
            .select({
                spanText: tDurationValue.spanText,
                later: conn.const(at, 'instant').add(tDurationValue.spanText),
                earlier: conn.const(at, 'instant').subtract(tDurationValue.spanText),
                back: tDurationValue.spanText.negated(),
            })
            .executeSelectMany()
        ctx.mockNext([])
        const withFunctions = await query(ctx.withLibraryFunctions())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", to_char(released_on, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "releasedOn", to_char(cast(cutoff_time as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "cutoffTime", to_char(cast(published_at as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "publishedAt", rollout_time as "rolloutTime", to_char(released_on + extract(day from rollout_time), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "dayAfter", to_char(cast(tsq_time_plus_duration(cutoff_time, rollout_time, 1, timestamp '1972-01-01 00:00:00') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "timeAfter", to_char(cast(published_at + rollout_time as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "after", to_char(cast(published_at - rollout_time as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "before", (rollout_time * -1) as "back" from project_release where rollout_time is not null order by "version""`)
        ctx.mockNext([])
        const withoutFunctions = await query(ctx.conn)
        expect(withFunctions.length).toBe(ctx.realDbEnabled ? 3 : 0)
        type Row = (typeof withFunctions)[number]
        const read = (row: Row) => [row.version, row.dayAfter?.toString(), row.timeAfter?.toString(), row.after?.toString(), row.before?.toString(), row.back?.toString()]
        const ofTemporal = (row: Row) => [row.version, row.rolloutTime && row.releasedOn.add(row.rolloutTime).toString(), row.rolloutTime && row.cutoffTime.add(row.rolloutTime).toString(),
            row.rolloutTime && row.publishedAt.add(row.rolloutTime).toString(), row.rolloutTime && row.publishedAt.subtract(row.rolloutTime).toString(), row.rolloutTime?.negated().toString()]
        expect(withFunctions.map(read)).toEqual(withFunctions.map(ofTemporal))
        expect(withoutFunctions.map(read)).toEqual(withoutFunctions.map(ofTemporal))
        ctx.mockNext([])
        const instantWithFunctions = await instantQuery(ctx.withLibraryFunctions(), 3)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select span_text as "spanText", to_char(cast((add_months(trunc(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))), tsq_duration_part(span_text, 'M')) - greatest(0, extract(day from add_months(trunc(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))), tsq_duration_part(span_text, 'M'))) - extract(day from trunc(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))))) as timestamp(9)) + (cast(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))) + numtodsinterval(tsq_duration_part(span_text, 'D'), 'day') + numtodsinterval((tsq_duration_part(span_text, 'S') + tsq_duration_part(span_text, 'N') / 1000000000), 'second') + numtodsinterval((extract(day from to_date((2001) || '-' || (2) || '-' || (case when tsq_duration_part(span_text, 'M') <> 0 or tsq_duration_part(span_text, 'D') <> 0 then 29 else 28 end), 'YYYY-MM-DD')) - 28), 'day'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "later", to_char(cast((add_months(trunc(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))), -tsq_duration_part(span_text, 'M')) - greatest(0, extract(day from add_months(trunc(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))), -tsq_duration_part(span_text, 'M'))) - extract(day from trunc(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))))) as timestamp(9)) + (cast(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)))) + numtodsinterval(-tsq_duration_part(span_text, 'D'), 'day') + numtodsinterval((-tsq_duration_part(span_text, 'S') + -tsq_duration_part(span_text, 'N') / 1000000000), 'second') + numtodsinterval((extract(day from to_date((2001) || '-' || (2) || '-' || (case when tsq_duration_part(span_text, 'M') <> 0 or tsq_duration_part(span_text, 'D') <> 0 then 29 else 28 end), 'YYYY-MM-DD')) - 28), 'day'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "earlier", tsq_duration_negated(span_text) as "back" from duration_value where id = :2"`)
        ctx.mockNext([])
        const instantWithoutFunctions = await instantQuery(ctx.conn, 3)
        expect(instantWithFunctions.length).toBe(ctx.realDbEnabled ? 1 : 0)
        type InstantRow = (typeof instantWithFunctions)[number]
        const readInstant = (row: InstantRow) => [row.later?.toString(), row.earlier?.toString(), row.back?.toString()]
        const instantOfTemporal = (row: InstantRow) => [row.spanText && at.add(row.spanText).toString(), row.spanText && at.subtract(row.spanText).toString(), row.spanText?.negated().toString()]
        expect(instantWithFunctions.map(readInstant)).toEqual(instantWithFunctions.map(instantOfTemporal))
        expect(instantWithoutFunctions.map(readInstant)).toEqual(instantWithoutFunctions.map(instantOfTemporal))
        ctx.mockNext([])
        const failsWithFunctions = await instantQuery(ctx.withLibraryFunctions(), 1).then(() => false, () => true)
        ctx.mockNext([])
        const failsWithoutFunctions = await instantQuery(ctx.conn, 1).then(() => false, () => true)
        expect([failsWithFunctions, failsWithoutFunctions]).toEqual([ctx.realDbEnabled, ctx.realDbEnabled])
    })

    test('a-duration-of-fields-of-the-query', async () => {
        // Temporal's Duration.from of the int 42 of the row: as days with an hour and a half, as milliseconds times 100,
        // negated as days with -1 hour; plus minutes of the query, as Temporal's add; its days
        const expected = {
            ofDays: Temporal.Duration.from({ days: 42, hours: 1, minutes: 30 }),
            ofMilliseconds: Temporal.Duration.from({ milliseconds: 4200 }),
            negated: Temporal.Duration.from({ days: -42, hours: -1 }),
            plusMinutes: Temporal.Duration.from({ hours: 42 }).add({ minutes: 42 }),
        }
        ctx.mockNext([{ ofDays: '42 days 01:30:00', ofMilliseconds: '00:00:04.2', negated: '-42 days -01:00:00', plusMinutes: '42:42:00', days: 42 }])
        const negated = ctx.conn.const(0, 'int').subtract(tColMatrixPlain.mInt)
        const rows = await ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({
                ofDays: ctx.conn.duration({ days: tColMatrixPlain.mInt, hours: 1, minutes: 30 }),
                ofMilliseconds: ctx.conn.duration({ milliseconds: tColMatrixPlain.mInt.multiply(ctx.conn.const(100, 'int')) }),
                negated: ctx.conn.duration({ days: negated, hours: -1 }),
                plusMinutes: ctx.conn.duration({ hours: tColMatrixPlain.mInt }).add({ minutes: tColMatrixPlain.mInt }),
                days: ctx.conn.duration({ days: tColMatrixPlain.mInt }).days(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when extract(day from to_date((2001) || '-' || (2) || '-' || (case when m_int < 0 then 29 else 28 end), 'YYYY-MM-DD')) = 28 then tsq_duration_text(0, 0, 0, m_int, 1, 30, 0, 'second') end as "ofDays", tsq_duration_text(0, 0, 0, 0, 0, 0, (m_int * :0) * 1000000, 'second') as "ofMilliseconds", case when extract(day from to_date((2001) || '-' || (2) || '-' || (case when (:2 - m_int) > 0 then 29 else 28 end), 'YYYY-MM-DD')) = 28 then tsq_duration_text(0, 0, 0, (:1 - m_int), -1, 0, 0, 'second') end as "negated", tsq_duration_add(tsq_duration_part(tsq_duration_text(0, 0, 0, 0, m_int, 0, 0, 'second'), 'largest'), tsq_duration_part(tsq_duration_text(0, 0, 0, 0, m_int, 0, 0, 'second'), 'days'), (m_int * 3600), 0, tsq_duration_part(tsq_duration_text(0, 0, 0, 0, 0, m_int, 0, 'second'), 'largest'), tsq_duration_part(tsq_duration_text(0, 0, 0, 0, 0, m_int, 0, 'second'), 'days'), (m_int * 60), 0, 1) as "plusMinutes", tsq_duration_part(tsq_duration_text(0, 0, 0, m_int, 0, 0, 0, 'second'), 'days') as "days" from col_matrix where id = :3"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "100",
            "0",
            "0",
            "1",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ ofDays: Temporal.Duration; ofMilliseconds: Temporal.Duration; negated: Temporal.Duration; plusMinutes: Temporal.Duration; days: number }>>>()
        expect(rows.map(row => [row.ofDays.toString(), row.ofMilliseconds.toString(), row.negated.toString(), row.plusMinutes.toString(), row.days]))
            .toEqual([[expected.ofDays.toString(), expected.ofMilliseconds.toString(), expected.negated.toString(), expected.plusMinutes.toString(), 42]])
    })

    test('a-duration-of-fields-of-the-query-with-different-signs-makes-the-query-fail', async () => {
        // As Temporal throws: the int 42 of the row as days with -1 hour
        ctx.mockNext([{ value: '42 days' }])
        const failed = await rejectionOf(ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({ value: ctx.conn.duration({ days: tColMatrixPlain.mInt, hours: -1 }) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when extract(day from to_date((2001) || '-' || (2) || '-' || (case when m_int > 0 then 29 else 28 end), 'YYYY-MM-DD')) = 28 then tsq_duration_text(0, 0, 0, m_int, -1, 0, 0, 'second') end as "value" from col_matrix where id = :0"`)
        expect(failed).toBe(ctx.realDbEnabled)
    })

    test('a-duration-of-fields-of-the-query-is-written-as-the-column-keeps-it', async () => {
        // In span_text, the text of Temporal's toString of its fields, as a duration sent is written: an hour and 90 minutes
        // of the query keep their 90 minutes; in span, as span keeps a duration
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tDurationValue)
                .set({
                    spanText: ctx.conn.duration({ hours: 1, minutes: ctx.conn.const(90, 'int') }),
                    span: ctx.conn.duration({ days: ctx.conn.const(2, 'int'), hours: 3 }),
                })
                .where(tDurationValue.id.equals(3))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update duration_value set span_text = case when extract(day from to_date((2001) || '-' || (2) || '-' || (case when :1 < 0 then 29 else 28 end), 'YYYY-MM-DD')) = 28 then tsq_duration_text(0, 0, 0, 0, 1, :0, 0, 'second') end, span = case when extract(day from to_date((2001) || '-' || (2) || '-' || (case when :3 < 0 then 29 else 28 end), 'YYYY-MM-DD')) = 28 then numtodsinterval(:2, 'day') + numtodsinterval(10800, 'second') end where id = :4"`)
            ctx.mockNext([{ spanText: 'PT1H90M', minutes: 90, span: '2 days 03:00:00' }])
            const rows = await ctx.conn.selectFrom(tDurationValue)
                .where(tDurationValue.id.equals(3))
                .select({ spanText: tDurationValue.spanText, minutes: tDurationValue.spanText.minutes(), span: tDurationValue.span })
                .executeSelectMany()
            expect(rows.map(row => [row.spanText?.toString(), row.minutes, row.span.toString()]))
                .toEqual([[Temporal.Duration.from({ hours: 1, minutes: 90 }).toString(), 90, Temporal.Duration.from({ days: 2, hours: 3 }).toString()]])
        })
    })
})
