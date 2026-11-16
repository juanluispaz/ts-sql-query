// Adds a parameter as the SQL builder does: it keeps what the library knows of the parameter (its original type, also
// the one requested for it, and whether the database must receive its type) in the context of the query, and then asks
// the query runner for its placeholder. A query runner reads that context when it executes the query. `type` is the
// name of the type (a built-in one, or the name given to a custom type) and `customType` the custom type, if it is one.

import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import type { CustomType, DataTypeClass } from '../../../src/TypeAdapter.js'
import { queryParamContextOf } from '../../../src/internal/QueryContextImpl.js'
import { __registeredDataType } from '../../../src/typeSystem/dataTypeRegistry.js'
import '../../../src/typeSystem/registerDataTypes.js'
import { CustomBigintType, CustomComparableType, CustomDecimalType, CustomDoubleType, CustomEqualableType, CustomIntType, CustomLocalDateTimeType, CustomLocalDateType, CustomLocalTimeType, CustomUuidType, EnumType } from '../../../src/exports/v2/index.js'

// The family of each custom type, which gives the class of each type name
const customFamilies: { [customType: string]: { of(typeName: string): DataTypeClass } } = {
    customInt: CustomIntType, customBigint: CustomBigintType, customDouble: CustomDoubleType, customDecimal: CustomDecimalType,
    customUuid: CustomUuidType, customLocalDate: CustomLocalDateType, customLocalTime: CustomLocalTimeType,
    customLocalDateTime: CustomLocalDateTimeType, enum: EnumType, custom: CustomEqualableType, customComparable: CustomComparableType,
}

// The class of the type, as the library gives it; a type the library doesn't know, or none (''), only by its names
function classOf(type: string, customType: CustomType | undefined): DataTypeClass {
    try {
        return customType === undefined ? __registeredDataType(type) : customFamilies[customType]!.of(type)
    } catch {
        return { type, customType }
    }
}

function keepParamType(params: any[], type: string, customType: CustomType | undefined, forceTypeCast: boolean): void {
    const paramContext = queryParamContextOf(params, params.length)
    const typeClass = classOf(type, customType)
    paramContext.setOriginalType(typeClass)
    paramContext.forceTypeCast = forceTypeCast
}

export function addParam(runner: QueryRunner, params: any[], value: any, type: string, customType: CustomType | undefined, forceTypeCast: boolean): string {
    keepParamType(params, type, customType, forceTypeCast)
    return runner.addParam(params, value)
}

export function addOutParam(runner: QueryRunner, params: any[], name: string, type: string, customType: CustomType | undefined, forceTypeCast: boolean): string {
    keepParamType(params, type, customType, forceTypeCast)
    return runner.addOutParam(params, name)
}
