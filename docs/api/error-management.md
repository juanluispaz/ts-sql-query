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

For SQL and related driver or transaction errors, the reason can also include `databaseErrorCode`, preserving the original code reported by the database, driver, or pool implementation, and `databaseErrorMessage`, preserving the original message when available.

SQL error reasons prioritize the portable semantics of the failure over the database mechanism that produced it. For example, a trigger or foreign data wrapper can still produce a constraint, object, value, connection, or invalid-query error; use `databaseErrorCode`, `databaseErrorMessage`, and the native error available as `cause` when you need engine-specific detail.

`QueryExecutionSource` is a helper error type used to capture where query execution was requested, making the execution stack trace and causality chain easier to understand.

To access these types, import them as follows:

```ts
import { TsSqlError, TsSqlProcessingError, TsSqlQueryExecutionError, TsSqlErrorReason, TsSqlInternalErrorReason } from "ts-sql-query/TsSqlError";
```

## TsSqlErrorReason type

```ts
/**
 * Reason of the errors thrown by ts-sql-query
 */
export type TsSqlDatabaseErrorCode = string
export type TsSqlDatabaseErrorNumber = string | number

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

    | /** Transactional error reported by the database, driver, or transaction engine */
      { reason: 'TRANSACTION_ERROR',
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string,
        transactionErrorType?:     'invalid state' | 'aborted' | 'active transaction' |
          'serialization failure' | 'deadlock' | 'transaction rolled back' |
          'outcome unknown' | 'invalid savepoint' | 'unsupported operation'
      }
    | /** You are trying to start a transaction when there is a transaction already opened */
      { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }
    | /** You are trying to perform an action that required to be in a transaction (like commit), 
          but there is no open transaction */
      { reason: 'NOT_IN_TRANSACTION', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }
    | /** You are trying to call a defer in transaction inside another defer in transaction */
      { reason: 'NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED' }
    | /** Error executing a defer in transaction. 
          Note: all errors thrown in a defer in transaction will always be wrapped in a TsSqlQueryExecutionError */
      { reason: 'ERROR_EXECUTING_DEFERRED_IN_TRANSACTION', 
        fn: () => void | Promise<void>, index: number, 
        deferredType: 'before next commit' | 'after next commit' | 'after next rollback' }
    | /** Low-level transaction not supported by the provided query runner */ 
      { reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED',
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }
    | /** Specified transaction level not supported in the current database (like using a low-level query runner) */ 
      { reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: string | undefined,
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }
    | /** Specified transaction access mode not supported in the current database (like using a low-level query runner) */ 
      { reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode: string | undefined,
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }

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
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }
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
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string, 
        constraintType?: 'unique' | 'not null' | 'foreign key' | 'check' | 'exclusion' | 'restrict', 
        constraintName?: string, tableName?: string, columnName?: string }
    | /** The value sent to the database is not valid for the target SQL type, expression, or column */
      { reason: 'SQL_INVALID_VALUE', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string, 
        errorType?: 'out of range' | 'too long' | 'invalid value' | 'invalid format' | 'invalid encoding' | 
            'invalid json' | 'invalid xml' | 'invalid regular expression' | 'null not allowed' | 'sequence limit', 
        tableName?: string, columnName?: string, typeName?: string }

    /* ********************************************************************************************
     * SQL execution: Environment or deployment problems caused by discrepancies with the database model
     */

    | /** SQL object referenced by the query was not found */
      { reason: 'SQL_OBJECT_NOT_FOUND', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string, 
        objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'sequence' | 'database' | 'collation' | 
            'index' | 'trigger' | 'cursor' | 'prepared statement' | 'role', 
        schemaName?: string, tableName?: string, columnName?: string, objectName?: string }
    | /** SQL object already exists */
      { reason: 'SQL_OBJECT_ALREADY_EXISTS', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string, 
        objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'sequence' | 'database' | 
            'index' | 'trigger' | 'cursor' | 'prepared statement', 
        schemaName?: string, tableName?: string, columnName?: string, objectName?: string }

    /* ********************************************************************************************
     * SQL execution: Errors caused by the provided input or by the operation being executed
     */
    
    | /** Division by zero reported by the database */
      { reason: 'SQL_DIVISION_BY_ZERO', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }
    | /** The SQL operation expected a different number of rows or matches, like a scalar subquery returning multiple rows */
      { reason: 'SQL_CARDINALITY_VIOLATION', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }
    | /** Invalid SQL parameter binding or parameter reference reported by the database */
      { reason: 'SQL_INVALID_PARAMETER', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string,
        parameterErrorType?: 'missing' | 'too many' | 'wrong count' | 'invalid name' | 'invalid index' |
            'invalid type' | 'invalid value' | 'invalid binding' | 'not bindable' | 'already bound',
        parameterName?: string, parameterIndex?: number, expectedParameterCount?: number, actualParameterCount?: number }
    | /** The query references an ambiguous column or object name */
      { reason: 'SQL_AMBIGUOUS_IDENTIFIER', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string, 
        identifier?: string,
        identifierType?: 'column' | 'routine' | 'parameter' | 'alias' | 'object',
        identifierErrorType?: 'ambiguous' | 'duplicate' }
    | /** The SQL statement is semantically invalid, excluding syntax, permission, object, parameter, constraint, and value errors */
      { reason: 'SQL_INVALID_SQL_STATEMENT',
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string,
        statementErrorType?: 'incomplete statement' | 'invalid definition' | 'type mismatch' | 'invalid statement context' |
            'invalid identifier' | 'invalid reference' | 'invalid grouping' | 'invalid windowing' | 'invalid recursion' |
            'invalid locator' | 'case not found' | 'invalid argument' }

    /* ********************************************************************************************
     * SQL execution: Errors caused by misuse, transactions, connections, or runtime concurrency conditions
     */

    | /** SQL syntax error reported by the database */
      { reason: 'SQL_SYNTAX_ERROR', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }
    | /** Permission denied while executing the SQL statement */
      { reason: 'SQL_PERMISSION_DENIED', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }
    | /** SQL operation timed out or was cancelled; use timeoutType when the specific kind is known */
      { reason: 'SQL_TIMEOUT', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string, 
        timeoutType?: 'connection' | 'database file busy' | 'lock' | 'statement' | 'transaction' | 'idle transaction' | 'cancelled' }
    | /** The SQL operation is not allowed because the connection, session, database, or storage is read-only */
      { reason: 'SQL_READ_ONLY_VIOLATION', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }
    | /** Connection or pool infrastructure error while acquiring or using a database connection, excluding resource exhaustion cases */
      { reason: 'SQL_CONNECTION_ERROR', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string, 
        errorType?: 'connection lost' | 'temporarily unavailable' | 'invalid connection configuration' | 'pool error' }
    | /** Low-level database file or virtual filesystem I/O error */
      { reason: 'SQL_IO_ERROR',
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string,
        ioErrorType?: 'read' | 'write' | 'fsync' | 'truncate' | 'file stat' | 'lock' | 'unlock' | 'delete' | 'file not found' | 
            'access' | 'shared memory' | 'seek' | 'mmap' | 'path' | 'atomic write' | 'close' | 'reserved extension' | 'unknown' }
    | /** SQL routine or external routine failed while executing */
      { reason: 'SQL_ROUTINE_ERROR',
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }
    | /** SQL object exists but cannot be used in its current state or due to dependencies */
      { reason: 'SQL_OBJECT_STATE_ERROR',
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string,
        objectStateErrorType?: 'dependent objects still exist' | 'object in use' | 'invalid state' | 'wrong object type',
        objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'sequence' | 'database' | 'collation' | 
            'index' | 'trigger' | 'cursor' | 'prepared statement' | 'role',
        schemaName?: string, tableName?: string, columnName?: string, objectName?: string }
    | /** Database or session configuration error */
      { reason: 'SQL_CONFIGURATION_ERROR',
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string,
        configurationErrorType?: 'configuration file' | 'lock file' | 'runtime parameter' }
    | /** External or remote SQL data source error that cannot be more specifically classified */
      { reason: 'SQL_EXTERNAL_DATA_SOURCE_ERROR',
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }
    | /** Authentication failed while connecting to the database */
      { reason: 'SQL_AUTHENTICATION_ERROR', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }
    | /** Authorization failed while accessing the database, schema, or other SQL resources */
      { reason: 'SQL_AUTHORIZATION_ERROR', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }
    | /** A database or connection/pool capacity limit was reached while executing the SQL statement */
      { reason: 'SQL_RESOURCE_LIMIT_REACHED', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string, 
        resourceType?: 'disk' | 'memory' | 'temp space' | 'connections' | 'pool' | 'cpu' | 'file size' }
    | /** The database reported that the requested SQL feature is not supported */
      { reason: 'SQL_FEATURE_NOT_SUPPORTED', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }
    | /** The database reported corrupted database, index, or storage content */
      { reason: 'SQL_DATABASE_CORRUPTED',
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string,
        corruptionType?: 'database file' | 'index' | 'sequence' | 'virtual table' | 'filesystem' | 'checksum' }
    | /** Internal database engine condition or driver API misuse */
      { reason: 'SQL_INTERNAL_ERROR',
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string,
        errorType?: 'engine internal' | 'api misuse' }

    /* ********************************************************************************************
     * SQL execution: Unknown or uncategorized SQL error
     */
    
    | /** Unknown SQL error reported by the database */
      { reason: 'SQL_UNKNOWN', 
        databaseErrorCode?: TsSqlDatabaseErrorCode, databaseErrorNumber?: TsSqlDatabaseErrorNumber, databaseErrorMessage?: string }

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

    | TsSqlInternalErrorReason

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
 * Internal error produced by ts-sql-query when one of its own invariants is broken.
 */
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

<!--
## Mapping table conventions

Internal note for future maintenance of the mapping tables.
Keep this section commented so it is available to maintainers but not rendered in the docs.

Connector link inventory to reuse in future edits:

Native query runner and driver links:

- [@electric-sql/pglite](https://www.npmjs.com/package/@electric-sql/pglite)
- [better-sqlite3](https://www.npmjs.com/package/better-sqlite3)
- [Bun SQL](https://bun.com/docs/api/sql)
- [bun:sqlite](https://bun.com/docs/api/sqlite)
- [mariadb](https://www.npmjs.com/package/mariadb)
- [mssql](https://www.npmjs.com/package/mssql)
- [mysql2](https://www.npmjs.com/package/mysql2)
- [node:sqlite](https://nodejs.org/api/sqlite.html)
- [oracledb](https://www.npmjs.com/package/oracledb)
- [pg](https://www.npmjs.com/package/pg)
- [postgres.js](https://github.com/porsager/postgres)
- [sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm)
- [sqlite3](https://www.npmjs.com/package/sqlite3)

Supporting pool or driver internals that can surface mapped errors:

- [tarn](https://www.npmjs.com/package/tarn)

Prisma runner links, for the experimental Prisma runner only:

- [@prisma/adapter-better-sqlite3](https://www.npmjs.com/package/@prisma/adapter-better-sqlite3)
- [@prisma/adapter-mariadb](https://www.npmjs.com/package/@prisma/adapter-mariadb)
- [@prisma/adapter-mssql](https://www.npmjs.com/package/@prisma/adapter-mssql)
- [@prisma/adapter-pg](https://www.npmjs.com/package/@prisma/adapter-pg)
- [Prisma Client](https://www.npmjs.com/package/@prisma/client)

Current table structure:

- The mappings are documented using one tab per database family:
  - MariaDB
  - MySQL
  - Oracle
  - PostgreSQL
  - SQLite
  - SQL Server
- Prisma is intentionally excluded from these tables because its mapping is based on Prisma `Pxxxx` errors rather than native database errors.
- Each tab contains one table with these columns:
  - `Category`
  - `Reason`
  - `Error code`
  - `Filled fields`

Reason column rules:

- If a case has a subtype, it is embedded inside the `Reason` cell in three lines:
  1. the reason name
  2. the subtype property name in bold
  3. the subtype value in monospace
- If a case has no subtype, the `Reason` cell contains only the reason.
- `SQL_UNKNOWN` should always use category `Unknown` and be the last row of every tab.

Error code column rules:

- The `Error code` column must be specific to the selected database tab.
- Only the actual code goes in monospace.
- The meaning stays in normal text, using the format:
  - `CODE`: meaning
- If the signal comes from a connector, pool, or driver rather than the database engine, append the connector name inline in parentheses on that same line:
  - `UNDEFINED_VALUE` ([postgres.js](https://github.com/porsager/postgres)): undefined value
  - `ETIMEDOUT` ([pg](https://www.npmjs.com/package/pg)): connector timeout
  - `POOL_ENQUEUELIMIT` ([mysql2](https://www.npmjs.com/package/mysql2)): queue limit reached
  - `NJS-040` ([oracledb](https://www.npmjs.com/package/oracledb)): connection request timeout
- Do not use footnotes for connector names.
- For long textual messages that are not exact stable codes, do not wrap the message in monospace. This allows line wrapping and keeps the table readable.

SQLite-specific formatting:

- In SQLite rows, show the textual SQLite code in monospace and the numeric code in plain text using:
  - `SQLITE_IOERR_CORRUPTFS`: 8458
- Do not use parentheses for the numeric SQLite code inside the table, because it becomes visually confusing with other parenthetical notes.
- If a SQLite row includes connector-specific textual messages, list them as normal text and add the connector name inline in parentheses when applicable:
  - DATABASE IS CLOSED ([sqlite3](https://www.npmjs.com/package/sqlite3))
  - MISSING NAMED PARAMETERS ([better-sqlite3](https://www.npmjs.com/package/better-sqlite3))
  - INVALID BIND() PARAMETER NAME ([sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm))

Filled fields column rules:

- `Filled fields` must be specific to the selected database tab and the specific row.
- List only fields that are actually populated by the implementation for that database and that case.
- If a field is not reliably populated in that row, omit it instead of documenting it generically.
- If a field is only populated for coded cases or only when a database code is present, make that explicit with wording such as:
  - `databaseErrorCode` for coded cases
  - `databaseErrorMessage`
- Prefer precision over symmetry between tabs.

Content rules:

- Each row should reflect what is actually implemented in the corresponding query runner(s), not what the database could theoretically report.
- When a database tab represents more than one connector possibility, include connector-specific signals from any supported connector that can be used with that database.
  - Example: MariaDB and MySQL tabs include both [mariadb](https://www.npmjs.com/package/mariadb) and [mysql2](https://www.npmjs.com/package/mysql2) connector-specific signals where applicable.
- If a case depends on message inspection in addition to the error code, describe that in the meaning text only when it materially affects interpretation.
- Avoid documenting speculative or merely possible codes that are not mapped in the implementation.

Validation checklist when editing:

1. Compare the table row against the actual query runner implementation.
2. Confirm the category and reason match the current code.
3. Confirm every documented code is really mapped.
4. Confirm important implemented codes are not missing.
5. Confirm `Filled fields` matches the exact properties currently returned.
6. Confirm connector-origin signals include the connector name as a link inline in parentheses.
7. Confirm `SQL_UNKNOWN` remains the last row in the tab.
-->

## Implemented database mappings

The tables below are rebuilt from the production mappers and query runners in `src`. They cover the native database families only; Prisma is intentionally not folded into these tabs because Prisma exposes its own `Pxxxx` error space and is mapped separately by the Prisma query runners.

Every tab uses the same canonical row catalog and row order. A `-` means the current production mapping does not implement that semantic case for that database family. When a mapper covers a large error-code family, the cell names the implemented family and shows representative exact codes or ranges from the production code instead of duplicating every member of long constant sets.

=== "MariaDB"

    | Category | Reason | Error code | Filled fields |
    | --- | --- | --- | --- |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`unique` | `1022`, `1062`, `1169`, `1557`, `1586`, `1761`, `1762`, `1859` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`not null` | `1048`, `3673` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`foreign key` | `1216`, `1217`, `1451`, `1452`, `3008` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`check` | `3819`, `4025` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`exclusion` | - | - |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`restrict` | - | - |
    | Constraints | `SQL_CONSTRAINT_VIOLATED` | server constraint sets above | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`too long` | `1162`, `1406`, `1917`, `3046`, `3056`, `3150`, `3151`, `3718`, `3907`, `4159`, `4160`, `4203` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`out of range` | `1264`, `1690`, `1916`, `3020`, `3048`-`3051`, `3155`, `3669`, `3706`, `3737`-`3740`, `4103`, `4105`, `4106`, `4124`-`4127`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_PARSING_PRECISION` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid value` | `1292`, `1366`, `1367`, `1411`, `1416`, `2032`, MariaDB `1918`, `3033`-`3042`, `4054`, `4055`, `4066`, `4070`, `4078`, `4079`, `4101`, `4102`, `4104`, `4153`, `4163`, `4164`, `4193`; [Bun SQL](https://bun.sh/docs/api/sql) bind/type messages | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid format` | MariaDB `1919`, `1921`, `1958`, `3020`, `3055`, `4098`, `4204`, `4205` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid encoding` | MariaDB `1922`, `1977` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid json` | `3140`, `3141`, `3144`-`3147`, `3156`-`3158`, `3853`, `3903`, `3966`, `3967`, `4035`-`4039`, `4041`, `4042`, `4044`-`4046`, `4048`-`4051`, `4076`, `4176`, `4178`, `4179`, `4186`, `4193` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid xml` | - | - |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid regular expression` | `1139` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`null not allowed` | `1138`, `1263` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`sequence limit` | MariaDB `4084` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`missing` | `1210`, `1230`, `2031`, `45016`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_MISSING_PARAMETER`, `ER_MISSING_SQL_PARAMETER`, `ER_MISSING_DATABASE_PARAMETER` | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`too many` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`wrong count` | `1318`, `1582`-`1584`; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_MYSQL_WRONG_NUMBER_OF_PARAMETERS_PROVIDED` | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid name` | `1107`, `1108`, `1277`, `1330`-`1333`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_PARAMETER_UNDEFINED`, `ER_PLACEHOLDER_UNDEFINED` | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid index` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid type` | `1231`, `1232`, `2033`-`2036`, `2060`; [Bun SQL](https://bun.sh/docs/api/sql) bind type messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid value` | `1414`, `1758`, `1912`, `2072`, `4080`, `4187`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_BAD_PARAMETER_VALUE`, `ER_UNDEFINED_SQL` | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid binding` | [mysql2](https://github.com/sidorares/node-mysql2) bind parameter messages; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_MYSQL_INVALID_QUERY_BINDING`, `ERR_MYSQL_NOT_TAGGED_CALL` | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`not bindable` | [Bun SQL](https://bun.sh/docs/api/sql) simple query parameter message | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`already bound` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER` | server invalid-parameter sets; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs), [mysql2](https://github.com/sidorares/node-mysql2), and [Bun SQL](https://bun.sh/docs/api/sql) parameter signals | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`database` | `1008`, `1046`, `1049`, `3503` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`schema` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`table or view` | `1051`, `1109`, `1146`, `1932`, `4092` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`column` | `1054`, `1072`, `4082` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`routine` | `1106`, `1122`, `1128`, `1305`, `1630`, `4095`, `4096` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`sequence` | MariaDB `4091` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`collation` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`index` | `1091`, `1176`, `1191`, `4206`, `4222` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`trigger` | MariaDB `3011`, `4031` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`cursor` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`prepared statement` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`role` | MariaDB `1976` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`database` | `1007` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`schema` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`table or view` | `1050` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`column` | `1060`, `1110` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`routine` | `1125`, `1304` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`sequence` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`index` | `1061` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`trigger` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`cursor` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`prepared statement` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS` | MariaDB `1934`, `1968`, `1973`, `1975` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`invalid state` | `1325`, `1326`, MariaDB `1924`, `4087`, `4135`, `4145`-`4149`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_PREPARE_CLOSED` | `objectStateErrorType`<br>`objectType` when inferred<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`wrong object type` | MariaDB `1965`, `4089`, `4090`, `4124` | `objectStateErrorType`<br>`objectType` when inferred<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`object in use` | - | - |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`dependent objects still exist` | - | - |
    | Statement | `SQL_SYNTAX_ERROR` | `1064`, `1149` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_AMBIGUOUS_IDENTIFIER`<br>**identifierErrorType**<br>`ambiguous` | `1052`, `1066` | `identifier` when inferred<br>`identifierType` when inferred<br>`identifierErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_AMBIGUOUS_IDENTIFIER`<br>**identifierErrorType**<br>`duplicate` | MariaDB `4004`, `4010`, `4134`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_DUPLICATE_FIELD` | `identifier` when inferred<br>`identifierType` when inferred<br>`identifierErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`incomplete statement` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid definition` | `1005`, `1063`, `1067`, `1071`, `1075`, `1078`, `1089`, `1101`, `1170`, `1171`, `1239`, `1435`, `1901`-`1906`, `4030`, `4117`, `4118`, `4154`, `4155`, `4210`-`4219` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`type mismatch` | `1241`, `1242`, `1295`, `1337`, `1908`, `1913`, `3025`, `4021`, `4072`, `4130` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid statement context` | `1090`, `1096`, `1175`, `1192`, `1204`, `1221`, `1225`, `1228`, `1229`, `1233`, `1234`, `1243`, `1313`, `1324`, `1923`, `1930`, `1933`, `1954`, `3004`, `3016`, `4001`, `4105`, `4106`, `4116`, `4119`, `4121`, `4122`, `4140`-`4144`, `4158`, `4172`, `4177`, `4180`, `4196`, `4224` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid identifier` | `1059`, `1102`, `1103`, `1166`, `1280`, `1281`, `1308`-`1310`, `1458`, `3057`, `4081`, `4083`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_NULL_ESCAPEID`, `ER_NULL_CHAR_ESCAPEID`, `ER_PRIVATE_FIELDS_USE` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid reference` | `1093`, `1240`, `1247`, `1250`, `1980`, `4007`, `4029`, `4100`, `4129`, `4156`, `4221` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid grouping` | `1055`, `1056`, `1057`, `1111`, `1140`, `1463`, `1981`, `3028`, `3029`, `4074` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid windowing` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid recursion` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid locator` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`case not found` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid argument` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT` | statement fallback from `1064`, `1149` and mapped statement sets | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_DIVISION_BY_ZERO` | `1365` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_CARDINALITY_VIOLATION` | `1241`, `1242` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_ROUTINE_ERROR` | routine/server procedure error sets, including `1305`, `1318`, MariaDB `3052`, `3053`, `4027`, `4028`, `4183` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`invalid state` | `1179`, `1192`, `1568`, `1929`, `1953`, `4059`; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_MYSQL_INVALID_TRANSACTION_STATE` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`aborted` | - | - |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`active transaction` | `1179`, `1192`, `1568`, `1929`, `1953`, `4059` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`serialization failure` | - | - |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`deadlock` | `1213`, `1614` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`transaction rolled back` | `1180`, `1181`, `1196`, `1402`, `1964`, `3101`, `4060` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`outcome unknown` | MariaDB `4173` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`invalid savepoint` | - | - |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`unsupported operation` | [Bun SQL](https://bun.sh/docs/api/sql) `ERR_MYSQL_UNSAFE_TRANSACTION` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `NOT_IN_TRANSACTION` | raised directly by ts-sql-query transaction state checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `NESTED_TRANSACTION_NOT_SUPPORTED` | raised directly by ts-sql-query nested transaction checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `FORBIDDEN_CONCURRENT_USAGE` | raised directly by query-runner concurrent usage checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `TRANSACTION_LEVEL_NOT_SUPPORTED` | raised directly by query runners that reject the isolation level | `transactionLevel` |
    | Transactions | `TRANSACTION_ACCESS_MODE_NOT_SUPPORTED` | raised directly by query runners that reject the transaction access mode | `accessMode` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`connection` | `1159`, `1161`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) connection/socket/ping timeout codes; [mysql2](https://github.com/sidorares/node-mysql2) `PROTOCOL_SEQUENCE_TIMEOUT`; [Bun SQL](https://bun.sh/docs/api/sql) connection/idle/lifetime timeout codes; `ETIMEDOUT`, `ESOCKETTIMEDOUT` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`lock` | - | - |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`statement` | - | - |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`transaction` | `1205`, `1613`, `3058` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`idle transaction` | - | - |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`cancelled` | [Bun SQL](https://bun.sh/docs/api/sql) `ERR_MYSQL_QUERY_CANCELLED` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`database file busy` | - | - |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`connection lost` | server connection-lost sets, client codes `2001`-`2007`, `2009`, `2012`, `2013`, `2016`-`2018`, `2024`-`2027`, `2038`-`2047`, `2055`, `2064`, `2066`, `2070`, `2075`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) socket/closed codes; [mysql2](https://github.com/sidorares/node-mysql2) `PROTOCOL_CONNECTION_LOST`; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_MYSQL_CONNECTION_CLOSED`; network `ECONNRESET`, `EPIPE`, `ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`, `EHOSTUNREACH`, `ENETUNREACH` | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`temporarily unavailable` | [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_POOL_NO_CONNECTION`; [mysql2](https://github.com/sidorares/node-mysql2) `POOL_NONEONLINE` | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`invalid connection configuration` | auth/TLS/config server sets; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) SSL/TLS/auth plugin codes; [mysql2](https://github.com/sidorares/node-mysql2) handshake/TLS/plugin codes; [Bun SQL](https://bun.sh/docs/api/sql) protocol/TLS messages | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`pool error` | [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) pool closed/not-initialized codes; [mysql2](https://github.com/sidorares/node-mysql2) pool closed / `POOL_NOEXIST` | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`memory` | `5`, `34`, `1037`, `1038`, `1041`, `1119`, `1135`, `1206`, `1257`, `2008`, `3015`, `3044` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`disk` | `20`, `35`, `1114`, `1197`, `3019`, `4139` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`temp space` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`connections` | `1040`, `1203` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`pool` | [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_GET_CONNECTION_TIMEOUT`; [mysql2](https://github.com/sidorares/node-mysql2) no-connection/queue-limit messages | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`cpu` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`file size` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED` | `23`, `1104`, `1116`-`1118`, `1197`, `1206`, `1226`, `1258`, `1437`, `1461`, `1920`, `2020`, `4003`, `4026`, `4040`, `4043`, `4075`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_MAX_ALLOWED_PACKET`; [Bun SQL](https://bun.sh/docs/api/sql) query-too-long message | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_AUTHENTICATION_ERROR` | `1045`, `1698`, `1873`, `2049`, `2059`, `2061`, `2067`, `4150`; [Bun SQL](https://bun.sh/docs/api/sql) auth/password/plugin codes | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_AUTHORIZATION_ERROR` | `1044`, `1130` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_PERMISSION_DENIED` | `1095`, `1142`-`1144`, `1211`, `1227`, `1269`, `1370`, `1403`, `1410`, `1961`, `1962`, `1979`, `2068`, `3059`, `4151`, `4166`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_LOCAL_INFILE_DISABLED` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_READ_ONLY_VIOLATION` | `1036`, `1099`, `1207`, `1223`, `1792` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`configuration file` | - | - |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`lock file` | - | - |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`runtime parameter` | server configuration set including `22`, `47`-`49`, `51`-`54`, `59`, `60`, `63`-`65`, `67`-`79`, `84`, `1193`, `1238`, `1273`, `1284`, `1286`, `1911`, `2019`, `2028`, `2074`, `3003`, `3009`, `3027`, `4065`, `4133`, `4167`, `4182`, `4185`, `4201`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) session/timezone/initial SQL driver codes | `configurationErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | I/O | `SQL_IO_ERROR`<br>**ioErrorType**<br>`read`, `write`, `fsync`, `truncate`, `file stat`, `lock`, `unlock`, `delete`, `file not found`, `access`, `shared memory`, `seek`, `mmap`, `path`, `atomic write`, `close`, `reserved extension`, `unknown` | engine I/O code groups `1`-`17`, `24`-`33`, `1004`, `1006`, `1010`, `1013`, `1015`, `1017`, `1018`, `1024`-`1026`, `1085`, `1086`, `2063`, `2069`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) local infile / SQL file codes | `ioErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | External | `SQL_EXTERNAL_DATA_SOURCE_ERROR` | MariaDB external-source/routine sets including `3052`, `3053`, `4027`, `4028`, `4183` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Features | `SQL_FEATURE_NOT_SUPPORTED` | feature-not-supported server set including `1112`, `1115`, `1148`, `1163`, `1235`, `1312`, `1314`, `1415`, `1460`, `1845`, `1846`, `1907`, `1910`, `1925`, `1970`, `1971`, `2054`, `2065`, `3005`, `3012`, `3031`, `3060`, `4000`, `4022`, `4032`, `4033`, `4047`, `4053`, `4057`, `4061`-`4063`, `4069`, `4077`, `4111`, `4120`, `4132`, `4137`, `4138`, `4165`, `4184`, `4194`, `4195`, `4223`; driver unsupported-feature signals | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Corruption | `SQL_DATABASE_CORRUPTED`<br>**corruptionType**<br>`database file`, `index`, `sequence`, `virtual table`, `filesystem`, `checksum` | `1033`-`1035`, `1194`, `1195`, `1244`, `1256`, `1259`, `1712`, `3000`, `4064`; MariaDB sequence corruption `4085`, `4086` | `corruptionType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Internal | `SQL_INTERNAL_ERROR`<br>**errorType**<br>`engine internal` | client API/internal sets including `2014`, `2029`, `2030`, `2048`, `2050`-`2053`, `2056`-`2058`, `2062`, `2071`, `2073`; driver packet/protocol internals | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Internal | `SQL_INTERNAL_ERROR`<br>**errorType**<br>`api misuse` | [mysql2](https://github.com/sidorares/node-mysql2) and [Bun SQL](https://bun.sh/docs/api/sql) API misuse messages | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Fallback | `SQL_UNKNOWN` | unmapped engine errors; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_MYSQL_UNKNOWN_ERROR` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
=== "MySQL"

    | Category | Reason | Error code | Filled fields |
    | --- | --- | --- | --- |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`unique` | `1022`, `1062`, `1169`, `1557`, `1586`, `1761`, `1762`, `1859` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`not null` | `1048`, `3673` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`foreign key` | `1216`, `1217`, `1451`, `1452`, `3008` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`check` | `3819`, `4025` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`exclusion` | - | - |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`restrict` | - | - |
    | Constraints | `SQL_CONSTRAINT_VIOLATED` | server constraint sets above | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`too long` | `1162`, `1406`, `1917`, `3046`, `3056`, `3150`, `3151`, `3718`, `3907`, `4159`, `4160`, `4203` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`out of range` | `1264`, `1690`, `1916`, `3020`, `3048`-`3051`, `3155`, `3669`, `3706`, `3737`-`3740`, `4103`, `4105`, `4106`, `4124`-`4127`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_PARSING_PRECISION` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid value` | `1292`, `1366`, `1367`, `1411`, `1416`, `2032`, MariaDB `1918`, `3033`-`3042`, `4054`, `4055`, `4066`, `4070`, `4078`, `4079`, `4101`, `4102`, `4104`, `4153`, `4163`, `4164`, `4193`; [Bun SQL](https://bun.sh/docs/api/sql) bind/type messages | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid format` | MariaDB `1919`, `1921`, `1958`, `3020`, `3055`, `4098`, `4204`, `4205` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid encoding` | MariaDB `1922`, `1977` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid json` | `3140`, `3141`, `3144`-`3147`, `3156`-`3158`, `3853`, `3903`, `3966`, `3967`, `4035`-`4039`, `4041`, `4042`, `4044`-`4046`, `4048`-`4051`, `4076`, `4176`, `4178`, `4179`, `4186`, `4193` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid xml` | - | - |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid regular expression` | `1139` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`null not allowed` | `1138`, `1263` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`sequence limit` | MariaDB `4084` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`missing` | `1210`, `1230`, `2031`, `45016`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_MISSING_PARAMETER`, `ER_MISSING_SQL_PARAMETER`, `ER_MISSING_DATABASE_PARAMETER` | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`too many` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`wrong count` | `1318`, `1582`-`1584`; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_MYSQL_WRONG_NUMBER_OF_PARAMETERS_PROVIDED` | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid name` | `1107`, `1108`, `1277`, `1330`-`1333`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_PARAMETER_UNDEFINED`, `ER_PLACEHOLDER_UNDEFINED` | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid index` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid type` | `1231`, `1232`, `2033`-`2036`, `2060`; [Bun SQL](https://bun.sh/docs/api/sql) bind type messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid value` | `1414`, `1758`, `1912`, `2072`, `4080`, `4187`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_BAD_PARAMETER_VALUE`, `ER_UNDEFINED_SQL` | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid binding` | [mysql2](https://github.com/sidorares/node-mysql2) bind parameter messages; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_MYSQL_INVALID_QUERY_BINDING`, `ERR_MYSQL_NOT_TAGGED_CALL` | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`not bindable` | [Bun SQL](https://bun.sh/docs/api/sql) simple query parameter message | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`already bound` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER` | server invalid-parameter sets; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs), [mysql2](https://github.com/sidorares/node-mysql2), and [Bun SQL](https://bun.sh/docs/api/sql) parameter signals | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`database` | `1008`, `1046`, `1049`, `3503` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`schema` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`table or view` | `1051`, `1109`, `1146`, `1932`, `4092` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`column` | `1054`, `1072`, `4082` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`routine` | `1106`, `1122`, `1128`, `1305`, `1630`, `4095`, `4096` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`sequence` | MariaDB `4091` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`collation` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`index` | `1091`, `1176`, `1191`, `4206`, `4222` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`trigger` | MariaDB `3011`, `4031` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`cursor` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`prepared statement` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`role` | MariaDB `1976` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`database` | `1007` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`schema` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`table or view` | `1050` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`column` | `1060`, `1110` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`routine` | `1125`, `1304` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`sequence` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`index` | `1061` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`trigger` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`cursor` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`prepared statement` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS` | MariaDB `1934`, `1968`, `1973`, `1975` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`invalid state` | `1325`, `1326`, MariaDB `1924`, `4087`, `4135`, `4145`-`4149`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_PREPARE_CLOSED` | `objectStateErrorType`<br>`objectType` when inferred<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`wrong object type` | MariaDB `1965`, `4089`, `4090`, `4124` | `objectStateErrorType`<br>`objectType` when inferred<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`object in use` | - | - |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`dependent objects still exist` | - | - |
    | Statement | `SQL_SYNTAX_ERROR` | `1064`, `1149` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_AMBIGUOUS_IDENTIFIER`<br>**identifierErrorType**<br>`ambiguous` | `1052`, `1066` | `identifier` when inferred<br>`identifierType` when inferred<br>`identifierErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_AMBIGUOUS_IDENTIFIER`<br>**identifierErrorType**<br>`duplicate` | MariaDB `4004`, `4010`, `4134`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_DUPLICATE_FIELD` | `identifier` when inferred<br>`identifierType` when inferred<br>`identifierErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`incomplete statement` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid definition` | `1005`, `1063`, `1067`, `1071`, `1075`, `1078`, `1089`, `1101`, `1170`, `1171`, `1239`, `1435`, `1901`-`1906`, `4030`, `4117`, `4118`, `4154`, `4155`, `4210`-`4219` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`type mismatch` | `1241`, `1242`, `1295`, `1337`, `1908`, `1913`, `3025`, `4021`, `4072`, `4130` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid statement context` | `1090`, `1096`, `1175`, `1192`, `1204`, `1221`, `1225`, `1228`, `1229`, `1233`, `1234`, `1243`, `1313`, `1324`, `1923`, `1930`, `1933`, `1954`, `3004`, `3016`, `4001`, `4105`, `4106`, `4116`, `4119`, `4121`, `4122`, `4140`-`4144`, `4158`, `4172`, `4177`, `4180`, `4196`, `4224` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid identifier` | `1059`, `1102`, `1103`, `1166`, `1280`, `1281`, `1308`-`1310`, `1458`, `3057`, `4081`, `4083`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_NULL_ESCAPEID`, `ER_NULL_CHAR_ESCAPEID`, `ER_PRIVATE_FIELDS_USE` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid reference` | `1093`, `1240`, `1247`, `1250`, `1980`, `4007`, `4029`, `4100`, `4129`, `4156`, `4221` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid grouping` | `1055`, `1056`, `1057`, `1111`, `1140`, `1463`, `1981`, `3028`, `3029`, `4074` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid windowing` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid recursion` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid locator` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`case not found` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid argument` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT` | statement fallback from `1064`, `1149` and mapped statement sets | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_DIVISION_BY_ZERO` | `1365` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_CARDINALITY_VIOLATION` | `1241`, `1242` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_ROUTINE_ERROR` | routine/server procedure error sets, including `1305`, `1318`, MariaDB `3052`, `3053`, `4027`, `4028`, `4183` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`invalid state` | `1179`, `1192`, `1568`, `1929`, `1953`, `4059`; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_MYSQL_INVALID_TRANSACTION_STATE` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`aborted` | - | - |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`active transaction` | `1179`, `1192`, `1568`, `1929`, `1953`, `4059` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`serialization failure` | - | - |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`deadlock` | `1213`, `1614` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`transaction rolled back` | `1180`, `1181`, `1196`, `1402`, `1964`, `3101`, `4060` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`outcome unknown` | MariaDB `4173` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`invalid savepoint` | - | - |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`unsupported operation` | [Bun SQL](https://bun.sh/docs/api/sql) `ERR_MYSQL_UNSAFE_TRANSACTION` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `NOT_IN_TRANSACTION` | raised directly by ts-sql-query transaction state checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `NESTED_TRANSACTION_NOT_SUPPORTED` | raised directly by ts-sql-query nested transaction checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `FORBIDDEN_CONCURRENT_USAGE` | raised directly by query-runner concurrent usage checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `TRANSACTION_LEVEL_NOT_SUPPORTED` | raised directly by query runners that reject the isolation level | `transactionLevel` |
    | Transactions | `TRANSACTION_ACCESS_MODE_NOT_SUPPORTED` | raised directly by query runners that reject the transaction access mode | `accessMode` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`connection` | `1159`, `1161`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) connection/socket/ping timeout codes; [mysql2](https://github.com/sidorares/node-mysql2) `PROTOCOL_SEQUENCE_TIMEOUT`; [Bun SQL](https://bun.sh/docs/api/sql) connection/idle/lifetime timeout codes; `ETIMEDOUT`, `ESOCKETTIMEDOUT` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`lock` | - | - |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`statement` | - | - |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`transaction` | `1205`, `1613`, `3058` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`idle transaction` | - | - |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`cancelled` | [Bun SQL](https://bun.sh/docs/api/sql) `ERR_MYSQL_QUERY_CANCELLED` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`database file busy` | - | - |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`connection lost` | server connection-lost sets, client codes `2001`-`2007`, `2009`, `2012`, `2013`, `2016`-`2018`, `2024`-`2027`, `2038`-`2047`, `2055`, `2064`, `2066`, `2070`, `2075`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) socket/closed codes; [mysql2](https://github.com/sidorares/node-mysql2) `PROTOCOL_CONNECTION_LOST`; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_MYSQL_CONNECTION_CLOSED`; network `ECONNRESET`, `EPIPE`, `ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`, `EHOSTUNREACH`, `ENETUNREACH` | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`temporarily unavailable` | [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_POOL_NO_CONNECTION`; [mysql2](https://github.com/sidorares/node-mysql2) `POOL_NONEONLINE` | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`invalid connection configuration` | auth/TLS/config server sets; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) SSL/TLS/auth plugin codes; [mysql2](https://github.com/sidorares/node-mysql2) handshake/TLS/plugin codes; [Bun SQL](https://bun.sh/docs/api/sql) protocol/TLS messages | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`pool error` | [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) pool closed/not-initialized codes; [mysql2](https://github.com/sidorares/node-mysql2) pool closed / `POOL_NOEXIST` | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`memory` | `5`, `34`, `1037`, `1038`, `1041`, `1119`, `1135`, `1206`, `1257`, `2008`, `3015`, `3044` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`disk` | `20`, `35`, `1114`, `1197`, `3019`, `4139` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`temp space` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`connections` | `1040`, `1203` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`pool` | [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_GET_CONNECTION_TIMEOUT`; [mysql2](https://github.com/sidorares/node-mysql2) no-connection/queue-limit messages | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`cpu` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`file size` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED` | `23`, `1104`, `1116`-`1118`, `1197`, `1206`, `1226`, `1258`, `1437`, `1461`, `1920`, `2020`, `4003`, `4026`, `4040`, `4043`, `4075`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_MAX_ALLOWED_PACKET`; [Bun SQL](https://bun.sh/docs/api/sql) query-too-long message | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_AUTHENTICATION_ERROR` | `1045`, `1698`, `1873`, `2049`, `2059`, `2061`, `2067`, `4150`; [Bun SQL](https://bun.sh/docs/api/sql) auth/password/plugin codes | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_AUTHORIZATION_ERROR` | `1044`, `1130` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_PERMISSION_DENIED` | `1095`, `1142`-`1144`, `1211`, `1227`, `1269`, `1370`, `1403`, `1410`, `1961`, `1962`, `1979`, `2068`, `3059`, `4151`, `4166`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) `ER_LOCAL_INFILE_DISABLED` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_READ_ONLY_VIOLATION` | `1036`, `1099`, `1207`, `1223`, `1792` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`configuration file` | - | - |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`lock file` | - | - |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`runtime parameter` | server configuration set including `22`, `47`-`49`, `51`-`54`, `59`, `60`, `63`-`65`, `67`-`79`, `84`, `1193`, `1238`, `1273`, `1284`, `1286`, `1911`, `2019`, `2028`, `2074`, `3003`, `3009`, `3027`, `4065`, `4133`, `4167`, `4182`, `4185`, `4201`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) session/timezone/initial SQL driver codes | `configurationErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | I/O | `SQL_IO_ERROR`<br>**ioErrorType**<br>`read`, `write`, `fsync`, `truncate`, `file stat`, `lock`, `unlock`, `delete`, `file not found`, `access`, `shared memory`, `seek`, `mmap`, `path`, `atomic write`, `close`, `reserved extension`, `unknown` | engine I/O code groups `1`-`17`, `24`-`33`, `1004`, `1006`, `1010`, `1013`, `1015`, `1017`, `1018`, `1024`-`1026`, `1085`, `1086`, `2063`, `2069`; [mariadb](https://github.com/mariadb-corporation/mariadb-connector-nodejs) local infile / SQL file codes | `ioErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | External | `SQL_EXTERNAL_DATA_SOURCE_ERROR` | MariaDB external-source/routine sets including `3052`, `3053`, `4027`, `4028`, `4183` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Features | `SQL_FEATURE_NOT_SUPPORTED` | feature-not-supported server set including `1112`, `1115`, `1148`, `1163`, `1235`, `1312`, `1314`, `1415`, `1460`, `1845`, `1846`, `1907`, `1910`, `1925`, `1970`, `1971`, `2054`, `2065`, `3005`, `3012`, `3031`, `3060`, `4000`, `4022`, `4032`, `4033`, `4047`, `4053`, `4057`, `4061`-`4063`, `4069`, `4077`, `4111`, `4120`, `4132`, `4137`, `4138`, `4165`, `4184`, `4194`, `4195`, `4223`; driver unsupported-feature signals | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Corruption | `SQL_DATABASE_CORRUPTED`<br>**corruptionType**<br>`database file`, `index`, `sequence`, `virtual table`, `filesystem`, `checksum` | `1033`-`1035`, `1194`, `1195`, `1244`, `1256`, `1259`, `1712`, `3000`, `4064`; MariaDB sequence corruption `4085`, `4086` | `corruptionType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Internal | `SQL_INTERNAL_ERROR`<br>**errorType**<br>`engine internal` | client API/internal sets including `2014`, `2029`, `2030`, `2048`, `2050`-`2053`, `2056`-`2058`, `2062`, `2071`, `2073`; driver packet/protocol internals | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Internal | `SQL_INTERNAL_ERROR`<br>**errorType**<br>`api misuse` | [mysql2](https://github.com/sidorares/node-mysql2) and [Bun SQL](https://bun.sh/docs/api/sql) API misuse messages | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Fallback | `SQL_UNKNOWN` | unmapped engine errors; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_MYSQL_UNKNOWN_ERROR` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
=== "Oracle"

    | Category | Reason | Error code | Filled fields |
    | --- | --- | --- | --- |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`unique` | `ORA-00001` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`not null` | `ORA-01400`, `ORA-01407` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`foreign key` | `ORA-02291`, `ORA-02292` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`check` | `ORA-02290` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`exclusion` | - | - |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`restrict` | - | - |
    | Constraints | `SQL_CONSTRAINT_VIOLATED` | constraint cases above | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`too long` | `ORA-01401`, `ORA-12899` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`out of range` | `ORA-01426`, `ORA-01438`, `ORA-01455`, `ORA-01841`, `ORA-01847`, `ORA-01850`, `ORA-01851`, `ORA-01852`, `ORA-01888`; [node-oracledb](https://github.com/oracle/node-oracledb) range/value `DPI-*` messages | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid value` | `ORA-01722`, `ORA-01843`, `ORA-01882`; [node-oracledb](https://github.com/oracle/node-oracledb) invalid value `NJS-*` / `DPI-*` code set | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid format` | `ORA-01830`, `ORA-01840`, `ORA-01858`, `ORA-01861` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid encoding` | - | - |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid json` | `ORA-40441`, `ORA-40587` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid xml` | `ORA-31011`, `ORA-31013` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid regular expression` | `ORA-12725`-`ORA-12733` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`null not allowed` | - | - |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`sequence limit` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`missing` | `ORA-01008`; [node-oracledb](https://github.com/oracle/node-oracledb) missing bind/argument codes | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`too many` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`wrong count` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid name` | `ORA-01006`, `ORA-01036`; [node-oracledb](https://github.com/oracle/node-oracledb) bind-name codes | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid index` | `OCI-22165` | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid type` | [node-oracledb](https://github.com/oracle/node-oracledb) invalid bind type `NJS-*` / `DPI-*` codes | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid value` | [node-oracledb](https://github.com/oracle/node-oracledb) invalid argument/bind value `NJS-*` / `DPI-*` codes | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid binding` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`not bindable` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`already bound` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER` | `ORA-01006`, `ORA-01008`, `ORA-01036`; [node-oracledb](https://github.com/oracle/node-oracledb) invalid parameter code set | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`database` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`schema` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`table or view` | `ORA-00942` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`column` | `ORA-00904`; [node-oracledb](https://github.com/oracle/node-oracledb) `DPI-1022` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`routine` | `ORA-04043`; [node-oracledb](https://github.com/oracle/node-oracledb) `NJS-169`, `NJS-700` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`sequence` | `ORA-02289` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`collation` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`index` | `ORA-01418` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`trigger` | `ORA-04080` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`cursor` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`prepared statement` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`role` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND` | `ORA-04043`; `OCI-22303` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`database` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`schema` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`table or view` | `ORA-00955` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`column` | `ORA-01430` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`routine` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`sequence` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`index` | `ORA-01408` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`trigger` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`cursor` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`prepared statement` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS` | `ORA-00955`, `ORA-02264` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`invalid state` | `ORA-04063`, `ORA-04098`, `ORA-06575`; [node-oracledb](https://github.com/oracle/node-oracledb) invalid state `NJS-*` / `DPI-*` codes | `objectStateErrorType`<br>`objectType` when inferred<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`wrong object type` | - | - |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`object in use` | - | - |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`dependent objects still exist` | - | - |
    | Statement | `SQL_SYNTAX_ERROR` | `ORA-00900`, `ORA-00905`, `ORA-00906`, `ORA-00907`, `ORA-00911`, `ORA-00917`, `ORA-00923`, `ORA-00933`, `ORA-00936`, `ORA-01756`, `ORA-06550` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_AMBIGUOUS_IDENTIFIER`<br>**identifierErrorType**<br>`ambiguous` | `ORA-00918` | `identifier` when inferred<br>`identifierType` when inferred<br>`identifierErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_AMBIGUOUS_IDENTIFIER`<br>**identifierErrorType**<br>`duplicate` | `ORA-00957` | `identifier` when inferred<br>`identifierType` when inferred<br>`identifierErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`incomplete statement` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid definition` | `ORA-02264`, `ORA-04063`, `ORA-04098` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`type mismatch` | `ORA-00932`, `ORA-01790` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid statement context` | [node-oracledb](https://github.com/oracle/node-oracledb) `NJS-019`, `NJS-095`, `NJS-157`, `DPI-1007`, `DPI-1063`, `DPI-1087` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid identifier` | `ORA-00972` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid reference` | `ORA-01789` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid grouping` | `ORA-00934`, `ORA-00937`, `ORA-00979` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid windowing` | `ORA-30483`, `ORA-30484` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid recursion` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid locator` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`case not found` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid argument` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT` | syntax/statement cases above | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_DIVISION_BY_ZERO` | `ORA-01476` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_CARDINALITY_VIOLATION` | `ORA-01422`, `ORA-01427` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_ROUTINE_ERROR` | `ORA-06550` with `PLS-` message, `ORA-06575` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`invalid state` | `ORA-01453`; [node-oracledb](https://github.com/oracle/node-oracledb) `NJS-170` and default `TransactionError` state | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`aborted` | - | - |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`active transaction` | [node-oracledb](https://github.com/oracle/node-oracledb) `NJS-171` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`serialization failure` | `ORA-08177` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`deadlock` | `ORA-00060` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`transaction rolled back` | `ORA-02050`, `ORA-02055` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`outcome unknown` | `ORA-02054` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`invalid savepoint` | `ORA-01086` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`unsupported operation` | - | - |
    | Transactions | `NOT_IN_TRANSACTION` | [node-oracledb](https://github.com/oracle/node-oracledb) `NJS-172` and direct transaction state checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `NESTED_TRANSACTION_NOT_SUPPORTED` | raised directly by ts-sql-query nested transaction checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `FORBIDDEN_CONCURRENT_USAGE` | raised directly by query-runner concurrent usage checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `TRANSACTION_LEVEL_NOT_SUPPORTED` | raised directly by query runners that reject the isolation level | `transactionLevel` |
    | Transactions | `TRANSACTION_ACCESS_MODE_NOT_SUPPORTED` | raised directly by query runners that reject the transaction access mode | `accessMode` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`connection` | `ORA-12170`, `ORA-12535`; [node-oracledb](https://github.com/oracle/node-oracledb) `NJS-040`, `NJS-510`, `ETIMEDOUT`, `ESOCKETTIMEDOUT` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`lock` | `ORA-00054`, `ORA-02049`, `ORA-04021`, `ORA-30006` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`statement` | [node-oracledb](https://github.com/oracle/node-oracledb) `NJS-123`, `DPI-1067` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`transaction` | - | - |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`idle transaction` | - | - |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`cancelled` | `ORA-01013` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`database file busy` | - | - |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`connection lost` | `ORA-01012`, `ORA-03113`, `ORA-03114`, `ORA-03135`, `ORA-12537`; [node-oracledb](https://github.com/oracle/node-oracledb) closed/socket codes, `ECONNRESET`, `EPIPE` | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`temporarily unavailable` | `ORA-01033`, `ORA-01034`, `ORA-01089`, `ORA-12528`, `ORA-12541`, `ORA-12543`; [node-oracledb](https://github.com/oracle/node-oracledb) `NJS-503`, `NJS-504`, `NJS-511`, `ECONNREFUSED`, `EHOSTUNREACH`, `ENETUNREACH` | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`invalid connection configuration` | `ORA-12154`, `ORA-12505`, `ORA-12514`, `ORA-12545`; [node-oracledb](https://github.com/oracle/node-oracledb) config/TNS/TLS codes, `ENOTFOUND`, `EAI_AGAIN` | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`pool error` | [node-oracledb](https://github.com/oracle/node-oracledb) pool `NJS-*` / `DPI-1011` codes | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`memory` | `ORA-04030`, `ORA-04031`; [node-oracledb](https://github.com/oracle/node-oracledb) `NJS-024`, `DPI-1001` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`disk` | `ORA-01653`, `ORA-01654`, `ORA-01658`, `ORA-01688` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`temp space` | `ORA-01652`, `ORA-30036` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`connections` | `ORA-00018`, `ORA-00020`, `ORA-12516`, `ORA-12519`, `ORA-12520` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`pool` | [node-oracledb](https://github.com/oracle/node-oracledb) `NJS-076` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`cpu` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`file size` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED` | `ORA-01000` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_AUTHENTICATION_ERROR` | `ORA-01017`, `ORA-28000`, `ORA-28001`; [node-oracledb](https://github.com/oracle/node-oracledb) auth codes | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_AUTHORIZATION_ERROR` | `ORA-01045` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_PERMISSION_DENIED` | `ORA-01031` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_READ_ONLY_VIOLATION` | `ORA-01456`, `ORA-16000` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`configuration file` | - | - |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`lock file` | - | - |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`runtime parameter` | [node-oracledb](https://github.com/oracle/node-oracledb) `NJS-069`, `DPI-1052`, `DPI-1065` | `configurationErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | I/O | `SQL_IO_ERROR`<br>**ioErrorType**<br>`read`, `write`, `fsync`, `truncate`, `file stat`, `lock`, `unlock`, `delete`, `file not found`, `access`, `shared memory`, `seek`, `mmap`, `path`, `atomic write`, `close`, `reserved extension`, `unknown` | [node-oracledb](https://github.com/oracle/node-oracledb) `DPI-1075` | `ioErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | External | `SQL_EXTERNAL_DATA_SOURCE_ERROR` | `ORA-02063`, `ORA-02068`, `ORA-28500` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Features | `SQL_FEATURE_NOT_SUPPORTED` | `ORA-03001`, `ORA-00439`, `ORA-22816`, `ORA-32034`; [node-oracledb](https://github.com/oracle/node-oracledb) unsupported-feature codes, `OCI-22164` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Corruption | `SQL_DATABASE_CORRUPTED`<br>**corruptionType**<br>`database file`, `index`, `sequence`, `virtual table`, `filesystem`, `checksum` | `ORA-01578`, `ORA-08102` | `corruptionType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Internal | `SQL_INTERNAL_ERROR`<br>**errorType**<br>`engine internal` | `ORA-00600`, `ORA-00603`, `ORA-01041`, `ORA-07445` | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Internal | `SQL_INTERNAL_ERROR`<br>**errorType**<br>`api misuse` | [node-oracledb](https://github.com/oracle/node-oracledb) API misuse `NJS-*` / `DPI-*` codes | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Fallback | `SQL_UNKNOWN` | unmapped engine/driver errors; `ORA-20000`-`ORA-20999` application errors | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
=== "PostgreSQL"

    | Category | Reason | Error code | Filled fields |
    | --- | --- | --- | --- |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`unique` | SQLSTATE `23505` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`not null` | SQLSTATE `23502` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`foreign key` | SQLSTATE `23503` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`check` | SQLSTATE `23514`, `44000` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`exclusion` | SQLSTATE `23P01` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`restrict` | SQLSTATE `23001` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED` | SQLSTATE `23000`, `40002`, class `23` fallback | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`too long` | SQLSTATE `22001`, `22026`, `58P03` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`out of range` | SQLSTATE `22003`, `22008`, `22015`, `22022`; [Bun SQL](https://bun.sh/docs/api/sql) integer overflow codes | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid value` | SQLSTATE class `22` fallback; [Bun SQL](https://bun.sh/docs/api/sql) invalid character/value codes; [@electric-sql/pglite](https://github.com/electric-sql/pglite) invalid input messages | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid format` | SQLSTATE `22005`-`22007`, `22009`, `2200B`, `2200F`, `2200G`, `22018`, `22019`, `2201E`, `2201F`, `2201G`, `2201W`, `2201X`, `2202E`; [Bun SQL](https://bun.sh/docs/api/sql) invalid binary/time/numeric/format codes | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid encoding` | SQLSTATE `22021`, `22P05`; [Bun SQL](https://bun.sh/docs/api/sql) invalid byte sequence code | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid json` | SQLSTATE `22030`-`2203G` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid xml` | SQLSTATE `2200L`, `2200M`, `2200N`, `2200S`, `2200T` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid regular expression` | SQLSTATE `2201B` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`null not allowed` | SQLSTATE `22002`, `22004`, `39004` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`sequence limit` | SQLSTATE `2200H` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`missing` | [pg](https://github.com/brianc/node-postgres) `08P01` bind/no-parameter messages; [postgres.js](https://github.com/porsager/postgres) missing publication message; [@electric-sql/pglite](https://github.com/electric-sql/pglite) missing key messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`too many` | [postgres.js](https://github.com/porsager/postgres) `MAX_PARAMETERS_EXCEEDED`; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_POSTGRES_TOO_MANY_PARAMETERS` | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`wrong count` | [@electric-sql/pglite](https://github.com/electric-sql/pglite) offset/limit argument-count messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid name` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid index` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid type` | [@electric-sql/pglite](https://github.com/electric-sql/pglite) option type messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid value` | [postgres.js](https://github.com/porsager/postgres) `UNDEFINED_VALUE` / malformed subscribe message; [@electric-sql/pglite](https://github.com/electric-sql/pglite) invalid option value messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid binding` | [postgres.js](https://github.com/porsager/postgres) `NOT_TAGGED_CALL`; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_POSTGRES_INVALID_QUERY_BINDING`, `ERR_POSTGRES_NOT_TAGGED_CALL`; [@electric-sql/pglite](https://github.com/electric-sql/pglite) key/binding messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`not bindable` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`already bound` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER` | SQLSTATE `08P01` bind messages, `HV002`, `HV008` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`database` | SQLSTATE `3D000` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`schema` | SQLSTATE `3F000`, `HV00Q` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`table or view` | SQLSTATE `42P01`, `HV00R` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`column` | SQLSTATE `42703`, `HV005`, `HV007` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`routine` | SQLSTATE `42883`, `P0001`, `P0002`, `P0004` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`sequence` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`collation` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`index` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`trigger` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`cursor` | SQLSTATE `34000` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`prepared statement` | SQLSTATE `26000` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`role` | SQLSTATE `0P000` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND` | SQLSTATE `42704` with object-type inference | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`database` | SQLSTATE `42P04` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`schema` | SQLSTATE `42P06` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`table or view` | SQLSTATE `42P07` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`column` | SQLSTATE `42701` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`routine` | SQLSTATE `42723` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`sequence` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`index` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`trigger` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`cursor` | SQLSTATE `42P03` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`prepared statement` | SQLSTATE `42P05` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS` | SQLSTATE `42710` with object-type inference | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`invalid state` | SQLSTATE `24000`, `55000`, `55P04`; [@electric-sql/pglite](https://github.com/electric-sql/pglite) closed transaction/live query messages | `objectStateErrorType`<br>`objectType` when inferred<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`wrong object type` | SQLSTATE `42809` | `objectStateErrorType`<br>`objectType` when inferred<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`object in use` | SQLSTATE `55006` | `objectStateErrorType`<br>`objectType` when inferred<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`dependent objects still exist` | SQLSTATE `2B000`, `2BP01` | `objectStateErrorType`<br>`objectType` when inferred<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_SYNTAX_ERROR` | SQLSTATE `42601` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_AMBIGUOUS_IDENTIFIER`<br>**identifierErrorType**<br>`ambiguous` | SQLSTATE `42702`, `42725`, `42P08`, `42P09` | `identifier` when inferred<br>`identifierType` when inferred<br>`identifierErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_AMBIGUOUS_IDENTIFIER`<br>**identifierErrorType**<br>`duplicate` | SQLSTATE `42712` | `identifier` when inferred<br>`identifierType` when inferred<br>`identifierErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`incomplete statement` | SQLSTATE `03000`, class `03` fallback | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid definition` | SQLSTATE `42P11`, `42830`, `42611`, `42P12`-`42P17`, `428C9` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`type mismatch` | SQLSTATE `42846`, `42804`, `42P18`, `42P21`, `42P22` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid statement context` | SQLSTATE class `09`, `42000` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid identifier` | SQLSTATE `42602`, `42622`, `42939` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid reference` | SQLSTATE `42P10` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid grouping` | SQLSTATE `42803` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid windowing` | SQLSTATE `42P20` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid recursion` | SQLSTATE `42P19` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid locator` | SQLSTATE class `0F` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`case not found` | SQLSTATE class `20` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid argument` | SQLSTATE class `10` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT` | SQLSTATE class `42` fallback, including `42000` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_DIVISION_BY_ZERO` | SQLSTATE `22012` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_CARDINALITY_VIOLATION` | SQLSTATE `21000`, `P0003` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_ROUTINE_ERROR` | SQLSTATE `P0001`, `P0002`, `P0004` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`invalid state` | SQLSTATE `0B000`, `25000`, `2D000`, class `25` fallback; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_POSTGRES_INVALID_TRANSACTION_STATE`; [@electric-sql/pglite](https://github.com/electric-sql/pglite) closed transaction message | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`aborted` | SQLSTATE `25P02` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`active transaction` | SQLSTATE `25001`, `25002` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`serialization failure` | SQLSTATE `40001` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`deadlock` | SQLSTATE `40P01` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`transaction rolled back` | SQLSTATE `40000`, class `40` fallback | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`outcome unknown` | SQLSTATE `08007`, `40003` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`invalid savepoint` | SQLSTATE `3B000`, `3B001`, class `3B` fallback | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`unsupported operation` | SQLSTATE `25007`; [postgres.js](https://github.com/porsager/postgres) `UNSAFE_TRANSACTION`; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_POSTGRES_UNSAFE_TRANSACTION` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `NOT_IN_TRANSACTION` | SQLSTATE `25P01` and direct transaction state checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `NESTED_TRANSACTION_NOT_SUPPORTED` | raised directly by ts-sql-query nested transaction checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `FORBIDDEN_CONCURRENT_USAGE` | raised directly by query-runner concurrent usage checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `TRANSACTION_LEVEL_NOT_SUPPORTED` | SQLSTATE `25004`, `25008`; direct isolation-level rejection | `transactionLevel` when available<br>`databaseErrorCode` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ACCESS_MODE_NOT_SUPPORTED` | SQLSTATE `25003`; direct access-mode rejection | `accessMode` when available<br>`databaseErrorCode` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`connection` | [pg](https://github.com/brianc/node-postgres) timeout network codes; [postgres.js](https://github.com/porsager/postgres) `CONNECT_TIMEOUT`; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_POSTGRES_CONNECTION_TIMEOUT` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`lock` | SQLSTATE `55P03` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`statement` | SQLSTATE `57014` unless cancellation message | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`transaction` | SQLSTATE `25P04` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`idle transaction` | SQLSTATE `25P03` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`cancelled` | SQLSTATE `57014` with cancellation message; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_POSTGRES_QUERY_CANCELLED` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`database file busy` | - | - |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`connection lost` | SQLSTATE class `08`, `08P01` without bind message, `57000`, `57P01`, `57P02`, `57P05`, class `57` fallback; [pg](https://github.com/brianc/node-postgres), [postgres.js](https://github.com/porsager/postgres), [Bun SQL](https://bun.sh/docs/api/sql), and [@electric-sql/pglite](https://github.com/electric-sql/pglite) closed/terminated signals | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`temporarily unavailable` | SQLSTATE `57P03`, `HV00N` | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`invalid connection configuration` | SQLSTATE `57P04`; TLS/SSL config signals from [pg](https://github.com/brianc/node-postgres), [postgres.js](https://github.com/porsager/postgres), [Bun SQL](https://bun.sh/docs/api/sql) | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`pool error` | [pg](https://github.com/brianc/node-postgres) pool closed/ending messages | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`memory` | SQLSTATE `53200`, `HV001` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`disk` | SQLSTATE `53100` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`temp space` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`connections` | SQLSTATE `53300` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`pool` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`cpu` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`file size` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED` | SQLSTATE `53000`, `53400`, `54000`, `54001`, `54011`, `54023`, classes `53` and `54` fallback | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_AUTHENTICATION_ERROR` | SQLSTATE `28P01` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_AUTHORIZATION_ERROR` | SQLSTATE `0L000`, `0LP01`, `28000` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_PERMISSION_DENIED` | SQLSTATE `42501` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_READ_ONLY_VIOLATION` | - | - |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`configuration file` | SQLSTATE `F0000` | `configurationErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`lock file` | SQLSTATE `F0001` | `configurationErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`runtime parameter` | SQLSTATE `55P02`; [@electric-sql/pglite](https://github.com/electric-sql/pglite) dataDir/FS/bundle/config messages | `configurationErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | I/O | `SQL_IO_ERROR`<br>**ioErrorType**<br>`read`, `write`, `fsync`, `truncate`, `file stat`, `lock`, `unlock`, `delete`, `file not found`, `access`, `shared memory`, `seek`, `mmap`, `path`, `atomic write`, `close`, `reserved extension`, `unknown` | SQLSTATE `58P01`, `58030`, `58P02`, class `58` fallback; [@electric-sql/pglite](https://github.com/electric-sql/pglite) `/dev/blob` read/seek messages | `ioErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | External | `SQL_EXTERNAL_DATA_SOURCE_ERROR` | SQLSTATE class `HV` fallback | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Features | `SQL_FEATURE_NOT_SUPPORTED` | SQLSTATE `0A000`; [postgres.js](https://github.com/porsager/postgres) `MESSAGE_NOT_SUPPORTED`; [Bun SQL](https://bun.sh/docs/api/sql) unsupported type codes; [@electric-sql/pglite](https://github.com/electric-sql/pglite) compression message | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Corruption | `SQL_DATABASE_CORRUPTED`<br>**corruptionType**<br>`database file`, `index`, `sequence`, `virtual table`, `filesystem`, `checksum` | SQLSTATE `XX001`, `XX002` | `corruptionType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Internal | `SQL_INTERNAL_ERROR`<br>**errorType**<br>`engine internal` | SQLSTATE `00000`, classes `01`, `02`, `XX000`; driver backend/internal signals | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Internal | `SQL_INTERNAL_ERROR`<br>**errorType**<br>`api misuse` | [postgres.js](https://github.com/porsager/postgres) API misuse message; [@electric-sql/pglite](https://github.com/electric-sql/pglite) live query inactive message | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Fallback | `SQL_UNKNOWN` | unmapped SQLSTATEs; [pg](https://github.com/brianc/node-postgres) `ERROR:`, `FATAL:`, `PANIC:` fallback; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_POSTGRES_SERVER_ERROR` fallback | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
=== "SQLite"

    | Category | Reason | Error code | Filled fields |
    | --- | --- | --- | --- |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`unique` | `SQLITE_CONSTRAINT_UNIQUE: 2067`, `SQLITE_CONSTRAINT_PRIMARYKEY: 1555`, `SQLITE_CONSTRAINT_ROWID: 2579`; unique constraint messages | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`not null` | `SQLITE_CONSTRAINT_NOTNULL: 1299`; NOT NULL messages | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`foreign key` | `SQLITE_CONSTRAINT_FOREIGNKEY: 787`; foreign key messages | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`check` | `SQLITE_CONSTRAINT_CHECK: 275`; CHECK messages | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`exclusion` | - | - |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`restrict` | - | - |
    | Constraints | `SQL_CONSTRAINT_VIOLATED` | `SQLITE_CONSTRAINT: 19`, `SQLITE_CONSTRAINT_COMMITHOOK: 531`, `SQLITE_CONSTRAINT_FUNCTION: 1043`, `SQLITE_CONSTRAINT_TRIGGER: 1811`, `SQLITE_CONSTRAINT_VTAB: 2323`, `SQLITE_CONSTRAINT_PINNED: 2835` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`too long` | `SQLITE_TOOBIG: 18`; [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) string/blob too big messages | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`out of range` | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), [bun:sqlite](https://bun.sh/docs/api/sqlite), [node:sqlite](https://nodejs.org/api/sqlite.html), and [sqlite-wasm](https://sqlite.org/wasm/doc/trunk/index.md) integer/bigint range messages | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid value` | `SQLITE_MISMATCH: 20`, `SQLITE_CONSTRAINT_DATATYPE: 3091`; datatype mismatch / invalid input messages | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid format` | - | - |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid encoding` | - | - |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid json` | - | - |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid xml` | - | - |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid regular expression` | - | - |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`null not allowed` | - | - |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`sequence limit` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`missing` | missing parameter messages; [node:sqlite](https://nodejs.org/api/sqlite.html) missing option/key messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`too many` | too many SQL variables / parameter messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`wrong count` | wrong number/count of bind parameters messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid name` | unknown named parameter messages; [node:sqlite](https://nodejs.org/api/sqlite.html) `ERR_INVALID_STATE` unknown named parameter | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid index` | `SQLITE_RANGE: 25`; column/parameter index messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid type` | [node:sqlite](https://nodejs.org/api/sqlite.html) `ERR_INVALID_ARG_TYPE`; [sqlite3](https://github.com/TryGhost/node-sqlite3) data type not supported message | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid value` | invalid bind parameter value messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid binding` | binding failure messages; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_SQLITE_NOT_TAGGED_CALL` | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`not bindable` | parameters are not allowed/not bindable messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`already bound` | already bound parameter messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER` | fallback SQLite bind parameter messages | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`database` | unknown database message | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`schema` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`table or view` | no such table message | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`column` | no such column message | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`routine` | no such function / user-defined function message | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`sequence` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`collation` | `SQLITE_ERROR_MISSING_COLLSEQ: 257`; no such collation sequence message | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`index` | no such index message | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`trigger` | no such trigger message | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`cursor` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`prepared statement` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`role` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`database` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`schema` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`table or view` | table or view already exists message | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`column` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`routine` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`sequence` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`index` | index already exists message | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`trigger` | trigger already exists message | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`cursor` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`prepared statement` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS` | - | - |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`invalid state` | `SQLITE_ERROR_SNAPSHOT: 513`, `SQLITE_SCHEMA: 17`; statement/database finalized, closed, busy, or invalidated messages | `objectStateErrorType`<br>`objectType` when inferred<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`wrong object type` | wrong object type messages for view/table operations | `objectStateErrorType`<br>`objectType` when inferred<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`object in use` | - | - |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`dependent objects still exist` | - | - |
    | Statement | `SQL_SYNTAX_ERROR` | syntax error / incomplete input / unrecognized token messages; `SQLITE_ERROR: 1` when syntax-like | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_AMBIGUOUS_IDENTIFIER`<br>**identifierErrorType**<br>`ambiguous` | ambiguous column name message | `identifier` when inferred<br>`identifierType` when inferred<br>`identifierErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_AMBIGUOUS_IDENTIFIER`<br>**identifierErrorType**<br>`duplicate` | duplicate column name message | `identifier` when inferred<br>`identifierType` when inferred<br>`identifierErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`incomplete statement` | incomplete input message | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid definition` | foreign key mismatch / malformed schema definition messages | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`type mismatch` | datatype mismatch message | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid statement context` | statement not allowed in current SQLite context messages | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid identifier` | invalid identifier/name messages | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid reference` | ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid grouping` | aggregate/grouping misuse messages | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid windowing` | window-function misuse messages | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid recursion` | recursive query misuse messages | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid locator` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`case not found` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid argument` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT` | `SQLITE_ERROR: 1` fallback | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_DIVISION_BY_ZERO` | - | - |
    | Execution | `SQL_CARDINALITY_VIOLATION` | sub-select returns too many columns message | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_ROUTINE_ERROR` | user-defined function raised exception message | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`invalid state` | `SQLITE_ERROR_SNAPSHOT: 513`; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_SQLITE_INVALID_TRANSACTION_STATE` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`aborted` | `SQLITE_ABORT_ROLLBACK: 516` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`active transaction` | cannot VACUUM / change WAL / start transaction within transaction messages | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`serialization failure` | `SQLITE_BUSY_SNAPSHOT: 517` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`deadlock` | - | - |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`transaction rolled back` | - | - |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`outcome unknown` | - | - |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`invalid savepoint` | - | - |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`unsupported operation` | - | - |
    | Transactions | `NOT_IN_TRANSACTION` | cannot commit/rollback: no transaction is active message and direct transaction checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `NESTED_TRANSACTION_NOT_SUPPORTED` | cannot start a transaction within a transaction message and direct nested transaction checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `FORBIDDEN_CONCURRENT_USAGE` | SQL statements in progress / database or statement busy messages | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `TRANSACTION_LEVEL_NOT_SUPPORTED` | raised directly by query runners that reject the isolation level | `transactionLevel` |
    | Transactions | `TRANSACTION_ACCESS_MODE_NOT_SUPPORTED` | raised directly by query runners that reject the transaction access mode | `accessMode` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`connection` | - | - |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`lock` | `SQLITE_LOCKED: 6`, `SQLITE_LOCKED_SHAREDCACHE: 262`, `SQLITE_LOCKED_VTAB: 518`, `SQLITE_PROTOCOL: 15` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`statement` | - | - |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`transaction` | - | - |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`idle transaction` | - | - |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`cancelled` | `SQLITE_ABORT: 4`, `SQLITE_INTERRUPT: 9`; [Bun SQL](https://bun.sh/docs/api/sql) `ERR_SQLITE_QUERY_CANCELLED` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`database file busy` | `SQLITE_BUSY: 5`, `SQLITE_BUSY_RECOVERY: 261`, `SQLITE_BUSY_SNAPSHOT: 517`, `SQLITE_BUSY_TIMEOUT: 773`; database locked/busy messages | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`connection lost` | `SQLITE_MISUSE: 21` when database is closed; closed DB messages from [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), [bun:sqlite](https://bun.sh/docs/api/sqlite), [node:sqlite](https://nodejs.org/api/sqlite.html), [sqlite3](https://github.com/TryGhost/node-sqlite3), [sqlite-wasm](https://sqlite.org/wasm/doc/trunk/index.md); [Bun SQL](https://bun.sh/docs/api/sql) `ERR_SQLITE_CONNECTION_CLOSED`, `SQLITE_CONNECTION_CLOSED` | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`temporarily unavailable` | - | - |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`invalid connection configuration` | `SQLITE_CANTOPEN: 14`, `SQLITE_CANTOPEN_NOTEMPDIR: 270`, `SQLITE_CANTOPEN_ISDIR: 526`, `SQLITE_CANTOPEN_FULLPATH: 782`, `SQLITE_CANTOPEN_CONVPATH: 1038`, `SQLITE_CANTOPEN_DIRTYWAL: 1294`, `SQLITE_CANTOPEN_SYMLINK: 1550`, `SQLITE_NOTADB: 26`; invalid path/URL messages | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`pool error` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`memory` | `SQLITE_NOMEM: 7`, `SQLITE_IOERR_NOMEM: 3082`; [node:sqlite](https://nodejs.org/api/sqlite.html) `ERR_MEMORY_ALLOCATION_FAILED`; [bun:sqlite](https://bun.sh/docs/api/sqlite) out-of-memory message | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`disk` | `SQLITE_FULL: 13`, `SQLITE_IOERR_SHMSIZE: 4874` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`temp space` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`connections` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`pool` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`cpu` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`file size` | `SQLITE_NOLFS: 22` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED` | too many variables/columns/terms messages; expanded SQL too large messages | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_AUTHENTICATION_ERROR` | - | - |
    | Access | `SQL_AUTHORIZATION_ERROR` | `SQLITE_AUTH: 23`, `SQLITE_AUTH_USER: 279` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_PERMISSION_DENIED` | `SQLITE_PERM: 3`; [node:sqlite](https://nodejs.org/api/sqlite.html) extension blocked by permission model | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_READ_ONLY_VIOLATION` | `SQLITE_READONLY: 8`, `SQLITE_READONLY_RECOVERY: 264`, `SQLITE_READONLY_CANTLOCK: 520`, `SQLITE_READONLY_ROLLBACK: 776`, `SQLITE_READONLY_DBMOVED: 1032`, `SQLITE_READONLY_CANTINIT: 1288`, `SQLITE_READONLY_DIRECTORY: 1544` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`configuration file` | - | - |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`lock file` | - | - |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`runtime parameter` | [node:sqlite](https://nodejs.org/api/sqlite.html) extension loading/config messages; [bun:sqlite](https://bun.sh/docs/api/sqlite) authorizer callback messages | `configurationErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | I/O | `SQL_IO_ERROR`<br>**ioErrorType**<br>`read`, `write`, `fsync`, `truncate`, `file stat`, `lock`, `unlock`, `delete`, `file not found`, `access`, `shared memory`, `seek`, `mmap`, `path`, `atomic write`, `close`, `reserved extension`, `unknown` | `SQLITE_IOERR: 10` plus extended I/O codes `266`, `522`, `778`, `1034`, `1290`, `1546`, `1802`, `2058`, `2314`, `2570`, `2826`, `3338`, `3594`, `3850`, `4106`, `4362`, `4618`, `4874`, `5130`, `5386`, `5642`, `5898`, `6154`, `6410`, `6666`, `6922`, `7178`, `7434`, `7690`, `7946` | `ioErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | External | `SQL_EXTERNAL_DATA_SOURCE_ERROR` | [node:sqlite](https://nodejs.org/api/sqlite.html) `ERR_LOAD_SQLITE_EXTENSION` when not a permission issue | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Features | `SQL_FEATURE_NOT_SUPPORTED` | [Bun SQL](https://bun.sh/docs/api/sql) no reservation / distributed transaction / arrays / readonly transaction mode messages | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Corruption | `SQL_DATABASE_CORRUPTED`<br>**corruptionType**<br>`database file`, `index`, `sequence`, `virtual table`, `filesystem`, `checksum` | `SQLITE_CORRUPT: 11`, `SQLITE_CORRUPT_VTAB: 267`, `SQLITE_CORRUPT_SEQUENCE: 523`, `SQLITE_CORRUPT_INDEX: 779`, `SQLITE_IOERR_DATA: 8202`, `SQLITE_IOERR_CORRUPTFS: 8458`; malformed database/schema messages | `corruptionType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Internal | `SQL_INTERNAL_ERROR`<br>**errorType**<br>`engine internal` | `SQLITE_OK: 0`, `SQLITE_INTERNAL: 2`, `SQLITE_NOTFOUND: 12`, `SQLITE_EMPTY: 16`, `SQLITE_FORMAT: 24`, `SQLITE_NOTICE: 27`, `SQLITE_WARNING: 28`, `SQLITE_ROW: 100`, `SQLITE_DONE: 101`; Node store/statement creation internals | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Internal | `SQL_INTERNAL_ERROR`<br>**errorType**<br>`api misuse` | `SQLITE_MISUSE: 21` when not a closed connection; API misuse messages from SQLite adapters | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Fallback | `SQL_UNKNOWN` | unmapped SQLite errors; [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) unexpected bind parameter error; [Bun SQL](https://bun.sh/docs/api/sql) `SQL.SQLError` fallback | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
=== "SQL Server"

    | Category | Reason | Error code | Filled fields |
    | --- | --- | --- | --- |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`unique` | `1505`, `2601`, `2627` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`not null` | `233`, `515` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`foreign key` | `547` when message is foreign-key related | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`check` | `547` when message is check-related, `548` | `constraintType`<br>`constraintName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`exclusion` | - | - |
    | Constraints | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`restrict` | - | - |
    | Constraints | `SQL_CONSTRAINT_VIOLATED` | `547` fallback plus constraint cases above | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`too long` | `8152`, `2628`, `8028`, `8046`, XML `9461`, `6907`, `6915`, `6935`; JSON `13613`, `13615`, `13625`, `13639`, `13644`, `13646`, `13648`, `13650` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`out of range` | `220`, `232`, `236`, `242`, `244`, `248`, `294`, `296`, `298`, `517`, `535`, `542`, `8115` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid value` | `210`, `245`, `295`, `8114`, `8169`, `8023`, `8043`; JSON value `13612`, `13622`, `13659`, `13670`, `13671`, `13692` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid format` | `235`, `241`, `293` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid encoding` | `13640`, `13684` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid json` | `13606`, `13607`, `13609`, `13645` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid xml` | XML parse `9400`-`9467` except `9461`, plus `9480`; XML value `6901`, `6904`, `6905`, `6906`, `6909`, `6911`-`6914`, `6916`-`6919`, `6921`-`6924`, `6926`, `6927`, `6929`-`6931`, `6933`, `6934`, `6936`-`6939`, `6947` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`invalid regular expression` | `572` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`null not allowed` | `8022`, `8042`, `13638` | `errorType`<br>`tableName` when inferred<br>`columnName` when inferred<br>`typeName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Values | `SQL_INVALID_VALUE`<br>**errorType**<br>`sequence limit` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`missing` | [mssql](https://github.com/tediousjs/node-mssql) `EARGS`, `EPARAM`, table-name messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`too many` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`wrong count` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid name` | [mssql](https://github.com/tediousjs/node-mssql) `EINJECT`, invalid table-name messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid index` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid type` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid value` | `8023`, `8043`; [mssql](https://github.com/tediousjs/node-mssql) invalid parameter/request value messages | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`invalid binding` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`not bindable` | - | - |
    | Parameters | `SQL_INVALID_PARAMETER`<br>**parameterErrorType**<br>`already bound` | [mssql](https://github.com/tediousjs/node-mssql) `EDUPEPARAM` | `parameterErrorType`<br>`parameterName` when inferred<br>`parameterIndex` when inferred<br>`expectedParameterCount` when inferred<br>`actualParameterCount` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Parameters | `SQL_INVALID_PARAMETER` | [mssql](https://github.com/tediousjs/node-mssql) `EARGS`, `EPARAM`, `EINJECT`, `EDUPEPARAM`, invalid table-name messages | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`database` | `911`, `998`, `40145` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`schema` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`table or view` | `208` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`column` | `207`, `1911` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`routine` | `261`, `2812` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`sequence` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`collation` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`index` | `307`, `308`, `40307` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`trigger` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`cursor` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`prepared statement` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`role` | - | - |
    | Object not found | `SQL_OBJECT_NOT_FOUND` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`database` | `1801` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`schema` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`table or view` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`column` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`routine` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`sequence` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`index` | `1913` | `objectType`<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`trigger` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`cursor` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`prepared statement` | - | - |
    | Object already exists | `SQL_OBJECT_ALREADY_EXISTS` | `2714` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`invalid state` | `315`, `316`, `40558`; [mssql](https://github.com/tediousjs/node-mssql) prepared-statement `EALREADYPREPARED`, `ENOTPREPARED` | `objectStateErrorType`<br>`objectType` when inferred<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`wrong object type` | - | - |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`object in use` | `3101`, `3102`, `3702` | `objectStateErrorType`<br>`objectType` when inferred<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Object state | `SQL_OBJECT_STATE_ERROR`<br>**objectStateErrorType**<br>`dependent objects still exist` | `3726`, `3729`, `3732` | `objectStateErrorType`<br>`objectType` when inferred<br>`schemaName` when inferred<br>`tableName` when inferred<br>`columnName` when inferred<br>`objectName` when inferred<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_SYNTAX_ERROR` | `102`, `105`, `156`, `319`, `1018`, `1034`, `1035`, `1731`-`1734`, `1736`, `1740`, `1741`, `3019`, `3220`, `3225`, `3749`, `3766` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_AMBIGUOUS_IDENTIFIER`<br>**identifierErrorType**<br>`ambiguous` | `209`, `326`, `327` | `identifier` when inferred<br>`identifierType` when inferred<br>`identifierErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_AMBIGUOUS_IDENTIFIER`<br>**identifierErrorType**<br>`duplicate` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`incomplete statement` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid definition` | `142`, `423`, `424`, `432`, `435`, `1038`, `4502`, `4505`, `4506`, `12307`, `41321`, `41327` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`type mismatch` | `206`, `249`, `257`, `402`, `403`, `450`, `529`, `8116`, `8117`, `13636` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid statement context` | `101`, `112`, `154`, `226`, `259`, `287`, `321`, `323`, `413`, `414`, `544`, `545`, `1058`, `4005`, `4006`, `4007`, `4508` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid identifier` | `203`, `243` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid reference` | `107`, `4104`, `4121` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid grouping` | `144`, `164`, `278`, `329`, `8124`, `8127` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid windowing` | `4108`, `4109`, `4112`, `4113` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid recursion` | `460`-`467` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid locator` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`case not found` | - | - |
    | Statement | `SQL_INVALID_SQL_STATEMENT`<br>**statementErrorType**<br>`invalid argument` | `536`, `537`, `577`, `1023`, `1228`, `4114`, `4116`, `9820`, `9828`, `9987`, `41303`, `41394`, `42304`, `42305`, `43201`, `43202`, `45020`, `45021` | `statementErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Statement | `SQL_INVALID_SQL_STATEMENT` | fallback SQL Server statement errors | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_DIVISION_BY_ZERO` | `8134` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_CARDINALITY_VIOLATION` | `109`, `110`, `116`, `120`, `121`, `205`, `213`, `512` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Execution | `SQL_ROUTINE_ERROR` | - | - |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`invalid state` | [mssql](https://github.com/tediousjs/node-mssql) `EINVALIDSTATE` and default `TransactionError` invalid state | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`aborted` | `3930`, `40540`, `41300`, `41301`, `41339`; [mssql](https://github.com/tediousjs/node-mssql) `EABORT` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`active transaction` | [mssql](https://github.com/tediousjs/node-mssql) `EALREADYBEGUN` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`serialization failure` | `3960`, `41302`, `41305`, `41325` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`deadlock` | `1205` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`transaction rolled back` | `1206` | `transactionErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`outcome unknown` | - | - |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`invalid savepoint` | - | - |
    | Transactions | `TRANSACTION_ERROR`<br>**transactionErrorType**<br>`unsupported operation` | - | - |
    | Transactions | `NOT_IN_TRANSACTION` | `3902`, `3903`; [mssql](https://github.com/tediousjs/node-mssql) `ENOTBEGUN`; direct transaction checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `NESTED_TRANSACTION_NOT_SUPPORTED` | [mssql](https://github.com/tediousjs/node-mssql) `EALREADYBEGUN` and direct nested transaction checks | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `FORBIDDEN_CONCURRENT_USAGE` | [mssql](https://github.com/tediousjs/node-mssql) `EREQINPROG`, `EINVALIDSTATE` request-in-progress state | driver-mapped cases fill `databaseErrorCode`, `databaseErrorNumber` when available, and `databaseErrorMessage`; direct checks fill no extra fields |
    | Transactions | `TRANSACTION_LEVEL_NOT_SUPPORTED` | [mssql](https://github.com/tediousjs/node-mssql) invalid isolation level message | `transactionLevel` when available<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Transactions | `TRANSACTION_ACCESS_MODE_NOT_SUPPORTED` | raised directly by query runners that reject the transaction access mode | `accessMode` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`connection` | [mssql](https://github.com/tediousjs/node-mssql) `ETIMEOUT` on `ConnectionError` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`lock` | `1222` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`statement` | [mssql](https://github.com/tediousjs/node-mssql) `ETIMEOUT` on `RequestError` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`transaction` | `40549`; [mssql](https://github.com/tediousjs/node-mssql) `ETIMEOUT` on `TransactionError` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`idle transaction` | - | - |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`cancelled` | [mssql](https://github.com/tediousjs/node-mssql) `ECANCEL` | `timeoutType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Timeouts | `SQL_TIMEOUT`<br>**timeoutType**<br>`database file busy` | - | - |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`connection lost` | `4014`, `7836`; [mssql](https://github.com/tediousjs/node-mssql) `ECLOSE`, `ESOCKET`, socket/closed messages | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`temporarily unavailable` | `40501`, `40613`, `40624`, `40635`, `40642`, `40669`, `40671`, `40675`, `976`, `982` | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`invalid connection configuration` | `40531`, `978`, `979`, `45031`; [mssql](https://github.com/tediousjs/node-mssql) `EINSTLOOKUP`, `EDRIVER`, `EENCRYPT`, tedious/tarn config messages | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Connections | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`pool error` | [mssql](https://github.com/tediousjs/node-mssql) `ENOTOPEN`, `ECONNCLOSED`, pool closed/config codes | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`memory` | `701`, `802`, `40553`, `1437`, `1471`, `6532`, `6533`, `8356`, `8359`, `8651`, `8657`, `9824`, `9827`, `41331`, `41379` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`disk` | `1101`, `1105`, `9002`, `40552`, `3911` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`temp space` | `40551`, `1138` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`connections` | - | - |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`pool` | [tarn](https://github.com/vincit/tarn.js) `TimeoutError` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`cpu` | `10961` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`file size` | `40544` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Resources | `SQL_RESOURCE_LIMIT_REACHED` | `13641`, `10928`, `10929`, `40550`, `40604`, `40611`, `40648`, `40652`, `40656`, `40658`, `1204`, `3627`, `41340` | `resourceType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_AUTHENTICATION_ERROR` | `18452`, `18456`, `18470`, `18487`, `18488`, `40505`, `40532`, `40620`, `40623`; [mssql](https://github.com/tediousjs/node-mssql) `ELOGIN`, `EFEDAUTH` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_AUTHORIZATION_ERROR` | `916`, `1202`, `1230`, `4060`, `40615` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_PERMISSION_DENIED` | `229`, `230`, `262`, `297`, `300`, `368`, `371`, `373`, `3110`, `40548`, `40574`, `40644`, `40668`, `41363`, `41376` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Access | `SQL_READ_ONLY_VIOLATION` | `3906`, `40573`, `40628`, `652`, `671`, `975`, `1466`, `1924`, `1926`, `2554`, `2596`, `3415`, `3416`, `3740`, `4344`, `4978`, `5048`, `5055`, `5063`, `5244`, `7690`, `9775`, `28014`, `40188`, `41361` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`configuration file` | - | - |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`lock file` | - | - |
    | Configuration | `SQL_CONFIGURATION_ERROR`<br>**configurationErrorType**<br>`runtime parameter` | - | - |
    | I/O | `SQL_IO_ERROR`<br>**ioErrorType**<br>`read`, `write`, `fsync`, `truncate`, `file stat`, `lock`, `unlock`, `delete`, `file not found`, `access`, `shared memory`, `seek`, `mmap`, `path`, `atomic write`, `close`, `reserved extension`, `unknown` | access `3017`, `3061`, `3201`, `4861`, `5120`, `5123`; read `3203`, `4862`; write `3202`, `4870`, `5149`; path `5133`; unknown `810`, `823`, `835`, `837`, `5159` | `ioErrorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | External | `SQL_EXTERNAL_DATA_SOURCE_ERROR` | `7301`-`7306`, `7310`, `7311`, `7313`, `7314`, `7317`, `7320`, `7399` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Features | `SQL_FEATURE_NOT_SUPPORTED` | `324`, `369`, `534`, `1096`, `4122`, `12300`-`12306`, `12308`, `12309`, `40051`, `40052`, `40054`, `40058`, `40073`, `42303`, `43203`, `45014`, `45038`, `45043`, `40504`, `40508`, `40510`-`40518`, `40520`-`40529`, `40536`, `40555`, `40559`, `40575`-`40580`, `40584`, `40586`, `40587`, `40597`-`40599`, `40606`, `40607`; JSON feature `13614`, `13616`, `13617`, `13619`, `13654`-`13658`, `13660`-`13663`, `13665`, `13687`; [mssql](https://github.com/tediousjs/node-mssql) `ETDS`, `EINTERFACENOTSUPP`, `EDEPRECATED` | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Corruption | `SQL_DATABASE_CORRUPTED`<br>**corruptionType**<br>`database file`, `index`, `sequence`, `virtual table`, `filesystem`, `checksum` | database file `211`, `602`, `603`, `606`, `608`, `610`, `669`, `682`-`684`, `692`, `824`, `829`, `882`, `907`, `3301`, `3302`, `13642`, `13643`, `40050`, `40067`, `40072`, `40080`, `40083`; checksum `832` | `corruptionType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Internal | `SQL_INTERNAL_ERROR`<br>**errorType**<br>`engine internal` | `204`, `407`, `440`, `565`, `691`, `885`, `3624`, `3696`, `8601`, `8624`, `8630`, `9821`, `9822`, `40640`, `40662`, `13628`-`13631`, `13633`-`13635`, `13637` | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Internal | `SQL_INTERNAL_ERROR`<br>**errorType**<br>`api misuse` | [mssql](https://github.com/tediousjs/node-mssql) driver API misuse/internal request messages | `errorType`<br>`databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |
    | Fallback | `SQL_UNKNOWN` | unmapped SQL Server errors; [mssql](https://github.com/tediousjs/node-mssql) `UNKNOWN`, `MSSQLError` fallback | `databaseErrorCode` when available<br>`databaseErrorNumber` when available<br>`databaseErrorMessage` |

### Library-raised errors outside native database mappings

These errors are created directly by ts-sql-query before, after, or around a driver call. They are not repeated in the native database tabs unless a query runner maps a driver signal to the same reason.

| Category | Reason | Raised by |
| --- | --- | --- |
| Transaction state and capabilities | `NOT_IN_TRANSACTION`, `NESTED_TRANSACTION_NOT_SUPPORTED`, `NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED`, `FORBIDDEN_CONCURRENT_USAGE`, `TRANSACTION_LEVEL_NOT_SUPPORTED`, `TRANSACTION_ACCESS_MODE_NOT_SUPPORTED`, `LOW_LEVEL_TRANSACTION_NOT_SUPPORTED`, `ERROR_EXECUTING_DEFERRED_IN_TRANSACTION` | `AbstractConnection`, transaction query runners, pool query runners, delegated transaction wrappers, Prisma low-level transaction guard |
| Query execution cardinality | `NO_RESULT`, `MORE_THAN_ONE_ROW`, `MINIMUM_ROWS_NOT_REACHED`, `MAXIMUM_ROWS_EXCEEDED` | query builders and result-shape helpers |
| Query safety rules | `DISALLOWED_BY_QUERY_RULE`, `DISALLOWED`, `MISSING_WHERE`, `ORDER_BY_COLUMN_NOT_IN_SELECT`, `GROUP_BY_COLUMN_NOT_IN_SELECT`, `INVALID_ORDER_BY_ORDERING` | query composers and SQL builders before the statement is sent to a driver |
| Query construction shape | `NO_COLUMN_SETS`, `CONSTANT_VALUES_VIEW_CANNOT_BE_EMPTY`, `INVALID_SHAPE_OVERRIDE`, `ONLY_ONE_COLUMN_EXPECTED`, `OUT_PARAMS_NOT_SUPPORTED`, `UNSUPPORTED_QUERY`, `UNSUPPORTED_DATABASE`, `UNKNOWN_DATA_TYPE`, `INVALID_SQL_FRAGMENT_RETURN_TYPE`, `INVALID_CONFIGURATION` | SQL builders, connection factories, database adapters, and configuration checks |
| Insert mapping and model-shape checks | `COLUMN_FOR_INSERT_COMING_FROM_SUBQUERY_NOT_IN_TABLE`, `MAPPED_SHAPED_COLUMN_NOT_IN_TABLE`, `NO_AUTOGENERATED_ID_COLUMN_FOUND`, `NO_PRIMARY_KEY_FOUND` | insert builders and table metadata validation |
| Value conversion to or from the database | `INVALID_VALUE_TO_SEND_TO_DATABASE`, `INVALID_VALUE_RECEIVED_FROM_DATABASE`, `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE`, `INVALID_JSON_RECEIVED_FROM_DATABASE` | type adapters, value sources, result mappers, and raw-fragment validation |
| Dynamic condition helpers | `DYNAMIC_CONDITION_INVALID_FILTER`, `DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE`, `DYNAMIC_CONDITION_UNKNOWN_COLUMN`, `DYNAMIC_CONDITION_UNKNOWN_OPERATION` | dynamic criteria parsing and query options |
| Mocking, sync promises, and internal guards | `INVALID_MOCKED_VALUE`, `EXPRESSION_IS_NOT_CONST`, `SYNCHRONOUS_PROSIME_EXPECTED`, `INTERNAL`, `UNKNOWN` | mock query runner utilities and invariant guards in the production package |
