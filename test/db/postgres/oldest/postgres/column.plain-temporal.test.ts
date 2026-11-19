// The Temporal values without zone (plainDate, plainTime, plainDateTime): col_matrix row 1 has the date 2024-03-04, the
// time 09:15:00 and the date and time 2024-01-14 12:30:00; temporal_precision row 1 has 2024-01-15 12:30:59.999600, a
// value a Date can't hold.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tColMatrixPlain, tTemporalPrecisionPlain } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('plain-temporal-columns-are-read-as-temporal-values', async () => {
        ctx.mockNext([{ mDate: '2024-03-04', mTime: '09:15:00', mDatetime: '2024-01-14 12:30:00' }])
        const rows = await ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({
                mDate: tColMatrixPlain.mDate,
                mTime: tColMatrixPlain.mTime,
                mDatetime: tColMatrixPlain.mDatetime,
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime" from col_matrix where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ mDate: Temporal.PlainDate; mTime: Temporal.PlainTime; mDatetime: Temporal.PlainDateTime }>>>()
        expect(rows.map(row => [row.mDate.toString(), row.mTime.toString(), row.mDatetime.toString()])).toEqual([['2024-03-04', '09:15:00', '2024-01-14T12:30:00']])
        expect(rows[0]!.mDate).toBeInstanceOf(Temporal.PlainDate)
        expect(rows[0]!.mTime).toBeInstanceOf(Temporal.PlainTime)
        expect(rows[0]!.mDatetime).toBeInstanceOf(Temporal.PlainDateTime)
    })

    test('a-plain-date-time-keeps-the-microseconds', async () => {
        ctx.mockNext([{ microStamp: '2024-01-15 12:30:59.9996' }])
        const rows = await ctx.conn.selectFrom(tTemporalPrecisionPlain)
            .where(tTemporalPrecisionPlain.id.equals(1))
            .select({ microStamp: tTemporalPrecisionPlain.microStamp })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select micro_stamp as "microStamp" from temporal_precision where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ microStamp: Temporal.PlainDateTime }>>>()
        expect(rows.map(row => row.microStamp.toString())).toEqual(['2024-01-15T12:30:59.9996'])
    })

    test('a-plain-date-time-is-stored-with-the-digits-the-column-keeps', async () => {
        // The column keeps microseconds: PostgreSQL rounds the nanoseconds of the value
        await ctx.conn.insertInto(tTemporalPrecisionPlain)
            .values({ id: 2, microStamp: Temporal.PlainDateTime.from('2024-02-29T23:59:58.123456789') })
            .executeInsert()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into temporal_precision (id, micro_stamp) values ($1, $2)"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2",
            "2024-02-29T23:59:58.123456789",
          ]
        `)
        ctx.mockNext([{ microStamp: '2024-02-29 23:59:58.123457' }])
        const rows = await ctx.conn.selectFrom(tTemporalPrecisionPlain)
            .where(tTemporalPrecisionPlain.id.equals(2))
            .select({ microStamp: tTemporalPrecisionPlain.microStamp })
            .executeSelectMany()
        expect(rows.map(row => row.microStamp.toString())).toEqual(['2024-02-29T23:59:58.123457'])
    })

    test('plain-temporal-values-are-returned-by-a-delete', async () => {
        ctx.mockNext({ mDate: '2024-03-04', mTime: '09:15:00', mDatetime: '2024-01-14 12:30:00' })
        await ctx.withRollback(async () => {
            const removed = await ctx.conn.deleteFrom(tColMatrixPlain)
                .where(tColMatrixPlain.id.equals(1))
                .returning({
                    mDate: tColMatrixPlain.mDate,
                    mTime: tColMatrixPlain.mTime,
                    mDatetime: tColMatrixPlain.mDatetime,
                })
                .executeDeleteOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from col_matrix where id = $1 returning m_date as "mDate", m_time as "mTime", m_datetime as "mDatetime""`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof removed, { mDate: Temporal.PlainDate; mTime: Temporal.PlainTime; mDatetime: Temporal.PlainDateTime }>>()
            expect([removed.mDate.toString(), removed.mTime.toString(), removed.mDatetime.toString()]).toEqual(['2024-03-04', '09:15:00', '2024-01-14T12:30:00'])
        })
    })

    test('plain-temporal-values-are-compared-as-parameters', async () => {
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.mDate.equals(Temporal.PlainDate.from('2024-03-04')))
            .and(tColMatrixPlain.mTime.equals(Temporal.PlainTime.from('09:15')))
            .and(tColMatrixPlain.mDatetime.equals(Temporal.PlainDateTime.from('2024-01-14T12:30')))
            .select({ id: tColMatrixPlain.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from col_matrix where m_date = $1 and m_time = $2 and m_datetime = $3"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-03-04",
            "09:15:00",
            "2024-01-14T12:30:00",
          ]
        `)
        expect(rows).toEqual([{ id: 1 }])
    })

    test('a-plain-date-before-the-year-1', async () => {
        // The year -43 is 44 BC: there is no year 0
        ctx.mockNext({ day: '0044-03-15 BC', moment: '0044-03-15 09:15:30.123456 BC' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                day: ctx.conn.const(Temporal.PlainDate.from('-000043-03-15'), 'plainDate'),
                moment: ctx.conn.const(Temporal.PlainDateTime.from('-000043-03-15T09:15:30.123456'), 'plainDateTime'),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 as day, $2 as moment"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "-000043-03-15",
            "-000043-03-15T09:15:30.123456",
          ]
        `)
        expect([row.day.toString(), row.moment.toString()]).toEqual(['-000043-03-15', '-000043-03-15T09:15:30.123456'])
    })

    test('plain-temporal-values-inside-an-aggregated-array', async () => {
        ctx.mockNext([{ values: [{ mDate: '2024-03-04', mTime: '09:15:00', mDatetime: '2024-01-14T12:30:00' }] }])
        const rows = await ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({
                values: ctx.conn.aggregateAsArray({
                    mDate: tColMatrixPlain.mDate,
                    mTime: tColMatrixPlain.mTime,
                    mDatetime: tColMatrixPlain.mDatetime,
                }),
            })
            .executeSelectMany()
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (json_agg(json_build_object('mDate', m_date, 'mTime', m_time, 'mDatetime', m_datetime)))::text as values from col_matrix where id = $1"`)
        expect(rows.map(row => row.values.map(value => [value.mDate.toString(), value.mTime.toString(), value.mDatetime.toString()]))).toEqual([[['2024-03-04', '09:15:00', '2024-01-14T12:30:00']]])
    })

    test('the-parts-of-a-plain-date-time', async () => {
        // 2024-01-15 is a Monday, the 15th day of the year; Temporal's microsecond is the one of the millisecond
        const expected = [{ year: 2024, month: 1, day: 15, dayOfWeek: 1, dayOfYear: 15, hour: 12, minute: 30, second: 59, millisecond: 999, microsecond: 600 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tTemporalPrecisionPlain)
            .where(tTemporalPrecisionPlain.id.equals(1))
            .select({
                year: tTemporalPrecisionPlain.microStamp.year(),
                month: tTemporalPrecisionPlain.microStamp.month(),
                day: tTemporalPrecisionPlain.microStamp.day(),
                dayOfWeek: tTemporalPrecisionPlain.microStamp.dayOfWeek(),
                dayOfYear: tTemporalPrecisionPlain.microStamp.dayOfYear(),
                hour: tTemporalPrecisionPlain.microStamp.hour(),
                minute: tTemporalPrecisionPlain.microStamp.minute(),
                second: tTemporalPrecisionPlain.microStamp.second(),
                millisecond: tTemporalPrecisionPlain.microStamp.millisecond(),
                microsecond: tTemporalPrecisionPlain.microStamp.microsecond(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(year from micro_stamp) as year, extract(month from micro_stamp) as month, extract(day from micro_stamp) as day, extract(isodow from micro_stamp) as "dayOfWeek", extract(doy from micro_stamp) as "dayOfYear", extract(hour from micro_stamp) as hour, extract(minute from micro_stamp) as minute, trunc(extract(second from micro_stamp))::integer as second, trunc(extract(millisecond from micro_stamp))::integer % 1000 as millisecond, trunc(extract(microseconds from micro_stamp))::integer % 1000 as microsecond from temporal_precision where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ year: number; month: number; day: number; dayOfWeek: number; dayOfYear: number; hour: number; minute: number; second: number; millisecond: number; microsecond: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('the-parts-of-a-plain-date-and-a-plain-time', async () => {
        // 2024-03-04 is a Monday, the 64th day of a leap year; 2024-01-14 is a Sunday, the 7th day of the week
        const expected = [{ month: 3, dayOfWeek: 1, dayOfYear: 64, sunday: 7, hour: 9, minute: 15, microsecond: 0 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({
                month: tColMatrixPlain.mDate.month(),
                dayOfWeek: tColMatrixPlain.mDate.dayOfWeek(),
                dayOfYear: tColMatrixPlain.mDate.dayOfYear(),
                sunday: tColMatrixPlain.mDatetime.dayOfWeek(),
                hour: tColMatrixPlain.mTime.hour(),
                minute: tColMatrixPlain.mTime.minute(),
                microsecond: tColMatrixPlain.mTime.microsecond(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(month from m_date) as month, extract(isodow from m_date) as "dayOfWeek", extract(doy from m_date) as "dayOfYear", extract(isodow from m_datetime) as sunday, extract(hour from m_time) as hour, extract(minute from m_time) as minute, trunc(extract(microseconds from m_time))::integer % 1000 as microsecond from col_matrix where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('a-plain-date-time-is-taken-apart-and-a-plain-date-put-at-a-time', async () => {
        ctx.mockNext([{ date: '2024-01-14', time: '12:30:00', midnight: '2024-03-04 00:00:00', atColumn: '2024-03-04 09:15:00', atValue: '2024-03-04 23:59:58.5' }])
        const rows = await ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({
                date: tColMatrixPlain.mDatetime.toPlainDate(),
                time: tColMatrixPlain.mDatetime.toPlainTime(),
                midnight: tColMatrixPlain.mDate.toPlainDateTime(),
                atColumn: tColMatrixPlain.mDate.toPlainDateTime(tColMatrixPlain.mTime),
                atValue: tColMatrixPlain.mDate.toPlainDateTime(Temporal.PlainTime.from('23:59:58.5')),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(m_datetime as date) as date, cast(m_datetime as time) as time, cast(m_date as timestamp) as midnight, m_date + m_time as "atColumn", m_date + $1 as "atValue" from col_matrix where id = $2"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "23:59:58.5",
            "1",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ date: Temporal.PlainDate; time: Temporal.PlainTime; midnight: Temporal.PlainDateTime; atColumn: Temporal.PlainDateTime; atValue: Temporal.PlainDateTime }>>>()
        expect(rows.map(row => [row.date.toString(), row.time.toString(), row.midnight.toString(), row.atColumn.toString(), row.atValue.toString()]))
            .toEqual([['2024-01-14', '12:30:00', '2024-03-04T00:00:00', '2024-03-04T09:15:00', '2024-03-04T23:59:58.5']])
    })

    test('a-part-and-a-conversion-in-a-condition', async () => {
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.mDatetime.toPlainDate().equals(Temporal.PlainDate.from('2024-01-14')))
            .and(tColMatrixPlain.mDate.dayOfWeek().equals(1))
            .select({ id: tColMatrixPlain.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from col_matrix where cast(m_datetime as date) = $1 and extract(isodow from m_date) = $2"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-14",
            "1",
          ]
        `)
        expect(rows).toEqual([{ id: 1 }])
    })

    test('the-current-date-and-time-as-temporal-values', async () => {
        ctx.mockNext({ today: '2024-05-06', now: '2024-05-06 10:11:12.345678', time: '10:11:12.345678' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                today: ctx.conn.currentPlainDate(),
                now: ctx.conn.currentPlainDateTime(),
                time: ctx.conn.currentPlainTime(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select current_date as today, current_timestamp as now, current_time as time"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { today: Temporal.PlainDate; now: Temporal.PlainDateTime; time: Temporal.PlainTime }>>()
        expect(row.today).toBeInstanceOf(Temporal.PlainDate)
        expect(row.now).toBeInstanceOf(Temporal.PlainDateTime)
        expect(row.time).toBeInstanceOf(Temporal.PlainTime)
        expect(Temporal.PlainDate.compare(row.today, row.now.toPlainDate())).toBe(0)
    })
})
