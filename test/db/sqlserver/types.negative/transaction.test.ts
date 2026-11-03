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
import { PostgreSqlConnection } from '../../../../src/connections/PostgreSqlConnection.js'
import { SqlServerConnection } from '../../../../src/connections/SqlServerConnection.js'

// The body of `_typeNegatives` is checked by tsc but never executed at
// runtime.
declare const connection: DBConnection
class SameDatabaseConnection extends SqlServerConnection<'SameDatabaseConnection'> {}
class ForeignConnection extends PostgreSqlConnection<'ForeignConnection'> {}
declare const foreign: ForeignConnection
declare const sameDatabase: SameDatabaseConnection

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

    // Positive control: a transaction with a level built by isolationLevel(...).
    void connection.transaction(async () => 1, connection.isolationLevel('serializable'))
    void connection.beginTransaction(connection.isolationLevel('serializable'))

    // Rule: a transaction's isolation level is the value isolationLevel(...)
    // builds, never a plain string.
    // @ts-expect-error a plain string is not an isolation level
    void connection.transaction(async () => 1, 'serializable')

    // Rule: a transaction's isolation level is the value isolationLevel(...)
    // builds, never a plain string.
    // @ts-expect-error a plain string is not an isolation level
    void connection.beginTransaction('serializable')

    // Rule: SQL Server's isolationLevel takes only a level, no access mode.
    // @ts-expect-error no access mode on SQL Server
    connection.isolationLevel('read write')

    // Rule: a connection only accepts the isolation levels it built itself; a level
    // built by another connection of SQL Server is refused too.
    // @ts-expect-error the isolation level was built by another connection
    void connection.transaction(async () => 1, sameDatabase.isolationLevel('serializable'))
    // @ts-expect-error the isolation level was built by another connection
    void connection.beginTransaction(sameDatabase.isolationLevel('serializable'))

    // Rule: a connection only accepts the isolation levels it built itself;
    // a level built by a PostgreSQL connection is refused.
    // @ts-expect-error the isolation level was built by a PostgreSQL connection
    void connection.transaction(async () => 1, foreign.isolationLevel('read committed'))
    // @ts-expect-error the isolation level was built by a PostgreSQL connection
    void connection.beginTransaction(foreign.isolationLevel('read committed'))
}

test('sqlserver-negative-types-transaction', () => {
    expect(typeof _typeNegatives).toBe('function')
})
