// Compile-time negative tests for `connection.isolationLevel(...)` on the
// SQL Server dialect. These never execute any SQL — the value of the test is that
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
    // Positive control: SQL Server offers every level.
    connection.isolationLevel('read uncommitted')
    connection.isolationLevel('read committed')
    connection.isolationLevel('repeatable read')
    connection.isolationLevel('snapshot')
    connection.isolationLevel('serializable')

    // Rule: SQL Server's isolationLevel takes only a level, no access mode.
    // @ts-expect-error no access mode on SQL Server
    connection.isolationLevel('read only')

    // Rule: SQL Server's isolationLevel takes only a level, no access mode.
    // @ts-expect-error no level + access mode overload on SQL Server
    connection.isolationLevel('snapshot', 'read only')
}

test('sqlserver-negative-types-transaction', () => {
    expect(typeof _typeNegatives).toBe('function')
})
