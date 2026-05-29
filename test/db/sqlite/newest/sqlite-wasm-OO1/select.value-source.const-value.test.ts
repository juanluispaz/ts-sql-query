// Coverage of the const-value introspection surface documented in
// docs/api/value-expressions.md:
//
//   - `isConstValue()`  — true only for a literal built by
//     `connection.const(...)` / `connection.optionalConst(...)`.
//   - `getConstValue()` — returns that literal back, or throws
//     TsSqlProcessingError `EXPRESSION_IS_NOT_CONST` for any value
//     source that is not a const (columns, operation results, …).
//
// These methods are pure client-side introspection: no SQL is emitted
// and the database is never touched, so there are no inline SQL/param
// snapshots and the behaviour is identical on every dialect and
// connector (no per-cell divergence, no real-DB branch).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

function reasonOf(e: unknown): string | undefined {
    if (e instanceof TsSqlError) return e.errorReason.reason
    return undefined
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('const-int-is-const-and-returns-the-value', () => {
        const value = ctx.conn.const(42, 'int')
        expect(value.isConstValue()).toBe(true)
        expect(value.getConstValue()).toBe(42)
    })

    test('const-string-roundtrips-the-exact-value', () => {
        const value = ctx.conn.const('marketing', 'string')
        expect(value.isConstValue()).toBe(true)
        expect(value.getConstValue()).toBe('marketing')
    })

    test('const-bigint-roundtrips-the-exact-value', () => {
        const value = ctx.conn.const(9007199254740993n, 'bigint')
        expect(value.isConstValue()).toBe(true)
        expect(value.getConstValue()).toBe(9007199254740993n)
    })

    test('const-boolean-roundtrips-the-exact-value', () => {
        const value = ctx.conn.const(true, 'boolean')
        expect(value.isConstValue()).toBe(true)
        expect(value.getConstValue()).toBe(true)
    })

    test('optional-const-with-a-value-is-const', () => {
        const value = ctx.conn.optionalConst(7, 'int')
        expect(value.isConstValue()).toBe(true)
        expect(value.getConstValue()).toBe(7)
    })

    test('optional-const-with-null-is-const-null', () => {
        // `optionalConst(null, …)` still produces a const value source —
        // the literal it carries is just `null`.
        const value = ctx.conn.optionalConst(null, 'int')
        expect(value.isConstValue()).toBe(true)
        expect(value.getConstValue()).toBe(null)
    })

    test('optional-const-custom-type-with-value-is-const', () => {
        // The string-`typeName` overload of `optionalConst` (custom typed
        // value source). Purely client-side: the type name does not change
        // emitted SQL, and the literal reads back unchanged.
        const value = ctx.conn.optionalConst(7, 'customInt', 'Score')
        expect(value.isConstValue()).toBe(true)
        expect(value.getConstValue()).toBe(7)
    })

    test('optional-const-custom-type-null-is-const-null', () => {
        const value = ctx.conn.optionalConst(null, 'custom', 'MyType')
        expect(value.isConstValue()).toBe(true)
        expect(value.getConstValue()).toBe(null)
    })

    test('column-is-not-a-const-value', () => {
        expect(tIssue.id.isConstValue()).toBe(false)
    })

    test('column-getConstValue-throws-EXPRESSION_IS_NOT_CONST', () => {
        let caught: unknown
        try {
            tIssue.id.getConstValue()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('EXPRESSION_IS_NOT_CONST')
    })

    test('operation-over-a-const-is-not-itself-const', () => {
        // `.add(...)` wraps the literal in a SqlOperation value source,
        // which inherits the base (non-const) behaviour: the algebraic
        // result is no longer a literal the library can read back.
        const expr = ctx.conn.const(2, 'int').add(3)
        expect(expr.isConstValue()).toBe(false)
        let caught: unknown
        try {
            expr.getConstValue()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('EXPRESSION_IS_NOT_CONST')
    })
})
