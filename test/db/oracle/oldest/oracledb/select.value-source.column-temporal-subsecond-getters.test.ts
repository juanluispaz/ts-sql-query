// Coverage of the PLAIN-COLUMN arm of the temporal date-part getters — the
// sibling of the const-cast arm in
// select.value-source.const-temporal-getters.test.ts. A JS Date only carries
// millisecond precision, so no `const(..., 'localDateTime')` receiver can express
// a sub-millisecond instant; a microsecond value can only enter through a column.
// tTemporalPrecision.microStamp is seeded with 12:30:59.999600 (999600 µs), and
// the getters' SQL-side truncation must keep getSeconds() at 59 (not round up to
// 60) and getMilliseconds() at 999 (not round up to 1000, nor wrap to 0). The
// microseconds only exist in a real engine, so the values matter under the real
// DB; the mock returns the same expected row.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tReleaseDraft, tTemporalPrecision } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('column-localdatetime-subsecond-getters-truncate', async () => {
        const expected = [{ s: 59, ms: 999 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tTemporalPrecision)
            .where(tTemporalPrecision.id.equals(1))
            .select({
                s:  tTemporalPrecision.microStamp.getSeconds(),
                ms: tTemporalPrecision.microStamp.getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select trunc(extract(second from micro_stamp)) as "s", to_number(to_char(micro_stamp, 'FF3')) as "ms" from temporal_precision where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ s: number; ms: number }>>>()
        expect(rows).toEqual(expected)
    })
    test('column-microstamp-gettime-rounds-up', async () => {
        // getTime() is the sole SUB-SECOND-SENSITIVE getter (extract-epoch × 1000),
        // unlike the truncating getSeconds/getMilliseconds siblings above which read a
        // component. On the µs-precision micro_stamp (2024-01-15 12:30:59.999600) the
        // epoch-ms lands on the boundary 1705321860000 (12:31:00.000, PostgreSQL's
        // `round(... * 1000)` rounds the .9996 ms term UP) or 1705321859999 (engines that
        // truncate the sub-ms term, e.g. SQLite). The instant is the same; the ±1 ms is
        // the engine's sub-millisecond rounding. Result type: required `number`.
        ctx.mockNext([{ t: Date.UTC(2024, 0, 15, 12, 31, 0) }])
        const rows = await ctx.conn.selectFrom(tTemporalPrecision)
            .where(tTemporalPrecision.id.equals(1))
            .select({
                t: tTemporalPrecision.microStamp.getTime(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (cast(micro_stamp as date) - date '1970-01-01') * 86400000 + to_number(to_char(micro_stamp, 'FF3')) as "t" from temporal_precision where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ t: number }>>>()
        // ±1 ms tolerance across engines' sub-millisecond rounding of the 999600 µs term.
        expect(Math.abs(rows[0]!.t - Date.UTC(2024, 0, 15, 12, 31, 0))).toBeLessThanOrEqual(1)
    })
    test('column-shifthour-adapter-datetime-getters-drop-adapter', async () => {
        // All 9 getters on shiftedStamp (customLocalDateTime + shiftHourAdapter),
        // DEFAULT '2024-06-01 10:00:00' (a Saturday). getHours() reports the RAW 10,
        // NOT the adapter-shifted 11 — the adapter is dropped at the getter. So year
        // 2024, month 5 (June, JS 0-indexed), date 1, day-of-week 6, hours 10,
        // minutes 0, seconds 0, milliseconds 0, and getTime() = the raw
        // 2024-06-01 10:00:00 epoch (NOT the +1h 11:00:00). Every leaf is a required
        // unbranded `number`.
        const expected = [{
            y: 2024, mo: 5, d: 1, dow: 6, h: 10, m: 0, s: 0, ms: 0,
            t: Date.UTC(2024, 5, 1, 10, 0, 0),
        }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({
                y:   tReleaseDraft.shiftedStamp.getFullYear(),
                mo:  tReleaseDraft.shiftedStamp.getMonth(),
                d:   tReleaseDraft.shiftedStamp.getDate(),
                dow: tReleaseDraft.shiftedStamp.getDay(),
                h:   tReleaseDraft.shiftedStamp.getHours(),
                m:   tReleaseDraft.shiftedStamp.getMinutes(),
                s:   tReleaseDraft.shiftedStamp.getSeconds(),
                ms:  tReleaseDraft.shiftedStamp.getMilliseconds(),
                t:   tReleaseDraft.shiftedStamp.getTime(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(year from shifted_stamp) as "y", extract(month from shifted_stamp) - 1 as "mo", extract(day from shifted_stamp) as "d", mod(trunc(shifted_stamp) - trunc(shifted_stamp, 'IW') + 1, 7) as "dow", extract(hour from shifted_stamp) as "h", extract(minute from shifted_stamp) as "m", trunc(extract(second from shifted_stamp)) as "s", to_number(to_char(shifted_stamp, 'FF3')) as "ms", (cast(shifted_stamp as date) - date '1970-01-01') * 86400000 + to_number(to_char(shifted_stamp, 'FF3')) as "t" from release_draft where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y: number; mo: number; d: number; dow: number; h: number; m: number; s: number; ms: number; t: number }>>>()
        expect(rows).toEqual(expected)
    })
    test('column-shifthour-adapter-date-getters-drop-adapter', async () => {
        // The 4 LocalDate getters on shiftedReleaseDay (customLocalDate +
        // shiftHourAdapter), DEFAULT '2025-03-01' (a Saturday). The getter drops the
        // adapter and reports the raw date components: year 2025, month 2 (March, JS
        // 0-indexed), date 1, day-of-week 6. Every leaf is a required unbranded
        // `number`.
        const expected = [{ y: 2025, mo: 2, d: 1, dow: 6 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({
                y:   tReleaseDraft.shiftedReleaseDay.getFullYear(),
                mo:  tReleaseDraft.shiftedReleaseDay.getMonth(),
                d:   tReleaseDraft.shiftedReleaseDay.getDate(),
                dow: tReleaseDraft.shiftedReleaseDay.getDay(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(year from shifted_release_day) as "y", extract(month from shifted_release_day) - 1 as "mo", extract(day from shifted_release_day) as "d", mod(trunc(shifted_release_day) - trunc(shifted_release_day, 'IW') + 1, 7) as "dow" from release_draft where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y: number; mo: number; d: number; dow: number }>>>()
        expect(rows).toEqual(expected)
    })
    test('column-shifthour-adapter-time-getters-drop-adapter', async () => {
        // The 4 LocalTime getters on shiftedCutoff (customLocalTime +
        // shiftHourAdapter), DEFAULT '09:00:00'. getHours() reports the RAW 9, NOT
        // the adapter-shifted 10 — the adapter is dropped at the getter. So hours 9,
        // minutes 0, seconds 0, milliseconds 0. Every leaf is a required unbranded
        // `number`.
        const expected = [{ h: 9, m: 0, s: 0, ms: 0 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({
                h:  tReleaseDraft.shiftedCutoff.getHours(),
                m:  tReleaseDraft.shiftedCutoff.getMinutes(),
                s:  tReleaseDraft.shiftedCutoff.getSeconds(),
                ms: tReleaseDraft.shiftedCutoff.getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select extract(hour from shifted_cutoff) as "h", extract(minute from shifted_cutoff) as "m", trunc(extract(second from shifted_cutoff)) as "s", to_number(to_char(shifted_cutoff, 'FF3')) as "ms" from release_draft where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ h: number; m: number; s: number; ms: number }>>>()
        expect(rows).toEqual(expected)
    })
})
