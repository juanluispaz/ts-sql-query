import type { DataTypeClass } from '../../TypeAdapter.js'
import { customDecimalDigitsOf, rejectCustomDecimalParam } from '../customDecimalParams.js'
import { __typeSqlDataTypeOf } from '../../typeSystem/dataTypes.js'
import { existingParamContextOf } from '../../internal/QueryContextImpl.js'

/**
 * The placeholder of a parameter on SQL Server, for every query runner of it. An exact number sent as its text (a
 * stringDecimal, an exact decimal, a number or a bigint of an exact number that isn't an integer of a fixed size) is
 * sent as an nvarchar:
 * two of them would be concatenated, a modulo rejects it, and alone it would be cut to the width of the text it is
 * converted to; it is cast to a decimal with the digits of the value, except as the value of a column, whose type it
 * takes. A value beyond the widest decimal of the database (38 digits) is rejected: the cast would fail, and no
 * column can hold it. Call it before adding the parameter at that index.
 */
export function sqlServerPlaceholder(placeholder: string, params: any[], index: number, value: unknown, requestedType: DataTypeClass | undefined): string {
    const sqlDataType = __typeSqlDataTypeOf(requestedType)
    if (sqlDataType?.family !== 'exact numeric') {
        return placeholder
    }
    // An integer of a fixed size goes as one (an Int, a BigInt); any other exact number, as its text
    const sentAsText = sqlDataType.scale !== 0 || sqlDataType.bytes === undefined
    const digits = typeof value === 'string' ? customDecimalDigitsOf(value) : sentAsText && (typeof value === 'bigint' || typeof value === 'number') ? customDecimalDigitsOf(String(value)) : undefined
    if (!digits) {
        return placeholder
    }
    if (digits.precision > 38) {
        rejectCustomDecimalParam(value, requestedType?.type ?? '', index, 'decimal(38)')
    }
    if ((existingParamContextOf(params, index)?.isValueForColumn === true)) {
        return placeholder
    }
    return 'cast(' + placeholder + ' as decimal(' + digits.precision + ', ' + digits.scale + '))'
}
