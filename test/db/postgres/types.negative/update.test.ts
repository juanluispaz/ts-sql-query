// Compile-time negative tests for UPDATE-shaped APIs on the postgres
// dialect. See `select.test.ts` for the conventions.

import { test, expect } from '../../../lib/testRunner.js'
import type { DBConnection } from '../domain/connection.js'
import { tIssue, tProject } from '../domain/connection.js'

// `connection` is type-only — the function below is checked by tsc but
// never invoked at runtime, so we don't need a real instance and don't
// open any driver-level resource just to make the file load.
declare const connection: DBConnection

function _typeNegatives() {
    // Rule: the value passed to set() must match the column's type.
    // tIssue.priority is int; passing a string is rejected.
    // @ts-expect-error priority is int, not string
    void connection.update(tIssue).set({ priority: 'high' })

    // Rule: cannot set a column that doesn't exist.
    // @ts-expect-error 'nonExistent' is not a column of tIssue
    void connection.update(tIssue).set({ nonExistent: 1 })

    // Rule: setIfValue() carries the same column-type constraint as set()
    // — only the value is widened to allow null/undefined to skip the
    // assignment.
    // @ts-expect-error priority is int, not string (setIfValue keeps the type)
    void connection.update(tIssue).setIfValue({ priority: 'high' })

    // Rule: the where clause must take a boolean value source — passing a
    // plain string is rejected.
    // @ts-expect-error string is not a boolean value source
    void connection.update(tIssue).set({ title: 'x' }).where('not-a-condition')

    // Rule: where(...) must take a BooleanValueSource. A non-boolean
    // value source (e.g. an int column reference) is rejected.
    // @ts-expect-error int column is not a boolean value source
    void connection.update(tIssue).set({ title: 'x' }).where(tIssue.priority)

    // Rule: equalsIfValue keeps the column's underlying type — passing a
    // string where int is expected is rejected (the value side is widened
    // to allow null/undefined, not to allow type widening).
    // @ts-expect-error string passed where number | null | undefined expected
    void connection.update(tIssue).set({ title: 'x' }).where(tIssue.priority.equalsIfValue('high'))

    // Rule: the columns map passed to returning({...}) cannot reference
    // properties that don't exist on the table.
    void connection.update(tProject).set({ name: 'x' }).where(tProject.id.equals(1)).returning({
        id:   tProject.id,
        // @ts-expect-error 'nonExistent' is not a column of tProject
        bad:  tProject.nonExistent,
    })

    // Note: `tTable.oldValues()` IS typed on PostgreSqlConnection (the
    // current dialect); the compile-time negative lives in the
    // `types.negative` suite of the dialects that don't expose it.

    // Rule: `executeUpdateNoneOrOne` / `executeUpdateOne` / `executeUpdateMany`
    // are RETURNING executors — they resolve the projected row(s), so they
    // live on the interface reached through `returning(...)` /
    // `returningOneColumn(...)`. A bare update (no RETURNING) exposes only the
    // count-only `executeUpdate(min?, max?)`; reaching any of the row-returning
    // variants without a returning clause does not compile. The runtime +
    // typed positive coverage (including the empty-set short-circuit) lives in
    // this dialect's execute-variants coverage.
    // @ts-expect-error executeUpdateNoneOrOne needs a RETURNING clause; it is not on a bare update
    void connection.update(tIssue).dynamicSet().where(tIssue.id.equals(1)).executeUpdateNoneOrOne()
    // @ts-expect-error executeUpdateOne needs a RETURNING clause; it is not on a bare update
    void connection.update(tIssue).dynamicSet().where(tIssue.id.equals(1)).executeUpdateOne()
    // @ts-expect-error executeUpdateMany needs a RETURNING clause; it is not on a bare update
    void connection.update(tIssue).dynamicSet().where(tIssue.id.equals(1)).executeUpdateMany()
}

test('update-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
