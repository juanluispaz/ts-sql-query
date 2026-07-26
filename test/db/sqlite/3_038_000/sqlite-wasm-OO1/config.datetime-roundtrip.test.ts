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
import { tIssueWorklog } from '../../domain/connection.js'
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

    // These exercise the arms `transformValueFromDB` takes when the value
    // the db returns does not match the configured format. A real engine
    // in the configured format never hands back the mismatched type (nor a
    // malformed value), so the branch is unreachable through a real
    // round-trip on every connector — hence `ctx.mockOnlyConnection()`,
    // documented per DESIGN.md §"Mock-only smell".

    // NOT-APPLICABLE: a real sqlite engine in the "Julian day" format returns a number, never a string, so the `treatUnexpectedStringDateTimeAsUTC` arm is only reachable via the mock.
    test('localDateTime decode: unexpected string under Julian format is read as UTC when flagged', async () => {
        ctx.mockOnlyConnection()
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
        ctx.mockOnlyConnection()
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
        ctx.mockOnlyConnection()
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
        ctx.mockOnlyConnection()
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
        ctx.mockOnlyConnection()
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
        ctx.mockOnlyConnection()
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
        ctx.mockOnlyConnection()
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

    // The ENCODE direction rejects an unusable `Date` before the driver is
    // reached, so — unlike the decode guards above — these need no mock
    // injection and run identically in both modes.

    test('localDate encode: an invalid Date is rejected', async () => {
        const conn = ctx.withDateTimeFormat('localdate as text')
        let caught: unknown
        try {
            await conn.selectFromNoTable()
                .select({ v: conn.const(new Date(NaN), 'localDate') })
                .executeSelectOne()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('localTime encode: an invalid Date is rejected', async () => {
        const conn = ctx.withDateTimeFormat('localdate as text')
        let caught: unknown
        try {
            await conn.selectFromNoTable()
                .select({ v: conn.const(new Date(NaN), 'localTime') })
                .executeSelectOne()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('localDateTime encode: an invalid Date is rejected', async () => {
        const conn = ctx.withDateTimeFormat('localdate as text')
        let caught: unknown
        try {
            await conn.selectFromNoTable()
                .select({ v: conn.const(new Date(NaN), 'localDateTime') })
                .executeSelectOne()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    // The `UTC as text` format writes a localTime WITHOUT the trailing `Z`
    // its `using Z timezone` sibling adds — a distinct encode/decode pair.
    test('localTime roundtrip: UTC as text', async () => {
        const conn = ctx.withDateTimeFormat('UTC as text')
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

    // A millisecond component of 10–99 is the middle arm of the encoder's
    // zero-pad ladder: it needs exactly one leading zero, where 123 needs
    // none and 7 needs two.
    test('localTime roundtrip: UTC as text with two-digit milliseconds', async () => {
        const conn = ctx.withDateTimeFormat('UTC as text')
        const expected = { v: new Date(Date.UTC(1970, 0, 1, 10, 30, 45, 45)) }
        ctx.mockNext({ v: '10:30:45.045' })
        const row = await conn.selectFromNoTable()
            .select({ v: conn.const(new Date(Date.UTC(2024, 0, 15, 10, 30, 45, 45)), 'localTime') })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ? as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "10:30:45.045",
          ]
        `)
        assertType<Exact<typeof row, { v: Date }>>()
        expect(row).toEqual(expected)
    })

    // ---- localTime decode of a BARE TIME under a mismatched format, read from a
    // REAL column (real-backed, unlike the `conn.const`+`mockNext` decode tests
    // above which need `ctx.mockOnlyConnection()`). `started_at` for worklog
    // 1 is '09:15:00': a real sqlite stores it as TEXT and returns it verbatim
    // whatever the connection's dateTimeFormat is configured to, so decoding it
    // through a mismatched-format connection exercises the "unexpected string"
    // fall-back identically in mock and real mode. A bare TIME (no leading sign)
    // is NOT mistaken for a timezone, so it enters the format switch (a bare DATE
    // would short-circuit). The plain-time fall-back yields the same Date for
    // every numeric format; only the switch arm taken differs. ----

    test('localTime decode: bare time under unix-seconds format falls back to plain time', async () => {
        const conn = ctx.withDateTimeFlags('Unix time seconds as integer', { treatUnexpectedStringDateTimeAsUTC: false })
        ctx.mockNext({ v: '09:15:00' })
        const row = await conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ v: tIssueWorklog.startedAt })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select started_at as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { v?: Date }>>()
        expect(row).toEqual({ v: new Date(Date.UTC(1970, 0, 1, 9, 15, 0)) })
    })

    test('localTime decode: bare time under unix-seconds format with the UTC-tolerance flag', async () => {
        const conn = ctx.withDateTimeFlags('Unix time seconds as integer', { treatUnexpectedStringDateTimeAsUTC: true })
        ctx.mockNext({ v: '09:15:00' })
        const row = await conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ v: tIssueWorklog.startedAt })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select started_at as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { v?: Date }>>()
        expect(row).toEqual({ v: new Date(Date.UTC(1970, 0, 1, 9, 15, 0)) })
    })

    test('localTime decode: bare time under julian format falls back to plain time', async () => {
        const conn = ctx.withDateTimeFlags('Julian day as real number', { treatUnexpectedStringDateTimeAsUTC: false })
        ctx.mockNext({ v: '09:15:00' })
        const row = await conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ v: tIssueWorklog.startedAt })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select started_at as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { v?: Date }>>()
        expect(row).toEqual({ v: new Date(Date.UTC(1970, 0, 1, 9, 15, 0)) })
    })

    test('localTime decode: bare time under unix-milliseconds format falls back to plain time', async () => {
        const conn = ctx.withDateTimeFlags('Unix time milliseconds as integer', { treatUnexpectedStringDateTimeAsUTC: false })
        ctx.mockNext({ v: '09:15:00' })
        const row = await conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({ v: tIssueWorklog.startedAt })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select started_at as "v" from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { v?: Date }>>()
        expect(row).toEqual({ v: new Date(Date.UTC(1970, 0, 1, 9, 15, 0)) })
    })

    test('localTime decode: an invalid dateTimeFormat configuration is rejected', async () => {
        // A `getDateTimeFormat` returning an unknown format is a configuration
        // error the decoder rejects at the `default` switch arm. Forcing the
        // invalid format needs `as any` (the typed union excludes it); the test
        // CATCHES the thrown error, so it deliberately exercises the guard.
        const conn = ctx.withDateTimeFormat('an invalid format' as any)
        ctx.mockNext({ v: '09:15:00' })
        let caught: unknown
        try {
            await conn.selectFrom(tIssueWorklog)
                .where(tIssueWorklog.id.equals(1))
                .select({ v: tIssueWorklog.startedAt })
                .executeSelectOne()
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('INVALID_CONFIGURATION')
    })

    // ---- sqlite temporal number-branch / auto-detect decode via GUARDED mockNext.
    // A localDate/localTime/localDateTime `const` round-trips to a STRING in real
    // mode, so injecting a NUMBER/bigint/numeric-string is mock-only by
    // construction (DESIGN.md §18 guard). The number-branch applies the configured
    // format's Julian/Unix math, or — under a TEXT format — the
    // treatUnexpectedIntegerDateTimeAsJulian / unexpectedUnixDateTimeAreMilliseconds
    // auto-detect. localDate normalises to the decoded UTC date at 10:00Z; localTime
    // to the decoded UTC time-of-day on 1970-01-01. ----

    async function decodeUnexpected(conn: typeof ctx.conn, type: 'localDate' | 'localTime' | 'localDateTime', raw: number | bigint | string): Promise<Date> {
        ctx.mockNext({ v: raw })
        const col = type === 'localDate' ? conn.const(REF, 'localDate')
            : type === 'localTime' ? conn.const(REF, 'localTime')
            : conn.const(REF, 'localDateTime')
        const row = await conn.selectFromNoTable().select({ v: col }).executeSelectOne()
        return row.v
    }

    // NOT-APPLICABLE: under a text date-format a real sqlite round-trips the const to a string, never the injected integer, so this number-branch auto-detect is only reachable via the mock.
    test('localDate decode: integer under text format auto-detected as julian when flagged', async () => {
        ctx.mockOnlyConnection()
        const conn = ctx.withDateTimeFlags('localdate as text', { treatUnexpectedIntegerDateTimeAsJulian: true })
        expect(await decodeUnexpected(conn, 'localDate', 2460325)).toEqual(new Date(Date.UTC(2024, 0, 15, 10, 0, 0, 0)))
    })

    // NOT-APPLICABLE: under a text date-format a real sqlite round-trips the const to a string, never the injected integer, so this number-branch auto-detect is only reachable via the mock.
    test('localDate decode: integer under text format auto-detected as unix-ms when flagged', async () => {
        ctx.mockOnlyConnection()
        const conn = ctx.withDateTimeFlags('localdate as text', { unexpectedUnixDateTimeAreMilliseconds: true })
        expect(await decodeUnexpected(conn, 'localDate', 1705320000000)).toEqual(new Date(Date.UTC(2024, 0, 15, 10, 0, 0, 0)))
    })

    // NOT-APPLICABLE: under a text date-format a real sqlite round-trips the const to a string, never the injected integer, so this number-branch auto-detect is only reachable via the mock.
    test('localDate decode: integer under text format defaults to unix-seconds', async () => {
        ctx.mockOnlyConnection()
        const conn = ctx.withDateTimeFormat('localdate as text')
        expect(await decodeUnexpected(conn, 'localDate', 1705320000)).toEqual(new Date(Date.UTC(2024, 0, 15, 10, 0, 0, 0)))
    })

    test('localDate decode: bigint and numeric string under unix-seconds format', async () => {
        // Guard-free: a numeric format round-trips the const to a NUMBER, so a real
        // sqlite feeds the same number-branch and decodes to the asserted value.
        const conn = ctx.withDateTimeFormat('Unix time seconds as integer')
        expect(await decodeUnexpected(conn, 'localDate', 1705320000n)).toEqual(new Date(Date.UTC(2024, 0, 15, 10, 0, 0, 0)))
        expect(await decodeUnexpected(conn, 'localDate', '1705320000')).toEqual(new Date(Date.UTC(2024, 0, 15, 10, 0, 0, 0)))
    })

    // NOT-APPLICABLE: under a text date-format a real sqlite round-trips the const to a string, never the injected number, so this number-branch auto-detect is only reachable via the mock.
    test('localTime decode: real number under text format auto-detected as julian when flagged', async () => {
        ctx.mockOnlyConnection()
        const conn = ctx.withDateTimeFlags('localdate as text', { treatUnexpectedIntegerDateTimeAsJulian: true })
        expect(await decodeUnexpected(conn, 'localTime', 0.5)).toEqual(new Date(Date.UTC(1970, 0, 1, 12, 0, 0, 0)))
        expect(await decodeUnexpected(conn, 'localTime', 2460324.5)).toEqual(new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0)))
        expect(await decodeUnexpected(conn, 'localTime', -5)).toEqual(new Date(Date.UTC(1970, 0, 1, 12, 0, 0, 0)))
    })

    // NOT-APPLICABLE: under a text date-format a real sqlite round-trips the const to a string, never the injected integer, so this number-branch auto-detect is only reachable via the mock.
    test('localTime decode: integer under text format auto-detected as unix-ms when flagged', async () => {
        ctx.mockOnlyConnection()
        const conn = ctx.withDateTimeFlags('localdate as text', { unexpectedUnixDateTimeAreMilliseconds: true })
        expect(await decodeUnexpected(conn, 'localTime', 37845123)).toEqual(new Date(Date.UTC(1970, 0, 1, 10, 30, 45, 123)))
    })

    // NOT-APPLICABLE: under a text date-format a real sqlite round-trips the const to a string, never the injected integer, so this number-branch auto-detect is only reachable via the mock.
    test('localTime decode: integer and numeric string under text format default to unix-seconds', async () => {
        ctx.mockOnlyConnection()
        const conn = ctx.withDateTimeFormat('localdate as text')
        expect(await decodeUnexpected(conn, 'localTime', 37845)).toEqual(new Date(Date.UTC(1970, 0, 1, 10, 30, 45, 0)))
        expect(await decodeUnexpected(conn, 'localTime', '37845')).toEqual(new Date(Date.UTC(1970, 0, 1, 10, 30, 45, 0)))
    })

    test('localTime decode: bigint under unix-seconds format', async () => {
        // Guard-free (numeric format round-trips to a number — see the localDate twin).
        const conn = ctx.withDateTimeFormat('Unix time seconds as integer')
        expect(await decodeUnexpected(conn, 'localTime', 37845n)).toEqual(new Date(Date.UTC(1970, 0, 1, 10, 30, 45, 0)))
    })

    // NOT-APPLICABLE: under a text date-format a real sqlite round-trips the const to a string, never the injected integer, so this number-branch auto-detect is only reachable via the mock.
    test('localDateTime decode: integer and numeric string under text format default to unix-seconds', async () => {
        ctx.mockOnlyConnection()
        const conn = ctx.withDateTimeFormat('localdate as text')
        expect(await decodeUnexpected(conn, 'localDateTime', 1705314645)).toEqual(new Date(Date.UTC(2024, 0, 15, 10, 30, 45, 0)))
        expect(await decodeUnexpected(conn, 'localDateTime', '1705314645')).toEqual(new Date(Date.UTC(2024, 0, 15, 10, 30, 45, 0)))
    })

    test('localDateTime decode: bigint under unix-seconds format', async () => {
        // Guard-free (numeric format round-trips to a number — see the localDate twin).
        const conn = ctx.withDateTimeFormat('Unix time seconds as integer')
        expect(await decodeUnexpected(conn, 'localDateTime', 1705314645n)).toEqual(new Date(Date.UTC(2024, 0, 15, 10, 30, 45, 0)))
    })
})
