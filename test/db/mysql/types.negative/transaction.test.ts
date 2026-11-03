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
import { PostgreSqlConnection } from '../../../../src/connections/PostgreSqlConnection.js'
import { MySqlConnection } from '../../../../src/connections/MySqlConnection.js'

// The body of `_typeNegatives` is checked by tsc but never executed at
// runtime.
declare const connection: DBConnection
class SameDatabaseConnection extends MySqlConnection<'SameDatabaseConnection'> {}
class ForeignConnection extends PostgreSqlConnection<'ForeignConnection'> {}
declare const foreign: ForeignConnection
declare const sameDatabase: SameDatabaseConnection

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

    // Rule: an access mode goes alone or after a level, never as the level.
    // @ts-expect-error an access mode cannot take the place of the level
    connection.isolationLevel('read only', 'read write')

    // Rule: a connection only accepts the isolation levels it built itself; a level
    // built by another connection of MySQL is refused too.
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

test('mysql-negative-types-transaction', () => {
    expect(typeof _typeNegatives).toBe('function')
})
