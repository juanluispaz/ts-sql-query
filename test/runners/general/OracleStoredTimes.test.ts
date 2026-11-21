// A time of the day on Oracle, which has no type of a time alone: a localTime or a plainTime is stored in a DATE or a
// TIMESTAMP on the date of dateOfStoredTimes ('1972-01-01' by default; version 1 of the library stored them on
// '1970-01-01'), so a column compares and orders them as times of the day only on that date.

import { describe, expect, test } from '../../lib/testRunner.js'
import { OracleConnection } from '../../../src/connections/OracleConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { Table, TsSqlError } from '../../../src/exports/v2/index.js'

class OracleTimes extends OracleConnection<'OracleTimes'> {}
class OracleTimesOfVersion1 extends OracleConnection<'OracleTimesOfVersion1'> {
    protected override dateOfStoredTimes = '1970-01-01'
}
class OracleTimesToday extends OracleConnection<'OracleTimesToday'> {
    protected override dateOfStoredTimes = 'today'
}

let lastParams: any[] = []
function executor(type: string, _query: string, params: any[]): any {
    lastParams = params
    return type === 'insert' ? 1 : type === 'selectOneRow' ? { v: null } : []
}

const tShift = new class TShift extends Table<OracleTimes, 'TShift'> {
    id = this.primaryKey('id', 'int')
    startsAt = this.column('starts_at', 'localTime')
    endsAt = this.column('ends_at', 'plainTime')
    constructor() { super('shift') }
}()
const tShiftOfVersion1 = new class TShiftOfVersion1 extends Table<OracleTimesOfVersion1, 'TShiftOfVersion1'> {
    id = this.primaryKey('id', 'int')
    startsAt = this.column('starts_at', 'localTime')
    endsAt = this.column('ends_at', 'plainTime')
    constructor() { super('shift') }
}()
const tShiftToday = new class TShiftToday extends Table<OracleTimesToday, 'TShiftToday'> {
    id = this.primaryKey('id', 'int')
    startsAt = this.column('starts_at', 'localTime')
    endsAt = this.column('ends_at', 'plainTime')
    constructor() { super('shift') }
}()

describe('OracleStoredTimes', () => {
    test('a-time-of-the-day-is-stored-on-the-date-of-stored-times', async () => {
        const time = new Date('1970-01-01T09:15:30.000Z')
        // By default on 1972-01-01: the Date the connection gives the driver, and the current time
        const conn = new OracleTimes(new MockQueryRunner(executor, { database: 'oracle' }))
        await conn.insertInto(tShift).set({ id: 1, startsAt: time, endsAt: Temporal.PlainTime.from('17:00') }).executeInsert()
        expect((lastParams[1] as Date).toISOString()).toBe('1972-01-01T09:15:30.000Z')
        expect(conn.selectFromNoTable().select({ v: conn.currentTime() }).query()).toBe('select timestamp \'1972-01-01 00:00:00\' + (localtimestamp - trunc(localtimestamp)) as "v" from dual')
        // On the date of version 1 of the library when the connection says it
        const ofVersion1 = new OracleTimesOfVersion1(new MockQueryRunner(executor, { database: 'oracle' }))
        await ofVersion1.insertInto(tShiftOfVersion1).set({ id: 1, startsAt: time, endsAt: Temporal.PlainTime.from('17:00') }).executeInsert()
        expect((lastParams[1] as Date).toISOString()).toBe('1970-01-01T09:15:30.000Z')
        expect(ofVersion1.selectFromNoTable().select({ v: ofVersion1.currentTime() }).query()).toBe('select timestamp \'1970-01-01 00:00:00\' + (localtimestamp - trunc(localtimestamp)) as "v" from dual')
    })

    test('a-date-of-stored-times-that-isnt-a-date-is-rejected', async () => {
        const conn = new OracleTimesToday(new MockQueryRunner(executor, { database: 'oracle' }))
        let reason = 'sent'
        try {
            await conn.insertInto(tShiftToday).set({ id: 1, startsAt: new Date('1970-01-01T09:15:30.000Z'), endsAt: Temporal.PlainTime.from('17:00') }).executeInsert()
        } catch (error) {
            reason = error instanceof TsSqlError ? error.errorReason.reason : String(error)
        }
        expect(reason).toBe('INVALID_CONFIGURATION')
    })
})
