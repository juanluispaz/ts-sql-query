---
search:
  boost: 0.25
---
# Error Types

`TsSqlErrorReason` is the object in the `errorReason` of an error: its `reason` says what went wrong, and the other fields depend on the reason. This page lists every reason with its fields. What each one means and what causes it is in [library-raised errors](library-raised-errors.md) and in the page of [your database](overview.md#where-to-find-a-reason-or-a-code). To read them in code, see [TypeScript types](typescript-types.md).

## Common Database Metadata

The reasons that come from the database can have `databaseErrorCode`, `databaseErrorNumber` and `databaseErrorMessage`, with what the driver or the database said. The `reason` and the subtype say the same thing on every database.

## SQL Reasons With Subtypes

The subtype says more about the error, when the library can tell it from the error of the database. It can be missing, so your code must handle `undefined`. The same goes for the other fields of this table. All of these reasons can have the database metadata too.

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
| `SQL_RESOURCE_LIMIT_REACHED` | `resourceType` | `disk`, `memory`, `temp space`, `connections`, `pool`, `cpu`, `file size`, `parameters`, `statement elements`, `statement length`, `statement complexity` | `limit` |
| `SQL_DATABASE_CORRUPTED` | `corruptionType` | `database file`, `index`, `sequence`, `virtual table`, `filesystem`, `checksum` | database metadata |
| `SQL_INTERNAL_ERROR` | `errorType` | `engine internal`, `api misuse` | database metadata |

### A statement too big for the database

Four values of `resourceType` say that the statement itself goes past a limit of the database or the driver, so running it again as it is fails again:

| `resourceType` | What went past the limit | For example |
| --- | --- | --- |
| `parameters` | The number of parameters of the statement | More than 65535 parameters on PostgreSQL, 32766 on SQLite, 2100 on SQL Server |
| `statement elements` | The number of elements of one part of the statement, with or without parameters | More than 1000 rows in the `values` of an `insert` on SQL Server, more than 1000 elements in an `in` list on Oracle before 23ai, too many tables in a join or columns in a select |
| `statement length` | The length of the SQL text sent to the database | A statement bigger than `max_allowed_packet` on MySQL / MariaDB |
| `statement complexity` | How deeply the statement is nested, or how complex it is | `statement_too_complex` on PostgreSQL, a statement nested too deeply on SQL Server |

`limit` is the maximum the database or the driver allows, when its error says it; the original error is still in `databaseErrorMessage`.

```ts
try {
    await connection.insertInto(tCustomer).values(customers).executeInsert()
} catch (e) {
    if (e instanceof TsSqlError && e.errorReason.reason === 'SQL_RESOURCE_LIMIT_REACHED' && e.errorReason.resourceType === 'parameters') {
        // e.errorReason.limit is the maximum number of parameters, when the error says it:
        // insert the customers in smaller groups
    }
    throw e
}
```

## SQL Reasons Without Subtypes

| Reason | Meaning |
| --- | --- |
| `SQL_DIVISION_BY_ZERO` | Division by zero reported by the database. |
| `SQL_CARDINALITY_VIOLATION` | SQL operation returned or matched an invalid cardinality. |
| `SQL_SYNTAX_ERROR` | SQL syntax error. |
| `SQL_PERMISSION_DENIED` | Permission denied for a SQL action. |
| `SQL_READ_ONLY_VIOLATION` | Write/action attempted against a read-only connection, transaction, or database. |
| `SQL_ROUTINE_ERROR` | SQL routine or external routine failed. |
| `SQL_USER_DEFINED_ERROR` | Error raised on purpose by user-defined SQL code (`RAISE EXCEPTION`, `SIGNAL`, `RAISE_APPLICATION_ERROR`, `THROW` / `RAISERROR`, `RAISE` in a SQLite trigger), with the code, number and message it was raised with. |
| `SQL_EXTERNAL_DATA_SOURCE_ERROR` | External or remote SQL data source failed. |
| `SQL_AUTHENTICATION_ERROR` | Authentication failed. |
| `SQL_AUTHORIZATION_ERROR` | Authorization failed after identity was known. |
| `SQL_FEATURE_NOT_SUPPORTED` | Database or driver does not support the requested feature. |
| `SQL_UNKNOWN` | Database or driver error could not be classified. |

## Library And Processing Reasons

| Reason | Fields |
| --- | --- |
| `DISALLOWED_BY_QUERY_RULE` | `message`, `disallowedProperty`, optional `disallowedRowIndex` |
| `ORDER_BY_COLUMN_NOT_IN_SELECT` | `column` |
| `INVALID_ORDER_BY_ORDERING` | `column`, `ordering` |
| `MISSING_WHERE` | none |
| `MISSING_RECURSIVE_CONDITION` | none |
| `MINIMUM_ROWS_NOT_REACHED` | `count`, `min` |
| `MAXIMUM_ROWS_EXCEEDED` | `count`, `max` |
| `MORE_THAN_ONE_ROW` | `count` |
| `NO_RESULT` | none |
| `INVALID_VALUE_TO_SEND_TO_DATABASE` | `value`, `typeName`, optional `paramIndex`, optional `rowIndex`, optional `columnPath`, optional `valuesName` |
| `INVALID_VALUE_RECEIVED_FROM_DATABASE` | `value`, `typeName`, optional `rowIndex`, optional `columnPath` |
| `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE` | `value`, `typeName`, optional `rowIndex`, optional `columnPath` |
| `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE` | `value`, `typeName`, optional `rowIndex`, optional `columnPath` |
| `INVALID_JSON_RECEIVED_FROM_DATABASE` | `value`, `typeName`, optional `rowIndex`, optional `columnPath` |
| `DISALLOWED` | `message`, `functionName` |
| `NESTED_TRANSACTION_NOT_SUPPORTED` | optional database metadata |
| `NOT_IN_TRANSACTION` | optional database metadata |
| `NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED` | none |
| `ERROR_EXECUTING_DEFERRED_IN_TRANSACTION` | `fn`, `index`, `deferredType` |
| `LOW_LEVEL_TRANSACTION_NOT_SUPPORTED` | optional database metadata |
| `TRANSACTION_LEVEL_NOT_SUPPORTED` | `transactionLevel` (can be `undefined`), optional database metadata |
| `TRANSACTION_ACCESS_MODE_NOT_SUPPORTED` | `accessMode` (can be `undefined`), optional database metadata |
| `INVALID_SHAPE_OVERRIDE` | `property` |
| `NO_COLUMN_SETS` | none |
| `CONSTANT_VALUES_VIEW_CANNOT_BE_EMPTY` | none |
| `ONLY_ONE_COLUMN_EXPECTED` | none |
| `OUT_PARAMS_NOT_SUPPORTED` | none |
| `FORBIDDEN_CONCURRENT_USAGE` | optional database metadata |
| `UNSUPPORTED_DATABASE` | `database` |
| `UNSUPPORTED_QUERY` | none |
| `DYNAMIC_CONDITION_INVALID_FILTER` | `value`, `path` |
| `DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE` | `processedValue`, `returnedValue`, optional `returnedTypeName`, `path`, `extensionName` |
| `DYNAMIC_CONDITION_UNKNOWN_COLUMN` | `path` |
| `DYNAMIC_CONDITION_UNKNOWN_OPERATION` | `path`, `name` |
| `GROUP_BY_COLUMN_NOT_IN_SELECT` | `column` |
| `COLUMN_FOR_INSERT_COMING_FROM_SUBQUERY_NOT_IN_TABLE` | `column` |
| `MAPPED_SHAPED_COLUMN_NOT_IN_TABLE` | `shapeProperty`, `mappedTo` |
| `NO_AUTOGENERATED_ID_COLUMN_FOUND` | none |
| `NO_PRIMARY_KEY_FOUND` | none |
| `UNKNOWN_DATA_TYPE` | optional `typeName` |
| `INVALID_SQL_FRAGMENT_RETURN_TYPE` | `typeName` |
| `INTERNAL` | `internalErrorType`, and the fields of [its type](#internal-error-subtypes) |
| `INVALID_CONFIGURATION` | `name`, `value` |
| `INVALID_MOCKED_VALUE` | `value`, `queryType`, `index` |
| `EXPRESSION_IS_NOT_CONST` | none |
| `SYNCHRONOUS_PROMISE_EXPECTED` | none |
| `UNKNOWN` | none |

## Internal Error Subtypes

`INTERNAL` has an `internalErrorType`. [Internal invariant errors](library-raised-errors.md#internal-invariant-errors) says what each one means.

| `internalErrorType` | Other fields |
| --- | --- |
| `illegal state` | none |
| `invalid result column` | none |
| `unable to discover optional joins` | none |
| `invalid compound operator` | `operator` |
| `invalid join type` | `joinType` |
| `invalid out binds returned` | `value` |
| `expecting insert of multiple values` | none |
| `expecting insert from select` | none |
| `invalid value source` | none |
| `incomplete old value query` | none |
| `repeated column` | `columnPath` |
| `unexpected value` | none |
