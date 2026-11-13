// Adds a parameter as the SQL builder does: it keeps what the library knows of the parameter (its original type, also
// the one requested for it, and whether the database must receive its type) in the context of the query, and then asks
// the query runner for its placeholder. A query runner reads that context when it executes the query. `columnType` is
// the first argument of a column: the name of a built-in type, or the custom type of `type`.

import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import type { ValueType } from '../../../src/expressions/values.js'
import { queryParamContextOf } from '../../../src/internal/QueryContextImpl.js'
import { __customTypeOf } from '../../../src/utils/typeCategory.js'

function keepParamType(params: any[], type: string, columnType: ValueType, forceTypeCast: boolean): void {
    const paramContext = queryParamContextOf(params, params.length)
    paramContext.setOriginalType(type, __customTypeOf(columnType))
    paramContext.forceTypeCast = forceTypeCast
}

export function addParam(runner: QueryRunner, params: any[], value: any, type: string, columnType: ValueType, forceTypeCast: boolean): string {
    keepParamType(params, type, columnType, forceTypeCast)
    return runner.addParam(params, value)
}

export function addOutParam(runner: QueryRunner, params: any[], name: string, type: string, columnType: ValueType, forceTypeCast: boolean): string {
    keepParamType(params, type, columnType, forceTypeCast)
    return runner.addOutParam(params, name)
}
