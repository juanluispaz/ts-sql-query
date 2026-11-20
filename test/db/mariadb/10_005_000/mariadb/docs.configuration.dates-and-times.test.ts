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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, released_on as releasedOn, cutoff_time as cutoffTime, published_at as publishedAt from project_release where released_on >= ? order by releasedOn"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, month(released_on) as month, weekday(released_on) + 1 as dayOfWeek, hour(published_at) as publishedHour from project_release order by version"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, timestamp(released_on, cutoff_time) as deadline, date(published_at) as publishedOn from project_release where published_at > timestamp(released_on, cutoff_time) order by deadline"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select current_date as today, current_timestamp as \`now\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof today, Temporal.PlainDate>>()
        assertType<Exact<typeof now, Temporal.PlainDateTime>>()
        expect(today).toBeInstanceOf(Temporal.PlainDate)
        expect(now).toBeInstanceOf(Temporal.PlainDateTime)
    })

    test('docs:dates-and-times/instants-in-a-query', async () => {
        ctx.mockNext([
            { version: '1.2.0', deployedAt: '2024-01-16 09:30:15.123456' },
            { version: '0.9.0', deployedAt: '2024-03-02 11:05:00' },
        ])
        const connection = ctx.conn

        // doc-start
        const deployments = await connection.selectFrom(tRelease)
            .where(tRelease.deployedAt.greaterOrEqual(Temporal.Instant.from('2024-01-16T10:30:15+01:00')))
            .select({
                version: tRelease.version,
                deployedAt: tRelease.deployedAt,
            })
            .orderBy('deployedAt')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, deployed_at as deployedAt from project_release where deployed_at >= ? order by deployedAt"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-16T09:30:15Z",
          ]
        `)
        assertType<Exact<typeof deployments, Array<{ version: string; deployedAt?: Temporal.Instant }>>>()
        expect(deployments.map(release => [release.version, release.deployedAt?.toString()])).toEqual([
            ['1.2.0', '2024-01-16T09:30:15.123456Z'],
            ['0.9.0', '2024-03-02T11:05:00Z'],
        ])
    })

    test('docs:dates-and-times/the-epoch-and-the-date-of-an-instant', async () => {
        ctx.mockNext([
            { version: '0.9.0', deployedOn: '2024-03-02', deployedMs: 1709377500000, published: '2024-03-02 11:00:00' },
            { version: '1.2.0', deployedOn: '2024-01-16', deployedMs: 1705397415123, published: '2024-01-16 09:00:00' },
        ])
        const connection = ctx.conn

        // doc-start
        const deployments = await connection.selectFrom(tRelease)
            .where(tRelease.deployedAt.isNotNull())
            .select({
                version: tRelease.version,
                deployedOn: tRelease.deployedAt.toPlainDate(),
                deployedMs: tRelease.deployedAt.epochMilliseconds(),
                published: tRelease.publishedAt.toInstant(),
            })
            .orderBy('version')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, date(deployed_at) as deployedOn, floor(timestampdiff(microsecond, '1970-01-01 00:00:00', deployed_at) / 1000) as deployedMs, published_at as published from project_release where deployed_at is not null order by version"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof deployments, Array<{ version: string; deployedOn?: Temporal.PlainDate; deployedMs?: number; published: Temporal.Instant }>>>()
        const first = Temporal.Instant.from('2024-03-02T11:05:00Z')
        const second = Temporal.Instant.from('2024-01-16T09:30:15.123456Z')
        expect(deployments.map(release => [release.version, release.deployedOn?.toString(), release.deployedMs, release.published.toString()])).toEqual([
            ['0.9.0', first.toZonedDateTimeISO('UTC').toPlainDate().toString(), first.epochMilliseconds, '2024-03-02T11:00:00Z'],
            ['1.2.0', second.toZonedDateTimeISO('UTC').toPlainDate().toString(), second.epochMilliseconds, '2024-01-16T09:00:00Z'],
        ])
    })

    test('docs:dates-and-times/the-current-instant', async () => {
        ctx.mockNext('2024-05-06 10:11:12.345678')
        const connection = ctx.conn

        // doc-start
        const now = await connection.selectFromNoTable()
            .selectOneColumn(connection.currentInstant())
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select utc_timestamp(6) as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof now, Temporal.Instant>>()
        expect(now).toBeInstanceOf(Temporal.Instant)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, rollout_time as rolloutTime from project_release order by version"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version from project_release where rollout_time = ?"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "PT45M",
          ]
        `)
        assertType<Exact<typeof quick, Array<{ version: string }>>>()
        expect(quick).toEqual([{ version: '1.3.0-beta.1' }])
    })

    test('docs:dates-and-times/the-fields-of-a-duration', async () => {
        ctx.mockNext([
            { version: '0.9.0', days: 2, hours: 0, minutes: 0, sign: 1, back: '-P2D' },
            { version: '1.2.0', days: 1, hours: 12, minutes: 0, sign: 1, back: '-P1DT12H' },
            { version: '1.3.0-beta.1', days: 0, hours: 0, minutes: 45, sign: 1, back: '-PT45M' },
        ])
        const connection = ctx.conn

        // doc-start
        const releases = await connection.selectFrom(tRelease)
            .select({
                version: tRelease.version,
                days: tRelease.rolloutTime.days(),
                hours: tRelease.rolloutTime.hours(),
                minutes: tRelease.rolloutTime.minutes(),
                sign: tRelease.rolloutTime.sign(),
                back: tRelease.rolloutTime.negated(),
            })
            .orderBy('version')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, tsq_duration_part(rollout_time, 'days') as days, tsq_duration_part(rollout_time, 'hours') as hours, tsq_duration_part(rollout_time, 'minutes') as minutes, tsq_duration_part(rollout_time, 'sign') as sign, case when substr(rollout_time, 1, 1) = '-' then substr(rollout_time, 2) when tsq_duration_part(rollout_time, 'sign') = 0 then rollout_time when substr(rollout_time, 1, 1) = '+' then concat('-', substr(rollout_time, 2)) else concat('-', rollout_time) end as back from project_release order by version"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof releases, Array<{ version: string; days?: number; hours?: number; minutes?: number; sign?: number; back?: Temporal.Duration }>>>()
        expect(releases.map(release => [release.version, release.days, release.hours, release.minutes, release.sign, release.back?.toString()])).toEqual([
            ['0.9.0', 2, 0, 0, 1, '-P2D'],
            ['1.2.0', 1, 12, 0, 1, '-P1DT12H'],
            ['1.3.0-beta.1', 0, 0, 45, 1, '-PT45M'],
        ])
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, date_add(released_on, interval ? month) as supportEndsOn, date_add(date_add(date_add(published_at, interval tsq_duration_part(rollout_time, 'M') month), interval tsq_duration_part(rollout_time, 'D') day), interval (tsq_duration_part(rollout_time, 'S') * 1000000 + tsq_duration_part(rollout_time, 'N') div 1000) microsecond) as rolloutEndedAt from project_release order by version"`)
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

    test('docs:dates-and-times/the-duration-between-two-values', async () => {
        ctx.mockNext([
            { version: '0.9.0', toPublication: 'P1D', publishedAfter: 'PT35H', untilEndOfJune: 'P3M29D' },
            { version: '1.2.0', toPublication: 'P1D', publishedAfter: 'PT33H', untilEndOfJune: 'P5M15D' },
            { version: '1.3.0-beta.1', toPublication: 'P1D', publishedAfter: 'PT34H', untilEndOfJune: 'P4M10D' },
        ])
        const connection = ctx.conn

        // doc-start
        const releases = await connection.selectFrom(tRelease)
            .select({
                version: tRelease.version,
                toPublication: tRelease.releasedOn.until(tRelease.publishedAt.toPlainDate()),
                publishedAfter: tRelease.publishedAt.since(tRelease.releasedOn.toPlainDateTime(), { largestUnit: 'hour' }),
                untilEndOfJune: tRelease.releasedOn.until(Temporal.PlainDate.from('2024-06-30'), { largestUnit: 'month' }),
            })
            .orderBy('version')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, tsq_duration_text(0, 0, 0, datediff(date(published_at), released_on), 0, 'hour') as toPublication, tsq_duration_text(0, 0, 0, 0, -(datediff(date(timestamp(released_on)), date(published_at)) * 86400000000000 + ((floor(time_to_sec(timestamp(released_on))) * 1000000 + microsecond(timestamp(released_on))) * 1000 - (floor(time_to_sec(published_at)) * 1000000 + microsecond(published_at)) * 1000)), 'hour') as publishedAfter, tsq_duration_text(0, ((cast(year(?) as signed) * 12 + cast(month(?) as signed)) * 32 + cast(dayofmonth(?) as signed) - (cast(year(released_on) as signed) * 12 + cast(month(released_on) as signed)) * 32 - cast(dayofmonth(released_on) as signed)) div 32, 0, datediff(?, date_add(released_on, interval ((cast(year(?) as signed) * 12 + cast(month(?) as signed)) * 32 + cast(dayofmonth(?) as signed) - (cast(year(released_on) as signed) * 12 + cast(month(released_on) as signed)) * 32 - cast(dayofmonth(released_on) as signed)) div 32 month)), 0, 'hour') as untilEndOfJune from project_release order by version"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-06-30",
            "2024-06-30",
            "2024-06-30",
            "2024-06-30",
            "2024-06-30",
            "2024-06-30",
            "2024-06-30",
          ]
        `)
        assertType<Exact<typeof releases, Array<{ version: string; toPublication: Temporal.Duration; publishedAfter: Temporal.Duration; untilEndOfJune: Temporal.Duration }>>>()
        expect(releases.map(release => [release.version, release.toPublication.toString(), release.publishedAfter.toString(), release.untilEndOfJune.toString()])).toEqual([
            ['0.9.0', 'P1D', 'PT35H', 'P3M29D'],
            ['1.2.0', 'P1D', 'PT33H', 'P5M15D'],
            ['1.3.0-beta.1', 'P1D', 'PT34H', 'P4M10D'],
        ])
    })

    test('docs:dates-and-times/the-total-of-a-duration', async () => {
        ctx.mockNext([
            { version: '0.9.0', hours: 48, months: 0.06451612903225806, daysToPublication: 1.4583333333333333 },
            { version: '1.2.0', hours: 36, months: 0.04838709677419355, daysToPublication: 1.375 },
            { version: '1.3.0-beta.1', hours: 0.75, months: 0.0010775862068965517, daysToPublication: 1.4166666666666667 },
        ])
        const connection = ctx.conn

        // doc-start
        const releases = await connection.selectFrom(tRelease)
            .select({
                version: tRelease.version,
                hours: tRelease.rolloutTime.total('hours'),
                months: tRelease.rolloutTime.total({ unit: 'month', relativeTo: tRelease.releasedOn }),
                daysToPublication: tRelease.publishedAt.since(tRelease.releasedOn.toPlainDateTime()).total('days'),
            })
            .orderBy('version')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, tsq_duration_total(tsq_duration_part(rollout_time, 'M'), tsq_duration_part(rollout_time, 'weeks'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), 0, 0, 0, 'hour') as hours, tsq_duration_total(tsq_duration_part(rollout_time, 'M'), tsq_duration_part(rollout_time, 'weeks'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), cast(year(released_on) as signed), cast(month(released_on) as signed), cast(dayofmonth(released_on) as signed), 'month') as months, tsq_duration_total(0, 0, -(datediff(date(timestamp(released_on)), date(published_at)) * 86400000000000 + ((floor(time_to_sec(timestamp(released_on))) * 1000000 + microsecond(timestamp(released_on))) * 1000 - (floor(time_to_sec(published_at)) * 1000000 + microsecond(published_at)) * 1000)) div 86400000000000, 0, -((datediff(date(timestamp(released_on)), date(published_at)) * 86400000000000 + ((floor(time_to_sec(timestamp(released_on))) * 1000000 + microsecond(timestamp(released_on))) * 1000 - (floor(time_to_sec(published_at)) * 1000000 + microsecond(published_at)) * 1000)) % 86400000000000), 0, 0, 0, 'day') as daysToPublication from project_release order by version"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof releases, Array<{ version: string; hours?: number; months?: number; daysToPublication: number }>>>()
        expect(releases.map(release => [release.version, release.hours, release.months, release.daysToPublication])).toEqual([
            ['0.9.0', 48, 0.06451612903225806, 1.4583333333333333],
            ['1.2.0', 36, 0.04838709677419355, 1.375],
            ['1.3.0-beta.1', 0.75, 0.0010775862068965517, 1.4166666666666667],
        ])
    })

    test('docs:dates-and-times/durations-added-together', async () => {
        ctx.mockNext([
            { version: '0.9.0', withMargin: '2 days 12:00:00', shorter: '1 day 23:45:00' },
            { version: '1.2.0', withMargin: '2 days', shorter: '1 day 11:45:00' },
            { version: '1.3.0-beta.1', withMargin: '12:45:00', shorter: '00:30:00' },
        ])
        const connection = ctx.conn

        // doc-start
        const releases = await connection.selectFrom(tRelease)
            .select({
                version: tRelease.version,
                withMargin: tRelease.rolloutTime.add({ hours: 12 }),
                shorter: tRelease.rolloutTime.subtract(Temporal.Duration.from('PT15M')),
            })
            .orderBy('version')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, tsq_duration_add(tsq_duration_part(rollout_time, 'largest'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), 4, 0, 43200, 0, 1) as withMargin, tsq_duration_add(tsq_duration_part(rollout_time, 'largest'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), 5, 0, 900, 0, -1) as shorter from project_release order by version"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof releases, Array<{ version: string; withMargin?: Temporal.Duration; shorter?: Temporal.Duration }>>>()
        expect(releases.map(release => [release.version, release.withMargin?.toString(), release.shorter?.toString()])).toEqual([
            ['0.9.0', 'P2DT12H', 'P1DT23H45M'],
            ['1.2.0', 'P2D', 'P1DT11H45M'],
            ['1.3.0-beta.1', 'PT12H45M', 'PT30M'],
        ])
    })

    test('docs:dates-and-times/changing-a-field-and-rounding', async () => {
        ctx.mockNext([
            { version: '0.9.0', monthOfRelease: '2024-03-01', cutoffSlot: '18:00:00' },
            { version: '1.2.0', monthOfRelease: '2024-01-01', cutoffSlot: '18:00:00' },
            { version: '1.3.0-beta.1', monthOfRelease: '2024-02-01', cutoffSlot: '18:00:00' },
        ])
        const connection = ctx.conn

        // doc-start
        const releases = await connection.selectFrom(tRelease)
            .select({
                version: tRelease.version,
                monthOfRelease: tRelease.releasedOn.with({ day: 1 }),
                cutoffSlot: tRelease.cutoffTime.round({ smallestUnit: 'hour', roundingIncrement: 6 }),
            })
            .orderBy('version')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, date_add(date_add(makedate(year(released_on), 1), interval month(released_on) - 1 month), interval 1 - 1 day) as monthOfRelease, sec_to_time(mod((2 * (floor(time_to_sec(cutoff_time)) * 1000000 + microsecond(cutoff_time)) * 1000 + 21600000000000) div 43200000000000 * 21600000000000, 86400000000000) div 1000 * 0.000001) as cutoffSlot from project_release order by version"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof releases, Array<{ version: string; monthOfRelease: Temporal.PlainDate; cutoffSlot: Temporal.PlainTime }>>>()
        expect(releases.map(release => [release.version, release.monthOfRelease.toString(), release.cutoffSlot.toString()])).toEqual([
            ['0.9.0', '2024-03-01', '18:00:00'],
            ['1.2.0', '2024-01-01', '18:00:00'],
            ['1.3.0-beta.1', '2024-02-01', '18:00:00'],
        ])
    })
})
