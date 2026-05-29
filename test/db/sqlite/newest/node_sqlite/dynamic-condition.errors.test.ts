// Structured error reasons raised by `DynamicConditionBuilder` when the
// runtime filter is malformed. The sibling extension-error files
// (`dynamic-condition.column-extension-errors.test.ts`,
// `dynamic-condition.nested-extension.test.ts`) cover
// DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE via the thrown message;
// this file pins the three filter-shape reasons by their
// `errorReason.reason` code — the field downstream code switches on — none
// of which any other test triggers:
//
//   - DYNAMIC_CONDITION_UNKNOWN_COLUMN    — a filter key with no matching column
//   - DYNAMIC_CONDITION_UNKNOWN_OPERATION — an unknown operator on a column,
//     and the blanket rejection of any operator on an aggregated-array
//     value source (DynamicConditionBuilder.ts L147)
//   - DYNAMIC_CONDITION_INVALID_FILTER    — a non-object / Date filter, a
//     column value that is not an object, and `and` / `or` given a non-array
//
// The builder throws synchronously while `withValues(...)` runs — before any
// SQL is built or dispatched — so the assertions wrap the construction in a
// try/catch and never touch the mock or a real DB. There is no SQL snapshot:
// the reason code is dialect-independent, so this file is identical in every
// cell (the malformed filters are forced past the compile-time guard with
// `as any`, mirroring what an untyped external JSON payload would deliver).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

const selectFields = { id: tIssue.id, title: tIssue.title }

// Run the (synchronous) builder and report the structured reason of the
// TsSqlError it throws, or a marker if it threw something else / nothing.
function reasonOf(build: () => unknown): string {
    try {
        build()
    } catch (e) {
        return e instanceof TsSqlError ? e.errorReason.reason : `non-TsSqlError: ${String(e)}`
    }
    return '<no throw>'
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('errors/unknown-column-reason', () => {
        const reason = reasonOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues({ nope: { equals: 1 } } as any))
        expect(reason).toBe('DYNAMIC_CONDITION_UNKNOWN_COLUMN')
    })

    test('errors/unknown-operation-reason', () => {
        const reason = reasonOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues({ id: { bogusOp: 1 } } as any))
        expect(reason).toBe('DYNAMIC_CONDITION_UNKNOWN_OPERATION')
    })

    test('errors/non-object-filter-reason', () => {
        const reason = reasonOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues('not-an-object' as any))
        expect(reason).toBe('DYNAMIC_CONDITION_INVALID_FILTER')
    })

    test('errors/date-as-filter-reason', () => {
        const reason = reasonOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues(new Date('2020-01-01T00:00:00.000Z') as any))
        expect(reason).toBe('DYNAMIC_CONDITION_INVALID_FILTER')
    })

    test('errors/column-value-not-object-reason', () => {
        const reason = reasonOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues({ id: 5 } as any))
        expect(reason).toBe('DYNAMIC_CONDITION_INVALID_FILTER')
    })

    test('errors/and-not-array-reason', () => {
        const reason = reasonOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues({ and: 'x' } as any))
        expect(reason).toBe('DYNAMIC_CONDITION_INVALID_FILTER')
    })

    test('errors/or-not-array-reason', () => {
        const reason = reasonOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues({ or: 'x' } as any))
        expect(reason).toBe('DYNAMIC_CONDITION_INVALID_FILTER')
    })

    test('errors/aggregated-array-operation-reason', () => {
        // An aggregated-array value source rejects ANY operator — the
        // builder funnels it through the same UNKNOWN_OPERATION guard
        // (DynamicConditionBuilder.ts L147: `|| valueSourcePrivate.__aggregatedArrayColumns`).
        const aggFields = {
            id:     tIssue.id,
            titles: ctx.conn.aggregateAsArrayOfOneColumn(tIssue.title),
        }
        const reason = reasonOf(() =>
            ctx.conn.dynamicConditionFor(aggFields).withValues({ titles: { equals: 'x' } } as any))
        expect(reason).toBe('DYNAMIC_CONDITION_UNKNOWN_OPERATION')
    })
})
