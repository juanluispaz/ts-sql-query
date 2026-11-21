// The months of a year (Temporal.PlainYearMonth) and the days of a month (Temporal.PlainMonthDay) as the connection
// converts them: kept in the date of their reference (temporalReferenceDate, '1972-01-01' by default: the 1st of the
// month, the year 1972), read from a date of any day or year, and the references a connection can't keep.

import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { Table, TsSqlError } from '../../../src/exports/v2/index.js'

class PgConnection extends PostgreSqlConnection<'PgConnection'> {}
/** A connection whose months of a year are kept on the 15th and days of a month in the year 2000 */
class PgReferenceConnection extends PostgreSqlConnection<'PgReferenceConnection'> {
    protected override temporalReferenceDate = '2000-01-15'
}
/** A connection with the reference given */
function connectionWithReference(reference: string): PgReferenceConnection {
    return new class extends PgReferenceConnection {
        protected override temporalReferenceDate = reference
    }(new MockQueryRunner(executor, { queryRunner: 'PgPoolQueryRunner' }))
}

const tPgCalendar = new class TPgCalendar extends Table<PgConnection, 'TPgCalendar'> {
    id = this.primaryKey('id', 'int')
    monthOf = this.column('month_of', 'plainYearMonth')
    dayOf = this.column('day_of', 'plainMonthDay')
    bornOn = this.column('born_on', 'plainDate')
    constructor() { super('calendar_value') }
}()
const tPgReferenceCalendar = new class TPgReferenceCalendar extends Table<PgReferenceConnection, 'TPgReferenceCalendar'> {
    id = this.primaryKey('id', 'int')
    monthOf = this.column('month_of', 'plainYearMonth')
    dayOf = this.column('day_of', 'plainMonthDay')
    bornOn = this.column('born_on', 'plainDate')
    constructor() { super('calendar_value') }
}()

let rowsToReturn: any[] = []
let lastSql = ''
let lastParams: any[] = []
function executor(type: string, query: string, params: any[]): any {
    lastSql = query
    lastParams = params
    return type === 'selectOneRow' ? rowsToReturn[0] : type === 'insert' ? 1 : rowsToReturn
}
const pg = new PgConnection(new MockQueryRunner(executor, { queryRunner: 'PgPoolQueryRunner' }))
const pgReference = new PgReferenceConnection(new MockQueryRunner(executor, { queryRunner: 'PgPoolQueryRunner' }))

function reasonOf(error: unknown): string {
    return error instanceof TsSqlError ? error.errorReason.reason : String(error)
}

/** The month of the year and the day of the month read from these values, or the reason of the error */
async function read(monthOf: unknown, dayOf: unknown): Promise<string> {
    rowsToReturn = [{ monthOf, dayOf }]
    try {
        const row = await pg.selectFrom(tPgCalendar).select({ monthOf: tPgCalendar.monthOf, dayOf: tPgCalendar.dayOf }).executeSelectOne()
        return row.monthOf.toString() + ' ' + row.dayOf.toString()
    } catch (error) {
        return reasonOf(error)
    }
}

/** What was sent, or the reason of the error */
async function outcome(execute: () => Promise<unknown>): Promise<string> {
    try {
        await execute()
        return 'sent'
    } catch (error) {
        return reasonOf(error)
    }
}

describe('PlainYearMonthValues', () => {
    test('a-date-of-any-day-or-year-is-read-as-its-month-of-the-year-or-its-day-of-the-month', async () => {
        // As Temporal's from takes a date: the date of the reference, another one, one with a time (inside a JSON
        // aggregate), or the Temporal value itself
        expect(await read('2024-02-01', '1972-02-29')).toBe('2024-02 02-29')
        expect(await read('2025-01-15', '2000-03-15')).toBe('2025-01 03-15')
        expect(await read('2024-02-01T00:00:00', '1972-02-29T00:00:00')).toBe('2024-02 02-29')
        expect(await read(Temporal.PlainYearMonth.from('2024-02'), Temporal.PlainDate.from('1980-07-04'))).toBe('2024-02 07-04')
        expect(await read('the month', '1972-02-29')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await read('2024-02-01', 'the day')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    test('only-a-month-of-a-year-or-a-day-of-a-month-is-sent', async () => {
        expect(await outcome(() => pg.insertInto(tPgCalendar).values({ id: 1, monthOf: Temporal.PlainYearMonth.from('2024-03'), dayOf: Temporal.PlainMonthDay.from('03-15'), bornOn: Temporal.PlainDate.from('2024-03-15') }).executeInsert())).toBe('sent')
        expect(lastParams.map(String)).toEqual(['1', '2024-03-01', '1972-03-15', '2024-03-15'])
        const date: any = Temporal.PlainDate.from('2024-03-15')
        expect(await outcome(() => pg.insertInto(tPgCalendar).values({ id: 1, monthOf: date, dayOf: Temporal.PlainMonthDay.from('03-15'), bornOn: date }).executeInsert())).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await outcome(() => pg.insertInto(tPgCalendar).values({ id: 1, monthOf: Temporal.PlainYearMonth.from('2024-03'), dayOf: date, bornOn: date }).executeInsert())).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('the-reference-of-the-connection-is-the-date-they-are-kept-in', async () => {
        await pgReference.insertInto(tPgReferenceCalendar).values({ id: 1, monthOf: Temporal.PlainYearMonth.from('2024-02'), dayOf: Temporal.PlainMonthDay.from('02-29'), bornOn: Temporal.PlainDate.from('2024-02-29') }).executeInsert()
        expect(lastParams.map(String)).toEqual(['1', '2024-02-15', '2000-02-29', '2024-02-29'])
        rowsToReturn = [{ month: '2024-02-15', day: '2000-02-29' }]
        const row = await pgReference.selectFrom(tPgReferenceCalendar).select({ month: tPgReferenceCalendar.bornOn.toPlainYearMonth(), day: tPgReferenceCalendar.bornOn.toPlainMonthDay() }).executeSelectOne()
        expect(lastSql).toBe("select date_trunc('month', born_on)::date + 14 as month, make_date(2000, cast(extract(month from born_on) as integer), cast(extract(day from born_on) as integer)) as day from calendar_value")
        // Read with the reference of Temporal
        expect([row.month.toString({ calendarName: 'always' }), row.day.toString({ calendarName: 'always' })]).toEqual(['2024-02-01[u-ca=iso8601]', '1972-02-29[u-ca=iso8601]'])
    })

    test('a-reference-a-month-or-february-29-hasnt-is-rejected', async () => {
        // A year without February 29, a day not every month has, and what isn't a date
        for (const reference of ['2001-01-01', '2000-01-29', '2000-13-01', 'today']) {
            const connection = connectionWithReference(reference)
            expect(await outcome(() => connection.insertInto(tPgReferenceCalendar).values({ id: 1, monthOf: Temporal.PlainYearMonth.from('2024-02'), dayOf: Temporal.PlainMonthDay.from('02-29'), bornOn: Temporal.PlainDate.from('2024-02-29') }).executeInsert())).toBe('INVALID_CONFIGURATION')
        }
    })
})
