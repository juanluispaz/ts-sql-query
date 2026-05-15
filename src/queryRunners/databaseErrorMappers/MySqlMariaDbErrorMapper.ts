import type { TsSqlDatabaseErrorCode, TsSqlDatabaseErrorNumber, TsSqlErrorReason } from '../../TsSqlError.js'
import type { DatabaseType } from '../QueryRunner.js'
import * as ErrorCodes from './MySqlMariaDbErrorCodes.js'

// MySQL and MariaDB reuse numeric ranges with different meanings. Keep these
// engine-specific numeric sets gated by the selected database, but still honor an
// explicit driver-provided symbol when the driver is known to emit one.
const MYSQL_EXTERNAL_DATA_SOURCE_ERROR_NUMBERS = new Set([2022, 2023])
const MYSQL_DATA_TRUNCATED_ERROR_NUMBERS = new Set([2032])
const MYSQL_COLLATION_NOT_FOUND_ERROR_NUMBERS = new Set([28])
const MYSQL_OBJECT_NOT_FOUND_EXTRA_ERROR_NUMBERS = new Set([3548, 3902])
const MYSQL_OBJECT_ALREADY_EXISTS_EXTRA_ERROR_NUMBERS = new Set([3712])
const MYSQL_DEPENDENT_OBJECTS_STILL_EXIST_ERROR_NUMBERS = new Set([3716])

export interface MySqlMariaDbEngineError {
    database?: DatabaseType
    errno?: number
    code?: string
    sqlState?: string
    databaseErrorCode?: TsSqlDatabaseErrorCode
    databaseErrorNumber?: TsSqlDatabaseErrorNumber
    message?: string
}

export function getMySqlMariaDbEngineErrorReason(error: MySqlMariaDbEngineError): TsSqlErrorReason {
    const code = error.code || ''
    const sqlState = error.sqlState || ''
    const message = error.message || ''
    const databaseErrorMessage = message || undefined
    const errorNumber = getMySqlMariaDbErrorNumber(error.errno, code, error.database)
    const databaseErrorCode = error.databaseErrorCode ?? getMySqlMariaDbDatabaseErrorCode(error, errorNumber)
    const databaseErrorNumber = error.databaseErrorNumber ?? getMySqlMariaDbDatabaseErrorNumber(error, errorNumber)
    const reasonCode = code || (typeof databaseErrorCode === 'string' ? databaseErrorCode : '')

    const reason = getMySqlMariaDbErrorReasonFromNumber(errorNumber, reasonCode, error.database, databaseErrorCode, databaseErrorMessage, message)
        || getMySqlMariaDbErrorReasonFromSqlState(sqlState, databaseErrorCode, databaseErrorMessage, message)
        || getMySqlMariaDbErrorReasonFromSymbol(reasonCode, databaseErrorCode, databaseErrorMessage, message)
        || getMySqlMariaDbErrorReasonFromMessage(message, databaseErrorCode, databaseErrorMessage)
        || getMySqlMariaDbKnownErrorFallbackReason(errorNumber, reasonCode, error.database, databaseErrorCode, databaseErrorMessage)
        || { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }

    return withDatabaseErrorNumber(reason, databaseErrorNumber)
}

function getMySqlMariaDbErrorReasonFromNumber(
    errorNumber: number | undefined,
    code: string,
    database: DatabaseType | undefined,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined,
    message: string
): TsSqlErrorReason | undefined {
    if (typeof errorNumber !== 'number') {
        return undefined
    }

    const upperCode = code.toUpperCase()
    const mariaDbSymbolReason = getMariaDbSpecificSymbolReasonFromNumber(upperCode, databaseErrorCode, databaseErrorMessage, message)
    if (mariaDbSymbolReason) {
        return mariaDbSymbolReason
    }

    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_DUPLICATE_CONSTRAINT_ERROR_NUMBERS, database, code, 'unique')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'unique', constraintName: extractKeyName(message), tableName: extractMessageTableName(message) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_NOT_NULL_CONSTRAINT_ERROR_NUMBERS, database, code, 'not_null')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'not null', columnName: extractQuotedName(message), tableName: extractMessageTableName(message) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_FOREIGN_KEY_CONSTRAINT_ERROR_NUMBERS, database, code, 'foreign_key')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'foreign key', constraintName: extractKeyName(message), tableName: extractConstraintTableName(message), columnName: extractForeignKeyColumnName(message) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_CHECK_CONSTRAINT_ERROR_NUMBERS, database, code, 'check')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'check', constraintName: extractKeyName(message), tableName: extractCheckTableName(message) }
    }
    if (errorNumber === 1215) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid definition' }
    }

    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_INVALID_VALUE_TOO_LONG_ERROR_NUMBERS, database, code, 'too_long')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'too long', columnName: extractQuotedName(message) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_INVALID_VALUE_OUT_OF_RANGE_ERROR_NUMBERS, database, code, 'out_of_range')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'out of range' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_INVALID_JSON_ERROR_NUMBERS, database, code, 'invalid_json')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid json', columnName: extractQuotedName(message) }
    }
    if (hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_INVALID_ENCODING_ERROR_NUMBERS, database, code, 'invalid_encoding')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid encoding', columnName: extractQuotedName(message) }
    }
    if (hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_INVALID_FORMAT_ERROR_NUMBERS, database, code, 'invalid_format')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid format', columnName: extractQuotedName(message) }
    }
    if (hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_INVALID_VALUE_ERROR_NUMBERS, database, code, 'invalid_value')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid value', columnName: extractQuotedName(message) }
    }
    if (hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_SEQUENCE_LIMIT_ERROR_NUMBERS, database, code, 'sequence_limit')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'sequence limit' }
    }
    if (errorNumber === 1138 || errorNumber === 1263) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'null not allowed', columnName: extractQuotedName(message) }
    }
    if (errorNumber === 1292 || errorNumber === 1366 || errorNumber === 1367 || errorNumber === 1411 || errorNumber === 1416 || hasMySqlSemanticErrorNumber(errorNumber, MYSQL_DATA_TRUNCATED_ERROR_NUMBERS, database, code, 'invalid_value')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid value', columnName: extractQuotedName(message) }
    }
    if (errorNumber === 1139) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid regular expression' }
    }

    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_DATABASE_NOT_FOUND_ERROR_NUMBERS, database, code, 'object_not_found')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'database', objectName: extractQuotedName(message) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_TABLE_NOT_FOUND_ERROR_NUMBERS, database, code, 'object_not_found')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'table or view', objectName: extractQuotedName(message), tableName: extractQuotedName(message) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_COLUMN_NOT_FOUND_ERROR_NUMBERS, database, code, 'object_not_found')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_ROUTINE_NOT_FOUND_ERROR_NUMBERS, database, code, 'object_not_found')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'routine', objectName: extractQuotedName(message) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_INDEX_NOT_FOUND_ERROR_NUMBERS, database, code, 'object_not_found')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'index', objectName: extractQuotedName(message) }
    }
    if (hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_ROLE_NOT_FOUND_ERROR_NUMBERS, database, code, 'object_not_found')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'role', objectName: extractQuotedName(message) }
    }
    if (hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_SEQUENCE_NOT_FOUND_ERROR_NUMBERS, database, code, 'object_not_found')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'sequence', objectName: extractQuotedName(message) }
    }
    if (hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_TRIGGER_NOT_FOUND_ERROR_NUMBERS, database, code, 'object_not_found')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'trigger', objectName: extractQuotedName(message) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, MYSQL_COLLATION_NOT_FOUND_ERROR_NUMBERS, database, code, 'object_not_found')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'collation', objectName: extractQuotedName(message) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, MYSQL_OBJECT_NOT_FOUND_EXTRA_ERROR_NUMBERS, database, code, 'object_not_found')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
    }

    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_DATABASE_ALREADY_EXISTS_ERROR_NUMBERS, database, code, 'object_already_exists')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'database', objectName: extractQuotedName(message) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_TABLE_ALREADY_EXISTS_ERROR_NUMBERS, database, code, 'object_already_exists')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'table or view', objectName: extractQuotedName(message), tableName: extractQuotedName(message) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_COLUMN_ALREADY_EXISTS_ERROR_NUMBERS, database, code, 'object_already_exists')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_ROUTINE_ALREADY_EXISTS_ERROR_NUMBERS, database, code, 'object_already_exists')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'routine', objectName: extractQuotedName(message) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_INDEX_ALREADY_EXISTS_ERROR_NUMBERS, database, code, 'object_already_exists')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'index', objectName: extractQuotedName(message) }
    }
    if (hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_OBJECT_ALREADY_EXISTS_ERROR_NUMBERS, database, code, 'object_already_exists')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, MYSQL_OBJECT_ALREADY_EXISTS_EXTRA_ERROR_NUMBERS, database, code, 'object_already_exists')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
    }

    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_AMBIGUOUS_IDENTIFIER_ERROR_NUMBERS, database, code, 'ambiguous_identifier')) {
        return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode, databaseErrorMessage, identifier: extractQuotedName(message), identifierErrorType: errorNumber === 1066 ? 'duplicate' : 'ambiguous' }
    }
    if (hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_DUPLICATE_IDENTIFIER_ERROR_NUMBERS, database, code, 'ambiguous_identifier')) {
        return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode, databaseErrorMessage, identifier: extractQuotedName(message), identifierErrorType: 'duplicate' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_SYNTAX_ERROR_NUMBERS, database, code, 'syntax')) {
        return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (errorNumber === 1365) {
        return { reason: 'SQL_DIVISION_BY_ZERO', databaseErrorCode, databaseErrorMessage }
    }
    if (errorNumber === 1172 || errorNumber === 1222 || errorNumber === 1241 || errorNumber === 1242 || errorNumber === 1058 || errorNumber === 1136 || hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_CARDINALITY_ERROR_NUMBERS, database, code, 'cardinality')) {
        return { reason: 'SQL_CARDINALITY_VIOLATION', databaseErrorCode, databaseErrorMessage }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_INVALID_PARAMETER_ERROR_NUMBERS, database, code, 'invalid_parameter')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, ...getInvalidParameterDetailsFromMessage(message) }
    }
    if (hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_ROUTINE_ERROR_NUMBERS, database, code, 'routine')) {
        return { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_PERMISSION_DENIED_ERROR_NUMBERS, database, code, 'permission')) {
        return { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode, databaseErrorMessage }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_AUTHENTICATION_ERROR_NUMBERS, database, code, 'authentication')) {
        return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_AUTHORIZATION_ERROR_NUMBERS, database, code, 'authorization')) {
        return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, MYSQL_EXTERNAL_DATA_SOURCE_ERROR_NUMBERS, database, code, 'external_data_source') || hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_EXTERNAL_DATA_SOURCE_ERROR_NUMBERS, database, code, 'external_data_source')) {
        return { reason: 'SQL_EXTERNAL_DATA_SOURCE_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_STATEMENT_TIMEOUT_ERROR_NUMBERS, database, code, 'timeout')) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'statement' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_CONNECTION_TIMEOUT_ERROR_NUMBERS, database, code, 'timeout')) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'connection' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_CONNECTION_ERROR_NUMBERS, database, code, 'connection')) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: getConnectionErrorTypeFromNumber(errorNumber) }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_RESOURCE_CONNECTION_ERROR_NUMBERS, database, code, 'resource_connections')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'connections' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_RESOURCE_MEMORY_ERROR_NUMBERS, database, code, 'resource_memory')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'memory' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_RESOURCE_DISK_ERROR_NUMBERS, database, code, 'resource_disk')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'disk' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_RESOURCE_LIMIT_ERROR_NUMBERS, database, code, 'resource_limit')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_IO_READ_ERROR_NUMBERS, database, code, 'io_read')) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'read' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_IO_WRITE_ERROR_NUMBERS, database, code, 'io_write')) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'write' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_IO_CLOSE_ERROR_NUMBERS, database, code, 'io_close')) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'close' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_IO_DELETE_ERROR_NUMBERS, database, code, 'io_delete')) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'delete' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_IO_LOCK_ERROR_NUMBERS, database, code, 'io_lock')) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'lock' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_IO_UNLOCK_ERROR_NUMBERS, database, code, 'io_unlock')) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'unlock' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_IO_FILE_STAT_ERROR_NUMBERS, database, code, 'io_file_stat')) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'file stat' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_IO_FILE_NOT_FOUND_ERROR_NUMBERS, database, code, 'io_file_not_found')) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'file not found' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_IO_ACCESS_ERROR_NUMBERS, database, code, 'io_access')) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'access' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_IO_FSYNC_ERROR_NUMBERS, database, code, 'io_fsync')) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'fsync' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_IO_SEEK_ERROR_NUMBERS, database, code, 'io_seek')) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'seek' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_IO_PATH_ERROR_NUMBERS, database, code, 'io_path')) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'path' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_CONFIGURATION_ERROR_NUMBERS, database, code, 'configuration')) {
        return { reason: 'SQL_CONFIGURATION_ERROR', databaseErrorCode, databaseErrorMessage, configurationErrorType: 'runtime parameter' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_DATABASE_CORRUPTED_ERROR_NUMBERS, database, code, 'database_corrupted')) {
        return { reason: 'SQL_DATABASE_CORRUPTED', databaseErrorCode, databaseErrorMessage, corruptionType: getCorruptionTypeFromNumber(errorNumber) }
    }
    if (hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_SEQUENCE_CORRUPTED_ERROR_NUMBERS, database, code, 'sequence_corrupted')) {
        return { reason: 'SQL_DATABASE_CORRUPTED', databaseErrorCode, databaseErrorMessage, corruptionType: 'sequence' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_READ_ONLY_ERROR_NUMBERS, database, code, 'read_only')) {
        return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode, databaseErrorMessage }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_FEATURE_NOT_SUPPORTED_ERROR_NUMBERS, database, code, 'feature_not_supported')) {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_INVALID_DEFINITION_ERROR_NUMBERS, database, code, 'invalid_definition')) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid definition' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_INVALID_REFERENCE_ERROR_NUMBERS, database, code, 'invalid_reference')) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid reference' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_INVALID_GROUPING_ERROR_NUMBERS, database, code, 'invalid_grouping')) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid grouping' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_INVALID_IDENTIFIER_ERROR_NUMBERS, database, code, 'invalid_identifier')) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid identifier' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_INVALID_STATEMENT_CONTEXT_ERROR_NUMBERS, database, code, 'invalid_statement_context')) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid statement context' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_TRANSACTION_DEADLOCK_ERROR_NUMBERS, database, code, 'transaction_deadlock')) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'deadlock' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_TRANSACTION_TIMEOUT_ERROR_NUMBERS, database, code, 'transaction_timeout')) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'lock' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_TRANSACTION_ACTIVE_ERROR_NUMBERS, database, code, 'transaction_active')) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'active transaction' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_TRANSACTION_ROLLBACK_ERROR_NUMBERS, database, code, 'transaction_rollback')) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'transaction rolled back' }
    }
    if (hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_TRANSACTION_OUTCOME_UNKNOWN_ERROR_NUMBERS, database, code, 'transaction_outcome_unknown')) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'outcome unknown' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_CURSOR_INVALID_STATE_ERROR_NUMBERS, database, code, 'cursor_invalid_state')) {
        return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectType: 'cursor', objectStateErrorType: 'invalid state' }
    }
    if (hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_WRONG_OBJECT_TYPE_ERROR_NUMBERS, database, code, 'wrong_object_type')) {
        return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectType: getWrongObjectTypeFromNumber(errorNumber), objectName: extractQuotedName(message), objectStateErrorType: 'wrong object type' }
    }
    if (hasMariaDbSemanticErrorNumber(errorNumber, ErrorCodes.MARIADB_OBJECT_INVALID_STATE_ERROR_NUMBERS, database, code, 'object_invalid_state')) {
        return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message), objectStateErrorType: 'invalid state' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, ErrorCodes.MYSQL_API_MISUSE_ERROR_NUMBERS, database, code, 'api_misuse')) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'api misuse' }
    }
    if (errorNumber === 1317) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'cancelled' }
    }
    if (hasMySqlSemanticErrorNumber(errorNumber, MYSQL_DEPENDENT_OBJECTS_STILL_EXIST_ERROR_NUMBERS, database, code, 'object_invalid_state')) {
        return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectStateErrorType: 'dependent objects still exist' }
    }

    return undefined
}

type SemanticErrorCategory =
    'ambiguous_identifier'
    | 'api_misuse'
    | 'authentication'
    | 'authorization'
    | 'cardinality'
    | 'check'
    | 'configuration'
    | 'connection'
    | 'cursor_invalid_state'
    | 'database_corrupted'
    | 'external_data_source'
    | 'feature_not_supported'
    | 'foreign_key'
    | 'invalid_definition'
    | 'invalid_encoding'
    | 'invalid_format'
    | 'invalid_grouping'
    | 'invalid_identifier'
    | 'invalid_json'
    | 'invalid_parameter'
    | 'invalid_reference'
    | 'invalid_statement_context'
    | 'invalid_value'
    | 'io_access'
    | 'io_close'
    | 'io_delete'
    | 'io_file_not_found'
    | 'io_file_stat'
    | 'io_fsync'
    | 'io_lock'
    | 'io_path'
    | 'io_read'
    | 'io_seek'
    | 'io_unlock'
    | 'io_write'
    | 'not_null'
    | 'object_already_exists'
    | 'object_invalid_state'
    | 'object_not_found'
    | 'out_of_range'
    | 'permission'
    | 'read_only'
    | 'resource_connections'
    | 'resource_disk'
    | 'resource_limit'
    | 'resource_memory'
    | 'routine'
    | 'sequence_corrupted'
    | 'sequence_limit'
    | 'syntax'
    | 'timeout'
    | 'too_long'
    | 'transaction_active'
    | 'transaction_deadlock'
    | 'transaction_outcome_unknown'
    | 'transaction_rollback'
    | 'transaction_timeout'
    | 'unique'
    | 'wrong_object_type'

function hasMySqlSemanticErrorNumber(
    errorNumber: number,
    errorNumbers: Set<number>,
    database: DatabaseType | undefined,
    code: string,
    category: SemanticErrorCategory
): boolean {
    if (!errorNumbers.has(errorNumber)) {
        return false
    }
    if (isCodeCompatibleWithSemanticCategory(code, category)) {
        return true
    }
    if (!database) {
        return getMySqlMariaDbErrorCodeName(errorNumber) !== undefined
    }

    const activeCode = getMySqlMariaDbErrorCodeName(errorNumber, database)
    if (!activeCode) {
        return false
    }
    if (!isCollidingErrorNumber(errorNumber)) {
        return true
    }
    return isCodeCompatibleWithSemanticCategory(activeCode, category)
}

function hasMariaDbSemanticErrorNumber(
    errorNumber: number,
    errorNumbers: Set<number>,
    database: DatabaseType | undefined,
    code: string,
    category: SemanticErrorCategory
): boolean {
    if (!errorNumbers.has(errorNumber)) {
        return false
    }
    if (database === 'mariaDB') {
        return getMySqlMariaDbErrorCodeName(errorNumber, 'mariaDB') !== undefined
            || isCodeCompatibleWithSemanticCategory(code, category)
    }
    if (database === 'mySql') {
        const mySqlCode = getMySqlMariaDbErrorCodeName(errorNumber, 'mySql')
        const mariaDbCode = getMySqlMariaDbErrorCodeName(errorNumber, 'mariaDB')
        return !!mySqlCode && mySqlCode === mariaDbCode
    }
    if (isCodeCompatibleWithSemanticCategory(code, category)) {
        return true
    }
    return getMySqlMariaDbErrorCodeName(errorNumber) !== undefined
}

function isCollidingErrorNumber(errorNumber: number): boolean {
    const mySqlCode = getMySqlMariaDbErrorCodeName(errorNumber, 'mySql')
    const mariaDbCode = getMySqlMariaDbErrorCodeName(errorNumber, 'mariaDB')
    return !!mySqlCode && !!mariaDbCode && mySqlCode !== mariaDbCode
}

function isCodeCompatibleWithSemanticCategory(code: string, category: SemanticErrorCategory): boolean {
    const upperCode = code.toUpperCase()
    if (!upperCode) {
        return false
    }

    switch (category) {
        case 'ambiguous_identifier':
            return upperCode.includes('AMBIGUOUS') || upperCode.includes('DUP') || upperCode.includes('DUPLICATE')
        case 'api_misuse':
            return upperCode.startsWith('CR_') || upperCode.includes('COMMAND') || upperCode.includes('PACKET') || upperCode.includes('SYNC')
        case 'authentication':
            return upperCode.includes('AUTH') || upperCode.includes('PASSWORD') || upperCode.includes('USER_IS_BLOCKED')
        case 'authorization':
        case 'permission':
            return upperCode.includes('ACCESS_DENIED') || upperCode.includes('PRIVILEGE') || upperCode.includes('PERMISSION') || upperCode.includes('ACCOUNT_HAS_BEEN_LOCKED') || upperCode.includes('LOAD_INFILE_CAPABILITY_DISABLED')
        case 'cardinality':
            return upperCode.includes('CARDINALITY') || upperCode.includes('WRONG_NUMBER') || upperCode.includes('WRONG_LIST') || upperCode.includes('COL_WRONG_LIST')
        case 'check':
            return upperCode.includes('CHECK_CONSTRAINT') || upperCode.includes('CONSTRAINT_FAILED')
        case 'configuration':
            return upperCode.includes('CONFIG') || upperCode.includes('VARIABLE') || upperCode.includes('OPTION') || upperCode.includes('PERSIST') || upperCode.includes('CF_') || upperCode.includes('TRANSPORT')
        case 'connection':
            return upperCode.includes('CONNECTION') || upperCode.includes('CONNECT') || upperCode.includes('SOCKET') || upperCode.includes('HANDSHAKE') || upperCode.includes('SERVER_LOST') || upperCode.includes('SERVER_GONE') || upperCode.includes('NET_READ') || upperCode.includes('NET_WRITE')
        case 'cursor_invalid_state':
            return upperCode.includes('CURSOR')
        case 'database_corrupted':
            return upperCode.includes('CORRUPT') || upperCode.includes('INCONSISTENCY') || upperCode.includes('METADATA')
        case 'external_data_source':
            return upperCode.includes('REPLICA') || upperCode.includes('SOURCE') || upperCode.includes('SLAVE') || upperCode.includes('MASTER') || upperCode.includes('GTID') || upperCode.includes('RPL') || upperCode.includes('BINLOG') || upperCode.includes('GROUP_REPLICATION') || upperCode.startsWith('CR_PROBE_')
        case 'feature_not_supported':
            return upperCode.includes('NOT_SUPPORTED') || upperCode.includes('UNSUPPORTED') || upperCode.includes('NOT_IMPLEMENTED') || upperCode.includes('DISABLED') || upperCode.includes('PROHIBITED')
        case 'foreign_key':
            return upperCode.includes('FOREIGN') || upperCode.includes('REFERENCED')
        case 'invalid_definition':
            return upperCode.includes('DEFAULT') || upperCode.includes('DEFINITION') || upperCode.includes('WINDOW') || upperCode.includes('FRAME') || upperCode.includes('PARTITION') || upperCode.includes('PERIOD') || upperCode.includes('VERS') || upperCode.includes('PRIMARY_KEY') || upperCode.includes('RECURSIVE') || upperCode.includes('NTILE') || upperCode.includes('TABLE_NO_PRIMARY_KEY')
        case 'invalid_encoding':
            return upperCode.includes('ENCODING') || upperCode.includes('CHARSET') || upperCode.includes('COLLATION')
        case 'invalid_format':
            return upperCode.includes('FORMAT') || upperCode.includes('SFORMAT') || upperCode.includes('COMPRESSION_METHOD') || upperCode.includes('TIMESTAMP_FORMAT')
        case 'invalid_grouping':
            return upperCode.includes('GROUP') || upperCode.includes('SUM_FUNC') || upperCode.includes('WINDOW_FUNC')
        case 'invalid_identifier':
            return upperCode.includes('IDENT') || upperCode.includes('VARIABLE') || upperCode.includes('STRUCTURED') || upperCode.includes('FIELD') || upperCode.includes('COLUMN')
        case 'invalid_json':
            return upperCode.includes('JSON') || upperCode.includes('GEOJSON')
        case 'invalid_parameter':
            return upperCode.includes('PARAM') || upperCode.includes('ARGUMENT') || upperCode.includes('PLACEHOLDER') || upperCode.includes('BIND') || upperCode.includes('COUNT') || upperCode.includes('BAD_REPLICA_UNTIL_COND') || upperCode.includes('BAD_SLAVE_UNTIL_COND')
        case 'invalid_reference':
            return upperCode.includes('REF') || upperCode.includes('REFERENCE') || upperCode.includes('RECURSIVE') || upperCode.includes('UNINIT') || upperCode.includes('NOT_EMPTY')
        case 'invalid_statement_context':
            return upperCode.includes('CONTEXT') || upperCode.includes('COMMAND') || upperCode.includes('PLACEMENT') || upperCode.includes('NOT_ALLOWED') || upperCode.includes('ONLY_ONCE') || upperCode.includes('NEED_REBUILD')
        case 'invalid_value':
            return upperCode.includes('VALUE') || upperCode.includes('WRONG') || upperCode.includes('ILLEGAL') || upperCode.includes('ARGUMENT') || upperCode.includes('TYPE') || upperCode.includes('TRUNCATED') || upperCode.includes('PARAMETER_DATA') || upperCode.includes('KEYS_OUT_OF_ORDER') || upperCode.includes('OVERLAPPING_KEYS') || upperCode.includes('TTL') || upperCode.includes('GIS') || upperCode.includes('GEOMETRY')
        case 'io_access':
            return upperCode.includes('ACCESS')
        case 'io_close':
            return upperCode.includes('CLOSE')
        case 'io_delete':
            return upperCode.includes('DELETE') || upperCode.includes('REMOVE')
        case 'io_file_not_found':
            return upperCode.includes('FILE') && (upperCode.includes('NOT_FOUND') || upperCode.includes('MISSING') || upperCode.includes('NO_SUCH'))
        case 'io_file_stat':
            return upperCode.includes('STAT')
        case 'io_fsync':
            return upperCode.includes('FSYNC')
        case 'io_lock':
            return upperCode.includes('LOCK')
        case 'io_path':
            return upperCode.includes('PATH') || upperCode.includes('DIR')
        case 'io_read':
            return hasSymbolWord(upperCode, 'READ')
        case 'io_seek':
            return upperCode.includes('SEEK')
        case 'io_unlock':
            return upperCode.includes('UNLOCK')
        case 'io_write':
            return hasSymbolWord(upperCode, 'WRITE')
        case 'not_null':
            return upperCode.includes('NOT_NULL') || upperCode.includes('NULL_TO_NOTNULL')
        case 'object_already_exists':
            return upperCode.includes('ALREADY_EXISTS') || upperCode.includes('CREATE_EXISTS') || upperCode.includes('TABLE_EXISTS') || upperCode.includes('PLUGIN_INSTALLED')
        case 'object_invalid_state':
            return upperCode.includes('ALREADY') || upperCode.includes('ACTIVE') || upperCode.includes('NOT_RUNNING') || upperCode.includes('WRONG_STAGE') || upperCode.includes('SEQUENCE_ACCESS') || upperCode.includes('CANT_MODIFY')
        case 'object_not_found':
            return isObjectNotFoundSymbol(upperCode)
        case 'out_of_range':
            return upperCode.includes('OUT_OF_RANGE') || upperCode.includes('OVERFLOW') || upperCode.includes('TOO_BIG') || upperCode.includes('INVALID_LATITUDE') || upperCode.includes('INVALID_LONGITUDE') || upperCode.includes('INVALID_HEIGHT') || upperCode.includes('INVALID_SCALING') || upperCode.includes('INVALID_ZONE') || upperCode.includes('PART_WRONG_VALUE')
        case 'read_only':
            return upperCode.includes('READ_ONLY') || upperCode.includes('READONLY')
        case 'resource_connections':
            return upperCode.includes('CONNECTION') || upperCode.includes('TOO_MANY_USER_CONNECTIONS')
        case 'resource_disk':
            return upperCode.includes('DISK') || upperCode.includes('FILE_FULL') || upperCode.includes('INDEX_FILE_FULL')
        case 'resource_limit':
            return upperCode.includes('TOO_MANY') || upperCode.includes('LIMIT') || upperCode.includes('EXCEEDS') || upperCode.includes('TOO_BIG') || upperCode.includes('TOO_LARGE')
        case 'resource_memory':
            return upperCode.includes('MEMORY') || upperCode.includes('OUT_OF_MEMORY')
        case 'routine':
            return upperCode.includes('ROUTINE') || upperCode.includes('FUNCTION') || upperCode.includes('STD_LOGIC') || upperCode.includes('STD_RUNTIME') || upperCode.includes('EVALUATING_EXPRESSION') || upperCode.includes('CALCULATING_DEFAULT_VALUE') || upperCode.includes('SFORMAT')
        case 'sequence_corrupted':
            return upperCode.includes('SEQUENCE_INVALID')
        case 'sequence_limit':
            return upperCode.includes('SEQUENCE_RUN_OUT')
        case 'syntax':
            return upperCode.includes('SYNTAX') || upperCode.includes('PARSE')
        case 'timeout':
        case 'transaction_timeout':
            return upperCode.includes('TIMEOUT') || upperCode.includes('TIMEDOUT') || upperCode.includes('INTERRUPTED')
        case 'too_long':
            return upperCode.includes('TOO_LONG') || upperCode.includes('LENGTH') || upperCode.includes('OVERLONG') || upperCode.includes('MAX_SIZE')
        case 'transaction_active':
            return upperCode.includes('TRANSACTION') || upperCode.includes('CONSISTENT_SNAPSHOT') || upperCode.includes('SKIP_REPLICATION')
        case 'transaction_deadlock':
            return upperCode.includes('DEADLOCK')
        case 'transaction_outcome_unknown':
            return upperCode.includes('OUTCOME') || upperCode.includes('UNKNOWN')
        case 'transaction_rollback':
            return upperCode.includes('ROLLBACK') || upperCode.includes('ROLLED_BACK')
        case 'unique':
            return upperCode.includes('DUP') || upperCode.includes('UNIQUE')
        case 'wrong_object_type':
            return upperCode.includes('NOT_SEQUENCE') || upperCode.includes('IT_IS_A_VIEW') || upperCode.includes('VERS_NOT_VERSIONED')
    }
    return false
}

function getMariaDbSpecificSymbolReasonFromNumber(
    upperCode: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined,
    message: string
): TsSqlErrorReason | undefined {
    switch (upperCode) {
        case 'ER_CONSTRAINT_FAILED':
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'check', constraintName: extractKeyName(message), tableName: extractCheckTableName(message) }
        case 'ER_INNODB_AUTOEXTEND_SIZE_OUT_OF_RANGE':
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'out of range' }
        case 'ER_NOT_AGGREGATE_FUNCTION':
        case 'ER_INVALID_AGGREGATE_FUNCTION':
            return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid statement context' }
        case 'ER_VERS_NOT_VERSIONED':
            return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectType: 'table', objectName: extractQuotedName(message), objectStateErrorType: 'wrong object type' }
        case 'ER_MISSING':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'missing' }
        case 'ER_VERS_PERIOD_COLUMNS':
            return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid definition' }
    }

    return undefined
}

function getMySqlMariaDbErrorReasonFromSqlState(
    sqlState: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined,
    message: string
): TsSqlErrorReason | undefined {
    if (!sqlState || sqlState === 'HY000') {
        return undefined
    }

    switch (sqlState) {
        case '01000':
        case '01S00':
        case '01S01':
        case '02000':
            return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
        case '0A000':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
        case '0K000':
        case '0Z002':
            return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid statement context' }
        case '20000':
            return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'case not found' }
        case '22001':
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'too long', columnName: extractQuotedName(message) }
        case '22003':
        case '22008':
        case '2201E':
        case '22S02':
        case '22S03':
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'out of range' }
        case '22004':
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'null not allowed', columnName: extractQuotedName(message) }
        case '22007':
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid format' }
        case '22012':
            return { reason: 'SQL_DIVISION_BY_ZERO', databaseErrorCode, databaseErrorMessage }
        case '22018':
        case '22032':
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid json', columnName: extractQuotedName(message) }
        case '22023':
        case '22034':
        case '22035':
        case '2203F':
        case '22S00':
        case '22S01':
        case '22S04':
        case '22S05':
        case 'SR000':
        case 'SR002':
        case 'SR003':
        case 'SR006':
        case 'SU001':
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid value' }
        case '23000':
            return getConstraintReasonFromMessage(message, databaseErrorCode, databaseErrorMessage)
        case '24000':
            return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectType: 'cursor', objectStateErrorType: 'invalid state' }
        case '25000':
        case '25001':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'active transaction' }
        case '25006':
            return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode, databaseErrorMessage }
        case '2F003':
        case '2F005':
            return { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode, databaseErrorMessage }
        case '35000':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'invalid index' }
        case '3D000':
        case '42Y07':
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'database', objectName: extractQuotedName(message) }
        case '40000':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'transaction rolled back' }
        case '40001':
            return message.toLowerCase().includes('deadlock')
                ? { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'deadlock' }
                : { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'serialization failure' }
        case '42000':
            return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage }
        case '42S01':
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'table or view', objectName: extractQuotedName(message), tableName: extractQuotedName(message) }
        case '42S02':
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'table or view', objectName: extractQuotedName(message), tableName: extractQuotedName(message) }
        case '42S12':
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'index', objectName: extractQuotedName(message) }
        case '42S21':
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
        case '42S22':
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
        case '70100':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'cancelled' }
        case 'HY001':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'memory' }
        case 'SR001':
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
        case 'SR004':
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
        case 'SR005':
            return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectStateErrorType: 'dependent objects still exist' }
        case 'XA100':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'transaction rolled back' }
        case 'XA102':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'deadlock' }
        case 'XA106':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'transaction' }
        case 'XAE03':
        case 'XAE07':
        case 'XAE09':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid state' }
        case 'XAE04':
        case 'XAE05':
        case 'XAE08':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'invalid value' }
    }

    if (sqlState.startsWith('08')) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (sqlState.startsWith('21')) {
        return { reason: 'SQL_CARDINALITY_VIOLATION', databaseErrorCode, databaseErrorMessage }
    }
    if (sqlState.startsWith('22')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid value' }
    }
    if (sqlState.startsWith('23')) {
        return getConstraintReasonFromMessage(message, databaseErrorCode, databaseErrorMessage)
    }
    if (sqlState.startsWith('28')) {
        return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (sqlState.startsWith('42')) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage }
    }

    return undefined
}

function getMySqlMariaDbErrorReasonFromSymbol(
    code: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined,
    message: string
): TsSqlErrorReason | undefined {
    if (!code) {
        return undefined
    }

    const upperCode = code.toUpperCase()
    if (!upperCode.startsWith('ER_')) {
        return undefined
    }

    if (upperCode.includes('DUP') || upperCode.includes('UNIQUE')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'unique', constraintName: extractKeyName(message), tableName: extractMessageTableName(message) }
    }
    if (upperCode.includes('FOREIGN') || upperCode.includes('REFERENCED')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'foreign key', constraintName: extractKeyName(message), tableName: extractConstraintTableName(message), columnName: extractForeignKeyColumnName(message) }
    }
    if (upperCode.includes('CHECK_CONSTRAINT') || upperCode.includes('CONSTRAINT_FAILED')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'check', constraintName: extractKeyName(message), tableName: extractCheckTableName(message) }
    }
    if (upperCode.includes('SEQUENCE_RUN_OUT')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'sequence limit' }
    }
    if (upperCode.includes('NOT_SEQUENCE') || upperCode.includes('IT_IS_A_VIEW')) {
        return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectStateErrorType: 'wrong object type', objectName: extractQuotedName(message) }
    }
    if (isObjectNotFoundSymbol(upperCode)) {
        return getObjectNotFoundFromSymbol(upperCode, databaseErrorCode, databaseErrorMessage, message)
    }
    if (upperCode.includes('ALREADY_EXISTS') || upperCode.includes('CREATE_EXISTS') || upperCode.includes('TABLE_EXISTS')) {
        return getObjectAlreadyExistsFromSymbol(upperCode, databaseErrorCode, databaseErrorMessage, message)
    }
    if (upperCode.includes('ACCESS_DENIED') || upperCode.includes('AUTH')) {
        return upperCode.includes('AUTH') ? { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage } : { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode, databaseErrorMessage }
    }
    if (upperCode.includes('TIMEOUT') || upperCode.includes('INTERRUPTED') || upperCode.includes('CANCELED')) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: upperCode.includes('LOCK') ? 'lock' : 'connection' }
    }
    if (upperCode.includes('READ_ONLY') || upperCode.includes('READONLY')) {
        return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode, databaseErrorMessage }
    }
    if (upperCode.includes('OUT_OF_MEMORY') || upperCode.includes('OUTOFMEMORY')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'memory' }
    }
    if (upperCode.includes('DISK_FULL') || upperCode.includes('FILE_FULL')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'disk' }
    }
    if (upperCode.includes('CONNECTION') || upperCode.includes('SOCKET') || upperCode.includes('HANDSHAKE') || upperCode.includes('SERVER_LOST') || upperCode.includes('SERVER_GONE')) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (upperCode.includes('SYNTAX') || upperCode.includes('PARSE')) {
        return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (upperCode.includes('NOT_SUPPORTED') || upperCode.includes('NOT_IMPLEMENTED')) {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
    }

    return undefined
}

function getMySqlMariaDbErrorReasonFromMessage(
    message: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined
): TsSqlErrorReason | undefined {
    const lower = message.toLowerCase()
    if (!lower) {
        return undefined
    }

    if (lower.includes('duplicate entry') || lower.includes('duplicate key') || lower.includes('unique constraint')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'unique', constraintName: extractKeyName(message), tableName: extractMessageTableName(message) }
    }
    if (lower.includes('foreign key constraint')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'foreign key', constraintName: extractKeyName(message), tableName: extractConstraintTableName(message), columnName: extractForeignKeyColumnName(message) }
    }
    if (lower.includes('cannot be null') || lower.includes('not null')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'not null', columnName: extractQuotedName(message), tableName: extractMessageTableName(message) }
    }
    if (lower.includes('check constraint')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'check', constraintName: extractKeyName(message), tableName: extractCheckTableName(message) }
    }
    if (lower.includes('unknown database') || lower.includes('no database selected')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'database', objectName: extractQuotedName(message) }
    }
    if (lower.includes("table") && (lower.includes("doesn't exist") || lower.includes('unknown table'))) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'table or view', objectName: extractQuotedName(message), tableName: extractQuotedName(message) }
    }
    if (lower.includes('unknown column')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
    }
    if (lower.includes('already exists')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
    }
    if (lower.includes('ambiguous')) {
        return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode, databaseErrorMessage, identifier: extractQuotedName(message), identifierErrorType: 'ambiguous' }
    }
    if (lower.includes('syntax')) {
        return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (lower.includes('division by 0') || lower.includes('division by zero')) {
        return { reason: 'SQL_DIVISION_BY_ZERO', databaseErrorCode, databaseErrorMessage }
    }
    if (lower.includes('out of range')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'out of range' }
    }
    if (lower.includes('data too long') || lower.includes('too long')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'too long', columnName: extractQuotedName(message) }
    }
    if (lower.includes('invalid json')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid json', columnName: extractQuotedName(message) }
    }
    if (lower.includes('access denied')) {
        return lower.includes('using password')
            ? { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
            : { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode, databaseErrorMessage }
    }
    if (lower.includes('deadlock')) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'deadlock' }
    }
    if (lower.includes('lock wait timeout')) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'lock' }
    }
    if (lower.includes('query execution was interrupted')) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'cancelled' }
    }
    if (lower.includes('read only') || lower.includes('read-only')) {
        return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode, databaseErrorMessage }
    }
    if (lower.includes('out of memory')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'memory' }
    }
    if (lower.includes('disk is full') || lower.includes('table') && lower.includes(' is full')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'disk' }
    }
    if (lower.includes('too many connections')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'connections' }
    }
    if (lower.includes('lost connection') || lower.includes('server has gone away') || lower.includes("can't connect") || lower.includes('bad handshake')) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (lower.includes('not supported') || lower.includes('not implemented')) {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
    }

    return undefined
}

function getMySqlMariaDbKnownErrorFallbackReason(
    errorNumber: number | undefined,
    code: string,
    database: DatabaseType | undefined,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined
): TsSqlErrorReason | undefined {
    const upperCode = code.toUpperCase()

    // A naked errno that does not exist in the active catalog is just an
    // unknown native number for this database, not a reason to borrow semantics
    // from the other MySQL-family engine.
    if (!upperCode && database && typeof errorNumber === 'number' && !getMySqlMariaDbErrorCodeName(errorNumber, database)) {
        return undefined
    }

    if (upperCode.startsWith('CR_PROBE_')) {
        return { reason: 'SQL_EXTERNAL_DATA_SOURCE_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (upperCode === 'CR_UNKNOWN_ERROR' || errorNumber === 2000) {
        return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
    }
    if (upperCode.startsWith('CR_') || isInRange(errorNumber, 2000, 2999)) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'api misuse' }
    }
    if (upperCode.startsWith('EE_') || isInRange(errorNumber, 1, 999)) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
    }
    if (upperCode.startsWith('ER_') || upperCode.startsWith('MY-') || isInRange(errorNumber, 1000, 5999)) {
        if (upperCode.includes('WARN') || upperCode.includes('NOTE') || upperCode.includes('INFO')) {
            return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
        }
        if (upperCode.includes('REPLICA') || upperCode.includes('SOURCE') || upperCode.includes('SLAVE') || upperCode.includes('MASTER') || upperCode.includes('GTID') || upperCode.includes('RPL') || upperCode.includes('BINLOG') || upperCode.includes('GROUP_REPLICATION')) {
            return { reason: 'SQL_EXTERNAL_DATA_SOURCE_ERROR', databaseErrorCode, databaseErrorMessage }
        }
        if (upperCode.includes('LOCK')) {
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'lock' }
        }
        if (upperCode.includes('FILE') || upperCode.includes('DIR') || hasSymbolWord(upperCode, 'READ') || hasSymbolWord(upperCode, 'WRITE') || hasSymbolWord(upperCode, 'OPEN')) {
            return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'unknown' }
        }
        if (upperCode.includes('WRONG') || upperCode.includes('BAD') || upperCode.includes('INVALID') || upperCode.includes('ILLEGAL') || upperCode.includes('CANT') || upperCode.includes('MISSING')) {
            return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage }
        }
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
    }

    return undefined
}

export function isMySqlMariaDbEngineError(error: unknown): error is MySqlMariaDbEngineError & Error {
    if (!(error instanceof Error)) {
        return false
    }
    const engineError = error as MySqlMariaDbEngineError
    return typeof engineError.errno === 'number' && engineError.errno > 0
        || typeof engineError.sqlState === 'string'
        || isMySqlMariaDbEngineErrorCode(engineError.code)
}

export function isMySqlMariaDbEngineErrorCode(code: unknown): code is string {
    if (typeof code !== 'string') {
        return false
    }
    const normalizedCode = code.toUpperCase()
    return normalizedCode.startsWith('ER_')
        || normalizedCode.startsWith('CR_')
        || normalizedCode.startsWith('EE_')
        || /^MY-0*\d+$/.test(normalizedCode)
        || /^\d+$/.test(normalizedCode)
        || ErrorCodes.MYSQL_MARIADB_ERROR_CODE_NUMBERS.has(normalizedCode)
}

export function getMySqlMariaDbErrorCodeName(errorNumber: number | undefined, database?: DatabaseType): string | undefined {
    if (typeof errorNumber !== 'number') {
        return undefined
    }
    return getErrorNumberCodes(database).get(errorNumber)
}

export function getMySqlMariaDbErrorNumberFromCode(code: string | undefined, database?: DatabaseType): number | undefined {
    return getMySqlMariaDbErrorNumber(undefined, code || '', database)
}

function getMySqlMariaDbErrorNumber(errno: number | undefined, code: string, database?: DatabaseType): number | undefined {
    if (typeof errno === 'number' && errno > 0) {
        return errno
    }
    if (!code) {
        return undefined
    }
    const normalizedCode = code.toUpperCase()
    const mappedNumber = getErrorCodeNumbers(database).get(normalizedCode)
    if (mappedNumber !== undefined) {
        return mappedNumber
    }
    const myErrorNumber = /^MY-0*(\d+)$/.exec(normalizedCode)
    if (myErrorNumber) {
        return Number(myErrorNumber[1])
    }
    if (/^\d+$/.test(normalizedCode)) {
        return Number(normalizedCode)
    }
    return undefined
}

function getErrorCodeNumbers(database?: DatabaseType): Map<string, number> {
    switch (database) {
        case 'mySql':
            return ErrorCodes.MYSQL_ERROR_CODE_NUMBERS
        case 'mariaDB':
            return ErrorCodes.MARIADB_ERROR_CODE_NUMBERS
        default:
            return ErrorCodes.MYSQL_MARIADB_UNAMBIGUOUS_ERROR_CODE_NUMBERS
    }
}

function getErrorNumberCodes(database?: DatabaseType): Map<number, string> {
    switch (database) {
        case 'mySql':
            return ErrorCodes.MYSQL_ERROR_NUMBER_CODES
        case 'mariaDB':
            return ErrorCodes.MARIADB_ERROR_NUMBER_CODES
        default:
            return ErrorCodes.MYSQL_MARIADB_ERROR_NUMBER_CODES
    }
}

function withDatabaseErrorNumber(reason: TsSqlErrorReason, databaseErrorNumber: TsSqlDatabaseErrorNumber | undefined): TsSqlErrorReason {
    if (databaseErrorNumber === undefined) {
        return reason
    }
    return { ...reason, databaseErrorNumber } as TsSqlErrorReason
}

function isInRange(value: number | undefined, min: number, max: number): boolean {
    return typeof value === 'number' && value >= min && value <= max
}

function hasSymbolWord(code: string, word: string): boolean {
    return code === word || code.includes('_' + word + '_') || code.endsWith('_' + word) || code.startsWith(word + '_')
}

function isObjectNotFoundSymbol(code: string): boolean {
    if (code.includes('NO_SUCH') || code.includes('NOT_FOUND') || code.includes('DOES_NOT_EXIST') || code.includes('DROP_EXISTS')) {
        return true
    }
    if (!code.includes('UNKNOWN')) {
        return false
    }
    return code.includes('DB')
        || code.includes('DATABASE')
        || code.includes('TABLE')
        || code.includes('ROLE')
        || code.includes('SEQUENCE')
        || code.includes('TRG')
        || code.includes('TRIGGER')
        || code.includes('FIELD')
        || code.includes('COLUMN')
        || code.includes('PROC')
        || code.includes('ROUTINE')
        || code.includes('SP_')
        || code.includes('FUNCTION')
        || code.includes('UDF')
        || code.includes('KEY')
        || code.includes('INDEX')
        || code.includes('COLLATION')
}

function getConnectionErrorTypeFromNumber(errorNumber: number): 'connection lost' | 'temporarily unavailable' | 'invalid connection configuration' {
    switch (errorNumber) {
        case 1042:
        case 2005:
        case 2019:
        case 2026:
        case 2059:
        case 2064:
        case 2066:
        case 2070:
        case 2074:
        case 2075:
            return 'invalid connection configuration'
        case 1040:
        case 1129:
        case 3032:
            return 'temporarily unavailable'
        default:
            return 'connection lost'
    }
}

function getCorruptionTypeFromNumber(errorNumber: number): 'database file' | 'index' | 'sequence' | 'virtual table' | 'filesystem' | 'checksum' {
    switch (errorNumber) {
        case 1034:
        case 1035:
        case 1712:
            return 'index'
        case 1033:
        case 1194:
        case 1195:
        case 1244:
            return 'database file'
        default:
            return 'checksum'
    }
}

function getWrongObjectTypeFromNumber(errorNumber: number): 'table or view' | 'sequence' {
    switch (errorNumber) {
        case 4089:
        case 4090:
            return 'sequence'
        default:
            return 'table or view'
    }
}

function getInvalidParameterDetailsFromMessage(message: string): {
    parameterErrorType?: 'missing' | 'too many' | 'wrong count' | 'invalid name' | 'invalid index' | 'invalid type' | 'invalid value' | 'invalid binding' | 'not bindable' | 'already bound'
    expectedParameterCount?: number
    actualParameterCount?: number
} {
    const lower = message.toLowerCase()
    const countMatch = /expected\s+(\d+),\s+got\s+(\d+)/i.exec(message)
    if (countMatch) {
        return { parameterErrorType: 'wrong count', expectedParameterCount: Number(countMatch[1]), actualParameterCount: Number(countMatch[2]) }
    }
    if (lower.includes('parameter count') || lower.includes('number of arguments') || lower.includes('wrong no of args')) {
        return { parameterErrorType: 'wrong count' }
    }
    if (lower.includes('not bound') || lower.includes('no data supplied')) {
        return { parameterErrorType: 'missing' }
    }
    if (lower.includes('invalid parameter number') || lower.includes('condition number')) {
        return { parameterErrorType: 'invalid index' }
    }
    if (lower.includes('unsupported buffer type') || lower.includes('incorrect argument type')) {
        return { parameterErrorType: 'invalid type' }
    }
    if (lower.includes('duplicate parameter') || lower.includes('used twice')) {
        return { parameterErrorType: 'already bound' }
    }
    return { parameterErrorType: 'invalid value' }
}

function getConstraintReasonFromMessage(
    message: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined
): TsSqlErrorReason {
    const lower = message.toLowerCase()
    if (lower.includes('foreign key')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'foreign key', constraintName: extractKeyName(message), tableName: extractConstraintTableName(message), columnName: extractForeignKeyColumnName(message) }
    }
    if (lower.includes('cannot be null') || lower.includes('not null')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'not null', columnName: extractQuotedName(message), tableName: extractMessageTableName(message) }
    }
    if (lower.includes('check constraint')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'check', constraintName: extractKeyName(message), tableName: extractCheckTableName(message) }
    }
    if (lower.includes('ambiguous')) {
        return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode, databaseErrorMessage, identifier: extractQuotedName(message), identifierErrorType: 'ambiguous' }
    }
    if (lower.includes('duplicate') || lower.includes('unique')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage, constraintType: 'unique', constraintName: extractKeyName(message), tableName: extractMessageTableName(message) }
    }
    return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
}

function getObjectNotFoundFromSymbol(
    code: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined,
    message: string
): TsSqlErrorReason {
    if (code.includes('DB') || code.includes('DATABASE')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'database', objectName: extractQuotedName(message) }
    }
    if (code.includes('TABLE')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'table or view', objectName: extractQuotedName(message), tableName: extractQuotedName(message) }
    }
    if (code.includes('ROLE')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'role', objectName: extractQuotedName(message) }
    }
    if (code.includes('SEQUENCE')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'sequence', objectName: extractQuotedName(message) }
    }
    if (code.includes('TRG') || code.includes('TRIGGER')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'trigger', objectName: extractQuotedName(message) }
    }
    if (code.includes('FIELD') || code.includes('COLUMN')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
    }
    if (code.includes('PROC') || code.includes('ROUTINE') || code.includes('SP_') || code.includes('FUNCTION') || code.includes('UDF')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'routine', objectName: extractQuotedName(message) }
    }
    if (code.includes('KEY') || code.includes('INDEX')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectType: 'index', objectName: extractQuotedName(message) }
    }
    return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
}

function getObjectAlreadyExistsFromSymbol(
    code: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined,
    message: string
): TsSqlErrorReason {
    if (code.includes('DB') || code.includes('DATABASE')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'database', objectName: extractQuotedName(message) }
    }
    if (code.includes('TABLE')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'table or view', objectName: extractQuotedName(message), tableName: extractQuotedName(message) }
    }
    if (code.includes('SEQUENCE')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'sequence', objectName: extractQuotedName(message) }
    }
    if (code.includes('TRG') || code.includes('TRIGGER')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'trigger', objectName: extractQuotedName(message) }
    }
    if (code.includes('FIELD') || code.includes('COLUMN')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
    }
    if (code.includes('PROC') || code.includes('ROUTINE') || code.includes('SP_') || code.includes('FUNCTION') || code.includes('UDF')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'routine', objectName: extractQuotedName(message) }
    }
    if (code.includes('KEY') || code.includes('INDEX')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectType: 'index', objectName: extractQuotedName(message) }
    }
    return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorMessage, objectName: extractQuotedName(message) }
}

function getMySqlMariaDbDatabaseErrorCode(
    error: MySqlMariaDbEngineError,
    errorNumber: number | undefined
): TsSqlDatabaseErrorCode | undefined {
    const code = error.code || undefined
    if (code) {
        if (/^\d+$/.test(code)) {
            return getMySqlMariaDbErrorCodeName(Number(code), error.database) ?? code
        }
        return code
    }
    return getMySqlMariaDbErrorCodeName(errorNumber, error.database)
}

function getMySqlMariaDbDatabaseErrorNumber(
    error: MySqlMariaDbEngineError,
    errorNumber: number | undefined
): TsSqlDatabaseErrorNumber | undefined {
    return errorNumber ?? (error.sqlState || undefined)
}

function extractQuotedName(message: string): string | undefined {
    const backtick = /`([^`]+)`/.exec(message)
    if (backtick) {
        return backtick[1]
    }
    const singleQuoted = /(^|[^A-Za-z])'([^']+)'(?![A-Za-z])/.exec(message)
    if (singleQuoted) {
        return singleQuoted[2]
    }
    const doubleQuoted = /"([^"]+)"/.exec(message)
    if (doubleQuoted) {
        return doubleQuoted[1]
    }
    return undefined
}

function extractKeyName(message: string): string | undefined {
    const match = /for key ['`"]([^'"`]+)['`"]/.exec(message)
    if (match) {
        return match[1]
    }
    const constraintMatch = /constraint [`'"]([^`'"]+)[`'"]/i.exec(message)
    if (constraintMatch) {
        return constraintMatch[1]
    }
    return extractQuotedName(message)
}

function extractMessageTableName(message: string): string | undefined {
    const backtickQualified = /`[^`]+`\.`([^`]+)`/.exec(message)
    if (backtickQualified) {
        return backtickQualified[1]
    }
    const quotedTable = /table ['`"]([^'"`]+)['`"]/i.exec(message)
    if (quotedTable) {
        return quotedTable[1]
    }
    return undefined
}

function extractConstraintTableName(message: string): string | undefined {
    return extractMessageTableName(message)
}

function extractCheckTableName(message: string): string | undefined {
    const match = /failed for [`'"][^`'"]+[`'"]\.[`'"]([^`'"]+)[`'"]/i.exec(message)
    if (match) {
        return match[1]
    }
    return extractMessageTableName(message)
}

function extractForeignKeyColumnName(message: string): string | undefined {
    const match = /foreign key\s*\([`'"]([^`'"]+)[`'"]\)/i.exec(message)
    if (match) {
        return match[1]
    }
    return undefined
}
