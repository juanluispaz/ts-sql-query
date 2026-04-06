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

- [better-sqlite3](https://www.npmjs.com/package/better-sqlite3)
- [mariadb](https://www.npmjs.com/package/mariadb)
- [mssql](https://www.npmjs.com/package/mssql)
- [mysql2](https://www.npmjs.com/package/mysql2)
- [oracledb](https://www.npmjs.com/package/oracledb)
- [pg](https://www.npmjs.com/package/pg)
- [postgres.js](https://github.com/porsager/postgres)
- [sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm)
- [sqlite3](https://www.npmjs.com/package/sqlite3)

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

The following tables summarize the database and connector error codes currently mapped by the native query runners implemented by `ts-sql-query`, excluding the experimental Prisma runner.

These tables are intentionally documented as best effort:

- Native database codes are preferred when the driver exposes them.
- Connector or pool specific codes are included when they are relevant to the implemented behavior.
- Each database tab uses the same row order and the same set of documented cases to make cross-database comparison easier.
- When a database family doesn't implement a case, the `Error code` and `Filled fields` columns show `-`.
- The `Error code` column shows the code and its meaning directly, using the format `CODE`: meaning.
- `Filled fields` lists only the fields actually populated for that database in that case. If a field is not listed, it should not be expected.

=== "MariaDB"
    | Category | Reason | Error code | Filled fields |
    | --- | --- | --- | --- |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`unique` | `1062`: duplicate entry | `constraintType`<br>`constraintName`<br>`tableName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`not null` | `1048`: column cannot be null | `constraintType`<br>`tableName`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`foreign key` | `1451`: cannot delete or update a parent row<br>`1452`: cannot add or update a child row<br>`1216`: cannot add or update child row<br>`1217`: cannot delete or update parent row | `constraintType`<br>`constraintName`<br>`tableName`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`check` | `4025`: constraint failed | `constraintType`<br>`constraintName`<br>`tableName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`exclusion` | - | - |
    | Constraint | `SQL_CONSTRAINT_VIOLATED` | - | - |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`too long` | `1406`: data too long for column | `errorType`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`out of range` | `1264`: out of range value<br>`1690`: bigint value is out of range | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`invalid value` | `1292`: incorrect value<br>`1366`: incorrect value<br>`1411`: incorrect datetime value | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Parameter | `SQL_INVALID_PARAMETER` | `1210`: incorrect arguments to statement<br>`1318`: incorrect number of arguments<br>`45016` ([mariadb](https://www.npmjs.com/package/mariadb)): missing parameter<br>`45017` ([mariadb](https://www.npmjs.com/package/mariadb)): parameter undefined<br>Bind parameters must be array if namedPlaceholders parameter is not enabled ([mysql2](https://www.npmjs.com/package/mysql2))<br>Bind parameters must not contain undefined ([mysql2](https://www.npmjs.com/package/mysql2))<br>Bind parameters must not contain undefined. To pass SQL NULL specify JS null ([mysql2](https://www.npmjs.com/package/mysql2))<br>Bind parameters must not contain function(s). To pass the body of a function as a string call .toString() first ([mysql2](https://www.npmjs.com/package/mysql2)) | `databaseErrorMessage`<br>`databaseErrorCode` for coded cases |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`database` | `1049`: unknown database<br>`1046`: no database selected | `objectType`<br>`databaseErrorCode`<br>`databaseErrorMessage`<br>`objectName` for `1049` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`schema` | - | - |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`table or view` | `1146`: table doesn't exist | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`column` | `1054`: unknown column | `objectType`<br>`columnName`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`routine` | `1305`: procedure or function does not exist | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`database` | `1007`: can't create database; database exists | `objectType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`schema` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`table or view` | `1050`: table already exists | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`column` | `1060`: duplicate column name | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`routine` | `1304`: procedure already exists | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS` | - | - |
    | Statement errors | `SQL_SYNTAX_ERROR` | `1064`: syntax error<br>`1149`: syntax error | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_AMBIGUOUS_IDENTIFIER` | `1052`: column is ambiguous | `identifier`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_INVALID_CONFLICT_TARGET` | - | - |
    | Statement errors | `SQL_DIVISION_BY_ZERO` | `1365`: division by 0 | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_CARDINALITY_VIOLATION` | `1242`: subquery returns more than 1 row | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_DEADLOCK_DETECTED` | `1213`: deadlock found when trying to get lock | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`connection` | `ER_SOCKET_TIMEOUT` ([mariadb](https://www.npmjs.com/package/mariadb)): socket timeout<br>`PROTOCOL_SEQUENCE_TIMEOUT` ([mariadb](https://www.npmjs.com/package/mariadb)): protocol sequence timeout<br>`ETIMEDOUT` ([mysql2](https://www.npmjs.com/package/mysql2)): connection timeout<br>`PROTOCOL_SEQUENCE_TIMEOUT` ([mysql2](https://www.npmjs.com/package/mysql2)): protocol sequence timeout | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`lock` | `1205`: lock wait timeout exceeded | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`statement` | - | - |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`transaction` | - | - |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`idle transaction` | - | - |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`cancelled` | `1317`: query execution was interrupted<br>`1319`: query execution was interrupted<br>`70100`: query was interrupted | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`database file busy` | - | - |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`connection lost` | `08xxx`: connection exception class<br>`1158`: read error from the connection pipe<br>`1159`: got timeout reading communication packets<br>`1160`: got an error writing communication packets<br>`1161`: got timeout writing communication packets<br>`ECONNREFUSED` ([mariadb](https://www.npmjs.com/package/mariadb)): connection refused<br>`ECONNRESET` ([mariadb](https://www.npmjs.com/package/mariadb)): connection reset<br>`EPIPE` ([mariadb](https://www.npmjs.com/package/mariadb)): broken pipe<br>`PROTOCOL_CONNECTION_LOST` ([mariadb](https://www.npmjs.com/package/mariadb)): connection lost<br>`ECONNREFUSED` ([mysql2](https://www.npmjs.com/package/mysql2)): connection refused<br>`ECONNRESET` ([mysql2](https://www.npmjs.com/package/mysql2)): connection reset<br>`EPIPE` ([mysql2](https://www.npmjs.com/package/mysql2)): broken pipe<br>`PROTOCOL_CONNECTION_LOST` ([mysql2](https://www.npmjs.com/package/mysql2)): connection lost<br>Can't add new command when connection is in closed state ([mysql2](https://www.npmjs.com/package/mysql2))<br>Can't write in closed state ([mysql2](https://www.npmjs.com/package/mysql2)) | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`temporarily unavailable` | - | - |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`invalid connection configuration` | - | - |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`pool error` | `ER_POOL_ALREADY_CLOSED` ([mariadb](https://www.npmjs.com/package/mariadb)): pool already closed<br>`POOL_CLOSED` ([mariadb](https://www.npmjs.com/package/mariadb)): pool is closed<br>`POOL_CLOSED` ([mysql2](https://www.npmjs.com/package/mysql2)): pool is closed<br>pool is closed ([mariadb](https://www.npmjs.com/package/mariadb))<br>pool is already closed ([mariadb](https://www.npmjs.com/package/mariadb))<br>Cannot add request to pool, pool is closed ([mariadb](https://www.npmjs.com/package/mariadb))<br>pool is ending, connection request aborted ([mariadb](https://www.npmjs.com/package/mariadb))<br>Pool is closed. ([mysql2](https://www.npmjs.com/package/mysql2)) | `errorType`<br>`databaseErrorCode` for coded cases<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`memory` | `1206`: total number of locks exceeds lock table size<br>`1041`: out of memory | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`disk` | `1114`: table is full | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`temp space` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`connections` | `1040`: too many connections<br>`1226`: user has exceeded the resource | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`cpu` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`pool` | `ER_GET_CONNECTION_TIMEOUT` ([mariadb](https://www.npmjs.com/package/mariadb)): get connection timeout<br>`ER_CANT_GET_CONNECTION` ([mariadb](https://www.npmjs.com/package/mariadb)): can't get connection<br>`POOL_ENQUEUELIMIT` ([mysql2](https://www.npmjs.com/package/mysql2)): queue limit reached<br>No connections available. ([mysql2](https://www.npmjs.com/package/mysql2))<br>Queue limit reached. ([mysql2](https://www.npmjs.com/package/mysql2)) | `resourceType`<br>`databaseErrorMessage`<br>`databaseErrorCode` for coded cases |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED` | - | - |
    | Operational | `SQL_AUTHENTICATION_ERROR` | `1045`: access denied for user | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_AUTHORIZATION_ERROR` | `1044`: access denied to database | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_PERMISSION_DENIED` | `1142`: command denied to user<br>`1143`: column command denied to user<br>`1144`: illegal GRANT/REVOKE command<br>`1227`: access denied; need privilege<br>`1370`: alter routine command denied | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_READ_ONLY_VIOLATION` | `1792`: cannot execute statement in a read-only transaction | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_FEATURE_NOT_SUPPORTED` | `1235`: this version doesn't yet support | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Transaction | `NOT_IN_TRANSACTION` | raised directly by [ts-sql-query](./error-management.md) transaction-state checks | - |
    | Transaction | `NESTED_TRANSACTION_NOT_SUPPORTED` | raised directly by [ts-sql-query](./error-management.md) transaction-state checks | - |
    | Transaction | `FORBIDDEN_CONCURRENT_USAGE` | raised directly by [ts-sql-query](./error-management.md) transaction-state checks | - |
    | Transaction | `SQL_SERIALIZATION_FAILURE` | - | - |
    | Transaction | `SQL_TRANSACTION_ABORTED` | - | - |
    | Unknown | `SQL_UNKNOWN` | fallback for unclassified server or connector code | `databaseErrorCode` when available<br>`databaseErrorMessage` when available |

=== "MySQL"
    | Category | Reason | Error code | Filled fields |
    | --- | --- | --- | --- |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`unique` | `1062`: duplicate entry | `constraintType`<br>`constraintName`<br>`tableName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`not null` | `1048`: column cannot be null | `constraintType`<br>`tableName`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`foreign key` | `1451`: cannot delete or update a parent row<br>`1452`: cannot add or update a child row<br>`1216`: cannot add or update child row<br>`1217`: cannot delete or update parent row | `constraintType`<br>`constraintName`<br>`tableName`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`check` | `3819`: check constraint is violated<br>`4025`: constraint failed | `constraintType`<br>`constraintName`<br>`tableName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`exclusion` | - | - |
    | Constraint | `SQL_CONSTRAINT_VIOLATED` | - | - |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`too long` | `1406`: data too long for column | `errorType`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`out of range` | `1264`: out of range value<br>`1690`: bigint value is out of range | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`invalid value` | `1292`: incorrect value<br>`1366`: incorrect value<br>`1411`: incorrect datetime value | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Parameter | `SQL_INVALID_PARAMETER` | `1210`: incorrect arguments to statement<br>`1318`: incorrect number of arguments<br>`45016` ([mariadb](https://www.npmjs.com/package/mariadb)): missing parameter<br>`45017` ([mariadb](https://www.npmjs.com/package/mariadb)): parameter undefined<br>Bind parameters must be array if namedPlaceholders parameter is not enabled ([mysql2](https://www.npmjs.com/package/mysql2))<br>Bind parameters must not contain undefined ([mysql2](https://www.npmjs.com/package/mysql2))<br>Bind parameters must not contain undefined. To pass SQL NULL specify JS null ([mysql2](https://www.npmjs.com/package/mysql2))<br>Bind parameters must not contain function(s). To pass the body of a function as a string call .toString() first ([mysql2](https://www.npmjs.com/package/mysql2)) | `databaseErrorMessage`<br>`databaseErrorCode` for coded cases |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`database` | `1049`: unknown database<br>`1046`: no database selected | `objectType`<br>`databaseErrorCode`<br>`databaseErrorMessage`<br>`objectName` for `1049` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`schema` | - | - |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`table or view` | `1146`: table doesn't exist | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`column` | `1054`: unknown column | `objectType`<br>`columnName`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`routine` | `1305`: procedure or function does not exist | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`database` | `1007`: can't create database; database exists | `objectType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`schema` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`table or view` | `1050`: table already exists | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`column` | `1060`: duplicate column name | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`routine` | `1304`: procedure already exists | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS` | - | - |
    | Statement errors | `SQL_SYNTAX_ERROR` | `1064`: syntax error<br>`1149`: syntax error | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_AMBIGUOUS_IDENTIFIER` | `1052`: column is ambiguous | `identifier`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_INVALID_CONFLICT_TARGET` | - | - |
    | Statement errors | `SQL_DIVISION_BY_ZERO` | `1365`: division by 0 | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_CARDINALITY_VIOLATION` | `1242`: subquery returns more than 1 row | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_DEADLOCK_DETECTED` | `1213`: deadlock found when trying to get lock | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`connection` | `ETIMEDOUT` ([mysql2](https://www.npmjs.com/package/mysql2)): connection timeout<br>`PROTOCOL_SEQUENCE_TIMEOUT` ([mysql2](https://www.npmjs.com/package/mysql2)): protocol sequence timeout<br>`ER_SOCKET_TIMEOUT` ([mariadb](https://www.npmjs.com/package/mariadb)): socket timeout<br>`PROTOCOL_SEQUENCE_TIMEOUT` ([mariadb](https://www.npmjs.com/package/mariadb)): protocol sequence timeout | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`lock` | `1205`: lock wait timeout exceeded | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`statement` | - | - |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`transaction` | - | - |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`idle transaction` | - | - |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`cancelled` | `1317`: query execution was interrupted<br>`1319`: query execution was interrupted<br>`70100`: query was interrupted | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`database file busy` | - | - |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`connection lost` | `08xxx`: connection exception class<br>`1158`: read error from the connection pipe<br>`1159`: got timeout reading communication packets<br>`1160`: got an error writing communication packets<br>`1161`: got timeout writing communication packets<br>`ECONNREFUSED` ([mysql2](https://www.npmjs.com/package/mysql2)): connection refused<br>`ECONNRESET` ([mysql2](https://www.npmjs.com/package/mysql2)): connection reset<br>`EPIPE` ([mysql2](https://www.npmjs.com/package/mysql2)): broken pipe<br>`PROTOCOL_CONNECTION_LOST` ([mysql2](https://www.npmjs.com/package/mysql2)): connection lost<br>`ECONNREFUSED` ([mariadb](https://www.npmjs.com/package/mariadb)): connection refused<br>`ECONNRESET` ([mariadb](https://www.npmjs.com/package/mariadb)): connection reset<br>`EPIPE` ([mariadb](https://www.npmjs.com/package/mariadb)): broken pipe<br>`PROTOCOL_CONNECTION_LOST` ([mariadb](https://www.npmjs.com/package/mariadb)): connection lost<br>Can't add new command when connection is in closed state ([mysql2](https://www.npmjs.com/package/mysql2))<br>Can't write in closed state ([mysql2](https://www.npmjs.com/package/mysql2)) | `errorType`<br>`databaseErrorMessage`<br>`databaseErrorCode` for coded cases |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`temporarily unavailable` | - | - |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`invalid connection configuration` | - | - |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`pool error` | `POOL_CLOSED` ([mysql2](https://www.npmjs.com/package/mysql2)): pool is closed<br>`ER_POOL_ALREADY_CLOSED` ([mariadb](https://www.npmjs.com/package/mariadb)): pool already closed<br>`POOL_CLOSED` ([mariadb](https://www.npmjs.com/package/mariadb)): pool is closed<br>Pool is closed. ([mysql2](https://www.npmjs.com/package/mysql2))<br>pool is closed ([mariadb](https://www.npmjs.com/package/mariadb))<br>pool is already closed ([mariadb](https://www.npmjs.com/package/mariadb))<br>Cannot add request to pool, pool is closed ([mariadb](https://www.npmjs.com/package/mariadb))<br>pool is ending, connection request aborted ([mariadb](https://www.npmjs.com/package/mariadb)) | `errorType`<br>`databaseErrorMessage`<br>`databaseErrorCode` for coded cases |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`memory` | `1206`: total number of locks exceeds lock table size<br>`1041`: out of memory | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`disk` | `1114`: table is full | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`temp space` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`connections` | `1040`: too many connections<br>`1226`: user has exceeded the resource | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`cpu` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`pool` | `POOL_ENQUEUELIMIT` ([mysql2](https://www.npmjs.com/package/mysql2)): queue limit reached<br>`ER_GET_CONNECTION_TIMEOUT` ([mariadb](https://www.npmjs.com/package/mariadb)): get connection timeout<br>`ER_CANT_GET_CONNECTION` ([mariadb](https://www.npmjs.com/package/mariadb)): can't get connection<br>No connections available. ([mysql2](https://www.npmjs.com/package/mysql2))<br>Queue limit reached. ([mysql2](https://www.npmjs.com/package/mysql2)) | `resourceType`<br>`databaseErrorMessage`<br>`databaseErrorCode` for coded cases |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED` | - | - |
    | Operational | `SQL_AUTHENTICATION_ERROR` | `1045`: access denied for user | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_AUTHORIZATION_ERROR` | `1044`: access denied to database | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_PERMISSION_DENIED` | `1142`: command denied to user<br>`1143`: column command denied to user<br>`1144`: illegal GRANT/REVOKE command<br>`1227`: access denied; need privilege<br>`1370`: alter routine command denied | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_READ_ONLY_VIOLATION` | `1792`: cannot execute statement in a read-only transaction | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_FEATURE_NOT_SUPPORTED` | `1235`: this version doesn't yet support | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Transaction | `NOT_IN_TRANSACTION` | raised directly by [ts-sql-query](./error-management.md) transaction-state checks | - |
    | Transaction | `NESTED_TRANSACTION_NOT_SUPPORTED` | raised directly by [ts-sql-query](./error-management.md) transaction-state checks | - |
    | Transaction | `FORBIDDEN_CONCURRENT_USAGE` | raised directly by [ts-sql-query](./error-management.md) transaction-state checks | - |
    | Transaction | `SQL_SERIALIZATION_FAILURE` | - | - |
    | Transaction | `SQL_TRANSACTION_ABORTED` | - | - |
    | Unknown | `SQL_UNKNOWN` | fallback for unclassified server or connector code | `databaseErrorCode` when available<br>`databaseErrorMessage` when available |

=== "Oracle"
    | Category | Reason | Error code | Filled fields |
    | --- | --- | --- | --- |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`unique` | `ORA-00001`: unique constraint violated | `constraintType`<br>`constraintName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`not null` | `ORA-01400`: cannot insert NULL | `constraintType`<br>`tableName`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`foreign key` | `ORA-02291`: integrity constraint violated - parent key not found<br>`ORA-02292`: integrity constraint violated - child record found | `constraintType`<br>`constraintName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`check` | `ORA-02290`: check constraint violated | `constraintType`<br>`constraintName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`exclusion` | - | - |
    | Constraint | `SQL_CONSTRAINT_VIOLATED` | - | - |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`too long` | `ORA-12899`: value too large for column | `errorType`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`out of range` | `ORA-01438`: value larger than specified precision<br>`ORA-01455`: converting column overflows integer datatype<br>`ORA-01426`: numeric overflow | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`invalid value` | `ORA-01722`: invalid number<br>`ORA-01830`: date format picture ends before converting entire input string<br>`ORA-01840`: input value not long enough for date format<br>`ORA-01841`: full year must be between -4713 and +9999 and not be 0<br>`ORA-01843`: not a valid month<br>`ORA-01847`: day of month must be between 1 and last day of month<br>`ORA-01858`: non-numeric character found<br>`ORA-01861`: literal does not match format string<br>`ORA-01882`: timezone region not found<br>`ORA-01888`: specified field not found in datetime or interval | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Parameter | `SQL_INVALID_PARAMETER` | `ORA-01006`: bind variable does not exist<br>`ORA-01008`: not all variables bound<br>`ORA-01036`: illegal variable name or number<br>`NJS-005` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid parameter value<br>`NJS-009` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid number of parameters<br>`NJS-011` ([oracledb](https://www.npmjs.com/package/oracledb)): encountered bind value and type mismatch<br>`NJS-012` ([oracledb](https://www.npmjs.com/package/oracledb)): encountered invalid bind data type in parameter<br>`NJS-035` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid bind unit<br>`NJS-036` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid type for parameter<br>`NJS-044` ([oracledb](https://www.npmjs.com/package/oracledb)): named JSON object expected<br>`NJS-056` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid number of rows to fetch<br>`NJS-057` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid value for maxRows<br>`NJS-059` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid value for prefetchRows<br>`NJS-060` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid access mode<br>`NJS-097` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid bind placeholder<br>`NJS-098` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid number of bind values<br>`NJS-137` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid bind name or position | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`database` | - | - |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`schema` | - | - |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`table or view` | `ORA-00942`: table or view does not exist | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`column` | `ORA-00904`: invalid identifier | `objectType`<br>`columnName`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`routine` | `ORA-04043`: object does not exist | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND` | `ORA-06576`: not a valid function or procedure name | `objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`database` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`schema` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`table or view` | `ORA-00955`: name is already used by an existing object | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`column` | `ORA-01430`: column being added already exists | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`routine` | `ORA-00955`: name is already used by an existing object | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS` | - | - |
    | Statement errors | `SQL_SYNTAX_ERROR` | `ORA-00923`: FROM keyword not found where expected<br>`ORA-00900`: invalid SQL statement<br>`ORA-00933`: SQL command not properly ended<br>`ORA-00936`: missing expression<br>`ORA-00907`: missing right parenthesis<br>`ORA-01756`: quoted string not properly terminated<br>`ORA-06550`: PL/SQL compilation error envelope | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_AMBIGUOUS_IDENTIFIER` | `ORA-00918`: column ambiguously defined | `identifier`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_INVALID_CONFLICT_TARGET` | - | - |
    | Statement errors | `SQL_DIVISION_BY_ZERO` | `ORA-01476`: divisor is equal to zero | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_CARDINALITY_VIOLATION` | `ORA-01427`: single-row subquery returns more than one row | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_DEADLOCK_DETECTED` | `ORA-00060`: deadlock detected while waiting for resource | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`connection` | `ORA-12170`: connect timeout occurred | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`lock` | `ORA-00054`: resource busy and acquire with NOWAIT specified or timeout expired<br>`ORA-02049`: timeout: distributed transaction waiting for lock<br>`ORA-04021`: timeout occurred while waiting to lock object<br>`ORA-30006`: resource busy; acquire with WAIT timeout expired | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`statement` | `NJS-123` ([oracledb](https://www.npmjs.com/package/oracledb)): statement timeout | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`transaction` | - | - |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`idle transaction` | - | - |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`cancelled` | `ORA-01013`: user requested cancel of current operation | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`database file busy` | - | - |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`connection lost` | `ORA-01012`: not logged on<br>`ORA-12541`: no listener<br>`ORA-12543`: destination host unreachable<br>`ORA-12545`: target host or object does not exist<br>`NJS-500` ([oracledb](https://www.npmjs.com/package/oracledb)): connection closed<br>`NJS-503` ([oracledb](https://www.npmjs.com/package/oracledb)): connection cannot be established<br>`NJS-511` ([oracledb](https://www.npmjs.com/package/oracledb)): connection to the database was broken<br>`DPI-1010` ([oracledb](https://www.npmjs.com/package/oracledb)): not connected<br>`DPI-1080` ([oracledb](https://www.npmjs.com/package/oracledb)): connection was closed by ORA-* or NJS-* error | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`temporarily unavailable` | - | - |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`invalid connection configuration` | `ORA-12154`: TNS could not resolve connect identifier<br>`ORA-12514`: listener does not currently know of service requested<br>`ORA-12505`: listener does not currently know of SID given in connect descriptor<br>`NJS-512` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid connect string<br>`NJS-514` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid connect string<br>`NJS-515` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid connect string<br>`NJS-517` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid connect string<br>`NJS-518` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid connect string<br>`NJS-519` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid connect string<br>`NJS-520` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid connect string<br>`NJS-530` ([oracledb](https://www.npmjs.com/package/oracledb)): invalid connect string | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`pool error` | `NJS-064` ([oracledb](https://www.npmjs.com/package/oracledb)): connection pool is closing<br>`NJS-065` ([oracledb](https://www.npmjs.com/package/oracledb)): connection pool is closed<br>`NJS-082` ([oracledb](https://www.npmjs.com/package/oracledb)): connection pool is being reconfigured | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`memory` | `ORA-04030`: out of process memory | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`disk` | `ORA-01653`: unable to extend table<br>`ORA-01659`: unable to allocate MINEXTENTS beyond | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`temp space` | `ORA-01652`: unable to extend temp segment<br>`ORA-30036`: unable to extend segment by in undo tablespace | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`connections` | `ORA-00020`: maximum number of processes exceeded<br>`ORA-01041`: internal error. hostdef extension doesn't exist<br>`ORA-12516`: listener could not find available handler with matching protocol stack<br>`ORA-12519`: listener could not find available service handler<br>`ORA-12520`: listener could not find available handler for requested type of server | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`cpu` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`pool` | `NJS-040` ([oracledb](https://www.npmjs.com/package/oracledb)): connection request timeout<br>`NJS-076` ([oracledb](https://www.npmjs.com/package/oracledb)): connection request rejected because pool queue length reached `queueMax` | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED` | - | - |
    | Operational | `SQL_AUTHENTICATION_ERROR` | `ORA-01017`: invalid username/password<br>`ORA-28000`: account is locked<br>`ORA-28001`: password has expired | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_AUTHORIZATION_ERROR` | - | - |
    | Operational | `SQL_PERMISSION_DENIED` | `ORA-01031`: insufficient privileges | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_READ_ONLY_VIOLATION` | `ORA-16000`: database or pluggable database open for read-only access | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_FEATURE_NOT_SUPPORTED` | `ORA-03001`: unimplemented feature<br>`ORA-00439`: feature not enabled | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Transaction | `NOT_IN_TRANSACTION` | raised directly by [ts-sql-query](./error-management.md) transaction-state checks | - |
    | Transaction | `NESTED_TRANSACTION_NOT_SUPPORTED` | raised directly by [ts-sql-query](./error-management.md) transaction-state checks | - |
    | Transaction | `FORBIDDEN_CONCURRENT_USAGE` | `NJS-081` ([oracledb](https://www.npmjs.com/package/oracledb)): concurrent operations on a connection are not allowed<br>also raised directly by [ts-sql-query](./error-management.md) transaction-state checks | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Transaction | `SQL_SERIALIZATION_FAILURE` | `ORA-08177`: can't serialize access for this transaction | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Transaction | `SQL_TRANSACTION_ABORTED` | - | - |
    | Unknown | `SQL_UNKNOWN` | fallback for unclassified `ORA-`, `NJS-` or `DPI-` code | `databaseErrorCode` when available<br>`databaseErrorMessage` when available |

===+ "PostgreSQL"
    | Category | Reason | Error code | Filled fields |
    | --- | --- | --- | --- |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`unique` | `23505`: unique_violation | `constraintType`<br>`constraintName`<br>`tableName`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`not null` | `23502`: not_null_violation | `constraintType`<br>`tableName`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`foreign key` | `23503`: foreign_key_violation | `constraintType`<br>`constraintName`<br>`tableName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`check` | `23514`: check_violation | `constraintType`<br>`constraintName`<br>`tableName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`exclusion` | `23P01`: exclusion_violation | `constraintType`<br>`constraintName`<br>`tableName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED` | - | - |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`too long` | `22001`: string_data_right_truncation | `errorType`<br>`tableName`<br>`columnName`<br>`typeName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`out of range` | `22003`: numeric_value_out_of_range | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`invalid value` | `22P02`: invalid_text_representation<br>`22007`: invalid_datetime_format<br>`22008`: datetime_field_overflow<br>`22018`: invalid_character_value_for_cast<br>`22023`: invalid_parameter_value | `errorType`<br>`typeName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Parameter | `SQL_INVALID_PARAMETER` | `42P02`: undefined_parameter<br>`08P01`: protocol_violation<br>`UNDEFINED_VALUE` ([postgres.js](https://github.com/porsager/postgres)): undefined value<br>`MAX_PARAMETERS_EXCEEDED` ([postgres.js](https://github.com/porsager/postgres)): maximum parameters exceeded | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`database` | `3D000`: invalid_catalog_name | `objectType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`schema` | `3F000`: invalid_schema_name | `objectType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`table or view` | `42P01`: undefined_table | `objectType`<br>`tableName`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`column` | `42703`: undefined_column | `objectType`<br>`columnName`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`routine` | `42883`: undefined_function | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND` | `42704`: undefined_object | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`database` | `42P04`: duplicate_database | `objectType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`schema` | `42P06`: duplicate_schema | `objectType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`table or view` | `42P07`: duplicate_table | `objectType`<br>`tableName`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`column` | `42701`: duplicate_column | `objectType`<br>`columnName`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`routine` | `42723`: duplicate_function | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS` | `42710`: duplicate_object | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_SYNTAX_ERROR` | `42601`: syntax_error | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_AMBIGUOUS_IDENTIFIER` | `42702`: ambiguous_column<br>`42P09`: ambiguous_alias | `identifier`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_INVALID_CONFLICT_TARGET` | `42P10`: invalid_column_reference | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_DIVISION_BY_ZERO` | `22012`: division_by_zero | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_CARDINALITY_VIOLATION` | `21000`: cardinality_violation | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_DEADLOCK_DETECTED` | `40P01`: deadlock_detected | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`connection` | `CONNECT_TIMEOUT` ([postgres.js](https://github.com/porsager/postgres)): connector connection timeout<br>`ETIMEDOUT` ([pg](https://www.npmjs.com/package/pg)): connector timeout<br>`ESOCKETTIMEDOUT` ([pg](https://www.npmjs.com/package/pg)): connector socket timeout | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`lock` | `55P03`: lock_not_available | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`statement` | `57014`: query_canceled when the message identifies statement timeout<br>Query read timeout ([pg](https://www.npmjs.com/package/pg)) | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`transaction` | `25P04`: transaction_timeout | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`idle transaction` | `25P03`: idle_in_transaction_session_timeout | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`cancelled` | `57014`: query_canceled when not recognized as statement timeout<br>`QUERY_CANCELED` ([postgres.js](https://github.com/porsager/postgres)): connector query cancelled | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`database file busy` | - | - |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`connection lost` | `57000`: operator_intervention<br>`57015`: idle_session_timeout<br>`57P01`: admin_shutdown<br>`57P02`: crash_shutdown<br>`08001`: sqlclient_unable_to_establish_sqlconnection<br>`08003`: connection_does_not_exist<br>`08004`: sqlserver_rejected_establishment_of_sqlconnection<br>`08006`: connection_failure<br>`08007`: transaction_resolution_unknown<br>`ECONNRESET` ([pg](https://www.npmjs.com/package/pg)): connection reset<br>`EPIPE` ([pg](https://www.npmjs.com/package/pg)): broken pipe<br>`CONNECTION_CLOSED` ([postgres.js](https://github.com/porsager/postgres)): connection closed<br>`CONNECTION_ENDED` ([postgres.js](https://github.com/porsager/postgres)): connection ended<br>`CONNECTION_DESTROYED` ([postgres.js](https://github.com/porsager/postgres)): connection destroyed | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`temporarily unavailable` | `57P03`: cannot_connect_now | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`invalid connection configuration` | `57P04`: database_dropped | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`pool error` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`memory` | `53200`: out_of_memory | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`disk` | `53100`: disk_full | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`temp space` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`connections` | `53300`: too_many_connections | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`cpu` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`pool` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED` | `53400`: configuration_limit_exceeded | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_AUTHENTICATION_ERROR` | `28P01`: invalid_password<br>`AUTH_TYPE_NOT_IMPLEMENTED` ([postgres.js](https://github.com/porsager/postgres)): authentication type not implemented<br>`SASL_SIGNATURE_MISMATCH` ([postgres.js](https://github.com/porsager/postgres)): SASL signature mismatch | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_AUTHORIZATION_ERROR` | `28000`: invalid_authorization_specification | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_PERMISSION_DENIED` | `42501`: insufficient_privilege | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_READ_ONLY_VIOLATION` | `25006`: read_only_sql_transaction | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_FEATURE_NOT_SUPPORTED` | `0A000`: feature_not_supported<br>`MESSAGE_NOT_SUPPORTED` ([postgres.js](https://github.com/porsager/postgres)): message not supported | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Transaction | `NOT_IN_TRANSACTION` | `25P01`: no_active_sql_transaction<br>`2D000`: invalid_transaction_termination<br>also raised directly by [ts-sql-query](./error-management.md) transaction-state checks | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Transaction | `NESTED_TRANSACTION_NOT_SUPPORTED` | raised directly by [ts-sql-query](./error-management.md) transaction-state checks | - |
    | Transaction | `FORBIDDEN_CONCURRENT_USAGE` | raised directly by [ts-sql-query](./error-management.md) transaction-state checks | - |
    | Transaction | `SQL_SERIALIZATION_FAILURE` | `40001`: serialization_failure | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Transaction | `SQL_TRANSACTION_ABORTED` | `25P02`: in_failed_sql_transaction | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Unknown | `SQL_UNKNOWN` | fallback for unclassified SQLSTATE or connector code | `databaseErrorCode` when available<br>`databaseErrorMessage` when available |

=== "SQLite"
    | Category | Reason | Error code | Filled fields |
    | --- | --- | --- | --- |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`unique` | `SQLITE_CONSTRAINT`: 19<br>`SQLITE_CONSTRAINT_PRIMARYKEY`: 1555<br>`SQLITE_CONSTRAINT_UNIQUE`: 2067<br>`SQLITE_CONSTRAINT_ROWID`: 2579 | `constraintType`<br>`tableName`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`not null` | `SQLITE_CONSTRAINT`: 19<br>`SQLITE_CONSTRAINT_NOTNULL`: 1299 | `constraintType`<br>`tableName`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`foreign key` | `SQLITE_CONSTRAINT`: 19<br>`SQLITE_CONSTRAINT_FOREIGNKEY`: 787 | `constraintType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`check` | `SQLITE_CONSTRAINT`: 19<br>`SQLITE_CONSTRAINT_CHECK`: 275 | `constraintType`<br>`constraintName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`exclusion` | - | - |
    | Constraint | `SQL_CONSTRAINT_VIOLATED` | - | - |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`too long` | `SQLITE_TOOBIG`: 18 | `errorType`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`out of range` | - | - |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`invalid value` | `SQLITE_MISMATCH`: 20 | `errorType`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Parameter | `SQL_INVALID_PARAMETER` | `SQLITE_RANGE`: 25<br>DATA TYPE IS NOT SUPPORTED ([sqlite3](https://www.npmjs.com/package/sqlite3))<br>BIND OR COLUMN INDEX OUT OF RANGE ([sqlite3](https://www.npmjs.com/package/sqlite3), [better-sqlite3](https://www.npmjs.com/package/better-sqlite3), [sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm))<br>WRONG NUMBER OF ARGUMENTS TO FUNCTION ([sqlite3](https://www.npmjs.com/package/sqlite3), [better-sqlite3](https://www.npmjs.com/package/better-sqlite3), [sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm))<br>INVALID BIND() PARAMETER NAME ([sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm))<br>THIS STATEMENT HAS NO BINDABLE PARAMETERS ([sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm))<br>INVALID BIND() ARGUMENTS ([sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm))<br>UNSUPPORTED BIND() ARGUMENT TYPE ([sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm))<br>BIND INDEX ... IS OUT OF RANGE ([sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm))<br>WHEN BINDING AN ARRAY, AN INDEX ARGUMENT IS NOT PERMITTED ([sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm))<br>WHEN BINDING AN OBJECT, AN INDEX ARGUMENT IS NOT PERMITTED ([sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm))<br>MISSING NAMED PARAMETERS ([better-sqlite3](https://www.npmjs.com/package/better-sqlite3))<br>SQLITE3 CAN ONLY BIND NUMBERS, STRINGS, BIGINTS, BUFFERS, AND NULL ([better-sqlite3](https://www.npmjs.com/package/better-sqlite3))<br>YOU CANNOT SPECIFY NAMED PARAMETERS IN TWO DIFFERENT OBJECTS ([better-sqlite3](https://www.npmjs.com/package/better-sqlite3))<br>NAMED PARAMETERS CAN ONLY BE PASSED WITHIN PLAIN OBJECTS ([better-sqlite3](https://www.npmjs.com/package/better-sqlite3)) | `databaseErrorMessage`<br>`databaseErrorCode` for coded cases |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`database` | - | - |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`schema` | - | - |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`table or view` | NO SUCH TABLE<br>`SQLITE_ERROR`: 1 | `objectType`<br>`objectName`<br>`databaseErrorCode` for coded cases<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`column` | NO SUCH COLUMN<br>`SQLITE_ERROR`: 1 | `objectType`<br>`columnName`<br>`objectName`<br>`databaseErrorCode` for coded cases<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`routine` | NO SUCH FUNCTION<br>`SQLITE_ERROR`: 1 | `objectType`<br>`objectName`<br>`databaseErrorCode` for coded cases<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`database` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`schema` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`table or view` | TABLE ... ALREADY EXISTS<br>VIEW ... ALREADY EXISTS<br>`SQLITE_ERROR`: 1 | `objectType`<br>`objectName`<br>`databaseErrorCode` for coded cases<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`column` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`routine` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS` | INDEX ... ALREADY EXISTS<br>`SQLITE_ERROR`: 1 | `objectName`<br>`databaseErrorCode` for coded cases<br>`databaseErrorMessage` |
    | Statement errors | `SQL_SYNTAX_ERROR` | NEAR ... SYNTAX ERROR<br>INCOMPLETE INPUT<br>`SQLITE_ERROR`: 1 | `databaseErrorCode` for coded cases<br>`databaseErrorMessage` |
    | Statement errors | `SQL_AMBIGUOUS_IDENTIFIER` | AMBIGUOUS COLUMN NAME<br>`SQLITE_ERROR`: 1 | `identifier`<br>`databaseErrorCode` for coded cases<br>`databaseErrorMessage` |
    | Statement errors | `SQL_INVALID_CONFLICT_TARGET` | - | - |
    | Statement errors | `SQL_DIVISION_BY_ZERO` | - | - |
    | Statement errors | `SQL_CARDINALITY_VIOLATION` | - | - |
    | Operational | `SQL_DEADLOCK_DETECTED` | - | - |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`connection` | - | - |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`lock` | `SQLITE_LOCKED`: 6<br>`SQLITE_LOCKED_SHAREDCACHE`: 262 | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`statement` | - | - |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`transaction` | - | - |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`idle transaction` | - | - |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`cancelled` | `SQLITE_INTERRUPT`: 9<br>`SQLITE_ABORT`: 4<br>`SQLITE_ABORT_ROLLBACK`: 516 | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`database file busy` | `SQLITE_BUSY`: 5<br>`SQLITE_BUSY_RECOVERY`: 261<br>`SQLITE_BUSY_SNAPSHOT`: 517<br>`SQLITE_BUSY_TIMEOUT`: 773 | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`connection lost` | `SQLITE_IOERR`: 10<br>`SQLITE_PROTOCOL`: 15<br>DATABASE IS NOT OPEN ([sqlite3](https://www.npmjs.com/package/sqlite3))<br>DATABASE IS CLOSING ([sqlite3](https://www.npmjs.com/package/sqlite3))<br>DATABASE HANDLE IS CLOSED ([sqlite3](https://www.npmjs.com/package/sqlite3), [better-sqlite3](https://www.npmjs.com/package/better-sqlite3), [sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm))<br>DATABASE IS CLOSED ([sqlite3](https://www.npmjs.com/package/sqlite3), [better-sqlite3](https://www.npmjs.com/package/better-sqlite3), [sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm))<br>DATABASE CONNECTION IS NOT OPEN ([better-sqlite3](https://www.npmjs.com/package/better-sqlite3)) | `errorType`<br>`databaseErrorMessage`<br>`databaseErrorCode` for coded cases |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`temporarily unavailable` | - | - |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`invalid connection configuration` | `SQLITE_CANTOPEN`: 14<br>`SQLITE_NOTADB`: 26<br>`SQLITE_CANTOPEN_NOTEMPDIR`: 270<br>`SQLITE_CANTOPEN_ISDIR`: 526<br>`SQLITE_CANTOPEN_FULLPATH`: 782<br>`SQLITE_CANTOPEN_CONVPATH`: 1038<br>`SQLITE_CANTOPEN_DIRTYWAL`: 1294<br>`SQLITE_CANTOPEN_SYMLINK`: 1550<br>CANNOT OPEN DATABASE BECAUSE THE DIRECTORY DOES NOT EXIST ([better-sqlite3](https://www.npmjs.com/package/better-sqlite3))<br>IN-MEMORY/TEMPORARY DATABASES CANNOT BE READONLY ([better-sqlite3](https://www.npmjs.com/package/better-sqlite3)) | `errorType`<br>`databaseErrorCode` for coded cases<br>`databaseErrorMessage` |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`pool error` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`memory` | `SQLITE_NOMEM`: 7 | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`disk` | `SQLITE_FULL`: 13 | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`temp space` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`connections` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`cpu` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`pool` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED` | - | - |
    | Operational | `SQL_AUTHENTICATION_ERROR` | - | - |
    | Operational | `SQL_AUTHORIZATION_ERROR` | `SQLITE_AUTH`: 23 | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_PERMISSION_DENIED` | `SQLITE_PERM`: 3 | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_READ_ONLY_VIOLATION` | `SQLITE_READONLY`: 8<br>`SQLITE_READONLY_RECOVERY`: 264<br>`SQLITE_READONLY_CANTLOCK`: 520<br>`SQLITE_READONLY_ROLLBACK`: 776<br>`SQLITE_READONLY_DBMOVED`: 1032<br>`SQLITE_READONLY_CANTINIT`: 1288<br>`SQLITE_READONLY_DIRECTORY`: 1544 | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_FEATURE_NOT_SUPPORTED` | - | - |
    | Transaction | `NOT_IN_TRANSACTION` | CANNOT COMMIT ... NO TRANSACTION IS ACTIVE<br>CANNOT ROLLBACK ... NO TRANSACTION IS ACTIVE<br>also raised directly by [ts-sql-query](./error-management.md) transaction-state checks | `databaseErrorMessage`<br>`databaseErrorCode` for coded cases |
    | Transaction | `NESTED_TRANSACTION_NOT_SUPPORTED` | CANNOT START A TRANSACTION WITHIN A TRANSACTION<br>also raised directly by [ts-sql-query](./error-management.md) transaction-state checks | `databaseErrorMessage`<br>`databaseErrorCode` for coded cases |
    | Transaction | `FORBIDDEN_CONCURRENT_USAGE` | SQL STATEMENTS IN PROGRESS ([sqlite3](https://www.npmjs.com/package/sqlite3), [sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm))<br>DATABASE CONNECTION IS BUSY EXECUTING A QUERY ([better-sqlite3](https://www.npmjs.com/package/better-sqlite3))<br>STATEMENT IS BUSY EXECUTING A QUERY ([better-sqlite3](https://www.npmjs.com/package/better-sqlite3))<br>OPERATION IS ILLEGAL WHEN STATEMENT IS LOCKED ([sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm))<br>also raised directly by [ts-sql-query](./error-management.md) transaction-state checks | `databaseErrorMessage`<br>`databaseErrorCode` for coded cases |
    | Transaction | `SQL_SERIALIZATION_FAILURE` | - | - |
    | Transaction | `SQL_TRANSACTION_ABORTED` | - | - |
    | Unknown | `SQL_UNKNOWN` | fallback for unclassified SQLite code or driver message | `databaseErrorCode` when available<br>`databaseErrorMessage` when available |

=== "SQL Server"
    | Category | Reason | Error code | Filled fields |
    | --- | --- | --- | --- |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`unique` | `2627`: violation of PRIMARY KEY or UNIQUE constraint<br>`2601`: cannot insert duplicate key row | `constraintType`<br>`constraintName`<br>`tableName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`not null` | `515`: cannot insert the value NULL into column | `constraintType`<br>`tableName`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`foreign key` | `547`: constraint conflict on foreign key | `constraintType`<br>`constraintName`<br>`tableName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`check` | `547`: constraint conflict on check | `constraintType`<br>`constraintName`<br>`tableName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Constraint | `SQL_CONSTRAINT_VIOLATED`<br>**constraintType**<br>`exclusion` | - | - |
    | Constraint | `SQL_CONSTRAINT_VIOLATED` | `547`: generic constraint conflict when the message is not recognized as foreign key or check | `constraintName`<br>`tableName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`too long` | `2628`: string or binary data would be truncated<br>`8152`: string or binary data would be truncated | `errorType`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`out of range` | `8115`: arithmetic overflow error | `errorType`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Value | `SQL_INVALID_VALUE_FOR_COLUMN`<br>**errorType**<br>`invalid value` | `241`: conversion failed when converting date and/or time<br>`242`: out-of-range datetime value<br>`245`: conversion failed<br>`248`: the conversion of the varchar value overflowed an int column<br>`249`: converting expression to data type returned out-of-range value<br>`295`: conversion failed because character string is not a valid XML value<br>`296`: cannot convert to XML data type<br>`8169`: conversion failed when converting from a character string to uniqueidentifier | `errorType`<br>`columnName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Parameter | `SQL_INVALID_PARAMETER` | `137`: must declare the scalar variable<br>`201`: procedure expects parameter which was not supplied<br>`8144`: too many arguments specified<br>`8146`: procedure has no parameter named<br>`8178`: parameterized query expects parameter<br>`EARGS` ([mssql](https://www.npmjs.com/package/mssql)): invalid number of arguments<br>`EDUPEPARAM` ([mssql](https://www.npmjs.com/package/mssql)): duplicate parameter name<br>`EPARAM` ([mssql](https://www.npmjs.com/package/mssql)): invalid parameter value | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`database` | `911`: database does not exist | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`schema` | - | - |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`table or view` | `208`: invalid object name | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`column` | `207`: invalid column name | `objectType`<br>`columnName`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND`<br>**objectType**<br>`routine` | `2812`: could not find stored procedure | `objectType`<br>`objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Object | `SQL_OBJECT_NOT_FOUND` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`database` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`schema` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`table or view` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`column` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS`<br>**objectType**<br>`routine` | - | - |
    | Object | `SQL_OBJECT_ALREADY_EXISTS` | `2714`: there is already an object named | `objectName`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_SYNTAX_ERROR` | `102`: incorrect syntax near<br>`105`: unclosed quotation mark after the character string<br>`156`: incorrect syntax near the keyword<br>`319`: incorrect syntax near the keyword with | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_AMBIGUOUS_IDENTIFIER` | `209`: ambiguous column name | `identifier`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_INVALID_CONFLICT_TARGET` | - | - |
    | Statement errors | `SQL_DIVISION_BY_ZERO` | `8134`: divide by zero error encountered | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Statement errors | `SQL_CARDINALITY_VIOLATION` | `512`: subquery returned more than 1 value | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_DEADLOCK_DETECTED` | `1205`: transaction was deadlocked on resources with another process and has been chosen as the deadlock victim | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`connection` | `ETIMEOUT` ([mssql](https://www.npmjs.com/package/mssql)): connection timeout | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`lock` | `1222`: lock request time out period exceeded | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`statement` | `ETIMEOUT` ([mssql](https://www.npmjs.com/package/mssql)): statement timeout | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`transaction` | - | - |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`idle transaction` | - | - |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`cancelled` | `ECANCEL` ([mssql](https://www.npmjs.com/package/mssql)): cancelled | `timeoutType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_TIMEOUT`<br>**timeoutType**<br>`database file busy` | - | - |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`connection lost` | `ENOCONN` ([mssql](https://www.npmjs.com/package/mssql)): no connection is specified for that request<br>`ECONNCLOSED` ([mssql](https://www.npmjs.com/package/mssql)): connection is closed<br>`ENOTOPEN` ([mssql](https://www.npmjs.com/package/mssql)): connection not yet open<br>`ESOCKET` ([mssql](https://www.npmjs.com/package/mssql)): socket error | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`temporarily unavailable` | - | - |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`invalid connection configuration` | `EINSTLOOKUP` ([mssql](https://www.npmjs.com/package/mssql)): instance lookup failed | `errorType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_CONNECTION_ERROR`<br>**errorType**<br>`pool error` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`memory` | `701`: insufficient system memory<br>`802`: there is insufficient memory available<br>`40552`: session terminated because of excessive memory usage<br>`40557`: session terminated because of excessive query compilation memory usage | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`disk` | `1101`: could not allocate a new page<br>`1105`: could not allocate space for object<br>`9002`: transaction log is full<br>`40544`: database has reached its size quota<br>`40551`: session terminated because of excessive transaction log space usage<br>`40553`: session terminated because of excessive database space usage | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`temp space` | `40549`: session is terminated because of excessive tempdb usage | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`connections` | - | - |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`cpu` | `40554`: session terminated because of excessive CPU usage | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED`<br>**resourceType**<br>`pool` | `TimeoutError` (tarn): acquire timeout | `resourceType`<br>`databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_RESOURCE_LIMIT_REACHED` | `10928`: resource ID limit reached<br>`10929`: too many requests waiting for available resources<br>`40550`: session terminated because it acquired too many locks<br>`40555`: session terminated because of excessive result set size<br>`40556`: session terminated because of excessive network bandwidth usage | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_AUTHENTICATION_ERROR` | `ELOGIN` ([mssql](https://www.npmjs.com/package/mssql)): login failed<br>`18456`: login failed for user | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_AUTHORIZATION_ERROR` | `916`: server principal is not able to access the current database<br>`4060`: cannot open database requested by the login | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_PERMISSION_DENIED` | `229`: permission denied | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_READ_ONLY_VIOLATION` | `3906`: failed to update database because the database is read-only | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Operational | `SQL_FEATURE_NOT_SUPPORTED` | `40558`: feature not supported in this version of SQL Server | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Transaction | `NOT_IN_TRANSACTION` | `ENOTBEGUN` ([mssql](https://www.npmjs.com/package/mssql)): transaction has not begun<br>`3902`: the COMMIT TRANSACTION request has no corresponding BEGIN TRANSACTION<br>`3903`: the ROLLBACK TRANSACTION request has no corresponding BEGIN TRANSACTION<br>also raised directly by [ts-sql-query](./error-management.md) transaction-state checks | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Transaction | `NESTED_TRANSACTION_NOT_SUPPORTED` | `EALREADYBEGUN` ([mssql](https://www.npmjs.com/package/mssql)): transaction has already begun<br>also raised directly by [ts-sql-query](./error-management.md) transaction-state checks | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Transaction | `FORBIDDEN_CONCURRENT_USAGE` | `EREQINPROG` ([mssql](https://www.npmjs.com/package/mssql)): request in progress<br>also raised directly by [ts-sql-query](./error-management.md) transaction-state checks | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Transaction | `SQL_SERIALIZATION_FAILURE` | `3960`: snapshot isolation transaction aborted due to update conflict | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Transaction | `SQL_TRANSACTION_ABORTED` | `3930`: the current transaction cannot be committed and cannot support operations that write to the log file<br>`EABORT` ([mssql](https://www.npmjs.com/package/mssql)): transaction aborted | `databaseErrorCode`<br>`databaseErrorMessage` |
    | Unknown | `SQL_UNKNOWN` | fallback for unclassified request, connection or transaction error | `databaseErrorCode` when available<br>`databaseErrorMessage` when available |
