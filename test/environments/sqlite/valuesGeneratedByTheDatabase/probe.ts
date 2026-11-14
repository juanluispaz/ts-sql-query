// Run by ValuesGeneratedByTheDatabase.test.ts in a process of its own, because the zone must be set when the process
// starts: SQLite reads it from the C library, and the suite pins UTC. It receives the rows of the table of the page as
// JSON and prints as JSON what doesn't match. An empty list means every expression stores what the library writes.

import { Table } from '../../../../src/Table.js'
import { SqliteConnection } from '../../../../src/connections/SqliteConnection.js'
import type { SqliteDateTimeFormat } from '../../../../src/connections/SqliteConfiguration.js'
import type { QueryRunner } from '../../../../src/queryRunners/QueryRunner.js'

const rows: { format: SqliteDateTimeFormat, dateTime: string[], time: string }[] = JSON.parse(process.argv[2]!)

interface Engine {
    exec(sql: string): void
    get(sql: string): Record<string, unknown>
    runner: QueryRunner
}

async function createEngine(): Promise<Engine> {
    if (typeof globalThis.Bun !== 'undefined') {
        const { Database } = await import('bun:sqlite')
        const { BunSqliteQueryRunner } = await import('../../../../src/queryRunners/BunSqliteQueryRunner.js')
        const db = new Database(':memory:')
        return { exec: (sql) => { db.run(sql) }, get: (sql) => db.prepare(sql).get() as Record<string, unknown>, runner: new BunSqliteQueryRunner(db) }
    }
    const { default: BetterSqlite3 } = await import('better-sqlite3')
    const { BetterSqlite3QueryRunner } = await import('../../../../src/queryRunners/BetterSqlite3QueryRunner.js')
    const db = new BetterSqlite3(':memory:')
    return { exec: (sql) => { db.exec(sql) }, get: (sql) => db.prepare(sql).get() as Record<string, unknown>, runner: new BetterSqlite3QueryRunner(db) }
}

class DBConnection extends SqliteConnection<'DBConnection'> {
    format: SqliteDateTimeFormat = 'localdate milliseconds as text'
    protected override getDateTimeFormat(): SqliteDateTimeFormat {
        return this.format
    }
}

class TGenerated extends Table<DBConnection, 'TGenerated'> {
    id = this.primaryKey('id', 'int')
    at = this.columnWithDefaultValue('at', 'localDateTime')
    time = this.columnWithDefaultValue('time', 'localTime')
    writtenAt = this.column('written_at', 'localDateTime')
    writtenTime = this.column('written_time', 'localTime')
    constructor() {
        super('generated')
    }
}
const tGenerated = new TGenerated()

// The digits change with the clock: what a format fixes is the shape of the text, or that it's a number
function shape(value: unknown): string {
    return typeof value === 'string' ? value.replace(/\d/g, '9') : typeof value
}

function millisecondsOfTheDay(value: Date): number {
    return value.getTime() - Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}

const mismatches: string[] = []
const engine = await createEngine()
const connection = new DBConnection(engine.runner)
for (const row of rows) {
    connection.format = row.format
    for (const dateTime of row.dateTime) {
        engine.exec('drop table if exists generated')
        engine.exec(`create table generated (id integer primary key, at default (${dateTime}), time default (${row.time}), written_at, written_time)`)
        const now = new Date()
        await connection.insertInto(tGenerated).set({ id: 1, writtenAt: now, writtenTime: now }).executeInsert()
        const stored = engine.get('select at, time, written_at as writtenAt, written_time as writtenTime from generated')
        if (shape(stored['at']) !== shape(stored['writtenAt'])) {
            mismatches.push(`${row.format}, ${dateTime}: stores ${String(stored['at'])}, the library writes ${String(stored['writtenAt'])}`)
        }
        if (shape(stored['time']) !== shape(stored['writtenTime'])) {
            mismatches.push(`${row.format}, ${row.time}: stores ${String(stored['time'])}, the library writes ${String(stored['writtenTime'])}`)
        }
        const read = await connection.selectFrom(tGenerated).select({ at: tGenerated.at, time: tGenerated.time }).executeSelectOne()
        // The seconds formats drop the milliseconds, so the value can be up to a second before now
        if (Math.abs(read.at.getTime() - now.getTime()) >= 2000) {
            mismatches.push(`${row.format}, ${dateTime}: reads ${read.at.toISOString()} at ${now.toISOString()}`)
        }
        const timeDifference = Math.abs(millisecondsOfTheDay(read.time) - millisecondsOfTheDay(now))
        if (Math.min(timeDifference, 86_400_000 - timeDifference) >= 2000) {
            mismatches.push(`${row.format}, ${row.time}: reads ${read.time.toISOString()} at ${now.toISOString()}`)
        }
    }
}
process.stdout.write(JSON.stringify(mismatches))
