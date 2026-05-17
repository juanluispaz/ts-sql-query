// Compile-time negative tests for INSERT-shaped APIs on the mysql dialect.
// See `select.test.ts` for the rationale and conventions.

import { test, expect } from '../../../lib/testRunner.js'
import { MockQueryRunner } from '../../../../src/queryRunners/MockQueryRunner.js'
import { DBConnection, tIssue } from '../domain/connection.js'

const connection = new DBConnection(new MockQueryRunner(() => undefined, 'mySql'))

function _typeNegatives() {
    // Rule: optional columns (here `body`) on an INSERT can be omitted, but
    // required columns must be present. The `status` field below is
    // required and missing, which must not compile.
    // @ts-expect-error required column `status` is missing from the INSERT
    void connection.insertInto(tIssue).values({
        projectId: 1,
        number:    1,
        title:     'x',
        priority:  1,
    })
}

test('insert-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
