// Durations (Temporal.Duration): duration_value 1 is 3 days 04:05:06.789 (span_calendar 1 year 2 months), 2 is
// -1 day -2 hours, 3 is 1 hour 30 minutes; span_text keeps the ISO 8601 text P1Y2M3DT4H5M6.789S, -PT26H and PT90M.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tDurationValue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('durations-are-read-as-temporal-durations', async () => {
        ctx.mockNext([
            { id: 1, span: '3 days 04:05:06.789', spanCalendar: '1 year 2 mons', spanText: 'P1Y2M3DT4H5M6.789S' },
            { id: 2, span: '-1 days -02:00:00', spanText: '-PT26H' },
            { id: 3, span: '01:30:00', spanText: 'PT90M' },
        ])
        const rows = await ctx.conn.selectFrom(tDurationValue)
            .select({
                id: tDurationValue.id,
                span: tDurationValue.span,
                spanCalendar: tDurationValue.spanCalendar,
                spanText: tDurationValue.spanText,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, span as span, span_calendar as spanCalendar, span_text as spanText from duration_value order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; span: Temporal.Duration; spanCalendar?: Temporal.Duration; spanText?: Temporal.Duration }>>>()
        // A text keeps the duration as it was written
        expect(rows.map(row => [row.id, row.span.toString(), row.spanCalendar?.toString(), row.spanText?.toString()])).toEqual([
            [1, 'P3DT4H5M6.789S', 'P1Y2M', 'P1Y2M3DT4H5M6.789S'],
            [2, '-P1DT2H', undefined, '-PT26H'],
            [3, 'PT1H30M', undefined, 'PT90M'],
        ])
        expect(rows[0]!.span).toBeInstanceOf(Temporal.Duration)
    })

    test('a-duration-is-stored-with-what-the-column-keeps', async () => {
        // It keeps every digit of the fraction of a second
        await ctx.conn.insertInto(tDurationValue)
            .values({
                id: 4,
                span: Temporal.Duration.from('-P2DT3H4M5.123456789S'),
                spanCalendar: Temporal.Duration.from('P2Y'),
                spanText: Temporal.Duration.from('P1Y1WT0.000000001S'),
            })
            .executeInsert()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into duration_value (id, span, span_calendar, span_text) values (?1, ?2, ?3, ?4)"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "4",
            "-P2DT3H4M5.123456789S",
            "P2Y",
            "P1Y1WT0.000000001S",
          ]
        `)
        ctx.mockNext([{ span: '-P2DT3H4M5.123456789S', spanCalendar: 'P2Y', spanText: 'P1Y1WT0.000000001S' }])
        const rows = await ctx.conn.selectFrom(tDurationValue)
            .where(tDurationValue.id.equals(4))
            .select({ span: tDurationValue.span, spanCalendar: tDurationValue.spanCalendar, spanText: tDurationValue.spanText })
            .executeSelectMany()
        expect(rows.map(row => [row.span.toString(), row.spanCalendar?.toString(), row.spanText?.toString()])).toEqual([['-P2DT3H4M5.123456789S', 'P2Y', 'P1Y1WT0.000000001S']])
    })

    test('durations-are-returned-by-a-delete', async () => {
        ctx.mockNext({ span: '3 days 04:05:06.789', spanCalendar: '1 year 2 mons', spanText: 'P1Y2M3DT4H5M6.789S' })
        await ctx.withRollback(async () => {
            const removed = await ctx.conn.deleteFrom(tDurationValue)
                .where(tDurationValue.id.equals(1))
                .returning({ span: tDurationValue.span, spanCalendar: tDurationValue.spanCalendar, spanText: tDurationValue.spanText })
                .executeDeleteOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from duration_value where id = ?1 returning span as span, span_calendar as spanCalendar, span_text as spanText"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof removed, { span: Temporal.Duration; spanCalendar?: Temporal.Duration; spanText?: Temporal.Duration }>>()
            expect([removed.span.toString(), removed.spanCalendar?.toString(), removed.spanText?.toString()]).toEqual(['P3DT4H5M6.789S', 'P1Y2M', 'P1Y2M3DT4H5M6.789S'])
        })
    })

    test('durations-are-compared-for-equality', async () => {
        // A text is compared as written: PT90M is found, PT1H30M isn't
        ctx.mockNext([{ id: 3 }])
        const rows = await ctx.conn.selectFrom(tDurationValue)
            .where(tDurationValue.span.equals(Temporal.Duration.from('PT1H30M')))
            .and(tDurationValue.spanText.equals(Temporal.Duration.from('PT90M')))
            .select({ id: tDurationValue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from duration_value where span = ?1 and span_text = ?2"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "PT1H30M",
            "PT90M",
          ]
        `)
        expect(rows).toEqual([{ id: 3 }])
        ctx.mockNext([])
        const none = await ctx.conn.selectFrom(tDurationValue)
            .where(tDurationValue.spanText.equals(Temporal.Duration.from('PT1H30M')))
            .select({ id: tDurationValue.id })
            .executeSelectMany()
        expect(none).toEqual([])
    })

})
