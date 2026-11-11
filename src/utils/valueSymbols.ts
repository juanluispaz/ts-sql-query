/*
 * Symbols used as the keys of values that exist at run time (unlike the ones of symbols.ts, which have no value):
 * hidden properties, out of a listing, a spread or JSON.stringify, and without collisions with any other key.
 */

// The information of each parameter of a query, kept for the query runner: an array hidden in the params, with one
// object per parameter whose keys are symbols
export const queryParamsInfo: unique symbol = Symbol('queryParamsInfo')

// A parameter of a localDateTime or a localTime that Oracle holds in a DATE (OracleDateAsTimestampTypeAdapter)
export const oracleDateParam: unique symbol = Symbol('oracleDateParam')

// A parameter of a localDateTime or a localTime of PostgreSQL with a databaseTimeZone other than UTC: sent as a
// timestamptz, which the database converts with its session (PostgreSqlConnection.addQueryParamMetadata)
export const postgreSqlZonedParam: unique symbol = Symbol('postgreSqlZonedParam')
