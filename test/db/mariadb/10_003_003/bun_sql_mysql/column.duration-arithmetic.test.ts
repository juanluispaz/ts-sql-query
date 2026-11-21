// Durations added and subtracted together, as Temporal's add and subtract: a day is 24 hours, the sum is balanced up to
// the largest field of the two, and a duration with years, months or weeks fails the query. Every expected value is the
// one Temporal gives. duration_value: span is 1 3 days 04:05:06.789, 2 -1 day -2 hours, 3 01:30; span_text is the ISO
// 8601 text P1Y2M3DT4H5M6.789S, -PT26H and PT90M. project_release: rollout_time 1 day 12:00:00, 00:45:00 and 2 days,
// for the versions 1.2.0, 1.3.0-beta.1 and 0.9.0.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'
import { tDurationValue, tRelease } from '../../domain/connection.js'
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, tsq_duration_add(tsq_duration_part(rollout_time, 'largest'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), 4, 0, 43200, 0, 1) as later, tsq_duration_add(tsq_duration_part(rollout_time, 'largest'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), 3, 1, 0, 0, -1) as earlier from project_release order by version"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_add(tsq_duration_part(span, 'largest'), tsq_duration_part(span, 'days'), tsq_duration_part(span, 'S'), tsq_duration_part(span, 'N'), tsq_duration_part(span, 'largest'), tsq_duration_part(span, 'days'), tsq_duration_part(span, 'S'), tsq_duration_part(span, 'N'), 1) as twice, tsq_duration_add(tsq_duration_part(span, 'largest'), tsq_duration_part(span, 'days'), tsq_duration_part(span, 'S'), tsq_duration_part(span, 'N'), tsq_duration_part(span, 'largest'), tsq_duration_part(span, 'days'), tsq_duration_part(span, 'S'), tsq_duration_part(span, 'N'), -1) as none from duration_value order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_add(tsq_duration_part(span_text, 'largest'), tsq_duration_part(span_text, 'days'), tsq_duration_part(span_text, 'S'), tsq_duration_part(span_text, 'N'), 4, 0, 3600, 0, 1) as plusAnHour, tsq_duration_add(tsq_duration_part(span_text, 'largest'), tsq_duration_part(span_text, 'days'), tsq_duration_part(span_text, 'S'), tsq_duration_part(span_text, 'N'), 4, 0, 3600, 0, -1) as minusAnHour, tsq_duration_add(tsq_duration_part(span_text, 'largest'), tsq_duration_part(span_text, 'days'), tsq_duration_part(span_text, 'S'), tsq_duration_part(span_text, 'N'), 5, 0, 1800, 0, 1) as plusHalfAnHour from duration_value where id > ? order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_add(tsq_duration_part(span_text, 'largest'), tsq_duration_part(span_text, 'days'), tsq_duration_part(span_text, 'S'), tsq_duration_part(span_text, 'N'), 4, 0, 3600, 0, 1) as later from duration_value where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select tsq_duration_add(tsq_duration_part(tsq_duration_text(0, 0, 0, datediff(?, ?), 0, 'day'), 'largest'), tsq_duration_part(tsq_duration_text(0, 0, 0, datediff(?, ?), 0, 'day'), 'days'), tsq_duration_part(tsq_duration_text(0, 0, 0, datediff(?, ?), 0, 'day'), 'S'), tsq_duration_part(tsq_duration_text(0, 0, 0, datediff(?, ?), 0, 'day'), 'N'), 4, 0, 43200, 0, 1) as later"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, released_on as releasedOn, published_at as publishedAt, rollout_time as rolloutTime, tsq_duration_sum(rollout_time, rollout_time, 1) as twice, tsq_duration_sum(rollout_time, 'PT12H', -1) as lessHalfADay, tsq_duration_total_of(rollout_time, 0, 0, 0, 'hour') as hours, tsq_duration_total_of(rollout_time, cast(year(released_on) as signed), cast(month(released_on) as signed), cast(dayofmonth(released_on) as signed), 'day') as daysFromRelease, tsq_duration_round_of(released_on, ?, 'month', 'day', 1, 'trunc', 1) as toLastDay, tsq_duration_round_of(published_at, ?, 'year', 'month', 1, 'halfExpand', 1) as toNextYear from project_release where rollout_time is not null order by version"`)
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
})
