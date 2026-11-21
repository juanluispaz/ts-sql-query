// Durations added and subtracted together, as Temporal's add and subtract: a day is 24 hours, the sum is balanced up to
// the largest field of the two, and a duration with years, months or weeks fails the query. Every expected value is the
// one Temporal gives. duration_value: span is 1 3 days 04:05:06.789, 2 -1 day -2 hours, 3 01:30; span_text is the ISO
// 8601 text P1Y2M3DT4H5M6.789S, -PT26H and PT90M. project_release: rollout_time 1 day 12:00:00, 00:45:00 and 2 days,
// for the versions 1.2.0, 1.3.0-beta.1 and 0.9.0.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'
import { tDurationValue, tRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

async function rejectionOf(query: Promise<unknown>): Promise<boolean> {
    try {
        await query
        return false
    } catch (error) {
        return error instanceof TsSqlError
    }
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('a-duration-plus-and-minus-a-duration-given', async () => {
        ctx.mockNext([
            { version: '0.9.0', later: '2 days 12:00:00', earlier: '1 day' },
            { version: '1.2.0', later: '2 days', earlier: '12:00:00' },
            { version: '1.3.0-beta.1', later: '12:45:00', earlier: '-23:15:00' },
        ])
        const rows = await ctx.conn.selectFrom(tRelease)
            .select({
                version: tRelease.version,
                later: tRelease.rolloutTime.add(Temporal.Duration.from('PT12H')),
                earlier: tRelease.rolloutTime.subtract({ days: 1 }),
            })
            .orderBy('version')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, dbo.tsq_duration_add(dbo.tsq_duration_part(rollout_time, 'largest'), dbo.tsq_duration_part(rollout_time, 'days'), dbo.tsq_duration_part(rollout_time, 'S'), dbo.tsq_duration_part(rollout_time, 'N'), 4, 0, 43200, 0, 1) as later, dbo.tsq_duration_add(dbo.tsq_duration_part(rollout_time, 'largest'), dbo.tsq_duration_part(rollout_time, 'days'), dbo.tsq_duration_part(rollout_time, 'S'), dbo.tsq_duration_part(rollout_time, 'N'), 3, 1, 0, 0, -1) as earlier from project_release order by version"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<(typeof rows)[number]['later'], Temporal.Duration | undefined>>()
        expect(rows.map(row => [row.version, row.later?.toString(), row.earlier?.toString()])).toEqual([
            ['0.9.0', 'P2DT12H', 'P1D'],
            ['1.2.0', 'P2D', 'PT12H'],
            ['1.3.0-beta.1', 'PT12H45M', '-PT23H15M'],
        ])
    })

    test('a-duration-plus-and-minus-another-of-the-database', async () => {
        ctx.mockNext([
            { id: 1, twice: '6 days 08:10:13.578', none: '00:00:00' },
            { id: 2, twice: '-2 days -04:00:00', none: '00:00:00' },
            { id: 3, twice: '03:00:00', none: '00:00:00' },
        ])
        const rows = await ctx.conn.selectFrom(tDurationValue)
            .select({
                id: tDurationValue.id,
                twice: tDurationValue.span.add(tDurationValue.span),
                none: tDurationValue.span.subtract(tDurationValue.span),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, dbo.tsq_duration_add(dbo.tsq_duration_part(span, 'largest'), dbo.tsq_duration_part(span, 'days'), dbo.tsq_duration_part(span, 'S'), dbo.tsq_duration_part(span, 'N'), dbo.tsq_duration_part(span, 'largest'), dbo.tsq_duration_part(span, 'days'), dbo.tsq_duration_part(span, 'S'), dbo.tsq_duration_part(span, 'N'), 1) as twice, dbo.tsq_duration_add(dbo.tsq_duration_part(span, 'largest'), dbo.tsq_duration_part(span, 'days'), dbo.tsq_duration_part(span, 'S'), dbo.tsq_duration_part(span, 'N'), dbo.tsq_duration_part(span, 'largest'), dbo.tsq_duration_part(span, 'days'), dbo.tsq_duration_part(span, 'S'), dbo.tsq_duration_part(span, 'N'), -1) as none from duration_value order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<(typeof rows)[number]['twice'], Temporal.Duration>>()
        expect(rows.map(row => [row.id, row.twice.toString(), row.none.toString()])).toEqual([
            [1, 'P6DT8H10M13.578S', 'PT0S'],
            [2, '-P2DT4H', 'PT0S'],
            [3, 'PT3H', 'PT0S'],
        ])
    })

    test('the-sum-is-balanced-up-to-the-largest-field-of-the-two', async () => {
        // -PT26H and PT90M plus PT1H are in hours; PT90M plus PT30M in minutes
        ctx.mockNext([
            { id: 2, plusAnHour: '-25:00:00', minusAnHour: '-27:00:00', plusHalfAnHour: '-25:30:00' },
            { id: 3, plusAnHour: '02:30:00', minusAnHour: '00:30:00', plusHalfAnHour: 'PT120M' },
        ])
        const rows = await ctx.conn.selectFrom(tDurationValue)
            .where(tDurationValue.id.greaterThan(1))
            .select({
                id: tDurationValue.id,
                plusAnHour: tDurationValue.spanText.add({ hours: 1 }),
                minusAnHour: tDurationValue.spanText.subtract({ hours: 1 }),
                plusHalfAnHour: tDurationValue.spanText.add({ minutes: 30 }),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, dbo.tsq_duration_add(dbo.tsq_duration_part(span_text, 'largest'), dbo.tsq_duration_part(span_text, 'days'), dbo.tsq_duration_part(span_text, 'S'), dbo.tsq_duration_part(span_text, 'N'), 4, 0, 3600, 0, 1) as plusAnHour, dbo.tsq_duration_add(dbo.tsq_duration_part(span_text, 'largest'), dbo.tsq_duration_part(span_text, 'days'), dbo.tsq_duration_part(span_text, 'S'), dbo.tsq_duration_part(span_text, 'N'), 4, 0, 3600, 0, -1) as minusAnHour, dbo.tsq_duration_add(dbo.tsq_duration_part(span_text, 'largest'), dbo.tsq_duration_part(span_text, 'days'), dbo.tsq_duration_part(span_text, 'S'), dbo.tsq_duration_part(span_text, 'N'), 5, 0, 1800, 0, 1) as plusHalfAnHour from duration_value where id > @0 order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1",
          ]
        `)
        expect(rows.map(row => [row.id, row.plusAnHour?.toString(), row.minusAnHour?.toString(), row.plusHalfAnHour?.toString()])).toEqual([
            [2, '-PT25H', '-PT27H', '-PT25H30M'],
            [3, 'PT2H30M', 'PT30M', 'PT120M'],
        ])
    })

    test('a-duration-with-months-fails-the-query', async () => {
        // P1Y2M3DT4H5M6.789S has years and months: Temporal can't add it
        ctx.mockNext([{ id: 1, later: 'P1Y2M3DT5H5M6.789S' }])
        const rejected = await rejectionOf(ctx.conn.selectFrom(tDurationValue)
            .where(tDurationValue.id.equals(1))
            .select({ id: tDurationValue.id, later: tDurationValue.spanText.add({ hours: 1 }) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, dbo.tsq_duration_add(dbo.tsq_duration_part(span_text, 'largest'), dbo.tsq_duration_part(span_text, 'days'), dbo.tsq_duration_part(span_text, 'S'), dbo.tsq_duration_part(span_text, 'N'), 4, 0, 3600, 0, 1) as later from duration_value where id = @0"`)
        expect(rejected).toBe(ctx.realDbEnabled)
        ctx.mockNext([{ later: '1 day' }])
        const rejectedValue = await rejectionOf(ctx.conn.selectFrom(tRelease)
            .where(tRelease.id.equals(3))
            .select({ later: tRelease.rolloutTime.add({ months: 1 }) })
            .executeSelectMany())
        expect(rejectedValue).toBe(ctx.realDbEnabled)
    })

    test('a-difference-plus-a-duration', async () => {
        // 2024-01-31 until 2024-03-30 is P59D
        ctx.mockNext({ later: '59 days 12:00:00' })
        const january31 = ctx.conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate')
        const row = await ctx.conn.selectFromNoTable()
            .select({ later: january31.until(Temporal.PlainDate.from('2024-03-30')).add({ hours: 12 }) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dbo.tsq_duration_add(dbo.tsq_duration_part(dbo.tsq_duration_text(0, 0, 0, datediff(day, @1, @0), 0, 'day'), 'largest'), dbo.tsq_duration_part(dbo.tsq_duration_text(0, 0, 0, datediff(day, @3, @2), 0, 'day'), 'days'), dbo.tsq_duration_part(dbo.tsq_duration_text(0, 0, 0, datediff(day, @5, @4), 0, 'day'), 'S'), dbo.tsq_duration_part(dbo.tsq_duration_text(0, 0, 0, datediff(day, @7, @6), 0, 'day'), 'N'), 4, 0, 43200, 0, 1) as later"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
          ]
        `)
        assertType<Exact<typeof row, { later: Temporal.Duration }>>()
        expect(row.later.toString()).toBe('P59DT12H')
    })
})
