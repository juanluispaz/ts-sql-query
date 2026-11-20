// The dates of SQLite kept as text, of any year: a localDate and a localDateTime of the years 1 to 999 are written with
// the 4 digits of their year, which the date functions of SQLite need, and read back as the same year, in every text
// format and as a number (a JavaScript Date reads the text of the years 0 to 99 as 1900 to 1999 or 2000 to 2049).

import { describe, expect, test } from '../../lib/testRunner.js'
import { SqliteConnection } from '../../../src/connections/SqliteConnection.js'
import type { SqliteDateTimeFormat, SqliteDateTimeFormatType } from '../../../src/connections/SqliteConfiguration.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { Table } from '../../../src/exports/v2/index.js'

let rowsToReturn: any[] = []
let lastParams: any[] = []

function sqliteConnection(format: SqliteDateTimeFormat) {
    class Connection extends SqliteConnection<'SqliteDBConnection'> {
        protected override getDateTimeFormat(_type: SqliteDateTimeFormatType): SqliteDateTimeFormat {
            return format
        }
    }
    return new Connection(new MockQueryRunner((type, _query, params) => {
        lastParams = params
        return type === 'insert' ? 1 : type === 'selectOneRow' ? rowsToReturn[0] : rowsToReturn
    }))
}

const tEvent = new class TEvent extends Table<SqliteConnection<'SqliteDBConnection'>, 'TEvent'> {
    id = this.primaryKey('id', 'int')
    day = this.column('day', 'localDate')
    moment = this.column('moment', 'localDateTime')
    constructor() { super('event') }
}()

const formats: SqliteDateTimeFormat[] = [
    'localdate seconds as text', 'localdate milliseconds as text', 'localdate milliseconds as text using T separator',
    'UTC seconds as text', 'UTC milliseconds as text', 'UTC milliseconds as text using T separator and Z timezone',
    'Julian day as real number', 'Unix time milliseconds as integer',
]

/** A Date of that UTC year, month, day and time, also for the years 0 to 99 */
function utc(year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0): Date {
    const result = new Date(0)
    result.setUTCFullYear(year, month - 1, day)
    result.setUTCHours(hours, minutes, seconds, 0)
    return result
}

describe('SqliteDatesOfEveryYear', () => {
    test('a-date-and-a-date-time-of-any-year-are-kept-and-read-back', async () => {
        const sent: Record<string, unknown[]> = {}
        const read: Record<string, string[]> = {}
        for (const format of formats) {
            const sqlite = sqliteConnection(format)
            sent[format] = []
            read[format] = []
            for (const year of [44, 999, 2024]) {
                await sqlite.insertInto(tEvent).set({ id: 1, day: utc(year, 3, 15), moment: utc(year, 3, 15, 9, 15, 30) }).executeInsert()
                sent[format]!.push(lastParams[1], lastParams[2])
                rowsToReturn = [{ day: lastParams[1], moment: lastParams[2] }]
                const row = await sqlite.selectFrom(tEvent).select({ day: tEvent.day, moment: tEvent.moment }).executeSelectOne()
                read[format]!.push(row.day.toISOString().slice(0, 10), row.moment.toISOString())
            }
        }
        // The process runs in UTC: a localdate format is the wall clock in UTC
        expect(sent['localdate seconds as text']).toEqual(['0044-03-15', '0044-03-15 09:15:30', '0999-03-15', '0999-03-15 09:15:30', '2024-03-15', '2024-03-15 09:15:30'])
        expect(sent['UTC milliseconds as text using T separator and Z timezone']).toEqual(['0044-03-15', '0044-03-15T09:15:30.000Z', '0999-03-15', '0999-03-15T09:15:30.000Z', '2024-03-15', '2024-03-15T09:15:30.000Z'])
        for (const format of formats) {
            expect([format, read[format]]).toEqual([format, [
                '0044-03-15', '0044-03-15T09:15:30.000Z', '0999-03-15', '0999-03-15T09:15:30.000Z', '2024-03-15', '2024-03-15T09:15:30.000Z',
            ]])
        }
    })

    test('a-text-of-the-first-century-is-read-as-its-year', async () => {
        for (const format of ['localdate milliseconds as text', 'UTC milliseconds as text'] as SqliteDateTimeFormat[]) {
            const sqlite = sqliteConnection(format)
            rowsToReturn = [{ day: '0044-03-15', moment: '0044-03-15 09:15:30.000' }]
            const row = await sqlite.selectFrom(tEvent).select({ day: tEvent.day, moment: tEvent.moment }).executeSelectOne()
            expect([format, row.day.toISOString().slice(0, 10), row.moment.toISOString()]).toEqual([format, '0044-03-15', '0044-03-15T09:15:30.000Z'])
        }
    })
})
