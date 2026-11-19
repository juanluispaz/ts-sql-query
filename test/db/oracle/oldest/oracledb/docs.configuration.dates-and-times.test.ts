// Documentation snippets for the Dates and times page (docs/configuration/dates-and-times.md). The releases of the seed:
// 1.2.0 released on 2024-01-15 (a Monday) with its cutoff at 17:00, published on 2024-01-16 at 09:00; 1.3.0-beta.1 on
// 2024-02-20 (a Tuesday), 18:30, published on 2024-02-21 at 10:00; 0.9.0 on 2024-03-01 (a Friday), 16:00, published on
// 2024-03-02 at 11:00. Their rollouts took 1 day 12 hours, 45 minutes and 2 days.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:dates-and-times/temporal-values-in-a-query', async () => {
        ctx.mockNext([
            { version: '1.3.0-beta.1', releasedOn: '2024-02-20', cutoffTime: '18:30:00', publishedAt: '2024-02-21 10:00:00' },
            { version: '0.9.0', releasedOn: '2024-03-01', cutoffTime: '16:00:00', publishedAt: '2024-03-02 11:00:00' },
        ])
        const connection = ctx.conn

        // doc-start
        const releases = await connection.selectFrom(tRelease)
            .where(tRelease.releasedOn.greaterOrEqual(Temporal.PlainDate.from('2024-02-01')))
            .select({
                version: tRelease.version,
                releasedOn: tRelease.releasedOn,
                cutoffTime: tRelease.cutoffTime,
                publishedAt: tRelease.publishedAt,
            })
            .orderBy('releasedOn')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", to_char(released_on, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "releasedOn", to_char(cast(cutoff_time as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "cutoffTime", to_char(cast(published_at as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "publishedAt" from project_release where released_on >= to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') order by project_release.released_on"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-02-01",
          ]
        `)
        assertType<Exact<typeof releases, Array<{ version: string; releasedOn: Temporal.PlainDate; cutoffTime: Temporal.PlainTime; publishedAt: Temporal.PlainDateTime }>>>()
        expect(releases.map(release => [release.version, release.releasedOn.toString(), release.cutoffTime.toString(), release.publishedAt.toString()])).toEqual([
            ['1.3.0-beta.1', '2024-02-20', '18:30:00', '2024-02-21T10:00:00'],
            ['0.9.0', '2024-03-01', '16:00:00', '2024-03-02T11:00:00'],
        ])
    })

    test('docs:dates-and-times/the-parts-of-a-value', async () => {
        const expected = [
            { version: '1.2.0', month: 1, dayOfWeek: 1, publishedHour: 9 },
            { version: '1.3.0-beta.1', month: 2, dayOfWeek: 2, publishedHour: 10 },
            { version: '0.9.0', month: 3, dayOfWeek: 5, publishedHour: 11 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const releases = await connection.selectFrom(tRelease)
            .select({
                version: tRelease.version,
                month: tRelease.releasedOn.month(),
                dayOfWeek: tRelease.releasedOn.dayOfWeek(),
                publishedHour: tRelease.publishedAt.hour(),
            })
            .orderBy('version')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", extract(month from released_on) as "month", trunc(released_on) - trunc(released_on, 'IW') + 1 as "dayOfWeek", extract(hour from published_at) as "publishedHour" from project_release order by "version""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof releases, Array<{ version: string; month: number; dayOfWeek: number; publishedHour: number }>>>()
        expect([...releases].sort((a, b) => a.month - b.month)).toEqual(expected)
    })

    test('docs:dates-and-times/a-date-at-a-time', async () => {
        ctx.mockNext([
            { version: '1.2.0', deadline: '2024-01-15 17:00:00', publishedOn: '2024-01-16' },
            { version: '1.3.0-beta.1', deadline: '2024-02-20 18:30:00', publishedOn: '2024-02-21' },
            { version: '0.9.0', deadline: '2024-03-01 16:00:00', publishedOn: '2024-03-02' },
        ])
        const connection = ctx.conn

        // doc-start
        const deadline = tRelease.releasedOn.toPlainDateTime(tRelease.cutoffTime)
        const late = await connection.selectFrom(tRelease)
            .where(tRelease.publishedAt.greaterThan(deadline))
            .select({
                version: tRelease.version,
                deadline: deadline,
                publishedOn: tRelease.publishedAt.toPlainDate(),
            })
            .orderBy('deadline')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", to_char(cast(cast(released_on as timestamp(9)) + to_dsinterval('0 ' || to_char(cast(cutoff_time as timestamp(9)), 'HH24:MI:SS.FF9')) as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "deadline", to_char(trunc(published_at), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "publishedOn" from project_release where published_at > (cast(released_on as timestamp(9)) + to_dsinterval('0 ' || to_char(cast(cutoff_time as timestamp(9)), 'HH24:MI:SS.FF9'))) order by cast(project_release.released_on as timestamp(9)) + to_dsinterval('0 ' || to_char(cast(project_release.cutoff_time as timestamp(9)), 'HH24:MI:SS.FF9'))"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof late, Array<{ version: string; deadline: Temporal.PlainDateTime; publishedOn: Temporal.PlainDate }>>>()
        expect(late.map(release => [release.version, release.deadline.toString(), release.publishedOn.toString()])).toEqual([
            ['1.2.0', '2024-01-15T17:00:00', '2024-01-16'],
            ['1.3.0-beta.1', '2024-02-20T18:30:00', '2024-02-21'],
            ['0.9.0', '2024-03-01T16:00:00', '2024-03-02'],
        ])
    })

    test('docs:dates-and-times/the-current-date-and-time', async () => {
        ctx.mockNext({ today: '2024-05-06', now: '2024-05-06 10:11:12.345678' })
        const connection = ctx.conn

        // doc-start
        const { today, now } = await connection.selectFromNoTable()
            .select({
                today: connection.currentPlainDate(),
                now: connection.currentPlainDateTime(),
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(trunc(current_timestamp), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "today", to_char(cast(current_timestamp as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "now" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof today, Temporal.PlainDate>>()
        assertType<Exact<typeof now, Temporal.PlainDateTime>>()
        expect(today).toBeInstanceOf(Temporal.PlainDate)
        expect(now).toBeInstanceOf(Temporal.PlainDateTime)
    })

    test('docs:dates-and-times/durations-in-a-query', async () => {
        ctx.mockNext([
            { version: '0.9.0', rolloutTime: 'P2D' },
            { version: '1.2.0', rolloutTime: 'P1DT12H' },
            { version: '1.3.0-beta.1', rolloutTime: 'PT45M' },
        ])
        const connection = ctx.conn

        // doc-start
        const rollouts = await connection.selectFrom(tRelease)
            .select({
                version: tRelease.version,
                rolloutTime: tRelease.rolloutTime,
            })
            .orderBy('version')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", rollout_time as "rolloutTime" from project_release order by "version""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rollouts, Array<{ version: string; rolloutTime?: Temporal.Duration }>>>()
        expect(rollouts.map(release => [release.version, release.rolloutTime?.toString()])).toEqual([
            ['0.9.0', 'P2D'],
            ['1.2.0', 'P1DT12H'],
            ['1.3.0-beta.1', 'PT45M'],
        ])
    })

    test('docs:dates-and-times/durations-compared-for-equality', async () => {
        ctx.mockNext([{ version: '1.3.0-beta.1' }])
        const connection = ctx.conn

        // doc-start
        const quick = await connection.selectFrom(tRelease)
            .where(tRelease.rolloutTime.equals(Temporal.Duration.from({ minutes: 45 })))
            .select({ version: tRelease.version })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version" from project_release where rollout_time = to_dsinterval(:0)"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "PT45M",
          ]
        `)
        assertType<Exact<typeof quick, Array<{ version: string }>>>()
        expect(quick).toEqual([{ version: '1.3.0-beta.1' }])
    })

    test('docs:dates-and-times/adding-and-subtracting-a-duration', async () => {
        ctx.mockNext([
            { version: '0.9.0', supportEndsOn: '2025-09-01', rolloutEndedAt: '2024-03-04 11:00:00' },
            { version: '1.2.0', supportEndsOn: '2025-07-15', rolloutEndedAt: '2024-01-17 21:00:00' },
            { version: '1.3.0-beta.1', supportEndsOn: '2025-08-20', rolloutEndedAt: '2024-02-21 10:45:00' },
        ])
        const connection = ctx.conn

        // doc-start
        const releases = await connection.selectFrom(tRelease)
            .select({
                version: tRelease.version,
                supportEndsOn: tRelease.releasedOn.add({ months: 18 }),
                rolloutEndedAt: tRelease.publishedAt.add(tRelease.rolloutTime),
            })
            .orderBy('version')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", to_char((add_months(released_on, :0) - greatest(0, extract(day from add_months(released_on, :0)) - extract(day from released_on))), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "supportEndsOn", to_char(cast(published_at + rollout_time as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "rolloutEndedAt" from project_release order by "version""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "18",
          ]
        `)
        assertType<Exact<typeof releases, Array<{ version: string; supportEndsOn: Temporal.PlainDate; rolloutEndedAt?: Temporal.PlainDateTime }>>>()
        expect(releases.map(release => [release.version, release.supportEndsOn.toString(), release.rolloutEndedAt?.toString()])).toEqual([
            ['0.9.0', '2025-09-01', '2024-03-04T11:00:00'],
            ['1.2.0', '2025-07-15', '2024-01-17T21:00:00'],
            ['1.3.0-beta.1', '2025-08-20', '2024-02-21T10:45:00'],
        ])
    })
})
