// Adds a parameter as the SQL builder does: it keeps what the library knows of the parameter (its original type, also
// the one requested for it, and whether the database must receive its type) in the context of the query, and then asks
// the query runner for its placeholder. A query runner reads that context when it executes the query. `type` is the
// name of the type (a built-in one, or the name given to a custom type) and `customType` the custom type, if it is one.

import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import type { CustomType } from '../../../src/TypeAdapter.js'
import { queryParamContextOf } from '../../../src/internal/QueryContextImpl.js'

function keepParamType(params: any[], type: string, customType: CustomType | undefined, forceTypeCast: boolean): void {
    const paramContext = queryParamContextOf(params, params.length)
    paramContext.setOriginalType(type, customType)
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
