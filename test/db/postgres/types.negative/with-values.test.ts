// Compile-time negative tests for the `Values` (WITH ... VALUES) API on the
// postgres dialect. These never execute any SQL — the value of the test is
// that `validate:tests` (tsgo) rejects each `@ts-expect-error` line. If the
// library stops rejecting one of these, the directive becomes "unused" and the
// build fails with `TS2578` — exactly the regression signal we want.
//
// Every `@ts-expect-error` MUST be accompanied by a comment naming the rule it
// enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import { Values } from '../../../../src/Values.js'
import type { DBConnection } from '../domain/connection.js'

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

// The body of `_typeNegatives` is checked by tsgo but never executed at
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
}

test('postgres-negative-types-with-values', () => {
    expect(typeof _typeNegatives).toBe('function')
})
