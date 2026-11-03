// Compile-time negative tests for the `Values` (WITH ... VALUES) API on the
// sqlite dialect. These never execute any SQL — the value of the test is
// that `validate:tests` (tsc) rejects each `@ts-expect-error` line. If the
// library stops rejecting one of these, the directive becomes "unused" and the
// build fails with `TS2578` — exactly the regression signal we want.
//
// Every `@ts-expect-error` MUST be accompanied by a comment naming the rule it
// enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import { Values } from '../../../../src/Values.js'
import { SqliteConnection } from '../../../../src/connections/SqliteConnection.js'
import type { DBConnection } from '../domain/connection.js'
import { tProject } from '../domain/connection.js'

declare const connection: DBConnection

// A second connection of the same dialect, and a Values view bound to it: a view
// belongs to the connection it was declared for.
class OtherConnection extends SqliteConnection<'OtherConnection'> {}
class VOtherCode extends Values<OtherConnection, 'otherCode'> {
    id = this.column('int')
}

// A Values view mixing required columns (`id`, `name`) with an optional one
// (`newName`).
class VProjectPatch extends Values<DBConnection, 'projectPatch'> {
    id      = this.column('int')
    name    = this.column('string')
    newName = this.optionalColumn('string')
}

// A Values view carrying a `virtualColumnFromFragment` column (`display`) — a
// computed column that is never part of the VALUES tuple, so it must not be a
// writable row key of `Values.create`.
class VProjectPatchVirtual extends Values<DBConnection, 'projectPatchVirtual'> {
    id      = this.column('int')
    display = this.virtualColumnFromFragment('string', f => f.sql`'x'`)
}

// The body of `_typeNegatives` is checked by tsc but never executed at
// runtime, so the throw paths inside ts-sql-query are not triggered.
function _typeNegatives() {
    const patch = Values.create(VProjectPatch, 'projectPatch', [
        { id: 1, name: 'one' },
    ])

    // Rule: the name passed to Values.create must match the branded view name
    // declared on the Values subclass.
    Values.create(
        VProjectPatch,
        // @ts-expect-error view name must be 'projectPatch'
        'wrongName',
        [{ id: 1, name: 'one' }],
    )

    // Rule: a Values view exposes only its declared columns; reading an
    // undeclared column must not compile.
    // @ts-expect-error `bogus` is not a column of the Values view
    void patch.bogus

    // Rule: a Values column keeps its declared scalar type; comparing the int
    // `id` column against a string operand must not compile.
    // @ts-expect-error id is an int column; a string operand is rejected
    void patch.id.equals('x')

    // Positive control: the optional column `newName` may be omitted, and may
    // also be supplied explicitly — both compile.
    Values.create(VProjectPatch, 'projectPatch', [{ id: 1, name: 'one' }])
    Values.create(VProjectPatch, 'projectPatch', [{ id: 1, name: 'one', newName: 'patched' }])

    // Rule: Values.create enforces the ROW column shape, like insert().values()
    // does for a table — a required column must be present, a value must match
    // its column's scalar type, and no undeclared key is allowed.
    // @ts-expect-error required `name` omitted
    Values.create(VProjectPatch, 'projectPatch', [{ id: 1 }])
    // @ts-expect-error `id` is an int column; a string value is rejected
    Values.create(VProjectPatch, 'projectPatch', [{ id: '1', name: 'one' }])
    // @ts-expect-error `name` is a string column; a number value is rejected
    Values.create(VProjectPatch, 'projectPatch', [{ id: 1, name: 2 }])
    // @ts-expect-error `bogus` is not a column of the Values view
    Values.create(VProjectPatch, 'projectPatch', [{ id: 1, name: 'x', bogus: 1 }])

    // Rule: each Values.create row must be an object matching the view's column
    // shape; a non-object row (a bare scalar) is rejected.
    // @ts-expect-error a number is not a valid row object
    Values.create(VProjectPatch, 'projectPatch', [42])

    // Rule: the OPTIONAL column keeps its declared scalar type — a wrong-typed value
    // for it is rejected just like a required column (only its PRESENCE is optional).
    // @ts-expect-error `newName` is a string column; a number value is rejected
    Values.create(VProjectPatch, 'projectPatch', [{ id: 1, name: 'one', newName: 2 }])

    // Rule: a `virtualColumnFromFragment` column is computed, never part of the
    // VALUES tuple, so it is not a writable row key and must be rejected as one.
    // @ts-expect-error `display` is a virtual column, not a writable row key
    Values.create(VProjectPatchVirtual, 'projectPatchVirtual', [{ id: 1, display: 'x' }])

    // Rule: the Values subclass constructor takes an `OpaqueValues` brand
    // (`[dontCallConstructor]`) as its second argument, so `Values.create(...)` is
    // the ONLY entry point — constructing a view directly with `new` and a plain
    // row array cannot satisfy the brand and must not compile. This is the safety
    // mechanism that forces every Values view through `Values.create`.
    // @ts-expect-error direct construction is blocked — a row array is not an OpaqueValues; use Values.create
    new VProjectPatch('projectPatch', [{ id: 1, name: 'one' }])

    // Rule: a REQUIRED Values column rejects null in a row; the OPTIONAL one
    // accepts it.
    Values.create(VProjectPatch, 'projectPatch', [{ id: 1, name: 'one', newName: null }])
    // @ts-expect-error `id` is a required column; null is rejected
    Values.create(VProjectPatch, 'projectPatch', [{ id: null, name: 'one' }])

    // Rule: the rows argument of Values.create is an array of rows; a single
    // row object is rejected.
    // @ts-expect-error a bare row object is not a row array
    Values.create(VProjectPatch, 'projectPatch', { id: 1, name: 'one' })

    // Rule: a Values view of another connection cannot be used as a query source.
    const otherCodes = Values.create(VOtherCode, 'otherCode', [{ id: 1 }])
    void connection.selectFrom(patch).select({ id: patch.id })
    // @ts-expect-error the Values view belongs to OtherConnection
    void connection.selectFrom(otherCodes).select({ id: otherCodes.id })

    // Rule: a Values column is only reachable from a query that has the view in
    // its FROM / JOIN.
    void connection.selectFrom(tProject).innerJoin(patch).on(patch.id.equals(tProject.id)).select({ id: patch.id })
    // @ts-expect-error `patch` is not in the FROM of a query over tProject
    void connection.selectFrom(tProject).select({ id: patch.id })
    // Rule: a query over the Values view cannot read a table that is not joined.
    // @ts-expect-error tProject is not in the FROM of a query over `patch`
    void connection.selectFrom(patch).select({ id: tProject.id })

    // Rule: a join condition against a Values column keeps the column's data type.
    // @ts-expect-error patch.id is int; tProject.name is a string
    void connection.selectFrom(tProject).innerJoin(patch).on(patch.id.equals(tProject.name)).select({ id: patch.id })

    // Rule: a Values view used as a left-join source needs `forUseInLeftJoin()`
    // and is then only accepted by `leftJoin`.
    const patchLeft = patch.forUseInLeftJoin()
    void connection.selectFrom(tProject).leftJoin(patchLeft).on(patchLeft.id.equals(tProject.id)).select({ id: tProject.id })
    // @ts-expect-error a left-join source cannot be inner-joined
    void connection.selectFrom(tProject).join(patchLeft).on(patchLeft.id.equals(tProject.id)).select({ id: tProject.id })
    // @ts-expect-error leftJoin needs patch.forUseInLeftJoin()
    void connection.selectFrom(tProject).leftJoin(patch).on(patch.id.equals(tProject.id)).select({ id: tProject.id })

    // Rule: a Values column read through a left join is optional in the row.
    const leftOptional: Promise<{ name?: string }[]> = connection.selectFrom(tProject).leftJoin(patchLeft).on(patchLeft.id.equals(tProject.id)).select({ name: patchLeft.name }).executeSelectMany()
    // @ts-expect-error `name` comes from a left join, so it is optional in the row
    const leftRequired: Promise<{ name: string }[]> = connection.selectFrom(tProject).leftJoin(patchLeft).on(patchLeft.id.equals(tProject.id)).select({ name: patchLeft.name }).executeSelectMany()
    void leftOptional; void leftRequired

    // Rule: an OPTIONAL Values column projects an optional property.
    const optionalName: Promise<{ n?: string }[]> = connection.selectFrom(patch).select({ n: patch.newName }).executeSelectMany()
    // @ts-expect-error `newName` is an optional column, so it is optional in the row
    const requiredName: Promise<{ n: string }[]> = connection.selectFrom(patch).select({ n: patch.newName }).executeSelectMany()
    void optionalName; void requiredName

    // Rule: `in(subquery)` over a Values view keeps the column's data type.
    void tProject.id.in(connection.selectFrom(patch).selectOneColumn(patch.id))
    // @ts-expect-error the subquery column is a string; the receiver is int
    void tProject.id.in(connection.selectFrom(patch).selectOneColumn(patch.name))
}

test('with-values-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
