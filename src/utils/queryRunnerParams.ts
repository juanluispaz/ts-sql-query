// How each query runner of the library adds a parameter (its addParam): the placeholder, the cast in it, and the
// value it sends. The query runner and MockQueryRunner imitating it call the same function, so the mock writes the
// same SQL and the same params the real query runner would.

import type { DatabaseType } from '../queryRunners/QueryRunner.js'
import type { QueryRunnerName } from '../queryRunners/MockQueryRunner.js'
import { existingParamContextOf } from '../internal/QueryContextImpl.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { checkOracleParam, oraclePlaceholder } from './oracle/oracleParamTypes.js'
import { mySqlMariaDBPlaceholder } from './mySqlMariaDB/mySqlMariaDBParamTypes.js'
import { isPostgreSqlZonedParam, postgreSqlPlaceholder, postgreSqlZonedTimeCast } from './postgreSql/postgreSqlParamTypes.js'
import { sqlServerPlaceholder } from './sqlServer/sqlServerParamTypes.js'

/** The PostgreSQL type, by type name, written as the cast of a parameter (the typesByName of pg and Bun SQL) */
export type CastTypesByName = { readonly [typeName: string]: string }

/**
 * Adds the parameter to the params and returns its placeholder, as a query runner does in addParam: the type it is
 * sent with and forceTypeCast are in its context in the query, written by the library before
 */
export type ParamBinding = (params: any[], value: any, castTypesByName?: CastTypesByName | undefined) => string

function add(params: any[], value: unknown): number {
    const index = params.length
    params.push(value)
    return index
}

/** SQLite: a boolean stays a boolean in the params; the query runners whose driver rejects it give it as 1 or 0 */
const sqlite: ParamBinding = (params, value) => {
    return '?' + (add(params, value) + 1)
}
/**
 * sqlite-wasm binds a number that is an integer as a 64-bit integer, so one beyond that range would wrap without an
 * error (1e20 → 7766279631452241920): its text converted to a real keeps the value
 */
const sqliteWasm: ParamBinding = (params, value) => {
    if (typeof value === 'number' && Number.isInteger(value) && (value >= 2 ** 63 || value < -(2 ** 63))) {
        return 'cast(?' + (add(params, String(value)) + 1) + ' as real)'
    }
    return '?' + (add(params, value) + 1)
}
/** pg and Bun SQL can't send a parameter with its type: the type goes as a cast in the placeholder */
const postgreSqlCast: ParamBinding = (params, value, castTypesByName) => {
    // A localDateTime or a localTime of a database outside UTC, marked by the connection before it is added, goes with
    // its type, a timestamptz
    const param = existingParamContextOf(params, params.length)
    const zoned = isPostgreSqlZonedParam(params, params.length)
    const index = add(params, value)
    return postgreSqlPlaceholder(index, value, param?.requestedType ?? '', param?.requestedCustomType, !!param?.forceTypeCast, castTypesByName, zoned)
}
/** postgres.js and PGlite send the parameter with its type: the placeholder needs no cast */
const postgreSqlTyped: ParamBinding = (params, value) => {
    // A localDateTime or a localTime of a database outside UTC goes with its type, a timestamptz
    const param = existingParamContextOf(params, params.length)
    const zoned = isPostgreSqlZonedParam(params, params.length)
    return '$' + (add(params, value) + 1) + postgreSqlZonedTimeCast(param?.requestedType ?? '', param?.requestedCustomType, zoned)
}
const mySql: ParamBinding = (params, value) => {
    const param = existingParamContextOf(params, params.length)
    const placeholder = mySqlMariaDBPlaceholder('?', params, params.length, value, param?.requestedType ?? '', param?.requestedCustomType)
    add(params, value)
    return placeholder
}
const sqlServer: ParamBinding = (params, value) => {
    const param = existingParamContextOf(params, params.length)
    const placeholder = sqlServerPlaceholder('@' + params.length, params, params.length, value, param?.requestedType ?? '', param?.requestedCustomType)
    add(params, value)
    return placeholder
}
const oracle: ParamBinding = (params, value) => {
    const param = existingParamContextOf(params, params.length)
    checkOracleParam(params.length, value, param?.requestedType ?? '', param?.requestedCustomType)
    // A localDateTime or a localTime of a database outside UTC, marked by the connection before it is added, is cast
    // to the type of the column where it isn't the value of one
    const placeholder = oraclePlaceholder(':' + params.length, params, params.length, value)
    add(params, value)
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
            return (params, value) => '$' + add(params, value)
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
