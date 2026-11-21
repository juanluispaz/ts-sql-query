// Times and dates and times without zone rounded, with the semantics of Temporal's round. temporal_precision row 1 has
// 2024-01-15 12:30:59.9996; col_matrix row 1 has the time 09:15:00.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tColMatrixPlain, tTemporalPrecisionPlain } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('a-time-rounded-to-a-unit', async () => {
        // Half way up; 23:59:59.5 to the second goes round to midnight
        ctx.mockNext({ halfUp: '10:08:00', midnight: '00:00:00', down: '10:07:00', same: '10:20:30.123' })
        const row = sync(ctx.conn.selectFromNoTable()
            .select({
                halfUp: ctx.conn.const(Temporal.PlainTime.from('10:07:30'), 'plainTime').round('minute'),
                midnight: ctx.conn.const(Temporal.PlainTime.from('23:59:59.5'), 'plainTime').round('second'),
                down: ctx.conn.const(Temporal.PlainTime.from('10:07:29.999'), 'plainTime').round('minute'),
                same: ctx.conn.const(Temporal.PlainTime.from('10:20:30.123'), 'plainTime').round('millisecond'),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%H:%M:%f', '00:00:00', ((cast((2 * cast(round((julianday(?1) - julianday(date(?1))) * 86400000) as integer) + 60000) / 120000 as integer) * 60000) / 1000.0) || ' seconds') as halfUp, strftime('%H:%M:%f', '00:00:00', ((cast((2 * cast(round((julianday(?2) - julianday(date(?2))) * 86400000) as integer) + 1000) / 2000 as integer) * 1000) / 1000.0) || ' seconds') as midnight, strftime('%H:%M:%f', '00:00:00', ((cast((2 * cast(round((julianday(?3) - julianday(date(?3))) * 86400000) as integer) + 60000) / 120000 as integer) * 60000) / 1000.0) || ' seconds') as down, ?4 as same"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "10:07:30.000",
            "23:59:59.500",
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
        const row = sync(ctx.conn.selectFromNoTable()
            .select({
                quarter: at('10:07:30').round({ smallestUnit: 'minute', roundingIncrement: 15 }),
                halfTrunc: at('10:07:30').round({ smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'halfTrunc' }),
                halfEvenDown: at('10:07:30').round({ smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'halfEven' }),
                halfEvenUp: at('10:22:30').round({ smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'halfEven' }),
                ceil: at('10:00:01').round({ smallestUnit: 'hour', roundingMode: 'ceil' }),
                floor: at('10:59').round({ smallestUnit: 'hours', roundingMode: 'floor' }),
                expand: at('10:00:00.001').round({ smallestUnit: 'second', roundingMode: 'expand' }),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%H:%M:%f', '00:00:00', ((cast((2 * cast(round((julianday(?1) - julianday(date(?1))) * 86400000) as integer) + 900000) / 1800000 as integer) * 900000) / 1000.0) || ' seconds') as quarter, strftime('%H:%M:%f', '00:00:00', ((cast((2 * cast(round((julianday(?2) - julianday(date(?2))) * 86400000) as integer) + 899999) / 1800000 as integer) * 900000) / 1000.0) || ' seconds') as halfTrunc, strftime('%H:%M:%f', '00:00:00', (((cast((2 * cast(round((julianday(?3) - julianday(date(?3))) * 86400000) as integer) + 900000) / 1800000 as integer) - case when (2 * cast(round((julianday(?4) - julianday(date(?4))) * 86400000) as integer) + 900000) % 3600000 = 1800000 then 1 else 0 end) * 900000) / 1000.0) || ' seconds') as halfEvenDown, strftime('%H:%M:%f', '00:00:00', (((cast((2 * cast(round((julianday(?5) - julianday(date(?5))) * 86400000) as integer) + 900000) / 1800000 as integer) - case when (2 * cast(round((julianday(?6) - julianday(date(?6))) * 86400000) as integer) + 900000) % 3600000 = 1800000 then 1 else 0 end) * 900000) / 1000.0) || ' seconds') as halfEvenUp, strftime('%H:%M:%f', '00:00:00', ((cast((cast(round((julianday(?7) - julianday(date(?7))) * 86400000) as integer) + 3599999) / 3600000 as integer) * 3600000) / 1000.0) || ' seconds') as ceil, strftime('%H:%M:%f', '00:00:00', ((cast(cast(round((julianday(?8) - julianday(date(?8))) * 86400000) as integer) / 3600000 as integer) * 3600000) / 1000.0) || ' seconds') as floor, strftime('%H:%M:%f', '00:00:00', ((cast((cast(round((julianday(?9) - julianday(date(?9))) * 86400000) as integer) + 999) / 1000 as integer) * 1000) / 1000.0) || ' seconds') as expand"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "10:07:30.000",
            "10:07:30.000",
            "10:07:30.000",
            "10:07:30.000",
            "10:22:30.000",
            "10:22:30.000",
            "10:00:01.000",
            "10:59:00.000",
            "10:00:00.001",
          ]
        `)
        expect([row.quarter, row.halfTrunc, row.halfEvenDown, row.halfEvenUp, row.ceil, row.floor, row.expand].map(String)).toEqual(['10:15:00', '10:00:00', '10:00:00', '10:30:00', '11:00:00', '10:00:00', '10:00:01'])
    })

    test('a-date-and-time-rounded', async () => {
        // The end of the day is the next day
        ctx.mockNext({ nextDay: '2024-03-01 00:00:00', toDay: '2024-03-01 00:00:00', sameDay: '2024-02-29 00:00:00', sixHours: '2024-02-29 18:00:00' })
        const at = (text: string) => ctx.conn.const(Temporal.PlainDateTime.from(text), 'plainDateTime')
        const row = sync(ctx.conn.selectFromNoTable()
            .select({
                nextDay: at('2024-02-29T23:59:59.5').round('second'),
                toDay: at('2024-02-29T12:00').round('day'),
                sameDay: at('2024-02-29T11:59:59.999').round({ smallestUnit: 'day' }),
                sixHours: at('2024-02-29T23:59').round({ smallestUnit: 'hour', roundingIncrement: 6, roundingMode: 'floor' }),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%Y-%m-%d %H:%M:%f', date(?1), ((cast((2 * cast(round((julianday(?2) - julianday(date(?2))) * 86400000) as integer) + 1000) / 2000 as integer) * 1000) / 1000.0) || ' seconds') as nextDay, strftime('%Y-%m-%d %H:%M:%f', date(?3), ((cast((2 * cast(round((julianday(?4) - julianday(date(?4))) * 86400000) as integer) + 86400000) / 172800000 as integer) * 86400000) / 1000.0) || ' seconds') as toDay, strftime('%Y-%m-%d %H:%M:%f', date(?5), ((cast((2 * cast(round((julianday(?6) - julianday(date(?6))) * 86400000) as integer) + 86400000) / 172800000 as integer) * 86400000) / 1000.0) || ' seconds') as sameDay, strftime('%Y-%m-%d %H:%M:%f', date(?7), ((cast(cast(round((julianday(?8) - julianday(date(?8))) * 86400000) as integer) / 21600000 as integer) * 21600000) / 1000.0) || ' seconds') as sixHours"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-02-29 23:59:59.500",
            "2024-02-29 23:59:59.500",
            "2024-02-29 12:00:00.000",
            "2024-02-29 12:00:00.000",
            "2024-02-29 11:59:59.999",
            "2024-02-29 11:59:59.999",
            "2024-02-29 23:59:00.000",
            "2024-02-29 23:59:00.000",
          ]
        `)
        assertType<Exact<typeof row, { nextDay: Temporal.PlainDateTime; toDay: Temporal.PlainDateTime; sameDay: Temporal.PlainDateTime; sixHours: Temporal.PlainDateTime }>>()
        expect([row.nextDay, row.toDay, row.sameDay, row.sixHours].map(String)).toEqual(['2024-03-01T00:00:00', '2024-03-01T00:00:00', '2024-02-29T00:00:00', '2024-02-29T18:00:00'])
    })

    test('the-values-of-a-column-rounded', async () => {
        ctx.mockNext([{ second: '2024-01-15 12:31:00', halfHour: '09:30:00' }])
        const rows = sync(ctx.conn.selectFrom(tTemporalPrecisionPlain)
            .innerJoin(tColMatrixPlain).on(tColMatrixPlain.id.equals(tTemporalPrecisionPlain.id))
            .where(tTemporalPrecisionPlain.id.equals(1))
            .select({
                second: tTemporalPrecisionPlain.microStamp.round('second'),
                halfHour: tColMatrixPlain.mTime.round({ smallestUnit: 'minute', roundingIncrement: 30 }),
            })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%Y-%m-%d %H:%M:%f', date(temporal_precision.micro_stamp), ((cast((2 * cast(round((julianday(temporal_precision.micro_stamp) - julianday(date(temporal_precision.micro_stamp))) * 86400000) as integer) + 1000) / 2000 as integer) * 1000) / 1000.0) || ' seconds') as second, strftime('%H:%M:%f', '00:00:00', ((cast((2 * cast(round((julianday(col_matrix.m_time) - julianday(date(col_matrix.m_time))) * 86400000) as integer) + 1800000) / 3600000 as integer) * 1800000) / 1000.0) || ' seconds') as halfHour from temporal_precision inner join col_matrix on col_matrix.id = temporal_precision.id where temporal_precision.id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ second: Temporal.PlainDateTime; halfHour: Temporal.PlainTime }>>>()
        expect(rows.map(row => [row.second, row.halfHour].map(String))).toEqual([['2024-01-15T12:31:00', '09:30:00']])
    })
})
