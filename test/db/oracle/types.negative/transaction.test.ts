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
import { PostgreSqlConnection } from '../../../../src/connections/PostgreSqlConnection.js'
import { OracleConnection } from '../../../../src/connections/OracleConnection.js'

// The body of `_typeNegatives` is checked by tsc but never executed at
// runtime.
declare const connection: DBConnection
class SameDatabaseConnection extends OracleConnection<'SameDatabaseConnection'> {}
class ForeignConnection extends PostgreSqlConnection<'ForeignConnection'> {}
declare const foreign: ForeignConnection
declare const sameDatabase: SameDatabaseConnection

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

    // Positive control: a transaction with a level built by isolationLevel(...).
    void connection.transaction(async () => 1, connection.isolationLevel('snapshot'))
    void connection.beginTransaction(connection.isolationLevel('snapshot'))

    // Rule: a transaction's isolation level is the value isolationLevel(...)
    // builds, never a plain string.
    // @ts-expect-error a plain string is not an isolation level
    void connection.transaction(async () => 1, 'serializable')

    // Rule: a transaction's isolation level is the value isolationLevel(...)
    // builds, never a plain string.
    // @ts-expect-error a plain string is not an isolation level
    void connection.beginTransaction('serializable')

    // Rule: a connection only accepts the isolation levels it built itself; a level
    // built by another connection of Oracle is refused too.
    // @ts-expect-error the isolation level was built by another connection
    void connection.transaction(async () => 1, sameDatabase.isolationLevel('read committed'))
    // @ts-expect-error the isolation level was built by another connection
    void connection.beginTransaction(sameDatabase.isolationLevel('read committed'))

    // Rule: a connection only accepts the isolation levels it built itself;
    // a level built by a PostgreSQL connection is refused.
    // @ts-expect-error the isolation level was built by a PostgreSQL connection
    void connection.transaction(async () => 1, foreign.isolationLevel('read committed'))
    // @ts-expect-error the isolation level was built by a PostgreSQL connection
    void connection.beginTransaction(foreign.isolationLevel('read committed'))
}

test('oracle-negative-types-transaction', () => {
    expect(typeof _typeNegatives).toBe('function')
})
