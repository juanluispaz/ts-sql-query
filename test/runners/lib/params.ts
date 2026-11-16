// Adds a parameter as the SQL builder does: it keeps what the library knows of the parameter (its original type, also
// the one requested for it, and whether the database must receive its type) in the context of the query, and then asks
// the query runner for its placeholder. A query runner reads that context when it executes the query. `type` is the
// class of the type, or the name of a built-in one; a name the library doesn't know, or none (''), is a type only by
// its name.

import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import type { DataTypeClass } from '../../../src/TypeAdapter.js'
import { queryParamContextOf } from '../../../src/internal/QueryContextImpl.js'
import { __registeredDataType } from '../../../src/typeSystem/dataTypeRegistry.js'
import '../../../src/typeSystem/registerDataTypes.js'

// The class of the type, as the library gives it
function classOf(type: string | DataTypeClass): DataTypeClass {
    if (typeof type !== 'string') {
        return type
    }
    try {
        return __registeredDataType(type)
    } catch {
        return { type }
    }
}

function keepParamType(params: any[], type: string | DataTypeClass, forceTypeCast: boolean): void {
    const paramContext = queryParamContextOf(params, params.length)
    paramContext.setOriginalType(classOf(type))
    paramContext.forceTypeCast = forceTypeCast
}

export function addParam(runner: QueryRunner, params: any[], value: any, type: string | DataTypeClass, forceTypeCast: boolean): string {
    keepParamType(params, type, forceTypeCast)
    return runner.addParam(params, value)
}

export function addOutParam(runner: QueryRunner, params: any[], name: string, type: string | DataTypeClass, forceTypeCast: boolean): string {
    keepParamType(params, type, forceTypeCast)
    return runner.addOutParam(params, name)
}

/** The name of the type given to addParam */
export function typeNameOf(type: string | DataTypeClass): string {
    return typeof type === 'string' ? type : type.type
}
