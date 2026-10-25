// Compile-time negative tests for `connection.isolationLevel(...)` on the
// MySQL dialect. These never execute any SQL — the value of the test is that
// `validate:tests` (tsc) rejects each `@ts-expect-error` line. If the library
// stops rejecting one of these, the directive becomes "unused" and the build
// fails with `TS2578` — exactly the regression signal we want.
//
// ts-sql-query names the isolation levels with the SQL standard's words plus
// `snapshot`, and offers on each database only the levels it delivers
// (docs/queries/transaction.md, "Transaction isolation").
//
// Every `@ts-expect-error` MUST be accompanied by a comment naming the rule it
// enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import type { DBConnection } from '../domain/connection.js'

// The body of `_typeNegatives` is checked by tsc but never executed at
// runtime.
declare const connection: DBConnection

function _typeNegatives() {
    // Positive control: the levels MySQL offers, alone and with an access mode.
    connection.isolationLevel('read uncommitted')
    connection.isolationLevel('read committed')
    connection.isolationLevel('snapshot', 'read only')
    connection.isolationLevel('serializable', 'read write')

    // Rule: this database's REPEATABLE READ is a snapshot, more than the
    // standard's repeatable read promises, so the level is `snapshot` here.
    // @ts-expect-error repeatable read is not offered: use snapshot
    connection.isolationLevel('repeatable read')
}

test('mysql-negative-types-transaction', () => {
    expect(typeof _typeNegatives).toBe('function')
})
