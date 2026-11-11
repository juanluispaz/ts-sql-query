// An Oracle database outside UTC, with its zone declared in the databaseTimeZone of the connection and the session in
// that zone (ORA_SDTZ): the values without zone are wall clocks of Europe/Madrid, and the database completes their zone
// with its session. A Date sent is stored as the wall clock of Madrid of its instant, a wall clock read is its instant,
// the date functions give the parts in UTC, a localTime is completed with the localTimeReferenceDate, and the column
// compares with a value with its index. The same with the process in Madrid, in UTC and in Tokyo. The zone of a
// process and ORA_SDTZ are set when it starts, so each case runs in a process of its own (databaseOutsideUtc/probe.ts).

import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/oracle/runners.js'
import { runProbe } from '../lib/localTemporalValues.js'
import type { ScenarioResult } from './databaseOutsideUtc/probe.js'

const probe = fileURLToPath(new URL('./databaseOutsideUtc/probe.ts', import.meta.url))
const enabled = isRealDbEnabled('oracle', 'docker', 'newest', 'oracledb')
const TIMEOUT = 300_000

describe.skipIf(!enabled)('Oracle: a database in Europe/Madrid, declared in the connection, with ORA_SDTZ = Europe/Madrid', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
    }, TIMEOUT)
    afterAll(async () => {
        await db?.release()
    }, TIMEOUT)
    const connection = () => ({ user: db!.user, password: db!.password, connectString: db!.connectString })

    for (const zone of ['Europe/Madrid', 'UTC', 'Asia/Tokyo']) {
        test(`the-values-without-zone-are-wall-clocks-of-madrid-with-the-process-in-${zone.replace('/', '-')}`, async () => {
            const out = await runProbe(probe, 'scenario', { runner: 'OracleDBQueryRunner', options: { table: 'rt_ora_madrid' }, zone, env: { ORA_SDTZ: 'Europe/Madrid' } }, connection()) as Required<ScenarioResult>
            expect(out.session).toBe('Europe/Madrid')
            // Sent: the value of a column goes as it is, stored as the wall clock of Madrid of its instant (1960 at
            // +01:00, summer at +02:00); a DATE keeps the whole seconds
            expect(out.insertSql).toBe('insert into rt_ora_madrid (id, ts) values (:0, :1)')
            expect(out.stored).toEqual([
                { ID: 1, TS: '2024-01-14 10:15:30.123', DX: '2024-01-14 10:15:30', T: '1970-01-01 18:00:00.000', TZ_UTC: '2024-01-14 09:15:30.123' },
                { ID: 2, TS: '2024-07-14 11:15:30.123', DX: '1960-07-14 10:15:30', T: null, TZ_UTC: '2024-07-14 09:15:30.123' },
                { ID: 5, TS: '1960-07-14 10:15:30.123', DX: null, T: '1970-01-01 18:00:00.000', TZ_UTC: null },
                { ID: 6, TS: '2024-01-14 10:15:30.123', DX: null, T: null, TZ_UTC: null },
            ])
            expect(out.returning).toEqual({ ts: '2024-01-14T09:15:30.123Z' })
            // Read: the instant, with the date functions in UTC; row 3 was written by another program, with the time of
            // its localTime on a day of summer, read on the reference date 1970-01-01
            const winter = { hours: 9, minutes: 15, seconds: 30, milliseconds: 123, date: 14, day: 0, month: 0, year: 2024, time: Date.parse('2024-01-14T09:15:30.123Z') }
            expect(out.read).toEqual([
                { id: 1, ts: '2024-01-14T09:15:30.123Z', dx: '2024-01-14T09:15:30.000Z', t: '1970-01-01T17:00:00.000Z', tz: '2024-01-14T09:15:30.123Z', ...winter, dxHours: 9, dxTime: Date.parse('2024-01-14T09:15:30Z'), tHours: 17, same: true },
                { id: 2, ts: '2024-07-14T09:15:30.123Z', dx: '1960-07-14T09:15:30.000Z', tz: '2024-07-14T09:15:30.123Z', ...winter, month: 6, time: Date.parse('2024-07-14T09:15:30.123Z'), dxHours: 9, dxTime: Date.parse('1960-07-14T09:15:30Z'), same: true },
                { id: 3, ts: '2024-01-14T09:15:30.123Z', dx: '2024-01-14T09:15:30.000Z', t: '1970-01-01T17:00:00.000Z', ...winter, dxHours: 9, dxTime: Date.parse('2024-01-14T09:15:30Z'), tHours: 17 },
                { id: 5, ts: '1960-07-14T09:15:30.123Z', t: '1970-01-01T17:00:00.000Z', ...winter, day: 4, month: 6, year: 1960, time: Date.parse('1960-07-14T09:15:30.123Z'), tHours: 17 },
            ])
            // Compared: with the wall clock of Madrid of the instant, cast to the type of the column, with its index
            expect(out.whereSql).toEqual({
                ts: 'select id as "id" from rt_ora_madrid where ts = cast(:0 as timestamp)',
                dx: 'select id as "id" from rt_ora_madrid where dx = cast(:0 as date)',
            })
            expect(out.whereTs).toEqual([1, 3, 6])
            expect(out.whereOld).toEqual([5])
            expect(out.whereDx).toEqual([1, 3])
            // A value with a fraction is not a DATE of whole seconds
            expect(out.whereDxFraction).toEqual([])
            expect(out.whereT).toEqual([1, 5])
            expect(out.plan.ts).toMatch(/INDEX RANGE SCAN\s+\|\s*RT_ORA_MADRID_TS/)
            expect(out.plan.ts).not.toMatch(/TABLE ACCESS FULL/)
            expect(out.plan.dx).toMatch(/INDEX RANGE SCAN\s+\|\s*RT_ORA_MADRID_DX/)
            expect(out.plan.dx).not.toMatch(/TABLE ACCESS FULL/)
            // Inside the JSON of an aggregated array
            expect([...out.aggregated].map(String).sort()).toEqual(['2024-01-14T09:15:30.123Z', '2024-07-14T09:15:30.123Z'])
            expect(out.aggregatedObjects).toEqual([{ ts: '2024-01-14T09:15:30.123Z', t: '1970-01-01T17:00:00.000Z' }])
            // The current date and time of the database, read as its instant
            expect(out.currentTimestampDrift).toBeLessThan(60_000)
            // A localTime on the reference date: 1970-01-01 (+01:00), and today, the current date of the database
            expect(out.constTime).toBe('1970-01-01T17:00:00.000Z')
            expect(out.constTimeToday).toMatch(/^\d{4}-\d{2}-\d{2}T1[67]:00:00\.000Z$/)
            expect(Number(String(out.constTimeToday).slice(0, 4))).toBeGreaterThan(2000)
            // A wall clock Madrid repeats when it leaves summer time is taken in winter time; one it skips when it
            // changes to summer time can't be read (a limit of Oracle)
            expect(out.repeated).toBe('2024-10-27T01:30:00.000Z')
            expect(out.skipped).toMatch(/^rejected: .*ORA-01878/)
        }, TIMEOUT)
    }

    // The session must be in the declared zone: ORA_SDTZ with its name. Unset, oracledb gives the session the offset of
    // the process, which doesn't follow summer time, also with the process in Madrid
    const runners = ['OracleDBQueryRunner', 'OracleDBPoolQueryRunner', 'OracleDBPoolPromiseQueryRunner']
    const sessions: { title: string, zone: string, env: Record<string, string | undefined>, expected: RegExp }[] = [
        { title: 'with-ora-sdtz-europe-madrid-is-accepted-in-asia-tokyo', zone: 'Asia/Tokyo', env: { ORA_SDTZ: 'Europe/Madrid' }, expected: /^executed$/ },
        { title: 'without-ora-sdtz-is-rejected-in-europe-madrid', zone: 'Europe/Madrid', env: {}, expected: /^rejected: INVALID_CONFIGURATION: .*ORA_SDTZ to 'Europe\/Madrid'/ },
        { title: 'without-ora-sdtz-is-rejected-in-utc', zone: 'UTC', env: {}, expected: /^rejected: INVALID_CONFIGURATION/ },
        { title: 'with-ora-sdtz-utc-is-rejected', zone: 'UTC', env: { ORA_SDTZ: 'UTC' }, expected: /^rejected: INVALID_CONFIGURATION/ },
        { title: 'with-ora-sdtz-an-offset-is-rejected', zone: 'Europe/Madrid', env: { ORA_SDTZ: '+01:00' }, expected: /^rejected: INVALID_CONFIGURATION/ },
        { title: 'with-ora-sdtz-dbtimezone-is-rejected', zone: 'Europe/Madrid', env: { ORA_SDTZ: 'DBTIMEZONE' }, expected: /^rejected: INVALID_CONFIGURATION/ },
    ]
    for (const runner of runners) {
        for (const session of sessions) {
            test(`${runner}-${session.title}`, async () => {
                expect(await runProbe(probe, 'firstQuery', { runner, zone: session.zone, env: session.env }, connection())).toMatch(session.expected)
            }, TIMEOUT)
        }
    }
})
