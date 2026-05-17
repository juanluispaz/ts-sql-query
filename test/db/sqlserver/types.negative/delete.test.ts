// Compile-time negative tests for DELETE-shaped APIs on the sqlite
// dialect. See `select.test.ts` for the conventions.

import { test, expect } from '../../../lib/testRunner.js'
import { MockQueryRunner } from '../../../../src/queryRunners/MockQueryRunner.js'
import { DBConnection, tIssue } from '../domain/connection.js'

const connection = new DBConnection(new MockQueryRunner(() => undefined, 'sqlServer'))

function _typeNegatives() {
    // Rule: where condition must be a boolean value source built from
    // the same table — passing an int does not compile.
    // @ts-expect-error number is not a boolean value source
    void connection.deleteFrom(tIssue).where(123)

    // Rule: deleteFrom requires a table reference; passing a number does
    // not compile.
    // @ts-expect-error 1 is not a table reference
    void connection.deleteFrom(1)

    // (DELETE … USING is supported on sqlserver — no negative test here.)
}

test('delete-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
