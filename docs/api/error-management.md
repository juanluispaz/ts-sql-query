---
search:
  boost: 0.3
---
# Error Management

All errors thrown by `ts-sql-query` extend `TsSqlError`.

The library defines two main error classes:
- `TsSqlProcessingError`: thrown while building or processing a query before it is executed.
- `TsSqlQueryExecutionError`: thrown while executing a query. When execution fails because of a processing error, that `TsSqlProcessingError` is wrapped by this error.

Every `TsSqlError` includes an `errorReason` property of type `TsSqlErrorReason`. This object identifies the error category and provides additional details about what went wrong.

`QueryExecutionSource` is a helper error type used to capture where query execution was requested, making the execution stack trace and causality chain easier to understand.

To access these types, import them as follows:

```ts
import { TsSqlError, TsSqlProcessingError, TsSqlQueryExecutionError, TsSqlErrorReason } from "ts-sql-query/TsSqlError";
```

## TsSqlErrorReason type

```ts
/**
 * Reason of the errors thrown by ts-sql-query
 */
export type TsSqlErrorReason = 

    /* ********************************************************************************************
     * Query validations specified when the query is built
     */

    | /** Thrown when a disallow rule is used (like in an insert) and an error string is provided when the criteria is not met */
      { reason: 'DISALLOWED_BY_QUERY_RULE', message: string, disallowedProperty: string, disallowedRowIndex?: number }
    | /** The name of a column was specified in the order of a query, but that column is not part of the select (like in a select's orderByFromString) */
      { reason: 'ORDER_BY_COLUMN_NOT_IN_SELECT', column: string }
    | /** Invalid ordering in an order by (like in select's orderByFromString) */
      { reason: 'INVALID_ORDER_BY_ORDERING', column: string, ordering: string }
    | /** The query required a where clause but ended without one */
      { reason: 'MISSING_WHERE' }

    /* ********************************************************************************************
     * Query result validations specified when the query's execution is requested
     */

    | /** In the query execution a minimum number of rows was specified, but it was not returned by the database (like in executeDeleteMany) */
      { reason: 'MINIMUM_ROWS_NOT_REACHED', count: number, min: number }
    | /** In the query execution a maximum number of rows was specified, but it was not returned by the database (like in executeDeleteMany) */
      { reason: 'MAXIMUM_ROWS_EXCEEDED', count: number, max: number }
    | /** The query should return one row, but more rows were returned by the database (like in executeSelectOne) */
      { reason: 'MORE_THAN_ONE_ROW', count: number }
    | /** The query should return a value, but no value was returned (like in executeSelectOne) */
      { reason: 'NO_RESULT' }

    /* ********************************************************************************************
     * Data validation
     */

    | /** Detected invalid value to send to the database that doesn't match with the expected type */
      { reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: unknown, typeName: string, rowIndex?: number, columnPath?: string }
    | /** Detected invalid value received from the database that doesn't match with the expected type */
      { reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value: unknown, typeName: string, rowIndex?: number, columnPath?: string }
    | /** Detected a mandatory value received from the database but it is absent (sql null) */
      { reason: 'MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE', value: unknown, typeName: string, rowIndex?: number, columnPath?: string }
    | /** Invalid JSON received from the database */
      { reason: 'INVALID_JSON_RECEIVED_FROM_DATABASE', value: unknown, typeName: string, rowIndex?: number, columnPath?: string }

    /* ********************************************************************************************
     * Allow & disallow errors when only a reason is provided
     */
    | /** Disallowed due to a disallowWhen / allowWhen condition */
      { reason: 'DISALLOWED', message: string, functionName: string }

    /* ********************************************************************************************
     * Transaction related errors
     */

    | /** You are trying to start a transaction when there is a transaction already opened */
      { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }
    | /** You are trying to perform an action that required to be in a transaction (like commit), but there is no open transaction */
      { reason: 'NOT_IN_TRANSACTION' }
    | /** You are trying to call a defer in transaction inside another defer in transaction */
      { reason: 'NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED' }
    | /** Error executing a defer in transaction. Note: all errors thrown in a defer in transaction will always be wrapped in a TsSqlQueryExecutionError */
      { reason: 'ERROR_EXECUTING_DEFERRED_IN_TRANSACTION', fn: () => void | Promise<void>, index: number, deferredType: 'before next commit' | 'after next commit' | 'after next rollback' }
    | /** Low-level transaction not supported by the provided query runner */ 
      { reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED' }
    | /** Specified transaction level not supported in the current database (like using a low-level query runner) */ 
      { reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: string | undefined}
    | /** Specified transaction access mode not supported in the current database (like using a low-level query runner) */ 
      { reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode: string | undefined }

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
    | /** Concurrent usage of the connection was detected; SQL connections must be dedicated and cannot process queries in parallel */
      { reason: 'FORBIDDEN_CONCURRENT_USAGE' }
    | /** You are trying to use a database connection with other piece (like a query runner) that doesn't support it */ 
      { reason: 'UNSUPPORTED_DATABASE', database: string }
    | /** You are trying to execute a query that is not supported by the database */ 
      { reason: 'UNSUPPORTED_QUERY' }

    /* ********************************************************************************************
     * Dynamic condition generation 
     */

    | /** The provided dynamic condition doesn't match the expected type */
      { reason: 'DYNAMIC_CONDITION_INVALID_FILTER', value: unknown, path: string }
    | /** The extension to the dynamic condition didn't return the expected type */
      { reason: 'DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE', processedValue: unknown, returnedValue: unknown, returnedTypeName?: string, path: string, extensionName: string }
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
      { reason: 'UNKNOWN_DATA_TYPE', typeName?: string }
    | /** Invalid SQL fragment return type */
      { reason: 'INVALID_SQL_FRAGMENT_RETURN_TYPE', typeName: string }

    /* ********************************************************************************************
     * Internal errors
     */

    | /** The builder ended in an invalid state */
      { reason: 'INTERNAL_ILLEGAL_STATE' }
    | /** Result column not found or it has the wrong type */
      { reason: 'INTERNAL_INVALID_RESULT_COLUMN' }
    | /** Unable to discover option joins */
      { reason: 'INTERNAL_UNABLE_TO_DISCOVER_OPTIONAL_JOINS' }
    | /** Invalid compound operator (union, union, intersect, etc.) */
      { reason: 'INTERNAL_INVALID_COMPOUND_OPERATOR', operator: string }
    | /** Invalid compound operator (inner join, left join, etc.) */
      { reason: 'INTERNAL_INVALID_JOIN_TYPE', joinType: string }
    | /** Invalid out bind returned by the database implementation */
      { reason: 'INTERNAL_INVALID_OUT_BINDS_RETURNED', value: unknown }
    | /** Expecting an insert of multiple values */
      { reason: 'INTERNAL_EXPECTING_INSERT_OF_MULTIPLE_VALUES' }
    | /** Expecting an insert with values coming from a select query */
      { reason: 'INTERNAL_EXPECTING_INSERT_FROM_SELECT' }
    | /** The provided value source is invalid due to a wrong implementation */
      { reason: 'INTERNAL_INVALID_VALUE_SOURCE' }
    | /** Unable to create the old value emulation query */
      { reason: 'INTERNAL_INCOMPLETE_OLD_VALUE_QUERY' }
    | /** The same column name appears several times where it is not expected to be repeated, like the returned select columns alias */
      { reason: 'INTERNAL_REPEATED_COLUMN', columnPath: string }
    | /** A value was found where it is not expected */
      { reason: 'INTERNAL_UNEXPECTED_VALUE' }

    /* ********************************************************************************************
     * Configuration errors
     */
    | /** Invalid configuration provided */
      { reason: 'INVALID_CONFIGURATION', name: string, value: unknown }

    /* ********************************************************************************************
     * Testing errors
     */
    | /** Invalid mocked value */
      { reason: 'INVALID_MOCKED_VALUE', value: unknown, queryType: string, index: number }

    /* ********************************************************************************************
     * Other errors
     */

    | /** Trying to access to the value of a non const expression */
      { reason: 'EXPRESSION_IS_NOT_CONST' }
    | /** You performed a real async operation (not a synchronous database call) inside a function meant to execute synchronous database queries. */
      { reason: 'SYNCHRONOUS_PROSIME_EXPECTED' }

    /* ********************************************************************************************
     * Unknown error
     */

    | /** Unknown error */
      { reason: 'UNKNOWN' }
```

## TsSqlError class

```ts
/**
 * Base class of all errors returned by ts-sql-query.
 */
export class TsSqlError extends Error {
    /** Identifies the error category and provides additional details about what went wrong. */
    errorReason: TsSqlErrorReason
}
```

## TsSqlQueryExecutionError class

```ts
/**
 * Error thrown during the execution of a query.
 * 
 * Note: This error always wraps any TsSqlProcessingError
 */
export class TsSqlQueryExecutionError extends TsSqlError {
    /** Identifies the error category and provides additional details about what went wrong. */
    errorReason: TsSqlErrorReason
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
}
```

## TsSqlProcessingError class

```ts
/**
 * Error thrown by ts-sql-query in different places.
 * 
 * Note: This error is always wrapped by TsSqlQueryExecutionError when the query is requested to be executed.
 */
export class TsSqlProcessingError extends TsSqlError {
    /** Identifies the error category and provides additional details about what went wrong. */
    errorReason: TsSqlErrorReason
}
```

## QueryExecutionSource class

```ts
/**
 * Collect information where the query was requested to be executed (the causality chain).
 * 
 * Note: This is not used as an error, only as a marker to collect the call stack.
 */
export class QueryExecutionSource extends Error {
}
```