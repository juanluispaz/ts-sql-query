/*
 * The context of a query: what the library knows of a query it built, for whoever executes it (a query runner, an
 * interceptor, a logger, a mock). It travels with the params of the query, hidden: it is never sent to the database, and
 * never shows up when the params are listed, spread or serialised. A query the library didn't build, like a statement
 * run through the query runner by hand, has an empty context.
 */

import type { QueryExecutionSource } from './TsSqlError.js'
import type { DataTypeClass, SqlDataType } from './TypeAdapter.js'
import type { ConnectionConfiguration, FunctionExecutingQueryInformation, QueryResultColumn } from './queryRunners/QueryRunner.js'
import { emptyQueryContext, existingQueryContextOf } from './internal/QueryContextImpl.js'

/** What the library knows of a query it built */
export interface QueryContext {
    /** The name given to the query with `customizeQuery({ queryExecutionName })`, or undefined */
    readonly executionName: string | undefined
    /** The data given to the query with `customizeQuery({ queryExecutionMetadata })`, or undefined */
    readonly executionMetadata: unknown
    /**
     * Where in the code the query was executed, an `Error` whose stack is that place (the `source` of a
     * `TsSqlQueryExecutionError`), or undefined
     */
    readonly executionSource: QueryExecutionSource | undefined
    /** The stack of `executionSource`, or undefined */
    readonly executionStack: string | undefined
    /** The function, file, line and position that executed the query, read from `executionStack`, or undefined */
    readonly functionExecutingQuery: FunctionExecutingQueryInformation | undefined
    /** The query is the one that counts the rows of a select page */
    readonly isSelectPageCount: boolean
    /**
     * The columns of the result, in the order of the select list; an empty array when the query returns no columns,
     * undefined when the library didn't build the query
     */
    readonly resultColumns: readonly QueryResultColumn[] | undefined
    /** The column of the result with that key in a row returned by the database, or undefined */
    getResultColumn(name: string): QueryResultColumn | undefined
    /** The configuration of the connection that executes the query, or undefined when the library didn't build it */
    readonly connectionConfiguration: ConnectionConfiguration | undefined
    /** What the library knows of the parameter at that index of the params, or undefined */
    getParam(index: number): QueryParamContext | undefined
    /** What a type adapter kept of the query under that key, or undefined */
    getMetadata(key: symbol): unknown
}

/**
 * What the library knows of a parameter of a query it built. It has two types: the original one, declared in the
 * library, and the one requested for it, the type the query runner sends it with (by default the original one; a type
 * adapter can request another in its `transformValueToDB`).
 */
export interface QueryParamContext {
    /** The original type of the parameter, its class (`IntType`, or the class of a type of the user) */
    readonly originalType: DataTypeClass | undefined
    /** The type the parameter is sent with, its class */
    readonly requestedType: DataTypeClass | undefined
    /** The database must receive the type of the parameter: the position where it is written gives it none */
    readonly forceTypeCast: boolean | undefined
    /** The parameter is the value given to a column of a table, in the values of an insert or the set of an update */
    readonly isValueForColumn: boolean
    /**
     * The original type of the value in the database, the one the type adapter it is converted with says
     * (`withSqlDataType`): the one of the column it is given to or compared with; undefined when it says none
     */
    readonly originalSqlDataType: SqlDataType | undefined
    /**
     * The type of the value in the database it is sent with: the original one, unless the type adapter requested another
     * (`setRequestedSqlDataType`, like for a value it converts to another type)
     */
    readonly requestedSqlDataType: SqlDataType | undefined
    /** What a type adapter kept for the parameter under that key, or undefined */
    getMetadata(key: symbol): unknown
}

/** The context of the query with these params; an empty one when the library didn't build the query */
export function getQueryContext(query: string, params: any[]): QueryContext {
    query
    return existingQueryContextOf(params) ?? emptyQueryContext
}
