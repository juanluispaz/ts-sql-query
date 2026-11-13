/*
 * Hidden properties: a value kept under a symbol in an object, out of a listing, a spread and JSON.stringify. The context
 * of a query (internal/QueryContextImpl.ts) is kept this way on its params; the error mappers keep what they read of an
 * error this way on it.
 *
 * Also the keys of what the library keeps for its own query runners in the context of a parameter
 * (QueryParamContextImpl.setMetadata). These symbols are keys of values that exist at run time, unlike the ones of
 * symbols.ts, which have no value.
 */

/** Keeps a value under that key in the object, as a hidden property: out of a listing, a spread and JSON.stringify */
export function setMetadata(target: object, key: symbol, value: unknown): void {
    Object.defineProperty(target, key, { value, writable: true, enumerable: false, configurable: true })
}

/** The value kept under that key in the object, or undefined */
export function getMetadata<T = unknown>(target: object | null | undefined, key: symbol): T | undefined {
    return target ? (target as any)[key] : undefined
}

// --- Of each parameter ---

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
