/*
 * Metadata the query builders hang on a query's params array, as non-enumerable properties, for the query runner: it
 * travels with the params without being sent to the database, and never shows up when the params are listed or
 * serialised. Not every database uses all of it; it is extra information a runner may use (like SQL Server binding a
 * parameter with the type already known instead of inferring it), not something required to run the query.
 */

import type { QueryExecutionSource } from '../TsSqlError.js'
import type { TypeCategory } from '../TypeAdapter.js'
import type { ConnectionConfiguration, QueryResultColumn } from '../queryRunners/QueryRunner.js'

function defineHiddenParamsProperty(params: any[], name: string, value: unknown): void {
    Object.defineProperty(params, name, {
        value: value,
        writable: true,
        enumerable: false,
        configurable: true
    })
}

function getHiddenParamsProperty<T>(params: any[], name: string): T | undefined {
    return (params as any)[name]
}

/**
 * Whether the insert carries a RETURNING clause; when undefined the query runner looks for it in the SQL.
 */
export function setContainsInsertReturningClause(params: any[], value: boolean | undefined): void {
    defineHiddenParamsProperty(params, '_containsInsertReturningClause', value)
}

export function getContainsInsertReturningClause(params: any[]): boolean | undefined {
    return getHiddenParamsProperty(params, '_containsInsertReturningClause')
}

/**
 * `false` when the outermost mutation's returning projection collapsed to nothing (an empty `returning({})`), so the
 * emitted SQL has no returning clause and the query runner executes it as a plain mutation.
 */
export function setContainsMutationReturningClause(params: any[], value: boolean | undefined): void {
    defineHiddenParamsProperty(params, '_containsMutationReturningClause', value)
}

export function getContainsMutationReturningClause(params: any[]): boolean | undefined {
    return getHiddenParamsProperty(params, '_containsMutationReturningClause')
}

/**
 * The affected-row count known while building the query, for a statement whose driver can't report it at execution
 * time (Oracle's multi-row INSERT, emitted as a PL/SQL block). The query runner returns it instead of the driver's.
 */
export function setForcedAffectedRowCount(params: any[], value: number | undefined): void {
    defineHiddenParamsProperty(params, '_forcedAffectedRowCount', value)
}

export function getForcedAffectedRowCount(params: any[]): number | undefined {
    return getHiddenParamsProperty(params, '_forcedAffectedRowCount')
}

/**
 * Where the query was built (for the error messages and the query-execution information a runner can read).
 */
export function setQueryExecutionSource(params: any[], source: Error): void {
    defineHiddenParamsProperty(params, '$source', source)
}

export function getQueryExecutionSourceOf(params: any[]): QueryExecutionSource | undefined {
    return getHiddenParamsProperty(params, '$source')
}

export interface QueryExecutionMetadata {
    queryExecutionName?: string
    queryExecutionMetadata?: any
}

/**
 * The name and metadata given to the query execution by the user (`customizeQuery`).
 */
export function setQueryExecutionMetadata(params: any[], metadata: QueryExecutionMetadata): void {
    defineHiddenParamsProperty(params, '$metadata', metadata)
}

export function getQueryExecutionMetadataOf(params: any[]): QueryExecutionMetadata | undefined {
    return getHiddenParamsProperty(params, '$metadata')
}

/**
 * Marks the count query a `executeSelectPage` runs next to the page query.
 */
export function setSelectPageCountQuery(params: any[]): void {
    defineHiddenParamsProperty(params, '$isSelectPageCountQuery', true)
}

export function isSelectPageCountQueryParams(params: any[]): boolean {
    return !!getHiddenParamsProperty(params, '$isSelectPageCountQuery')
}

/**
 * The type name, the type category and whether the query builder asked for the type of the parameter to be given to
 * the database (its forceTypeCast), of the parameter at that index of the params, kept by the query runner when it
 * adds the parameter, in three arrays aligned with the params. A parameter added without them leaves a hole.
 */
export function setParamTypeAt(params: any[], index: number, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): void {
    let types = getHiddenParamsProperty<string[]>(params, '$paramTypes')
    if (!types) {
        types = []
        defineHiddenParamsProperty(params, '$paramTypes', types)
    }
    let typeCategories = getHiddenParamsProperty<TypeCategory[]>(params, '$paramTypeCategories')
    if (!typeCategories) {
        typeCategories = []
        defineHiddenParamsProperty(params, '$paramTypeCategories', typeCategories)
    }
    let forceTypeCasts = getHiddenParamsProperty<boolean[]>(params, '$paramForceTypeCasts')
    if (!forceTypeCasts) {
        forceTypeCasts = []
        defineHiddenParamsProperty(params, '$paramForceTypeCasts', forceTypeCasts)
    }
    types[index] = type
    typeCategories[index] = typeCategory
    forceTypeCasts[index] = forceTypeCast
}

export function getParamTypeAt(params: any[], index: number): string | undefined {
    return getHiddenParamsProperty<string[]>(params, '$paramTypes')?.[index]
}

export function getParamTypeCategoryAt(params: any[], index: number): TypeCategory | undefined {
    return getHiddenParamsProperty<TypeCategory[]>(params, '$paramTypeCategories')?.[index]
}

export function getParamForceTypeCastAt(params: any[], index: number): boolean | undefined {
    return getHiddenParamsProperty<boolean[]>(params, '$paramForceTypeCasts')?.[index]
}

/**
 * Marks the parameter at that index as the value given to a column of a table, in the values of an insert or the set
 * of an update: the column gives it its type. Written by the query builder before it asks the query runner to add the
 * parameter; a parameter elsewhere has no mark.
 */
export function setParamValueForColumnAt(params: any[], index: number): void {
    let valuesForColumn = getHiddenParamsProperty<boolean[]>(params, '$paramValuesForColumn')
    if (!valuesForColumn) {
        valuesForColumn = []
        defineHiddenParamsProperty(params, '$paramValuesForColumn', valuesForColumn)
    }
    valuesForColumn[index] = true
}

export function isParamValueForColumnAt(params: any[], index: number): boolean {
    return getHiddenParamsProperty<boolean[]>(params, '$paramValuesForColumn')?.[index] === true
}

/**
 * The columns of the result of the query, in the order of its select list; an empty array when the query returns no
 * columns. Undefined for a query the library didn't build.
 */
export function setQueryResultColumns(params: any[], columns: readonly QueryResultColumn[]): void {
    defineHiddenParamsProperty(params, '$resultColumns', columns)
}

export function getQueryResultColumnsOf(params: any[]): readonly QueryResultColumn[] | undefined {
    return getHiddenParamsProperty(params, '$resultColumns')
}

/**
 * The connection that executes the query, as the configuration its SQL builder reads (`_connectionConfiguration`): its
 * values are read from it when used, so they are the ones the connection has once constructed.
 */
export function setQueryConnectionConfiguration(params: any[], configuration: ConnectionConfiguration): void {
    defineHiddenParamsProperty(params, '$connectionConfiguration', configuration)
}

export function getQueryConnectionConfigurationOf(params: any[]): ConnectionConfiguration | undefined {
    return getHiddenParamsProperty(params, '$connectionConfiguration')
}
