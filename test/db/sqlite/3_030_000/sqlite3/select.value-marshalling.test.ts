// Coverage of AbstractConnection value marshalling
// (`transformValueToDB` / `transformValueFromDB`) for the bigint, double
// and uuid value types, added to the shared `issue` domain as
// `viewCount` (bigint), `estimatedHours` (double) and `externalRef`
// (uuid). Each insert→select round-trip exercises both directions:
//   - INSERT params go through `transformValueToDB` (the JS value reaches
//     the driver),
//   - the SELECT result goes through `transformValueFromDB` (the value
//     comes back and is re-typed to bigint / number / string).
//
// One value type per test so a connector that can't handle a single type
// only loses that test (not the others). Connector limitations surfaced:
//   - bigint: the `sqlite3` driver can't bind a JS BigInt (sends NULL).
//   - uuid:   the shared test connection defaults to the `'string'` uuid
//             strategy, so uuid columns round-trip as plain TEXT and no
//             binary uuid helper is needed.
//
// Bodies run inside `ctx.withRollback(...)`. The value assertion is
// identical in both modes: `expected` carries the exact JS values
// inserted, and selections filter by the stable `number` literal so the
// param snapshot matches mock and real.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tIssue, tIssueWorklog } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('marshalling/bigint-insert-select-roundtrip', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(501) // mocked new id; real DB assigns its own
            const newId = await ctx.conn.insertInto(tIssue)
                .values({
                    projectId: 1,
                    number:    9002,
                    title:     'Bigint counter',
                    status:    'open',
                    priority:  2,
                    viewCount: 1500n,
                })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, view_count) values (?, ?, ?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                9002,
                "Bigint counter",
                "open",
                2,
                1500,
              ]
            `)

            const expected = { id: newId, views: 1500n }
            ctx.mockNext(expected)
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.number.equals(9002))
                .select({ id: tIssue.id, views: tIssue.viewCount })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, view_count as views from issue where number = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9002,
              ]
            `)
            assertType<Exact<typeof row, { id: number; views: bigint }>>()
            expect(row).toEqual(expected)
        })
    })

    test('marshalling/double-insert-select-roundtrip', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(502) // mocked new id; real DB assigns its own
            const newId = await ctx.conn.insertInto(tIssue)
                .values({
                    projectId:      1,
                    number:         9003,
                    title:          'Telemetry spike',
                    status:         'open',
                    priority:       2,
                    estimatedHours: 4.5,
                })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, estimated_hours) values (?, ?, ?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                9003,
                "Telemetry spike",
                "open",
                2,
                4.5,
              ]
            `)

            const expected = { id: newId, hours: 4.5 }
            ctx.mockNext(expected)
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.number.equals(9003))
                .select({ id: tIssue.id, hours: tIssue.estimatedHours })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, estimated_hours as hours from issue where number = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9003,
              ]
            `)
            assertType<Exact<typeof row, { id: number; hours?: number }>>()
            expect(row).toEqual(expected)
        })
    })

    test('marshalling/uuid-insert-select-roundtrip', async () => {
        const ref = '0a8f9c1e-1111-4222-8333-444455556666'
        await ctx.withRollback(async () => {
            ctx.mockNext(503) // mocked new id; real DB assigns its own
            const newId = await ctx.conn.insertInto(tIssue)
                .values({
                    projectId:   1,
                    number:      9004,
                    title:       'External ref',
                    status:      'open',
                    priority:    2,
                    externalRef: ref,
                })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, external_ref) values (?, ?, ?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                9004,
                "External ref",
                "open",
                2,
                "0a8f9c1e-1111-4222-8333-444455556666",
              ]
            `)

            const expected = { id: newId, ref }
            ctx.mockNext(expected)
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.number.equals(9004))
                .select({ id: tIssue.id, ref: tIssue.externalRef })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, external_ref as ref from issue where number = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9004,
              ]
            `)
            assertType<Exact<typeof row, { id: number; ref?: string }>>()
            expect(row).toEqual(expected)
        })
    })

    test('marshalling/bigint-column-scalar-read-past-2p53', async () => {
        // A bigint column value beyond 2^53 read DIRECTLY as a scalar column (not inside a JSON
        // aggregate) through the driver's DEFAULT reader. 9007199254740993 is the first odd integer
        // a double cannot represent.
        // sqlite3 is deprecated and has no exact-integer mode at all: it rounds a wide integer to a
        // JavaScript number, so reading it can only be best effort — the marshaller refuses the
        // rounded value with PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE instead of returning a
        // clean-but-wrong bigint. The mock seeds the same rounded number, so mock and real agree.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ viewCount: 9007199254740993n }).where(tIssue.id.equals(1)).executeUpdate()

            ctx.mockNext({ views: 9007199254740996 })
            let err: unknown
            try {
                await ctx.conn.selectFrom(tIssue)
                    .where(tIssue.id.equals(1))
                    .select({ views: tIssue.viewCount })
                    .executeSelectOne()
            } catch (e) {
                err = e
            }
            expect(err).toBeInstanceOf(TsSqlError)
            expect((err as TsSqlError).errorReason.reason).toBe('PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE')
        })
    })

    test('marshalling/double-scientific-scalar-roundtrip', async () => {
        // A double of small magnitude read DIRECTLY as a scalar column (not via a JSON aggregate).
        // Drivers hand a `double` column back as a JS number, so this exercises the number path
        // and confirms a scientific-magnitude value survives a plain select on every connector.
        // (The scientific-STRING form only arises in a JSON aggregate — covered by
        // select.aggregate-as-array.value-type-coverage — or under the mock — covered by
        // marshalling.transform-validation.)
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 1.5e-8 }).where(tIssue.id.equals(1)).executeUpdate()

            ctx.mockNext({ hours: 1.5e-8 })
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({ hours: tIssue.estimatedHours })
                .executeSelectOne()
            assertType<Exact<typeof row, { hours?: number }>>()
            expect(row.hours).toBe(1.5e-8)
        })
    })

    // A stopwatch-recorded clock-in carries milliseconds, and how the
    // fractional second reaches the driver is the connection's decision:
    // `AbstractConnection` formats a `localTime` into an `'HH:MM:SS.fff'`
    // string itself (so the zero-padding below is the library's own
    // arithmetic), while `SqlServerConnection` and `OracleConnection` bind the
    // `Date` and `SqliteConnection` encodes per its configured storage format.
    // These three pin the widths the padding has to produce — 3, 2 and 1
    // significant digits — per cell.
    //
    // The row is deliberately NOT read back. The emitted param is exact
    // everywhere, but what survives a round trip is not: MySQL/MariaDB round a
    // `TIME(0)` to whole seconds, Oracle anchors a `TIMESTAMP` at 1970 and
    // SQLite's stored shape follows its format setting. Asserting the param
    // plus the affected-row count keeps one unconditional assertion valid in
    // both modes.
    async function clockIn(milliseconds: number) {
        ctx.mockNext(1)
        return await ctx.conn.update(tIssueWorklog)
            .set({ startedAt: new Date(Date.UTC(1970, 0, 1, 9, 15, 0, milliseconds)) })
            .where(tIssueWorklog.id.equals(1))
            .executeUpdate()
    }

    test('marshalling/localtime-milliseconds-three-digits', async () => {
        await ctx.withRollback(async () => {
            const updated = await clockIn(123)
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue_worklog set started_at = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "09:15:00.123",
                1,
              ]
            `)
            assertType<Exact<typeof updated, number>>()
            expect(updated).toEqual(1)
        })
    })

    test('marshalling/localtime-milliseconds-two-digits-are-left-padded', async () => {
        await ctx.withRollback(async () => {
            const updated = await clockIn(45)
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue_worklog set started_at = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "09:15:00.045",
                1,
              ]
            `)
            assertType<Exact<typeof updated, number>>()
            expect(updated).toEqual(1)
        })
    })

    test('marshalling/localtime-milliseconds-one-digit-is-left-padded', async () => {
        await ctx.withRollback(async () => {
            const updated = await clockIn(7)
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue_worklog set started_at = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "09:15:00.007",
                1,
              ]
            `)
            assertType<Exact<typeof updated, number>>()
            expect(updated).toEqual(1)
        })
    })
})
