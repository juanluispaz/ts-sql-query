import { operationsThatNeedParenthesis, type OperationsThatNeedParenthesis } from '../operationsThatNeedParenthesis.js'

/** The operations of SQLite whose SQL is wrapped in parenthesis when it is an operand of another operation */
export const sqliteOperationsThatNeedParenthesis: OperationsThatNeedParenthesis = {
    ...operationsThatNeedParenthesis,
    // `(cast(strftime('%w', x) as integer) + 6) % 7 + 1`
    _dayOfWeek: true,
    // `case … end`, which delimits itself
    _microsecond: false,
    // A call of a date function of SQLite
    _toPlainDateTimeAt: false,
    // A call of a date function of SQLite
    _addDuration: false,
    _subtractDuration: false,
    _addDurationRejecting: false,
    _subtractDurationRejecting: false,
    // An instant computed on its wall clock in UTC: a call of a date function of SQLite, or `case … end`, which delimits itself
    _roundInstant: false,
    _instantAddDuration: false,
    _instantSubtractDuration: false,
    _instantFromEpochMilliseconds: false,
    _instantFromEpochNanoseconds: false,
}
