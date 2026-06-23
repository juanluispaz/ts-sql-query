// Behavioral coverage of the VALUE round-trip for every `dateTimeFormat`
// accepted by `SqliteConnection.getDateTimeFormat()`. The sibling
// `config.datetime-formats.test.ts` pins the SQL each format emits for
// `currentDate/currentTime/currentTimestamp`; this file pins the value
// transformation in both directions:
//   - `transformValueToDB` — `conn.const(REF, 'localDate'|'localTime'|
//     'localDateTime')` encodes the JS `Date` to the param the driver
//     receives (the `ctx.lastParams` snapshot records the encoding).
//   - `transformValueFromDB` — the selected value comes back through the
//     big per-format switch in `SqliteConnection.transformValueFromDB`
//     and is re-typed to a JS `Date`.
//
// Each test is a genuine round-trip: `select <const> as v` returns the
// encoded param verbatim, so the value the real engine returns equals the
// value `transformValueFromDB` decodes. `ctx.mockNext(...)` is primed with
// that same encoded value so mock and real modes share one unconditional
// `expect(row).toEqual(expected)`.
//
// TZ=UTC is forced by the suite (test/lib/setupTimezone.ts), so the local
// and UTC getters used by the transforms are deterministic. The `config.`
// prefix exempts this file from the cross-cell symmetry rule (it is
// sqlite-connection-configuration specific).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { ctx } from './setup.js'

// 2024-01-15T10:30:45.123Z
const REF = new Date(Date.UTC(2024, 0, 15, 10, 30, 45, 123))

function reasonOf(e: unknown): string | undefined {
    return e instanceof TsSqlError ? e.errorReason.reason : undefined
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // ---- localDateTime round-trip, one test per format -----------------

    test('localDateTime roundtrip: localdate as text', async () => {
        const conn = ctx.withDateTimeFormat('localdate as text')
        const expected = { v: REF }
        ctx.mockNext({ v: '2024-01-15 10:30:45.123' })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDateTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15 10:30:45.123",
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localDateTime roundtrip: localdate as text using T separator', async () => {
        const conn = ctx.withDateTimeFormat('localdate as text using T separator')
        const expected = { v: REF }
        ctx.mockNext({ v: '2024-01-15T10:30:45.123' })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDateTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15T10:30:45.123",
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localDateTime roundtrip: UTC as text', async () => {
        const conn = ctx.withDateTimeFormat('UTC as text')
        const expected = { v: REF }
        ctx.mockNext({ v: '2024-01-15 10:30:45.123' })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDateTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15 10:30:45.123",
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localDateTime roundtrip: UTC as text using T separator', async () => {
        const conn = ctx.withDateTimeFormat('UTC as text using T separator')
        const expected = { v: REF }
        ctx.mockNext({ v: '2024-01-15T10:30:45.123' })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDateTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15T10:30:45.123",
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localDateTime roundtrip: UTC as text using Z timezone', async () => {
        const conn = ctx.withDateTimeFormat('UTC as text using Z timezone')
        const expected = { v: REF }
        ctx.mockNext({ v: '2024-01-15 10:30:45.123Z' })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDateTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15 10:30:45.123Z",
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localDateTime roundtrip: UTC as text using T separator and Z timezone', async () => {
        const conn = ctx.withDateTimeFormat('UTC as text using T separator and Z timezone')
        const expected = { v: REF }
        ctx.mockNext({ v: '2024-01-15T10:30:45.123Z' })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDateTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15T10:30:45.123Z",
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localDateTime roundtrip: Julian day as real number', async () => {
        const conn = ctx.withDateTimeFormat('Julian day as real number')
        // Julian-day float arithmetic loses the trailing millisecond (.123 -> .122).
        const expected = { v: new Date(Date.UTC(2024, 0, 15, 10, 30, 45, 122)) }
        ctx.mockNext({ v: 2460324.938022257 })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDateTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2460324.938022257,
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localDateTime roundtrip: Unix time seconds as integer', async () => {
        const conn = ctx.withDateTimeFormat('Unix time seconds as integer')
        // Seconds precision drops the .123 ms component.
        const expected = { v: new Date(Date.UTC(2024, 0, 15, 10, 30, 45, 0)) }
        ctx.mockNext({ v: 1705314645 })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDateTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1705314645,
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localDateTime roundtrip: Unix time milliseconds as integer', async () => {
        const conn = ctx.withDateTimeFormat('Unix time milliseconds as integer')
        const expected = { v: REF }
        ctx.mockNext({ v: 1705314645123 })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDateTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1705314645123,
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    // ---- localDate round-trip, one test per distinct transform arm -----
    // localDate is normalised to the date at 10:00 UTC (the timezone-safe
    // offset SqliteConnection applies). The text formats all encode the
    // same `YYYY-MM-DD`; julian / unix-seconds / unix-milliseconds each
    // take their own numeric arm in both directions.

    test('localDate roundtrip: localdate as text', async () => {
        const conn = ctx.withDateTimeFormat('localdate as text')
        const expected = { v: new Date(Date.UTC(2024, 0, 15, 10, 0, 0, 0)) }
        ctx.mockNext({ v: '2024-01-15' })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDate') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15",
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localDate roundtrip: UTC as text', async () => {
        const conn = ctx.withDateTimeFormat('UTC as text')
        const expected = { v: new Date(Date.UTC(2024, 0, 15, 10, 0, 0, 0)) }
        ctx.mockNext({ v: '2024-01-15' })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDate') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15",
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localDate roundtrip: Julian day as real number', async () => {
        const conn = ctx.withDateTimeFormat('Julian day as real number')
        const expected = { v: new Date(Date.UTC(2024, 0, 15, 10, 0, 0, 0)) }
        ctx.mockNext({ v: 2460324.5 })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDate') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2460324.5,
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localDate roundtrip: Unix time seconds as integer', async () => {
        const conn = ctx.withDateTimeFormat('Unix time seconds as integer')
        const expected = { v: new Date(Date.UTC(2024, 0, 15, 10, 0, 0, 0)) }
        ctx.mockNext({ v: 1705276800 })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDate') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1705276800,
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localDate roundtrip: Unix time milliseconds as integer', async () => {
        const conn = ctx.withDateTimeFormat('Unix time milliseconds as integer')
        const expected = { v: new Date(Date.UTC(2024, 0, 15, 10, 0, 0, 0)) }
        ctx.mockNext({ v: 1705276800000 })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDate') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1705276800000,
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    // ---- localTime round-trip, one test per distinct transform arm ------
    // localTime is normalised onto 1970-01-01. The text/UTC formats encode
    // `HH:MM:SS(.fff)`; julian / unix-seconds / unix-milliseconds each take
    // their own numeric arm.

    test('localTime roundtrip: localdate as text', async () => {
        const conn = ctx.withDateTimeFormat('localdate as text')
        const expected = { v: new Date(Date.UTC(1970, 0, 1, 10, 30, 45, 123)) }
        ctx.mockNext({ v: '10:30:45.123' })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "10:30:45.123",
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localTime roundtrip: UTC as text using Z timezone', async () => {
        const conn = ctx.withDateTimeFormat('UTC as text using Z timezone')
        const expected = { v: new Date(Date.UTC(1970, 0, 1, 10, 30, 45, 123)) }
        ctx.mockNext({ v: '10:30:45.123Z' })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "10:30:45.123Z",
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localTime roundtrip: Julian day as real number', async () => {
        const conn = ctx.withDateTimeFormat('Julian day as real number')
        const expected = { v: new Date(Date.UTC(1970, 0, 1, 10, 30, 45, 122)) }
        ctx.mockNext({ v: 0.43802225682884455 })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0.43802225682884455,
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localTime roundtrip: Unix time seconds as integer', async () => {
        const conn = ctx.withDateTimeFormat('Unix time seconds as integer')
        const expected = { v: new Date(Date.UTC(1970, 0, 1, 10, 30, 45, 0)) }
        ctx.mockNext({ v: 37845 })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            37845,
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    test('localTime roundtrip: Unix time milliseconds as integer', async () => {
        const conn = ctx.withDateTimeFormat('Unix time milliseconds as integer')
        const expected = { v: new Date(Date.UTC(1970, 0, 1, 10, 30, 45, 123)) }
        ctx.mockNext({ v: 37845123 })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            37845123,
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    // ---- defensive "unexpected value" decode branches ------------------
    // These exercise the arms `transformValueFromDB` takes when the value
    // the db returns does not match the configured format. A real engine
    // in the configured format never hands back the mismatched type (nor a
    // malformed value), so the branch is unreachable through a real
    // round-trip on every connector — hence `if (ctx.realDbEnabled) return`,
    // documented per DESIGN.md §"Mock-only smell — Skip-real form".

    // NOT-APPLICABLE: a real sqlite engine in the "Julian day" format returns a number, never a string, so the `treatUnexpectedStringDateTimeAsUTC` arm is only reachable via the mock.
    test('localDateTime decode: unexpected string under Julian format is read as UTC when flagged', async () => {
        if (ctx.realDbEnabled) return
        const conn = ctx.withDateTimeFlags('Julian day as real number', { treatUnexpectedStringDateTimeAsUTC: true })
        const expected = { v: REF }
        ctx.mockNext({ v: '2024-01-15 10:30:45.123' })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDateTime') })
            .executeSelectOne()
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    // NOT-APPLICABLE: a real sqlite engine in a text format returns a string, never an integer, so the `treatUnexpectedIntegerDateTimeAsJulian` auto-detect arm is only reachable via the mock.
    test('localDateTime decode: unexpected integer under text format is read as Julian when flagged', async () => {
        if (ctx.realDbEnabled) return
        const conn = ctx.withDateTimeFlags('localdate as text', { treatUnexpectedIntegerDateTimeAsJulian: true })
        const expected = { v: new Date(Date.UTC(2024, 0, 15, 12, 0, 0, 0)) }
        ctx.mockNext({ v: 2460325 })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDateTime') })
            .executeSelectOne()
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    // NOT-APPLICABLE: a real sqlite engine in a text format returns a string, never an integer, so the `unexpectedUnixDateTimeAreMilliseconds` auto-detect arm is only reachable via the mock.
    test('localDateTime decode: unexpected integer under text format is read as unix-ms when flagged', async () => {
        if (ctx.realDbEnabled) return
        const conn = ctx.withDateTimeFlags('localdate as text', { unexpectedUnixDateTimeAreMilliseconds: true })
        const expected = { v: REF }
        ctx.mockNext({ v: 1705314645123 })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(REF, 'localDateTime') })
            .executeSelectOne()
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    // NOT-APPLICABLE: a real sqlite engine never returns a boolean for a localDate column, so this defensive type guard is only reachable via the mock.
    test('localDate decode: a non-date, non-string, non-number value is rejected', async () => {
        if (ctx.realDbEnabled) return
        const conn = ctx.withDateTimeFormat('localdate as text')
        ctx.mockNext({ v: true })
        let caught: unknown
        try {
            await conn.selectFromNoTable()
                .select({ v: conn.const(REF, 'localDate') })
                .executeSelectOne()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    // NOT-APPLICABLE: a real sqlite engine never returns an unparseable date string, so this defensive NaN guard is only reachable via the mock.
    test('localDate decode: an unparseable string is rejected', async () => {
        if (ctx.realDbEnabled) return
        const conn = ctx.withDateTimeFormat('localdate as text')
        ctx.mockNext({ v: 'not-a-date' })
        let caught: unknown
        try {
            await conn.selectFromNoTable()
                .select({ v: conn.const(REF, 'localDate') })
                .executeSelectOne()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    // NOT-APPLICABLE: a real sqlite engine never returns an unparseable time string, so this defensive NaN guard is only reachable via the mock.
    test('localTime decode: an unparseable string is rejected', async () => {
        if (ctx.realDbEnabled) return
        const conn = ctx.withDateTimeFormat('localdate as text')
        ctx.mockNext({ v: 'not-a-time' })
        let caught: unknown
        try {
            await conn.selectFromNoTable()
                .select({ v: conn.const(REF, 'localTime') })
                .executeSelectOne()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    // NOT-APPLICABLE: a real sqlite engine never returns a boolean for a localDateTime column, so this defensive type guard is only reachable via the mock.
    test('localDateTime decode: a non-date, non-string, non-number value is rejected', async () => {
        if (ctx.realDbEnabled) return
        const conn = ctx.withDateTimeFormat('localdate as text')
        ctx.mockNext({ v: true })
        let caught: unknown
        try {
            await conn.selectFromNoTable()
                .select({ v: conn.const(REF, 'localDateTime') })
                .executeSelectOne()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })
})
