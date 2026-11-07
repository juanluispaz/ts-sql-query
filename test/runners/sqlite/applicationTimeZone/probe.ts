// Run by ApplicationTimeZone.test.ts in a process of its own, because the zone must be set when the process starts:
// SQLite reads it from the C library, and the suite pins UTC. It prints as JSON what doesn't match what JavaScript
// says for the same value, for every date and time format. An empty list means they agree.

import { Table } from '../../../../src/Table.js'
import type { QueryRunner } from '../../../../src/queryRunners/QueryRunner.js'
import { SqliteConnection } from '../../../../src/connections/SqliteConnection.js'
import type { SqliteDateTimeFormat } from '../../../../src/connections/SqliteConfiguration.js'

const formats: SqliteDateTimeFormat[] = [
    'localdate seconds as text',
    'localdate milliseconds as text',
    'localdate seconds as text using T separator',
    'localdate milliseconds as text using T separator',
    'UTC seconds as text',
    'UTC milliseconds as text',
    'UTC seconds as text using T separator',
    'UTC milliseconds as text using T separator',
    'UTC seconds as text using Z timezone',
    'UTC milliseconds as text using Z timezone',
    'UTC seconds as text using T separator and Z timezone',
    'UTC milliseconds as text using T separator and Z timezone',
    'Julian day as real number',
    'Unix time seconds as integer',
    'Unix time milliseconds as integer',
]

const useOption = process.argv[2] === 'with-option'
const compatibilityVersion = Number(process.argv[3] ?? Number.POSITIVE_INFINITY)
const useWasm = process.argv[4] === 'wasm'

interface Driver {
    exec(sql: string): void
    runner: QueryRunner
}

async function createDriver(): Promise<Driver> {
    if (useWasm) {
        const { default: sqlite3InitModule } = await import('@sqlite.org/sqlite-wasm')
        const { Sqlite3WasmOO1QueryRunner } = await import('../../../../src/queryRunners/Sqlite3WasmOO1QueryRunner.js')
        const sqlite3 = await sqlite3InitModule()
        const db = new sqlite3.oo1.DB(':memory:', 'c')
        return { exec: (sql) => { db.exec(sql) }, runner: new Sqlite3WasmOO1QueryRunner(db) }
    }
    if (typeof globalThis.Bun !== 'undefined') {
        const { Database } = await import('bun:sqlite')
        const { BunSqliteQueryRunner } = await import('../../../../src/queryRunners/BunSqliteQueryRunner.js')
        const db = new Database(':memory:')
        return { exec: (sql) => { db.run(sql) }, runner: new BunSqliteQueryRunner(db) }
    }
    const { default: BetterSqlite3 } = await import('better-sqlite3')
    const { BetterSqlite3QueryRunner } = await import('../../../../src/queryRunners/BetterSqlite3QueryRunner.js')
    const db = new BetterSqlite3(':memory:')
    return { exec: (sql) => { db.exec(sql) }, runner: new BetterSqlite3QueryRunner(db) }
}

const driver = await createDriver()
driver.exec('create table moment(id integer primary key, on_date, at_time, at)')

class DBConnection extends SqliteConnection<'DBConnection'> {
    protected override sqliteRunsInApplicationTimeZone = useOption
    protected override compatibilityVersion = compatibilityVersion
    format: SqliteDateTimeFormat = 'localdate milliseconds as text'
    protected override getDateTimeFormat(): SqliteDateTimeFormat {
        return this.format
    }
}

class TMoment extends Table<DBConnection, 'TMoment'> {
    id = this.primaryKey('id', 'int')
    onDate = this.column('on_date', 'localDate')
    atTime = this.column('at_time', 'localTime')
    at = this.column('at', 'localDateTime')
    constructor() {
        super('moment')
    }
}
const tMoment = new TMoment()

// Close to midnight in many zones, so the day changes too, in winter and in summer
const instants = [new Date('2024-01-14T23:30:15.250Z'), new Date('2024-07-14T23:30:15.250Z')]
const onDate = new Date(2024, 0, 15)
const atTime = new Date(1970, 0, 1, 18, 30, 15, 250)

const mismatches: string[] = []
function check(what: string, sql: unknown, js: unknown) {
    if (sql !== js) {
        mismatches.push(`${what}: ${String(sql)} / ${String(js)}`)
    }
}

const connection = new DBConnection(driver.runner)

for (const format of formats) {
    connection.format = format
    // The formats that only keep seconds can't compare the milliseconds
    const milliseconds = format.includes(' seconds ') ? 0 : 250
    for (const at of instants) {
        driver.exec('delete from moment')
        await connection.insertInto(tMoment).set({ id: 1, onDate, atTime, at }).executeInsert()
        const row = await connection.selectFrom(tMoment)
            .select({
                onDate: tMoment.onDate,
                atTime: tMoment.atTime,
                at: tMoment.at,
                dateFullYear: tMoment.onDate.getFullYear(),
                dateMonth: tMoment.onDate.getMonth(),
                dateDate: tMoment.onDate.getDate(),
                dateDay: tMoment.onDate.getDay(),
                timeHours: tMoment.atTime.getHours(),
                timeMinutes: tMoment.atTime.getMinutes(),
                timeSeconds: tMoment.atTime.getSeconds(),
                timeMilliseconds: tMoment.atTime.getMilliseconds(),
                fullYear: tMoment.at.getFullYear(),
                month: tMoment.at.getMonth(),
                date: tMoment.at.getDate(),
                day: tMoment.at.getDay(),
                hours: tMoment.at.getHours(),
                minutes: tMoment.at.getMinutes(),
                seconds: tMoment.at.getSeconds(),
                ms: tMoment.at.getMilliseconds(),
                time: tMoment.at.getTime(),
            })
            .executeSelectOne()
        const label = format + ' ' + at.toISOString().substring(0, 7) + ' '
        check(label + 'read at', row.at.getTime(), at.getTime() - 250 + milliseconds)
        check(label + 'read atTime', row.atTime.getTime(), atTime.getTime() - 250 + milliseconds)
        // A date is a calendar day: it's what was written, wherever the process runs
        check(label + 'date getFullYear', row.dateFullYear, 2024)
        check(label + 'date getMonth', row.dateMonth, 0)
        check(label + 'date getDate', row.dateDate, 15)
        check(label + 'date getDay', row.dateDay, 1)
        check(label + 'time getHours', row.timeHours, row.atTime.getHours())
        check(label + 'time getMinutes', row.timeMinutes, row.atTime.getMinutes())
        check(label + 'time getSeconds', row.timeSeconds, row.atTime.getSeconds())
        check(label + 'time getMilliseconds', row.timeMilliseconds, row.atTime.getMilliseconds())
        check(label + 'getFullYear', row.fullYear, row.at.getFullYear())
        check(label + 'getMonth', row.month, row.at.getMonth())
        check(label + 'getDate', row.date, row.at.getDate())
        check(label + 'getDay', row.day, row.at.getDay())
        check(label + 'getHours', row.hours, row.at.getHours())
        check(label + 'getMinutes', row.minutes, row.at.getMinutes())
        check(label + 'getSeconds', row.seconds, row.at.getSeconds())
        check(label + 'getMilliseconds', row.ms, row.at.getMilliseconds())
        check(label + 'getTime', row.time, row.at.getTime())
    }

    driver.exec('delete from moment')
    await connection.insertInto(tMoment).set({ id: 1, onDate: new Date(), atTime, at: new Date() }).executeInsert()
    const today = await connection.selectFrom(tMoment)
        .where(tMoment.onDate.equals(connection.currentDate()))
        .selectOneColumn(tMoment.id)
        .executeSelectMany()
    check(format + ' currentDate finds what was written today', today.length, 1)
}

process.stdout.write(JSON.stringify(mismatches))
