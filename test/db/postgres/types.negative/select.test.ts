// Compile-time negative tests for SELECT-shaped APIs on the postgres dialect.
// These never execute any SQL — the value of the test is that
// `validate:tests` (tsc) rejects each `@ts-expect-error` line. If the
// library stops rejecting one of these, the directive becomes "unused" and
// `tsc` fails the build with `TS2578` — exactly the regression signal we
// want.
//
// Every `@ts-expect-error` MUST be accompanied by a comment naming the
// rule it enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import type { DBConnection } from '../domain/connection.js'
import { tAppUser, tIssue, tProject } from '../domain/connection.js'

// `connection` is type-only — the function below is checked by tsc but
// never invoked at runtime, so we don't need a real instance and don't
// open any driver-level resource just to make the file load.
declare const connection: DBConnection

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

    // Rule: .equals(value) must match the column's TS type.
    // tProject.id is int; passing a Date must not compile.
    // @ts-expect-error Date passed where number is required
    void tProject.id.equals(new Date())

    // Rule: .startsWith and other string-only ops are not available on int
    // columns.
    // @ts-expect-error startsWith does not exist on a NumberValueSource
    void tProject.id.startsWith('1')

    // Rule: .equals on a string column requires a string, not a number.
    // @ts-expect-error number passed where string is required
    void tAppUser.email.equals(1)

    // Rule: comparison methods between mismatched columns. tProject.id is int,
    // tAppUser.email is string — equals across types must not compile.
    // @ts-expect-error string column not equals-comparable with int column
    void tProject.id.equals(tAppUser.email)

    // Rule: aggregate functions returned a value source — they cannot be
    // called on the connection without a column argument when their
    // overload requires one (e.g. sum needs a NumberValueSource).
    // @ts-expect-error sum requires a number value source, not a string
    void connection.sum(tAppUser.email)

    // Rule: orderByFromString segments must be the column alias plus
    // optional direction/nulls modifier — random strings are not
    // typechecked. (orderByFromString is a `string` parameter so it
    // can't be statically rejected here — covered at runtime.)
    // void connection.selectFrom(tProject).select({...}).orderByFromString('arbitrary')

    // Rule: select on a typed projection must use IValueSource leaves.
    // Passing a plain string instead of a value source must not compile.
    void connection.selectFrom(tProject)
        .select({
            id:   tProject.id,
            // @ts-expect-error plain strings are not value sources
            name: 'a plain string',
        })

    // Rule: limit() requires a number.
    // @ts-expect-error string passed to limit
    void connection.selectFrom(tProject).select({ id: tProject.id }).limit('5')

    // Rule: offset() requires a number.
    // @ts-expect-error string passed to offset
    void connection.selectFrom(tProject).select({ id: tProject.id }).limit(5).offset('a')

    // Rule: equalsIfValue accepts a nullable value but the type must still
    // match the column's underlying type.
    // @ts-expect-error string passed where number | null | undefined expected
    void tIssue.priority.equalsIfValue('high')

    // Rule: aggregate functions are not allowed in a WHERE clause. An
    // aggregate carries an aggregate marker in its source that the FROM
    // source does not include, so the condition is not assignable to where().
    void connection.selectFrom(tIssue).where(
        // @ts-expect-error sum(...) is an aggregate and cannot appear in WHERE
        connection.sum(tIssue.priority).greaterThan(1)
    )

    // Rule: aggregate functions are not allowed in GROUP BY.
    void connection.selectFrom(tIssue).groupBy(
        // @ts-expect-error count(...) is an aggregate and cannot appear in GROUP BY
        connection.count(tIssue.id)
    )

    // Rule: aggregate functions are not allowed in a JOIN ON condition.
    void connection.selectFrom(tIssue).innerJoin(tProject).on(
        // @ts-expect-error max(...) is an aggregate and cannot appear in ON
        connection.max(tIssue.priority).equals(tProject.id)
    )

    // Rule: aggregateAsArray(...) / aggregateAsArrayOfOneColumn(...) are
    // aggregates too — their result carries the aggregate marker, so they are
    // rejected wherever a plain aggregate is (here: GROUP BY).
    void connection.selectFrom(tIssue).groupBy(
        // @ts-expect-error aggregateAsArrayOfOneColumn(...) is an aggregate and cannot appear in GROUP BY
        connection.aggregateAsArrayOfOneColumn(tIssue.priority)
    )

    // Rule: an aggregate written as a SQL fragment (aggregateFragmentWithType /
    // buildAggregateFragmentWith*) carries the aggregate marker too, so it is
    // rejected outside aggregate-legal clauses — here, in WHERE.
    void connection.selectFrom(tIssue).where(
        // @ts-expect-error an aggregate SQL fragment cannot appear in WHERE
        connection.aggregateFragmentWithType('int', 'optional').sql`sum(${tIssue.priority})`.greaterThan(1)
    )
}

test('select-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
