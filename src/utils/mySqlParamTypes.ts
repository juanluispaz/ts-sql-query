import type { TypeCategory } from '../TypeAdapter.js'
import { customDecimalDigitsOf, rejectCustomDecimalParam } from './customDecimalParams.js'
import { isParamValueForColumnAt } from './queryParamsMetadata.js'
import { __isDecimalCategory } from './typeCategory.js'

/**
 * The placeholder of a parameter on MySQL and MariaDB, for every query runner of them. A customDecimal is sent as
 * text, and the database computes with a text in double precision, and compares it in double precision in an `in` or
 * a `between`: it is cast to a decimal with the digits of the value, except as the value of a column, whose type it
 * takes. A value beyond the widest decimal of the database (65 digits, 30 of them decimals) is rejected: the cast
 * would give 999…9 without an error, and without it the database would compute in double precision; no column can
 * hold it. Call it before adding the parameter at that index.
 */
export function mySqlPlaceholder(placeholder: string, params: any[], index: number, value: unknown, type: string, typeCategory: TypeCategory): string {
    if (!__isDecimalCategory(typeCategory)) {
        return placeholder
    }
    const digits = customDecimalDigitsOf(value)
    if (!digits) {
        return placeholder
    }
    if (digits.precision > 65 || digits.scale > 30) {
        rejectCustomDecimalParam(value, type, index, 'decimal(65, 30)')
    }
    if (isParamValueForColumnAt(params, index)) {
        return placeholder
    }
    return 'cast(' + placeholder + ' as decimal(' + digits.precision + ', ' + digits.scale + '))'
}
