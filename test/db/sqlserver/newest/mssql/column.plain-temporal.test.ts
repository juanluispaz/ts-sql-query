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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select m_date as mDate, m_time as mTime, m_datetime as mDatetime from col_matrix where id = @0"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select micro_stamp as microStamp from temporal_precision where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ microStamp: Temporal.PlainDateTime }>>>()
        expect(rows.map(row => row.microStamp.toString())).toEqual(['2024-01-15T12:30:59.9996'])
    })

    test('a-plain-date-time-is-stored-with-the-digits-the-column-keeps', async () => {
        // The column, a datetime2(7), keeps hundreds of nanoseconds: SQL Server rounds the nanoseconds of the value
        await ctx.conn.insertInto(tTemporalPrecisionPlain)
            .values({ id: 2, microStamp: Temporal.PlainDateTime.from('2024-02-29T23:59:58.123456789') })
            .executeInsert()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into temporal_precision (id, micro_stamp) values (@0, @1)"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2",
            "2024-02-29T23:59:58.123456789",
          ]
        `)
        ctx.mockNext([{ microStamp: '2024-02-29 23:59:58.1234568' }])
        const rows = await ctx.conn.selectFrom(tTemporalPrecisionPlain)
            .where(tTemporalPrecisionPlain.id.equals(2))
            .select({ microStamp: tTemporalPrecisionPlain.microStamp })
            .executeSelectMany()
        expect(rows.map(row => row.microStamp.toString())).toEqual(['2024-02-29T23:59:58.1234568'])
    })

    test('plain-temporal-values-are-compared-as-parameters', async () => {
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.mDate.equals(Temporal.PlainDate.from('2024-03-04')))
            .and(tColMatrixPlain.mTime.equals(Temporal.PlainTime.from('09:15')))
            .and(tColMatrixPlain.mDatetime.equals(Temporal.PlainDateTime.from('2024-01-14T12:30')))
            .select({ id: tColMatrixPlain.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from col_matrix where m_date = @0 and m_time = @1 and m_datetime = @2"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-03-04",
            "09:15:00",
            "2024-01-14T12:30:00",
          ]
        `)
        expect(rows).toEqual([{ id: 1 }])
    })

    // NOT-SUPPORTED: SQL Server's date, datetime2 and time start at the year 1: tedious rejects a value before it (Out of range)
    /*
    test('a-plain-date-before-the-year-1', async () => {
        // The year -43 is 44 BC: there is no year 0
        ctx.mockNext({ day: '0044-03-15 BC', moment: '0044-03-15 09:15:30.123456 BC' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                day: ctx.conn.const(Temporal.PlainDate.from('-000043-03-15'), 'plainDate'),
                moment: ctx.conn.const(Temporal.PlainDateTime.from('-000043-03-15T09:15:30.123456'), 'plainDateTime'),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select @0 as day, @1 as moment"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "-000043-03-15",
            "-000043-03-15T09:15:30.123456",
          ]
        `)
        expect([row.day.toString(), row.moment.toString()]).toEqual(['-000043-03-15', '-000043-03-15T09:15:30.123456'])
    })
    */

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select json_arrayagg(json_object('mDate':m_date, 'mTime':m_time, 'mDatetime':m_datetime)) as [values] from col_matrix where id = @0"`)
        expect(rows.map(row => row.values.map(value => [value.mDate.toString(), value.mTime.toString(), value.mDatetime.toString()]))).toEqual([[['2024-03-04', '09:15:00', '2024-01-14T12:30:00']]])
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select current_date as today, current_timestamp as now, convert(time, current_timestamp) as time"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { today: Temporal.PlainDate; now: Temporal.PlainDateTime; time: Temporal.PlainTime }>>()
        expect(row.today).toBeInstanceOf(Temporal.PlainDate)
        expect(row.now).toBeInstanceOf(Temporal.PlainDateTime)
        expect(row.time).toBeInstanceOf(Temporal.PlainTime)
        expect(Temporal.PlainDate.compare(row.today, row.now.toPlainDate())).toBe(0)
    })
})
