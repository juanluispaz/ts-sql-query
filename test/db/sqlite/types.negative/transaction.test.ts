// Compile-time negative tests for `connection.isolationLevel(...)` on the
// SQLite dialect. These never execute any SQL — the value of the test is that
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

// The body of `_typeNegatives` is checked by tsc but never executed at
// runtime.
declare const connection: DBConnection
class ForeignConnection extends PostgreSqlConnection<'ForeignConnection'> {}
declare const foreign: ForeignConnection

function _typeNegatives() {
    // Positive control: a transaction without isolation level.
    void connection.transaction(async () => 1)

    // Rule: SQLite doesn't let you choose the isolation level (its transactions
    // are always serializable), so SqliteConnection has no isolationLevel.
    // @ts-expect-error isolationLevel does not exist on SqliteConnection
    connection.isolationLevel('serializable')

    // Positive control: beginning a transaction without isolation level.
    void connection.beginTransaction()

    // Rule: SQLite has no isolation level to choose, so a transaction takes no
    // plain string in its place either.
    // @ts-expect-error a plain string is not an isolation level
    void connection.transaction(async () => 1, 'serializable')

    // Rule: SQLite has no isolation level to choose, so a transaction takes no
    // plain string in its place either.
    // @ts-expect-error a plain string is not an isolation level
    void connection.beginTransaction('serializable')

    // Rule: a connection only accepts the isolation levels it built itself;
    // a level built by a PostgreSQL connection is refused.
    // @ts-expect-error the isolation level was built by a PostgreSQL connection
    void connection.transaction(async () => 1, foreign.isolationLevel('read committed'))
    // @ts-expect-error the isolation level was built by a PostgreSQL connection
    void connection.beginTransaction(foreign.isolationLevel('read committed'))
}

test('sqlite-negative-types-transaction', () => {
    expect(typeof _typeNegatives).toBe('function')
})
