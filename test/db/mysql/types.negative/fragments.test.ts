// Compile-time negative tests for the SQL-fragment builders on the mysql
// dialect. These never execute any SQL — the value of the test is that
// `validate:tests` (tsc) rejects each `@ts-expect-error` line. If the library
// stops rejecting one of these, the directive becomes "unused" and the build
// fails with `TS2578` — exactly the regression signal we want.
//
// Every `@ts-expect-error` MUST be accompanied by a comment naming the rule it
// enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import { Table } from '../../../../src/Table.js'
import { DBConnection, tIssue, tProject } from '../domain/connection.js'

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

// A table carrying a well-formed virtual column (a positive control for the
// `virtualColumnFromFragment` rules below).
const tLocal = new class TLocal extends Table<DBConnection, 'TLocal'> {
    id        = this.column('id', 'int')
    name      = this.column('name', 'string')
    nameUpper = this.virtualColumnFromFragment('string', (fragment) => fragment.sql`upper(${this.name})`)
    constructor() {
        super('local')
    }
}()

// Rule: a `virtualColumnFromFragment` may reference only its own table's
// columns; a column of another table must not compile.
class TLocalForeign extends Table<DBConnection, 'TLocalForeign'> {
    name = this.column('name', 'string')
    // @ts-expect-error tIssue.title is not a column of this table
    bad  = this.virtualColumnFromFragment('string', (fragment) => fragment.sql`upper(${tIssue.title})`)
    constructor() {
        super('local_foreign')
    }
}

// Rule: the callback of `virtualColumnFromFragment` must return a value source
// of the declared data type.
class TLocalWrongType extends Table<DBConnection, 'TLocalWrongType'> {
    name = this.column('name', 'string')
    // @ts-expect-error the callback returns a string value source; the declared data type is int
    bad  = this.virtualColumnFromFragment('int', () => this.name)
    constructor() {
        super('local_wrong_type')
    }
}

// Rule: `arg(...)` accepts only a known data type name.
class ConnWithUnknownArgType extends DBConnection {
    // @ts-expect-error 'intx' is not a data type name
    bad = this.buildFragmentWithArgs(this.arg('intx', 'required')).as((a) => this.fragmentWithType('int', 'required').sql`${a}`)
}

// Rule: the `.as(...)` callback of a fragment builder must return a value source.
class ConnWithNonValueSourceBody extends DBConnection {
    // @ts-expect-error the fragment body returns a number, not a value source
    bad = this.buildFragmentWithArgs(this.arg('int', 'required')).as((_a) => 1)
}

// The body of `_typeNegatives` is checked by tsc but never executed at
// runtime, so the throw paths inside ts-sql-query are not triggered.
declare const conn: ConnWithRequiredValueArg
declare const connection: DBConnection

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

    // Classes above are type-only probes; reference them so they are used.
    void tLocal.nameUpper.equals('X')
    void TLocalForeign; void TLocalWrongType; void ConnWithUnknownArgType; void ConnWithNonValueSourceBody

    // ---- fragmentWithType / rawFragment ------------------------------------

    // Rule: `fragmentWithType(type, …)` produces a value source of that data
    // type; using it where another data type is required must not compile.
    void tIssue.title.equals(connection.fragmentWithType('string', 'required').sql`'x'`)
    // @ts-expect-error an int fragment compared against a string column
    void tIssue.title.equals(connection.fragmentWithType('int', 'required').sql`1`)

    // Rule: `fragmentWithType` accepts only a known data type name.
    // @ts-expect-error 'intx' is not a data type name
    void connection.fragmentWithType('intx', 'required')

    // Rule: the optionality argument is 'required' or 'optional'.
    // @ts-expect-error 'maybe' is not an optionality
    void connection.fragmentWithType('int', 'maybe')

    // Rule: a fragment interpolates value sources, not plain values.
    void connection.fragmentWithType('int', 'required').sql`${tIssue.id}`
    // @ts-expect-error a plain number cannot be interpolated; use connection.const(...)
    void connection.fragmentWithType('int', 'required').sql`${1}`
    void connection.rawFragment`${tIssue.id}`
    // @ts-expect-error a plain number cannot be interpolated; use connection.const(...)
    void connection.rawFragment`${1}`

    // Rule: a fragment carries the tables of the value sources it interpolates,
    // so it is only usable in a query that has them in FROM.
    void connection.selectFrom(tProject).select({ x: connection.fragmentWithType('int', 'required').sql`${tProject.id}` })
    // @ts-expect-error tIssue is not in the FROM of a query over tProject
    void connection.selectFrom(tProject).select({ x: connection.fragmentWithType('int', 'required').sql`${tIssue.id}` })
    void connection.selectFrom(tProject).select({ x: tProject.id }).customizeQuery({ afterQuery: connection.rawFragment`/* ${tProject.id} */` })
    // @ts-expect-error tIssue is not in the FROM of a query over tProject
    void connection.selectFrom(tProject).select({ x: tProject.id }).customizeQuery({ afterQuery: connection.rawFragment`/* ${tIssue.id} */` })

    // Rule: an 'optional' fragment projects an optional property.
    const fragmentRequired: Promise<{ x: number }> = connection.selectFrom(tIssue).select({ x: connection.fragmentWithType('int', 'required').sql`${tIssue.id}` }).executeSelectOne()
    // @ts-expect-error an 'optional' fragment is optional in the row
    const fragmentOptional: Promise<{ x: number }> = connection.selectFrom(tIssue).select({ x: connection.fragmentWithType('int', 'optional').sql`${tIssue.id}` }).executeSelectOne()
    void fragmentRequired; void fragmentOptional

    // ---- buildFragmentWithArgs ---------------------------------------------

    // Rule: a fragment function takes exactly the declared number of arguments.
    void connection.intLeftShift(1, 2)
    // @ts-expect-error intLeftShift declares two arguments
    void connection.intLeftShift(1)
    // @ts-expect-error intLeftShift declares two arguments
    void connection.intLeftShift(1, 2, 3)
    // @ts-expect-error constFortyTwo declares no arguments
    void connection.constFortyTwo(1)
    void connection.sumFourColumns(1, 2, 3, 4)
    // @ts-expect-error sumFourColumns declares four arguments
    void connection.sumFourColumns(1, 2, 3)

    // Rule: each argument must have its declared data type, as a value or as a
    // value source.
    // @ts-expect-error a string value where an int argument is declared
    void connection.intLeftShift('a', 2)
    void connection.intLeftShift(tIssue.id, 2)
    // @ts-expect-error a string column where an int argument is declared
    void connection.intLeftShift(tIssue.title, 2)
    void connection.bigintAbs(1n)
    // @ts-expect-error a number value where a bigint argument is declared
    void connection.bigintAbs(1)

    // Rule: a 'required' argument rejects null.
    // @ts-expect-error a required argument rejects null
    void connection.intLeftShift(null, 2)

    // Rule: a fragment function's result keeps the data type declared by its body.
    void tIssue.number.equals(connection.intLeftShift(1, 2))
    // @ts-expect-error intLeftShift returns int; the receiver is a string column
    void tIssue.title.equals(connection.intLeftShift(1, 2))

    // Rule: a fragment function's value-source argument carries its table, so
    // the result is only usable in a query that has that table in FROM.
    void connection.selectFrom(tProject).select({ x: connection.intLeftShift(tProject.id, 1) })
    // @ts-expect-error tIssue is not in the FROM of a query over tProject
    void connection.selectFrom(tProject).select({ x: connection.intLeftShift(tIssue.id, 1) })

    // ---- buildFragmentWithArgsIfValue --------------------------------------

    // Rule: both the column argument and the valueArg keep their data types.
    void connection.intEqualsIfValue(1, 2)
    // @ts-expect-error a string where the int argument is declared
    void connection.intEqualsIfValue('a', 1)
    // @ts-expect-error a string where the int valueArg is declared
    void connection.intEqualsIfValue(1, 'a')
    void connection.equalsStringIfValue(tIssue.title, 'x')
    // @ts-expect-error an int column where the string argument is declared
    void connection.equalsStringIfValue(tIssue.id, 'x')

    // ---- buildFragmentWithMaybeOptionalArgs --------------------------------

    // Rule: a maybe-optional argument keeps its data type.
    void connection.intPlus(null, 1)
    // @ts-expect-error a string where an int argument is declared
    void connection.intPlus('a', 1)

    // Rule: the result of a maybe-optional fragment is required only when every
    // argument is required; an optional argument makes it optional in the row.
    const plusRequired: Promise<{ x: number }> = connection.selectFrom(tIssue).select({ x: connection.intPlus(tIssue.priority, 1) }).executeSelectOne()
    // @ts-expect-error assigneeId is optional, so the result is optional in the row
    const plusOptional: Promise<{ x: number }> = connection.selectFrom(tIssue).select({ x: connection.intPlus(tIssue.assigneeId, 1) }).executeSelectOne()
    void plusRequired; void plusOptional
}

test('fragments-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
