import type { TsSqlDatabaseErrorCode, TsSqlDatabaseErrorNumber, TsSqlErrorReason } from '../../TsSqlError.js'

export interface OracleEngineError {
    errorNum?: number
    code?: string
    databaseErrorCode?: TsSqlDatabaseErrorCode
    databaseErrorNumber?: TsSqlDatabaseErrorNumber
    message?: string
}

type ConstraintReason = Extract<TsSqlErrorReason, { reason: 'SQL_CONSTRAINT_VIOLATED' }>
type InvalidValueReason = Extract<TsSqlErrorReason, { reason: 'SQL_INVALID_VALUE' }>
type ObjectNotFoundReason = Extract<TsSqlErrorReason, { reason: 'SQL_OBJECT_NOT_FOUND' }>
type ObjectAlreadyExistsReason = Extract<TsSqlErrorReason, { reason: 'SQL_OBJECT_ALREADY_EXISTS' }>
type ObjectStateReason = Extract<TsSqlErrorReason, { reason: 'SQL_OBJECT_STATE_ERROR' }>
type InvalidSqlStatementReason = Extract<TsSqlErrorReason, { reason: 'SQL_INVALID_SQL_STATEMENT' }>
type InvalidParameterReason = Extract<TsSqlErrorReason, { reason: 'SQL_INVALID_PARAMETER' }>
type AmbiguousIdentifierReason = Extract<TsSqlErrorReason, { reason: 'SQL_AMBIGUOUS_IDENTIFIER' }>
type TransactionReason = Extract<TsSqlErrorReason, { reason: 'TRANSACTION_ERROR' }>
type TimeoutReason = Extract<TsSqlErrorReason, { reason: 'SQL_TIMEOUT' }>
type ConnectionReason = Extract<TsSqlErrorReason, { reason: 'SQL_CONNECTION_ERROR' }>
type ResourceLimitReason = Extract<TsSqlErrorReason, { reason: 'SQL_RESOURCE_LIMIT_REACHED' }>
type DatabaseCorruptedReason = Extract<TsSqlErrorReason, { reason: 'SQL_DATABASE_CORRUPTED' }>
type InternalErrorReason = Extract<TsSqlErrorReason, { reason: 'SQL_INTERNAL_ERROR' }>
type OracleTableColumnNames = { tableName?: string, columnName?: string }

interface OracleErrorContext {
    errorNum?: number
    code: string
    databaseErrorCode?: TsSqlDatabaseErrorCode
    databaseErrorNumber?: TsSqlDatabaseErrorNumber
    databaseErrorMessage?: string
    message: string
    lowerMessage: string
}

type OracleMetadata = Pick<OracleErrorContext, 'databaseErrorCode' | 'databaseErrorNumber' | 'databaseErrorMessage'>

export function getOracleEngineErrorReason(error: OracleEngineError): TsSqlErrorReason {
    const context = getOracleErrorContext(error)

    if (isOracleApplicationError(context.errorNum)) {
        return getUnknown(context)
    }

    const byNumber = getOracleErrorReasonFromNumber(context)
    if (byNumber) {
        return byNumber
    }

    const byMessage = getOracleErrorReasonFromMessage(context)
    if (byMessage) {
        return byMessage
    }

    return getUnknown(context)
}

function getOracleErrorContext(error: OracleEngineError): OracleErrorContext {
    const errorNum = error.errorNum
    const code = error.code || ''
    const databaseErrorCode = error.databaseErrorCode ?? (code || undefined)
    const databaseErrorNumber = error.databaseErrorNumber ?? (typeof errorNum === 'number' ? errorNum : undefined)
    const message = error.message || ''
    const databaseErrorMessage = message || undefined

    return {
        errorNum,
        code,
        databaseErrorCode,
        databaseErrorNumber,
        databaseErrorMessage,
        message,
        lowerMessage: message.toLowerCase(),
    }
}

function getOracleErrorReasonFromNumber(context: OracleErrorContext): TsSqlErrorReason | undefined {
    switch (context.errorNum) {
        case 1:
            return getConstraintViolation(context, 'unique', { constraintName: extractOracleConstraintName(context.message), ...extractOracleTableAndColumnNames(context.message) })
        case 1400:
        case 1407:
            return getConstraintViolation(context, 'not null', extractOracleTableAndColumnNames(context.message))
        case 2290:
            return getConstraintViolation(context, 'check', { constraintName: extractOracleConstraintName(context.message) })
        case 2291:
        case 2292:
            return getConstraintViolation(context, 'foreign key', { constraintName: extractOracleConstraintName(context.message) })

        case 1401:
        case 12899:
            return getInvalidValue(context, 'too long', extractOracleTableAndColumnNames(context.message))
        case 1426:
        case 1438:
        case 1455:
        case 1841:
        case 1847:
        case 1850:
        case 1851:
        case 1852:
        case 1888:
            return getInvalidValue(context, 'out of range', extractOracleTableAndColumnNames(context.message))
        case 1830:
        case 1840:
        case 1858:
        case 1861:
            return getInvalidValue(context, 'invalid format', extractOracleTableAndColumnNames(context.message))
        case 40441:
        case 40587:
            return getInvalidValue(context, 'invalid json', extractOracleTableAndColumnNames(context.message))
        case 31011:
        case 31013:
            return getInvalidValue(context, 'invalid xml', extractOracleTableAndColumnNames(context.message))
        case 12725:
        case 12726:
        case 12727:
        case 12728:
        case 12729:
        case 12730:
        case 12731:
        case 12732:
        case 12733:
            return getInvalidValue(context, 'invalid regular expression')
        case 1722:
        case 1843:
        case 1882:
            return getInvalidValue(context, 'invalid value', extractOracleTableAndColumnNames(context.message))

        case 942:
            return getObjectNotFound(context, 'table or view', { objectName: extractOracleObjectName(context.message), tableName: extractOracleTableName(context.message) || extractOracleObjectName(context.message) })
        case 904:
            return getInvalidIdentifierReason(context)
        case 1418:
            return getObjectNotFound(context, 'index', { objectName: extractOracleObjectName(context.message) })
        case 2289:
            return getObjectNotFound(context, 'sequence', { objectName: extractOracleObjectName(context.message) })
        case 4043:
            return getObjectNotFound(context, getOracleObjectTypeFromMessage(context.message), { objectName: extractOracleObjectName(context.message) })
        case 4080:
            return getObjectNotFound(context, 'trigger', { objectName: extractOracleObjectName(context.message) })
        case 955:
            return getObjectAlreadyExists(context, getOracleExistingObjectTypeFromMessage(context.message), { objectName: extractOracleObjectName(context.message) })
        case 1408:
            return getObjectAlreadyExists(context, 'index', { objectName: extractOracleObjectName(context.message) })
        case 1430:
            return getObjectAlreadyExists(context, 'column', { columnName: extractOracleColumnName(context.message), objectName: extractOracleColumnName(context.message) })
        case 2264:
            return getObjectAlreadyExists(context, undefined, { objectName: extractOracleConstraintName(context.message) || extractOracleObjectName(context.message) })
        case 4063:
            return getObjectStateError(context, 'invalid state', getOracleObjectTypeFromMessage(context.message), { objectName: extractOracleObjectName(context.message) })
        case 4098:
            return getObjectStateError(context, 'invalid state', 'trigger', { objectName: extractOracleObjectName(context.message) })
        case 6575:
            return getObjectStateError(context, 'invalid state', 'routine', { objectName: extractOracleObjectName(context.message) })

        case 900:
        case 905:
        case 906:
        case 907:
        case 911:
        case 917:
        case 923:
        case 933:
        case 936:
        case 1756:
            return getSyntaxError(context)
        case 6550:
            return context.lowerMessage.includes('pls-')
                ? getRoutineError(context)
                : getSyntaxError(context)
        case 932:
        case 1790:
            return getInvalidSqlStatement(context, 'type mismatch')
        case 934:
        case 937:
        case 979:
            return getInvalidSqlStatement(context, 'invalid grouping')
        case 972:
            return getInvalidSqlStatement(context, 'invalid identifier')
        case 1789:
            return getInvalidSqlStatement(context, 'invalid reference')
        case 30483:
        case 30484:
            return getInvalidSqlStatement(context, 'invalid windowing')
        case 918:
            return getAmbiguousIdentifier(context, 'column', 'ambiguous', extractOracleColumnName(context.message) || extractQuotedName(context.message))
        case 957:
            return getAmbiguousIdentifier(context, 'column', 'duplicate', extractOracleColumnName(context.message) || extractQuotedName(context.message))
        case 1422:
        case 1427:
            return getCardinalityViolation(context)
        case 1476:
            return getDivisionByZero(context)

        case 1006:
            return getInvalidParameter(context, { parameterErrorType: 'invalid name', parameterName: extractOracleParameterName(context.message) })
        case 1008:
            return getInvalidParameter(context, { parameterErrorType: 'missing', parameterName: extractOracleParameterName(context.message) })
        case 1036:
            return getInvalidParameter(context, { parameterErrorType: 'invalid name', parameterName: extractOracleParameterName(context.message) })

        case 8177:
            return getTransactionError(context, 'serialization failure')
        case 60:
            return getTransactionError(context, 'deadlock')
        case 1086:
            return getTransactionError(context, 'invalid savepoint')
        case 1453:
            return getTransactionError(context, 'invalid state')
        case 2050:
        case 2055:
            return getTransactionError(context, 'transaction rolled back')
        case 2054:
            return getTransactionError(context, 'outcome unknown')
        case 54:
        case 2049:
        case 4021:
        case 30006:
            return getTimeout(context, 'lock')
        case 1013:
            return getTimeout(context, 'cancelled')
        case 1456:
        case 16000:
            return getReadOnlyViolation(context)

        case 1017:
        case 28000:
        case 28001:
            return getAuthenticationError(context)
        case 1045:
            return getAuthorizationError(context)
        case 1031:
            return getPermissionDenied(context)
        case 1012:
        case 3113:
        case 3114:
        case 3135:
        case 12537:
            return getConnectionError(context, 'connection lost')
        case 1033:
        case 1034:
        case 1089:
        case 12528:
        case 12541:
        case 12543:
            return getConnectionError(context, 'temporarily unavailable')
        case 12154:
        case 12505:
        case 12514:
        case 12545:
            return getConnectionError(context, 'invalid connection configuration')
        case 12170:
        case 12535:
            return getTimeout(context, 'connection')
        case 18:
        case 20:
        case 12516:
        case 12519:
        case 12520:
            return getResourceLimit(context, 'connections')
        case 1000:
            return getResourceLimit(context)
        case 1652:
        case 30036:
            return getResourceLimit(context, 'temp space')
        case 1653:
        case 1654:
        case 1658:
        case 1688:
            return getResourceLimit(context, 'disk')
        case 4030:
        case 4031:
            return getResourceLimit(context, 'memory')

        case 1578:
            return getDatabaseCorrupted(context, 'database file')
        case 8102:
            return getDatabaseCorrupted(context, 'index')
        case 600:
        case 603:
        case 1041:
        case 7445:
            return getInternalError(context, 'engine internal')
        case 2063:
        case 2068:
        case 28500:
            return getExternalDataSourceError(context)
        case 3001:
        case 439:
        case 22816:
        case 32034:
            return getFeatureNotSupported(context)
        default:
            return undefined
    }
}

function getOracleErrorReasonFromMessage(context: OracleErrorContext): TsSqlErrorReason | undefined {
    const lower = context.lowerMessage
    if (!lower) {
        return undefined
    }

    if (lower.includes('unique constraint') || lower.includes('unique index')) {
        return getConstraintViolation(context, 'unique', { constraintName: extractOracleConstraintName(context.message), ...extractOracleTableAndColumnNames(context.message) })
    }
    if (lower.includes('parent key not found') || lower.includes('child record found') || lower.includes('foreign key')) {
        return getConstraintViolation(context, 'foreign key', { constraintName: extractOracleConstraintName(context.message) })
    }
    if (lower.includes('check constraint')) {
        return getConstraintViolation(context, 'check', { constraintName: extractOracleConstraintName(context.message) })
    }
    if (lower.includes('cannot insert null') || lower.includes('cannot update') && lower.includes(' to null')) {
        return getConstraintViolation(context, 'not null', extractOracleTableAndColumnNames(context.message))
    }
    if (lower.includes('value too large') || lower.includes('inserted value too large')) {
        return getInvalidValue(context, 'too long', extractOracleTableAndColumnNames(context.message))
    }
    if (lower.includes('numeric overflow') || lower.includes('larger than specified precision')) {
        return getInvalidValue(context, 'out of range', extractOracleTableAndColumnNames(context.message))
    }
    if (lower.includes('invalid json') || lower.includes('json syntax')) {
        return getInvalidValue(context, 'invalid json', extractOracleTableAndColumnNames(context.message))
    }
    if (lower.includes('xml parsing failed') || lower.includes('invalid xml')) {
        return getInvalidValue(context, 'invalid xml', extractOracleTableAndColumnNames(context.message))
    }
    if (lower.includes('regular expression')) {
        return getInvalidValue(context, 'invalid regular expression')
    }
    if (lower.includes('literal does not match format') || lower.includes('date format') || lower.includes('not long enough for date')) {
        return getInvalidValue(context, 'invalid format', extractOracleTableAndColumnNames(context.message))
    }
    if (lower.includes('invalid number') || lower.includes('not a valid month') || lower.includes('invalid month') || lower.includes('invalid value')) {
        return getInvalidValue(context, 'invalid value', extractOracleTableAndColumnNames(context.message))
    }
    if (lower.includes('table or view') && lower.includes('does not exist')) {
        return getObjectNotFound(context, 'table or view', { objectName: extractOracleObjectName(context.message), tableName: extractOracleTableName(context.message) || extractOracleObjectName(context.message) })
    }
    if (lower.includes('sequence') && lower.includes('does not exist')) {
        return getObjectNotFound(context, 'sequence', { objectName: extractOracleObjectName(context.message) })
    }
    if (lower.includes('trigger') && lower.includes('does not exist')) {
        return getObjectNotFound(context, 'trigger', { objectName: extractOracleObjectName(context.message) })
    }
    if (lower.includes('invalid identifier')) {
        return getInvalidIdentifierReason(context)
    }
    if (lower.includes('already used by an existing object') || lower.includes('already exists')) {
        return getObjectAlreadyExists(context, getOracleExistingObjectTypeFromMessage(context.message), { objectName: extractOracleObjectName(context.message) })
    }
    if (lower.includes('has errors') || lower.includes('is in an invalid state') || lower.includes('failed re-validation')) {
        return getObjectStateError(context, 'invalid state', getOracleObjectTypeFromMessage(context.message), { objectName: extractOracleObjectName(context.message) })
    }
    if (lower.includes('ambiguous')) {
        return getAmbiguousIdentifier(context, undefined, 'ambiguous', extractQuotedName(context.message))
    }
    if (lower.includes('duplicate column')) {
        return getAmbiguousIdentifier(context, 'column', 'duplicate', extractOracleColumnName(context.message) || extractQuotedName(context.message))
    }
    if (lower.includes('more than one row') || lower.includes('too many rows')) {
        return getCardinalityViolation(context)
    }
    if (lower.includes('divisor is equal to zero') || lower.includes('division by zero')) {
        return getDivisionByZero(context)
    }
    if (lower.includes('deadlock')) {
        return getTransactionError(context, 'deadlock')
    }
    if (lower.includes('serialize access')) {
        return getTransactionError(context, 'serialization failure')
    }
    if (lower.includes('savepoint') && lower.includes('never established')) {
        return getTransactionError(context, 'invalid savepoint')
    }
    if (lower.includes('resource busy') || lower.includes('waiting for lock') || lower.includes('timeout occurred while waiting to lock')) {
        return getTimeout(context, 'lock')
    }
    if (lower.includes('requested cancel')) {
        return getTimeout(context, 'cancelled')
    }
    if (lower.includes('read only') || lower.includes('read-only')) {
        return getReadOnlyViolation(context)
    }
    if (lower.includes('invalid username') || lower.includes('password') && lower.includes('expired') || lower.includes('account is locked')) {
        return getAuthenticationError(context)
    }
    if (lower.includes('insufficient privileges')) {
        return getPermissionDenied(context)
    }
    if (lower.includes('not connected') || lower.includes('connection lost') || lower.includes('communication channel')) {
        return getConnectionError(context, 'connection lost')
    }
    if (lower.includes('could not resolve') || lower.includes('connect identifier') || lower.includes('target host or object does not exist')) {
        return getConnectionError(context, 'invalid connection configuration')
    }
    if (lower.includes('no listener') || lower.includes('destination host unreachable') || lower.includes('not available')) {
        return getConnectionError(context, 'temporarily unavailable')
    }
    if (lower.includes('operation timed out') || lower.includes('connect timeout')) {
        return getTimeout(context, 'connection')
    }
    if (lower.includes('maximum number of sessions') || lower.includes('maximum number of processes') || lower.includes('too many connections')) {
        return getResourceLimit(context, 'connections')
    }
    if (lower.includes('out of memory') || lower.includes('out of process memory') || lower.includes('out of shared memory')) {
        return getResourceLimit(context, 'memory')
    }
    if (lower.includes('unable to extend temp') || lower.includes('temporary tablespace')) {
        return getResourceLimit(context, 'temp space')
    }
    if (lower.includes('unable to extend') || lower.includes('unable to allocate')) {
        return getResourceLimit(context, 'disk')
    }
    if (lower.includes('data block corrupted')) {
        return getDatabaseCorrupted(context, 'database file')
    }
    if (lower.includes('internal error')) {
        return getInternalError(context, 'engine internal')
    }
    if (lower.includes('unimplemented feature') || lower.includes('feature not enabled') || lower.includes('unsupported feature')) {
        return getFeatureNotSupported(context)
    }
    if (lower.includes('group by') || lower.includes('group function')) {
        return getInvalidSqlStatement(context, 'invalid grouping')
    }
    if (lower.includes('inconsistent datatypes')) {
        return getInvalidSqlStatement(context, 'type mismatch')
    }
    if (lower.includes('syntax') || lower.includes('missing') && (lower.includes('keyword') || lower.includes('parenthesis') || lower.includes('expression')) || lower.includes('sql command not properly ended')) {
        return getSyntaxError(context)
    }

    return undefined
}

function isOracleApplicationError(errorNum: number | undefined): boolean {
    return typeof errorNum === 'number' && errorNum >= 20000 && errorNum <= 20999
}

function getMetadata(context: OracleMetadata): OracleMetadata {
    return {
        databaseErrorCode: context.databaseErrorCode,
        databaseErrorNumber: context.databaseErrorNumber,
        databaseErrorMessage: context.databaseErrorMessage,
    }
}

function getConstraintViolation(context: OracleErrorContext, constraintType?: ConstraintReason['constraintType'], details: Pick<ConstraintReason, 'constraintName' | 'tableName' | 'columnName'> = {}): TsSqlErrorReason {
    return { reason: 'SQL_CONSTRAINT_VIOLATED', ...getMetadata(context), constraintType, ...details }
}

function getInvalidValue(context: OracleErrorContext, errorType?: InvalidValueReason['errorType'], details: Pick<InvalidValueReason, 'tableName' | 'columnName' | 'typeName'> = {}): TsSqlErrorReason {
    return { reason: 'SQL_INVALID_VALUE', ...getMetadata(context), errorType, ...details }
}

function getObjectNotFound(context: OracleErrorContext, objectType?: ObjectNotFoundReason['objectType'], details: Pick<ObjectNotFoundReason, 'schemaName' | 'tableName' | 'columnName' | 'objectName'> = {}): TsSqlErrorReason {
    return { reason: 'SQL_OBJECT_NOT_FOUND', ...getMetadata(context), objectType, ...details }
}

function getObjectAlreadyExists(context: OracleErrorContext, objectType?: ObjectAlreadyExistsReason['objectType'], details: Pick<ObjectAlreadyExistsReason, 'schemaName' | 'tableName' | 'columnName' | 'objectName'> = {}): TsSqlErrorReason {
    return { reason: 'SQL_OBJECT_ALREADY_EXISTS', ...getMetadata(context), objectType, ...details }
}

function getObjectStateError(context: OracleErrorContext, objectStateErrorType?: ObjectStateReason['objectStateErrorType'], objectType?: ObjectStateReason['objectType'], details: Pick<ObjectStateReason, 'schemaName' | 'tableName' | 'columnName' | 'objectName'> = {}): TsSqlErrorReason {
    return { reason: 'SQL_OBJECT_STATE_ERROR', ...getMetadata(context), objectStateErrorType, objectType, ...details }
}

function getInvalidSqlStatement(context: OracleErrorContext, statementErrorType?: InvalidSqlStatementReason['statementErrorType']): TsSqlErrorReason {
    return { reason: 'SQL_INVALID_SQL_STATEMENT', ...getMetadata(context), statementErrorType }
}

function getInvalidParameter(context: OracleErrorContext, details: Pick<InvalidParameterReason, 'parameterErrorType' | 'parameterName' | 'parameterIndex' | 'expectedParameterCount' | 'actualParameterCount'> = {}): TsSqlErrorReason {
    return { reason: 'SQL_INVALID_PARAMETER', ...getMetadata(context), ...details }
}

function getAmbiguousIdentifier(context: OracleErrorContext, identifierType?: AmbiguousIdentifierReason['identifierType'], identifierErrorType?: AmbiguousIdentifierReason['identifierErrorType'], identifier?: string): TsSqlErrorReason {
    return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', ...getMetadata(context), identifier, identifierType, identifierErrorType }
}

function getTransactionError(context: OracleErrorContext, transactionErrorType?: TransactionReason['transactionErrorType']): TsSqlErrorReason {
    return { reason: 'TRANSACTION_ERROR', ...getMetadata(context), transactionErrorType }
}

function getTimeout(context: OracleErrorContext, timeoutType?: TimeoutReason['timeoutType']): TsSqlErrorReason {
    return { reason: 'SQL_TIMEOUT', ...getMetadata(context), timeoutType }
}

function getConnectionError(context: OracleErrorContext, errorType?: ConnectionReason['errorType']): TsSqlErrorReason {
    return { reason: 'SQL_CONNECTION_ERROR', ...getMetadata(context), errorType }
}

function getResourceLimit(context: OracleErrorContext, resourceType?: ResourceLimitReason['resourceType']): TsSqlErrorReason {
    return { reason: 'SQL_RESOURCE_LIMIT_REACHED', ...getMetadata(context), resourceType }
}

function getDatabaseCorrupted(context: OracleErrorContext, corruptionType?: DatabaseCorruptedReason['corruptionType']): TsSqlErrorReason {
    return { reason: 'SQL_DATABASE_CORRUPTED', ...getMetadata(context), corruptionType }
}

function getInternalError(context: OracleErrorContext, errorType?: InternalErrorReason['errorType']): TsSqlErrorReason {
    return { reason: 'SQL_INTERNAL_ERROR', ...getMetadata(context), errorType }
}

function getSyntaxError(context: OracleErrorContext): TsSqlErrorReason {
    return { reason: 'SQL_SYNTAX_ERROR', ...getMetadata(context) }
}

function getCardinalityViolation(context: OracleErrorContext): TsSqlErrorReason {
    return { reason: 'SQL_CARDINALITY_VIOLATION', ...getMetadata(context) }
}

function getDivisionByZero(context: OracleErrorContext): TsSqlErrorReason {
    return { reason: 'SQL_DIVISION_BY_ZERO', ...getMetadata(context) }
}

function getReadOnlyViolation(context: OracleErrorContext): TsSqlErrorReason {
    return { reason: 'SQL_READ_ONLY_VIOLATION', ...getMetadata(context) }
}

function getAuthenticationError(context: OracleErrorContext): TsSqlErrorReason {
    return { reason: 'SQL_AUTHENTICATION_ERROR', ...getMetadata(context) }
}

function getAuthorizationError(context: OracleErrorContext): TsSqlErrorReason {
    return { reason: 'SQL_AUTHORIZATION_ERROR', ...getMetadata(context) }
}

function getPermissionDenied(context: OracleErrorContext): TsSqlErrorReason {
    return { reason: 'SQL_PERMISSION_DENIED', ...getMetadata(context) }
}

function getRoutineError(context: OracleErrorContext): TsSqlErrorReason {
    return { reason: 'SQL_ROUTINE_ERROR', ...getMetadata(context) }
}

function getExternalDataSourceError(context: OracleErrorContext): TsSqlErrorReason {
    return { reason: 'SQL_EXTERNAL_DATA_SOURCE_ERROR', ...getMetadata(context) }
}

function getFeatureNotSupported(context: OracleErrorContext): TsSqlErrorReason {
    return { reason: 'SQL_FEATURE_NOT_SUPPORTED', ...getMetadata(context) }
}

function getUnknown(context: OracleErrorContext): TsSqlErrorReason {
    return { reason: 'SQL_UNKNOWN', ...getMetadata(context) }
}

function getInvalidIdentifierReason(context: OracleErrorContext): TsSqlErrorReason {
    const identifier = extractOracleColumnName(context.message) || extractQuotedName(context.message)
    if (identifier) {
        return getObjectNotFound(context, 'column', { columnName: identifier, objectName: identifier })
    }
    return getInvalidSqlStatement(context, 'invalid identifier')
}

function getOracleObjectTypeFromMessage(message: string): ObjectNotFoundReason['objectType'] | undefined {
    const lower = message.toLowerCase()
    if (lower.includes('schema')) {
        return 'schema'
    }
    if (lower.includes('table or view') || lower.includes('table') || lower.includes('view')) {
        return 'table or view'
    }
    if (lower.includes('column')) {
        return 'column'
    }
    if (lower.includes('procedure') || lower.includes('function') || lower.includes('package') || lower.includes('routine')) {
        return 'routine'
    }
    if (lower.includes('sequence')) {
        return 'sequence'
    }
    if (lower.includes('index')) {
        return 'index'
    }
    if (lower.includes('trigger')) {
        return 'trigger'
    }
    if (lower.includes('cursor')) {
        return 'cursor'
    }
    return undefined
}

function getOracleExistingObjectTypeFromMessage(message: string): ObjectAlreadyExistsReason['objectType'] | undefined {
    const objectType = getOracleObjectTypeFromMessage(message)
    if (objectType === 'collation' || objectType === 'role') {
        return undefined
    }
    return objectType
}

function extractOracleConstraintName(message: string): string | undefined {
    const match = /\(([^)]+)\)/.exec(message)
    return match?.[1]
}

function extractOracleTableAndColumnNames(message: string): OracleTableColumnNames {
    return {
        tableName: extractOracleTableName(message),
        columnName: extractOracleColumnName(message),
    }
}

function extractOracleColumnName(message: string): string | undefined {
    const quotedValues = extractAllQuotedNames(message)
    return quotedValues.at(-1)
}

function extractOracleTableName(message: string): string | undefined {
    const quotedValues = extractAllQuotedNames(message)
    if (quotedValues.length >= 2) {
        return quotedValues[quotedValues.length - 2]
    }
    return undefined
}

function extractOracleObjectName(message: string): string | undefined {
    const quotedValues = extractAllQuotedNames(message)
    if (quotedValues.length > 1) {
        return quotedValues.join('.')
    }
    if (quotedValues.length === 1) {
        return quotedValues[0]
    }
    return extractQuotedName(message) || extractBacktickName(message)
}

function extractOracleParameterName(message: string): string | undefined {
    const colonParameter = /:([A-Za-z_][A-Za-z0-9_$#]*)/.exec(message)
    return colonParameter?.[1] || extractQuotedName(message)
}

function extractAllQuotedNames(message: string): string[] {
    return [...message.matchAll(/"([^"]+)"/g)].map((match) => match[1]!)
}

function extractQuotedName(message: string): string | undefined {
    const doubleQuoted = /"([^"]+)"/.exec(message)
    if (doubleQuoted) {
        return doubleQuoted[1]
    }
    const singleQuoted = /'([^']+)'/.exec(message)
    if (singleQuoted) {
        return singleQuoted[1]
    }
    return undefined
}

function extractBacktickName(message: string): string | undefined {
    const backtick = /`([^`]+)`/.exec(message)
    return backtick?.[1]
}
