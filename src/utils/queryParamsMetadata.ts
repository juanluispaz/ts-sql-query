/*
 * Metadata the query builders hang on a query's params array, as non-enumerable properties, for the query runner: it
 * travels with the params without being sent to the database, and never shows up when the params are listed or
 * serialised. Not every database uses all of it; it is extra information a runner may use (like SQL Server binding a
 * parameter with the type already known instead of inferring it), not something required to run the query.
 */

import type { QueryExecutionSource } from '../TsSqlError.js'

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
 * The data type (a value type, or a custom type name) of the parameter at that placeholder, when the SqlBuilder knows
 * it: SQL Server binds the parameter with it, Oracle declares the type of a RETURNING OUT bind with it.
 */
export function setParamType(params: any[], placeholder: string, type: string): void {
    defineHiddenParamsProperty(params, placeholder, type)
}

export function getParamType(params: any[], placeholder: string): string | undefined {
    return getHiddenParamsProperty(params, placeholder)
}

/**
 * The placeholders of the query are numbered (`?1`, `?2`, …) and the driver binds them by that number, not by position
 * (better-sqlite3 binds them from an object keyed by the number). Set by the query runner that emits them.
 */
export function setParamsBoundByNumber(params: any[]): void {
    defineHiddenParamsProperty(params, '_boundByNumber', true)
}

export function areParamsBoundByNumber(params: any[]): boolean {
    return !!getHiddenParamsProperty(params, '_boundByNumber')
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
