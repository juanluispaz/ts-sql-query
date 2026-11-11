import { operationsThatNeedParenthesis, type OperationsThatNeedParenthesis } from '../operationsThatNeedParenthesis.js'

/** The operations of Oracle whose SQL is wrapped in parenthesis when it is an operand of another operation */
export const oracleOperationsThatNeedParenthesis: OperationsThatNeedParenthesis = Object.freeze({
    ...operationsThatNeedParenthesis,
    _getTime: true,
    // `_getMilliseconds` is written as a self-contained call, so it never needs the wrapping the base's trailing
    // `% 1000` form asks for.
    _getMilliseconds: false,
    _getDay: true,
    _negate: true,
    // `_cot` is written as the compound expression `1 / tan(x)` (Oracle has no native COT function), so it must be
    // parenthesised when used as an operand of another operation.
    _cot: true,
    // `_replaceAll`/`_replaceAllInsensitive` append a trailing `collate USING_NLS_COMP` reset whenever
    // `replaceCollation`/`insensitiveCollation` forces a collation. That trailing `collate` binds looser than the
    // operators — and than an outer `replace`'s own forced collation — that embed it, so the whole expression must be
    // wrapped when used as an operand. Without this, chaining (`replaceAll().replaceAll()`, `replaceAll().collate()`,
    // `replaceAll().replaceAllInsensitive()`) writes two adjacent `collate` clauses — `... collate USING_NLS_COMP collate
    // BINARY` — which Oracle rejects (`ORA-00907: missing right parenthesis`). A parenthesised double collate is valid,
    // so this is only registered on the dialects that add the reset (Oracle and SQL Server), never on the base (MariaDB,
    // MySQL, PostgreSQL and SQLite write a bare `replace(...)` with no trailing collate, so wrapping it would only add
    // noise).
    _replaceAll: true,
    _replaceAllInsensitive: true,
})
