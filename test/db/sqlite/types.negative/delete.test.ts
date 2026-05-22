// Compile-time negative tests for DELETE-shaped APIs on the sqlite
// dialect. See `select.test.ts` for the conventions.

import { test, expect } from '../../../lib/testRunner.js'
import type { DBConnection } from '../domain/connection.js'
import { tIssue, tProject } from '../domain/connection.js'

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
    // string where int is expected is rejected (the value side is
    // widened to allow null/undefined, not to allow type widening).
    // @ts-expect-error string passed where number | null | undefined expected
    void connection.deleteFrom(tIssue).where(tIssue.priority.equalsIfValue('high'))

    // Rule: the columns map passed to returning({...}) cannot reference
    // properties that don't exist on the table.
    void connection.deleteFrom(tProject).where(tProject.id.equals(1)).returning({
        id:   tProject.id,
        // @ts-expect-error 'nonExistent' is not a column of tProject
        bad:  tProject.nonExistent,
    })

    // Rule: sqlite does NOT support DELETE … USING (covered explicitly
    // in test/db/sqlite/.../delete.using.test.ts). Calling using() on a
    // sqlite connection must not typecheck.
    // @ts-expect-error sqlite has no DELETE … USING — using() is excluded
    void connection.deleteFrom(tIssue).using(tProject)
}

test('delete-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
