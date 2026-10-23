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
// value source
//   - DYNAMIC_CONDITION_INVALID_FILTER    — a non-object / Date filter, a
//     column value that is not an object, and `and` / `or` given a non-array
//
// It also pins the structured `errorReason.path` for errors raised inside a
// nested projection: the path is the dot-joined trail of the nested keys down
// to the offending column (`project.assignee.nope`), separated by a single dot
// at each level with no run-together segments or stray spaces.
//
// The builder throws synchronously while `withValues(...)` runs — before any
// SQL is built or dispatched — so the assertions wrap the construction in a
// try/catch and never touch the mock or a real DB. There is no SQL snapshot:
// the reason code and the path are dialect-independent, so this file is
// identical in every cell (the malformed filters are forced past the
// compile-time guard with `as any`, mirroring what an untyped external JSON
// payload would deliver).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tAppUser, tIssue, tProject } from '../../domain/connection.js'
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

// Same shape, but reports the structured `path` of the thrown TsSqlError —
// present on every dynamic-condition reason. Used to pin the dotted path a
// nested filter accumulates before it throws.
function pathOf(build: () => unknown): string {
    try {
        build()
    } catch (e) {
        if (e instanceof TsSqlError) {
            const reason = e.errorReason
            return 'path' in reason ? reason.path : `<no path on ${reason.reason}>`
        }
        return `non-TsSqlError: ${String(e)}`
    }
    return '<no throw>'
}

// Same shape, reporting the structured `value` an INVALID_FILTER reason carries
// — the specific offending value received for the column, matching the message's
// "Received value", not the enclosing filter object.
function valueOf(build: () => unknown): unknown {
    try {
        build()
    } catch (e) {
        if (e instanceof TsSqlError) {
            const reason = e.errorReason
            return 'value' in reason ? reason.value : `<no value on ${reason.reason}>`
        }
        return `non-TsSqlError: ${String(e)}`
    }
    return '<no throw>'
}

// Same shape, reporting the structured `name` an UNKNOWN_OPERATION reason
// carries — the offending operation key, raised both for an unrecognised
// operator on a value-source column and for any operator on an aggregated-array
// value source.
function nameOf(build: () => unknown): unknown {
    try {
        build()
    } catch (e) {
        if (e instanceof TsSqlError) {
            const reason = e.errorReason
            return 'name' in reason ? reason.name : `<no name on ${reason.reason}>`
        }
        return `non-TsSqlError: ${String(e)}`
    }
    return '<no throw>'
}

// A depth-3 nested projection: `project` and `project.assignee` are plain
// objects (non-value-sources), so a filter descending into them forces the
// builder to recurse twice and accumulate a dotted path prefix. The tables are
// never joined — the error is thrown while `withValues(...)` walks the filter,
// before any SQL is built.
const nestedFields = {
    id: tIssue.id,
    project: {
        id: tProject.id,
        assignee: {
            id: tAppUser.id,
        },
    },
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

    test('errors/column-value-not-object-path-depth-1', () => {
        // The offending column's own path is reported (the bare column key at
        // the top level), matching the column named in the thrown message — not
        // the empty enclosing scope.
        const path = pathOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues({ id: 5 } as any))
        expect(path).toBe('id')
    })

    test('errors/nested-column-value-not-object-path-depth-2', () => {
        // One level down, the dotted path runs to the offending column
        // (`project.id`), not the enclosing `project` scope.
        const path = pathOf(() =>
            ctx.conn.dynamicConditionFor(nestedFields).withValues({ project: { id: 5 } } as any))
        expect(path).toBe('project.id')
    })

    test('errors/column-value-not-object-value', () => {
        // The structured `value` is the specific non-object value received for
        // the column (matching the message's "Received value"), not the
        // enclosing filter object.
        const value = valueOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues({ id: 5 } as any))
        expect(value).toBe(5)
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
        // `|| valueSourcePrivate.__aggregatedArrayColumns`).
        const aggFields = {
            id:     tIssue.id,
            titles: ctx.conn.aggregateAsArrayOfOneColumn(tIssue.title),
        }
        const reason = reasonOf(() =>
            ctx.conn.dynamicConditionFor(aggFields).withValues({ titles: { equals: 'x' } } as any))
        expect(reason).toBe('DYNAMIC_CONDITION_UNKNOWN_OPERATION')
    })

    test('errors/nested-unknown-column-path-depth-2', () => {
        // An unknown column one level down reports its full dotted path — the
        // parent key joined to the column key with a dot, not run together.
        const path = pathOf(() =>
            ctx.conn.dynamicConditionFor(nestedFields).withValues({ project: { nope: { equals: 1 } } } as any))
        expect(path).toBe('project.nope')
    })

    test('errors/nested-unknown-column-path-depth-3', () => {
        // Two levels down every hop is joined by a single dot, with no stray
        // separator between the nested keys and the column.
        const path = pathOf(() =>
            ctx.conn.dynamicConditionFor(nestedFields).withValues({ project: { assignee: { nope: { equals: 1 } } } } as any))
        expect(path).toBe('project.assignee.nope')
    })

    test('errors/nested-unknown-operation-path-depth-3', () => {
        // An unknown operation on a value-source column deep in the projection
        // carries the same dotted path down to that column.
        const path = pathOf(() =>
            ctx.conn.dynamicConditionFor(nestedFields).withValues({ project: { assignee: { id: { bogusOp: 1 } } } } as any))
        expect(path).toBe('project.assignee.id')
    })

    test('errors/column-date-value-and-path-depth-1', () => {
        // A Date is `typeof 'object'` but rejected by the `instanceof Date`
        // arm, so it trips the column-level INVALID_FILTER guard: the
        // structured `value` is the SAME Date received for the column, and the
        // `path` is the bare column key.
        const d = new Date('2020-01-01T00:00:00.000Z')
        expect(valueOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues({ id: d } as any))).toBe(d)
        expect(pathOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues({ id: d } as any))).toBe('id')
    })

    test('errors/nested-column-date-value-and-path-depth-2', () => {
        // The same Date one level down: the column guard fires on `project.id`,
        // carrying the Date as `value` and the dotted trail as `path`.
        const d = new Date('2020-01-01T00:00:00.000Z')
        expect(valueOf(() =>
            ctx.conn.dynamicConditionFor(nestedFields).withValues({ project: { id: d } } as any))).toBe(d)
        expect(pathOf(() =>
            ctx.conn.dynamicConditionFor(nestedFields).withValues({ project: { id: d } } as any))).toBe('project.id')
    })

    test('errors/and-not-array-value', () => {
        // `and` given a non-array carries the WHOLE enclosing filter object as
        // the structured `value`, not the bare `'x'`.
        const value = valueOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues({ and: 'x' } as any))
        expect(value).toEqual({ and: 'x' })
    })

    test('errors/and-not-array-path', () => {
        // At the top level the enclosing scope is empty, so the path is ``.
        const path = pathOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues({ and: 'x' } as any))
        expect(path).toBe('')
    })

    test('errors/or-not-array-value', () => {
        // `or` given a non-array carries the WHOLE enclosing filter object as
        // the structured `value`, mirroring the `and` branch.
        const value = valueOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues({ or: 'x' } as any))
        expect(value).toEqual({ or: 'x' })
    })

    test('errors/or-not-array-path', () => {
        // Same as `and`: the top-level enclosing scope is empty.
        const path = pathOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues({ or: 'x' } as any))
        expect(path).toBe('')
    })

    test('errors/non-object-filter-value-and-path', () => {
        // A top-level non-object filter carries that value verbatim as `value`,
        // with an empty `path`.
        expect(valueOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues('not-an-object' as any))).toBe('not-an-object')
        expect(pathOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues('not-an-object' as any))).toBe('')
    })

    test('errors/date-as-filter-value-and-path', () => {
        // A top-level Date is caught by the same guard: `value` is the Date
        // itself and `path` is empty.
        const d = new Date('2020-01-01T00:00:00.000Z')
        expect(valueOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues(d as any))).toBe(d)
        expect(pathOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues(d as any))).toBe('')
    })

    test('errors/unknown-operation-name', () => {
        // The UNKNOWN_OPERATION reason carries the offending operation key as
        // the structured `name`.
        const name = nameOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues({ id: { bogusOp: 1 } } as any))
        expect(name).toBe('bogusOp')
    })

    test('errors/aggregated-array-operation-name', () => {
        // An aggregated-array value source rejects any operator through the
        // same guard; the rejected operator key surfaces as `name`.
        const aggFields = {
            id:     tIssue.id,
            titles: ctx.conn.aggregateAsArrayOfOneColumn(tIssue.title),
        }
        const name = nameOf(() =>
            ctx.conn.dynamicConditionFor(aggFields).withValues({ titles: { equals: 'x' } } as any))
        expect(name).toBe('equals')
    })

    test('errors/operation-name-carried-at-both-throw-conditions', () => {
        // The UNKNOWN_OPERATION reason is raised at a SINGLE site guarding two
        // conditions: an unrecognised operator on a value-source column, and
        // ANY operator on an aggregated-array value source. In both, the `name`
        // field carries the offending operator key.
        const aggFields = {
            id:     tIssue.id,
            titles: ctx.conn.aggregateAsArrayOfOneColumn(tIssue.title),
        }
        expect(nameOf(() =>
            ctx.conn.dynamicConditionFor(selectFields).withValues({ id: { bogusOp: 1 } } as any))).toBe('bogusOp')
        expect(nameOf(() =>
            ctx.conn.dynamicConditionFor(aggFields).withValues({ titles: { bogusOp: 1 } } as any))).toBe('bogusOp')
    })
})
