// Compile-time negative tests for DELETE-shaped APIs on the mysql
// dialect. See `select.test.ts` for the conventions.

import { test, expect } from '../../../lib/testRunner.js'
import type { DBConnection } from '../domain/connection.js'
import { tIssue, tProject, tOrganization, vProjectOverview } from '../domain/connection.js'

// `connection` is type-only — the function below is checked by tsc but
// never invoked at runtime, so we don't need a real instance and don't
// open any driver-level resource just to make the file load.
declare const connection: DBConnection

function _typeNegatives() {
    // Rule: where condition must be a boolean value source built from
    // the same table — passing an int does not compile.
    // @ts-expect-error number is not a boolean value source
    void connection.deleteFrom(tIssue).where(123)

    // Rule: deleteFrom requires a table reference; passing a number does
    // not compile.
    // @ts-expect-error 1 is not a table reference
    void connection.deleteFrom(1)

    // Rule: where(...) must take a BooleanValueSource. An int column
    // reference from the same table is not boolean.
    // @ts-expect-error int column is not a boolean value source
    void connection.deleteFrom(tIssue).where(tIssue.priority)

    // Rule: equalsIfValue keeps the column's underlying type — passing a
    // string where int is expected is rejected.
    // @ts-expect-error string passed where number | null | undefined expected
    void connection.deleteFrom(tIssue).where(tIssue.priority.equalsIfValue('high'))

    // Rule: MySQL does not support `DELETE ... RETURNING`. The
    // `.returning({...})` method is not typed on the mysql dialect; it
    // resolves to `never` and the call must not typecheck.
    // @ts-expect-error returning() is not typed on the mysql dialect (DELETE ... RETURNING unsupported)
    void connection.deleteFrom(tProject).where(tProject.id.equals(1)).returning({
        id: tProject.id,
    })

    // Note: DELETE … USING IS supported on mysql — no negative test
    // for `.using(...)` here; the compile-time negative lives in the
    // `types.negative` suite of the dialects that exclude it.
    // Rule: `executeDeleteNoneOrOne` / `executeDeleteOne` / `executeDeleteMany`
    // are RETURNING executors — they resolve the projected row(s), so they live on
    // the interface reached through `returning(...)` / `returningOneColumn(...)`. A
    // bare delete (no RETURNING) exposes only the count-only `executeDelete(min?, max?)`;
    // reaching any of the row-returning variants without a returning clause does not
    // compile.
    // @ts-expect-error executeDeleteNoneOrOne needs a RETURNING clause; it is not on a bare delete
    void connection.deleteFrom(tIssue).where(tIssue.id.equals(1)).executeDeleteNoneOrOne()
    // @ts-expect-error executeDeleteOne needs a RETURNING clause; it is not on a bare delete
    void connection.deleteFrom(tIssue).where(tIssue.id.equals(1)).executeDeleteOne()
    // @ts-expect-error executeDeleteMany needs a RETURNING clause; it is not on a bare delete
    void connection.deleteFrom(tIssue).where(tIssue.id.equals(1)).executeDeleteMany()

    // Positive control: the count-only `executeDelete()` IS on a bare delete and
    // must keep compiling — proving the guard above is scoped to the row executors.
    void connection.deleteFrom(tIssue).where(tIssue.id.equals(1)).executeDelete()

    // Rule: the target of deleteFrom must be a table; a view is rejected.
    void connection.deleteFrom(tProject)
    // @ts-expect-error a view is not a table, so it cannot be the target of deleteFrom
    void connection.deleteFrom(vProjectOverview)

    // Rule: deleteFrom(...) protects against a missing where: it is not executable until
    // where(...) is given; deleteAllowingNoWhereFrom(...) lifts that.
    void connection.deleteAllowingNoWhereFrom(tIssue).executeDelete()
    // @ts-expect-error deleteFrom(...) without where exposes no executeDelete
    void connection.deleteFrom(tIssue).executeDelete()

    // Rule: where(...) is given once; more conditions are added with and(...) / or(...).
    void connection.deleteFrom(tIssue).where(tIssue.id.equals(1)).and(tIssue.priority.equals(2))
    // @ts-expect-error a second where is not offered; use and(...)
    void connection.deleteFrom(tIssue).where(tIssue.id.equals(1)).where(tIssue.priority.equals(2))

    // Rule: where(...) reads only the tables of the delete; a table becomes readable once
    // added with using(...).
    void connection.deleteFrom(tIssue).using(tProject).where(tProject.id.equals(tIssue.projectId))
    // @ts-expect-error tProject is not part of the delete, so where cannot read it
    void connection.deleteFrom(tIssue).where(tProject.id.equals(1))
    // Rule: valuesForInsert() columns are not readable in a delete.
    // @ts-expect-error valuesForInsert() columns are not readable in the where of a delete
    void connection.deleteFrom(tIssue).where(tIssue.valuesForInsert().id.equals(1))

    // Rule: the on(...) condition of a join reads only the tables already in the delete.
    void connection.deleteFrom(tIssue).join(tProject).on(tProject.id.equals(tIssue.projectId)).where(tProject.archivedAt.isNotNull())
    // @ts-expect-error tOrganization is not part of the delete, so the on condition cannot read it
    void connection.deleteFrom(tIssue).join(tProject).on(tOrganization.id.equals(tProject.organizationId))
}

test('delete-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
