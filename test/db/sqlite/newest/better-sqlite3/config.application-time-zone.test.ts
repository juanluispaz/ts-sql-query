// sqliteRunsInApplicationTimeZone: what the date functions write when SQLite runs in the zone of the application.
// The suite pins UTC, so here only the SQL can be compared; what those queries give in other zones is proved in
// test/runners/sqlite/ApplicationTimeZone.test.ts, which starts a process in each zone.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DBConnection } from '../../domain/connection.js'
import type { SqliteDateTimeFormat } from '../../../../../src/connections/SqliteConfiguration.js'
import { ctx } from './setup.js'

// 2024-01-15T10:30:45.123Z
const REF = new Date(Date.UTC(2024, 0, 15, 10, 30, 45, 123))

function dateFunctions(conn: DBConnection): string {
    const dateTime = conn.const(REF, 'localDateTime')
    const time = conn.const(REF, 'localTime')
    const date = conn.const(REF, 'localDate')
    return conn.selectFromNoTable()
        .select({
            time: dateTime.getTime(),
            fullYear: dateTime.getFullYear(),
            day: dateTime.getDay(),
            hours: dateTime.getHours(),
            timeHours: time.getHours(),
            timeMinutes: time.getMinutes(),
            dateDate: date.getDate(),
            today: conn.currentDate(),
        })
        .query()
}

function withOption(format: SqliteDateTimeFormat): string {
    return dateFunctions(ctx.withApplicationTimeZone(format))
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('with the option: localdate seconds as text', () => {
        expect(withOption('localdate seconds as text')).toMatchInlineSnapshot(`"select round(unixepoch(?1, 'utc', 'subsec') * 1000) as time, cast(strftime('%Y', ?2) as integer) as fullYear, cast(strftime('%w',?3) as integer) as day, cast(strftime('%H', ?4) as integer) as hours, cast(strftime('%H', ?5) as integer) as timeHours, cast(strftime('%M', ?6) as integer) as timeMinutes, cast(strftime('%d', ?7) as integer) as dateDate, date('now', 'localtime') as today"`)
    })

    test('with the option: localdate milliseconds as text', () => {
        expect(withOption('localdate milliseconds as text')).toMatchInlineSnapshot(`"select round(unixepoch(?1, 'utc', 'subsec') * 1000) as time, cast(strftime('%Y', ?2) as integer) as fullYear, cast(strftime('%w',?3) as integer) as day, cast(strftime('%H', ?4) as integer) as hours, cast(strftime('%H', ?5) as integer) as timeHours, cast(strftime('%M', ?6) as integer) as timeMinutes, cast(strftime('%d', ?7) as integer) as dateDate, date('now', 'localtime') as today"`)
    })

    test('with the option: localdate seconds as text using T separator', () => {
        expect(withOption('localdate seconds as text using T separator')).toMatchInlineSnapshot(`"select round(unixepoch(?1, 'utc', 'subsec') * 1000) as time, cast(strftime('%Y', ?2) as integer) as fullYear, cast(strftime('%w',?3) as integer) as day, cast(strftime('%H', ?4) as integer) as hours, cast(strftime('%H', ?5) as integer) as timeHours, cast(strftime('%M', ?6) as integer) as timeMinutes, cast(strftime('%d', ?7) as integer) as dateDate, date('now', 'localtime') as today"`)
    })

    test('with the option: localdate milliseconds as text using T separator', () => {
        expect(withOption('localdate milliseconds as text using T separator')).toMatchInlineSnapshot(`"select round(unixepoch(?1, 'utc', 'subsec') * 1000) as time, cast(strftime('%Y', ?2) as integer) as fullYear, cast(strftime('%w',?3) as integer) as day, cast(strftime('%H', ?4) as integer) as hours, cast(strftime('%H', ?5) as integer) as timeHours, cast(strftime('%M', ?6) as integer) as timeMinutes, cast(strftime('%d', ?7) as integer) as dateDate, date('now', 'localtime') as today"`)
    })

    test('with the option: UTC seconds as text', () => {
        expect(withOption('UTC seconds as text')).toMatchInlineSnapshot(`"select round(unixepoch(?1, 'subsec') * 1000) as time, cast(strftime('%Y', ?2, 'localtime') as integer) as fullYear, cast(strftime('%w',?3, 'localtime') as integer) as day, cast(strftime('%H', ?4, 'localtime') as integer) as hours, cast(strftime('%H', '1970-01-01 ' || ?5, 'localtime') as integer) as timeHours, cast(strftime('%M', '1970-01-01 ' || ?6, 'localtime') as integer) as timeMinutes, cast(strftime('%d', ?7) as integer) as dateDate, date('now', 'localtime') as today"`)
    })

    test('with the option: UTC milliseconds as text', () => {
        expect(withOption('UTC milliseconds as text')).toMatchInlineSnapshot(`"select round(unixepoch(?1, 'subsec') * 1000) as time, cast(strftime('%Y', ?2, 'localtime') as integer) as fullYear, cast(strftime('%w',?3, 'localtime') as integer) as day, cast(strftime('%H', ?4, 'localtime') as integer) as hours, cast(strftime('%H', '1970-01-01 ' || ?5, 'localtime') as integer) as timeHours, cast(strftime('%M', '1970-01-01 ' || ?6, 'localtime') as integer) as timeMinutes, cast(strftime('%d', ?7) as integer) as dateDate, date('now', 'localtime') as today"`)
    })

    test('with the option: UTC seconds as text using T separator', () => {
        expect(withOption('UTC seconds as text using T separator')).toMatchInlineSnapshot(`"select round(unixepoch(?1, 'subsec') * 1000) as time, cast(strftime('%Y', ?2, 'localtime') as integer) as fullYear, cast(strftime('%w',?3, 'localtime') as integer) as day, cast(strftime('%H', ?4, 'localtime') as integer) as hours, cast(strftime('%H', '1970-01-01 ' || ?5, 'localtime') as integer) as timeHours, cast(strftime('%M', '1970-01-01 ' || ?6, 'localtime') as integer) as timeMinutes, cast(strftime('%d', ?7) as integer) as dateDate, date('now', 'localtime') as today"`)
    })

    test('with the option: UTC milliseconds as text using T separator', () => {
        expect(withOption('UTC milliseconds as text using T separator')).toMatchInlineSnapshot(`"select round(unixepoch(?1, 'subsec') * 1000) as time, cast(strftime('%Y', ?2, 'localtime') as integer) as fullYear, cast(strftime('%w',?3, 'localtime') as integer) as day, cast(strftime('%H', ?4, 'localtime') as integer) as hours, cast(strftime('%H', '1970-01-01 ' || ?5, 'localtime') as integer) as timeHours, cast(strftime('%M', '1970-01-01 ' || ?6, 'localtime') as integer) as timeMinutes, cast(strftime('%d', ?7) as integer) as dateDate, date('now', 'localtime') as today"`)
    })

    test('with the option: UTC seconds as text using Z timezone', () => {
        expect(withOption('UTC seconds as text using Z timezone')).toMatchInlineSnapshot(`"select round(unixepoch(?1, 'subsec') * 1000) as time, cast(strftime('%Y', ?2, 'localtime') as integer) as fullYear, cast(strftime('%w',?3, 'localtime') as integer) as day, cast(strftime('%H', ?4, 'localtime') as integer) as hours, cast(strftime('%H', '1970-01-01 ' || ?5, 'localtime') as integer) as timeHours, cast(strftime('%M', '1970-01-01 ' || ?6, 'localtime') as integer) as timeMinutes, cast(strftime('%d', ?7) as integer) as dateDate, date('now', 'localtime') as today"`)
    })

    test('with the option: UTC milliseconds as text using Z timezone', () => {
        expect(withOption('UTC milliseconds as text using Z timezone')).toMatchInlineSnapshot(`"select round(unixepoch(?1, 'subsec') * 1000) as time, cast(strftime('%Y', ?2, 'localtime') as integer) as fullYear, cast(strftime('%w',?3, 'localtime') as integer) as day, cast(strftime('%H', ?4, 'localtime') as integer) as hours, cast(strftime('%H', '1970-01-01 ' || ?5, 'localtime') as integer) as timeHours, cast(strftime('%M', '1970-01-01 ' || ?6, 'localtime') as integer) as timeMinutes, cast(strftime('%d', ?7) as integer) as dateDate, date('now', 'localtime') as today"`)
    })

    test('with the option: UTC seconds as text using T separator and Z timezone', () => {
        expect(withOption('UTC seconds as text using T separator and Z timezone')).toMatchInlineSnapshot(`"select round(unixepoch(?1, 'subsec') * 1000) as time, cast(strftime('%Y', ?2, 'localtime') as integer) as fullYear, cast(strftime('%w',?3, 'localtime') as integer) as day, cast(strftime('%H', ?4, 'localtime') as integer) as hours, cast(strftime('%H', '1970-01-01 ' || ?5, 'localtime') as integer) as timeHours, cast(strftime('%M', '1970-01-01 ' || ?6, 'localtime') as integer) as timeMinutes, cast(strftime('%d', ?7) as integer) as dateDate, date('now', 'localtime') as today"`)
    })

    test('with the option: UTC milliseconds as text using T separator and Z timezone', () => {
        expect(withOption('UTC milliseconds as text using T separator and Z timezone')).toMatchInlineSnapshot(`"select round(unixepoch(?1, 'subsec') * 1000) as time, cast(strftime('%Y', ?2, 'localtime') as integer) as fullYear, cast(strftime('%w',?3, 'localtime') as integer) as day, cast(strftime('%H', ?4, 'localtime') as integer) as hours, cast(strftime('%H', '1970-01-01 ' || ?5, 'localtime') as integer) as timeHours, cast(strftime('%M', '1970-01-01 ' || ?6, 'localtime') as integer) as timeMinutes, cast(strftime('%d', ?7) as integer) as dateDate, date('now', 'localtime') as today"`)
    })

    test('with the option: Julian day as real number', () => {
        expect(withOption('Julian day as real number')).toMatchInlineSnapshot(`"select round(unixepoch(?1, 'subsec') * 1000) as time, cast(strftime('%Y', ?2, 'localtime') as integer) as fullYear, cast(strftime('%w',?3, 'localtime') as integer) as day, cast(strftime('%H', ?4, 'localtime') as integer) as hours, cast(strftime('%H', ?5 + 2440587.5, 'localtime') as integer) as timeHours, cast(strftime('%M', ?6 + 2440587.5, 'localtime') as integer) as timeMinutes, cast(strftime('%d', ?7) as integer) as dateDate, julianday(date('now', 'localtime')) as today"`)
    })

    test('with the option: Unix time seconds as integer', () => {
        expect(withOption('Unix time seconds as integer')).toMatchInlineSnapshot(`"select (?1 * 1000) as time, cast(strftime('%Y', ?2, 'unixepoch', 'localtime') as integer) as fullYear, cast(strftime('%w',?3, 'unixepoch', 'localtime') as integer) as day, cast(strftime('%H', ?4, 'unixepoch', 'localtime') as integer) as hours, cast(strftime('%H', ?5, 'unixepoch', 'localtime') as integer) as timeHours, cast(strftime('%M', ?6, 'unixepoch', 'localtime') as integer) as timeMinutes, cast(strftime('%d', ?7, 'unixepoch') as integer) as dateDate, unixepoch(date('now', 'localtime')) as today"`)
    })

    test('with the option: Unix time milliseconds as integer', () => {
        expect(withOption('Unix time milliseconds as integer')).toMatchInlineSnapshot(`"select ?1 as time, cast(strftime('%Y', ?2 / 1000.0, 'unixepoch', 'subsec', 'localtime') as integer) as fullYear, cast(strftime('%w',?3 / 1000.0, 'unixepoch', 'subsec', 'localtime') as integer) as day, cast(strftime('%H', ?4 / 1000.0, 'unixepoch', 'subsec', 'localtime') as integer) as hours, cast(strftime('%H', ?5 / 1000.0, 'unixepoch', 'subsec', 'localtime') as integer) as timeHours, cast(strftime('%M', ?6 / 1000.0, 'unixepoch', 'subsec', 'localtime') as integer) as timeMinutes, cast(strftime('%d', ?7 / 1000.0, 'unixepoch', 'subsec') as integer) as dateDate, (unixepoch(date('now', 'localtime')) * 1000) as today"`)
    })

    test('without the option the UTC formats read in UTC', () => {
        expect(dateFunctions(ctx.withDateTimeFormat('UTC milliseconds as text'))).toMatchInlineSnapshot(`"select round(unixepoch(?1, 'subsec') * 1000) as time, cast(strftime('%Y', ?2) as integer) as fullYear, cast(strftime('%w',?3) as integer) as day, cast(strftime('%H', ?4) as integer) as hours, cast(strftime('%H', ?5) as integer) as timeHours, cast(strftime('%M', ?6) as integer) as timeMinutes, cast(strftime('%d', ?7) as integer) as dateDate, date('now') as today"`)
    })

    test('a time in a Julian day reads the hours of the day', async () => {
        const conn = ctx.withDateTimeFormat('Julian day as real number')
        const time = conn.const(REF, 'localTime')
        ctx.mockNext({ hours: 10, minutes: 30, seconds: 45, milliseconds: 123 })
        const row = await conn.selectFromNoTable()
            .select({
                hours: time.getHours(),
                minutes: time.getMinutes(),
                seconds: time.getSeconds(),
                milliseconds: time.getMilliseconds(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%H', ?1 + 2440587.5) as integer) as hours, cast(strftime('%M', ?2 + 2440587.5) as integer) as minutes, cast(strftime('%S', ?3 + 2440587.5) as integer) as seconds, cast(round(strftime('%f', ?4) * 1000) as integer) % 1000 as milliseconds"`)
        assertType<Exact<typeof row, { hours: number; minutes: number; seconds: number; milliseconds: number }>>()
        expect(row).toEqual({ hours: 10, minutes: 30, seconds: 45, milliseconds: 123 })
    })

    test('a date time in a Julian day comes back with its milliseconds', async () => {
        const conn = ctx.withDateTimeFormat('Julian day as real number')
        ctx.mockNext({ value: 2460324.938022257 })
        const row = await conn.selectFromNoTable()
            .select({ value: conn.const(REF, 'localDateTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ?1 as value"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2460324.938022257,
          ]
        `)
        assertType<Exact<typeof row, { value: Date }>>()
        expect(row.value.getTime()).toBe(REF.getTime())
    })
})
