/**
 * Reason of the errors thrown by ts-sql-query
 */
export type TsSqlDatabaseErrorCode = string | number

export type TsSqlErrorReason = 

    /* ********************************************************************************************
     * Query validations specified when the query is built
     */

    | /** Thrown when a disallow rule is used (like in an insert) and 
          an error string is provided when the criteria is not met */
      { reason: 'DISALLOWED_BY_QUERY_RULE', message: string, 
        disallowedProperty: string, disallowedRowIndex?: number }
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
        rowIndex?: number, columnPath?: string }
    | /** Detected invalid value received from the database that doesn't match with the expected type */
      { reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value: unknown, typeName: string, 
        rowIndex?: number, columnPath?: string }
    | /** Detected a mandatory value received from the database but it is absent (sql null) */
      { reason: 'MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE', value: unknown, typeName: string, 
        rowIndex?: number, columnPath?: string }
    | /** Invalid JSON received from the database */
      { reason: 'INVALID_JSON_RECEIVED_FROM_DATABASE', value: unknown, typeName: string, 
        rowIndex?: number, columnPath?: string }

    /* ********************************************************************************************
     * Allow & disallow errors when only a reason is provided
     */
    | /** Disallowed due to a disallowWhen / allowWhen condition */
      { reason: 'DISALLOWED', message: string, functionName: string }

    /* ********************************************************************************************
     * Transaction related errors
     */

    | /** You are trying to start a transaction when there is a transaction already opened */
      { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }
    | /** You are trying to perform an action that required to be in a transaction (like commit), 
          but there is no open transaction */
      { reason: 'NOT_IN_TRANSACTION', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }
    | /** You are trying to call a defer in transaction inside another defer in transaction */
      { reason: 'NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED' }
    | /** Error executing a defer in transaction. 
          Note: all errors thrown in a defer in transaction will always be wrapped in a TsSqlQueryExecutionError */
      { reason: 'ERROR_EXECUTING_DEFERRED_IN_TRANSACTION', 
        fn: () => void | Promise<void>, index: number, 
        deferredType: 'before next commit' | 'after next commit' | 'after next rollback' }
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
    | /** Concurrent usage of the connection was detected. 
          SQL connections must be dedicated and cannot process queries in parallel */
      { reason: 'FORBIDDEN_CONCURRENT_USAGE', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }
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
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string, 
        constraintType?: 'unique' | 'not null' | 'foreign key' | 'check' | 'exclusion', 
        constraintName?: string, tableName?: string, columnName?: string }
    | /** The value sent to the database is not valid for the target SQL type or column */
      { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string, 
        errorType?: 'out of range' | 'too long' | 'invalid value', 
        tableName?: string, columnName?: string, typeName?: string }

    /* ********************************************************************************************
     * SQL execution: Environment or deployment problems caused by discrepancies with the database model
     */

    | /** SQL object referenced by the query was not found */
      { reason: 'SQL_OBJECT_NOT_FOUND', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string, 
        objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'sequence' | 'database', 
        schemaName?: string, tableName?: string, columnName?: string, objectName?: string }
    | /** SQL object already exists */
      { reason: 'SQL_OBJECT_ALREADY_EXISTS', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string, 
        objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'sequence' | 'database', 
        schemaName?: string, tableName?: string, columnName?: string, objectName?: string }

    /* ********************************************************************************************
     * SQL execution: Errors caused by the provided input or by the operation being executed
     */
    
    | /** Division by zero reported by the database */
      { reason: 'SQL_DIVISION_BY_ZERO', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }
    | /** The SQL operation expected a different number of rows or matches, like a scalar subquery returning multiple rows */
      { reason: 'SQL_CARDINALITY_VIOLATION', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }
    | /** Invalid SQL parameter binding or parameter reference reported by the database */
      { reason: 'SQL_INVALID_PARAMETER', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }
    | /** Invalid on conflict or merge conflict target reported by the database */
      { reason: 'SQL_INVALID_CONFLICT_TARGET', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }
    | /** The query references an ambiguous column or object name */
      { reason: 'SQL_AMBIGUOUS_IDENTIFIER', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string, 
        identifier?: string }

    /* ********************************************************************************************
     * SQL execution: Errors caused by misuse, transactions, connections, or runtime concurrency conditions
     */

    | /** SQL syntax error reported by the database */
      { reason: 'SQL_SYNTAX_ERROR', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }
    | /** Permission denied while executing the SQL statement */
      { reason: 'SQL_PERMISSION_DENIED', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }
    | /** Deadlock detected by the database */
      { reason: 'SQL_DEADLOCK_DETECTED', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }
    | /** SQL operation timed out or was cancelled; use timeoutType when the specific kind is known */
      { reason: 'SQL_TIMEOUT', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string, 
        timeoutType?: 'connection' | 'database file busy' | 'lock' | 'statement' | 'transaction' | 'idle transaction' | 'cancelled' }
    | /** Transaction serialization failure */
      { reason: 'SQL_SERIALIZATION_FAILURE', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }
    | /** The current transaction is aborted and no further SQL statements can be executed until it ends */
      { reason: 'SQL_TRANSACTION_ABORTED', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }
    | /** The SQL operation is not allowed because the connection, session, transaction, or database is read-only */
      { reason: 'SQL_READ_ONLY_VIOLATION', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }
    | /** Connection or pool infrastructure error while acquiring or using a database connection, excluding resource exhaustion cases */
      { reason: 'SQL_CONNECTION_ERROR', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string, 
        errorType?: 'connection lost' | 'temporarily unavailable' | 'invalid connection configuration' | 'pool error' }
    | /** Authentication failed while connecting to the database */
      { reason: 'SQL_AUTHENTICATION_ERROR', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }
    | /** Authorization failed while accessing the database, schema, or other SQL resources */
      { reason: 'SQL_AUTHORIZATION_ERROR', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }
    | /** A database or connection/pool capacity limit was reached while executing the SQL statement */
      { reason: 'SQL_RESOURCE_LIMIT_REACHED', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string, 
        resourceType?: 'disk' | 'memory' | 'temp space' | 'connections' | 'pool' | 'cpu' }
    | /** The database reported that the requested SQL feature is not supported */
      { reason: 'SQL_FEATURE_NOT_SUPPORTED', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }

    /* ********************************************************************************************
     * SQL execution: Unknown or uncategorized SQL error
     */
    
    | /** Unknown SQL error reported by the database */
      { reason: 'SQL_UNKNOWN', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorMessage?: string }

    /* ********************************************************************************************
     * Dynamic condition generation 
     */

    | /** The provided dynamic condition doesn't match the expected type */
      { reason: 'DYNAMIC_CONDITION_INVALID_FILTER', value: unknown, path: string }
    | /** The extension to the dynamic condition didn't return the expected type */
      { reason: 'DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE', 
        processedValue: unknown, returnedValue: unknown, returnedTypeName?: string, 
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
    | /** The same column name appears several times where it is not expected to be repeated, 
          like the returned select columns alias */
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
    | /** You performed a real async operation (not a synchronous database call) 
          inside a function meant to execute synchronous database queries. */
      { reason: 'SYNCHRONOUS_PROSIME_EXPECTED' }

    /* ********************************************************************************************
     * Unknown error
     */

    | /** Unknown error */
      { reason: 'UNKNOWN' }

/**
 * Base class of all errors returned by ts-sql-query.
 */
export class TsSqlError extends Error {
    /** Identifies the error category and provides additional details about what went wrong. */
    errorReason: TsSqlErrorReason

    constructor(errorReason: TsSqlErrorReason, message: string)
    constructor(errorReason: TsSqlErrorReason, message: string, cause: unknown)
    constructor(errorReason: TsSqlErrorReason, messageOrCause: unknown)
    constructor(errorReason: TsSqlErrorReason, message: string | unknown, cause?: unknown) {
        if (message instanceof Error) {
            super(errorReason.reason + ': ' + message.message, { cause })
        }   else if (typeof message === 'string') {
            super(errorReason.reason + ': ' + message, { cause })
        } else {
            super(errorReason.reason, { cause });
        }

        this.name = "TsSqlError"

        Object.defineProperty(this, 'errorReason', {
            value: errorReason,
            writable: true,
            enumerable: false,
            configurable: true
        })
        this.errorReason = errorReason
    }
}

/**
 * Error thrown during the execution of a query.
 * 
 * Note: This error always wraps any TsSqlProcessingError
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
    constructor(source: QueryExecutionSource, errorReason: TsSqlErrorReason, message: string | unknown, cause?: unknown) {
        super(errorReason, message as any, cause)

        Object.defineProperty(this, 'source', {
            value: source,
            writable: true,
            enumerable: false,
            configurable: true
        })
        this.source = source
        this.stack = this.stack + '\nSource: ' + source.stack

        this.name = "TsSqlQueryExecutionError"
    }

    attachTransactionSource(source: QueryExecutionSource): this {
        Object.defineProperty(this, 'transactionSource', {
            value: source,
            writable: true,
            enumerable: false,
            configurable: true
        })
        this.transactionSource = source
        this.stack = this.stack + '\nTransaction source: ' + source.stack
        return this
    }

    attachRollbackError(error: unknown): this {
        Object.defineProperty(this, 'rollbackError', {
            value: error,
            writable: true,
            enumerable: false,
            configurable: true
        })
        this.rollbackError = error
        if (error instanceof Error) {
            this.stack = this.stack + '\nRollback error: ' + error.stack
        } else {
            this.stack = this.stack + '\nRollback error: ' + error
        }
        return this
    }

    attachTransactionError(error: unknown): this {
        Object.defineProperty(this, 'transactionError', {
            value: error,
            writable: true,
            enumerable: false,
            configurable: true
        })
        this.transactionError = error
        if (error instanceof Error) {
            this.stack = this.stack + '\nTransaction error: ' + error.stack
        } else {
            this.stack = this.stack + '\nTransaction error: ' + error
        }
        return this
    }

    attachAdditionalError(additional: unknown, name: string): this {
        let additionalErrors: Array<unknown> | undefined = this.additionalErrors
        if (!additionalErrors) {
            additionalErrors = []
            Object.defineProperty(this, 'additionalErrors', {
                value: additionalErrors,
                writable: true,
                enumerable: false,
                configurable: true
            })
            this.additionalErrors = additionalErrors
        }
        additionalErrors.push(additional)
        if (additional instanceof Error) {
            this.stack = this.stack + '\n-------------------------------------------------------------\n'
                + 'An additional error happens during the ' + name +  ' processing in another handler.\n'
                + 'Additional error: ' + additional.stack
        } else {
            this.stack = this.stack + '\n-------------------------------------------------------------\n'
                + 'An additional error happens during the ' + name +  ' processing in another handler.\n'
                + 'Additional error: ' + additional
        }
        return this
    }
}

/**
 * Collect information where the query was requested to be executed (the causality chain).
 * 
 * Note: This is not used as an error, only as a marker to collect the call stack.
 */
export class QueryExecutionSource extends Error {
    constructor(message: string) {
        super(message)
        this.stack = this.stack?.substring('Error: '.length)
        this.name = "QueryExecutionSource"
    }
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
    constructor(errorReason: TsSqlErrorReason, message: string | unknown, cause?: unknown) {
        super(errorReason, message as any, cause)
        this.name = "TsSqlProcessingError"
    }
}
