import type { TypeCategory } from '../TypeAdapter.js'
import { customDecimalDigitsOf, rejectCustomDecimalParam } from './customDecimalParams.js'
import { isParamValueForColumnAt } from './queryParamsMetadata.js'
import { __isDecimalCategory } from './typeCategory.js'

/**
 * The placeholder of a parameter on SQL Server, for every query runner of it. A customDecimal is sent as an nvarchar:
 * two of them would be concatenated, a modulo rejects it, and alone it would be cut to the width of the text it is
 * converted to; it is cast to a decimal with the digits of the value, except as the value of a column, whose type it
 * takes. A value beyond the widest decimal of the database (38 digits) is rejected: the cast would fail, and no
 * column can hold it. Call it before adding the parameter at that index.
 */
export function sqlServerPlaceholder(placeholder: string, params: any[], index: number, value: unknown, type: string, typeCategory: TypeCategory): string {
    if (!__isDecimalCategory(typeCategory)) {
        return placeholder
    }
    const digits = customDecimalDigitsOf(value)
    if (!digits) {
        return placeholder
    }
    if (digits.precision > 38) {
        rejectCustomDecimalParam(value, type, index, 'decimal(38)')
    }
    if (isParamValueForColumnAt(params, index)) {
        return placeholder
    }
    return 'cast(' + placeholder + ' as decimal(' + digits.precision + ', ' + digits.scale + '))'
}
