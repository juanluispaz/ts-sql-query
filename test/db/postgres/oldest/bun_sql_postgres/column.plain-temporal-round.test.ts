// Times and dates and times without zone rounded, with the semantics of Temporal's round. temporal_precision row 1 has
// 2024-01-15 12:30:59.9996; col_matrix row 1 has the time 09:15:00.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tColMatrixPlain, tTemporalPrecisionPlain } from '../../domain/connection.js'
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select time '00:00' + make_interval(secs => (((2 * (round(extract(epoch from cast($1::time as time)) * 1000000)::bigint * 1000) + 60000000000) / 120000000000) * 60000000000) / 1000000000.0) as "halfUp", time '00:00' + make_interval(secs => (((2 * (round(extract(epoch from cast($2::time as time)) * 1000000)::bigint * 1000) + 1000000000) / 2000000000) * 1000000000) / 1000000000.0) as midnight, time '00:00' + make_interval(secs => (((2 * (round(extract(epoch from cast($3::time as time)) * 1000000)::bigint * 1000) + 60000000000) / 120000000000) * 60000000000) / 1000000000.0) as down, time '00:00' + make_interval(secs => (((2 * (round(extract(epoch from cast($4::time as time)) * 1000000)::bigint * 1000) + 1000000) / 2000000) * 1000000) / 1000000000.0) as same"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select time '00:00' + make_interval(secs => (((2 * (round(extract(epoch from cast($1::time as time)) * 1000000)::bigint * 1000) + 900000000000) / 1800000000000) * 900000000000) / 1000000000.0) as quarter, time '00:00' + make_interval(secs => (((2 * (round(extract(epoch from cast($2::time as time)) * 1000000)::bigint * 1000) + 899999999999) / 1800000000000) * 900000000000) / 1000000000.0) as "halfTrunc", time '00:00' + make_interval(secs => ((((round(extract(epoch from cast($3::time as time)) * 1000000)::bigint * 1000) / 900000000000) + case when 2 * ((round(extract(epoch from cast($4::time as time)) * 1000000)::bigint * 1000) - ((round(extract(epoch from cast($5::time as time)) * 1000000)::bigint * 1000) / 900000000000) * 900000000000) > 900000000000 or (2 * ((round(extract(epoch from cast($6::time as time)) * 1000000)::bigint * 1000) - ((round(extract(epoch from cast($7::time as time)) * 1000000)::bigint * 1000) / 900000000000) * 900000000000) = 900000000000 and ((round(extract(epoch from cast($8::time as time)) * 1000000)::bigint * 1000) / 900000000000) % 2 = 1) then 1 else 0 end) * 900000000000) / 1000000000.0) as "halfEvenDown", time '00:00' + make_interval(secs => ((((round(extract(epoch from cast($9::time as time)) * 1000000)::bigint * 1000) / 900000000000) + case when 2 * ((round(extract(epoch from cast($10::time as time)) * 1000000)::bigint * 1000) - ((round(extract(epoch from cast($11::time as time)) * 1000000)::bigint * 1000) / 900000000000) * 900000000000) > 900000000000 or (2 * ((round(extract(epoch from cast($12::time as time)) * 1000000)::bigint * 1000) - ((round(extract(epoch from cast($13::time as time)) * 1000000)::bigint * 1000) / 900000000000) * 900000000000) = 900000000000 and ((round(extract(epoch from cast($14::time as time)) * 1000000)::bigint * 1000) / 900000000000) % 2 = 1) then 1 else 0 end) * 900000000000) / 1000000000.0) as "halfEvenUp", time '00:00' + make_interval(secs => ((((round(extract(epoch from cast($15::time as time)) * 1000000)::bigint * 1000) + 3599999999999) / 3600000000000) * 3600000000000) / 1000000000.0) as ceil, time '00:00' + make_interval(secs => (((round(extract(epoch from cast($16::time as time)) * 1000000)::bigint * 1000) / 3600000000000) * 3600000000000) / 1000000000.0) as floor, time '00:00' + make_interval(secs => ((((round(extract(epoch from cast($17::time as time)) * 1000000)::bigint * 1000) + 999999999) / 1000000000) * 1000000000) / 1000000000.0) as expand"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "10:07:30",
            "10:07:30",
            "10:07:30",
            "10:07:30",
            "10:07:30",
            "10:07:30",
            "10:07:30",
            "10:07:30",
            "10:22:30",
            "10:22:30",
            "10:22:30",
            "10:22:30",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast($1::timestamp as date) + make_interval(secs => (((2 * (round(extract(epoch from cast($2::timestamp as time)) * 1000000)::bigint * 1000) + 1000000000) / 2000000000) * 1000000000) / 1000000000.0) as "nextDay", cast($3::timestamp as date) + make_interval(secs => (((2 * (round(extract(epoch from cast($4::timestamp as time)) * 1000000)::bigint * 1000) + 86400000000000) / 172800000000000) * 86400000000000) / 1000000000.0) as "toDay", cast($5::timestamp as date) + make_interval(secs => (((2 * (round(extract(epoch from cast($6::timestamp as time)) * 1000000)::bigint * 1000) + 86400000000000) / 172800000000000) * 86400000000000) / 1000000000.0) as "sameDay", cast($7::timestamp as date) + make_interval(secs => (((round(extract(epoch from cast($8::timestamp as time)) * 1000000)::bigint * 1000) / 21600000000000) * 21600000000000) / 1000000000.0) as "sixHours""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(temporal_precision.micro_stamp as date) + make_interval(secs => (((2 * (round(extract(epoch from cast(temporal_precision.micro_stamp as time)) * 1000000)::bigint * 1000) + 1000000000) / 2000000000) * 1000000000) / 1000000000.0) as second, time '00:00' + make_interval(secs => (((2 * (round(extract(epoch from cast(col_matrix.m_time as time)) * 1000000)::bigint * 1000) + 1800000000000) / 3600000000000) * 1800000000000) / 1000000000.0) as "halfHour" from temporal_precision inner join col_matrix on col_matrix.id = temporal_precision.id where temporal_precision.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ second: Temporal.PlainDateTime; halfHour: Temporal.PlainTime }>>>()
        expect(rows.map(row => [row.second, row.halfHour].map(String))).toEqual([['2024-01-15T12:31:00', '09:30:00']])
    })
})
