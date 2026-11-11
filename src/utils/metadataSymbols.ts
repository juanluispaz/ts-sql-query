/*
 * The metadata the library hangs on the params of a query, for the query runner: it travels with the params without
 * being sent to the database, and never shows up when the params are listed, spread or serialised. Each value is kept
 * under a symbol, a hidden property of the object it belongs to: the params array for what belongs to the query, and,
 * for what belongs to each parameter, one object per parameter, at its index, in an array hidden in the params
 * (queryParamsInfo). Not every database uses all of it; a query runner must still work with params built by hand,
 * without metadata.
 *
 * These symbols are keys of values that exist at run time, unlike the ones of symbols.ts, which have no value.
 */

/** Keeps a value under that key in the object, as a hidden property: out of a listing, a spread and JSON.stringify */
export function setMetadata(target: object, key: symbol, value: unknown): void {
    Object.defineProperty(target, key, { value, writable: true, enumerable: false, configurable: true })
}

/** The value kept under that key in the object, or undefined */
export function getMetadata<T = unknown>(target: object | null | undefined, key: symbol): T | undefined {
    return target ? (target as any)[key] : undefined
}

/** Keeps a value under that key for the parameter at that index of the params */
export function setParamMetadata(params: any[], index: number, key: symbol, value: unknown): void {
    let paramsInfo = getMetadata<object[]>(params, queryParamsInfo)
    if (!paramsInfo) {
        paramsInfo = []
        setMetadata(params, queryParamsInfo, paramsInfo)
    }
    let info = paramsInfo[index]
    if (!info) {
        info = {}
        paramsInfo[index] = info
    }
    setMetadata(info, key, value)
}

/** The value kept under that key for the parameter at that index of the params, or undefined */
export function getParamMetadata<T = unknown>(params: any[], index: number, key: symbol): T | undefined {
    return getMetadata<T>(getMetadata<object[]>(params, queryParamsInfo)?.[index], key)
}

// --- Of the query, on the params array ---

/** The information of each parameter: an array with one object per parameter, at its index */
export const queryParamsInfo: unique symbol = Symbol('queryParamsInfo')
/**
 * The columns of the result of the query (QueryResultColumn), in the order of its select list; an empty array when the
 * query returns no columns. Undefined for a query the library didn't build
 */
export const queryResultColumns: unique symbol = Symbol('queryResultColumns')
/**
 * The connection that executes the query, as the configuration its SQL builder reads (ConnectionConfiguration): its
 * values are read from it when used, so they are the ones the connection has once constructed
 */
export const queryConnectionConfiguration: unique symbol = Symbol('queryConnectionConfiguration')
/** Where the query was executed (an Error whose stack is the one of the execution), for the messages and the logs */
export const queryExecutionSource: unique symbol = Symbol('queryExecutionSource')
/** The name and metadata given to the query execution by the user (customizeQuery): QueryExecutionMetadata */
export const queryExecutionMetadata: unique symbol = Symbol('queryExecutionMetadata')
/** true on the count query an executeSelectPage runs next to the page query */
export const querySelectPageCount: unique symbol = Symbol('querySelectPageCount')
/** Whether the insert carries a returning clause; when undefined the query runner looks for it in the SQL */
export const queryContainsInsertReturningClause: unique symbol = Symbol('queryContainsInsertReturningClause')
/**
 * false when the returning of the outermost mutation collapsed to nothing (an empty returning({})), so the SQL has no
 * returning clause and the query runner executes it as a plain mutation
 */
export const queryContainsMutationReturningClause: unique symbol = Symbol('queryContainsMutationReturningClause')
/**
 * The count of affected rows known while building the query, for a statement whose driver can't report it (Oracle's
 * multi-row insert, a PL/SQL block): the query runner returns it instead of the driver's
 */
export const queryForcedAffectedRowCount: unique symbol = Symbol('queryForcedAffectedRowCount')

// --- Of each parameter ---

/** The type name of the parameter, kept by the query runner when it adds it */
export const queryParamType: unique symbol = Symbol('queryParamType')
/** The type category of the parameter (TypeCategory), kept by the query runner when it adds it */
export const queryParamTypeCategory: unique symbol = Symbol('queryParamTypeCategory')
/** Whether the query builder asked for the type of the parameter to be given to the database (its forceTypeCast) */
export const queryParamForceTypeCast: unique symbol = Symbol('queryParamForceTypeCast')
/**
 * true on the value given to a column of a table, in the values of an insert or the set of an update: the column gives
 * it its type. Written by the SQL builder before it asks the query runner to add the parameter
 */
export const queryParamValueForColumn: unique symbol = Symbol('queryParamValueForColumn')
/** A localDateTime or a localTime that Oracle holds in a DATE (OracleDateAsTimestampTypeAdapter) */
export const oracleDateParam: unique symbol = Symbol('oracleDateParam')
/**
 * A localDateTime or a localTime of PostgreSQL with a databaseTimeZone other than UTC: sent as a timestamptz, which the
 * database converts with its session (PostgreSqlConnection.addQueryParamMetadata)
 */
export const postgreSqlZonedParam: unique symbol = Symbol('postgreSqlZonedParam')
/**
 * A localDateTime or a localTime of Oracle with a databaseTimeZone other than UTC: sent as a TIMESTAMP WITH LOCAL TIME
 * ZONE, which the database converts with its session (OracleConnection.addQueryParamMetadata)
 */
export const oracleZonedParam: unique symbol = Symbol('oracleZonedParam')
