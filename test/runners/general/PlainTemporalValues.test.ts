// The Temporal values without zone (plainDate, plainTime, plainDateTime) as the connection converts them: what it
// accepts reading a value (the Temporal value, its text with every digit of the fraction of a second, a Date of a driver
// that gives one), what it sends (only the Temporal value of the type), and the error of a runtime without Temporal.
// The library reaches Temporal only through src/typeSystem/temporal.ts, so its declarations compile for a user whose
// lib doesn't declare Temporal.

import { readFileSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { execSync } from 'node:child_process'
import ts from 'typescript6'
import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { Table, TsSqlError } from '../../../src/exports/v2/index.js'
import { postgreSqlDriverParams } from '../../../src/utils/postgreSql/postgreSqlParamTypes.js'

class DBConnection extends PostgreSqlConnection<'DBConnection'> {}
class DBConnectionInMadrid extends PostgreSqlConnection<'DBConnectionInMadrid'> {
    protected override databaseTimeZone = 'Europe/Madrid'
}

const tEvent = new class TEvent extends Table<DBConnection, 'TEvent'> {
    id = this.primaryKey('id', 'int')
    day = this.column('day', 'plainDate')
    time = this.column('time', 'plainTime')
    moment = this.column('moment', 'plainDateTime')
    localDay = this.column('local_day', 'localDate')
    constructor() { super('event') }
}()
const tEventInMadrid = new class TEventInMadrid extends Table<DBConnectionInMadrid, 'TEventInMadrid'> {
    moment = this.column('moment', 'plainDateTime')
    constructor() { super('event') }
}()

let rowsToReturn: any[] = []
let lastParams: any[] = []
// One row for a query of one row, the rows for any other
const conn = new DBConnection(new MockQueryRunner((type, _query, params) => {
    lastParams = params
    return type === 'selectOneRow' ? rowsToReturn[0] : rowsToReturn
}))
const connInMadrid = new DBConnectionInMadrid(new MockQueryRunner((type) => type === 'selectOneRow' ? rowsToReturn[0] : rowsToReturn))

async function readRow(row: Record<string, unknown>): Promise<{ day: string, time: string, moment: string }> {
    rowsToReturn = [row]
    const result = await conn.selectFrom(tEvent).select({ day: tEvent.day, time: tEvent.time, moment: tEvent.moment }).executeSelectOne()
    return { day: result.day.toString(), time: result.time.toString(), moment: result.moment.toString() }
}

async function errorReadingMoment(value: unknown): Promise<string> {
    rowsToReturn = [{ moment: value }]
    try {
        await conn.selectFrom(tEvent).select({ moment: tEvent.moment }).executeSelectOne()
        return 'no error'
    } catch (error) {
        return error instanceof TsSqlError ? error.errorReason.reason : String(error)
    }
}

async function errorSendingDay(value: unknown): Promise<string> {
    rowsToReturn = []
    try {
        await conn.selectFrom(tEvent).where(tEvent.day.equals(value as Temporal.PlainDate)).select({ id: tEvent.id }).executeSelectMany()
        return 'no error'
    } catch (error) {
        return error instanceof TsSqlError ? error.errorReason.reason : String(error)
    }
}

describe('PlainTemporalValues', () => {
    test('the-temporal-values-are-read-as-they-are', async () => {
        const row = await readRow({
            day: Temporal.PlainDate.from('2024-01-14'),
            time: Temporal.PlainTime.from('09:15:30.123456789'),
            moment: Temporal.PlainDateTime.from('2024-01-14T09:15:30.123456789'),
        })
        expect(row).toEqual({ day: '2024-01-14', time: '09:15:30.123456789', moment: '2024-01-14T09:15:30.123456789' })
    })

    test('a-plain-date-time-gives-its-day-and-its-time', async () => {
        const moment = Temporal.PlainDateTime.from('2024-01-14T09:15:30.5')
        expect(await readRow({ day: moment, time: moment, moment: Temporal.PlainDate.from('2024-01-14') }))
            .toEqual({ day: '2024-01-14', time: '09:15:30.5', moment: '2024-01-14T00:00:00' })
    })

    test('a-text-keeps-every-digit-of-the-fraction-of-a-second', async () => {
        // Up to nanoseconds; the digits beyond are dropped
        expect(await readRow({ day: '2024-01-14', time: '09:15:30.123456', moment: '2024-01-14 09:15:30.1234567891' }))
            .toEqual({ day: '2024-01-14', time: '09:15:30.123456', moment: '2024-01-14T09:15:30.123456789' })
        expect(await readRow({ day: '2024-01-14T00:00:00', time: '1970-01-01T09:15:00', moment: '2024-01-14T09:15:30,25' }))
            .toEqual({ day: '2024-01-14', time: '09:15:00', moment: '2024-01-14T09:15:30.25' })
        // A date alone is at 00:00
        expect(await readRow({ day: '2024-01-14', time: '09:15', moment: '2024-01-14' }))
            .toEqual({ day: '2024-01-14', time: '09:15:00', moment: '2024-01-14T00:00:00' })
    })

    test('a-text-of-a-year-before-1', async () => {
        // PostgreSQL writes 44 BC as 0044 BC: the year -43, as there is no year 0; a text of ISO writes the year -43
        expect(await readRow({ day: '0044-03-15 BC', time: '09:15', moment: '-0043-03-15 09:15:30' }))
            .toEqual({ day: '-000043-03-15', time: '09:15:00', moment: '-000043-03-15T09:15:30' })
    })

    test('a-text-with-an-offset-is-the-wall-clock-of-the-database', async () => {
        // The instant the text gives, in the zone of the database: UTC by default
        expect(await readRow({ day: '2024-01-14', time: '09:15', moment: '2024-01-14 09:15:30.123456+09' }))
            .toEqual({ day: '2024-01-14', time: '09:15:00', moment: '2024-01-14T00:15:30.123456' })
        expect(await readRow({ day: '2024-01-14', time: '09:15', moment: '2024-01-14T09:15:30Z' }))
            .toEqual({ day: '2024-01-14', time: '09:15:00', moment: '2024-01-14T09:15:30' })
        // With a database in Madrid (UTC+1 in January), its wall clock
        rowsToReturn = [{ moment: '2024-01-14 09:15:30.123456+09' }]
        const row = await connInMadrid.selectFrom(tEventInMadrid).select({ moment: tEventInMadrid.moment }).executeSelectOne()
        expect(row.moment.toString()).toBe('2024-01-14T01:15:30.123456')
    })

    test('a-date-of-a-driver-gives-its-utc-digits', async () => {
        const date = new Date(Date.UTC(2024, 0, 14, 9, 15, 30, 123))
        expect(await readRow({ day: date, time: date, moment: date }))
            .toEqual({ day: '2024-01-14', time: '09:15:30.123', moment: '2024-01-14T09:15:30.123' })
    })

    test('what-isnt-a-date-or-a-time-is-rejected-reading-it', async () => {
        expect(await errorReadingMoment('2024-02-30 09:15:30')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await errorReadingMoment('2024-01-14 24:00:00')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await errorReadingMoment('infinity')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await errorReadingMoment(1705223730123)).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await errorReadingMoment(new Date(NaN))).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await errorReadingMoment(Temporal.PlainTime.from('09:15'))).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    test('only-the-temporal-value-of-the-type-is-sent', async () => {
        expect(await errorSendingDay(Temporal.PlainDate.from('2024-01-14'))).toBe('no error')
        expect(lastParams.map(String)).toEqual(['2024-01-14'])
        expect(await errorSendingDay(Temporal.PlainDateTime.from('2024-01-14T09:15'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await errorSendingDay(new Date(Date.UTC(2024, 0, 14)))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await errorSendingDay('2024-01-14')).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('a-temporal-value-sent-as-a-local-date-is-rejected', async () => {
        // Its error says the value, written as its text: a Temporal value can't be added to a text
        rowsToReturn = []
        let reason = 'no error'
        try {
            await conn.selectFrom(tEvent).where(tEvent.localDay.equals(Temporal.PlainDate.from('2024-01-14') as unknown as Date)).select({ id: tEvent.id }).executeSelectMany()
        } catch (error) {
            reason = error instanceof TsSqlError ? error.message : String(error)
        }
        expect(reason).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE: Invalid localDate value to send to the db: 2024-01-14')
    })

    test('postgresql-receives-the-text-of-the-value-with-its-era', async () => {
        await conn.selectFrom(tEvent)
            .where(tEvent.day.equals(Temporal.PlainDate.from('-000043-03-15')))
            .and(tEvent.time.equals(Temporal.PlainTime.from('09:15:30.123456789')))
            .and(tEvent.moment.equals(Temporal.PlainDateTime.from('-000043-03-15T09:15:30.1')))
            .select({ id: tEvent.id })
            .executeSelectMany()
        expect(postgreSqlDriverParams(lastParams)).toEqual(['0044-03-15 BC', '09:15:30.123456789', '0044-03-15 09:15:30.1 BC'])
    })

    test('a-runtime-without-temporal-fails-converting-a-value', async () => {
        const temporal = Object.getOwnPropertyDescriptor(globalThis, 'Temporal')!
        Reflect.deleteProperty(globalThis, 'Temporal')
        try {
            expect(await errorReadingMoment('2024-01-14 09:15:30')).toBe('TEMPORAL_NOT_AVAILABLE')
        } finally {
            Object.defineProperty(globalThis, 'Temporal', temporal)
        }
        expect(await errorReadingMoment('2024-01-14 09:15:30')).toBe('no error')
    })

    test('no-module-of-the-library-names-temporal-but-its-own', () => {
        // A declaration that names Temporal fails to compile for a user whose lib doesn't declare it
        const root = normalize(join(import.meta.dirname, '..', '..', '..'))
        const files = execSync("git ls-files 'src/*.ts'", { cwd: root, encoding: 'utf8' }).split('\n').filter(file => file !== '' && file !== 'src/typeSystem/temporal.ts')
        expect(files.length).toBeGreaterThan(100)
        const naming: string[] = []
        for (const file of files) {
            const source = ts.createSourceFile(file, readFileSync(join(root, file), 'utf8'), ts.ScriptTarget.Latest, true)
            const visit = (node: ts.Node): void => {
                if (ts.isIdentifier(node) && node.text === 'Temporal') {
                    naming.push(file)
                }
                ts.forEachChild(node, visit)
            }
            visit(source)
        }
        expect(naming).toEqual([])
    })
})
