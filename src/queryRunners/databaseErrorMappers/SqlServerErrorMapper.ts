import type { TsSqlDatabaseErrorCode, TsSqlDatabaseErrorNumber, TsSqlErrorReason } from '../../TsSqlError.js'
import * as ErrorCodes from './SqlServerErrorCodes.js'

export interface SqlServerEngineError {
    number?: number | undefined
    code?: string | undefined
    databaseErrorCode?: TsSqlDatabaseErrorCode | undefined
    databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined
    message?: string | undefined
}

interface SqlServerErrorContext {
    number?: number | undefined
    databaseErrorCode?: TsSqlDatabaseErrorCode | undefined
    databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined
    databaseErrorMessage?: string | undefined
    message: string
}

type SqlServerMetadata = Pick<SqlServerErrorContext, 'databaseErrorCode' | 'databaseErrorNumber' | 'databaseErrorMessage'>
type InvalidValueReason = Extract<TsSqlErrorReason, { reason: 'SQL_INVALID_VALUE' }>
type InvalidSqlStatementReason = Extract<TsSqlErrorReason, { reason: 'SQL_INVALID_SQL_STATEMENT' }>
type InvalidParameterReason = Extract<TsSqlErrorReason, { reason: 'SQL_INVALID_PARAMETER' }>
type ObjectNotFoundReason = Extract<TsSqlErrorReason, { reason: 'SQL_OBJECT_NOT_FOUND' }>
type ObjectAlreadyExistsReason = Extract<TsSqlErrorReason, { reason: 'SQL_OBJECT_ALREADY_EXISTS' }>
type ObjectStateReason = Extract<TsSqlErrorReason, { reason: 'SQL_OBJECT_STATE_ERROR' }>
type ResourceLimitReason = Extract<TsSqlErrorReason, { reason: 'SQL_RESOURCE_LIMIT_REACHED' }>
type ConnectionReason = Extract<TsSqlErrorReason, { reason: 'SQL_CONNECTION_ERROR' }>
type DatabaseCorruptedReason = Extract<TsSqlErrorReason, { reason: 'SQL_DATABASE_CORRUPTED' }>
type IoReason = Extract<TsSqlErrorReason, { reason: 'SQL_IO_ERROR' }>
type InternalErrorReason = Extract<TsSqlErrorReason, { reason: 'SQL_INTERNAL_ERROR' }>

export function getSqlServerEngineErrorReason(error: SqlServerEngineError): TsSqlErrorReason {
    const context = getSqlServerErrorContext(error)

    switch (context.number) {
        case 137:
            return getInvalidParameter(context, { parameterErrorType: 'missing', parameterName: extractQuotedName(context.message) })
        case 201:
        case 8178:
            return getInvalidParameter(context, { parameterErrorType: 'missing', parameterName: extractParameterName(context.message) })
        case 8144:
        case 8146:
            return getInvalidParameter(context, { parameterErrorType: 'too many' })
        case 1505:
        case 2601:
        case 2627:
            return {
                reason: 'SQL_CONSTRAINT_VIOLATED',
                ...getMetadata(context),
                constraintType: 'unique',
                constraintName: extractUniqueConstraintName(context.message),
                tableName: extractObjectTableName(context.message),
            }
        case 233:
        case 515:
            return {
                reason: 'SQL_CONSTRAINT_VIOLATED',
                ...getMetadata(context),
                constraintType: 'not null',
                tableName: extractTableName(context.message),
                columnName: extractColumnName(context.message),
            }
        case 547:
            return getConstraintViolationFrom547(context)
        case 548:
            return {
                reason: 'SQL_CONSTRAINT_VIOLATED',
                ...getMetadata(context),
                constraintType: 'check',
                tableName: extractTableName(context.message),
            }
        case 210:
        case 245:
        case 295:
        case 8114:
        case 8169:
            return getInvalidValue(context, 'invalid value', { columnName: extractColumnName(context.message) })
        case 220:
        case 232:
        case 236:
        case 242:
        case 244:
        case 248:
        case 294:
        case 296:
        case 298:
        case 517:
        case 535:
        case 542:
        case 8115:
            return getInvalidValue(context, 'out of range', { columnName: extractColumnName(context.message) })
        case 8152:
        case 2628:
            return getInvalidValue(context, 'too long', { columnName: extractColumnName(context.message), tableName: extractTableName(context.message) })
        case 241:
        case 235:
        case 293:
            return getInvalidValue(context, 'invalid format', { columnName: extractColumnName(context.message) })
        case 572:
            return getInvalidValue(context, 'invalid regular expression')
        case 911:
        case 998:
        case 40145:
            return getObjectNotFound(context, 'database', { objectName: extractQuotedName(context.message) })
        case 307:
        case 308:
        case 40307:
            return getObjectNotFound(context, 'index', { objectName: extractQuotedName(context.message) })
        case 208:
            return getObjectNotFound(context, 'table or view', { objectName: extractQuotedName(context.message), tableName: extractQuotedName(context.message) })
        case 207:
        case 1911:
            return getObjectNotFound(context, 'column', { columnName: extractQuotedName(context.message), objectName: extractQuotedName(context.message) })
        case 2812:
            return getObjectNotFound(context, 'routine', { objectName: extractQuotedName(context.message) })
        case 261:
            return getObjectNotFound(context, 'routine', { objectName: extractQuotedName(context.message) })
        case 1801:
            return getObjectAlreadyExists(context, 'database', { objectName: extractQuotedName(context.message) })
        case 1913:
            return getObjectAlreadyExists(context, 'index', { objectName: extractQuotedName(context.message) })
        case 2714:
            return getObjectAlreadyExists(context, undefined, { objectName: extractQuotedName(context.message) })
        case 315:
        case 316:
            return getObjectStateError(context, 'invalid state', 'index')
        case 3101:
        case 3102:
        case 3702:
            return getObjectStateError(context, 'object in use', 'database')
        case 3726:
        case 3729:
        case 3732:
            return getObjectStateError(context, 'dependent objects still exist')
        case 209:
            return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', ...getMetadata(context), identifier: extractQuotedName(context.message) }
        case 326:
            return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', ...getMetadata(context), identifier: extractQuotedName(context.message), identifierType: 'column' }
        case 327:
            return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', ...getMetadata(context), identifier: extractQuotedName(context.message), identifierType: 'routine' }
        case 206:
        case 249:
            return getInvalidSqlStatement(context, 'type mismatch')
        case 217:
            return { reason: 'SQL_ROUTINE_ERROR', ...getMetadata(context) }
        case 102:
        case 105:
        case 156:
        case 319:
            return { reason: 'SQL_SYNTAX_ERROR', ...getMetadata(context) }
        case 4104:
            return getInvalidSqlStatement(context, 'invalid reference')
        case 8120:
            return getInvalidSqlStatement(context, 'invalid grouping')
        case 8134:
            return { reason: 'SQL_DIVISION_BY_ZERO', ...getMetadata(context) }
        case 512:
            return { reason: 'SQL_CARDINALITY_VIOLATION', ...getMetadata(context) }
        case 1205:
            return { reason: 'TRANSACTION_ERROR', ...getMetadata(context), transactionErrorType: 'deadlock' }
        case 1206:
            return { reason: 'TRANSACTION_ERROR', ...getMetadata(context), transactionErrorType: 'transaction rolled back' }
        case 1222:
            return { reason: 'SQL_TIMEOUT', ...getMetadata(context), timeoutType: 'lock' }
        case 3960:
            return { reason: 'TRANSACTION_ERROR', ...getMetadata(context), transactionErrorType: 'serialization failure' }
        case 41302:
        case 41305:
        case 41325:
            return { reason: 'TRANSACTION_ERROR', ...getMetadata(context), transactionErrorType: 'serialization failure' }
        case 3902:
        case 3903:
            return { reason: 'NOT_IN_TRANSACTION', ...getMetadata(context) }
        case 3930:
            return { reason: 'TRANSACTION_ERROR', ...getMetadata(context), transactionErrorType: 'aborted' }
        case 41300:
        case 41301:
        case 41339:
            return { reason: 'TRANSACTION_ERROR', ...getMetadata(context), transactionErrorType: 'aborted' }
        case 40540:
            return { reason: 'TRANSACTION_ERROR', ...getMetadata(context), transactionErrorType: 'aborted' }
        case 3906:
        case 40573:
        case 40628:
            return { reason: 'SQL_READ_ONLY_VIOLATION', ...getMetadata(context) }
        case 40531:
            return getConnectionError(context, 'invalid connection configuration')
        case 229:
        case 230:
        case 262:
        case 297:
        case 300:
        case 3110:
        case 40548:
        case 40574:
        case 40644:
        case 40668:
            return { reason: 'SQL_PERMISSION_DENIED', ...getMetadata(context) }
        case 916:
            return { reason: 'SQL_AUTHORIZATION_ERROR', ...getMetadata(context) }
        case 4060:
        case 40615:
            return { reason: 'SQL_AUTHORIZATION_ERROR', ...getMetadata(context) }
        case 40505:
        case 40532:
        case 18456:
        case 18452:
        case 18470:
        case 18487:
        case 18488:
        case 40620:
        case 40623:
            return { reason: 'SQL_AUTHENTICATION_ERROR', ...getMetadata(context) }
        case 701:
        case 802:
        case 13641:
            return context.number === 13641 ? getResourceLimit(context) : getResourceLimit(context, 'memory')
        case 1101:
        case 1105:
        case 9002:
        case 40552:
            return getResourceLimit(context, 'disk')
        case 10928:
        case 10929:
        case 40550:
        case 40604:
        case 40611:
        case 40648:
        case 40652:
        case 40656:
        case 40658:
            return getResourceLimit(context)
        case 40544:
            return getResourceLimit(context, 'file size')
        case 40551:
            return getResourceLimit(context, 'temp space')
        case 40549:
            return { reason: 'SQL_TIMEOUT', ...getMetadata(context), timeoutType: 'transaction' }
        case 40553:
            return getResourceLimit(context, 'memory')
        case 40501:
        case 40624:
        case 40635:
        case 40613:
        case 40642:
        case 40669:
        case 40671:
        case 40675:
            return getConnectionError(context, 'temporarily unavailable')
        case 40558:
            return getObjectStateError(context, 'invalid state', 'database')
        case 13640:
        case 13684:
            return getInvalidValue(context, 'invalid encoding')
        case 13642:
        case 13643:
            return getDatabaseCorrupted(context, 'database file')
        default:
            return getSqlServerErrorReasonFromKnownGroup(context) || { reason: 'SQL_UNKNOWN', ...getMetadata(context) }
    }
}

function getSqlServerErrorContext(error: SqlServerEngineError): SqlServerErrorContext {
    const number = error.number
    const databaseErrorCode = error.databaseErrorCode ?? (error.code || undefined)
    const databaseErrorNumber = error.databaseErrorNumber ?? (typeof number === 'number' ? number : undefined)
    const message = error.message || ''

    return {
        number,
        databaseErrorCode,
        databaseErrorNumber,
        databaseErrorMessage: message,
        message,
    }
}

function getMetadata(context: SqlServerErrorContext): SqlServerMetadata {
    return {
        databaseErrorCode: context.databaseErrorCode,
        databaseErrorNumber: context.databaseErrorNumber,
        databaseErrorMessage: context.databaseErrorMessage,
    }
}

function getSqlServerErrorReasonFromKnownGroup(context: SqlServerErrorContext): TsSqlErrorReason | undefined {
    const number = context.number
    if (typeof number !== 'number') {
        return undefined
    }
    if (ErrorCodes.SQL_SERVER_MISSING_PARAMETER_ERROR_NUMBERS.has(number)) {
        return getInvalidParameter(context, { parameterErrorType: 'missing', parameterName: extractParameterName(context.message) })
    }
    if (ErrorCodes.SQL_SERVER_TOO_MANY_PARAMETERS_ERROR_NUMBERS.has(number)) {
        return getInvalidParameter(context, { parameterErrorType: 'too many' })
    }
    if (ErrorCodes.SQL_SERVER_WRONG_PARAMETER_COUNT_ERROR_NUMBERS.has(number)) {
        return getInvalidParameter(context, { parameterErrorType: 'wrong count' })
    }
    if (ErrorCodes.SQL_SERVER_INVALID_PARAMETER_NAME_ERROR_NUMBERS.has(number)) {
        return getInvalidParameter(context, { parameterErrorType: 'invalid name', parameterName: extractParameterName(context.message), parameterIndex: extractParameterIndex(context.message) })
    }
    if (ErrorCodes.SQL_SERVER_INVALID_PARAMETER_VALUE_ERROR_NUMBERS.has(number)) {
        return getInvalidParameter(context, { parameterErrorType: 'invalid value', parameterName: extractParameterName(context.message) })
    }
    if (ErrorCodes.SQL_SERVER_PARAMETER_NULL_NOT_ALLOWED_ERROR_NUMBERS.has(number)) {
        return getInvalidValue(context, 'null not allowed', { typeName: extractDataTypeName(context.message) })
    }
    if (ErrorCodes.SQL_SERVER_PARAMETER_INVALID_VALUE_ERROR_NUMBERS.has(number)) {
        return getInvalidValue(context, 'invalid value', { typeName: extractDataTypeName(context.message) })
    }
    if (ErrorCodes.SQL_SERVER_PARAMETER_TOO_LONG_ERROR_NUMBERS.has(number)) {
        return getInvalidValue(context, 'too long', { typeName: extractDataTypeName(context.message) })
    }
    if (ErrorCodes.SQL_SERVER_CARDINALITY_VIOLATION_ERROR_NUMBERS.has(number)) {
        return { reason: 'SQL_CARDINALITY_VIOLATION', ...getMetadata(context) }
    }
    if (ErrorCodes.SQL_SERVER_SYNTAX_ERROR_NUMBERS.has(number)) {
        return { reason: 'SQL_SYNTAX_ERROR', ...getMetadata(context) }
    }
    if (ErrorCodes.SQL_SERVER_TYPE_MISMATCH_STATEMENT_ERROR_NUMBERS.has(number)) {
        return getInvalidSqlStatement(context, 'type mismatch')
    }
    if (ErrorCodes.SQL_SERVER_INVALID_REFERENCE_STATEMENT_ERROR_NUMBERS.has(number)) {
        return getInvalidSqlStatement(context, 'invalid reference')
    }
    if (ErrorCodes.SQL_SERVER_INVALID_IDENTIFIER_STATEMENT_ERROR_NUMBERS.has(number)) {
        return getInvalidSqlStatement(context, 'invalid identifier')
    }
    if (ErrorCodes.SQL_SERVER_INVALID_DEFINITION_STATEMENT_ERROR_NUMBERS.has(number)) {
        return getInvalidSqlStatement(context, 'invalid definition')
    }
    if (ErrorCodes.SQL_SERVER_INVALID_STATEMENT_CONTEXT_ERROR_NUMBERS.has(number)) {
        return getInvalidSqlStatement(context, 'invalid statement context')
    }
    if (ErrorCodes.SQL_SERVER_INVALID_WINDOWING_STATEMENT_ERROR_NUMBERS.has(number)) {
        return getInvalidSqlStatement(context, 'invalid windowing')
    }
    if (ErrorCodes.SQL_SERVER_INVALID_ARGUMENT_STATEMENT_ERROR_NUMBERS.has(number)) {
        return getInvalidSqlStatement(context, 'invalid argument')
    }
    if (ErrorCodes.SQL_SERVER_INVALID_RECURSION_STATEMENT_ERROR_NUMBERS.has(number)) {
        return getInvalidSqlStatement(context, 'invalid recursion')
    }
    if (ErrorCodes.SQL_SERVER_INVALID_GROUPING_STATEMENT_ERROR_NUMBERS.has(number)) {
        return getInvalidSqlStatement(context, 'invalid grouping')
    }
    if (ErrorCodes.SQL_SERVER_DATABASE_CORRUPTED_FILE_ERROR_NUMBERS.has(number)) {
        return getDatabaseCorrupted(context, 'database file')
    }
    if (ErrorCodes.SQL_SERVER_DATABASE_CORRUPTED_CHECKSUM_ERROR_NUMBERS.has(number)) {
        return getDatabaseCorrupted(context, 'checksum')
    }
    if (ErrorCodes.SQL_SERVER_INTERNAL_ERROR_NUMBERS.has(number)) {
        return getInternalError(context, 'engine internal')
    }
    if (ErrorCodes.SQL_SERVER_IO_ACCESS_ERROR_NUMBERS.has(number)) {
        return getIoError(context, 'access')
    }
    if (ErrorCodes.SQL_SERVER_IO_READ_ERROR_NUMBERS.has(number)) {
        return getIoError(context, 'read')
    }
    if (ErrorCodes.SQL_SERVER_IO_WRITE_ERROR_NUMBERS.has(number)) {
        return getIoError(context, 'write')
    }
    if (ErrorCodes.SQL_SERVER_IO_PATH_ERROR_NUMBERS.has(number)) {
        return getIoError(context, 'path')
    }
    if (ErrorCodes.SQL_SERVER_IO_UNKNOWN_ERROR_NUMBERS.has(number)) {
        return getIoError(context, 'unknown')
    }
    if (ErrorCodes.SQL_SERVER_EXTERNAL_DATA_SOURCE_ERROR_NUMBERS.has(number)) {
        return { reason: 'SQL_EXTERNAL_DATA_SOURCE_ERROR', ...getMetadata(context) }
    }
    if (ErrorCodes.SQL_SERVER_MEMORY_RESOURCE_ERROR_NUMBERS.has(number)) {
        return getResourceLimit(context, 'memory')
    }
    if (ErrorCodes.SQL_SERVER_DISK_RESOURCE_ERROR_NUMBERS.has(number)) {
        return getResourceLimit(context, 'disk')
    }
    if (ErrorCodes.SQL_SERVER_TEMP_SPACE_RESOURCE_ERROR_NUMBERS.has(number)) {
        return getResourceLimit(context, 'temp space')
    }
    if (ErrorCodes.SQL_SERVER_CPU_RESOURCE_ERROR_NUMBERS.has(number)) {
        return getResourceLimit(context, 'cpu')
    }
    if (ErrorCodes.SQL_SERVER_GENERIC_RESOURCE_ERROR_NUMBERS.has(number)) {
        return getResourceLimit(context)
    }
    if (ErrorCodes.SQL_SERVER_READ_ONLY_ERROR_NUMBERS.has(number)) {
        return { reason: 'SQL_READ_ONLY_VIOLATION', ...getMetadata(context) }
    }
    if (ErrorCodes.SQL_SERVER_CONNECTION_LOST_ERROR_NUMBERS.has(number)) {
        return getConnectionError(context, 'connection lost')
    }
    if (ErrorCodes.SQL_SERVER_TEMPORARILY_UNAVAILABLE_CONNECTION_ERROR_NUMBERS.has(number)) {
        return getConnectionError(context, 'temporarily unavailable')
    }
    if (ErrorCodes.SQL_SERVER_INVALID_CONNECTION_CONFIGURATION_ERROR_NUMBERS.has(number)) {
        return getConnectionError(context, 'invalid connection configuration')
    }
    if (ErrorCodes.SQL_SERVER_PERMISSION_DENIED_ERROR_NUMBERS.has(number)) {
        return { reason: 'SQL_PERMISSION_DENIED', ...getMetadata(context) }
    }
    if (ErrorCodes.SQL_SERVER_AUTHORIZATION_ERROR_NUMBERS.has(number)) {
        return { reason: 'SQL_AUTHORIZATION_ERROR', ...getMetadata(context) }
    }
    if (isSqlServerXmlParsingErrorNumber(number)) {
        return getInvalidValue(context, number === 9461 ? 'too long' : 'invalid xml')
    }
    if (ErrorCodes.SQL_SERVER_INVALID_XML_TOO_LONG_ERROR_NUMBERS.has(number)) {
        return getInvalidValue(context, 'too long')
    }
    if (ErrorCodes.SQL_SERVER_INVALID_XML_ERROR_NUMBERS.has(number)) {
        return getInvalidValue(context, 'invalid xml')
    }
    if (ErrorCodes.SQL_SERVER_INVALID_JSON_ERROR_NUMBERS.has(number)) {
        return getInvalidValue(context, 'invalid json')
    }
    if (ErrorCodes.SQL_SERVER_INVALID_JSON_TOO_LONG_ERROR_NUMBERS.has(number)) {
        return getInvalidValue(context, 'too long')
    }
    if (ErrorCodes.SQL_SERVER_INVALID_JSON_VALUE_ERROR_NUMBERS.has(number)) {
        return getInvalidValue(context, 'invalid value')
    }
    if (ErrorCodes.SQL_SERVER_JSON_FEATURE_NOT_SUPPORTED_ERROR_NUMBERS.has(number) || ErrorCodes.SQL_SERVER_FEATURE_NOT_SUPPORTED_ERROR_NUMBERS.has(number)) {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', ...getMetadata(context) }
    }
    return undefined
}

function isSqlServerXmlParsingErrorNumber(number: number): boolean {
    return number >= 9400 && number <= 9467 || number === 9480
}

function getInvalidValue(context: SqlServerErrorContext, errorType?: InvalidValueReason['errorType'], details: Pick<InvalidValueReason, 'tableName' | 'columnName' | 'typeName'> = {}): TsSqlErrorReason {
    return { reason: 'SQL_INVALID_VALUE', ...getMetadata(context), errorType, ...details }
}

function getInvalidSqlStatement(context: SqlServerErrorContext, statementErrorType?: InvalidSqlStatementReason['statementErrorType']): TsSqlErrorReason {
    return { reason: 'SQL_INVALID_SQL_STATEMENT', ...getMetadata(context), statementErrorType }
}

function getInvalidParameter(context: SqlServerErrorContext, details: Partial<Pick<InvalidParameterReason, 'parameterErrorType' | 'parameterName' | 'parameterIndex' | 'expectedParameterCount' | 'actualParameterCount'>> = {}): TsSqlErrorReason {
    return { reason: 'SQL_INVALID_PARAMETER', ...getMetadata(context), ...details }
}

function getObjectNotFound(context: SqlServerErrorContext, objectType?: ObjectNotFoundReason['objectType'], details: Pick<ObjectNotFoundReason, 'schemaName' | 'tableName' | 'columnName' | 'objectName'> = {}): TsSqlErrorReason {
    return { reason: 'SQL_OBJECT_NOT_FOUND', ...getMetadata(context), objectType, ...details }
}

function getObjectAlreadyExists(context: SqlServerErrorContext, objectType?: ObjectAlreadyExistsReason['objectType'], details: Pick<ObjectAlreadyExistsReason, 'schemaName' | 'tableName' | 'columnName' | 'objectName'> = {}): TsSqlErrorReason {
    return { reason: 'SQL_OBJECT_ALREADY_EXISTS', ...getMetadata(context), objectType, ...details }
}

function getObjectStateError(context: SqlServerErrorContext, objectStateErrorType?: ObjectStateReason['objectStateErrorType'], objectType?: ObjectStateReason['objectType']): TsSqlErrorReason {
    return { reason: 'SQL_OBJECT_STATE_ERROR', ...getMetadata(context), objectStateErrorType, objectType, objectName: extractQuotedName(context.message) }
}

function getResourceLimit(context: SqlServerErrorContext, resourceType?: ResourceLimitReason['resourceType']): TsSqlErrorReason {
    return { reason: 'SQL_RESOURCE_LIMIT_REACHED', ...getMetadata(context), resourceType }
}

function getConnectionError(context: SqlServerErrorContext, errorType?: ConnectionReason['errorType']): TsSqlErrorReason {
    return { reason: 'SQL_CONNECTION_ERROR', ...getMetadata(context), errorType }
}

function getDatabaseCorrupted(context: SqlServerErrorContext, corruptionType?: DatabaseCorruptedReason['corruptionType']): TsSqlErrorReason {
    return { reason: 'SQL_DATABASE_CORRUPTED', ...getMetadata(context), corruptionType }
}

function getIoError(context: SqlServerErrorContext, ioErrorType?: IoReason['ioErrorType']): TsSqlErrorReason {
    return { reason: 'SQL_IO_ERROR', ...getMetadata(context), ioErrorType }
}

function getInternalError(context: SqlServerErrorContext, errorType?: InternalErrorReason['errorType']): TsSqlErrorReason {
    return { reason: 'SQL_INTERNAL_ERROR', ...getMetadata(context), errorType }
}

function getConstraintViolationFrom547(context: SqlServerErrorContext): TsSqlErrorReason {
    const upper = context.message.toUpperCase()
    if (upper.includes('FOREIGN KEY CONSTRAINT')) {
        return {
            reason: 'SQL_CONSTRAINT_VIOLATED',
            ...getMetadata(context),
            constraintType: 'foreign key',
            constraintName: extractConstraintName(context.message),
            tableName: extractTableName(context.message),
        }
    }
    if (upper.includes('CHECK CONSTRAINT')) {
        return {
            reason: 'SQL_CONSTRAINT_VIOLATED',
            ...getMetadata(context),
            constraintType: 'check',
            constraintName: extractConstraintName(context.message),
            tableName: extractTableName(context.message),
        }
    }
    return {
        reason: 'SQL_CONSTRAINT_VIOLATED',
        ...getMetadata(context),
        constraintName: extractConstraintName(context.message),
        tableName: extractTableName(context.message),
    }
}

function extractQuotedName(message: string): string | undefined {
    const singleQuoted = /'([^']+)'/.exec(message)
    if (singleQuoted) {
        return singleQuoted[1]
    }
    const doubleQuoted = /"([^"]+)"/.exec(message)
    if (doubleQuoted) {
        return doubleQuoted[1]
    }
    const bracketQuoted = /\[([^\]]+)\]/.exec(message)
    if (bracketQuoted) {
        return bracketQuoted[1]
    }
    return undefined
}

function extractConstraintName(message: string): string | undefined {
    const match = /constraint ['"]([^'"]+)['"]/i.exec(message)
    if (match) {
        return match[1]
    }
    return extractQuotedName(message)
}

function extractUniqueConstraintName(message: string): string | undefined {
    const constraintMatch = /constraint ['"]([^'"]+)['"]/i.exec(message)
    if (constraintMatch) {
        return constraintMatch[1]
    }
    const indexMatch = /unique index ['"]([^'"]+)['"]/i.exec(message)
    if (indexMatch) {
        return indexMatch[1]
    }
    const indexNameMatch = /index name ['"]([^'"]+)['"]/i.exec(message)
    if (indexNameMatch) {
        return indexNameMatch[1]
    }
    return undefined
}

function extractColumnName(message: string): string | undefined {
    const match = /column ['"]([^'"]+)['"]/i.exec(message)
    if (match) {
        return match[1]
    }
    return extractQuotedName(message)
}

function extractParameterName(message: string): string | undefined {
    const expectsParameterMatch = /expects parameter ['"]([^'"]+)['"]/i.exec(message)
    if (expectsParameterMatch) {
        return expectsParameterMatch[1]
    }
    const noParameterNamedMatch = /has no parameter named ['"]([^'"]+)['"]/i.exec(message)
    if (noParameterNamedMatch) {
        return noParameterNamedMatch[1]
    }
    const indexedParameterMatch = /parameter\s+\d+\s+\(["']?([^"')]+)["']?\)/i.exec(message)
    if (indexedParameterMatch) {
        return indexedParameterMatch[1]
    }
    const parameterMatch = /parameter ['"]([^'"]+)['"]/i.exec(message)
    if (parameterMatch) {
        return parameterMatch[1]
    }
    return undefined
}

function extractParameterIndex(message: string): number | undefined {
    const match = /parameter\s+(\d+)/i.exec(message)
    if (!match) {
        return undefined
    }
    return Number(match[1])
}

function extractDataTypeName(message: string): string | undefined {
    const suppliedDataTypeMatch = /data type ['"]?([A-Za-z0-9_]+)['"]?/i.exec(message)
    if (suppliedDataTypeMatch) {
        return suppliedDataTypeMatch[1]
    }
    const cannotBeNullMatch = /type\s+([A-Za-z0-9_]+)\s+cannot be NULL/i.exec(message)
    if (cannotBeNullMatch) {
        return cannotBeNullMatch[1]
    }
    return undefined
}

function extractTableName(message: string): string | undefined {
    const match = /table ['"]([^'"]+)['"]/i.exec(message)
    if (match) {
        return match[1]
    }
    return undefined
}

function extractObjectTableName(message: string): string | undefined {
    const match = /object ['"]([^'"]+)['"]/i.exec(message)
    if (match) {
        return match[1]
    }
    const objectNameMatch = /object name ['"]([^'"]+)['"]/i.exec(message)
    if (objectNameMatch) {
        return objectNameMatch[1]
    }
    return extractTableName(message)
}
