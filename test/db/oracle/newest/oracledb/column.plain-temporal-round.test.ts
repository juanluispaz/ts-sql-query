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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(cast(timestamp '1972-01-01 00:00:00' + numtodsinterval(mod(trunc((2 * to_number(to_char(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) + 60000000000) / 120000000000) * 60000000000, 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "halfUp", to_char(cast(timestamp '1972-01-01 00:00:00' + numtodsinterval(mod(trunc((2 * to_number(to_char(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) + 1000000000) / 2000000000) * 1000000000, 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "midnight", to_char(cast(timestamp '1972-01-01 00:00:00' + numtodsinterval(mod(trunc((2 * to_number(to_char(to_timestamp(:2, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) + 60000000000) / 120000000000) * 60000000000, 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "down", to_char(cast(timestamp '1972-01-01 00:00:00' + numtodsinterval(mod(trunc((2 * to_number(to_char(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) + 1000000) / 2000000) * 1000000, 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "same" from dual"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(cast(timestamp '1972-01-01 00:00:00' + numtodsinterval(mod(trunc((2 * to_number(to_char(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) + 900000000000) / 1800000000000) * 900000000000, 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "quarter", to_char(cast(timestamp '1972-01-01 00:00:00' + numtodsinterval(mod(trunc((2 * to_number(to_char(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) + 899999999999) / 1800000000000) * 900000000000, 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "halfTrunc", to_char(cast(timestamp '1972-01-01 00:00:00' + numtodsinterval(mod((trunc((2 * to_number(to_char(to_timestamp(:2, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) + 900000000000) / 1800000000000) - case when mod((2 * to_number(to_char(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) + 900000000000), 3600000000000) = 1800000000000 then 1 else 0 end) * 900000000000, 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "halfEvenDown", to_char(cast(timestamp '1972-01-01 00:00:00' + numtodsinterval(mod((trunc((2 * to_number(to_char(to_timestamp(:4, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) + 900000000000) / 1800000000000) - case when mod((2 * to_number(to_char(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) + 900000000000), 3600000000000) = 1800000000000 then 1 else 0 end) * 900000000000, 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "halfEvenUp", to_char(cast(timestamp '1972-01-01 00:00:00' + numtodsinterval(mod(trunc((to_number(to_char(to_timestamp(:6, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) + 3599999999999) / 3600000000000) * 3600000000000, 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "ceil", to_char(cast(timestamp '1972-01-01 00:00:00' + numtodsinterval(mod(trunc(to_number(to_char(to_timestamp(:7, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) / 3600000000000) * 3600000000000, 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "floor", to_char(cast(timestamp '1972-01-01 00:00:00' + numtodsinterval(mod(trunc((to_number(to_char(to_timestamp(:8, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) + 999999999) / 1000000000) * 1000000000, 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "expand" from dual"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "10:07:30",
            "10:07:30",
            "10:07:30",
            "10:07:30",
            "10:22:30",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(cast(cast(trunc(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) as timestamp(9)) + numtodsinterval((trunc((2 * to_number(to_char(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) + 1000000000) / 2000000000) * 1000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "nextDay", to_char(cast(cast(trunc(to_timestamp(:2, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) as timestamp(9)) + numtodsinterval((trunc((2 * to_number(to_char(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) + 86400000000000) / 172800000000000) * 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "toDay", to_char(cast(cast(trunc(to_timestamp(:4, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) as timestamp(9)) + numtodsinterval((trunc((2 * to_number(to_char(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) + 86400000000000) / 172800000000000) * 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "sameDay", to_char(cast(cast(trunc(to_timestamp(:6, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) as timestamp(9)) + numtodsinterval((trunc(to_number(to_char(to_timestamp(:7, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) / 21600000000000) * 21600000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "sixHours" from dual"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-02-29T23:59:59.5",
            "2024-02-29T23:59:59.5",
            "2024-02-29T12:00:00",
            "2024-02-29T12:00:00",
            "2024-02-29T11:59:59.999",
            "2024-02-29T11:59:59.999",
            "2024-02-29T23:59:00",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(cast(cast(trunc(temporal_precision.micro_stamp) as timestamp(9)) + numtodsinterval((trunc((2 * to_number(to_char(temporal_precision.micro_stamp, 'SSSSSFF9')) + 1000000000) / 2000000000) * 1000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "second", to_char(cast(timestamp '1972-01-01 00:00:00' + numtodsinterval(mod(trunc((2 * to_number(to_char(col_matrix.m_time, 'SSSSSFF9')) + 1800000000000) / 3600000000000) * 1800000000000, 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "halfHour" from temporal_precision inner join col_matrix on col_matrix.id = temporal_precision.id where temporal_precision.id = :0"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", to_char(cast(published_at as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "publishedAt", to_char(cast(cutoff_time as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "cutoffTime", to_char(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "deployedAt", to_char(cast(cast(trunc(published_at) as timestamp(9)) + numtodsinterval((tsq_round_to(to_number(to_char(published_at, 'SSSSSFF9')), 10800000000000, 'halfEven')) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "roundedPublishedAt", to_char(cast(timestamp '1972-01-01 00:00:00' + numtodsinterval(mod(tsq_round_to(to_number(to_char(cutoff_time, 'SSSSSFF9')), 900000000000, 'halfTrunc'), 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "roundedCutoffTime", to_char(cast(trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((tsq_round_to(to_number(to_char(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), 'SSSSSFF9')), 900000000000, 'trunc')) / 1000000000, 'second'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "roundedDeployedAt", tsq_duration_text(0, 0, 0, 0, tsq_round_to(tsq_nanoseconds_between(published_at, to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')), 60000000000, 'halfEven'), 'day') as "toAt", tsq_duration_text(0, 0, 0, 0, -tsq_round_to(tsq_nanoseconds_between(published_at, to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')), 60000000000, 'floor'), 'hour') as "fromAt", tsq_duration_text(0, 0, 0, 0, tsq_round_to((to_number(to_char(to_timestamp(:2, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'SSSSSFF9')) - to_number(to_char(cutoff_time, 'SSSSSFF9'))), 300000000000, 'halfFloor'), 'hour') as "toTime", tsq_duration_text(0, 0, 0, 0, tsq_round_to(tsq_nanoseconds_between(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), sys_extract_utc(cast(to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))), 60000000000, 'expand'), 'hour') as "toInstant", tsq_duration_text(0, 0, 0, 0, tsq_round_to(tsq_nanoseconds_between(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), sys_extract_utc(cast(to_timestamp(:4, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))), 1000000000, 'trunc'), 'hour') as "toInstantInSeconds", tsq_duration_text(0, 0, 0, 0, tsq_nanoseconds_between(published_at, to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')), 'day') as "exactlyToAt" from project_release where deployed_at is not null order by "version""`)
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
