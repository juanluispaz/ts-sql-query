// Durations added and subtracted together, as Temporal's add and subtract: a day is 24 hours, the sum is balanced up to
// the largest field of the two, and a duration with years, months or weeks fails the query. Every expected value is the
// one Temporal gives. duration_value: span is 1 3 days 04:05:06.789, 2 -1 day -2 hours, 3 01:30; span_text is the ISO
// 8601 text P1Y2M3DT4H5M6.789S, -PT26H and PT90M. project_release: rollout_time 1 day 12:00:00, 00:45:00 and 2 days,
// for the versions 1.2.0, 1.3.0-beta.1 and 0.9.0.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'
import { ctx } from './setup.js'

async function rejectionOf(query: Promise<unknown>): Promise<boolean> {
    try {
        await query
        return false
    } catch (error) {
        return error instanceof TsSqlError
    }
}
void rejectionOf

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-SUPPORTED: Bun SQL's sqlite adapter exposes neither a user-defined-function API nor its bun:sqlite `Database`, so the tsq_duration_add UDF can't be registered
    /*
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<(typeof rows)[number]['later'], Temporal.Duration | undefined>>()
        expect(rows.map(row => [row.version, row.later?.toString(), row.earlier?.toString()])).toEqual([
            ['0.9.0', 'P2DT12H', 'P1D'],
            ['1.2.0', 'P2D', 'PT12H'],
            ['1.3.0-beta.1', 'PT12H45M', '-PT23H15M'],
        ])
    })
    */

    // NOT-SUPPORTED: Bun SQL's sqlite adapter exposes neither a user-defined-function API nor its bun:sqlite `Database`, so the tsq_duration_add UDF can't be registered
    /*
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<(typeof rows)[number]['twice'], Temporal.Duration>>()
        expect(rows.map(row => [row.id, row.twice.toString(), row.none.toString()])).toEqual([
            [1, 'P6DT8H10M13.578S', 'PT0S'],
            [2, '-P2DT4H', 'PT0S'],
            [3, 'PT3H', 'PT0S'],
        ])
    })
    */

    // NOT-SUPPORTED: Bun SQL's sqlite adapter exposes neither a user-defined-function API nor its bun:sqlite `Database`, so the tsq_duration_add UDF can't be registered
    /*
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        expect(rows.map(row => [row.id, row.plusAnHour?.toString(), row.minusAnHour?.toString(), row.plusHalfAnHour?.toString()])).toEqual([
            [2, '-PT25H', '-PT27H', '-PT25H30M'],
            [3, 'PT2H30M', 'PT30M', 'PT120M'],
        ])
    })
    */

    // NOT-SUPPORTED: Bun SQL's sqlite adapter exposes neither a user-defined-function API nor its bun:sqlite `Database`, so the tsq_duration_add UDF can't be registered
    /*
    test('a-duration-with-months-fails-the-query', async () => {
        // P1Y2M3DT4H5M6.789S has years and months: Temporal can't add it
        ctx.mockNext([{ id: 1, later: 'P1Y2M3DT5H5M6.789S' }])
        const rejected = await rejectionOf(ctx.conn.selectFrom(tDurationValue)
            .where(tDurationValue.id.equals(1))
            .select({ id: tDurationValue.id, later: tDurationValue.spanText.add({ hours: 1 }) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(rejected).toBe(ctx.realDbEnabled)
        ctx.mockNext([{ later: '1 day' }])
        const rejectedValue = await rejectionOf(ctx.conn.selectFrom(tRelease)
            .where(tRelease.id.equals(3))
            .select({ later: tRelease.rolloutTime.add({ months: 1 }) })
            .executeSelectMany())
        expect(rejectedValue).toBe(ctx.realDbEnabled)
    })
    */

    // NOT-SUPPORTED: Bun SQL's sqlite adapter exposes neither a user-defined-function API nor its bun:sqlite `Database`, so the tsq_duration_add UDF can't be registered
    /*
    test('a-difference-plus-a-duration', async () => {
        // 2024-01-31 until 2024-03-30 is P59D
        ctx.mockNext({ later: '59 days 12:00:00' })
        const january31 = ctx.conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate')
        const row = await ctx.conn.selectFromNoTable()
            .select({ later: january31.until(Temporal.PlainDate.from('2024-03-30')).add({ hours: 12 }) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        assertType<Exact<typeof row, { later: Temporal.Duration }>>()
        expect(row.later.toString()).toBe('P59DT12H')
    })
    */

    // NOT-SUPPORTED: Bun SQL's sqlite adapter exposes neither a user-defined-function API nor its bun:sqlite `Database`, so the functions of the library can't be registered
    /*
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
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
    */

    // NOT-SUPPORTED: Bun SQL's sqlite adapter exposes neither a user-defined-function API nor its bun:sqlite `Database`, so the functions of the library can't be registered
    /*
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
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
        expect(ctx.lastSql).toMatchInlineSnapshot()
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
    */
})
