// Compile-time negative tests for UPDATE-shaped APIs on the sqlite
// dialect. See `select.test.ts` for the conventions.

import { test, expect } from '../../../lib/testRunner.js'
import { MockQueryRunner } from '../../../../src/queryRunners/MockQueryRunner.js'
import { DBConnection, tIssue } from '../domain/connection.js'

const connection = new DBConnection(new MockQueryRunner(() => undefined, 'sqlServer'))

function _typeNegatives() {
    // Rule: the value passed to set() must match the column's type.
    // tIssue.priority is int; passing a string is rejected.
    // @ts-expect-error priority is int, not string
    void connection.update(tIssue).set({ priority: 'high' })

    // Rule: cannot set a column that doesn't exist.
    // @ts-expect-error 'nonExistent' is not a column of tIssue
    void connection.update(tIssue).set({ nonExistent: 1 })

    // Rule: the where clause must take an IfValueSource — passing a plain
    // number or string is rejected.
    // @ts-expect-error string is not a boolean value source
    void connection.update(tIssue).set({ title: 'x' }).where('not-a-condition')

    // Rule: update without a where clause requires explicit
    // `.executeUpdateNoReturning()` opt-out … wait, not implemented as a
    // negative — covered at runtime only. Skip.
}

test('update-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
