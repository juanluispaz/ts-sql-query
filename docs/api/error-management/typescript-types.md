# TypeScript Types

This page collects the TypeScript-facing error declarations that are useful when handling `ts-sql-query` errors in application code. The semantic explanation of each reason lives in [Error types](error-types.md), while native database signals are documented in the per-database mapping pages.

The declarations below are based on `src/TsSqlError.ts`. Keep this page focused on public consumption: error narrowing, reason fields, and the metadata a caller can inspect.

## Imports

```ts
import {
  QueryExecutionSource,
  TsSqlDatabaseErrorCode,
  TsSqlDatabaseErrorNumber,
  TsSqlError,
  TsSqlErrorReason,
  TsSqlInternalErrorReason,
  TsSqlProcessingError,
  TsSqlQueryExecutionError,
} from "ts-sql-query" // or "ts-sql-query/TsSqlError";
```

## Database Error Metadata Types

```ts
export type TsSqlDatabaseErrorCode = string
export type TsSqlDatabaseErrorNumber = string | number
```

`databaseErrorCode` stores the symbolic or textual signal when available. `databaseErrorNumber` stores numeric vendor codes and SQLSTATE-like values when available. `databaseErrorMessage` is a string field inside the reason object, not a standalone exported type.

## Reason Types

```ts
export type TsSqlErrorReason = 

    /* ********************************************************************************************
     * Query validations specified when the query is built
     */

    | /** Thrown when a disallow rule is used (like in an insert) and 
          an error string is provided when the criteria is not met */
      { reason: 'DISALLOWED_BY_QUERY_RULE', message: string, 
        disallowedProperty: string, disallowedRowIndex?: number | undefined }
    | /** The name of a column was specified in the order of a query, but that column 
          is not part of the select (like in a select's orderByFromString) */
      { reason: 'ORDER_BY_COLUMN_NOT_IN_SELECT', column: string }
    | /** Invalid ordering in an order by (like in select's orderByFromString) */
      { reason: 'INVALID_ORDER_BY_ORDERING', column: string, ordering: string }
    | /** The query required a where clause but ended without one */
      { reason: 'MISSING_WHERE' }

    /* ********************************************************************************************
     * Query result validations specified when the query's execution is requested
     */

    | /** In the query execution a minimum number of rows was specified, but it was 
          not returned by the database (like in executeDeleteMany) */
      { reason: 'MINIMUM_ROWS_NOT_REACHED', count: number, min: number }
    | /** In the query execution a maximum number of rows was specified, but it was 
          not returned by the database (like in executeDeleteMany) */
      { reason: 'MAXIMUM_ROWS_EXCEEDED', count: number, max: number }
    | /** The query should return one row, but more rows were returned by the database 
         (like in executeSelectOne, executeInsertNoneOrOne, executeDeleteOne, etc.) */
      { reason: 'MORE_THAN_ONE_ROW', count: number }
    | /** The query should return a value, but no value was returned 
          (like in executeSelectOne, executeUpdateOne, etc.) */
      { reason: 'NO_RESULT' }

    /* ********************************************************************************************
     * Data validation
     */

    | /** Detected invalid value to send to the database that doesn't match with the expected type */
      { reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: unknown, typeName: string, 
        rowIndex?: number | undefined, columnPath?: string | undefined }
    | /** Detected invalid value received from the database that doesn't match with the expected type */
      { reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value: unknown, typeName: string, 
        rowIndex?: number | undefined, columnPath?: string | undefined }
    | /** Detected a mandatory value received from the database but it is absent (sql null) */
      { reason: 'MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE', value: unknown, typeName: string, 
        rowIndex?: number | undefined, columnPath?: string | undefined }
    | /** Invalid JSON received from the database */
      { reason: 'INVALID_JSON_RECEIVED_FROM_DATABASE', value: unknown, typeName: string, 
        rowIndex?: number | undefined, columnPath?: string | undefined }

    /* ********************************************************************************************
     * Allow & disallow errors when only a reason is provided
     */
    | /** Disallowed due to a disallowWhen / allowWhen condition */
      { reason: 'DISALLOWED', message: string, functionName: string }

    /* ********************************************************************************************
     * Transaction related errors
     */

    | /** Transactional error reported by the database, driver, or transaction engine */
      { reason: 'TRANSACTION_ERROR',
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined,
        transactionErrorType?:     'invalid state' | 'aborted' | 'active transaction' |
          'serialization failure' | 'deadlock' | 'transaction rolled back' |
          'outcome unknown' | 'invalid savepoint' | 'unsupported operation' | undefined
      }
    | /** You are trying to start a transaction when there is a transaction already opened */
      { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }
    | /** You are trying to perform an action that required to be in a transaction (like commit), 
          but there is no open transaction */
      { reason: 'NOT_IN_TRANSACTION', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }
    | /** You are trying to call a defer in transaction inside another defer in transaction */
      { reason: 'NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED' }
    | /** Error executing a defer in transaction. 
          Note: all errors thrown in a defer in transaction will always be wrapped in a TsSqlQueryExecutionError */
      { reason: 'ERROR_EXECUTING_DEFERRED_IN_TRANSACTION', 
        fn: () => void | Promise<void>, index: number, 
        deferredType: 'before next commit' | 'after next commit' | 'after next rollback' }
    | /** Low-level transaction not supported by the provided query runner */ 
      { reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED',
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }
    | /** Specified transaction level not supported in the current database (like using a low-level query runner) */ 
      { reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: string | undefined,
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }
    | /** Specified transaction access mode not supported in the current database (like using a low-level query runner) */ 
      { reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode: string | undefined,
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }

    /* ********************************************************************************************
     * Query construction validation
     */

    | /** If you are trying to extend a shape and you try to override an already existing column */
      { reason: 'INVALID_SHAPE_OVERRIDE', property: string }
    | /** The query cannot be executed because there are no columns to set (like in an update) */
      { reason: 'NO_COLUMN_SETS' }
    | /** Constant values view requires at least one row  */
      { reason: 'CONSTANT_VALUES_VIEW_CANNOT_BE_EMPTY' }

    /* ********************************************************************************************
     * SQL processing
     */

    | /** The database returned more than one column when only a single one is expected */
      { reason: 'ONLY_ONE_COLUMN_EXPECTED' }
    | /** An out param is being created in a database that doesn't support out params */ 
      { reason: 'OUT_PARAMS_NOT_SUPPORTED' }
    | /** Concurrent usage of the connection was detected. 
          SQL connections must be dedicated and cannot process queries in parallel */
      { reason: 'FORBIDDEN_CONCURRENT_USAGE', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }
    | /** You are trying to use a database connection with other piece (like a query runner) that doesn't support it */ 
      { reason: 'UNSUPPORTED_DATABASE', database: string }
    | /** You are trying to execute a query that is not supported by the database */ 
      { reason: 'UNSUPPORTED_QUERY' }

    /* ********************************************************************************************
     * SQL exceution: Expected SQL errors useful to report as API/backend business errors
     */
    
    | /** SQL constraint violation reported by the database. 
          Note: primary key violations are reported as unique. */
      { reason: 'SQL_CONSTRAINT_VIOLATED', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined, 
        constraintType?: 'unique' | 'not null' | 'foreign key' | 'check' | 'exclusion' | 'restrict' | undefined, 
        constraintName?: string | undefined, tableName?: string | undefined, columnName?: string | undefined }
    | /** The value sent to the database is not valid for the target SQL type, expression, or column */
      { reason: 'SQL_INVALID_VALUE', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined, 
        errorType?: 'out of range' | 'too long' | 'invalid value' | 'invalid format' | 'invalid encoding' | 
            'invalid json' | 'invalid xml' | 'invalid regular expression' | 'null not allowed' | 'sequence limit' | undefined, 
        tableName?: string | undefined, columnName?: string | undefined, typeName?: string | undefined }

    /* ********************************************************************************************
     * SQL execution: Environment or deployment problems caused by discrepancies with the database model
     */

    | /** SQL object referenced by the query was not found */
      { reason: 'SQL_OBJECT_NOT_FOUND', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined, 
        objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'sequence' | 'database' | 'collation' | 
            'index' | 'trigger' | 'cursor' | 'prepared statement' | 'role' | undefined, 
        schemaName?: string | undefined, tableName?: string | undefined, columnName?: string | undefined, objectName?: string | undefined }
    | /** SQL object already exists */
      { reason: 'SQL_OBJECT_ALREADY_EXISTS', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined, 
        objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'sequence' | 'database' | 
            'index' | 'trigger' | 'cursor' | 'prepared statement' | undefined, 
        schemaName?: string | undefined, tableName?: string | undefined, columnName?: string | undefined, objectName?: string | undefined }

    /* ********************************************************************************************
     * SQL execution: Errors caused by the provided input or by the operation being executed
     */
    
    | /** Division by zero reported by the database */
      { reason: 'SQL_DIVISION_BY_ZERO', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }
    | /** The SQL operation expected a different number of rows or matches, like a scalar subquery returning multiple rows */
      { reason: 'SQL_CARDINALITY_VIOLATION', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }
    | /** Invalid SQL parameter binding or parameter reference reported by the database */
      { reason: 'SQL_INVALID_PARAMETER', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined,
        parameterErrorType?: 'missing' | 'too many' | 'wrong count' | 'invalid name' | 'invalid index' |
            'invalid type' | 'invalid value' | 'invalid binding' | 'not bindable' | 'already bound' | undefined,
        parameterName?: string | undefined, parameterIndex?: number | undefined, expectedParameterCount?: number | undefined, actualParameterCount?: number | undefined }
    | /** The query references an ambiguous column or object name */
      { reason: 'SQL_AMBIGUOUS_IDENTIFIER', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined, 
        identifier?: string | undefined,
        identifierType?: 'column' | 'routine' | 'parameter' | 'alias' | 'object' | undefined,
        identifierErrorType?: 'ambiguous' | 'duplicate' | undefined }
    | /** The SQL statement is semantically invalid, excluding syntax, permission, object, parameter, constraint, and value errors */
      { reason: 'SQL_INVALID_SQL_STATEMENT',
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined,
        statementErrorType?: 'incomplete statement' | 'invalid definition' | 'type mismatch' | 'invalid statement context' |
            'invalid identifier' | 'invalid reference' | 'invalid grouping' | 'invalid windowing' | 'invalid recursion' |
            'invalid locator' | 'case not found' | 'invalid argument' | undefined }

    /* ********************************************************************************************
     * SQL execution: Errors caused by misuse, transactions, connections, or runtime concurrency conditions
     */

    | /** SQL syntax error reported by the database */
      { reason: 'SQL_SYNTAX_ERROR', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }
    | /** Permission denied while executing the SQL statement */
      { reason: 'SQL_PERMISSION_DENIED', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }
    | /** SQL operation timed out or was cancelled; use timeoutType when the specific kind is known */
      { reason: 'SQL_TIMEOUT', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined, 
        timeoutType?: 'connection' | 'database file busy' | 'lock' | 'statement' | 'transaction' | 'idle transaction' | 'cancelled' | undefined }
    | /** The SQL operation is not allowed because the connection, session, database, or storage is read-only */
      { reason: 'SQL_READ_ONLY_VIOLATION', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }
    | /** Connection or pool infrastructure error while acquiring or using a database connection, excluding resource exhaustion cases */
      { reason: 'SQL_CONNECTION_ERROR', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined, 
        errorType?: 'connection lost' | 'temporarily unavailable' | 'invalid connection configuration' | 'pool error' | undefined }
    | /** Low-level database file or virtual filesystem I/O error */
      { reason: 'SQL_IO_ERROR',
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined,
        ioErrorType?: 'read' | 'write' | 'fsync' | 'truncate' | 'file stat' | 'lock' | 'unlock' | 'delete' | 'file not found' | 
            'access' | 'shared memory' | 'seek' | 'mmap' | 'path' | 'atomic write' | 'close' | 'reserved extension' | 'unknown' | undefined }
    | /** SQL routine or external routine failed while executing */
      { reason: 'SQL_ROUTINE_ERROR',
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }
    | /** SQL object exists but cannot be used in its current state or due to dependencies */
      { reason: 'SQL_OBJECT_STATE_ERROR',
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined,
        objectStateErrorType?: 'dependent objects still exist' | 'object in use' | 'invalid state' | 'wrong object type' | undefined,
        objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'sequence' | 'database' | 'collation' | 
            'index' | 'trigger' | 'cursor' | 'prepared statement' | 'role' | undefined,
        schemaName?: string | undefined, tableName?: string | undefined, columnName?: string | undefined, objectName?: string | undefined }
    | /** Database or session configuration error */
      { reason: 'SQL_CONFIGURATION_ERROR',
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined,
        configurationErrorType?: 'configuration file' | 'lock file' | 'runtime parameter' | undefined }
    | /** External or remote SQL data source error that cannot be more specifically classified */
      { reason: 'SQL_EXTERNAL_DATA_SOURCE_ERROR',
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }
    | /** Authentication failed while connecting to the database */
      { reason: 'SQL_AUTHENTICATION_ERROR', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }
    | /** Authorization failed while accessing the database, schema, or other SQL resources */
      { reason: 'SQL_AUTHORIZATION_ERROR', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }
    | /** A database or connection/pool capacity limit was reached while executing the SQL statement */
      { reason: 'SQL_RESOURCE_LIMIT_REACHED', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined, 
        resourceType?: 'disk' | 'memory' | 'temp space' | 'connections' | 'pool' | 'cpu' | 'file size' | undefined }
    | /** The database reported that the requested SQL feature is not supported */
      { reason: 'SQL_FEATURE_NOT_SUPPORTED', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }
    | /** The database reported corrupted database, index, or storage content */
      { reason: 'SQL_DATABASE_CORRUPTED',
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined,
        corruptionType?: 'database file' | 'index' | 'sequence' | 'virtual table' | 'filesystem' | 'checksum' | undefined }
    | /** Internal database engine condition or driver API misuse */
      { reason: 'SQL_INTERNAL_ERROR',
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined,
        errorType?: 'engine internal' | 'api misuse' | undefined }

    /* ********************************************************************************************
     * SQL execution: Unknown or uncategorized SQL error
     */
    
    | /** Unknown SQL error reported by the database */
      { reason: 'SQL_UNKNOWN', 
        databaseErrorCode?: TsSqlDatabaseErrorCode | undefined, databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined, databaseErrorMessage?: string | undefined }

    /* ********************************************************************************************
     * Dynamic condition generation 
     */

    | /** The provided dynamic condition doesn't match the expected type */
      { reason: 'DYNAMIC_CONDITION_INVALID_FILTER', value: unknown, path: string }
    | /** The extension to the dynamic condition didn't return the expected type */
      { reason: 'DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE', 
        processedValue: unknown, returnedValue: unknown, returnedTypeName?: string | undefined, 
        path: string, extensionName: string }
    | /** The provided dynamic condition contains an unknown column */
      { reason: 'DYNAMIC_CONDITION_UNKNOWN_COLUMN', path: string }
    | /** The provided dynamic condition contains an unknown operation */
      { reason: 'DYNAMIC_CONDITION_UNKNOWN_OPERATION', path: string, name: string }

    /* ********************************************************************************************
     * Query validations that should be detected by TypeScript
     */
    | /** The name of a column was specified in the group by of a query, but that column is not part of the select */
      { reason: 'GROUP_BY_COLUMN_NOT_IN_SELECT', column: string }
    | /** The name of a column specified in a select used for insert is not part of the table where it will be inserted */
      { reason: 'COLUMN_FOR_INSERT_COMING_FROM_SUBQUERY_NOT_IN_TABLE', column: string }
    | /** The name of a column specified in a select used for insert is not part of the table where it will be inserted */
      { reason: 'MAPPED_SHAPED_COLUMN_NOT_IN_TABLE', shapeProperty: string, mappedTo: string }
    | /** Autogenerated id column is needed but not found */
      { reason: 'NO_AUTOGENERATED_ID_COLUMN_FOUND' }
    | /** Primary key needed but not found */
      { reason: 'NO_PRIMARY_KEY_FOUND' }
    | /** Unknown data type */
      { reason: 'UNKNOWN_DATA_TYPE', typeName?: string | undefined }
    | /** Invalid SQL fragment return type */
      { reason: 'INVALID_SQL_FRAGMENT_RETURN_TYPE', typeName: string }

    /* ********************************************************************************************
     * Internal errors
     */

    | TsSqlInternalErrorReason

    /* ********************************************************************************************
     * Configuration errors
     */
    | /** Invalid configuration provided */
      { reason: 'INVALID_CONFIGURATION', name: string, value: unknown }

    /* ********************************************************************************************
     * Testing errors
     */
    | /** Invalid mocked value. Raised by `MockQueryRunner` as a shape gate: the value returned by
        the user-supplied `queryExecutor` does not match the rough shape a real driver would
        produce for that `queryType` (e.g. a plain object for a single-row select, an array of
        plain objects for a many-row select, a number for affected-row counts). Past this gate the
        value flows through the same result-projection pipeline a real driver's response would, so
        a structurally valid row that omits a required column still produces
        `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE` (and analogous reasons for type-mismatch or
        bad JSON) — that is the documented invariant, not a separate mock error. */
      { reason: 'INVALID_MOCKED_VALUE', value: unknown, queryType: string, index: number }

    /* ********************************************************************************************
     * Other errors
     */

    | /** Trying to access to the value of a non const expression */
      { reason: 'EXPRESSION_IS_NOT_CONST' }
    | /** You performed a real async operation (not a synchronous database call) 
          inside a function meant to execute synchronous database queries. */
      { reason: 'SYNCHRONOUS_PROSIME_EXPECTED' }

    /* ********************************************************************************************
     * Unknown error
     */

    | /** Unknown error */
      { reason: 'UNKNOWN' }

export type TsSqlInternalErrorReason =
    | /** The builder ended in an invalid state */
      { reason: 'INTERNAL', internalErrorType: 'illegal state' }
    | /** Result column not found or it has the wrong type */
      { reason: 'INTERNAL', internalErrorType: 'invalid result column' }
    | /** Unable to discover option joins */
      { reason: 'INTERNAL', internalErrorType: 'unable to discover optional joins' }
    | /** Invalid compound operator (union, union, intersect, etc.) */
      { reason: 'INTERNAL', internalErrorType: 'invalid compound operator', operator: string }
    | /** Invalid compound operator (inner join, left join, etc.) */
      { reason: 'INTERNAL', internalErrorType: 'invalid join type', joinType: string }
    | /** Invalid out bind returned by the database implementation */
      { reason: 'INTERNAL', internalErrorType: 'invalid out binds returned', value: unknown }
    | /** Expecting an insert of multiple values */
      { reason: 'INTERNAL', internalErrorType: 'expecting insert of multiple values' }
    | /** Expecting an insert with values coming from a select query */
      { reason: 'INTERNAL', internalErrorType: 'expecting insert from select' }
    | /** The provided value source is invalid due to a wrong implementation */
      { reason: 'INTERNAL', internalErrorType: 'invalid value source' }
    | /** Unable to create the old value emulation query */
      { reason: 'INTERNAL', internalErrorType: 'incomplete old value query' }
    | /** The same column name appears several times where it is not expected to be repeated, 
          like the returned select columns alias */
      { reason: 'INTERNAL', internalErrorType: 'repeated column', columnPath: string }
    | /** A value was found where it is not expected */
      { reason: 'INTERNAL', internalErrorType: 'unexpected value' }

```

## Error Classes

This is the public shape most consumers need when narrowing errors. The runtime implementation also preserves stack traces and attaches the native error through the standard `cause` mechanism when one is available.

```ts
/**
 * Base class of all errors returned by ts-sql-query.
 */
export class TsSqlError extends Error {
    /** Identifies the error category and provides additional details about what went wrong. */
    errorReason: TsSqlErrorReason

    constructor(errorReason: TsSqlErrorReason, message: string)
    constructor(errorReason: TsSqlErrorReason, message: string, cause: unknown)
    constructor(errorReason: TsSqlErrorReason, messageOrCause: unknown)
}

/**
 * Error thrown during the execution of a query.
 *
 * Note: This error always wraps any TsSqlProcessingError.
 */
export class TsSqlQueryExecutionError extends TsSqlError {
    /** Captures where the failing query execution was requested. */
    source: QueryExecutionSource
    /** Captures where the surrounding transaction was started, when available. */
    transactionSource?: QueryExecutionSource
    /** Error thrown while attempting to rollback after the main execution error. */
    rollbackError?: unknown
    /** Error thrown by the transaction handling itself. */
    transactionError?: unknown
    /** Additional errors produced by related handlers during error processing. */
    additionalErrors?: Array<unknown>

    constructor(source: QueryExecutionSource, errorReason: TsSqlErrorReason, message: string)
    constructor(source: QueryExecutionSource, errorReason: TsSqlErrorReason, message: string, cause: unknown)
    constructor(source: QueryExecutionSource, errorReason: TsSqlErrorReason, messageOrCause: unknown)

    attachTransactionSource(source: QueryExecutionSource): this
    attachRollbackError(error: unknown): this
    attachTransactionError(error: unknown): this
    attachAdditionalError(additional: unknown, name: string): this
}

/**
 * Collect information where the query was requested to be executed (the causality chain).
 *
 * Note: This is not used as an error, only as a marker to collect the call stack.
 */
export class QueryExecutionSource extends Error {
    constructor(message: string)
}

/**
 * Error thrown by ts-sql-query in different places.
 *
 * Note: This error is always wrapped by TsSqlQueryExecutionError when the query is requested to be executed.
 */
export class TsSqlProcessingError extends TsSqlError {
    constructor(errorReason: TsSqlErrorReason, message: string)
    constructor(errorReason: TsSqlErrorReason, message: string, cause: unknown)
    constructor(errorReason: TsSqlErrorReason, messageOrCause: unknown)
}
```

## Narrowing Example

```ts
try {
  await connection.selectFrom(tCustomer).selectAll().executeSelectMany()
} catch (error) {
  if (error instanceof TsSqlQueryExecutionError) {
    const reason = error.errorReason

    if (reason.reason === 'SQL_CONSTRAINT_VIOLATED') {
      console.log(reason.constraintType)
      console.log(reason.databaseErrorCode)
      console.log(reason.databaseErrorNumber)
      console.log(reason.databaseErrorMessage)
    }
  }
}
```
