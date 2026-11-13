// Adds a parameter as the SQL builder does: it keeps what the library knows of the parameter (its type, its type
// category and whether the database must receive its type) in the context of the query, and then asks the query
// runner for its placeholder. A query runner reads that context when it executes the query.

import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import type { TypeCategory } from '../../../src/TypeAdapter.js'
import { queryParamContextOf } from '../../../src/internal/QueryContextImpl.js'

function keepParamType(params: any[], type: string, typeCategory: TypeCategory, forceTypeCast: boolean): void {
    const paramContext = queryParamContextOf(params, params.length)
    paramContext.type = type
    paramContext.typeCategory = typeCategory
    paramContext.forceTypeCast = forceTypeCast
}

export function addParam(runner: QueryRunner, params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
    keepParamType(params, type, typeCategory, forceTypeCast)
    return runner.addParam(params, value, type, typeCategory, forceTypeCast)
}

export function addOutParam(runner: QueryRunner, params: any[], name: string, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
    keepParamType(params, type, typeCategory, forceTypeCast)
    return runner.addOutParam(params, name, type, typeCategory, forceTypeCast)
}
