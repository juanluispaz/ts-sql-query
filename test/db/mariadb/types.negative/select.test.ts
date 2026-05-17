// Compile-time negative tests for SELECT-shaped APIs on the mariadb dialect.
// These never execute any SQL — the value of the test is that
// `validate:tests` (tsc) rejects each `@ts-expect-error` line. If the
// library stops rejecting one of these, the directive becomes "unused" and
// `tsc` fails the build with `TS2578` — exactly the regression signal we
// want.
//
// Every `@ts-expect-error` MUST be accompanied by a comment naming the
// rule it enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import { MockQueryRunner } from '../../../../src/queryRunners/MockQueryRunner.js'
import { DBConnection, tAppUser, tIssue, tProject } from '../domain/connection.js'

const connection = new DBConnection(new MockQueryRunner(() => undefined, 'mariaDB'))

// The body of `_typeNegatives` is checked by tsc but never executed at
// runtime; we keep it wrapped in an unreachable function so the throw
// paths inside ts-sql-query are not triggered by accident.
function _typeNegatives() {
    // Rule: `.equals()` requires the same scalar type on both sides.
    // tAppUser.id is `int`; passing a string must not compile.
    // @ts-expect-error string passed where int is required
    void tAppUser.id.equals('1')

    // Rule: you cannot select a column from a table that is not in the FROM
    // clause. Selecting from tProject and trying to project a column from
    // tIssue without joining it must not compile.
    void connection.selectFrom(tProject)
        .select({
            id:    tProject.id,
            // @ts-expect-error tIssue.title is not reachable from tProject alone
            title: tIssue.title,
        })

    // Rule: ORDER BY by alias must reference an alias that exists in the
    // current select shape.
    void connection.selectFrom(tProject)
        .select({ id: tProject.id, name: tProject.name })
        // @ts-expect-error 'unknownAlias' is not a key of the projected select
        .orderBy('unknownAlias')
}

test('select-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
