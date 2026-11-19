// Durations (Temporal.Duration): duration_value 1 is 3 days 04:05:06.789 (span_calendar 1 year 2 months), 2 is
// -1 day -2 hours, 3 is 1 hour 30 minutes; span_micros keeps each one as its microseconds.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'
import { tDurationValue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('durations-are-read-as-temporal-durations', async () => {
        ctx.mockNext([
            { id: 1, span: '3 days 04:05:06.789', spanCalendar: '1 year 2 mons', spanMicros: '273906789000' },
            { id: 2, span: '-1 days -02:00:00', spanMicros: '-93600000000' },
            { id: 3, span: '01:30:00', spanMicros: '5400000000' },
        ])
        const rows = await ctx.conn.selectFrom(tDurationValue)
            .select({
                id: tDurationValue.id,
                span: tDurationValue.span,
                spanCalendar: tDurationValue.spanCalendar,
                spanMicros: tDurationValue.spanMicros,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, span as span, span_calendar as "spanCalendar", span_micros as "spanMicros" from duration_value order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; span: Temporal.Duration; spanCalendar?: Temporal.Duration; spanMicros?: Temporal.Duration }>>>()
        // A number of microseconds comes back balanced up to hours
        expect(rows.map(row => [row.id, row.span.toString(), row.spanCalendar?.toString(), row.spanMicros?.toString()])).toEqual([
            [1, 'P3DT4H5M6.789S', 'P1Y2M', 'PT76H5M6.789S'],
            [2, '-P1DT2H', undefined, '-PT26H'],
            [3, 'PT1H30M', undefined, 'PT1H30M'],
        ])
        expect(rows[0]!.span).toBeInstanceOf(Temporal.Duration)
    })

    test('a-duration-is-stored-with-what-the-column-keeps', async () => {
        // An interval keeps microseconds: PostgreSQL rounds the nanoseconds; a week is kept as 7 days
        await ctx.conn.insertInto(tDurationValue)
            .values({
                id: 4,
                span: Temporal.Duration.from('-P2DT3H4M5.123456789S'),
                spanCalendar: Temporal.Duration.from('P2Y'),
                spanMicros: Temporal.Duration.from('P1W'),
            })
            .executeInsert()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into duration_value (id, span, span_calendar, span_micros) values ($1, $2, $3, $4)"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "4",
            "-P2DT3H4M5.123456789S",
            "P2Y",
            "604800000000",
          ]
        `)
        ctx.mockNext([{ span: '-2 days -03:04:05.123457', spanCalendar: '2 years', spanMicros: '604800000000' }])
        const rows = await ctx.conn.selectFrom(tDurationValue)
            .where(tDurationValue.id.equals(4))
            .select({ span: tDurationValue.span, spanCalendar: tDurationValue.spanCalendar, spanMicros: tDurationValue.spanMicros })
            .executeSelectMany()
        expect(rows.map(row => [row.span.toString(), row.spanCalendar?.toString(), row.spanMicros?.toString()])).toEqual([['-P2DT3H4M5.123457S', 'P2Y', 'PT168H']])
    })

    test('durations-are-compared-for-equality', async () => {
        ctx.mockNext([{ id: 3 }])
        const rows = await ctx.conn.selectFrom(tDurationValue)
            .where(tDurationValue.span.equals(Temporal.Duration.from('PT1H30M')))
            .and(tDurationValue.spanMicros.equals(Temporal.Duration.from('PT90M')))
            .select({ id: tDurationValue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from duration_value where span = $1 and span_micros = $2"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "PT1H30M",
            "5400000000",
          ]
        `)
        expect(rows).toEqual([{ id: 3 }])
    })

    test('a-duration-with-months-is-not-kept-as-microseconds', async () => {
        // A month has no fixed number of microseconds
        let reason = 'no error'
        try {
            await ctx.conn.update(tDurationValue)
                .set({ spanMicros: Temporal.Duration.from('P1M') })
                .where(tDurationValue.id.equals(3))
                .executeUpdate()
        } catch (error) {
            reason = error instanceof TsSqlError ? error.errorReason.reason : String(error)
        }
        expect(reason).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })
})
