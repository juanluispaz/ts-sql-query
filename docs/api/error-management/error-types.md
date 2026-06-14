---
search:
  boost: 0.25
---
# Error Types

`TsSqlErrorReason` is the structured reason carried by `TsSqlError`, `TsSqlProcessingError`, and `TsSqlQueryExecutionError`. This page mirrors the current reason names and subtype fields from `src/TsSqlError.ts`.

For importable TypeScript declarations and class shapes, see [TypeScript types](typescript-types.md).

## Common Database Metadata

Native SQL reasons can include `databaseErrorCode`, `databaseErrorNumber`, and `databaseErrorMessage`. These fields preserve the driver/database signal while `reason` and subtype fields normalize it.

## SQL Reasons With Subtypes

| <span class="min-width-9rem">Reason</span> | <span class="min-width-8rem">Subtype field</span> | Values | Other common fields |
| --- | --- | --- | --- |
| `SQL_CONSTRAINT_VIOLATED` | `constraintType` | `unique`, `not null`, `foreign key`, `check`, `exclusion`, `restrict` | `constraintName`, `tableName`, `columnName` |
| `SQL_INVALID_VALUE` | `errorType` | `out of range`, `too long`, `invalid value`, `invalid format`, `invalid encoding`, `invalid json`, `invalid xml`, `invalid regular expression`, `null not allowed`, `sequence limit` | `tableName`, `columnName`, `typeName` |
| `SQL_OBJECT_NOT_FOUND` | `objectType` | `schema`, `table`, `table or view`, `column`, `routine`, `sequence`, `database`, `collation`, `index`, `trigger`, `cursor`, `prepared statement`, `role` | `schemaName`, `tableName`, `columnName`, `objectName` |
| `SQL_OBJECT_ALREADY_EXISTS` | `objectType` | `schema`, `table`, `table or view`, `column`, `routine`, `sequence`, `database`, `index`, `trigger`, `cursor`, `prepared statement` | `schemaName`, `tableName`, `columnName`, `objectName` |
| `SQL_INVALID_PARAMETER` | `parameterErrorType` | `missing`, `too many`, `wrong count`, `invalid name`, `invalid index`, `invalid type`, `invalid value`, `invalid binding`, `not bindable`, `already bound` | `parameterName`, `parameterIndex`, `expectedParameterCount`, `actualParameterCount` |
| `SQL_AMBIGUOUS_IDENTIFIER` | `identifierErrorType` | `ambiguous`, `duplicate` | `identifier`, `identifierType` |
| `SQL_INVALID_SQL_STATEMENT` | `statementErrorType` | `incomplete statement`, `invalid definition`, `type mismatch`, `invalid statement context`, `invalid identifier`, `invalid reference`, `invalid grouping`, `invalid windowing`, `invalid recursion`, `invalid locator`, `case not found`, `invalid argument` | database metadata |
| `TRANSACTION_ERROR` | `transactionErrorType` | `invalid state`, `aborted`, `active transaction`, `serialization failure`, `deadlock`, `transaction rolled back`, `outcome unknown`, `invalid savepoint`, `unsupported operation` | database metadata |
| `SQL_TIMEOUT` | `timeoutType` | `connection`, `database file busy`, `lock`, `statement`, `transaction`, `idle transaction`, `cancelled` | database metadata |
| `SQL_CONNECTION_ERROR` | `errorType` | `connection lost`, `temporarily unavailable`, `invalid connection configuration`, `pool error` | database metadata |
| `SQL_IO_ERROR` | `ioErrorType` | `read`, `write`, `fsync`, `truncate`, `file stat`, `lock`, `unlock`, `delete`, `file not found`, `access`, `shared memory`, `seek`, `mmap`, `path`, `atomic write`, `close`, `reserved extension`, `unknown` | database metadata |
| `SQL_OBJECT_STATE_ERROR` | `objectStateErrorType` | `dependent objects still exist`, `object in use`, `invalid state`, `wrong object type` | `objectType`, `schemaName`, `tableName`, `columnName`, `objectName` |
| `SQL_CONFIGURATION_ERROR` | `configurationErrorType` | `configuration file`, `lock file`, `runtime parameter` | database metadata |
| `SQL_RESOURCE_LIMIT_REACHED` | `resourceType` | `disk`, `memory`, `temp space`, `connections`, `pool`, `cpu`, `file size` | database metadata |
| `SQL_DATABASE_CORRUPTED` | `corruptionType` | `database file`, `index`, `sequence`, `virtual table`, `filesystem`, `checksum` | database metadata |
| `SQL_INTERNAL_ERROR` | `errorType` | `engine internal`, `api misuse` | database metadata |

## SQL Reasons Without Subtypes

| Reason | Meaning |
| --- | --- |
| `SQL_DIVISION_BY_ZERO` | Division by zero reported by the database. |
| `SQL_CARDINALITY_VIOLATION` | SQL operation returned or matched an invalid cardinality. |
| `SQL_SYNTAX_ERROR` | SQL syntax error. |
| `SQL_PERMISSION_DENIED` | Permission denied for a SQL action. |
| `SQL_READ_ONLY_VIOLATION` | Write/action attempted against a read-only connection, transaction, or database. |
| `SQL_ROUTINE_ERROR` | SQL routine or external routine failed. |
| `SQL_EXTERNAL_DATA_SOURCE_ERROR` | External or remote SQL data source failed. |
| `SQL_AUTHENTICATION_ERROR` | Authentication failed. |
| `SQL_AUTHORIZATION_ERROR` | Authorization failed after identity was known. |
| `SQL_FEATURE_NOT_SUPPORTED` | Database or driver does not support the requested feature. |
| `SQL_UNKNOWN` | Database or driver error could not be classified. |

## Library And Processing Reasons

| Reason | Fields |
| --- | --- |
| `DISALLOWED_BY_QUERY_RULE` | `message`, `disallowedProperty`, `disallowedRowIndex` |
| `ORDER_BY_COLUMN_NOT_IN_SELECT` | `column` |
| `INVALID_ORDER_BY_ORDERING` | `column`, `ordering` |
| `MISSING_WHERE` | none |
| `MINIMUM_ROWS_NOT_REACHED` | `count`, `min` |
| `MAXIMUM_ROWS_EXCEEDED` | `count`, `max` |
| `MORE_THAN_ONE_ROW` | `count` |
| `NO_RESULT` | none |
| `INVALID_VALUE_TO_SEND_TO_DATABASE` | `value`, `typeName`, `rowIndex`, `columnPath` |
| `INVALID_VALUE_RECEIVED_FROM_DATABASE` | `value`, `typeName`, `rowIndex`, `columnPath` |
| `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE` | `value`, `typeName`, `rowIndex`, `columnPath` |
| `INVALID_JSON_RECEIVED_FROM_DATABASE` | `value`, `typeName`, `rowIndex`, `columnPath` |
| `DISALLOWED` | `message`, `functionName` |
| `NESTED_TRANSACTION_NOT_SUPPORTED` | optional database metadata |
| `NOT_IN_TRANSACTION` | optional database metadata |
| `NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED` | none |
| `ERROR_EXECUTING_DEFERRED_IN_TRANSACTION` | `fn`, `index`, `deferredType` |
| `LOW_LEVEL_TRANSACTION_NOT_SUPPORTED` | optional database metadata |
| `TRANSACTION_LEVEL_NOT_SUPPORTED` | `transactionLevel`, optional database metadata |
| `TRANSACTION_ACCESS_MODE_NOT_SUPPORTED` | `accessMode`, optional database metadata |
| `INVALID_SHAPE_OVERRIDE` | `property` |
| `NO_COLUMN_SETS` | none |
| `CONSTANT_VALUES_VIEW_CANNOT_BE_EMPTY` | none |
| `ONLY_ONE_COLUMN_EXPECTED` | none |
| `OUT_PARAMS_NOT_SUPPORTED` | none |
| `FORBIDDEN_CONCURRENT_USAGE` | optional database metadata |
| `UNSUPPORTED_DATABASE` | `database` |
| `UNSUPPORTED_QUERY` | none |
| `DYNAMIC_CONDITION_INVALID_FILTER` | `value`, `path` |
| `DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE` | `processedValue`, `returnedValue`, `returnedTypeName`, `path`, `extensionName` |
| `DYNAMIC_CONDITION_UNKNOWN_COLUMN` | `path` |
| `DYNAMIC_CONDITION_UNKNOWN_OPERATION` | `path`, `name` |
| `GROUP_BY_COLUMN_NOT_IN_SELECT` | `column` |
| `COLUMN_FOR_INSERT_COMING_FROM_SUBQUERY_NOT_IN_TABLE` | `column` |
| `MAPPED_SHAPED_COLUMN_NOT_IN_TABLE` | `shapeProperty`, `mappedTo` |
| `NO_AUTOGENERATED_ID_COLUMN_FOUND` | none |
| `NO_PRIMARY_KEY_FOUND` | none |
| `UNKNOWN_DATA_TYPE` | `typeName` |
| `INVALID_SQL_FRAGMENT_RETURN_TYPE` | `typeName` |
| `INTERNAL` | `internalErrorType` plus subtype-specific fields |
| `INVALID_CONFIGURATION` | `name`, `value` |
| `INVALID_MOCKED_VALUE` | `value`, `queryType`, `index` |
| `EXPRESSION_IS_NOT_CONST` | none |
| `SYNCHRONOUS_PROSIME_EXPECTED` | none |
| `UNKNOWN` | none |
