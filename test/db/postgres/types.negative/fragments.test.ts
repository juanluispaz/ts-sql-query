// Compile-time negative tests for the SQL-fragment builders on the postgres
// dialect. These never execute any SQL — the value of the test is that
// `validate:tests` (tsgo) rejects each `@ts-expect-error` line. If the library
// stops rejecting one of these, the directive becomes "unused" and the build
// fails with `TS2578` — exactly the regression signal we want.
//
// Every `@ts-expect-error` MUST be accompanied by a comment naming the rule it
// enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import { DBConnection } from '../domain/connection.js'

// A connection subclass exposing a fragment whose `valueArg` is REQUIRED
// (`buildFragmentWith*` are protected, only reachable as connection fields). A
// required valueArg has a distinct compile-time contract from the OPTIONAL
// valueArg every domain fragment uses: the optional one accepts null/undefined
// (and elides the predicate), the required one rejects them.
class ConnWithRequiredValueArg extends DBConnection {
    intEqualsRequired = this.buildFragmentWithArgsIfValue(
        this.arg('int', 'required'),
        this.valueArg('int', 'required'),
    ).as((a, b) => this.fragmentWithType('boolean', 'required').sql`${a} = ${b}`)
}

// The body of `_typeNegatives` is checked by tsgo but never executed at
// runtime, so the throw paths inside ts-sql-query are not triggered.
declare const conn: ConnWithRequiredValueArg

function _typeNegatives() {
    // Positive control: a concrete int value for the required valueArg compiles.
    conn.intEqualsRequired(1, 5)

    // Rule: a REQUIRED valueArg rejects null (distinct from the optional valueArg,
    // which accepts null and elides the predicate; the emitted SQL is identical when
    // a value IS present, so the only difference is this compile-time contract).
    // @ts-expect-error required valueArg rejects null
    conn.intEqualsRequired(1, null)

    // Rule: a REQUIRED valueArg rejects undefined (the optional valueArg accepts
    // undefined and elides the predicate).
    // @ts-expect-error required valueArg rejects undefined
    conn.intEqualsRequired(1, undefined)
}

test('postgres-negative-types-fragments', () => {
    expect(typeof _typeNegatives).toBe('function')
})
