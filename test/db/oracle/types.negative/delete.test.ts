// Compile-time negative tests for DELETE-shaped APIs on the oracle
// dialect. See `select.test.ts` for the conventions.

import { test, expect } from '../../../lib/testRunner.js'
import { MockQueryRunner } from '../../../../src/queryRunners/MockQueryRunner.js'
import { DBConnection, tIssue, tProject } from '../domain/connection.js'

const connection = new DBConnection(new MockQueryRunner(() => undefined, 'oracle'))

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

    // Rule: the columns map passed to returning({...}) cannot reference
    // properties that don't exist on the table.
    void connection.deleteFrom(tProject).where(tProject.id.equals(1)).returning({
        id:   tProject.id,
        // @ts-expect-error 'nonExistent' is not a column of tProject
        bad:  tProject.nonExistent,
    })

    // Note: DELETE … USING IS supported on oracle — no negative test
    // for `.using(...)` here; see test/db/sqlite/types.negative/delete.test.ts
    // for the compile-time negative on the dialect that excludes it.
}

test('delete-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
