/*
 * The context of a query: what the library knows of a query it built, for whoever executes it (a query runner, an
 * interceptor, a logger, a mock). It travels with the params of the query, hidden: it is never sent to the database, and
 * never shows up when the params are listed, spread or serialised. A query the library didn't build, like a statement
 * run through the query runner by hand, has an empty context.
 */

import type { QueryExecutionSource } from './TsSqlError.js'
import type { TypeCategory } from './TypeAdapter.js'
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
}

/** What the library knows of a parameter of a query it built */
export interface QueryParamContext {
    /** The name of the type, like `'int'` or the one of a custom type */
    readonly type: string | undefined
    /** The category of the type, like `'customInt'` */
    readonly typeCategory: TypeCategory | undefined
    /** The database must receive the type of the parameter: the position where it is written gives it none */
    readonly forceTypeCast: boolean | undefined
    /** The parameter is the value given to a column of a table, in the values of an insert or the set of an update */
    readonly isValueForColumn: boolean
    /** What a type adapter kept for the parameter under that key, or undefined */
    getMetadata(key: symbol): unknown
}

/** The context of the query with these params; an empty one when the library didn't build the query */
export function getQueryContext(query: string, params: any[]): QueryContext {
    query
    return existingQueryContextOf(params) ?? emptyQueryContext
}
