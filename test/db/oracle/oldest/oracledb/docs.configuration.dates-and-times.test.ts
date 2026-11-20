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

    test('docs:dates-and-times/instants-in-a-query', async () => {
        ctx.mockNext([
            { version: '1.2.0', deployedAt: '2024-01-16T09:30:15.123456000Z AD' },
            { version: '0.9.0', deployedAt: '2024-03-02T11:05:00.000000000Z AD' },
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", to_char(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "deployedAt" from project_release where deployed_at >= to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') order by project_release.deployed_at"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", to_char(trunc(cast(cast(deployed_at as timestamp(9) with time zone) at local as timestamp(9))), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "deployedOn", (trunc(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "deployedMs", to_char(sys_extract_utc(cast(published_at as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "published" from project_release where deployed_at is not null order by "version""`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", to_char(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "deployedAt", to_char(sys_extract_utc(cast(from_tz(cast((date '1970-01-01' + trunc(((trunc(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) - (mod((mod((trunc(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')), 86400000) + 86400000), 86400000))) / 86400000)) as timestamp(9)) + numtodsinterval(((mod((mod((trunc(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')), 86400000) + 86400000), 86400000)) * 1000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "sameInstant" from project_release where deployed_at < to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') order by "version""`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", case when (from_tz(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), '+00:00') at time zone 'Europe/Madrid') is not null then to_char(sys_extract_utc((from_tz(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), '+00:00') at time zone 'Europe/Madrid')), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char((from_tz(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), '+00:00') at time zone 'Europe/Madrid'), 'TZR') || ']' end as "deployedInMadrid", case when (from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid') is not null then to_char(sys_extract_utc((from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid')), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char((from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid'), 'TZR') || ']' end as "publishedInMadrid", to_char(sys_extract_utc(cast((from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "publishedInstant" from project_release order by "version""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof releases, Array<{ version: string; deployedInMadrid?: Temporal.ZonedDateTime; publishedInMadrid: Temporal.ZonedDateTime; publishedInstant: Temporal.Instant }>>>()
        const deployed = [Temporal.Instant.from('2024-03-02T11:05:00Z'), Temporal.Instant.from('2024-01-16T09:30:15.123456Z'), undefined]
        const published = ['2024-03-02T11:00:00', '2024-01-16T09:00:00', '2024-02-21T10:00:00'].map(text => Temporal.PlainDateTime.from(text).toZonedDateTime('Europe/Madrid'))
        expect(releases.map(release => [release.version, release.deployedInMadrid?.toString(), release.publishedInMadrid.toString(), release.publishedInstant.toString()])).toEqual(['0.9.0', '1.2.0', '1.3.0-beta.1'].map((version, i) => [
            version, deployed[i]?.toZonedDateTimeISO('Europe/Madrid').toString(), published[i]!.toString(), published[i]!.toInstant().toString(),
        ]))
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", tsq_duration_text(0, 0, 0, 0, -((trunc(sys_extract_utc(cast(published_at as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)))) * 86400000000000 + ((extract(hour from (cast(sys_extract_utc(cast(published_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(published_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(published_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(published_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(published_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(published_at as timestamp(9) with time zone)))))) * 1000000000 - (extract(hour from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)))))) * 1000000000)), 'hour') as "afterPublishing", to_char(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc((extract(hour from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)))))) * 1000000000 / 3600000000000) * 3600000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "hour", to_char(sys_extract_utc(cast(from_tz(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc(((extract(hour from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)))))) * 1000000000 + 3599999999999) / 3600000000000) * 3600000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)) + numtodsinterval(:0, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "reviewBy" from project_release where deployed_at is not null order by "version""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            172800n,
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
        ctx.mockNext('2024-05-06T10:11:12.345678000Z AD')
        const connection = ctx.conn

        // doc-start
        const now = await connection.selectFromNoTable()
            .selectOneColumn(connection.currentInstant())
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(sys_extract_utc(cast(systimestamp as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "result" from dual"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", extract(day from rollout_time) as "days", extract(hour from rollout_time) as "hours", extract(minute from rollout_time) as "minutes", sign(extract(day from rollout_time) * 86400 + extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + extract(second from rollout_time)) as "sign", (rollout_time * -1) as "back" from project_release order by "version""`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", tsq_duration_text(0, 0, 0, (trunc(published_at) - released_on), 0, 'hour') as "toPublication", tsq_duration_text(0, 0, 0, 0, -((trunc(cast(released_on as timestamp(9))) - trunc(published_at)) * 86400000000000 + ((extract(hour from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 3600 + extract(minute from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 60 + extract(second from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9)))))) * 1000000000 - (extract(hour from (cast(published_at as timestamp(9)) - trunc(published_at))) * 3600 + extract(minute from (cast(published_at as timestamp(9)) - trunc(published_at))) * 60 + extract(second from (cast(published_at as timestamp(9)) - trunc(published_at)))) * 1000000000)), 'hour') as "publishedAfter", tsq_duration_text(0, trunc(((extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from released_on) * 12 + extract(month from released_on)) * 32 - extract(day from released_on)) / 32), 0, (to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') - (add_months(released_on, trunc(((extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from released_on) * 12 + extract(month from released_on)) * 32 - extract(day from released_on)) / 32)) - greatest(0, extract(day from add_months(released_on, trunc(((extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from released_on) * 12 + extract(month from released_on)) * 32 - extract(day from released_on)) / 32))) - extract(day from released_on)))), 0, 'hour') as "untilEndOfJune" from project_release order by "version""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", tsq_duration_total(0, 0, extract(day from rollout_time), extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)), mod(extract(second from rollout_time) * 1000000000, 1000000000), 0, 0, 0, 'hour') as "hours", tsq_duration_total(0, 0, extract(day from rollout_time), extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)), mod(extract(second from rollout_time) * 1000000000, 1000000000), extract(year from released_on), extract(month from released_on), extract(day from released_on), 'month') as "months", tsq_duration_total(0, 0, -trunc(((trunc(cast(released_on as timestamp(9))) - trunc(published_at)) * 86400000000000 + ((extract(hour from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 3600 + extract(minute from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 60 + extract(second from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9)))))) * 1000000000 - (extract(hour from (cast(published_at as timestamp(9)) - trunc(published_at))) * 3600 + extract(minute from (cast(published_at as timestamp(9)) - trunc(published_at))) * 60 + extract(second from (cast(published_at as timestamp(9)) - trunc(published_at)))) * 1000000000)) / 86400000000000), trunc(-(mod(((trunc(cast(released_on as timestamp(9))) - trunc(published_at)) * 86400000000000 + ((extract(hour from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 3600 + extract(minute from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 60 + extract(second from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9)))))) * 1000000000 - (extract(hour from (cast(published_at as timestamp(9)) - trunc(published_at))) * 3600 + extract(minute from (cast(published_at as timestamp(9)) - trunc(published_at))) * 60 + extract(second from (cast(published_at as timestamp(9)) - trunc(published_at)))) * 1000000000)), 86400000000000)) / 1000000000), mod(-(mod(((trunc(cast(released_on as timestamp(9))) - trunc(published_at)) * 86400000000000 + ((extract(hour from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 3600 + extract(minute from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 60 + extract(second from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9)))))) * 1000000000 - (extract(hour from (cast(published_at as timestamp(9)) - trunc(published_at))) * 3600 + extract(minute from (cast(published_at as timestamp(9)) - trunc(published_at))) * 60 + extract(second from (cast(published_at as timestamp(9)) - trunc(published_at)))) * 1000000000)), 86400000000000)), 1000000000), 0, 0, 0, 'day') as "daysToPublication" from project_release order by "version""`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", tsq_duration_add(case when extract(day from rollout_time) <> 0 then 3 when extract(hour from rollout_time) <> 0 then 4 when extract(minute from rollout_time) <> 0 then 5 when trunc(extract(second from rollout_time)) <> 0 then 6 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) >= 1000000 then 7 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) >= 1000 then 8 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) <> 0 then 9 else 10 end, extract(day from rollout_time), extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)), mod(extract(second from rollout_time) * 1000000000, 1000000000), 4, 0, 43200, 0, 1) as "withMargin", tsq_duration_add(case when extract(day from rollout_time) <> 0 then 3 when extract(hour from rollout_time) <> 0 then 4 when extract(minute from rollout_time) <> 0 then 5 when trunc(extract(second from rollout_time)) <> 0 then 6 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) >= 1000000 then 7 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) >= 1000 then 8 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) <> 0 then 9 else 10 end, extract(day from rollout_time), extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)), mod(extract(second from rollout_time) * 1000000000, 1000000000), 5, 0, 900, 0, -1) as "shorter" from project_release order by "version""`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as "version", to_char((add_months(date '0001-01-01', (extract(year from released_on) - 1) * 12 + extract(month from released_on) - 1) + 1 - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "monthOfRelease", to_char(cast(timestamp '1970-01-01 00:00:00' + numtodsinterval(mod(trunc((2 * (extract(hour from (cast(cutoff_time as timestamp(9)) - trunc(cutoff_time))) * 3600 + extract(minute from (cast(cutoff_time as timestamp(9)) - trunc(cutoff_time))) * 60 + extract(second from (cast(cutoff_time as timestamp(9)) - trunc(cutoff_time)))) * 1000000000 + 21600000000000) / 43200000000000) * 21600000000000, 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "cutoffSlot" from project_release order by "version""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof releases, Array<{ version: string; monthOfRelease: Temporal.PlainDate; cutoffSlot: Temporal.PlainTime }>>>()
        expect(releases.map(release => [release.version, release.monthOfRelease.toString(), release.cutoffSlot.toString()])).toEqual([
            ['0.9.0', '2024-03-01', '18:00:00'],
            ['1.2.0', '2024-01-01', '18:00:00'],
            ['1.3.0-beta.1', '2024-02-01', '18:00:00'],
        ])
    })
})
