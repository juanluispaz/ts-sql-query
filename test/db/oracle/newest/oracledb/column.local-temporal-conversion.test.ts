// A value with a Date (localDate, localTime, localDateTime) as the Temporal value kept in the same column, and back.
// col_matrix row 1 has the date 2024-03-04, the time 09:15:00 and the date and time 2024-01-14 12:30:00, read with a
// Date (tColMatrixColumn) and with Temporal (tColMatrixPlain); instant_value row 1 is 2024-01-14T09:15:30.123456Z,
// written with the offset +09:00 where the column keeps one, and its wall clock in UTC in wall_at; zoned_value row 2 is
// 2024-01-14T14:45:30.123456+05:30[Asia/Kolkata]. Every value expected is the one Temporal and Date give.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tColMatrixColumn, tColMatrixPlain, tInstantValue, tZonedValue } from '../../domain/connection.js'
import { ctx } from './setup.js'

const plain = tColMatrixPlain.as('plain')

const deployed = Temporal.Instant.from('2024-01-14T09:15:30.123456Z')

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(m_date, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "day", to_char(cast(m_time as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "time", to_char(cast(cast(m_datetime as timestamp(9) with time zone) at local as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "moment", to_char(trunc(cast(cast(m_datetime as timestamp(9) with time zone) at local as timestamp(9))), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "dayOfMoment", to_char(cast(timestamp '1972-01-01 00:00:00' + (cast(cast(m_datetime as timestamp(9) with time zone) at local as timestamp(9)) - trunc(cast(cast(m_datetime as timestamp(9) with time zone) at local as timestamp(9)))) as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "timeOfMoment" from col_matrix where id = :0"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select col_matrix.id as "id" from col_matrix join col_matrix plain on plain.id = col_matrix.id where col_matrix.m_date = plain.m_date and col_matrix.m_time = plain.m_time and cast(cast(col_matrix.m_datetime as timestamp(9) with time zone) at local as timestamp(9)) = plain.m_datetime and plain.m_date = col_matrix.m_date and plain.m_time = col_matrix.m_time and plain.m_datetime = col_matrix.m_datetime"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual([{ id: 1 }])
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select plain.m_date as "day", plain.m_time as "time", plain.m_datetime as "moment", col_matrix.m_datetime as "direct" from col_matrix plain join col_matrix on col_matrix.id = plain.id where plain.id = :0"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", instant_at as "at", wall_at as "wall", to_char(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "back", to_char(cast(cast(wall_at as timestamp(9) with time zone) at local as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "wallBack" from instant_value where id = :0 and instant_at = instant_at"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", zoned_at as "at" from zoned_value where id = :0"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from col_matrix where m_date = :0 and m_datetime = to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') and m_time = :2"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "Mon Mar 04 2024 10:00:00 GMT+0000 (Coordinated Universal Time)",
            "2024-01-14T12:30:00",
            "Sat Jan 01 1972 09:15:00 GMT+0000 (Coordinated Universal Time)",
          ]
        `)
        expect(rows).toEqual([{ id: 1 }])
    })
})
