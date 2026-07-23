// Coverage of AbstractConnection's value-marshalling VALIDATION branches
// (`transformValueToDB` / `transformValueFromDB`) — the per-type guards
// that re-type or reject values crossing the JS<->DB boundary. The
// existing `select.value-marshalling.test.ts` only covers the happy
// round-trip for bigint/double/uuid; the rejection throws and the
// cross-representation coercions (string->int, bigint->int, number->bool,
// empty-string->null, ...) were entirely unverified.
//
// Two halves:
//
//   - `to-db-validation/*` exercises `transformValueToDB`. The transform
//     runs CLIENT-SIDE while the SQL is built (before the driver is
//     touched), so a runtime-invalid value throws in BOTH mock and
//     real-DB mode — these tests need no guard. A `const(...)` carrying
//     the bad value is projected so the builder emits it as a param;
//     building that param invokes the transform and throws.
//
//   - `from-db-validation/*` exercises `transformValueFromDB`. To drive
//     it the projection must receive a value of a shape a real driver of
//     THIS connector would never hand back (a numeric string for an int
//     column, a number for a uuid column, ...). That injection is only
//     possible through `mockNext` (ignored on real DB), so these tests
//     are mock-only BY CONSTRUCTION — guarded per test/DESIGN.md §18 with
//     `if (ctx.realDbEnabled) return`. They pin the defensive re-typing
//     other drivers' representations rely on, plus the rejection throws.
//
// No SQL/param snapshots: the contract under test is the transform, not
// the emitted SQL. The scalar branches behave identically on every
// dialect, so this file is byte-identical across every cell.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

function reasonOf(e: unknown): string | undefined {
    if (e instanceof TsSqlError) return e.errorReason.reason
    return undefined
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // Project a const carrying a runtime-invalid value; emitting its
    // param invokes transformValueToDB and rejects before any DB is hit.
    async function toDbReason(makeConst: () => unknown): Promise<string | undefined> {
        ctx.mockNext([])
        try {
            sync(ctx.conn.selectFrom(tIssue)
                .select({ id: tIssue.id, x: makeConst() as any })
                .executeSelectMany())
            return undefined
        } catch (e) {
            return reasonOf(e)
        }
    }

    test('marshalling/to-db-validation/int-non-integer-throws', async () => {
        expect(await toDbReason(() => ctx.conn.const(1.5, 'int'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('marshalling/to-db-validation/int-non-number-throws', async () => {
        expect(await toDbReason(() => ctx.conn.const('x' as any, 'int'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('marshalling/to-db-validation/bigint-non-bigint-throws', async () => {
        expect(await toDbReason(() => ctx.conn.const(5 as any, 'bigint'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('marshalling/to-db-validation/double-non-number-throws', async () => {
        expect(await toDbReason(() => ctx.conn.const('x' as any, 'double'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('marshalling/to-db-validation/string-non-string-throws', async () => {
        expect(await toDbReason(() => ctx.conn.const(5 as any, 'string'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('marshalling/to-db-validation/boolean-non-boolean-throws', async () => {
        expect(await toDbReason(() => ctx.conn.const('x' as any, 'boolean'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('marshalling/to-db-validation/uuid-non-string-throws', async () => {
        expect(await toDbReason(() => ctx.conn.const(5 as any, 'uuid'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('marshalling/to-db-validation/localDate-invalid-date-throws', async () => {
        expect(await toDbReason(() => ctx.conn.const(new Date(NaN), 'localDate'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('marshalling/to-db-validation/localTime-invalid-date-throws', async () => {
        expect(await toDbReason(() => ctx.conn.const(new Date(NaN), 'localTime'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('marshalling/to-db-validation/localDateTime-invalid-date-throws', async () => {
        expect(await toDbReason(() => ctx.conn.const(new Date(NaN), 'localDateTime'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('marshalling/to-db-validation/empty-string-sent-as-null', async () => {
        // The `'' && !allowEmptyString -> null` branch: building the const
        // param transforms '' to null, so the emitted param is null. Runs
        // client-side, identical in both modes (param count/value uniform
        // across dialects), so no guard and no SQL snapshot needed.
        // `optionalConst` (not `const`) so the resulting null projects as
        // `undefined` on the in-process real connectors instead of tripping
        // the required-column MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE check.
        ctx.mockNext([])
        sync(ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, x: ctx.conn.optionalConst('', 'string') })
            .executeSelectMany())
        expect(ctx.lastParams).toEqual([null])
    })

    // mockNext injects a representation the real driver wouldn't return,
    // so the body can only run under the mock. Each test asserts either
    // the re-typed value or the rejection reason.
    async function fromDbValue(column: unknown, dbValue: unknown): Promise<unknown> {
        ctx.mockNext({ v: dbValue })
        const row = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ v: column as any })
            .executeSelectOne())
        return (row as any).v
    }

    async function fromDbReason(column: unknown, dbValue: unknown): Promise<string | undefined> {
        ctx.mockNext({ v: dbValue })
        try {
            sync(ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({ v: column as any })
                .executeSelectOne())
            return undefined
        } catch (e) {
            return reasonOf(e)
        }
    }

    test('marshalling/from-db-validation/int-from-numeric-string', async () => {
        if (ctx.realDbEnabled) return
        expect(await fromDbValue(tIssue.priority, '123')).toBe(123)
    })

    test('marshalling/from-db-validation/int-from-bigint', async () => {
        if (ctx.realDbEnabled) return
        expect(await fromDbValue(tIssue.priority, 123n)).toBe(123)
    })

    test('marshalling/from-db-validation/int-non-integer-throws', async () => {
        if (ctx.realDbEnabled) return
        expect(await fromDbReason(tIssue.priority, 1.5)).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    test('marshalling/from-db-validation/int-invalid-string-throws', async () => {
        if (ctx.realDbEnabled) return
        expect(await fromDbReason(tIssue.priority, '1.5')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    test('marshalling/from-db-validation/int-from-number-over-safe-range-throws', async () => {
        // A number beyond the safe integer range arrived for an int column: it is already
        // rounded, so the marshaller refuses it rather than return a silently-wrong int. This
        // is the number-route half of the guard the string/bigint routes below already had, so
        // every route now reaches the same PRECISION_LOST verdict (homogeneous read).
        if (ctx.realDbEnabled) return
        expect(await fromDbReason(tIssue.priority, 9007199254740996)).toBe('PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE')
    })

    test('marshalling/from-db-validation/int-from-string-over-safe-range-throws', async () => {
        // Exact digits that exceed the safe integer range for int: read the column as bigint.
        if (ctx.realDbEnabled) return
        expect(await fromDbReason(tIssue.priority, '9007199254740993')).toBe('PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE')
    })

    test('marshalling/from-db-validation/int-from-bigint-over-safe-range-throws', async () => {
        // A bigint whose value exceeds the safe integer range for int: read the column as bigint.
        if (ctx.realDbEnabled) return
        expect(await fromDbReason(tIssue.priority, 9007199254740993n)).toBe('PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE')
    })

    test('marshalling/from-db-validation/bigint-from-number', async () => {
        if (ctx.realDbEnabled) return
        expect(await fromDbValue(tIssue.viewCount, 7)).toBe(7n)
    })

    test('marshalling/from-db-validation/bigint-from-string', async () => {
        if (ctx.realDbEnabled) return
        expect(await fromDbValue(tIssue.viewCount, '7')).toBe(7n)
    })

    test('marshalling/from-db-validation/bigint-invalid-string-throws', async () => {
        if (ctx.realDbEnabled) return
        expect(await fromDbReason(tIssue.viewCount, 'not-a-number')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    test('marshalling/from-db-validation/bigint-from-number-over-safe-range-throws', async () => {
        // A bigint delivered as a rounded JS number (the driver's big-integer mode is off, or a
        // bigint travelled through a JSON aggregate as a bare number): precision is already
        // lost, so the marshaller throws instead of minting a clean-but-wrong bigint via
        // BigInt(value). The string/bigint routes above stay exact; only this route can lose it.
        if (ctx.realDbEnabled) return
        expect(await fromDbReason(tIssue.viewCount, 9007199254740996)).toBe('PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE')
    })

    test('marshalling/from-db-validation/bigint-from-trailing-dot-zero-string', async () => {
        // A `bigint` leaf an engine serialises with a fractional-zero suffix (SQLite renders an
        // integer-valued REAL expression as `4.0` inside a JSON aggregate) arrives as `"4.0"`.
        // `BigInt('4.0')` throws, so the marshaller strips a trailing `.0+` (fractional zeros
        // only) before parsing — symmetric to the `int` arm, which already tolerated it.
        if (ctx.realDbEnabled) return
        expect(await fromDbValue(tIssue.viewCount, '4.0')).toBe(4n)
        expect(await fromDbValue(tIssue.viewCount, '4.00')).toBe(4n)
        expect(await fromDbValue(tIssue.viewCount, '-0.0')).toBe(0n)
    })

    test('marshalling/from-db-validation/bigint-from-fractional-string-throws', async () => {
        // A genuine fractional part is NOT an integer: `"4.5"` still fails `BigInt` and throws,
        // so stripping the fractional-zero suffix never lets a real decimal through.
        if (ctx.realDbEnabled) return
        expect(await fromDbReason(tIssue.viewCount, '4.5')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    test('marshalling/from-db-validation/double-from-string', async () => {
        if (ctx.realDbEnabled) return
        expect(await fromDbValue(tIssue.estimatedHours, '4.5')).toBe(4.5)
    })

    test('marshalling/from-db-validation/double-invalid-string-throws', async () => {
        if (ctx.realDbEnabled) return
        expect(await fromDbReason(tIssue.estimatedHours, 'abc')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    test('marshalling/from-db-validation/double-from-scientific-string', async () => {
        // A large/small double renders in scientific notation inside a JSON aggregate
        // (PostgreSQL emits e.g. `1.5e-08` / `1e+20`; SQL Server's compat convert style 3 too),
        // reaching the marshaller as a string; both exponent signs — and the leading-dot form a
        // driver may hand back without a leading zero — parse to the exact double.
        if (ctx.realDbEnabled) return
        expect(await fromDbValue(tIssue.estimatedHours, '1.5e-08')).toBe(1.5e-8)
        expect(await fromDbValue(tIssue.estimatedHours, '1e+20')).toBe(1e20)
        expect(await fromDbValue(tIssue.estimatedHours, '.5')).toBe(0.5)
    })

    test('marshalling/from-db-validation/boolean-from-number', async () => {
        if (ctx.realDbEnabled) return
        expect(await fromDbValue(tIssue.priority.greaterThan(0), 1)).toBe(true)
    })

    test('marshalling/from-db-validation/boolean-invalid-throws', async () => {
        if (ctx.realDbEnabled) return
        expect(await fromDbReason(tIssue.priority.greaterThan(0), 'x')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    test('marshalling/from-db-validation/boolean-from-numeric-string-one', async () => {
        // The numeric-string boolean branch (`/^(-?\d+)$/` -> `!!(+value)`):
        // engines without a native boolean store it as 0/1 and some drivers
        // (oracledb) hand a numeric column back as a string. `'1'` -> true.
        if (ctx.realDbEnabled) return
        expect(await fromDbValue(tIssue.priority.greaterThan(0), '1')).toBe(true)
    })

    test('marshalling/from-db-validation/boolean-from-numeric-string-zero', async () => {
        // `'0'` -> false, the other side of the numeric-string branch.
        if (ctx.realDbEnabled) return
        expect(await fromDbValue(tIssue.priority.greaterThan(0), '0')).toBe(false)
    })

    test('marshalling/from-db-validation/boolean-from-negative-numeric-string', async () => {
        // The regex accepts a leading minus, so `'-5'` -> `!!(-5)` -> true.
        if (ctx.realDbEnabled) return
        expect(await fromDbValue(tIssue.priority.greaterThan(0), '-5')).toBe(true)
    })

    test('marshalling/from-db-validation/boolean-from-decimal-string-throws', async () => {
        // A decimal string does NOT match the integer regex, so it falls through
        // to the reject — the boundary between the numeric-string branch and the
        // non-numeric throw.
        if (ctx.realDbEnabled) return
        expect(await fromDbReason(tIssue.priority.greaterThan(0), '1.5')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    test('marshalling/from-db-validation/string-non-string-throws', async () => {
        if (ctx.realDbEnabled) return
        expect(await fromDbReason(tIssue.title, 12345)).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    test('marshalling/from-db-validation/uuid-non-string-throws', async () => {
        if (ctx.realDbEnabled) return
        expect(await fromDbReason(tIssue.externalRef, 5)).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    test('marshalling/from-db-validation/empty-string-becomes-null', async () => {
        // The `''->null` from-DB branch: transformValueFromDB turns '' into
        // null; on an OPTIONAL column the projector then surfaces that null
        // as `undefined`. (A required column would instead throw
        // MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE.) Either way a
        // non-empty string would have come back unchanged, so observing
        // the absence proves the branch fired.
        if (ctx.realDbEnabled) return
        expect(await fromDbValue(tIssue.body, '')).toBeUndefined()
    })

    test('marshalling/from-db-validation/required-column-null-throws-mandatory', async () => {
        // A REQUIRED column receiving null from the DB trips the projector's
        // MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE check — the required-column
        // counterpart of the optional empty-string->undefined branch above.
        // `tIssue.title` is required, so an absent value is rejected instead of
        // surfacing as undefined. mock-only by construction (a real driver
        // never hands back null for a NOT NULL column).
        if (ctx.realDbEnabled) return
        expect(await fromDbReason(tIssue.title, null)).toBe('MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE')
    })

    // `aggregateAsArray(...)` produces a JSON-aggregated column that
    // `__transformAggregatedArray` parses. A real driver hands back a valid
    // JSON array (or an already-parsed array), so the malformed / non-array
    // shapes that trip the two INVALID_JSON throw-sites can only be injected
    // through `mockNext` — mock-only by construction.
    async function aggregatedArrayReason(badValue: unknown): Promise<string | undefined> {
        ctx.mockNext([{ pid: 1, items: badValue }])
        try {
            sync(ctx.conn.selectFrom(tIssue)
                .select({
                    pid:   tIssue.projectId,
                    items: ctx.conn.aggregateAsArray({ id: tIssue.id, title: tIssue.title }),
                })
                .groupBy('pid')
                .executeSelectMany())
            return undefined
        } catch (e) {
            return reasonOf(e)
        }
    }

    test('marshalling/from-db-validation/aggregated-array-malformed-json-throws', async () => {
        // A string that is not valid JSON trips the `JSON.parse` catch.
        if (ctx.realDbEnabled) return
        expect(await aggregatedArrayReason('{not valid json')).toBe('INVALID_JSON_RECEIVED_FROM_DATABASE')
    })

    test('marshalling/from-db-validation/aggregated-array-non-array-json-throws', async () => {
        // Valid JSON that parses to a non-array (an object) trips the
        // `!Array.isArray` guard.
        if (ctx.realDbEnabled) return
        expect(await aggregatedArrayReason('{"a":1}')).toBe('INVALID_JSON_RECEIVED_FROM_DATABASE')
    })

    test('marshalling/from-db-validation/mandatory-error-carries-row-index-and-column-path', async () => {
        // A per-row MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE raised by
        // `executeSelectMany` pins WHERE it happened: the 0-based `rowIndex` of the
        // offending row and the projection `columnPath`. Here the second row (index 1)
        // hands back null for the required `title` column, so the projector rejects it
        // and the reason carries rowIndex=1, columnPath='title'. mock-only by
        // construction (a real driver never returns null for the NOT NULL `title`
        // column); `columnPath` is asserted nowhere else in the suite.
        if (ctx.realDbEnabled) return
        ctx.mockNext([{ title: 'ok' }, { title: null }])
        let caught: unknown
        try {
            sync(ctx.conn.selectFrom(tIssue)
                .select({ title: tIssue.title })
                .executeSelectMany())
        } catch (e) {
            caught = e
        }
        const reason = caught instanceof TsSqlError ? caught.errorReason : undefined
        expect(reason?.reason).toBe('MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE')
        if (reason?.reason === 'MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE') {
            expect(reason.rowIndex).toBe(1)
            expect(reason.columnPath).toBe('title')
        }
    })
})
