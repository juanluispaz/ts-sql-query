// Run by DatabaseOutsideUtc.test.ts in a process of its own, started with TZ and ORA_SDTZ set (the zone of a process
// and the zone oracledb gives the session are set when they start). Mode `scenario` runs the queries of a database in
// Europe/Madrid declared in the connection and prints what was stored and read; mode `firstQuery` builds the runner it
// is told and prints the outcome of its first query.

import { OracleConnection } from '../../../../src/connections/OracleConnection.js'
import { Table } from '../../../../src/Table.js'
import { OracleDateAsTimestampTypeAdapter } from '../../../../src/TypeAdapter.js'
import type { QueryRunner } from '../../../../src/queryRunners/QueryRunner.js'
import { printResult, probeConfig } from '../../lib/localTemporalValuesProbe.js'
import { reasonOf } from '../../lib/runnerContract.js'

interface Config {
    mode: 'scenario' | 'firstQuery'
    runner: string
    options: { table?: string }
    connection: { user: string, password: string, connectString: string }
}

const config = probeConfig<Config>()
const db = config.connection
const { default: oracledb } = await import('oracledb')

class MadridConnection extends OracleConnection<'MadridConnection'> {
    protected override databaseTimeZone = 'Europe/Madrid'
}
class MadridTodayConnection extends OracleConnection<'MadridTodayConnection'> {
    protected override databaseTimeZone = 'Europe/Madrid'
    protected override localTimeReferenceDate = 'today'
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
}

async function scenario(): Promise<ScenarioResult> {
    const connection = await oracledb.getConnection(db)
    const raw = async (sql: string, binds: any = {}): Promise<any[]> => (await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: true })).rows ?? []
    const out: ScenarioResult = {}
    try { await raw('drop table ' + tableName + ' purge') } catch { /* it doesn't exist */ }
    await raw('create table ' + tableName + ' (id number primary key, ts timestamp(3), dx date, t timestamp(3), tz timestamp(3) with time zone)')
    await raw('create index ' + tableName + '_ts on ' + tableName + ' (ts)')
    await raw('create index ' + tableName + '_dx on ' + tableName + ' (dx)')
    try {
        const conn = new MadridConnection(new (await import('../../../../src/queryRunners/OracleDBQueryRunner.js')).OracleDBQueryRunner(connection))
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
        // A localTime constant on the reference date: 1970-01-01, and today, the current date of the database
        out.constTime = iso(await conn.selectFromNoTable().selectOneColumn(conn.const(time17, 'localTime')).executeSelectOne())
        const today = new MadridTodayConnection(conn.queryRunner as QueryRunner)
        out.constTimeToday = iso(await today.selectFromNoTable().selectOneColumn(today.const(time17, 'localTime')).executeSelectOne())
        // A wall clock that is repeated when Madrid leaves summer time is taken in winter time
        await raw(`insert into ${tableName} (id, ts) values (7, timestamp '2024-10-27 02:30:00')`)
        out.repeated = iso(await conn.selectFrom(tMoment).where(tMoment.id.equals(7)).selectOneColumn(tMoment.ts).executeSelectOne())
        // A wall clock that Madrid skips when it changes to summer time can't be read: ORA-01878
        await raw(`insert into ${tableName} (id, ts) values (4, timestamp '2024-03-31 02:30:00')`)
        out.skipped = await outcomeOf(() => conn.selectFrom(tMoment).where(tMoment.id.equals(4)).selectOneColumn(tMoment.ts).executeSelectOne())
    } finally {
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
