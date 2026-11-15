// Adds a parameter as the SQL builder does: it keeps what the library knows of the parameter (its original type, also
// the one requested for it, and whether the database must receive its type) in the context of the query, and then asks
// the query runner for its placeholder. A query runner reads that context when it executes the query. `type` is the
// name of the type (a built-in one, or the name given to a custom type) and `customType` the custom type, if it is one.

import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import type { CustomType, DataTypeClass } from '../../../src/TypeAdapter.js'
import { queryParamContextOf } from '../../../src/internal/QueryContextImpl.js'
import { __dataTypeClassOf } from '../../../src/typeSystem/dataTypeClasses.js'
import { __typeSqlDataTypeOf } from '../../../src/typeSystem/dataTypes.js'
import '../../../src/typeSystem/registerDataTypes.js'

// The class of the type, as the library gives it; a type the library doesn't know, or none (''), only by its names
function classOf(type: string, customType: CustomType | undefined): DataTypeClass {
    try {
        return __dataTypeClassOf(type, customType)
    } catch {
        return { type, customType }
    }
}

function keepParamType(params: any[], type: string, customType: CustomType | undefined, forceTypeCast: boolean): void {
    const paramContext = queryParamContextOf(params, params.length)
    const typeClass = classOf(type, customType)
    paramContext.setOriginalType(typeClass)
    paramContext.setOriginalSqlDataType(__typeSqlDataTypeOf(typeClass))
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
