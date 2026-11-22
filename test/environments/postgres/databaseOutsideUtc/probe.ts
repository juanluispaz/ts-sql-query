// Run by DatabaseOutsideUtc.test.ts in a process of its own, started with TZ set (the zone of a process is set when it
// starts). Mode `scenario` builds the runner it is told, with its session in Europe/Madrid (PGlite: its database
// created in Madrid), runs the queries of a database in Europe/Madrid declared in the connection and prints what was
// stored and read; mode `firstQuery` builds the runner with its session in Madrid and prints the outcome of the first
// query of a connection that declares the zone it is told; mode `timeWithTimeZone` reads a time with time zone with the
// database and the session in UTC; mode `declaredTypes` sends a localDateTime and a localTime with a type that
// driverTypeOf of the runner gives them (postgres.js, PGlite).

import { readFile } from 'node:fs/promises'
import { PostgreSqlConnection } from '../../../../src/connections/PostgreSqlConnection.js'
import { Table } from '../../../../src/Table.js'
import type { QueryRunner } from '../../../../src/queryRunners/QueryRunner.js'
import type { QueryParamContext } from '../../../../src/QueryContext.js'
import { printResult, probeConfig } from '../../lib/localTemporalValuesProbe.js'
import { reasonOf } from '../../../runners/lib/runnerContract.js'

interface Config {
    mode: 'scenario' | 'firstQuery' | 'timeWithTimeZone' | 'declaredTypes'
    runner: string
    options: { table?: string, compatibilityVersion?: number, declaredZone?: string, utc?: boolean, declaredTypes?: boolean }
    connection: { uri: string } | undefined
}

const config = probeConfig<Config>()
const uri = config.connection?.uri ?? ''
const compatibilityVersion = config.options.compatibilityVersion ?? Number.POSITIVE_INFINITY
// The zone of the session (PGlite: of its database): Madrid, or UTC with the option utc
const zone = config.options.utc ? 'UTC' : 'Europe/Madrid'
// The types of the runner, with declaredTypes: the OID of a timestamp and of a time
const oidTypes = config.options.declaredTypes ? { driverTypeOf: (param: QueryParamContext) => param.requestedType?.type === 'localDateTime' ? 1114 : param.requestedType?.type === 'localTime' ? 1083 : undefined } : undefined

class MadridConnection extends PostgreSqlConnection<'MadridConnection'> {
    protected override databaseTimeZone = 'Europe/Madrid'
    protected override compatibilityVersion = compatibilityVersion
}

/** The same connection with the functions of the library that take a wall clock to its zone as Temporal */
class MadridConnectionWithFunctions extends MadridConnection {
    protected override libraryFunctions = 'installed' as const
}
class MadridTodayConnection extends PostgreSqlConnection<'MadridConnection'> {
    protected override databaseTimeZone = 'Europe/Madrid'
    protected override compatibilityVersion = compatibilityVersion
    protected override dateToConvertTimesBetweenZones = 'today'
}
// The same database, with a reference date of summer
class MadridSummerConnection extends PostgreSqlConnection<'MadridConnection'> {
    protected override databaseTimeZone = 'Europe/Madrid'
    protected override compatibilityVersion = compatibilityVersion
    protected override dateToConvertTimesBetweenZones = '2024-07-14'
}
// A connection that declares the zone it is told (UTC when none), for the first query
class DeclaredConnection extends PostgreSqlConnection<'MadridConnection'> {
    protected override databaseTimeZone = config.options.declaredZone ?? 'UTC'
}

const tableName = config.options.table ?? 'rt_madrid_moment'
class TMoment extends Table<MadridConnection, 'TMoment'> {
    id = this.primaryKey('id', 'int')
    ts = this.optionalColumn('ts', 'localDateTime')
    tstz = this.optionalColumn('tstz', 'localDateTime')
    t = this.optionalColumn('t', 'localTime')
    // A time with time zone column
    ttz = this.optionalColumn('ttz', 'localTime')
    constructor() {
        super(tableName)
    }
}
const tMoment = new TMoment()
// The same table, its date and time columns read as instants (Temporal.Instant)
class TInstantMoment extends Table<MadridConnection, 'TInstantMoment'> {
    id = this.primaryKey('id', 'int')
    ts = this.optionalColumn('ts', 'instant')
    tstz = this.optionalColumn('tstz', 'instant')
    // The same column, as a date and time of the zone of the database
    tsPlain = this.optionalColumn('ts', 'plainDateTime')
    constructor() {
        super(tableName)
    }
}
const tInstantMoment = new TInstantMoment()

// 09:15:30.123Z is 10:15:30.123 in Madrid in winter, 11:15:30.123 in summer; in 1960 Madrid was at +01:00 in summer
const winter = new Date('2024-01-14T09:15:30.123Z')
const summer = new Date('2024-07-14T09:15:30.123Z')
const old = new Date('1960-07-14T09:15:30.123Z')
const time17 = new Date('1970-01-01T17:00:00.000Z')

const iso = (value: unknown): unknown => value instanceof Date ? value.toISOString() : value
const isoRow = (row: object): Record<string, unknown> => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, iso(value)]))

async function outcomeOf(execute: () => Promise<unknown>): Promise<string> {
    try {
        await execute()
        return 'executed'
    } catch (error) {
        return 'rejected: ' + reasonOf(error) + ': ' + (error instanceof Error ? error.message.split('\n')[0] : String(error))
    }
}

/** The runner, with its session in the zone (Europe/Madrid unless utc), and the driver it holds, for the SQL of the test (raw) */
async function createRunner(): Promise<{ runner: QueryRunner, raw: (sql: string) => Promise<any[]>, close: () => Promise<unknown> }> {
    switch (config.runner) {
        case 'PgQueryRunner': {
            const { default: pg } = await import('pg')
            const { PgQueryRunner } = await import('../../../../src/queryRunners/PgQueryRunner.js')
            const client = new pg.Client({ connectionString: uri, options: '-c TimeZone=' + zone })
            await client.connect()
            return { runner: new PgQueryRunner(client), raw: async (sql) => (await client.query(sql)).rows, close: () => client.end() }
        }
        case 'PgPoolQueryRunner': {
            const { default: pg } = await import('pg')
            const { PgPoolQueryRunner } = await import('../../../../src/queryRunners/PgPoolQueryRunner.js')
            const pool = new pg.Pool({ connectionString: uri, max: 2, options: '-c TimeZone=' + zone })
            return { runner: new PgPoolQueryRunner(pool), raw: async (sql) => (await pool.query(sql)).rows, close: () => pool.end() }
        }
        case 'PostgresQueryRunner': {
            const { default: postgres } = await import('postgres')
            const { PostgresQueryRunner } = await import('../../../../src/queryRunners/PostgresQueryRunner.js')
            const sql = postgres(uri, { max: 2, onnotice: () => undefined, connection: { TimeZone: zone } })
            return { runner: new PostgresQueryRunner(sql, oidTypes), raw: async (text) => [...await sql.unsafe(text)], close: () => sql.end() }
        }
        case 'BunSqlPostgresQueryRunner': {
            const { SQL } = await import('bun')
            const { BunSqlPostgresQueryRunner } = await import('../../../../src/queryRunners/BunSqlPostgresQueryRunner.js')
            const sql = new SQL(uri, { max: 2, connection: { TimeZone: zone } })
            return { runner: new BunSqlPostgresQueryRunner(sql), raw: async (text) => [...await sql.unsafe(text)], close: () => sql.close() }
        }
        case 'PgLiteQueryRunner': {
            const { PGlite } = await import('@electric-sql/pglite')
            const { PgLiteQueryRunner } = await import('../../../../src/queryRunners/PgLiteQueryRunner.js')
            // A database created in Madrid: its session is in Madrid, whatever the zone of the process
            const db = await PGlite.create('memory://', { postgresqlconf: [`timezone = '${zone}'`] })
            // Every function of the library, as the schema of the tests creates them: the connection says they are installed
            const schema = await readFile(new URL('../../../db/postgres/domain/schema.sql', import.meta.url), 'utf8')
            for (let start = schema.indexOf('CREATE OR REPLACE FUNCTION tsq_'); start >= 0; start = schema.indexOf('CREATE OR REPLACE FUNCTION tsq_', start + 1)) {
                const body = schema.indexOf('$$', start)
                await db.exec(schema.slice(start, schema.indexOf('$$;', body + 2) + 3))
            }
            return { runner: new PgLiteQueryRunner(db, oidTypes), raw: async (sql) => (await db.query<any>(sql)).rows, close: () => db.close() }
        }
        default:
            throw new Error('Unknown runner ' + config.runner)
    }
}

/** What the scenario stored and read, printed for DatabaseOutsideUtc.test.ts (the Dates as their ISO text) */
export interface ScenarioResult {
    session: string
    stored: unknown[]
    read: Record<string, unknown>[]
    whereTs: number[]
    whereOld: number[]
    whereT: number[]
    aggregated: unknown[]
    currentTimestampDrift: number
    constTimeToday: unknown
    summerTime: { stored: unknown[], read: unknown }
    timeAfterMidnight: { stored: unknown[], read: unknown, where: number[] }
    timeWithTimeZone: { delivered: unknown, read: unknown, hours: unknown }
    repeated: unknown
    skipped: unknown
    instant: { stored: unknown[], read: unknown[], where: number[], aggregated: unknown[], currentDrift: number, repeated: unknown, methods: unknown }
    zoned: unknown
    nativeNextDay: string
}

async function scenario(): Promise<ScenarioResult> {
    const { runner, raw, close } = await createRunner()
    try {
        await raw('drop table if exists ' + tableName)
        await raw('create table ' + tableName + ' (id int primary key, ts timestamp(3), tstz timestamptz, t time(3), ttz timetz(3))')
        try {
            const conn = new MadridConnection(runner)
            const session = (await raw('select current_setting(\'TimeZone\') as s'))[0].s
            // Sent: stored as the wall clock of Madrid of the instant (1960 at +01:00, summer at +02:00)
            await conn.insertInto(tMoment).set({ id: 1, ts: winter, tstz: winter, t: time17 }).executeInsert()
            await conn.insertInto(tMoment).values([{ id: 2, ts: summer, tstz: summer }, { id: 5, ts: old }]).executeInsert()
            const stored = await raw(`select id, ts::text as ts, to_char(tstz at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') as tstz_utc, t::text as t from ${tableName} order by id`)
            // Written by another program of this database: wall clocks of Madrid, and a time with its own offset
            await raw(`insert into ${tableName} values (3, '2024-01-14 10:15:30.123', '2024-01-14 10:15:30.123', '18:00', '19:30:15.123+09')`)
            // Read: the instant, with the date functions in UTC
            const read = (await conn.selectFrom(tMoment).where(tMoment.id.in([1, 2, 3, 5]))
                .select({
                    id: tMoment.id, ts: tMoment.ts, tstz: tMoment.tstz, t: tMoment.t,
                    hours: tMoment.ts.getHours(), date: tMoment.ts.getDate(), month: tMoment.ts.getMonth(), year: tMoment.ts.getFullYear(), time: tMoment.ts.getTime(),
                    tHours: tMoment.t.getHours(), same: tMoment.ts.equals(tMoment.tstz),
                })
                .orderBy('id').executeSelectMany()).map(isoRow)
            // Compared: with the wall clock of Madrid of the instant
            const idsWhere = async (query: { executeSelectMany(): Promise<{ id: number }[]> }) => (await query.executeSelectMany()).map(row => row.id)
            const whereTs = await idsWhere(conn.selectFrom(tMoment).where(tMoment.ts.equals(winter)).select({ id: tMoment.id }).orderBy('id'))
            const whereOld = await idsWhere(conn.selectFrom(tMoment).where(tMoment.ts.equals(old)).select({ id: tMoment.id }).orderBy('id'))
            const whereT = await idsWhere(conn.selectFrom(tMoment).where(tMoment.t.equals(time17)).select({ id: tMoment.id }).orderBy('id'))
            // Inside the JSON of an aggregated array
            const aggregated = (await conn.selectFrom(tMoment).where(tMoment.id.in([1, 2])).selectOneColumn(conn.aggregateAsArrayOfOneColumn(tMoment.ts)).executeSelectOne()).map(iso)
            // The current date and time of the database, read as its instant
            const before = Date.now()
            const currentTimestampDrift = Math.abs((await conn.selectFromNoTable().selectOneColumn(conn.currentTimestamp()).executeSelectOne()).getTime() - before)
            // A localTime on today, the current date of the database
            const today = new MadridTodayConnection(runner)
            const constTimeToday = iso(await today.selectFromNoTable().selectOneColumn(today.const(time17, 'localTime')).executeSelectOne())
            // A localTime on a day of summer, the reference date: written and read with the offset of that day (18:00 in
            // Madrid is 16:00Z in summer)
            const summerConn = new MadridSummerConnection(runner)
            await summerConn.insertInto(tMoment).set({ id: 4, t: new Date('2024-07-14T16:00:00.000Z') }).executeInsert()
            const summerTime = {
                stored: (await raw(`select t::text as t from ${tableName} where id = 4`)).map(row => row.t),
                read: iso(await summerConn.selectFrom(tMoment).where(tMoment.id.equals(4)).selectOneColumn(tMoment.t).executeSelectOne()),
            }
            // A localTime after midnight in Madrid (00:30, 23:30Z of the day before)
            const afterMidnight = new Date('1969-12-31T23:30:00.000Z')
            await conn.insertInto(tMoment).set({ id: 9, t: afterMidnight }).executeInsert()
            const timeAfterMidnight = {
                stored: (await raw(`select t::text as t from ${tableName} where id = 9`)).map(row => row.t),
                read: iso(await conn.selectFrom(tMoment).where(tMoment.id.equals(9)).selectOneColumn(tMoment.t).executeSelectOne()),
                where: await idsWhere(conn.selectFrom(tMoment).where(tMoment.t.equals(afterMidnight)).select({ id: tMoment.id }).orderBy('id')),
            }
            // A time with time zone: what the driver delivers, and what the library reads
            const timeWithTimeZone = {
                delivered: iso((await raw(`select ttz from ${tableName} where id = 3`))[0].ttz),
                read: iso(await conn.selectFrom(tMoment).where(tMoment.id.equals(3)).selectOneColumn(tMoment.ttz).executeSelectOne()),
                hours: await conn.selectFrom(tMoment).where(tMoment.id.equals(3)).selectOneColumn(tMoment.ttz.getHours()).executeSelectOne(),
            }
            // A wall clock that is repeated when Madrid leaves summer time, and one it skips when it changes to summer time
            await raw(`insert into ${tableName} (id, ts) values (7, '2024-10-27 02:30:00'), (8, '2024-03-31 02:30:00')`)
            const repeated = iso(await conn.selectFrom(tMoment).where(tMoment.id.equals(7)).selectOneColumn(tMoment.ts).executeSelectOne())
            const skipped = iso(await conn.selectFrom(tMoment).where(tMoment.id.equals(8)).selectOneColumn(tMoment.ts).executeSelectOne())
            // An instant: stored as the wall clock of Madrid of the instant, read, compared and aggregated as its
            // instant, the current instant of the database, and a wall clock that Madrid repeats taken in winter time
            const instantWinter = Temporal.Instant.from('2024-01-14T09:15:30.123Z')
            await conn.insertInto(tInstantMoment).set({ id: 11, ts: instantWinter, tstz: instantWinter }).executeInsert()
            const instantText = (value: unknown): unknown => value instanceof Temporal.Instant ? value.toString() : value
            const beforeInstant = Temporal.Now.instant()
            const instant = {
                stored: await raw(`select ts::text as ts, to_char(tstz at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') as tstz_utc from ${tableName} where id = 11`),
                read: (await conn.selectFrom(tInstantMoment).where(tInstantMoment.id.in([1, 3, 11])).select({ id: tInstantMoment.id, ts: tInstantMoment.ts, tstz: tInstantMoment.tstz }).orderBy('id').executeSelectMany())
                    .map(row => ({ id: row.id, ts: instantText(row.ts), tstz: instantText(row.tstz) })),
                where: await idsWhere(conn.selectFrom(tInstantMoment).where(tInstantMoment.ts.equals(instantWinter)).select({ id: tInstantMoment.id }).orderBy('id')),
                aggregated: (await conn.selectFrom(tInstantMoment).where(tInstantMoment.id.in([1, 11])).selectOneColumn(conn.aggregateAsArrayOfOneColumn(tInstantMoment.ts)).executeSelectOne()).map(instantText),
                currentDrift: Math.abs(Number((await conn.selectFromNoTable().selectOneColumn(conn.currentInstant()).executeSelectOne()).since(beforeInstant).total('millisecond'))),
                repeated: instantText(await conn.selectFrom(tInstantMoment).where(tInstantMoment.id.equals(7)).selectOneColumn(tInstantMoment.ts).executeSelectOne()),
            // Its epoch, its date and time in the zone of the database, and a wall clock of that zone as an instant
            methods: await conn.selectFrom(tInstantMoment).where(tInstantMoment.id.equals(11)).select({
                milliseconds: tInstantMoment.ts.epochMilliseconds(), nanoseconds: tInstantMoment.tstz.epochNanoseconds(),
                wall: tInstantMoment.ts.toPlainDateTime(), zonedWall: tInstantMoment.tstz.toPlainDateTime(), hour: tInstantMoment.tstz.toPlainDateTime().hour(),
                instant: tInstantMoment.tsPlain.toInstant(),
                // A date and time without zone gives the parts of its digits, the wall clock of Madrid
                plainHour: tInstantMoment.tsPlain.hour(), plainDay: tInstantMoment.tsPlain.toPlainDate(),
                // Its arithmetic, on its wall clock in UTC, and the instant of its epoch: instants again
                plusAnHour: tInstantMoment.ts.add({ hours: 1 }), hourOf: tInstantMoment.tstz.round('hour'),
                ofItsEpoch: conn.instantFromEpochMilliseconds(tInstantMoment.ts.epochMilliseconds()),
            }).executeSelectOne().then(row => ({ ...row, nanoseconds: String(row.nanoseconds), wall: String(row.wall), zonedWall: String(row.zonedWall), instant: String(row.instant), plainDay: String(row.plainDay), plusAnHour: String(row.plusAnHour), hourOf: String(row.hourOf), ofItsEpoch: String(row.ofItsEpoch) })),
            }
            // The arithmetic of a zoned date and time follows the rules of its zone (New York goes back an hour on
            // 2024-11-03), whatever the zone of the session
            const exact = new MadridConnectionWithFunctions(runner)
            const newYork = exact.const(Temporal.ZonedDateTime.from('2024-11-02T01:30:00-04:00[America/New_York]'), 'zonedDateTime')
            const zoned = await exact.selectFromNoTable().select({
                nextDay: newYork.add({ days: 1 }), dayAfter: newYork.add({ hours: 24 }), rounded: newYork.add({ days: 1, hours: 11 }).round('day'),
                start: newYork.add({ days: 1, hours: 3 }).startOfDay(), hours: newYork.add({ days: 1 }).hoursInDay(), with: newYork.add({ days: 1 }).with({ minute: 45 }, { offset: 'ignore', disambiguation: 'later' }),
                days: newYork.until(newYork.add({ days: 2 }), { largestUnit: 'day' }),
            }).executeSelectOne().then(row => ({ ...row, nextDay: String(row.nextDay), dayAfter: String(row.dayAfter), rounded: String(row.rounded), start: String(row.start), with: String(row.with), days: String(row.days) }))
            // Without them, the 01:30 New York repeats that day is PostgreSQL's later one
            const nativeNextDay = String(await conn.selectFromNoTable().selectOneColumn(conn.const(Temporal.ZonedDateTime.from('2024-11-02T01:30:00-04:00[America/New_York]'), 'zonedDateTime').add({ days: 1 })).executeSelectOne())
            return { session, stored, read, whereTs, whereOld, whereT, aggregated, currentTimestampDrift, constTimeToday, summerTime, timeAfterMidnight, timeWithTimeZone, repeated, skipped, instant, zoned, nativeNextDay }
        } finally {
            await raw('drop table ' + tableName)
        }
    } finally {
        await close()
    }
}

async function firstQuery(): Promise<string> {
    const { runner, close } = await createRunner()
    try {
        const conn = new DeclaredConnection(runner)
        return await outcomeOf(() => conn.selectFromNoTable().selectOneColumn(conn.const(1, 'int')).executeSelectOne())
    } finally {
        await close()
    }
}

class UtcConnection extends PostgreSqlConnection<'MadridConnection'> {
    protected override compatibilityVersion = compatibilityVersion
}

/** A time with time zone with the database in UTC: what the driver delivers, and what the library reads */
async function timeWithTimeZone(): Promise<ScenarioResult['timeWithTimeZone']> {
    const { runner, raw, close } = await createRunner()
    try {
        await raw('drop table if exists ' + tableName)
        await raw('create table ' + tableName + ' (id int primary key, ts timestamp(3), tstz timestamptz, t time(3), ttz timetz(3))')
        try {
            await raw(`insert into ${tableName} (id, ttz) values (3, '19:30:15.123+09')`)
            const conn = new UtcConnection(runner)
            return {
                delivered: iso((await raw(`select ttz from ${tableName} where id = 3`))[0].ttz),
                read: iso(await conn.selectFrom(tMoment).where(tMoment.id.equals(3)).selectOneColumn(tMoment.ttz).executeSelectOne()),
                hours: await conn.selectFrom(tMoment).where(tMoment.id.equals(3)).selectOneColumn(tMoment.ttz.getHours()).executeSelectOne(),
            }
        } finally {
            await raw('drop table ' + tableName)
        }
    } finally {
        await close()
    }
}

/** A localDateTime and a localTime with a type declared for them: what is stored, compared and read */
async function declaredTypes(): Promise<{ sql: string[], stored: unknown[], where: number[], read: Record<string, unknown> }> {
    const { runner, raw, close } = await createRunner()
    try {
        await raw('drop table if exists ' + tableName)
        await raw('create table ' + tableName + ' (id int primary key, ts timestamp(3), tstz timestamptz, t time(3), ttz timetz(3))')
        try {
            const conn = new MadridConnection(runner)
            const insert = conn.insertInto(tMoment).set({ id: 1, ts: winter, t: time17 })
            await insert.executeInsert()
            // A constant selected on its own: a position where the database must receive its type
            const select = conn.selectFrom(tMoment).select({ ts: tMoment.ts, t: tMoment.t, constTs: conn.const(winter, 'localDateTime') })
            return {
                sql: [insert.query(), select.query()],
                stored: await raw(`select ts::text as ts, t::text as t from ${tableName}`),
                where: (await conn.selectFrom(tMoment).where(tMoment.ts.equals(winter)).and(tMoment.t.equals(time17)).select({ id: tMoment.id }).executeSelectMany()).map(row => row.id),
                read: isoRow(await select.executeSelectOne()),
            }
        } finally {
            await raw('drop table ' + tableName)
        }
    } finally {
        await close()
    }
}

printResult(config.mode === 'scenario' ? await scenario() : config.mode === 'firstQuery' ? await firstQuery() : config.mode === 'declaredTypes' ? await declaredTypes() : await timeWithTimeZone())
