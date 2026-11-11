import { operationsThatNeedParenthesis, type OperationsThatNeedParenthesis } from '../operationsThatNeedParenthesis.js'

/** The operations of SQL Server whose SQL is wrapped in parenthesis when it is an operand of another operation */
export const sqlServerOperationsThatNeedParenthesis: OperationsThatNeedParenthesis = Object.freeze({
    ...operationsThatNeedParenthesis,
    _getDay: true,
    // `_getMilliseconds` is written as a self-contained call, so it never needs the wrapping the base's trailing
    // `% 1000` form asks for.
    _getMilliseconds: false,
    // `_length` is the only dialect's spelling that is not a bare call: it ends in `- 1`.
    _length: true,
    // `_replaceAll`/`_replaceAllInsensitive` append a trailing `collate DATABASE_DEFAULT` reset whenever
    // `replaceCollation`/`insensitiveCollation` forces a collation. That trailing `collate` binds looser than the
    // operators — and than an outer `replace`'s own forced collation — that embed it, so the whole expression must be
    // wrapped when used as an operand. Without this, chaining (`replaceAll().replaceAll()`, `replaceAll().collate()`,
    // `replaceAll().replaceAllInsensitive()`) writes two adjacent `collate` clauses — `... collate DATABASE_DEFAULT
    // collate Latin1_General_BIN2` — which SQL Server rejects (`Msg 156: Incorrect syntax near the keyword 'collate'`).
    // A parenthesised double collate is valid, so this is only registered on the dialects that add the reset (SQL
    // Server and Oracle), never on the base (MariaDB, MySQL, PostgreSQL and SQLite write a bare `replace(...)` with no
    // trailing collate, so wrapping it would only add noise).
    _replaceAll: true,
    _replaceAllInsensitive: true,
    // `_concatIgnoringNull` is a `concat(...)` call here, never the `+` operator `_concat` uses, so it is
    // self-delimiting and needs no wrapping as an operand.
    _concatIgnoringNull: false,
})
