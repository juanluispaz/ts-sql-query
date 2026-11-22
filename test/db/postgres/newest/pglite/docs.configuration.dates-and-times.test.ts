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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, released_on as "releasedOn", cutoff_time as "cutoffTime", published_at as "publishedAt" from project_release where released_on >= $1 order by "releasedOn""`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, extract(month from released_on) as month, extract(isodow from released_on) as "dayOfWeek", extract(hour from published_at) as "publishedHour" from project_release order by version"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, released_on + cutoff_time as deadline, cast(published_at as date) as "publishedOn" from project_release where published_at > (released_on + cutoff_time) order by deadline"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select current_date as today, current_timestamp as now"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof today, Temporal.PlainDate>>()
        assertType<Exact<typeof now, Temporal.PlainDateTime>>()
        expect(today).toBeInstanceOf(Temporal.PlainDate)
        expect(now).toBeInstanceOf(Temporal.PlainDateTime)
    })

    test('docs:dates-and-times/instants-in-a-query', async () => {
        ctx.mockNext([
            { version: '1.2.0', deployedAt: '2024-01-16 09:30:15.123456+00' },
            { version: '0.9.0', deployedAt: '2024-03-02 11:05:00+00' },
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, deployed_at as "deployedAt" from project_release where deployed_at >= $1 order by "deployedAt""`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, cast(deployed_at::timestamp as date) as "deployedOn", floor(extract(epoch from deployed_at) * 1000) as "deployedMs", published_at as published from project_release where deployed_at is not null order by version"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof deployments, Array<{ version: string; deployedOn?: Temporal.PlainDate; deployedMs?: number; published: Temporal.Instant }>>>()
        const first = Temporal.Instant.from('2024-03-02T11:05:00Z')
        const second = Temporal.Instant.from('2024-01-16T09:30:15.123456Z')
        expect(deployments.map(release => [release.version, release.deployedOn?.toString(), release.deployedMs, release.published.toString()])).toEqual([
            ['0.9.0', first.toZonedDateTimeISO('UTC').toPlainDate().toString(), first.epochMilliseconds, '2024-03-02T11:00:00Z'],
            ['1.2.0', second.toZonedDateTimeISO('UTC').toPlainDate().toString(), second.epochMilliseconds, '2024-01-16T09:00:00Z'],
        ])
    })

    test('docs:dates-and-times/the-instant-of-its-epoch', async () => {
        ctx.mockNext([
            { version: '1.2.0', deployedAt: '2024-01-16 09:30:15.123456+00', sameInstant: '2024-01-16 09:30:15.123' },
        ])
        const connection = ctx.conn

        // doc-start
        const deployedBefore = await connection.selectFrom(tRelease)
            .where(tRelease.deployedAt.lessThan(connection.instantFromEpochMilliseconds(1705400000000)))
            .select({
                version: tRelease.version,
                deployedAt: tRelease.deployedAt,
                sameInstant: connection.instantFromEpochMilliseconds(tRelease.deployedAt.epochMilliseconds()),
            })
            .orderBy('version')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, deployed_at as "deployedAt", (date '1970-01-01' + cast(((cast(floor(extract(epoch from deployed_at) * 1000) as bigint) - ((cast(floor(extract(epoch from deployed_at) * 1000) as bigint) % 86400000 + 86400000) % 86400000)) / 86400000) as integer)) + make_interval(secs => (((cast(floor(extract(epoch from deployed_at) * 1000) as bigint) % 86400000 + 86400000) % 86400000) * 1000000) / 1000000000.0) as "sameInstant" from project_release where deployed_at < $1 order by version"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-16T10:13:20Z",
          ]
        `)
        assertType<Exact<typeof deployedBefore, Array<{ version: string; deployedAt?: Temporal.Instant; sameInstant?: Temporal.Instant }>>>()
        const deployed = Temporal.Instant.from('2024-01-16T09:30:15.123456Z')
        expect(deployedBefore.map(release => [release.version, release.deployedAt?.toString(), release.sameInstant?.toString()])).toEqual([
            ['1.2.0', deployed.toString(), Temporal.Instant.fromEpochMilliseconds(deployed.epochMilliseconds).toString()],
        ])
    })

    test('docs:dates-and-times/zoned-dates-and-times', async () => {
        ctx.mockNext([
            { version: '0.9.0', deployedInMadrid: '2024-03-02T11:05:00.000000000Z AD[EUROPE/MADRID]', publishedInMadrid: '2024-03-02T10:00:00.000000000Z AD[EUROPE/MADRID]', publishedInstant: '2024-03-02T10:00:00.000000000Z AD' },
            { version: '1.2.0', deployedInMadrid: '2024-01-16T09:30:15.123456000Z AD[EUROPE/MADRID]', publishedInMadrid: '2024-01-16T08:00:00.000000000Z AD[EUROPE/MADRID]', publishedInstant: '2024-01-16T08:00:00.000000000Z AD' },
            { version: '1.3.0-beta.1', deployedInMadrid: null, publishedInMadrid: '2024-02-21T09:00:00.000000000Z AD[EUROPE/MADRID]', publishedInstant: '2024-02-21T09:00:00.000000000Z AD' },
        ])
        const connection = ctx.conn

        // doc-start
        const releases = await connection.selectFrom(tRelease)
            .select({
                version: tRelease.version,
                deployedInMadrid: tRelease.deployedAt.toZonedDateTimeISO('Europe/Madrid'),
                publishedInMadrid: tRelease.publishedAt.toZonedDateTime('Europe/Madrid'),
                publishedInstant: tRelease.publishedAt.toZonedDateTime('Europe/Madrid').toInstant(),
            })
            .orderBy('version')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, to_char((deployed_at::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as "deployedInMadrid", to_char((published_at at time zone 'Europe/Madrid') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as "publishedInMadrid", ((published_at at time zone 'Europe/Madrid')) as "publishedInstant" from project_release order by version"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof releases, Array<{ version: string; deployedInMadrid?: Temporal.ZonedDateTime; publishedInMadrid: Temporal.ZonedDateTime; publishedInstant: Temporal.Instant }>>>()
        const deployed = [Temporal.Instant.from('2024-03-02T11:05:00Z'), Temporal.Instant.from('2024-01-16T09:30:15.123456Z'), undefined]
        const published = ['2024-03-02T11:00:00', '2024-01-16T09:00:00', '2024-02-21T10:00:00'].map(text => Temporal.PlainDateTime.from(text).toZonedDateTime('Europe/Madrid'))
        expect(releases.map(release => [release.version, release.deployedInMadrid?.toString(), release.publishedInMadrid.toString(), release.publishedInstant.toString()])).toEqual(['0.9.0', '1.2.0', '1.3.0-beta.1'].map((version, i) => [
            version, deployed[i]?.toZonedDateTimeISO('Europe/Madrid').toString(), published[i]!.toString(), published[i]!.toInstant().toString(),
        ]))
    })

    test('docs:dates-and-times/the-arithmetic-of-a-zoned-date-and-time', async () => {
        ctx.mockNext([
            { version: '0.9.0', followUp: '2024-03-31T09:00:00.000000000Z AD[EUROPE/MADRID]', daysToFollowUp: 'P29D', hoursToFollowUp: 'PT695H', hoursInThatDay: 23 },
            { version: '1.2.0', followUp: '2024-02-14T08:00:00.000000000Z AD[EUROPE/MADRID]', daysToFollowUp: 'P29D', hoursToFollowUp: 'PT696H', hoursInThatDay: 24 },
            { version: '1.3.0-beta.1', followUp: '2024-03-21T09:00:00.000000000Z AD[EUROPE/MADRID]', daysToFollowUp: 'P29D', hoursToFollowUp: 'PT696H', hoursInThatDay: 24 },
        ])
        const connection = ctx.conn

        // doc-start
        const published = tRelease.publishedAt.toZonedDateTime('Europe/Madrid')
        const followUp = published.add({ weeks: 4, days: 1 })
        const followUps = await connection.selectFrom(tRelease)
            .select({
                version: tRelease.version,
                followUp: followUp,
                daysToFollowUp: published.until(followUp, { largestUnit: 'day' }),
                hoursToFollowUp: published.until(followUp),
                hoursInThatDay: followUp.hoursInDay(),
            })
            .orderBy('version')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, to_char((((((published_at at time zone 'Europe/Madrid')) at time zone 'Europe/Madrid') + make_interval(days => $1)) at time zone 'Europe/Madrid') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as "followUp", tsq_zoned_until((published_at at time zone 'Europe/Madrid'), 'Europe/Madrid', (((((published_at at time zone 'Europe/Madrid')) at time zone 'Europe/Madrid') + make_interval(days => $2)) at time zone 'Europe/Madrid'), 'Europe/Madrid', 'day', 'nanosecond', 1, 'trunc', 1) as "daysToFollowUp", (extract(epoch from (((((((published_at at time zone 'Europe/Madrid')) at time zone 'Europe/Madrid') + make_interval(days => $3)) at time zone 'Europe/Madrid')) at time zone 'UTC') - (((published_at at time zone 'Europe/Madrid')) at time zone 'UTC')) || ' seconds')::interval as "hoursToFollowUp", (select (extract(epoch from ((date_trunc('day', (tsq_z.x at time zone 'Europe/Madrid')) + interval '1 day') at time zone 'Europe/Madrid') - ((date_trunc('day', (tsq_z.x at time zone 'Europe/Madrid'))) at time zone 'Europe/Madrid')) / 3600)::float8 from (select (((((published_at at time zone 'Europe/Madrid')) at time zone 'Europe/Madrid') + make_interval(days => $4)) at time zone 'Europe/Madrid') as x offset 0) tsq_z) as "hoursInThatDay" from project_release order by version"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            29,
            29,
            29,
            29,
          ]
        `)
        assertType<Exact<typeof followUps, Array<{ version: string; followUp: Temporal.ZonedDateTime; daysToFollowUp: Temporal.Duration; hoursToFollowUp: Temporal.Duration; hoursInThatDay: number }>>>()
        const publications = ['2024-03-02T11:00:00', '2024-01-16T09:00:00', '2024-02-21T10:00:00'].map(text => Temporal.PlainDateTime.from(text).toZonedDateTime('Europe/Madrid'))
        expect(followUps.map(release => [release.version, release.followUp.toString(), release.daysToFollowUp.toString(), release.hoursToFollowUp.toString(), release.hoursInThatDay])).toEqual(['0.9.0', '1.2.0', '1.3.0-beta.1'].map((version, i) => {
            const at = publications[i]!.add({ weeks: 4, days: 1 })
            return [version, at.toString(), publications[i]!.until(at, { largestUnit: 'day' }).toString(), publications[i]!.until(at).toString(), at.hoursInDay]
        }))
    })

    test('docs:dates-and-times/the-arithmetic-of-an-instant', async () => {
        ctx.mockNext([
            { version: '0.9.0', afterPublishing: '00:05:00', hour: '2024-03-02 11:00:00+00', reviewBy: '2024-03-04 12:00:00+00' },
            { version: '1.2.0', afterPublishing: '00:30:15.123456', hour: '2024-01-16 09:00:00+00', reviewBy: '2024-01-18 10:00:00+00' },
        ])
        const connection = ctx.conn

        // doc-start
        const deployments = await connection.selectFrom(tRelease)
            .where(tRelease.deployedAt.isNotNull())
            .select({
                version: tRelease.version,
                afterPublishing: tRelease.deployedAt.since(tRelease.publishedAt.toInstant(), { largestUnit: 'hour' }),
                hour: tRelease.deployedAt.round({ smallestUnit: 'hour', roundingMode: 'floor' }),
                reviewBy: tRelease.deployedAt.round({ smallestUnit: 'hour', roundingMode: 'ceil' }).add({ hours: 48 }),
            })
            .orderBy('version')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, (extract(epoch from deployed_at - published_at) || ' seconds')::interval as "afterPublishing", date_bin(interval '1 hours', deployed_at, date_trunc('day', deployed_at)) as hour, date_bin(interval '1 hours', deployed_at + interval '1 hours' - interval '1 microsecond', date_trunc('day', deployed_at)) + $1 as "reviewBy" from project_release where deployed_at is not null order by version"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "PT172800S",
          ]
        `)
        assertType<Exact<typeof deployments, Array<{ version: string; afterPublishing?: Temporal.Duration; hour?: Temporal.Instant; reviewBy?: Temporal.Instant }>>>()
        const deployed = [Temporal.Instant.from('2024-03-02T11:05:00Z'), Temporal.Instant.from('2024-01-16T09:30:15.123456Z')]
        const published = [Temporal.Instant.from('2024-03-02T11:00:00Z'), Temporal.Instant.from('2024-01-16T09:00:00Z')]
        expect(deployments.map((release, i) => [
            release.version,
            Temporal.Duration.compare(release.afterPublishing!, deployed[i]!.since(published[i]!, { largestUnit: 'hour' })),
            release.hour?.toString(),
            release.reviewBy?.toString(),
        ])).toEqual([0, 1].map(i => [
            ['0.9.0', '1.2.0'][i],
            0,
            deployed[i]!.round({ smallestUnit: 'hour', roundingMode: 'floor' }).toString(),
            deployed[i]!.round({ smallestUnit: 'hour', roundingMode: 'ceil' }).add({ hours: 48 }).toString(),
        ]))
    })

    test('docs:dates-and-times/the-current-instant', async () => {
        ctx.mockNext('2024-05-06 10:11:12.345678+00')
        const connection = ctx.conn

        // doc-start
        const now = await connection.selectFromNoTable()
            .selectOneColumn(connection.currentInstant())
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select current_timestamp as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof now, Temporal.Instant>>()
        expect(now).toBeInstanceOf(Temporal.Instant)
    })

    test('docs:dates-and-times/durations-in-a-query', async () => {
        ctx.mockNext([
            { version: '0.9.0', rolloutTime: '2 days' },
            { version: '1.2.0', rolloutTime: '1 day 12:00:00' },
            { version: '1.3.0-beta.1', rolloutTime: '00:45:00' },
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, rollout_time as "rolloutTime" from project_release order by version"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version from project_release where rollout_time = $1"`)
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
            { version: '0.9.0', days: 2, hours: 0, minutes: 0, sign: 1, back: '-2 days' },
            { version: '1.2.0', days: 1, hours: 12, minutes: 0, sign: 1, back: '-1 days -12:00:00' },
            { version: '1.3.0-beta.1', days: 0, hours: 0, minutes: 45, sign: 1, back: '-00:45:00' },
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, cast(extract(day from rollout_time) as integer) as days, cast(extract(hour from rollout_time) as integer) as hours, cast(extract(minute from rollout_time) as integer) as minutes, cast(sign(extract(epoch from rollout_time)) as integer) as sign, -rollout_time as back from project_release order by version"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, cast(released_on + $1 as date) as "supportEndsOn", published_at + rollout_time as "rolloutEndedAt" from project_release order by version"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "P18M",
          ]
        `)
        assertType<Exact<typeof releases, Array<{ version: string; supportEndsOn: Temporal.PlainDate; rolloutEndedAt?: Temporal.PlainDateTime }>>>()
        expect(releases.map(release => [release.version, release.supportEndsOn.toString(), release.rolloutEndedAt?.toString()])).toEqual([
            ['0.9.0', '2025-09-01', '2024-03-04T11:00:00'],
            ['1.2.0', '2025-07-15', '2024-01-17T21:00:00'],
            ['1.3.0-beta.1', '2025-08-20', '2024-02-21T10:45:00'],
        ])
    })

    test('docs:dates-and-times/a-field-of-the-duration-from-the-query', async () => {
        ctx.mockNext([
            { version: '0.9.0', supportMonths: null, supportEndsOn: null },
            { version: '1.2.0', supportMonths: 18, supportEndsOn: '2025-07-15' },
            { version: '1.3.0-beta.1', supportMonths: 3, supportEndsOn: '2024-05-20' },
        ])
        const connection = ctx.conn

        // doc-start
        const releases = await connection.selectFrom(tRelease)
            .select({
                version: tRelease.version,
                supportMonths: tRelease.supportMonths,
                supportEndsOn: tRelease.releasedOn.add({ months: tRelease.supportMonths }),
            })
            .orderBy('version')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, support_months as "supportMonths", cast(released_on + make_interval(months => support_months) as date) as "supportEndsOn" from project_release order by version"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof releases, Array<{ version: string; supportMonths?: number; supportEndsOn?: Temporal.PlainDate }>>>()
        expect(releases.map(release => [release.version, release.supportMonths, release.supportEndsOn?.toString()])).toEqual([
            ['0.9.0', undefined, undefined],
            ['1.2.0', 18, '2025-07-15'],
            ['1.3.0-beta.1', 3, '2024-05-20'],
        ])
    })

    test('docs:dates-and-times/the-duration-between-two-values', async () => {
        ctx.mockNext([
            { version: '0.9.0', toPublication: '1 day', publishedAfter: '35:00:00', untilEndOfJune: '3 mons 29 days' },
            { version: '1.2.0', toPublication: '1 day', publishedAfter: '33:00:00', untilEndOfJune: '5 mons 15 days' },
            { version: '1.3.0-beta.1', toPublication: '1 day', publishedAfter: '34:00:00', untilEndOfJune: '4 mons 10 days' },
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, make_interval(days => (cast(published_at as date) - released_on)) as "toPublication", (extract(epoch from published_at - cast(released_on as timestamp)) || ' seconds')::interval as "publishedAfter", tsq_duration_round(cast(extract(year from released_on) as integer), cast(extract(month from released_on) as integer), cast(extract(day from released_on) as integer), 0, $1, $2, $3, 0, 'month', 'day', 1, 'trunc', 1) as "untilEndOfJune" from project_release order by version"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024",
            "6",
            "30",
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, tsq_duration_total(cast(extract(year from rollout_time) * 12 + extract(month from rollout_time) as bigint), 0, cast(extract(day from rollout_time) as bigint), cast(extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)) as bigint), cast(extract(microseconds from rollout_time) as bigint) % 1000000 * 1000, 0, 0, 0, 'hour') as hours, tsq_duration_total(cast(extract(year from rollout_time) * 12 + extract(month from rollout_time) as bigint), 0, cast(extract(day from rollout_time) as bigint), cast(extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)) as bigint), cast(extract(microseconds from rollout_time) as bigint) % 1000000 * 1000, cast(extract(year from released_on) as integer), cast(extract(month from released_on) as integer), cast(extract(day from released_on) as integer), 'month') as months, tsq_duration_total(0, 0, 0, (-(extract(epoch from cast(released_on as timestamp) - published_at) * 1000000)::bigint / 1000000), (-(extract(epoch from cast(released_on as timestamp) - published_at) * 1000000)::bigint % 1000000) * 1000, 0, 0, 0, 'day') as "daysToPublication" from project_release order by version"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, tsq_duration_add(case when extract(year from rollout_time) <> 0 or extract(month from rollout_time) <> 0 then 1 when extract(day from rollout_time) <> 0 then 3 else 4 end, cast(extract(day from rollout_time) as bigint), cast(extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)) as bigint), cast(extract(microseconds from rollout_time) as bigint) % 1000000 * 1000, 4, 0, 43200, 0, 1) as "withMargin", tsq_duration_add(case when extract(year from rollout_time) <> 0 or extract(month from rollout_time) <> 0 then 1 when extract(day from rollout_time) <> 0 then 3 else 4 end, cast(extract(day from rollout_time) as bigint), cast(extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)) as bigint), cast(extract(microseconds from rollout_time) as bigint) % 1000000 * 1000, 5, 0, 900, 0, -1) as shorter from project_release order by version"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, make_date(cast(extract(year from released_on) as integer), cast(extract(month from released_on) as integer), 1) as "monthOfRelease", cast(date_bin(interval '6 hours', (date '2000-01-01' + cutoff_time) + interval '3 hours', date_trunc('day', (date '2000-01-01' + cutoff_time))) as time) as "cutoffSlot" from project_release order by version"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof releases, Array<{ version: string; monthOfRelease: Temporal.PlainDate; cutoffSlot: Temporal.PlainTime }>>>()
        expect(releases.map(release => [release.version, release.monthOfRelease.toString(), release.cutoffSlot.toString()])).toEqual([
            ['0.9.0', '2024-03-01', '18:00:00'],
            ['1.2.0', '2024-01-01', '18:00:00'],
            ['1.3.0-beta.1', '2024-02-01', '18:00:00'],
        ])
    })
})
