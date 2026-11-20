// The methods of an instant (Temporal.Instant): its epoch in milliseconds and nanoseconds, and its date and time in the
// zone of the database (UTC); and a plainDateTime as an instant. instant_value row 1 is 2024-01-14T09:15:30.123Z (SQLite
// keeps milliseconds) and row 2 is 1969-07-20T20:17:40Z; col_matrix row 1 has the date and time 2024-01-14 12:30:00.
// Every value expected is the one Temporal gives. The drivers give an integer beyond 2^53 as a rounded number unless
// their big-integer mode is on, so the nanoseconds of these instants are compared in the query.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tColMatrixPlain, tInstantValue } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

const deployed = Temporal.Instant.from('2024-01-14T09:15:30.123Z')
const landed = Temporal.Instant.from('1969-07-20T20:17:40Z')

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('the-epoch-of-an-instant', async () => {
        ctx.mockNext([
            { id: 1, milliseconds: 1705223730123 },
            { id: 2, milliseconds: -14182940000 },
        ])
        const rows = sync(ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.instantAt.epochNanoseconds().in([deployed.epochNanoseconds, landed.epochNanoseconds]))
            .and(tInstantValue.wallAt.epochNanoseconds().in([deployed.epochNanoseconds, landed.epochNanoseconds]))
            .select({
                id: tInstantValue.id,
                milliseconds: tInstantValue.instantAt.epochMilliseconds(),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(unixepoch(instant_at, 'subsec') * 1000) as milliseconds from instant_value where (cast(round(unixepoch(instant_at, 'subsec') * 1000) as integer) * 1000000) in (?1, ?2) and (cast(round(unixepoch(wall_at, 'subsec') * 1000) as integer) * 1000000) in (?3, ?4) order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1705223730123000000",
            "-14182940000000000",
            "1705223730123000000",
            "-14182940000000000",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; milliseconds: number }>>>()
        expect(rows).toEqual([
            { id: 1, milliseconds: deployed.epochMilliseconds },
            { id: 2, milliseconds: landed.epochMilliseconds },
        ])
    })

    test('the-epoch-of-an-instant-before-1970-is-rounded-down', async () => {
        // Temporal rounds the milliseconds down, also before 1970: -0.5 milliseconds are -1; SQLite keeps the instant to
        // the millisecond
        const sent = Temporal.Instant.from('1969-12-31T23:59:59.9995Z')
        const instant = Temporal.Instant.fromEpochMilliseconds(sent.epochMilliseconds)
        ctx.mockNext({ milliseconds: -1, nanoseconds: -1000000 })
        const row = sync(ctx.conn.selectFromNoTable()
            .select({
                milliseconds: ctx.conn.const(sent, 'instant').epochMilliseconds(),
                nanoseconds: ctx.conn.const(sent, 'instant').epochNanoseconds(),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select round(unixepoch(?1, 'subsec') * 1000) as milliseconds, (cast(round(unixepoch(?2, 'subsec') * 1000) as integer) * 1000000) as nanoseconds"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1969-12-31 23:59:59.999",
            "1969-12-31 23:59:59.999",
          ]
        `)
        expect(row).toEqual({ milliseconds: instant.epochMilliseconds, nanoseconds: instant.epochNanoseconds })
    })

    // NOT-SUPPORTED: SQLite's integers have 64 bits: the nanoseconds after 2262 don't fit
    /*
    test('the-nanoseconds-of-an-instant-after-2262', async () => {
        // More nanoseconds than a 64-bit integer holds
        const instant = Temporal.Instant.from('2300-01-01T00:00:00.000001Z')
        ctx.mockNext({ nanoseconds: '10413792000000001000' })
        const row = sync(ctx.conn.selectFromNoTable()
            .select({ nanoseconds: ctx.conn.const(instant, 'instant').epochNanoseconds() })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot()
        expect(row.nanoseconds).toBe(instant.epochNanoseconds)
        expect(row.nanoseconds > 9223372036854775807n).toBe(true)
    })
    */

    test('an-instant-of-its-epoch', async () => {
        // The milliseconds and the nanoseconds of each instant since 1970-01-01T00:00Z, and the instant of them; a number
        // given is the instant sent
        ctx.mockNext([
            { id: 1, fromMilliseconds: '2024-01-14 09:15:30.123', fromNanoseconds: '2024-01-14 09:15:30.123', given: '2024-01-14T09:15:30.123Z' },
            { id: 2, fromMilliseconds: '1969-07-20 20:17:40', fromNanoseconds: '1969-07-20 20:17:40', given: '2024-01-14T09:15:30.123Z' },
        ])
        const rows = sync(ctx.conn.selectFrom(tInstantValue)
            .select({
                id: tInstantValue.id,
                fromMilliseconds: ctx.conn.instantFromEpochMilliseconds(tInstantValue.instantAt.epochMilliseconds()),
                fromNanoseconds: ctx.conn.instantFromEpochNanoseconds(tInstantValue.instantAt.epochNanoseconds()),
                given: ctx.conn.instantFromEpochMilliseconds(1705223730123),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, strftime('%Y-%m-%d %H:%M:%f', date('1970-01-01', (cast((round(unixepoch(instant_at, 'subsec') * 1000) - ((round(unixepoch(instant_at, 'subsec') * 1000) % 86400000 + 86400000) % 86400000)) / 86400000 as integer)) || ' days'), ((((round(unixepoch(instant_at, 'subsec') * 1000) % 86400000 + 86400000) % 86400000) * 1000000) / 1000000000.0) || ' seconds') as fromMilliseconds, strftime('%Y-%m-%d %H:%M:%f', date('1970-01-01', (cast(((cast(round(unixepoch(instant_at, 'subsec') * 1000) as integer) * 1000000) - (((cast(round(unixepoch(instant_at, 'subsec') * 1000) as integer) * 1000000) % 86400000000000 + 86400000000000) % 86400000000000)) / 86400000000000 as integer)) || ' days'), (((((cast(round(unixepoch(instant_at, 'subsec') * 1000) as integer) * 1000000) % 86400000000000 + 86400000000000) % 86400000000000)) / 1000000000.0) || ' seconds') as fromNanoseconds, ?1 as given from instant_value order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-14 09:15:30.123",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; fromMilliseconds: Temporal.Instant; fromNanoseconds: Temporal.Instant; given: Temporal.Instant }>>>()
        expect(rows.map(row => [row.id, row.fromMilliseconds.toString(), row.fromNanoseconds.toString(), row.given.toString()])).toEqual([deployed, landed].map((instant, i) => [
            i + 1,
            Temporal.Instant.fromEpochMilliseconds(instant.epochMilliseconds).toString(),
            Temporal.Instant.fromEpochNanoseconds(instant.epochNanoseconds).toString(),
            Temporal.Instant.fromEpochMilliseconds(1705223730123).toString(),
        ]))
    })

    test('an-instant-of-its-epoch-before-1970-and-of-a-value', async () => {
        // One millisecond before 1970, a day before it and a million nanoseconds after it (SQLite keeps milliseconds): the
        // whole days rounded down
        ctx.mockNext({ millisecondBefore: '1969-12-31 23:59:59.999', dayBefore: '1969-12-31 00:00:00', nanosecondAfter: '1970-01-01 00:00:00.001' })
        const row = sync(ctx.conn.selectFromNoTable()
            .select({
                millisecondBefore: ctx.conn.instantFromEpochMilliseconds(ctx.conn.const(-1n, 'bigint')),
                dayBefore: ctx.conn.instantFromEpochMilliseconds(ctx.conn.const(-86400000n, 'bigint')),
                nanosecondAfter: ctx.conn.instantFromEpochNanoseconds(ctx.conn.const(1000000n, 'bigint')),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%Y-%m-%d %H:%M:%f', date('1970-01-01', (cast((?1 - ((?1 % 86400000 + 86400000) % 86400000)) / 86400000 as integer)) || ' days'), ((((?1 % 86400000 + 86400000) % 86400000) * 1000000) / 1000000000.0) || ' seconds') as millisecondBefore, strftime('%Y-%m-%d %H:%M:%f', date('1970-01-01', (cast((?2 - ((?2 % 86400000 + 86400000) % 86400000)) / 86400000 as integer)) || ' days'), ((((?2 % 86400000 + 86400000) % 86400000) * 1000000) / 1000000000.0) || ' seconds') as dayBefore, strftime('%Y-%m-%d %H:%M:%f', date('1970-01-01', (cast((?3 - ((?3 % 86400000000000 + 86400000000000) % 86400000000000)) / 86400000000000 as integer)) || ' days'), ((((?3 % 86400000000000 + 86400000000000) % 86400000000000)) / 1000000000.0) || ' seconds') as nanosecondAfter"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "-1",
            "-86400000",
            "1000000",
          ]
        `)
        expect([row.millisecondBefore.toString(), row.dayBefore.toString(), row.nanosecondAfter.toString()]).toEqual([
            Temporal.Instant.fromEpochMilliseconds(-1).toString(),
            Temporal.Instant.fromEpochMilliseconds(-86400000).toString(),
            Temporal.Instant.fromEpochNanoseconds(1000000n).toString(),
        ])
    })

    test('an-instant-as-a-date-and-time-of-the-database', async () => {
        ctx.mockNext([{ moment: '2024-01-14 09:15:30.123', day: '2024-01-14', time: '09:15:30.123', hour: 9 }])
        const rows = sync(ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.instantAt.toPlainDate().equals(Temporal.PlainDate.from('2024-01-14')))
            .select({
                moment: tInstantValue.instantAt.toPlainDateTime(),
                day: tInstantValue.instantAt.toPlainDate(),
                time: tInstantValue.instantAt.toPlainTime(),
                hour: tInstantValue.instantAt.toPlainDateTime().hour(),
            })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select instant_at as moment, date(instant_at) as day, strftime('%H:%M:%f', instant_at) as time, cast(strftime('%H', instant_at) as integer) as hour from instant_value where date(instant_at) = ?1"`)
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
        const rows = sync(ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({ id: tColMatrixPlain.id, at: tColMatrixPlain.mDatetime.toInstant() })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, m_datetime as at from col_matrix where id = ?1"`)
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
        const rows = sync(ctx.conn.selectFrom(tInstantValue)
            .where(tInstantValue.instantAt.toPlainDateTime().toInstant().equals(tInstantValue.instantAt))
            .and(tInstantValue.instantAt.equals(tInstantValue.wallAt.toPlainDateTime().toInstant()))
            .select({ id: tInstantValue.id })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from instant_value where instant_at = instant_at and instant_at = wall_at order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual([{ id: 1 }, { id: 2 }])
    })
})
