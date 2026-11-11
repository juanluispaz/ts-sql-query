import type { SqlOperation } from '../sqlBuilders/SqlBuilder.js'

// The operations whose SQL is wrapped in parenthesis when it is an operand of another operation, because it doesn't
// delimit itself (an operator, or a call followed by an operator): `(a + b) * c`, `(x collate name) = y`. Each SQL
// builder has the list of its database; this one is the base, the one of PostgreSQL and SQLite.

/** Whether the SQL of each operation is wrapped in parenthesis when it is an operand of another operation */
export type OperationsThatNeedParenthesis = { readonly [operation in keyof SqlOperation]?: boolean | undefined }

export const operationsThatNeedParenthesis: OperationsThatNeedParenthesis = Object.freeze({
    _equals: true,
    _notEquals: true,
    _is: true,
    _isNot: true,
    _equalsInsensitive: true,
    _notEqualsInsensitive: true,
    _lessThan: true,
    _greaterThan: true,
    _lessOrEqual: true,
    _greaterOrEqual: true,
    _and: true,
    _or: true,
    _concat: true,
    // Same as `_concat`: the base spelling is the `||` operator (plus a `coalesce` per nullable operand), so it must be
    // wrapped when embedded as an operand. A dialect that writes a self-contained call sets it back to false.
    _concatIgnoringNull: true,
    _add: true,
    _subtract: true,
    _multiply: true,
    _divide: true,
    _modulo: true,
    _fragment: true,
    // The date-part family below is written in PostgreSQL's form, and PostgreSQL is the dialect that reaches it (it
    // declares no override of its own). Both of these write a trailing operator (`- 1`, `% 1000`), so they need wrapping
    // when embedded. A dialect whose override is a self-contained call sets these back to false.
    _getMonth: true,
    _getMilliseconds: true,
    // `<x> collate <name>` binds looser than the operators it is embedded in, so it needs wrapping when used as an
    // operand (`(x collate name) = …`). The receiver's own parenthesis is handled by `_appendSqlParenthesis` inside
    // `_collate`.
    _collate: true,
})
