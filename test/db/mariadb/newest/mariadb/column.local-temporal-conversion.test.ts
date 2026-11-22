// A value with a Date (localDate, localTime, localDateTime) as the Temporal value kept in the same column, and back.
// col_matrix row 1 has the date 2024-03-04, the time 09:15:00 and the date and time 2024-01-14 12:30:00, read with a
// Date (tColMatrixColumn) and with Temporal (tColMatrixPlain); instant_value row 1 is 2024-01-14T09:15:30.123456Z,
// written with the offset +09:00 where the column keeps one, and its wall clock in UTC in wall_at; zoned_value row 2 is
// 2024-01-14T14:45:30.123456+05:30[Asia/Kolkata]. Every value expected is the one Temporal and Date give.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tColMatrixColumn, tColMatrixPlain, tInstantValue, tZonedValue, type DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { withSqlDataType } from '../../../../../src/exports/v2/index.js'
import { Table } from '../../../../../src/Table.js'

const plain = tColMatrixPlain.as('plain')

const deployed = Temporal.Instant.from('2024-01-14T09:15:30.123456Z')

// The same columns declared without zone (timeZone 'none'): each one is its own date and time in the zone of the database
const tColMatrixWithoutZone = new class TColMatrixWithoutZone extends Table<DBConnection, 'TColMatrixWithoutZone'> {
    id = this.primaryKey('id', 'int')
    mDatetime = this.column('m_datetime', 'localDateTime', withSqlDataType({ family: 'datetime', fields: 'timestamp', timeZone: 'none' }))
    constructor() { super('col_matrix') }
}()
const tInstantValueWithoutZone = new class TInstantValueWithoutZone extends Table<DBConnection, 'TInstantValueWithoutZone'> {
    id = this.primaryKey('id', 'int')
    wallAt = this.optionalColumn('wall_at', 'instant', withSqlDataType({ family: 'datetime', fields: 'timestamp', timeZone: 'none' }))
    constructor() { super('instant_value') }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('a-date-value-as-the-temporal-value-of-its-column', async () => {
        ctx.mockNext([{ day: '2024-03-04', time: '09:15:00', moment: '2024-01-14 12:30:00', dayOfMoment: '2024-01-14', timeOfMoment: '12:30:00' }])
        const rows = await ctx.conn.selectFrom(tColMatrixColumn)
            .where(tColMatrixColumn.id.equals(1))
            .select({
                day: tColMatrixColumn.mDate.toPlainDate(),
                time: tColMatrixColumn.mTime.toPlainTime(),
                moment: tColMatrixColumn.mDatetime.toPlainDateTime(),
                dayOfMoment: tColMatrixColumn.mDatetime.toPlainDate(),
                timeOfMoment: tColMatrixColumn.mDatetime.toPlainTime(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_date as day, m_time as time, m_datetime as moment, date(m_datetime) as dayOfMoment, time(m_datetime) as timeOfMoment from col_matrix where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ day: Temporal.PlainDate; time: Temporal.PlainTime; moment: Temporal.PlainDateTime; dayOfMoment: Temporal.PlainDate; timeOfMoment: Temporal.PlainTime }>>>()
        expect(rows.map(row => [row.day.toString(), row.time.toString(), row.moment.toString(), row.dayOfMoment.toString(), row.timeOfMoment.toString()])).toEqual([
            ['2024-03-04', '09:15:00', '2024-01-14T12:30:00', '2024-01-14', '12:30:00'],
        ])
    })

    test('a-date-value-compared-with-the-temporal-value-of-its-column', async () => {
        // The same column read with a Date and with Temporal is the same value
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tColMatrixColumn)
            .join(plain).on(plain.id.equals(tColMatrixColumn.id))
            .where(tColMatrixColumn.mDate.toPlainDate().equals(plain.mDate))
            .and(tColMatrixColumn.mTime.toPlainTime().equals(plain.mTime))
            .and(tColMatrixColumn.mDatetime.toPlainDateTime().equals(plain.mDatetime))
            .and(plain.mDate.toLocalDate().equals(tColMatrixColumn.mDate))
            .and(plain.mTime.toLocalTime().equals(tColMatrixColumn.mTime))
            .and(plain.mDatetime.toLocalDateTime().equals(tColMatrixColumn.mDatetime))
            .select({ id: tColMatrixColumn.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select col_matrix.id as id from col_matrix join col_matrix as plain on plain.id = col_matrix.id where col_matrix.m_date = plain.m_date and col_matrix.m_time = plain.m_time and col_matrix.m_datetime = plain.m_datetime and plain.m_date = col_matrix.m_date and plain.m_time = col_matrix.m_time and plain.m_datetime = col_matrix.m_datetime"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual([{ id: 1 }])
    })

    test('a-date-and-time-with-a-fraction-of-a-second-as-the-temporal-value-of-its-column', async () => {
        // 12:30:00.007, which each database keeps with the digits it has (a SQL Server datetime, in 300ths of a second,
        // read as 12:30:00.007): the value with a Date as a plainDateTime, its time, and its difference with and without
        // the functions of the library, are the ones of the value read from the column
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tColMatrixPlain)
                .set({ mDatetime: Temporal.PlainDateTime.from('2024-01-14T12:30:00.007') })
                .where(tColMatrixPlain.id.equals(1))
                .executeUpdate()
            ctx.mockNext([{ converted: '2024-01-14 12:30:00.007', direct: '2024-01-14 12:30:00.007', time: '12:30:00.007' }])
            const rows = await ctx.conn.selectFrom(tColMatrixColumn)
                .join(plain).on(plain.id.equals(tColMatrixColumn.id))
                .where(tColMatrixColumn.id.equals(1))
                .select({
                    converted: tColMatrixColumn.mDatetime.toPlainDateTime(),
                    direct: plain.mDatetime,
                    time: plain.mDatetime.toPlainTime(),
                })
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select col_matrix.m_datetime as converted, plain.m_datetime as direct, time(plain.m_datetime) as time from col_matrix join col_matrix as plain on plain.id = col_matrix.id where col_matrix.id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ converted: Temporal.PlainDateTime; direct: Temporal.PlainDateTime; time: Temporal.PlainTime }>>>()
            expect(rows.map(row => [row.converted.toString(), row.time.toString()])).toEqual(rows.map(row => [row.direct.toString(), row.direct.toPlainTime().toString()]))
            const since = (connection: typeof ctx.conn) => connection.selectFrom(plain)
                .where(plain.id.equals(1))
                .selectOneColumn(plain.mDatetime.since(Temporal.PlainDateTime.from('2024-01-14T12:30:00'), { largestUnit: 'month', smallestUnit: 'nanosecond' }))
                .executeSelectOne()
            ctx.mockNext('PT0.007S')
            const withFunctions = await since(ctx.withLibraryFunctions())
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select tsq_duration_round_of(plain.m_datetime, ?, 'month', 'nanosecond', 1, 'trunc', -1) as result from col_matrix as plain where plain.id = ?"`)
            ctx.mockNext('PT0.007S')
            const withoutFunctions = await since(ctx.conn)
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select tsq_duration_round(cast(year(plain.m_datetime) as signed), cast(month(plain.m_datetime) as signed), cast(dayofmonth(plain.m_datetime) as signed), (floor(time_to_sec(plain.m_datetime)) * 1000000 + microsecond(plain.m_datetime)) * 1000, ?, ?, ?, ?, 'month', 'nanosecond', 1, 'trunc', -1) as result from col_matrix as plain where plain.id = ?"`)
            const expected = rows[0]!.direct.since(Temporal.PlainDateTime.from('2024-01-14T12:30:00'), { largestUnit: 'month', smallestUnit: 'nanosecond' }).toString()
            expect([withFunctions.toString(), withoutFunctions.toString()]).toEqual([expected, expected])
        })
    })

    test('a-date-and-time-declared-without-zone-is-its-own-wall-clock', async () => {
        // Declared without zone, a column is written as it is where a column with zone would be taken to the zone of
        // the database or to UTC: the conversion, the parts and the arithmetic give the same values
        ctx.mockNext([{ moment: '2024-01-14 12:30:00', hour: 12, day: 0, epoch: 1705235400000 }])
        const rows = await ctx.conn.selectFrom(tColMatrixWithoutZone)
            .join(plain).on(plain.id.equals(tColMatrixWithoutZone.id))
            .where(tColMatrixWithoutZone.mDatetime.toPlainDateTime().equals(plain.mDatetime))
            .select({
                moment: tColMatrixWithoutZone.mDatetime.toPlainDateTime(),
                hour: tColMatrixWithoutZone.mDatetime.getHours(),
                day: tColMatrixWithoutZone.mDatetime.getDay(),
                epoch: tColMatrixWithoutZone.mDatetime.getTime(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select col_matrix.m_datetime as moment, hour(col_matrix.m_datetime) as hour, dayofweek(col_matrix.m_datetime) - 1 as day, floor(timestampdiff(microsecond, '1970-01-01 00:00:00', col_matrix.m_datetime) / 1000) as epoch from col_matrix join col_matrix as plain on plain.id = col_matrix.id where col_matrix.m_datetime = plain.m_datetime"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ moment: Temporal.PlainDateTime; hour: number; day: number; epoch: number }>>>()
        expect(rows.map(row => [row.moment.toString(), row.hour, row.day, row.epoch])).toEqual([['2024-01-14T12:30:00', 12, 0, Date.UTC(2024, 0, 14, 12, 30)]])

        ctx.mockNext([{ wall: '2024-01-14 09:15:30.123456', later: '2024-01-14 10:15:30.123456', milliseconds: 1705223730123 }])
        const instants = await ctx.conn.selectFrom(tInstantValueWithoutZone)
            .where(tInstantValueWithoutZone.id.equals(1))
            .select({
                wall: tInstantValueWithoutZone.wallAt.toPlainDateTime(),
                later: tInstantValueWithoutZone.wallAt.add({ hours: 1 }),
                milliseconds: tInstantValueWithoutZone.wallAt.epochMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select wall_at as wall, date_add(wall_at, interval ? microsecond) as later, floor(timestampdiff(microsecond, '1970-01-01 00:00:00', wall_at) / 1000) as milliseconds from instant_value where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3600000000n,
            1,
          ]
        `)
        assertType<Exact<typeof instants, Array<{ wall?: Temporal.PlainDateTime; later?: Temporal.Instant; milliseconds?: number }>>>()
        expect(instants.map(row => [row.wall?.toString(), row.later?.toString(), row.milliseconds])).toEqual([
            [deployed.toZonedDateTimeISO('UTC').toPlainDateTime().toString(), deployed.add({ hours: 1 }).toString(), deployed.epochMilliseconds],
        ])
    })

    test('a-temporal-value-as-the-date-value-of-its-column', async () => {
        ctx.mockNext([{ day: '2024-03-04', time: '09:15:00', moment: '2024-01-14 12:30:00', direct: '2024-01-14 12:30:00' }])
        const rows = await ctx.conn.selectFrom(plain)
            .join(tColMatrixColumn).on(tColMatrixColumn.id.equals(plain.id))
            .where(plain.id.equals(1))
            .select({
                day: plain.mDate.toLocalDate(),
                time: plain.mTime.toLocalTime(),
                moment: plain.mDatetime.toLocalDateTime(),
                direct: tColMatrixColumn.mDatetime,
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select plain.m_date as day, plain.m_time as time, plain.m_datetime as moment, col_matrix.m_datetime as direct from col_matrix as plain join col_matrix on col_matrix.id = plain.id where plain.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ day: Date; time: Date; moment: Date; direct: Date }>>>()
        expect(rows.map(row => [row.day.toISOString(), row.time.toISOString(), row.moment.toISOString(), row.direct.toISOString()])).toEqual([
            ['2024-03-04T10:00:00.000Z', '1970-01-01T09:15:00.000Z', '2024-01-14T12:30:00.000Z', '2024-01-14T12:30:00.000Z'],
        ])
    })

    test('an-instant-as-a-date-and-back', async () => {
        // A Date stops at the millisecond; the instant of the Date value in the query keeps every digit
        ctx.mockNext([{ id: 1, at: '2024-01-14 09:15:30.123456+00', wall: '2024-01-14 09:15:30.123456', back: '2024-01-14 09:15:30.123456+00', wallBack: '2024-01-14 09:15:30.123456' }])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.id.equals(1))
            .and(tInstantValue.instantAt.toLocalDateTime().toInstant().equals(tInstantValue.instantAt))
            .select({
                id: tInstantValue.id,
                at: tInstantValue.instantAt.toLocalDateTime(),
                wall: tInstantValue.wallAt.toLocalDateTime(),
                back: tInstantValue.instantAt.toLocalDateTime().toInstant(),
                wallBack: tInstantValue.wallAt.toLocalDateTime().toPlainDateTime(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, instant_at as at, wall_at as wall, instant_at as back, wall_at as wallBack from instant_value where id = ? and instant_at = instant_at"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; at: Date; wall?: Date; back: Temporal.Instant; wallBack?: Temporal.PlainDateTime }>>>()
        expect(rows.map(row => [row.id, row.at.toISOString(), row.wall?.toISOString(), row.back.toString(), row.wallBack?.toString()])).toEqual([
            [1, new Date(deployed.epochMilliseconds).toISOString(), new Date(deployed.epochMilliseconds).toISOString(), deployed.toString(), deployed.toZonedDateTimeISO('UTC').toPlainDateTime().toString()],
        ])
    })

    test('a-zoned-date-and-time-as-a-date', async () => {
        ctx.mockNext([{ id: 2, at: '2024-01-14 09:15:30.123456+00' }])
        const rows = await ctx.conn.selectFrom(tZonedValue)
            .where(tZonedValue.id.equals(2))
            .select({ id: tZonedValue.id, at: tZonedValue.zonedAt.toLocalDateTime() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (cast(replace(left(substring_index(zoned_at, '[', 1), char_length(substring_index(zoned_at, '[', 1)) - if(substring_index(zoned_at, '[', 1) like '%Z', 1, 6)), 'T', ' ') as datetime(6)) - interval if(substring_index(zoned_at, '[', 1) like '%Z', 0, if(substr(substring_index(zoned_at, '[', 1), -6, 1) = '-', -1, 1) * (substr(substring_index(zoned_at, '[', 1), -5, 2) * 3600 + substr(substring_index(zoned_at, '[', 1), -2, 2) * 60)) second) as at from zoned_value where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; at: Date }>>>()
        expect(rows.map(row => [row.id, row.at.toISOString()])).toEqual([[2, new Date(deployed.epochMilliseconds).toISOString()]])
    })

    test('values-of-the-query-converted', async () => {
        // A value sent, converted in the query
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.mDate.equals(ctx.conn.const(new Date(Date.UTC(2024, 2, 4, 10)), 'localDate').toPlainDate()))
            .and(tColMatrixPlain.mDatetime.toLocalDateTime().equals(ctx.conn.const(Temporal.PlainDateTime.from('2024-01-14T12:30:00'), 'plainDateTime').toLocalDateTime()))
            .and(tColMatrixPlain.mTime.equals(ctx.conn.const(new Date(Date.UTC(1970, 0, 1, 9, 15)), 'localTime').toPlainTime()))
            .select({ id: tColMatrixPlain.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from col_matrix where m_date = ? and m_datetime = ? and m_time = ?"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "Mon Mar 04 2024 10:00:00 GMT+0000 (Coordinated Universal Time)",
            "2024-01-14T12:30:00",
            "Thu Jan 01 1970 09:15:00 GMT+0000 (Coordinated Universal Time)",
          ]
        `)
        expect(rows).toEqual([{ id: 1 }])
    })
})
