// Compile-time negative tests for `connection.isolationLevel(...)` on the
// Oracle dialect. These never execute any SQL — the value of the test is that
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
    // Positive control: the levels Oracle offers, and an access mode alone.
    connection.isolationLevel('read committed')
    connection.isolationLevel('snapshot')
    connection.isolationLevel('read only')

    // Rule: Oracle rejects the words READ UNCOMMITTED, so the level is not offered.
    // @ts-expect-error read uncommitted is not offered on Oracle
    connection.isolationLevel('read uncommitted')

    // Rule: Oracle rejects the words REPEATABLE READ, so the level is not offered.
    // @ts-expect-error repeatable read is not offered on Oracle
    connection.isolationLevel('repeatable read')

    // Rule: Oracle's SERIALIZABLE is a snapshot (the level is `snapshot` here)
    // and Oracle has nothing stronger, so `serializable` is not offered.
    // @ts-expect-error serializable is not offered on Oracle: its SERIALIZABLE is snapshot
    connection.isolationLevel('serializable')

    // Rule: Oracle takes an isolation level OR an access mode, not both.
    // @ts-expect-error no level + access mode overload on Oracle
    connection.isolationLevel('snapshot', 'read only')
}

test('oracle-negative-types-transaction', () => {
    expect(typeof _typeNegatives).toBe('function')
})
