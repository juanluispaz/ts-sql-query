// Compile-time negative tests for UPDATE-shaped APIs on the sqlite
// dialect. See `select.test.ts` for the conventions.

import { test, expect } from '../../../lib/testRunner.js'
import { MockQueryRunner } from '../../../../src/queryRunners/MockQueryRunner.js'
import { DBConnection, tIssue, tProject } from '../domain/connection.js'

const connection = new DBConnection(new MockQueryRunner(() => undefined, 'sqlite'))

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
    // string where int is expected is rejected (the value side is widened
    // to allow null/undefined, not to allow type widening).
    // @ts-expect-error string passed where number | null | undefined expected
    void connection.update(tIssue).set({ title: 'x' }).where(tIssue.priority.equalsIfValue('high'))

    // Rule: the columns map passed to returning({...}) cannot reference
    // properties that don't exist on the table.
    void connection.update(tProject).set({ name: 'x' }).where(tProject.id.equals(1)).returning({
        id:   tProject.id,
        // @ts-expect-error 'nonExistent' is not a column of tProject
        bad:  tProject.nonExistent,
    })

    // Rule: `tTable.oldValues()` is typed only on PostgreSqlConnection,
    // MariaDBConnection, SqlServerConnection (and the noop dialect).
    // SQLite tables don't expose it — calling .oldValues() must not
    // typecheck. (Documented in test/LIMITATIONS.md / docs/queries/update.md.)
    // @ts-expect-error oldValues() is not typed on the sqlite dialect
    void tProject.oldValues()

    // Rule: SQLite rejects DEFAULT as a value expression in INSERT VALUES /
    // UPDATE SET / ON CONFLICT DO UPDATE SET. SqliteConnection does NOT
    // expose `default()`, so referencing it from UPDATE set must not
    // compile. Omit the column instead.
    void connection.update(tProject).set({
        // @ts-expect-error SQLite does not expose connection.default() — omit the column instead
        createdAt: connection.default(),
    })
}

test('update-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
