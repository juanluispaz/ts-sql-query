// A PostgreSQL database outside UTC, with its zone declared in the databaseTimeZone of the connection and the session in
// that zone: the values without zone are wall clocks of Europe/Madrid, and the database completes their zone with its
// session. A Date sent is stored as the wall clock of Madrid of its instant, a wall clock read is its instant, the date
// functions give the parts in UTC, and a localTime is completed with the localTimeReferenceDate. Through every runner,
// with the process in Madrid, in UTC and in Tokyo. The zone of a process is set when it starts, so each case runs in a
// process of its own (databaseOutsideUtc/probe.ts).

import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { runProbe } from '../lib/localTemporalValues.js'
import { environmentVersions, isEnvironmentVersionSelected } from '../lib/versions.js'
import type { ScenarioResult } from './databaseOutsideUtc/probe.js'

const probe = fileURLToPath(new URL('./databaseOutsideUtc/probe.ts', import.meta.url))
const TIMEOUT = 300_000
const isBun = typeof globalThis.Bun !== 'undefined'
const ZONES = ['Europe/Madrid', 'UTC', 'Asia/Tokyo']

// A time with time zone with the database in UTC: the driver delivers its text with the offset, the library reads its
// instant on 1970-01-01, and its hour is the one of its own offset, because no expression without a zone gives it in
// UTC (a known limit, docs/configuration/time-zones.md)
const timeWithTimeZoneInUtc = { delivered: '19:30:15.123+09', read: '1970-01-01T10:30:15.123Z', hours: 19 }

const winter = '2024-01-14T09:15:30.123Z'
const summer = '2024-07-14T09:15:30.123Z'
const old = '1960-07-14T09:15:30.123Z'

function checkScenario(out: ScenarioResult): void {
    expect(out.session).toBe('Europe/Madrid')
    // Sent: the wall clock of Madrid of the instant (1960 at +01:00, summer at +02:00)
    expect(out.stored).toEqual([
        { id: 1, ts: '2024-01-14 10:15:30.123', tstz_utc: '2024-01-14 09:15:30.123', t: '18:00:00' },
        { id: 2, ts: '2024-07-14 11:15:30.123', tstz_utc: '2024-07-14 09:15:30.123', t: null },
        { id: 5, ts: '1960-07-14 10:15:30.123', tstz_utc: null, t: null },
    ])
    // Read: the instant, with the date functions in UTC; row 3 was written by another program
    const parts = { hours: 9, date: 14, month: 0, year: 2024 }
    expect(out.read).toEqual([
        { id: 1, ts: winter, tstz: winter, t: '1970-01-01T17:00:00.000Z', ...parts, time: Date.parse(winter), tHours: 17, same: true },
        { id: 2, ts: summer, tstz: summer, ...parts, month: 6, time: Date.parse(summer), same: true },
        { id: 3, ts: winter, tstz: winter, t: '1970-01-01T17:00:00.000Z', ...parts, time: Date.parse(winter), tHours: 17, same: true },
        { id: 5, ts: old, ...parts, month: 6, year: 1960, time: Date.parse(old) },
    ])
    // Compared: with the wall clock of Madrid of the instant
    expect(out.whereTs).toEqual([1, 3])
    expect(out.whereOld).toEqual([5])
    expect(out.whereT).toEqual([1, 3])
    // Inside the JSON of an aggregated array
    expect(out.aggregated).toEqual([winter, summer])
    // The current date and time of the database, read as its instant
    expect(out.currentTimestampDrift).toBeLessThan(60_000)
    // A localTime on today, the current date of the database: its offset is the one of today in Madrid
    expect(out.constTimeToday).toMatch(/^\d{4}-\d{2}-\d{2}T1[67]:00:00\.000Z$/)
    expect(Number(String(out.constTimeToday).slice(0, 4))).toBeGreaterThan(2000)
    // A localTime is written and read with the offset of its own day: a day of summer, the reference date
    expect(out.summerTime).toEqual({ stored: ['18:00:00'], read: '2024-07-14T16:00:00.000Z' })
    // A localTime after midnight in Madrid, on the reference date 1970-01-01
    expect(out.timeAfterMidnight).toEqual({ stored: ['00:30:00'], read: '1969-12-31T23:30:00.000Z', where: [9] })
    // A time with time zone: the driver delivers its text with the offset, the library reads its instant on
    // 1970-01-01, and its hour in UTC
    expect(out.timeWithTimeZone).toEqual({ delivered: '19:30:15.123+09', read: '1970-01-01T10:30:15.123Z', hours: 10 })
    // A wall clock that Madrid repeats when it leaves summer time is taken in winter time; one it skips when it
    // changes to summer time is moved forward by PostgreSQL
    expect(out.repeated).toBe('2024-10-27T01:30:00.000Z')
    expect(out.skipped).toBe('2024-03-31T01:30:00.000Z')
    // An instant: stored as the wall clock of Madrid of the instant, read, compared and aggregated as its instant
    expect(out.instant.stored).toEqual([{ ts: '2024-01-14 10:15:30.123', tstz_utc: '2024-01-14 09:15:30.123' }])
    expect(out.instant.read).toEqual([
        { id: 1, ts: '2024-01-14T09:15:30.123Z', tstz: '2024-01-14T09:15:30.123Z' },
        { id: 3, ts: '2024-01-14T09:15:30.123Z', tstz: '2024-01-14T09:15:30.123Z' },
        { id: 11, ts: '2024-01-14T09:15:30.123Z', tstz: '2024-01-14T09:15:30.123Z' },
    ])
    expect(out.instant.where).toEqual([1, 3, 11])
    expect(out.instant.aggregated).toEqual(['2024-01-14T09:15:30.123Z', '2024-01-14T09:15:30.123Z'])
    expect(out.instant.currentDrift).toBeLessThan(60_000)
    // A wall clock that Madrid repeats is taken in winter time by PostgreSQL
    expect(out.instant.repeated).toBe('2024-10-27T01:30:00Z')
    // Its epoch, its date and time in Madrid, and a wall clock of Madrid as an instant
    expect(out.instant.methods).toEqual({ milliseconds: 1705223730123, nanoseconds: '1705223730123000000', wall: '2024-01-14T10:15:30.123', zonedWall: '2024-01-14T10:15:30.123', hour: 10, instant: '2024-01-14T09:15:30.123Z', plainHour: 10, plainDay: '2024-01-14' })
}

// A localDateTime and a localTime with a type driverTypeOf gives them (a timestamp and a time; postgres.js and PGlite,
// which send the parameter with its type): the type given doesn't change the zone they are stored with, the one of the
// database (they go as a timestamptz, the type given isn't used)
interface DeclaredTypesResult { sql: string[], stored: unknown[], where: number[], read: Record<string, unknown> }
function checkDeclaredTypes(out: DeclaredTypesResult, table: string): void {
    expect(out.sql).toEqual([
        `insert into ${table} (id, ts, t) values ($1, $2, $3::time)`,
        `select ts::timestamptz as ts, (date '1970-01-01' + t)::timestamptz as t, $1::timestamptz as "constTs" from ${table}`,
    ])
    expect(out.stored).toEqual([{ ts: '2024-01-14 10:15:30.123', t: '18:00:00' }])
    expect(out.where).toEqual([1])
    expect(out.read).toEqual({ ts: winter, t: '1970-01-01T17:00:00.000Z', constTs: winter })
}

// Each version of the engine mapped for --docker-version closest runs too, with the compatibilityVersion of its cells
for (const { version, compatibilityVersion, label } of await environmentVersions('postgres', 'pg')) {
    const runners = [
        { runner: 'PgQueryRunner', enabled: isRealDbEnabled('postgres', 'docker', version, 'pg') },
        { runner: 'PgPoolQueryRunner', enabled: isRealDbEnabled('postgres', 'docker', version, 'pg') },
        { runner: 'PostgresQueryRunner', enabled: isRealDbEnabled('postgres', 'docker', version, 'postgres') },
        { runner: 'BunSqlPostgresQueryRunner', enabled: isBun && isRealDbEnabled('postgres', 'docker', version, 'bun_sql_postgres') },
    ]
    describe.skipIf(!runners.some(r => r.enabled))('PostgreSQL: a database in Europe/Madrid, declared in the connection, with the session in Europe/Madrid' + label, () => {
        let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
        beforeAll(async () => {
            db = await acquireRunnerTestDatabase(undefined, version)
        }, TIMEOUT)
        afterAll(async () => {
            await db?.release()
        }, TIMEOUT)

        for (const { runner, enabled } of runners) {
            for (const zone of ZONES) {
                test.skipIf(!enabled)(`${runner}-the-values-without-zone-are-wall-clocks-of-madrid-with-the-process-in-${zone.replace('/', '-')}`, async () => {
                    const options = { table: 'rt_madrid_' + runner.toLowerCase().replace('queryrunner', ''), compatibilityVersion }
                    checkScenario(await runProbe(probe, 'scenario', { runner, options, zone }, { uri: db!.uri }) as ScenarioResult)
                }, TIMEOUT)
            }
        }

        // The session must be in the declared zone. It is read from the configuration of pg and postgres.js, and
        // a session in Madrid is rejected when the connection declares UTC; Bun SQL keeps it where it can't be read
        const sessions = [
            { runner: 'PgQueryRunner', declaredZone: 'UTC', expected: /^rejected: INVALID_CONFIGURATION/ },
            { runner: 'PgPoolQueryRunner', declaredZone: 'UTC', expected: /^rejected: INVALID_CONFIGURATION/ },
            { runner: 'PostgresQueryRunner', declaredZone: 'UTC', expected: /^rejected: INVALID_CONFIGURATION/ },
            { runner: 'BunSqlPostgresQueryRunner', declaredZone: 'UTC', expected: /^executed$/ },
            { runner: 'PgQueryRunner', declaredZone: 'Europe/Madrid', expected: /^executed$/ },
            { runner: 'PostgresQueryRunner', declaredZone: 'Europe/Madrid', expected: /^executed$/ },
        ]
        for (const { runner, enabled } of runners.filter(r => r.runner === 'PostgresQueryRunner')) {
            test.skipIf(!enabled)(`${runner}-a-type-given-by-driver-type-of-keeps-the-zone-of-the-database`, async () => {
                const options = { table: 'rt_declared_' + runner.toLowerCase().replace('queryrunner', ''), compatibilityVersion, declaredTypes: true }
                checkDeclaredTypes(await runProbe(probe, 'declaredTypes', { runner, options, zone: 'Asia/Tokyo' }, { uri: db!.uri }) as DeclaredTypesResult, options.table)
            }, TIMEOUT)
        }

        for (const { runner, enabled } of runners) {
            test.skipIf(!enabled)(`${runner}-a-time-with-time-zone-with-the-database-in-utc`, async () => {
                const options = { table: 'rt_utc_' + runner.toLowerCase().replace('queryrunner', ''), compatibilityVersion, utc: true }
                expect(await runProbe(probe, 'timeWithTimeZone', { runner, options, zone: 'Asia/Tokyo' }, { uri: db!.uri })).toEqual(timeWithTimeZoneInUtc)
            }, TIMEOUT)
        }

        for (const { runner, declaredZone, expected } of version === 'newest' ? sessions : []) {
            const enabled = runners.find(r => r.runner === runner)!.enabled
            test.skipIf(!enabled)(`${runner}-a-session-in-madrid-with-the-connection-declaring-${declaredZone.replace('/', '-')}`, async () => {
                expect(await runProbe(probe, 'firstQuery', { runner, options: { declaredZone }, zone: 'Asia/Tokyo' }, { uri: db!.uri })).toMatch(expected)
            }, TIMEOUT)
        }
    })
}

describe.skipIf(!isRealDbEnabled('postgres', 'wasm', 'newest', 'pglite') || !isEnvironmentVersionSelected('postgres', 'newest'))('PGlite: a database created in Europe/Madrid, declared in the connection', () => {
    for (const zone of ZONES) {
        test(`the-values-without-zone-are-wall-clocks-of-madrid-with-the-process-in-${zone.replace('/', '-')}`, async () => {
            checkScenario(await runProbe(probe, 'scenario', { runner: 'PgLiteQueryRunner', zone }, undefined) as ScenarioResult)
        }, TIMEOUT)
    }
    test('a-type-given-by-driver-type-of-keeps-the-zone-of-the-database', async () => {
        checkDeclaredTypes(await runProbe(probe, 'declaredTypes', { runner: 'PgLiteQueryRunner', options: { declaredTypes: true }, zone: 'Asia/Tokyo' }, undefined) as DeclaredTypesResult, 'rt_madrid_moment')
    }, TIMEOUT)
    test('a-time-with-time-zone-with-the-database-in-utc', async () => {
        expect(await runProbe(probe, 'timeWithTimeZone', { runner: 'PgLiteQueryRunner', options: { utc: true }, zone: 'Asia/Tokyo' }, undefined)).toEqual(timeWithTimeZoneInUtc)
    }, TIMEOUT)
})
