// How each query runner of the library adds a parameter (its addParam): the placeholder, the cast in it, and the
// value it sends. The query runner and MockQueryRunner imitating it call the same function, so the mock writes the
// same SQL and the same params the real query runner would.

import type { DatabaseType } from '../queryRunners/QueryRunner.js'
import type { QueryRunnerName } from '../queryRunners/MockQueryRunner.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { DataTypeName } from '../typeSystem/dataTypeNames.js'
import { existingParamContextOf, queryParamContextOf, type QueryParamContextImpl } from '../internal/QueryContextImpl.js'
import { __dataTypeClassFrom } from '../typeSystem/dataTypeClasses.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { checkOracleParam, oraclePlaceholder } from './oracle/oracleParamTypes.js'
import { bunSqlMySqlSendsAsText, mySqlMariaDBPlaceholder } from './mySqlMariaDB/mySqlMariaDBParamTypes.js'
import { isPostgreSqlZonedParam, postgreSqlParamTypeOfSqlDataType, postgreSqlPlaceholder, postgreSqlZonedTimeCast } from './postgreSql/postgreSqlParamTypes.js'
import { sqlServerPlaceholder } from './sqlServer/sqlServerParamTypes.js'

/** The PostgreSQL type, by type name, written as the cast of a parameter (the typesByName of pg and Bun SQL) */
export type CastTypesByName = { readonly [typeName: string]: string }

/**
 * Adds the parameter to the params and returns its placeholder, as a query runner does in addParam: the type it is
 * sent with and forceTypeCast are in its context in the query, written by the library before; a parameter added by
 * hand gets the type given (paramContextWithType)
 */
export type ParamBinding = (params: any[], value: any, type: DataTypeName | DataTypeClass | undefined, castTypesByName?: CastTypesByName | undefined) => string

/**
 * The context of the parameter at that index, as the query runner reads it: the one the library wrote before adding
 * it, or, for a parameter added by hand (SQL written by the user), one with the type given as its original and
 * requested type, so the query runner treats it as a value of that type; none without a type (the query runner works
 * the type out from the value)
 */
export function paramContextWithType(params: any[], index: number, type: DataTypeName | DataTypeClass | undefined): QueryParamContextImpl | undefined {
    const existing = existingParamContextOf(params, index)
    if (existing || type === undefined) {
        return existing
    }
    const result = queryParamContextOf(params, index)
    result.setOriginalType(__dataTypeClassFrom(type))
    return result
}

function add(params: any[], value: unknown): number {
    const index = params.length
    params.push(value)
    return index
}

/** SQLite: a boolean stays a boolean in the params; the query runners whose driver rejects it give it as 1 or 0 */
const sqlite: ParamBinding = (params, value, type) => {
    paramContextWithType(params, params.length, type)
    return '?' + (add(params, value) + 1)
}
/**
 * sqlite-wasm binds a number that is an integer as a 64-bit integer, so one beyond that range would wrap without an
 * error (1e20 → 7766279631452241920): its text converted to a real keeps the value
 */
const sqliteWasm: ParamBinding = (params, value, type) => {
    paramContextWithType(params, params.length, type)
    if (typeof value === 'number' && Number.isInteger(value) && (value >= 2 ** 63 || value < -(2 ** 63))) {
        return 'cast(?' + (add(params, String(value)) + 1) + ' as real)'
    }
    return '?' + (add(params, value) + 1)
}
/** pg and Bun SQL can't send a parameter with its type: the type goes as a cast in the placeholder */
const postgreSqlCast: ParamBinding = (params, value, type, castTypesByName) => {
    // A localDateTime or a localTime of a database outside UTC, marked by the connection before it is added, goes with
    // its type, a timestamptz
    const param = paramContextWithType(params, params.length, type)
    const zoned = isPostgreSqlZonedParam(params, params.length)
    const index = add(params, value)
    const forced = !!param?.forceTypeCast
    return postgreSqlPlaceholder(index, value, param?.requestedType, forced, castTypesByName, zoned, forced && !zoned ? postgreSqlParamTypeOfSqlDataType(params, index) : undefined)
}
/** postgres.js and PGlite send the parameter with its type: the placeholder needs no cast */
const postgreSqlTyped: ParamBinding = (params, value, type) => {
    // A localDateTime or a localTime of a database outside UTC goes with its type, a timestamptz
    const param = paramContextWithType(params, params.length, type)
    const zoned = isPostgreSqlZonedParam(params, params.length)
    return '$' + (add(params, value) + 1) + postgreSqlZonedTimeCast(param?.requestedType, zoned)
}
const mySql: ParamBinding = (params, value, type) => {
    const param = paramContextWithType(params, params.length, type)
    const placeholder = mySqlMariaDBPlaceholder('?', params, params.length, value, param?.requestedType)
    add(params, value)
    return placeholder
}
/** Bun SQL sends a bigint beyond 64 bits as its text (bunSqlMySqlDriverParams): its placeholder is the one of an exact number sent as text */
const bunSqlMySql: ParamBinding = (params, value, type) => {
    const param = paramContextWithType(params, params.length, type)
    const placeholder = mySqlMariaDBPlaceholder('?', params, params.length, bunSqlMySqlSendsAsText(value) ? value.toString() : value, param?.requestedType)
    add(params, value)
    return placeholder
}
const sqlServer: ParamBinding = (params, value, type) => {
    const param = paramContextWithType(params, params.length, type)
    const placeholder = sqlServerPlaceholder('@' + params.length, params, params.length, value, param?.requestedType)
    add(params, value)
    return placeholder
}
const oracle: ParamBinding = (params, value, type) => {
    const param = paramContextWithType(params, params.length, type)
    checkOracleParam(params.length, value, param?.requestedType)
    // A localDateTime or a localTime of a database outside UTC, marked by the connection before it is added, is cast
    // to the type of the column where it isn't the value of one
    const placeholder = oraclePlaceholder(':' + params.length, params, params.length, value)
    add(params, value)
    return placeholder
}

/** A database without a driver (NoopQueryRunner without a database): `$` and the index of the parameter */
const noopDB: ParamBinding = (params, value, type) => {
    paramContextWithType(params, params.length, type)
    return '$' + add(params, value)
}

/**
 * Adds an out parameter of Oracle (a RETURNING ... INTO), as its query runners and MockQueryRunner imitating them do in
 * addOutParam: an OUT bind (oracledb's BIND_OUT, 3003) named after the property it fills, and its placeholder; its type
 * is in its context, written by the library before, or the type given for one added by hand
 */
export function oracleOutParam(params: any[], name: string, type: DataTypeName | DataTypeClass | undefined): string {
    paramContextWithType(params, params.length, type)
    const index = params.length
    if (name) {
        params.push({ dir: 3003 /*oracledb.BIND_OUT*/, as: name })
    } else {
        params.push({ dir: 3003 /*oracledb.BIND_OUT*/ })
    }
    return ':' + index
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
    BunSqlMySqlQueryRunner: bunSqlMySql,
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
            return noopDB
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
