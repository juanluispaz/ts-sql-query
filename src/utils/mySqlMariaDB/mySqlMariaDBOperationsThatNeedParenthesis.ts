import { operationsThatNeedParenthesis, type OperationsThatNeedParenthesis } from '../operationsThatNeedParenthesis.js'

/** The operations of MariaDB and MySQL whose SQL is wrapped in parenthesis when it is an operand of another operation */
export const mySqlMariaDBOperationsThatNeedParenthesis: OperationsThatNeedParenthesis = Object.freeze({
    ...operationsThatNeedParenthesis,
    // `concat(...)`, a self-contained call
    _concat: false,
    // Both spellings of `_concatIgnoringNull` (`concat_ws(...)` / `concat(...)`) are self-contained calls, so neither
    // needs wrapping as an operand.
    _concatIgnoringNull: false,
    _is: true,
    _getDate: true,
    // `_getMilliseconds` is written as a self-contained call, so it never needs the wrapping the base's trailing
    // `% 1000` form asks for.
    _getMilliseconds: false,
})
