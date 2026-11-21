// Run by DatabaseOutsideUtc.test.ts in a process of its own, started with TZ and ORA_SDTZ set (the zone of a process
// and the zone oracledb gives the session are set when they start). Mode `scenario` runs the queries of a database in
// Europe/Madrid declared in the connection, through the runner it is told, and prints what was stored and read; mode `firstQuery` builds the runner it
// is told and prints the outcome of its first query.

import { OracleConnection } from '../../../../src/connections/OracleConnection.js'
import { Table } from '../../../../src/Table.js'
import { OracleDateAsTimestampTypeAdapter } from '../../../../src/TypeAdapter.js'
import type { QueryRunner } from '../../../../src/queryRunners/QueryRunner.js'
import { printResult, probeConfig } from '../../lib/localTemporalValuesProbe.js'
import { reasonOf } from '../../../runners/lib/runnerContract.js'

interface Config {
    mode: 'scenario' | 'firstQuery'
    runner: string
    options: { table?: string, compatibilityVersion?: number }
    connection: { user: string, password: string, connectString: string }
}

const config = probeConfig<Config>()
const db = config.connection
const { default: oracledb } = await import('oracledb')

class MadridConnection extends OracleConnection<'MadridConnection'> {
    protected override databaseTimeZone = 'Europe/Madrid'
    protected override compatibilityVersion = config.options.compatibilityVersion ?? Number.POSITIVE_INFINITY
}
// The same database, with a reference date of summer
class MadridSummerConnection extends OracleConnection<'MadridConnection'> {
    protected override databaseTimeZone = 'Europe/Madrid'
    protected override compatibilityVersion = config.options.compatibilityVersion ?? Number.POSITIVE_INFINITY
    protected override dateToConvertTimesBetweenZones = '2024-07-14'
}
/** The same connection with the functions of the library that take a wall clock to its zone as Temporal */
class MadridConnectionWithFunctions extends MadridConnection {
    protected override temporalFunctions = 'installed' as const
}
class MadridTodayConnection extends OracleConnection<'MadridTodayConnection'> {
    protected override databaseTimeZone = 'Europe/Madrid'
    protected override compatibilityVersion = config.options.compatibilityVersion ?? Number.POSITIVE_INFINITY
    protected override dateToConvertTimesBetweenZones = 'today'
}

const tableName = config.options.table ?? 'rt_ora_madrid'
class TMoment extends Table<MadridConnection, 'TMoment'> {
    id = this.primaryKey('id', 'int')
    ts = this.optionalColumn('ts', 'localDateTime')
    // A DATE column
    dx = this.optionalColumn('dx', 'localDateTime', new OracleDateAsTimestampTypeAdapter())
    t = this.optionalColumn('t', 'localTime')
    // A timestamp with time zone column
    tz = this.optionalColumn('tz', 'localDateTime')
    constructor() {
        super(tableName)
    }
}
const tMoment = new TMoment()
// The same table, its date and time columns read as instants (Temporal.Instant)
class TInstantMoment extends Table<MadridConnection, 'TInstantMoment'> {
    id = this.primaryKey('id', 'int')
    ts = this.optionalColumn('ts', 'instant')
    dx = this.optionalColumn('dx', 'instant')
    tz = this.optionalColumn('tz', 'instant')
    // The same column, as a date and time of the zone of the database
    tsPlain = this.optionalColumn('ts', 'plainDateTime')
    constructor() {
        super(tableName)
    }
}
const tInstantMoment = new TInstantMoment()

// 09:15:30.123Z is 10:15:30.123 in Madrid in winter, 11:15:30.123 in summer; in 1960 Madrid was at +01:00 in summer
const winter = new Date('2024-01-14T09:15:30.123Z')
const winterWhole = new Date('2024-01-14T09:15:30.000Z')
const summer = new Date('2024-07-14T09:15:30.123Z')
const old = new Date('1960-07-14T09:15:30.123Z')
const oldWhole = new Date('1960-07-14T09:15:30.000Z')
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

/** What the scenario stored and read, printed for DatabaseOutsideUtc.test.ts (the Dates as their ISO text) */
export interface ScenarioResult {
    session?: string
    returning?: Record<string, unknown>
    insertSql?: string
    stored?: unknown[]
    read?: Record<string, unknown>[]
    whereTs?: number[]
    whereOld?: number[]
    whereDx?: number[]
    whereDxFraction?: number[]
    whereT?: number[]
    whereSql?: { ts: string, dx: string }
    plan?: { ts: string, dx: string }
    aggregated?: unknown[]
    aggregatedObjects?: Record<string, unknown>[]
    currentTimestampDrift?: number
    constTime?: unknown
    constTimeToday?: unknown
    repeated?: unknown
    skipped?: string
    summerTime?: { stored: unknown[], read: unknown }
    timeAfterMidnight?: { stored: unknown[], where: number[] }
    instant?: { sql: string[], stored: unknown[], read: unknown[], where: number[], whereDx: number[], returning: unknown, aggregated: unknown[], currentDrift: number, repeated: unknown, methods: unknown }
    zoned?: unknown
    nativeNextDay?: string
}

async function scenario(): Promise<ScenarioResult> {
    const connection = await oracledb.getConnection(db)
    const raw = async (sql: string, binds: any = {}): Promise<any[]> => (await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: true })).rows ?? []
    const out: ScenarioResult = {}
    let closeRunner: (() => Promise<unknown>) | undefined
    try { await raw('drop table ' + tableName + ' purge') } catch { /* it doesn't exist */ }
    await raw('create table ' + tableName + ' (id number primary key, ts timestamp(3), dx date, t timestamp(3), tz timestamp(3) with time zone)')
    await raw('create index ' + tableName + '_ts on ' + tableName + ' (ts)')
    await raw('create index ' + tableName + '_dx on ' + tableName + ' (dx)')
    try {
        const created = await createRunner()
        closeRunner = created.close
        const conn = new MadridConnection(created.runner)
        out.session = (await raw('select sessiontimezone as s from dual'))[0].S
        // Sent: stored as the wall clock of Madrid of the instant
        await conn.insertInto(tMoment).set({ id: 1, ts: winter, dx: winterWhole, t: time17, tz: winter }).executeInsert()
        await conn.insertInto(tMoment).values([{ id: 2, ts: summer, dx: oldWhole, tz: summer }, { id: 5, ts: old }]).executeInsert()
        await conn.update(tMoment).set({ t: time17 }).where(tMoment.id.equals(5)).executeUpdate()
        out.returning = isoRow(await conn.insertInto(tMoment).set({ id: 6, ts: winter }).returning({ ts: tMoment.ts }).executeInsertOne())
        out.insertSql = conn.insertInto(tMoment).set({ id: 1, ts: winter }).query()
        out.stored = await raw(`select id, to_char(ts, 'YYYY-MM-DD HH24:MI:SS.FF3') as ts, to_char(dx, 'YYYY-MM-DD HH24:MI:SS') as dx, to_char(t, 'YYYY-MM-DD HH24:MI:SS.FF3') as t, to_char(sys_extract_utc(tz), 'YYYY-MM-DD HH24:MI:SS.FF3') as tz_utc from ${tableName} order by id`)
        // Written by another program of this database: wall clocks of Madrid; the time of a localTime on a day of summer
        await raw(`insert into ${tableName} (id, ts, dx, t) values (3, timestamp '2024-01-14 10:15:30.123', timestamp '2024-01-14 10:15:30', timestamp '2024-07-14 18:00:00')`)
        // Read: the instant, with the date functions in UTC
        out.read = (await conn.selectFrom(tMoment).where(tMoment.id.in([1, 2, 3, 5]))
            .select({
                id: tMoment.id, ts: tMoment.ts, dx: tMoment.dx, t: tMoment.t, tz: tMoment.tz,
                hours: tMoment.ts.getHours(), minutes: tMoment.ts.getMinutes(), seconds: tMoment.ts.getSeconds(), milliseconds: tMoment.ts.getMilliseconds(),
                date: tMoment.ts.getDate(), day: tMoment.ts.getDay(), month: tMoment.ts.getMonth(), year: tMoment.ts.getFullYear(), time: tMoment.ts.getTime(),
                dxHours: tMoment.dx.getHours(), dxTime: tMoment.dx.getTime(), tHours: tMoment.t.getHours(), same: tMoment.ts.equals(tMoment.tz),
            })
            .orderBy('id').executeSelectMany()).map(isoRow)
        // Compared: with the wall clock of Madrid of the instant, using the index of the column
        const idsWhere = async (query: { executeSelectMany(): Promise<{ id: number }[]> }) => (await query.executeSelectMany()).map(row => row.id)
        out.whereTs = await idsWhere(conn.selectFrom(tMoment).where(tMoment.ts.equals(winter)).select({ id: tMoment.id }).orderBy('id'))
        out.whereOld = await idsWhere(conn.selectFrom(tMoment).where(tMoment.ts.equals(old)).select({ id: tMoment.id }).orderBy('id'))
        out.whereDx = await idsWhere(conn.selectFrom(tMoment).where(tMoment.dx.equals(winterWhole)).select({ id: tMoment.id }).orderBy('id'))
        out.whereDxFraction = await idsWhere(conn.selectFrom(tMoment).where(tMoment.dx.equals(winter)).select({ id: tMoment.id }).orderBy('id'))
        out.whereT = await idsWhere(conn.selectFrom(tMoment).where(tMoment.id.in([1, 5])).and(tMoment.t.equals(time17)).select({ id: tMoment.id }).orderBy('id'))
        const whereTsQuery = conn.selectFrom(tMoment).where(tMoment.ts.equals(winter)).select({ id: tMoment.id })
        const whereDxQuery = conn.selectFrom(tMoment).where(tMoment.dx.equals(winterWhole)).select({ id: tMoment.id })
        out.whereSql = { ts: whereTsQuery.query(), dx: whereDxQuery.query() }
        const plan = async (sql: string, value: Date): Promise<string> => {
            await connection.execute('explain plan for ' + sql, [{ val: value, type: oracledb.DB_TYPE_TIMESTAMP_LTZ }])
            const lines = (await connection.execute<[string]>("select plan_table_output from table(dbms_xplan.display(null, null, 'BASIC'))")).rows ?? []
            return lines.map(line => line[0]).join('\n')
        }
        out.plan = { ts: await plan(whereTsQuery.query(), winter), dx: await plan(whereDxQuery.query(), winterWhole) }
        // Inside the JSON of an aggregated array
        out.aggregated = (await conn.selectFrom(tMoment).where(tMoment.id.in([1, 2])).selectOneColumn(conn.aggregateAsArrayOfOneColumn(tMoment.ts)).executeSelectOne()).map(iso)
        out.aggregatedObjects = (await conn.selectFrom(tMoment).where(tMoment.id.equals(1)).selectOneColumn(conn.aggregateAsArray({ ts: tMoment.ts, t: tMoment.t })).executeSelectOne()).map(isoRow)
        // The current date and time of the database, read as its instant
        const before = Date.now()
        out.currentTimestampDrift = Math.abs((await conn.selectFromNoTable().selectOneColumn(conn.currentTimestamp()).executeSelectOne()).getTime() - before)
        // A localTime constant on the date to convert times between zones: 1972-01-01, and today, the current date of the database
        out.constTime = iso(await conn.selectFromNoTable().selectOneColumn(conn.const(time17, 'localTime')).executeSelectOne())
        const today = new MadridTodayConnection(conn.queryRunner as QueryRunner)
        out.constTimeToday = iso(await today.selectFromNoTable().selectOneColumn(today.const(time17, 'localTime')).executeSelectOne())
        // A localTime on a day of summer, the reference date: written and read with the offset of that day (18:00 in
        // Madrid is 16:00Z in summer)
        const summerConn = new MadridSummerConnection(conn.queryRunner as QueryRunner)
        await summerConn.insertInto(tMoment).set({ id: 8, t: new Date('2024-07-14T16:00:00.000Z') }).executeInsert()
        out.summerTime = {
            stored: (await raw(`select to_char(t, 'YYYY-MM-DD HH24:MI:SS') as t from ${tableName} where id = 8`)).map(row => row.T),
            read: iso(await summerConn.selectFrom(tMoment).where(tMoment.id.equals(8)).selectOneColumn(tMoment.t).executeSelectOne()),
        }
        // A localTime after midnight in Madrid (00:30, 23:30Z of the day before) is kept on 1972-01-01, the date of every
        // localTime, as another program writes it
        // (also in a multi-row insert, a PL/SQL block)
        await conn.insertInto(tMoment).values([{ id: 9, t: new Date('1969-12-31T23:30:00.000Z') }, { id: 11, t: time17 }]).executeInsert()
        await raw(`insert into ${tableName} (id, t) values (10, timestamp '1972-01-01 00:30:00')`)
        out.timeAfterMidnight = {
            stored: (await raw(`select id, to_char(t, 'YYYY-MM-DD HH24:MI:SS') as t from ${tableName} where id in (9, 10, 11) order by id`)).map(row => row.ID + ' ' + row.T),
            where: (await conn.selectFrom(tMoment).where(tMoment.t.equals(new Date('1969-12-31T23:30:00.000Z'))).select({ id: tMoment.id }).orderBy('id').executeSelectMany()).map(row => row.id),
        }
        // A wall clock that is repeated when Madrid leaves summer time is taken in winter time
        await raw(`insert into ${tableName} (id, ts) values (7, timestamp '2024-10-27 02:30:00')`)
        out.repeated = iso(await conn.selectFrom(tMoment).where(tMoment.id.equals(7)).selectOneColumn(tMoment.ts).executeSelectOne())
        // An instant: stored as the wall clock of Madrid of the instant, read, compared and aggregated as its
        // instant, the current instant of the database, and a wall clock that Madrid repeats taken in winter time
        const instantWinter = Temporal.Instant.from('2024-01-14T09:15:30.123Z')
        const instantWhole = Temporal.Instant.from('2024-01-14T09:15:30Z')
        const instantText = (value: unknown): unknown => value instanceof Temporal.Instant ? value.toString() : value
        await conn.insertInto(tInstantMoment).set({ id: 12, ts: instantWinter, dx: instantWhole, tz: instantWinter }).executeInsert()
        const beforeInstant = Temporal.Now.instant()
        const instantWhere = conn.selectFrom(tInstantMoment).where(tInstantMoment.ts.equals(instantWinter)).select({ id: tInstantMoment.id }).orderBy('id')
        const instantWhereDx = conn.selectFrom(tInstantMoment).where(tInstantMoment.dx.equals(instantWhole)).select({ id: tInstantMoment.id }).orderBy('id')
        out.instant = {
            sql: [instantWhere.query(), instantWhereDx.query()],
            stored: await raw(`select to_char(ts, 'YYYY-MM-DD HH24:MI:SS.FF3') as ts, to_char(dx, 'YYYY-MM-DD HH24:MI:SS') as dx, to_char(sys_extract_utc(tz), 'YYYY-MM-DD HH24:MI:SS.FF3') as tz_utc from ${tableName} where id = 12`),
            read: (await conn.selectFrom(tInstantMoment).where(tInstantMoment.id.in([1, 3, 12])).select({ id: tInstantMoment.id, ts: tInstantMoment.ts, dx: tInstantMoment.dx, tz: tInstantMoment.tz }).orderBy('id').executeSelectMany())
                .map(row => ({ id: row.id, ts: instantText(row.ts), dx: instantText(row.dx), tz: instantText(row.tz) })),
            where: await idsWhere(instantWhere),
            whereDx: await idsWhere(instantWhereDx),
            returning: instantText((await conn.insertInto(tInstantMoment).set({ id: 13, ts: instantWinter }).returning({ ts: tInstantMoment.ts }).executeInsertOne()).ts),
            aggregated: (await conn.selectFrom(tInstantMoment).where(tInstantMoment.id.in([1, 12])).selectOneColumn(conn.aggregateAsArrayOfOneColumn(tInstantMoment.ts)).executeSelectOne()).map(instantText),
            currentDrift: Math.abs(Number((await conn.selectFromNoTable().selectOneColumn(conn.currentInstant()).executeSelectOne()).since(beforeInstant).total('millisecond'))),
            repeated: instantText(await conn.selectFrom(tInstantMoment).where(tInstantMoment.id.equals(7)).selectOneColumn(tInstantMoment.ts).executeSelectOne()),
            // Its epoch, its date and time in the zone of the database, and a wall clock of that zone as an instant
            methods: await conn.selectFrom(tInstantMoment).where(tInstantMoment.id.equals(12)).select({
                milliseconds: tInstantMoment.ts.epochMilliseconds(), nanoseconds: tInstantMoment.tz.epochNanoseconds(),
                wall: tInstantMoment.ts.toPlainDateTime(), zonedWall: tInstantMoment.tz.toPlainDateTime(), hour: tInstantMoment.tz.toPlainDateTime().hour(),
                instant: tInstantMoment.tsPlain.toInstant(),
                // A date and time without zone gives the parts of its digits, the wall clock of Madrid
                plainHour: tInstantMoment.tsPlain.hour(), plainDay: tInstantMoment.tsPlain.toPlainDate(),
                // Its arithmetic, on its wall clock in UTC, and the instant of its epoch: instants again
                plusAnHour: tInstantMoment.ts.add({ hours: 1 }), hourOf: tInstantMoment.tz.round('hour'),
                ofItsEpoch: conn.instantFromEpochMilliseconds(tInstantMoment.ts.epochMilliseconds()),
            }).executeSelectOne().then(row => ({ ...row, nanoseconds: String(row.nanoseconds), wall: String(row.wall), zonedWall: String(row.zonedWall), instant: String(row.instant), plainDay: String(row.plainDay), plusAnHour: String(row.plusAnHour), hourOf: String(row.hourOf), ofItsEpoch: String(row.ofItsEpoch) })),
        }
        // The arithmetic of a zoned date and time follows the rules of its zone (New York goes back an hour on
        // 2024-11-03), whatever the zone of the session
        const exact = new MadridConnectionWithFunctions(created.runner)
        const newYork = exact.const(Temporal.ZonedDateTime.from('2024-11-02T01:30:00-04:00[America/New_York]'), 'zonedDateTime')
        out.zoned = await exact.selectFromNoTable().select({
            nextDay: newYork.add({ days: 1 }), dayAfter: newYork.add({ hours: 24 }), rounded: newYork.add({ days: 1, hours: 11 }).round('day'),
            start: newYork.add({ days: 1, hours: 3 }).startOfDay(), hours: newYork.add({ days: 1 }).hoursInDay(), with: newYork.add({ days: 1 }).with({ minute: 45 }, { offset: 'ignore', disambiguation: 'later' }),
            days: newYork.until(newYork.add({ days: 2 }), { largestUnit: 'day' }),
        }).executeSelectOne().then(row => ({ ...row, nextDay: String(row.nextDay), dayAfter: String(row.dayAfter), rounded: String(row.rounded), start: String(row.start), with: String(row.with), days: String(row.days) }))
        // Without them, the 01:30 New York repeats that day is Oracle's later one
        out.nativeNextDay = String(await conn.selectFromNoTable().selectOneColumn(conn.const(Temporal.ZonedDateTime.from('2024-11-02T01:30:00-04:00[America/New_York]'), 'zonedDateTime').add({ days: 1 })).executeSelectOne())
        // A wall clock that Madrid skips when it changes to summer time can't be read: ORA-01878
        await raw(`insert into ${tableName} (id, ts) values (4, timestamp '2024-03-31 02:30:00')`)
        out.skipped = await outcomeOf(() => conn.selectFrom(tMoment).where(tMoment.id.equals(4)).selectOneColumn(tMoment.ts).executeSelectOne())
    } finally {
        await closeRunner?.()
        await raw('drop table ' + tableName + ' purge')
        await connection.close()
    }
    return out
}

async function createRunner(): Promise<{ runner: QueryRunner, close: () => Promise<unknown> }> {
    switch (config.runner) {
        case 'OracleDBQueryRunner': {
            const { OracleDBQueryRunner } = await import('../../../../src/queryRunners/OracleDBQueryRunner.js')
            const connection = await oracledb.getConnection(db)
            return { runner: new OracleDBQueryRunner(connection), close: () => connection.close() }
        }
        case 'OracleDBPoolQueryRunner': {
            const { OracleDBPoolQueryRunner } = await import('../../../../src/queryRunners/OracleDBPoolQueryRunner.js')
            const pool = await oracledb.createPool({ ...db, poolMin: 0, poolMax: 2 })
            return { runner: new OracleDBPoolQueryRunner(pool), close: () => pool.close(0) }
        }
        case 'OracleDBPoolPromiseQueryRunner': {
            const { OracleDBPoolPromiseQueryRunner } = await import('../../../../src/queryRunners/OracleDBPoolPromiseQueryRunner.js')
            const pool = oracledb.createPool({ ...db, poolMin: 0, poolMax: 2 })
            return { runner: new OracleDBPoolPromiseQueryRunner(pool), close: async () => (await pool).close(0) }
        }
        default:
            throw new Error('Unknown runner ' + config.runner)
    }
}

async function firstQuery(): Promise<string> {
    const { runner, close } = await createRunner()
    try {
        const conn = new MadridConnection(runner)
        return await outcomeOf(() => conn.selectFromNoTable().selectOneColumn(conn.const(1, 'int')).executeSelectOne())
    } finally {
        await close()
    }
}

printResult(config.mode === 'scenario' ? await scenario() : await firstQuery())
