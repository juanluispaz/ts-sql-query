import type { TypeCategory } from '../TypeAdapter.js'
import { customDecimalDigitsOf, rejectCustomDecimalParam } from './customDecimalParams.js'

/**
 * Checks a parameter on Oracle, for every query runner of it: the number of the database keeps 38 significant
 * digits, so a customDecimal with more, which would be rounded in a computation without an error and that no column
 * can hold, is rejected. Call it before adding the parameter at that index.
 */
export function checkOracleParam(index: number, value: unknown, type: string, typeCategory: TypeCategory): void {
    if (typeCategory !== 'customDecimal') {
        return
    }
    const digits = customDecimalDigitsOf(value)
    if (digits && digits.significantDigits > 38) {
        rejectCustomDecimalParam(value, type, index, 'a number of 38 significant digits')
    }
}
