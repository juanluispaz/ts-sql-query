// A PostgreSQL database outside UTC, with its zone declared in the databaseTimeZone of the connection: the values
// without zone are wall clocks of Europe/Madrid, and the database completes their zone with its session, which is in
// that zone. A Date sent is stored as the wall clock of Madrid of its instant, a wall clock read is its instant, the
// date functions give the parts in UTC, and a localTime is completed with the localTimeReferenceDate.

import pg from 'pg'
import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { Table } from '../../../src/Table.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { PgQueryRunner } from '../../../src/queryRunners/PgQueryRunner.js'
import { PgLiteQueryRunner } from '../../../src/queryRunners/PgLiteQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { reasonOf } from '../lib/runnerContract.js'

class MadridConnection extends PostgreSqlConnection<'MadridConnection'> {
    protected override databaseTimeZone = 'Europe/Madrid'
}
class MadridTodayConnection extends PostgreSqlConnection<'MadridTodayConnection'> {
    protected override databaseTimeZone = 'Europe/Madrid'
    protected override localTimeReferenceDate = 'today'
}
class UtcConnection extends PostgreSqlConnection<'UtcConnection'> { }

class TMoment extends Table<MadridConnection, 'TMoment'> {
    id = this.primaryKey('id', 'int')
    ts = this.optionalColumn('ts', 'localDateTime')
    tstz = this.optionalColumn('tstz', 'localDateTime')
    t = this.optionalColumn('t', 'localTime')
    constructor() {
        super('rt_madrid_moment')
    }
}

// 09:15:30.123Z is 10:15:30.123 in Madrid in winter, 11:15:30.123 in summer
const winter = new Date('2024-01-14T09:15:30.123Z')
const summer = new Date('2024-07-14T09:15:30.123Z')

async function scenario(runner: QueryRunner, raw: (sql: string) => Promise<any[]>): Promise<void> {
    await raw('drop table if exists rt_madrid_moment')
    await raw('create table rt_madrid_moment (id int primary key, ts timestamp, tstz timestamptz, t time)')
    try {
        const conn = new MadridConnection(runner)
        const tMoment = new TMoment()
        // Sent: stored as the wall clock of Madrid
        await conn.insertInto(tMoment).set({ id: 1, ts: winter, tstz: winter, t: new Date('1970-01-01T17:00:00.000Z') }).executeInsert()
        await conn.insertInto(tMoment).set({ id: 2, ts: summer, tstz: summer }).executeInsert()
        expect(await raw("select id, ts::text as ts, to_char(tstz at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') as tstz_utc, t::text as t from rt_madrid_moment order by id")).toEqual([
            { id: 1, ts: '2024-01-14 10:15:30.123', tstz_utc: '2024-01-14 09:15:30.123', t: '18:00:00' },
            { id: 2, ts: '2024-07-14 11:15:30.123', tstz_utc: '2024-07-14 09:15:30.123', t: null },
        ])
        // Written by another program of this database: wall clocks of Madrid
        await raw("insert into rt_madrid_moment values (3, '2024-01-14 10:15:30.123', '2024-01-14 10:15:30.123', '18:00')")
        // Read: the instant, with the date functions in UTC
        const rows = await conn.selectFrom(tMoment)
            .select({ id: tMoment.id, ts: tMoment.ts, tstz: tMoment.tstz, t: tMoment.t, hours: tMoment.ts.getHours(), time: tMoment.ts.getTime(), tHours: tMoment.t.getHours(), same: tMoment.ts.equals(tMoment.tstz) })
            .orderBy('id').executeSelectMany()
        expect(rows).toEqual([
            { id: 1, ts: winter, tstz: winter, t: new Date('1970-01-01T17:00:00.000Z'), hours: 9, time: winter.getTime(), tHours: 17, same: true },
            { id: 2, ts: summer, tstz: summer, hours: 9, time: summer.getTime(), same: true },
            { id: 3, ts: winter, tstz: winter, t: new Date('1970-01-01T17:00:00.000Z'), hours: 9, time: winter.getTime(), tHours: 17, same: true },
        ])
        // Compared: with the wall clock of Madrid of the instant
        expect((await conn.selectFrom(tMoment).where(tMoment.ts.equals(winter)).select({ id: tMoment.id }).orderBy('id').executeSelectMany()).map(row => row.id)).toEqual([1, 3])
        expect((await conn.selectFrom(tMoment).where(tMoment.t.equals(new Date('1970-01-01T17:00:00.000Z'))).select({ id: tMoment.id }).orderBy('id').executeSelectMany()).map(row => row.id)).toEqual([1, 3])
        // Inside the JSON of an aggregated array
        expect(await conn.selectFrom(tMoment).where(tMoment.id.in([1, 2])).selectOneColumn(conn.aggregateAsArrayOfOneColumn(tMoment.ts)).executeSelectOne()).toEqual([winter, summer])
        // The current date and time of the database, in the zone of the database, read as its instant
        const before = Date.now()
        const now = await conn.selectFromNoTable().selectOneColumn(conn.currentTimestamp()).executeSelectOne()
        expect(Math.abs(now.getTime() - before)).toBeLessThan(60_000)
        // A localTime on today, the current date of the database: its offset is the one of today in Madrid
        const today = await new MadridTodayConnection(runner).selectFromNoTable().selectOneColumn(new MadridTodayConnection(runner).const(new Date('1970-01-01T17:00:00.000Z'), 'localTime')).executeSelectOne()
        expect([16, 17]).toContain(today.getUTCHours())
        expect(today.getUTCFullYear()).toBeGreaterThan(2000)
    } finally {
        await raw('drop table rt_madrid_moment')
    }
}

describe.skipIf(!isRealDbEnabled('postgres', 'wasm', 'newest', 'pglite'))('PGlite: a database in Europe/Madrid, declared in the connection', () => {
    test('the-values-without-zone-are-wall-clocks-of-madrid', async () => {
        const { PGlite } = await import('@electric-sql/pglite')
        const db = await PGlite.create('memory://', { postgresqlconf: ["timezone = 'Europe/Madrid'"] })
        try {
            await scenario(new PgLiteQueryRunner(db), async (sql) => (await db.query<any>(sql)).rows)
        } finally {
            await db.close()
        }
    })
})

describe.skipIf(!isRealDbEnabled('postgres', 'docker', 'newest', 'pg'))('pg: a session in Europe/Madrid, the zone declared in the connection', () => {
    test('the-values-without-zone-are-wall-clocks-of-madrid', async () => {
        const db = await acquireRunnerTestDatabase()
        const client = new pg.Client({ connectionString: db.uri, options: '-c TimeZone=Europe/Madrid' })
        await client.connect()
        try {
            await scenario(new PgQueryRunner(client), async (sql) => (await client.query(sql)).rows)
        } finally {
            await client.end()
            await db.release()
        }
    }, 300_000)

    test('a-session-in-madrid-is-rejected-when-the-connection-declares-utc', async () => {
        const db = await acquireRunnerTestDatabase()
        const client = new pg.Client({ connectionString: db.uri, options: '-c TimeZone=Europe/Madrid' })
        await client.connect()
        try {
            const conn = new UtcConnection(new PgQueryRunner(client))
            let error: unknown
            try {
                await conn.selectFromNoTable().selectOneColumn(conn.const(1, 'int')).executeSelectOne()
            } catch (e) {
                error = e
            }
            expect(reasonOf(error)).toBe('INVALID_CONFIGURATION')
        } finally {
            await client.end()
            await db.release()
        }
    }, 300_000)
})
