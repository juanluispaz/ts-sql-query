// How each query runner of the library adds a parameter (its addParam): the placeholder, the cast in it, and the
// value it sends. The query runner and MockQueryRunner imitating it call the same function, so the mock writes the
// same SQL and the same params the real query runner would.

import type { DatabaseType } from '../queryRunners/QueryRunner.js'
import type { QueryRunnerName } from '../queryRunners/MockQueryRunner.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { checkOracleParam, oraclePlaceholder } from './oracleParamTypes.js'
import { mySqlPlaceholder } from './mySqlParamTypes.js'
import { isPostgreSqlZonedParam, postgreSqlPlaceholder, postgreSqlZonedTimeCast } from './postgreSqlParamTypes.js'
import { queryParamForceTypeCast, queryParamType, queryParamTypeCategory, setParamMetadata } from './metadataSymbols.js'
import { sqlServerPlaceholder } from './sqlServerParamTypes.js'

/** The PostgreSQL type, by type name, written as the cast of a parameter (the typesByName of pg and Bun SQL) */
export type CastTypesByName = { readonly [typeName: string]: string }

/** Adds the parameter to the params and returns its placeholder, as a query runner does in addParam */
export type ParamBinding = (params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean, castTypesByName?: CastTypesByName | undefined) => string

function add(params: any[], value: unknown, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): number {
    const index = params.length
    setParamMetadata(params, index, queryParamType, type)
    setParamMetadata(params, index, queryParamTypeCategory, typeCategory)
    setParamMetadata(params, index, queryParamForceTypeCast, forceTypeCast)
    params.push(value)
    return index
}

/** SQLite: a boolean stays a boolean in the params; the query runners whose driver rejects it give it as 1 or 0 */
const sqlite: ParamBinding = (params, value, type, typeCategory, forceTypeCast) => {
    return '?' + (add(params, value, type, typeCategory, forceTypeCast) + 1)
}
/**
 * sqlite-wasm binds a number that is an integer as a 64-bit integer, so one beyond that range would wrap without an
 * error (1e20 → 7766279631452241920): its text converted to a real keeps the value
 */
const sqliteWasm: ParamBinding = (params, value, type, typeCategory, forceTypeCast) => {
    if (typeof value === 'number' && Number.isInteger(value) && (value >= 2 ** 63 || value < -(2 ** 63))) {
        return 'cast(?' + (add(params, String(value), type, typeCategory, forceTypeCast) + 1) + ' as real)'
    }
    return '?' + (add(params, value, type, typeCategory, forceTypeCast) + 1)
}
/** pg and Bun SQL can't send a parameter with its type: the type goes as a cast in the placeholder */
const postgreSqlCast: ParamBinding = (params, value, type, typeCategory, forceTypeCast, castTypesByName) => {
    // A localDateTime or a localTime of a database outside UTC, marked by the connection before it is added, goes with
    // its type, a timestamptz
    const zoned = isPostgreSqlZonedParam(params, params.length)
    const index = add(params, value, type, typeCategory, forceTypeCast || zoned)
    return postgreSqlPlaceholder(index, value, type, typeCategory, forceTypeCast, castTypesByName, zoned)
}
/** postgres.js and PGlite send the parameter with its type: the placeholder needs no cast */
const postgreSqlTyped: ParamBinding = (params, value, type, typeCategory, forceTypeCast) => {
    // A localDateTime or a localTime of a database outside UTC goes with its type, a timestamptz
    const zoned = isPostgreSqlZonedParam(params, params.length)
    return '$' + (add(params, value, type, typeCategory, forceTypeCast || zoned) + 1) + postgreSqlZonedTimeCast(type, typeCategory, zoned)
}
const mySql: ParamBinding = (params, value, type, typeCategory, forceTypeCast) => {
    const placeholder = mySqlPlaceholder('?', params, params.length, value, type, typeCategory)
    add(params, value, type, typeCategory, forceTypeCast)
    return placeholder
}
const sqlServer: ParamBinding = (params, value, type, typeCategory, forceTypeCast) => {
    const placeholder = sqlServerPlaceholder('@' + params.length, params, params.length, value, type, typeCategory)
    add(params, value, type, typeCategory, forceTypeCast)
    return placeholder
}
const oracle: ParamBinding = (params, value, type, typeCategory, forceTypeCast) => {
    checkOracleParam(params.length, value, type, typeCategory)
    // A localDateTime or a localTime of a database outside UTC, marked by the connection before it is added, is cast
    // to the type of the column where it isn't the value of one
    const placeholder = oraclePlaceholder(':' + params.length, params, params.length, value)
    add(params, value, type, typeCategory, forceTypeCast)
    return placeholder
}

/** The way each query runner of the library that talks to a database adds a parameter */
export const queryRunnerParamBindings: { readonly [name in QueryRunnerName]: ParamBinding } = {
    BetterSqlite3QueryRunner: sqlite,
    BunSqliteQueryRunner: sqlite,
    NodeSqliteQueryRunner: sqlite,
    BunSqlSqliteQueryRunner: sqlite,
    Sqlite3WasmOO1QueryRunner: sqliteWasm,
    PgQueryRunner: postgreSqlCast,
    PgPoolQueryRunner: postgreSqlCast,
    BunSqlPostgresQueryRunner: postgreSqlCast,
    PostgresQueryRunner: postgreSqlTyped,
    PgLiteQueryRunner: postgreSqlTyped,
    MySql2QueryRunner: mySql,
    MySql2PoolQueryRunner: mySql,
    MariaDBQueryRunner: mySql,
    MariaDBPoolQueryRunner: mySql,
    BunSqlMySqlQueryRunner: mySql,
    MssqlPoolQueryRunner: sqlServer,
    MssqlPoolPromiseQueryRunner: sqlServer,
    OracleDBQueryRunner: oracle,
    OracleDBPoolQueryRunner: oracle,
    OracleDBPoolPromiseQueryRunner: oracle,
}

/** The databases each query runner of the library talks to, the default one first */
export const queryRunnerDatabases: { readonly [name in QueryRunnerName]: readonly DatabaseType[] } = {
    BetterSqlite3QueryRunner: ['sqlite'],
    BunSqliteQueryRunner: ['sqlite'],
    NodeSqliteQueryRunner: ['sqlite'],
    BunSqlSqliteQueryRunner: ['sqlite'],
    Sqlite3WasmOO1QueryRunner: ['sqlite'],
    PgQueryRunner: ['postgreSql'],
    PgPoolQueryRunner: ['postgreSql'],
    BunSqlPostgresQueryRunner: ['postgreSql'],
    PostgresQueryRunner: ['postgreSql'],
    PgLiteQueryRunner: ['postgreSql'],
    MySql2QueryRunner: ['mySql', 'mariaDB'],
    MySql2PoolQueryRunner: ['mySql', 'mariaDB'],
    MariaDBQueryRunner: ['mariaDB', 'mySql'],
    MariaDBPoolQueryRunner: ['mariaDB', 'mySql'],
    BunSqlMySqlQueryRunner: ['mySql', 'mariaDB'],
    MssqlPoolQueryRunner: ['sqlServer'],
    MssqlPoolPromiseQueryRunner: ['sqlServer'],
    OracleDBQueryRunner: ['oracle'],
    OracleDBPoolQueryRunner: ['oracle'],
    OracleDBPoolPromiseQueryRunner: ['oracle'],
}

/**
 * The way a query runner that imitates a database without a driver (MockQueryRunner, NoopQueryRunner) adds a
 * parameter: the placeholder of the database, with the rules every query runner of that database applies, and the
 * cast pg writes on PostgreSQL
 */
export function databaseParamBinding(database: DatabaseType): ParamBinding {
    switch (database) {
        case 'mariaDB':
        case 'mySql':
            return mySql
        case 'noopDB':
            return (params, value, type, typeCategory, forceTypeCast) => '$' + add(params, value, type, typeCategory, forceTypeCast)
        case 'oracle':
            return oracle
        case 'postgreSql':
            return postgreSqlCast
        case 'sqlite':
            return sqlite
        case 'sqlServer':
            return sqlServer
        default:
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unknown database ' + database)
    }
}
