// The methods of an instant (Temporal.Instant): its epoch in milliseconds and nanoseconds, and its date and time in the
// zone of the database (UTC); and a plainDateTime as an instant. instant_value row 1 is 2024-01-14T09:15:30.123456Z,
// written with the offset +09:00 where the column keeps one, and row 2 is 1969-07-20T20:17:40Z; col_matrix row 1 has
// the date and time 2024-01-14 12:30:00. Every value expected is the one Temporal gives.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tColMatrixPlain, tInstantValue } from '../../domain/connection.js'
import { ctx } from './setup.js'

const deployed = Temporal.Instant.from('2024-01-14T09:15:30.123456Z')
const landed = Temporal.Instant.from('1969-07-20T20:17:40Z')

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('the-epoch-of-an-instant', async () => {
        ctx.mockNext([
            { id: 1, milliseconds: 1705223730123, nanoseconds: '1705223730123456000', wallNanoseconds: '1705223730123456000' },
            { id: 2, milliseconds: -14182940000, nanoseconds: '-14182940000000000', wallNanoseconds: '-14182940000000000' },
        ])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .select({
                id: tInstantValue.id,
                milliseconds: tInstantValue.instantAt.epochMilliseconds(),
                nanoseconds: tInstantValue.instantAt.epochNanoseconds(),
                wallNanoseconds: tInstantValue.wallAt.epochNanoseconds(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", (trunc(timestamp '1970-01-01 00:00:00' + (instant_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (instant_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "milliseconds", (trunc(sys_extract_utc(cast(instant_at as timestamp(9) with time zone))) - date '1970-01-01') * 86400000000000 + to_number(to_char(sys_extract_utc(cast(instant_at as timestamp(9) with time zone)), 'SSSSSFF9')) as "nanoseconds", (trunc(sys_extract_utc(cast(wall_at as timestamp(9) with time zone))) - date '1970-01-01') * 86400000000000 + to_number(to_char(sys_extract_utc(cast(wall_at as timestamp(9) with time zone)), 'SSSSSFF9')) as "wallNanoseconds" from instant_value order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; milliseconds: number; nanoseconds: bigint; wallNanoseconds?: bigint }>>>()
        expect(rows).toEqual([
            { id: 1, milliseconds: deployed.epochMilliseconds, nanoseconds: deployed.epochNanoseconds, wallNanoseconds: deployed.epochNanoseconds },
            { id: 2, milliseconds: landed.epochMilliseconds, nanoseconds: landed.epochNanoseconds, wallNanoseconds: landed.epochNanoseconds },
        ])
    })

    test('the-epoch-of-an-instant-before-1970-is-rounded-down', async () => {
        // Temporal rounds the milliseconds down, also before 1970: -0.5 milliseconds are -1
        const instant = Temporal.Instant.from('1969-12-31T23:59:59.9995Z')
        ctx.mockNext({ milliseconds: -1, nanoseconds: '-500000' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                milliseconds: ctx.conn.const(instant, 'instant').epochMilliseconds(),
                nanoseconds: ctx.conn.const(instant, 'instant').epochNanoseconds(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (trunc(timestamp '1970-01-01 00:00:00' + (to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "milliseconds", (trunc(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - date '1970-01-01') * 86400000000000 + to_number(to_char(sys_extract_utc(cast(to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) as "nanoseconds" from dual"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1969-12-31T23:59:59.9995Z",
            "1969-12-31T23:59:59.9995Z",
          ]
        `)
        expect(row).toEqual({ milliseconds: instant.epochMilliseconds, nanoseconds: instant.epochNanoseconds })
    })

    test('the-nanoseconds-of-an-instant-after-2262', async () => {
        // More nanoseconds than a 64-bit integer holds
        const instant = Temporal.Instant.from('2300-01-01T00:00:00.000001Z')
        ctx.mockNext({ nanoseconds: '10413792000000001000' })
        const row = await ctx.conn.selectFromNoTable()
            .select({ nanoseconds: ctx.conn.const(instant, 'instant').epochNanoseconds() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (trunc(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone))) - date '1970-01-01') * 86400000000000 + to_number(to_char(sys_extract_utc(cast(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as timestamp(9) with time zone)), 'SSSSSFF9')) as "nanoseconds" from dual"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2300-01-01T00:00:00.000001Z",
          ]
        `)
        expect(row.nanoseconds).toBe(instant.epochNanoseconds)
        expect(row.nanoseconds > 9223372036854775807n).toBe(true)
    })

    test('an-instant-as-a-date-and-time-of-the-database', async () => {
        ctx.mockNext([{ moment: '2024-01-14 09:15:30.123456', day: '2024-01-14', time: '09:15:30.123456', hour: 9 }])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.instantAt.toPlainDate().equals(Temporal.PlainDate.from('2024-01-14')))
            .select({
                moment: tInstantValue.instantAt.toPlainDateTime(),
                day: tInstantValue.instantAt.toPlainDate(),
                time: tInstantValue.instantAt.toPlainTime(),
                hour: tInstantValue.instantAt.toPlainDateTime().hour(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(cast(cast(instant_at as timestamp(9) with time zone) at local as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "moment", to_char(trunc(cast(cast(instant_at as timestamp(9) with time zone) at local as timestamp(9))), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "day", to_char(cast(timestamp '1970-01-01 00:00:00' + (cast(cast(instant_at as timestamp(9) with time zone) at local as timestamp(9)) - trunc(cast(cast(instant_at as timestamp(9) with time zone) at local as timestamp(9)))) as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "time", extract(hour from cast(cast(instant_at as timestamp(9) with time zone) at local as timestamp(9))) as "hour" from instant_value where trunc(cast(cast(instant_at as timestamp(9) with time zone) at local as timestamp(9))) = to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-14",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ moment: Temporal.PlainDateTime; day: Temporal.PlainDate; time: Temporal.PlainTime; hour: number }>>>()
        const inUtc = deployed.toZonedDateTimeISO('UTC')
        expect(rows.map(row => [row.moment.toString(), row.day.toString(), row.time.toString(), row.hour])).toEqual([
            [inUtc.toPlainDateTime().toString(), inUtc.toPlainDate().toString(), inUtc.toPlainTime().toString(), inUtc.hour],
        ])
    })

    test('a-date-and-time-as-an-instant', async () => {
        ctx.mockNext([{ id: 1, at: '2024-01-14 12:30:00' }])
        const rows = await ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({ id: tColMatrixPlain.id, at: tColMatrixPlain.mDatetime.toInstant() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", to_char(sys_extract_utc(cast(m_datetime as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "at" from col_matrix where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; at: Temporal.Instant }>>>()
        expect(rows.map(row => [row.id, row.at.toString()])).toEqual([[1, Temporal.PlainDateTime.from('2024-01-14T12:30:00').toZonedDateTime('UTC').toInstant().toString()]])
    })

    test('an-instant-and-its-date-and-time-are-the-same-moment', async () => {
        // The wall clock of the instant, as an instant again, is the instant
        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const rows = await ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.instantAt.toPlainDateTime().toInstant().equals(tInstantValue.instantAt))
            .and(tInstantValue.instantAt.equals(tInstantValue.wallAt.toPlainDateTime().toInstant()))
            .select({ id: tInstantValue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from instant_value where cast(cast(instant_at as timestamp(9) with time zone) at local as timestamp(9)) = instant_at and instant_at = cast(cast(wall_at as timestamp(9) with time zone) at local as timestamp(9)) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual([{ id: 1 }, { id: 2 }])
    })
})
