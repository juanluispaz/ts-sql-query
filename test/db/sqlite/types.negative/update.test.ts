// Compile-time negative tests for UPDATE-shaped APIs on the sqlite
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

    // Rule: under an active shape, the conditional `*When` set arms accept
    // only the renamed shape keys — never the real columns (same contract as
    // the non-`When` shaped set). The real column `name` is rejected by both
    // the value-map arm (`setWhen`) and the column-name arm (`keepOnlyWhen`).
    void connection.update(tProject)
        .shapedAs({ projectName: 'name' })
        .dynamicSet()
        // @ts-expect-error real column 'name' is not a shaped key on setWhen
        .setWhen(true, { name: 'x' })
    void connection.update(tProject)
        .shapedAs({ projectName: 'name', projectSlug: 'slug' })
        .set({ projectName: 'x' })
        // @ts-expect-error real column 'name' is not a shaped key on keepOnlyWhen
        .keepOnlyWhen(true, 'name')

    // Rule: under an active shape, the `disallow*` guards accept only the
    // renamed shape keys — never the real columns (same contract as the shaped
    // set / `ignore*` / `keepOnly` family, since `__sets` is keyed by the
    // renamed key). The real column is rejected by the positive-match guards
    // (`disallowIfSet`), by `disallowAnyOtherSet`, and by the conditional
    // `*When` arms.
    void connection.update(tProject)
        .shapedAs({ projectName: 'name', projectSlug: 'slug' })
        .set({ projectName: 'x' })
        // @ts-expect-error real column 'slug' is not a shaped key on disallowIfSet
        .disallowIfSet('slug is read-only', 'slug')
    void connection.update(tProject)
        .shapedAs({ projectName: 'name', projectSlug: 'slug' })
        .set({ projectName: 'x' })
        // @ts-expect-error real column 'name' is not a shaped key on disallowAnyOtherSet
        .disallowAnyOtherSet('only name', 'name')
    void connection.update(tProject)
        .shapedAs({ projectName: 'name', projectSlug: 'slug' })
        .set({ projectName: 'x' })
        // @ts-expect-error real column 'slug' is not a shaped key on disallowIfSetWhen
        .disallowIfSetWhen(true, 'slug is read-only', 'slug')

}

test('update-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
