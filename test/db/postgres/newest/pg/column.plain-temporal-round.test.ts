// Times and dates and times without zone rounded, with the semantics of Temporal's round. temporal_precision row 1 has
// 2024-01-15 12:30:59.9996; col_matrix row 1 has the time 09:15:00.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tColMatrixPlain, tRelease, tTemporalPrecisionPlain } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('a-time-rounded-to-a-unit', async () => {
        // Half way up; 23:59:59.5 to the second goes round to midnight
        ctx.mockNext({ halfUp: '10:08:00', midnight: '00:00:00', down: '10:07:00', same: '10:20:30.123' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                halfUp: ctx.conn.const(Temporal.PlainTime.from('10:07:30'), 'plainTime').round('minute'),
                midnight: ctx.conn.const(Temporal.PlainTime.from('23:59:59.5'), 'plainTime').round('second'),
                down: ctx.conn.const(Temporal.PlainTime.from('10:07:29.999'), 'plainTime').round('minute'),
                same: ctx.conn.const(Temporal.PlainTime.from('10:20:30.123'), 'plainTime').round('millisecond'),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(date_bin(interval '1 minutes', (date '2000-01-01' + $1::time) + interval '30 seconds', date_trunc('day', (date '2000-01-01' + $1::time))) as time) as "halfUp", cast(date_bin(interval '1 seconds', (date '2000-01-01' + $2::time) + interval '500 milliseconds', date_trunc('day', (date '2000-01-01' + $2::time))) as time) as midnight, cast(date_bin(interval '1 minutes', (date '2000-01-01' + $3::time) + interval '30 seconds', date_trunc('day', (date '2000-01-01' + $3::time))) as time) as down, cast(date_bin(interval '1 milliseconds', (date '2000-01-01' + $4::time) + interval '500 microseconds', date_trunc('day', (date '2000-01-01' + $4::time))) as time) as same"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "10:07:30",
            "23:59:59.5",
            "10:07:29.999",
            "10:20:30.123",
          ]
        `)
        assertType<Exact<typeof row, { halfUp: Temporal.PlainTime; midnight: Temporal.PlainTime; down: Temporal.PlainTime; same: Temporal.PlainTime }>>()
        expect([row.halfUp, row.midnight, row.down, row.same].map(String)).toEqual(['10:08:00', '00:00:00', '10:07:00', '10:20:30.123'])
    })

    test('a-time-rounded-with-an-increment-and-a-mode', async () => {
        ctx.mockNext({ quarter: '10:15:00', halfTrunc: '10:00:00', halfEvenDown: '10:00:00', halfEvenUp: '10:30:00', ceil: '11:00:00', floor: '10:00:00', expand: '10:00:01' })
        const at = (text: string) => ctx.conn.const(Temporal.PlainTime.from(text), 'plainTime')
        const row = await ctx.conn.selectFromNoTable()
            .select({
                quarter: at('10:07:30').round({ smallestUnit: 'minute', roundingIncrement: 15 }),
                halfTrunc: at('10:07:30').round({ smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'halfTrunc' }),
                halfEvenDown: at('10:07:30').round({ smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'halfEven' }),
                halfEvenUp: at('10:22:30').round({ smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'halfEven' }),
                ceil: at('10:00:01').round({ smallestUnit: 'hour', roundingMode: 'ceil' }),
                floor: at('10:59').round({ smallestUnit: 'hours', roundingMode: 'floor' }),
                expand: at('10:00:00.001').round({ smallestUnit: 'second', roundingMode: 'expand' }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(date_bin(interval '15 minutes', (date '2000-01-01' + $1::time) + interval '450 seconds', date_trunc('day', (date '2000-01-01' + $1::time))) as time) as quarter, cast(date_bin(interval '15 minutes', (date '2000-01-01' + $2::time) + interval '450 seconds' - interval '1 microsecond', date_trunc('day', (date '2000-01-01' + $2::time))) as time) as "halfTrunc", cast((case when (date '2000-01-01' + $3::time) - date_bin(interval '15 minutes', (date '2000-01-01' + $3::time), date_trunc('day', (date '2000-01-01' + $3::time))) = interval '450 seconds' then date_bin(interval '30 minutes', (date '2000-01-01' + $3::time) + interval '450 seconds', date_trunc('day', (date '2000-01-01' + $3::time))) else date_bin(interval '15 minutes', (date '2000-01-01' + $3::time) + interval '450 seconds', date_trunc('day', (date '2000-01-01' + $3::time))) end) as time) as "halfEvenDown", cast((case when (date '2000-01-01' + $4::time) - date_bin(interval '15 minutes', (date '2000-01-01' + $4::time), date_trunc('day', (date '2000-01-01' + $4::time))) = interval '450 seconds' then date_bin(interval '30 minutes', (date '2000-01-01' + $4::time) + interval '450 seconds', date_trunc('day', (date '2000-01-01' + $4::time))) else date_bin(interval '15 minutes', (date '2000-01-01' + $4::time) + interval '450 seconds', date_trunc('day', (date '2000-01-01' + $4::time))) end) as time) as "halfEvenUp", cast(date_bin(interval '1 hours', (date '2000-01-01' + $5::time) + interval '1 hours' - interval '1 microsecond', date_trunc('day', (date '2000-01-01' + $5::time))) as time) as ceil, cast(date_bin(interval '1 hours', (date '2000-01-01' + $6::time), date_trunc('day', (date '2000-01-01' + $6::time))) as time) as floor, cast(date_bin(interval '1 seconds', (date '2000-01-01' + $7::time) + interval '1 seconds' - interval '1 microsecond', date_trunc('day', (date '2000-01-01' + $7::time))) as time) as expand"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "10:07:30",
            "10:07:30",
            "10:07:30",
            "10:22:30",
            "10:00:01",
            "10:59:00",
            "10:00:00.001",
          ]
        `)
        expect([row.quarter, row.halfTrunc, row.halfEvenDown, row.halfEvenUp, row.ceil, row.floor, row.expand].map(String)).toEqual(['10:15:00', '10:00:00', '10:00:00', '10:30:00', '11:00:00', '10:00:00', '10:00:01'])
    })

    test('a-date-and-time-rounded', async () => {
        // The end of the day is the next day
        ctx.mockNext({ nextDay: '2024-03-01 00:00:00', toDay: '2024-03-01 00:00:00', sameDay: '2024-02-29 00:00:00', sixHours: '2024-02-29 18:00:00' })
        const at = (text: string) => ctx.conn.const(Temporal.PlainDateTime.from(text), 'plainDateTime')
        const row = await ctx.conn.selectFromNoTable()
            .select({
                nextDay: at('2024-02-29T23:59:59.5').round('second'),
                toDay: at('2024-02-29T12:00').round('day'),
                sameDay: at('2024-02-29T11:59:59.999').round({ smallestUnit: 'day' }),
                sixHours: at('2024-02-29T23:59').round({ smallestUnit: 'hour', roundingIncrement: 6, roundingMode: 'floor' }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date_bin(interval '1 seconds', $1::timestamp + interval '500 milliseconds', date_trunc('day', $1::timestamp)) as "nextDay", date_bin(interval '1 day', $2::timestamp + interval '12 hours', date_trunc('day', $2::timestamp)) as "toDay", date_bin(interval '1 day', $3::timestamp + interval '12 hours', date_trunc('day', $3::timestamp)) as "sameDay", date_bin(interval '6 hours', $4::timestamp, date_trunc('day', $4::timestamp)) as "sixHours""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-02-29T23:59:59.5",
            "2024-02-29T12:00:00",
            "2024-02-29T11:59:59.999",
            "2024-02-29T23:59:00",
          ]
        `)
        assertType<Exact<typeof row, { nextDay: Temporal.PlainDateTime; toDay: Temporal.PlainDateTime; sameDay: Temporal.PlainDateTime; sixHours: Temporal.PlainDateTime }>>()
        expect([row.nextDay, row.toDay, row.sameDay, row.sixHours].map(String)).toEqual(['2024-03-01T00:00:00', '2024-03-01T00:00:00', '2024-02-29T00:00:00', '2024-02-29T18:00:00'])
    })

    test('the-values-of-a-column-rounded', async () => {
        ctx.mockNext([{ second: '2024-01-15 12:31:00', halfHour: '09:30:00' }])
        const rows = await ctx.conn.selectFrom(tTemporalPrecisionPlain)
            .innerJoin(tColMatrixPlain).on(tColMatrixPlain.id.equals(tTemporalPrecisionPlain.id))
            .where(tTemporalPrecisionPlain.id.equals(1))
            .select({
                second: tTemporalPrecisionPlain.microStamp.round('second'),
                halfHour: tColMatrixPlain.mTime.round({ smallestUnit: 'minute', roundingIncrement: 30 }),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date_bin(interval '1 seconds', temporal_precision.micro_stamp + interval '500 milliseconds', date_trunc('day', temporal_precision.micro_stamp)) as second, cast(date_bin(interval '30 minutes', (date '2000-01-01' + col_matrix.m_time) + interval '15 minutes', date_trunc('day', (date '2000-01-01' + col_matrix.m_time))) as time) as "halfHour" from temporal_precision inner join col_matrix on col_matrix.id = temporal_precision.id where temporal_precision.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ second: Temporal.PlainDateTime; halfHour: Temporal.PlainTime }>>>()
        expect(rows.map(row => [row.second, row.halfHour].map(String))).toEqual([['2024-01-15T12:31:00', '09:30:00']])
    })

    test('the-rounding-and-the-differences-with-the-functions-of-the-library', async () => {
        // With the functions of the library installed round, until and since write each value once: the values are the
        // ones of Temporal for the values read, with and without the functions (the mock answers no rows: there it is
        // the SQL that is checked). The differences fall half way to their step, where the modes differ
        const at = Temporal.PlainDateTime.from('2024-02-01T10:07:30')
        const time = Temporal.PlainTime.from('12:02:30')
        const instant = Temporal.Instant.from('2024-02-01T10:07:30Z')
        const query = (conn: typeof ctx.conn) => conn.selectFrom(tRelease)
            .where(tRelease.deployedAt.isNotNull())
            .select({
                version: tRelease.version,
                publishedAt: tRelease.publishedAt,
                cutoffTime: tRelease.cutoffTime,
                deployedAt: tRelease.deployedAt,
                roundedPublishedAt: tRelease.publishedAt.round({ smallestUnit: 'hour', roundingIncrement: 3, roundingMode: 'halfEven' }),
                roundedCutoffTime: tRelease.cutoffTime.round({ smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'halfTrunc' }),
                roundedDeployedAt: tRelease.deployedAt.round({ smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'floor' }),
                toAt: tRelease.publishedAt.until(at, { smallestUnit: 'minute', roundingMode: 'halfEven' }),
                fromAt: tRelease.publishedAt.since(at, { largestUnit: 'hour', smallestUnit: 'minute', roundingMode: 'ceil' }),
                toTime: tRelease.cutoffTime.until(time, { smallestUnit: 'minute', roundingIncrement: 5, roundingMode: 'halfFloor' }),
                toInstant: tRelease.deployedAt.until(instant, { largestUnit: 'hour', smallestUnit: 'minute', roundingMode: 'expand' }),
                toInstantInSeconds: tRelease.deployedAt.until(instant, { largestUnit: 'hour', smallestUnit: 'second' }),
                exactlyToAt: tRelease.publishedAt.until(at),
            })
            .orderBy('version')
            .executeSelectMany()
        ctx.mockNext([])
        const withFunctions = await query(ctx.withLibraryFunctions())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, published_at as "publishedAt", cutoff_time as "cutoffTime", deployed_at as "deployedAt", (date_trunc('day', published_at) + tsq_round_to((extract(epoch from published_at - date_trunc('day', published_at)) * 1000000)::bigint, 10800000000, 'halfEven') * interval '1 microsecond') as "roundedPublishedAt", cast(date_bin(interval '15 minutes', (date '2000-01-01' + cutoff_time) + interval '450 seconds' - interval '1 microsecond', date_trunc('day', (date '2000-01-01' + cutoff_time))) as time) as "roundedCutoffTime", date_bin(interval '15 minutes', deployed_at, date_trunc('day', deployed_at)) as "roundedDeployedAt", justify_hours((tsq_round_to((extract(epoch from $1::timestamp - published_at) * 1000000)::bigint, 60000000, 'halfEven') || ' microseconds')::interval) as "toAt", (-tsq_round_to((extract(epoch from $2::timestamp - published_at) * 1000000)::bigint, 60000000, 'floor') || ' microseconds')::interval as "fromAt", (tsq_round_to((extract(epoch from $3::time - cutoff_time) * 1000000)::bigint, 300000000, 'halfFloor') || ' microseconds')::interval as "toTime", (tsq_round_to((extract(epoch from $4::timestamptz - deployed_at) * 1000000)::bigint, 60000000, 'expand') || ' microseconds')::interval as "toInstant", (tsq_round_to((extract(epoch from $5::timestamptz - deployed_at) * 1000000)::bigint, 1000000, 'trunc') || ' microseconds')::interval as "toInstantInSeconds", ($6::timestamp - published_at) as "exactlyToAt" from project_release where deployed_at is not null order by version"`)
        ctx.mockNext([])
        const withoutFunctions = await query(ctx.conn)
        expect(withFunctions.length).toBe(ctx.realDbEnabled ? 2 : 0)
        type Row = (typeof withFunctions)[number]
        const read = (row: Row) => ({
            version: row.version,
            roundedPublishedAt: row.roundedPublishedAt.toString(),
            roundedCutoffTime: row.roundedCutoffTime.toString(),
            roundedDeployedAt: row.roundedDeployedAt?.toString(),
            toAt: row.toAt.total('second'),
            fromAt: row.fromAt.total('second'),
            toTime: row.toTime.total('second'),
            toInstant: row.toInstant?.total('second'),
            toInstantInSeconds: row.toInstantInSeconds?.total('second'),
            exactlyToAt: row.exactlyToAt.total('second'),
        })
        const ofTemporal = (row: Row) => ({
            version: row.version,
            roundedPublishedAt: row.publishedAt.round({ smallestUnit: 'hour', roundingIncrement: 3, roundingMode: 'halfEven' }).toString(),
            roundedCutoffTime: row.cutoffTime.round({ smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'halfTrunc' }).toString(),
            roundedDeployedAt: row.deployedAt?.round({ smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'floor' }).toString(),
            toAt: row.publishedAt.until(at, { smallestUnit: 'minute', roundingMode: 'halfEven' }).total('second'),
            fromAt: row.publishedAt.since(at, { largestUnit: 'hour', smallestUnit: 'minute', roundingMode: 'ceil' }).total('second'),
            toTime: row.cutoffTime.until(time, { smallestUnit: 'minute', roundingIncrement: 5, roundingMode: 'halfFloor' }).total('second'),
            toInstant: row.deployedAt?.until(instant, { largestUnit: 'hour', smallestUnit: 'minute', roundingMode: 'expand' }).total('second'),
            toInstantInSeconds: row.deployedAt?.until(instant, { largestUnit: 'hour', smallestUnit: 'second' }).total('second'),
            exactlyToAt: row.publishedAt.until(at).total('second'),
        })
        expect(withFunctions.map(read)).toEqual(withFunctions.map(ofTemporal))
        expect(withoutFunctions.map(read)).toEqual(withoutFunctions.map(ofTemporal))
    })
})
