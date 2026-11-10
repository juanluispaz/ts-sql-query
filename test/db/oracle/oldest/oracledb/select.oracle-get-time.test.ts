// getTime() of a localDateTime is the milliseconds of its instant, the same as the getTime() of the Date read,
// whatever Oracle type holds the value: a DATE, a TIMESTAMP with nanoseconds (truncated to the millisecond, as a
// Date), a TIMESTAMP WITH TIME ZONE stored with an offset or a region, a TIMESTAMP WITH LOCAL TIME ZONE, before
// 1970 too, and a parameter. The values come from SQL fragments of each type.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('get-time-is-the-instant-for-each-oracle-type', async () => {
        const value = () => ctx.conn.fragmentWithType('localDateTime', 'required')
        const date = value().sql`to_date('2024-01-14 10:30:15', 'YYYY-MM-DD HH24:MI:SS')`
        const timestamp = value().sql`timestamp '2024-01-14 10:30:15.123456789'`
        const withOffset = value().sql`timestamp '2024-01-14 19:30:15.123456 +09:00'`
        const withRegion = value().sql`timestamp '2024-07-01 19:30:15.123 Europe/Madrid'`
        const localTimeZone = value().sql`cast(timestamp '2024-01-14 10:30:15.123 +00:00' as timestamp with local time zone)`
        const beforeEpoch = value().sql`timestamp '1960-06-01 00:00:00.250456 -05:00'`
        const lastDayBeforeEpoch = value().sql`timestamp '1969-12-31 23:30:00.000 -05:00'`
        const parameter = ctx.conn.const(new Date('2024-01-14T10:30:15.123Z'), 'localDateTime')
        const expected = {
            date:               Date.UTC(2024, 0, 14, 10, 30, 15),
            timestamp:          Date.UTC(2024, 0, 14, 10, 30, 15, 123),
            withOffset:         Date.UTC(2024, 0, 14, 10, 30, 15, 123),
            withRegion:         Date.UTC(2024, 6, 1, 17, 30, 15, 123),
            localTimeZone:      Date.UTC(2024, 0, 14, 10, 30, 15, 123),
            beforeEpoch:        Date.UTC(1960, 5, 1, 5, 0, 0, 250),
            lastDayBeforeEpoch: Date.UTC(1970, 0, 1, 4, 30),
            parameter:          Date.UTC(2024, 0, 14, 10, 30, 15, 123),
        }
        ctx.mockNext(expected)

        const row = await ctx.conn.selectFromNoTable()
            .select({
                date:               date.getTime(),
                timestamp:          timestamp.getTime(),
                withOffset:         withOffset.getTime(),
                withRegion:         withRegion.getTime(),
                localTimeZone:      localTimeZone.getTime(),
                beforeEpoch:        beforeEpoch.getTime(),
                lastDayBeforeEpoch: lastDayBeforeEpoch.getTime(),
                parameter:          parameter.getTime(),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (trunc(timestamp '1970-01-01 00:00:00' + (to_date('2024-01-14 10:30:15', 'YYYY-MM-DD HH24:MI:SS') - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (to_date('2024-01-14 10:30:15', 'YYYY-MM-DD HH24:MI:SS') - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "date", (trunc(timestamp '1970-01-01 00:00:00' + (timestamp '2024-01-14 10:30:15.123456789' - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (timestamp '2024-01-14 10:30:15.123456789' - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "timestamp", (trunc(timestamp '1970-01-01 00:00:00' + (timestamp '2024-01-14 19:30:15.123456 +09:00' - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (timestamp '2024-01-14 19:30:15.123456 +09:00' - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "withOffset", (trunc(timestamp '1970-01-01 00:00:00' + (timestamp '2024-07-01 19:30:15.123 Europe/Madrid' - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (timestamp '2024-07-01 19:30:15.123 Europe/Madrid' - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "withRegion", (trunc(timestamp '1970-01-01 00:00:00' + (cast(timestamp '2024-01-14 10:30:15.123 +00:00' as timestamp with local time zone) - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (cast(timestamp '2024-01-14 10:30:15.123 +00:00' as timestamp with local time zone) - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "localTimeZone", (trunc(timestamp '1970-01-01 00:00:00' + (timestamp '1960-06-01 00:00:00.250456 -05:00' - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (timestamp '1960-06-01 00:00:00.250456 -05:00' - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "beforeEpoch", (trunc(timestamp '1970-01-01 00:00:00' + (timestamp '1969-12-31 23:30:00.000 -05:00' - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (timestamp '1969-12-31 23:30:00.000 -05:00' - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "lastDayBeforeEpoch", (trunc(timestamp '1970-01-01 00:00:00' + (:0 - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (:0 - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "parameter" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-14T10:30:15.123Z,
          ]
        `)
        assertType<Exact<typeof row, {
            date:               number
            timestamp:          number
            withOffset:         number
            withRegion:         number
            localTimeZone:      number
            beforeEpoch:        number
            lastDayBeforeEpoch: number
            parameter:          number
        }>>()
        expect(row).toEqual(expected)
    })
})
