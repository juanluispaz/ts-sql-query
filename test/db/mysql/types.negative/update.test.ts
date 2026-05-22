// Compile-time negative tests for UPDATE-shaped APIs on the mysql
// dialect. See `select.test.ts` for the conventions.

import { test, expect } from '../../../lib/testRunner.js'
import type { DBConnection } from '../domain/connection.js'
import { tIssue, tProject } from '../domain/connection.js'

// `connection` is type-only — the function below is checked by tsc but
// never invoked at runtime, so we don't need a real instance and don't
// open any driver-level resource just to make the file load.
declare const connection: DBConnection

function _typeNegatives() {
    // Rule: the value passed to set() must match the column's type.
    // tIssue.priority is int; passing a string is rejected.
    // @ts-expect-error priority is int, not string
    void connection.update(tIssue).set({ priority: 'high' })

    // Rule: cannot set a column that doesn't exist.
    // @ts-expect-error 'nonExistent' is not a column of tIssue
    void connection.update(tIssue).set({ nonExistent: 1 })

    // Rule: setIfValue() carries the same column-type constraint as set()
    // — only the value is widened to allow null/undefined to skip the
    // assignment.
    // @ts-expect-error priority is int, not string (setIfValue keeps the type)
    void connection.update(tIssue).setIfValue({ priority: 'high' })

    // Rule: the where clause must take a boolean value source — passing a
    // plain string is rejected.
    // @ts-expect-error string is not a boolean value source
    void connection.update(tIssue).set({ title: 'x' }).where('not-a-condition')

    // Rule: where(...) must take a BooleanValueSource. A non-boolean
    // value source (e.g. an int column reference) is rejected.
    // @ts-expect-error int column is not a boolean value source
    void connection.update(tIssue).set({ title: 'x' }).where(tIssue.priority)

    // Rule: equalsIfValue keeps the column's underlying type — passing a
    // string where int is expected is rejected.
    // @ts-expect-error string passed where number | null | undefined expected
    void connection.update(tIssue).set({ title: 'x' }).where(tIssue.priority.equalsIfValue('high'))

    // Rule: MySQL does not support `UPDATE ... RETURNING`. The
    // `.returning({...})` method is typed only on postgres, sqlite,
    // mariadb, oracle, sqlserver, and the noop dialect; on the mysql
    // dialect it resolves to `never` and the call must not typecheck.
    // @ts-expect-error returning() is not typed on the mysql dialect (UPDATE ... RETURNING unsupported)
    void connection.update(tProject).set({ name: 'x' }).where(tProject.id.equals(1)).returning({
        id: tProject.id,
    })

    // Rule: `tTable.oldValues()` is typed only on PostgreSqlConnection,
    // MariaDBConnection, SqlServerConnection (and the noop dialect).
    // MySQL tables don't expose it — calling .oldValues() must not
    // typecheck. (Documented in test/LIMITATIONS.md / docs/queries/update.md.)
    // @ts-expect-error oldValues() is not typed on the mysql dialect
    void tProject.oldValues()
}

test('update-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
