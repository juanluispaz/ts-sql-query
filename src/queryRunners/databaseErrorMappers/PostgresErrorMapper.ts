import type { TsSqlDatabaseErrorCode, TsSqlErrorReason } from '../../TsSqlError.js'

export interface PostgresEngineError {
    sqlState?: string
    databaseErrorCode?: TsSqlDatabaseErrorCode
    message?: string
    schemaName?: string
    tableName?: string
    columnName?: string
    typeName?: string
    constraintName?: string
}

type ConstraintType = 'unique' | 'not null' | 'foreign key' | 'check' | 'exclusion' | 'restrict'
type InvalidValueErrorType = 'out of range' | 'too long' | 'invalid value' | 'invalid format' | 'invalid encoding' |
    'invalid json' | 'invalid xml' | 'invalid regular expression' | 'null not allowed' | 'sequence limit'
type IdentifierType = 'column' | 'routine' | 'parameter' | 'alias' | 'object'
type IdentifierErrorType = 'ambiguous' | 'duplicate'
type ObjectType = 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'sequence' | 'database' | 'collation' |
    'index' | 'trigger' | 'cursor' | 'prepared statement' | 'role'
type StatementErrorType = 'incomplete statement' | 'invalid definition' | 'type mismatch' | 'invalid statement context' |
    'invalid identifier' | 'invalid reference' | 'invalid grouping' | 'invalid windowing' | 'invalid recursion' |
    'invalid locator' | 'case not found' | 'invalid argument'
type ParameterErrorType = 'missing' | 'too many' | 'wrong count' | 'invalid name' | 'invalid index' |
    'invalid type' | 'invalid value' | 'invalid binding' | 'not bindable' | 'already bound'

export function getPostgresEngineErrorReason(error: PostgresEngineError): TsSqlErrorReason {
    const code = error.sqlState || ''
    const databaseErrorCode = error.databaseErrorCode ?? (code || undefined)
    const databaseErrorMessage = error.message || undefined

    if (!code) {
        return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
    }

    const reason = getPostgresSpecificErrorReason(error, code, databaseErrorCode, databaseErrorMessage)
    if (reason) {
        return reason
    }

    return getPostgresErrorReasonFromClass(error, code, databaseErrorCode, databaseErrorMessage)
}

export function isPostgresSqlState(code: unknown): code is string {
    return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)
}

function getPostgresSpecificErrorReason(
    error: PostgresEngineError,
    code: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined
): TsSqlErrorReason | undefined {
    switch (code) {
        case '00000':
            return { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode, databaseErrorMessage }

        case '08007':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'outcome unknown' }
        case '08P01':
            if (isPostgresInvalidParameterMessage(error.message || '')) {
                return getInvalidParameter(error, getPostgresInvalidParameterDetails(error.message || '', 'invalid binding'))
            }
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }

        case '0A000':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }

        case '0B000':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid state' }

        case '0L000':
        case '0LP01':
            return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode, databaseErrorMessage }

        case '0P000':
            return getObjectNotFound(error, 'role')

        case '21000':
            return { reason: 'SQL_CARDINALITY_VIOLATION', databaseErrorCode, databaseErrorMessage }

        case '22012':
            return { reason: 'SQL_DIVISION_BY_ZERO', databaseErrorCode, databaseErrorMessage }

        case '23000':
            return getConstraintViolation(error)
        case '23001':
            return getConstraintViolation(error, 'restrict')
        case '23505':
            return getConstraintViolation(error, 'unique')
        case '23502':
            return getConstraintViolation(error, 'not null')
        case '23503':
            return getConstraintViolation(error, 'foreign key')
        case '23514':
            return getConstraintViolation(error, 'check')
        case '23P01':
            return getConstraintViolation(error, 'exclusion')

        case '24000':
            return getObjectStateError(error, 'invalid state', 'cursor')

        case '25000':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid state' }
        case '25001':
        case '25002':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'active transaction' }
        case '25003':
            return { reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode: undefined, databaseErrorCode, databaseErrorMessage }
        case '25004':
        case '25008':
            return { reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: undefined, databaseErrorCode, databaseErrorMessage }
        case '25005':
        case '25P01':
            return { reason: 'NOT_IN_TRANSACTION', databaseErrorCode, databaseErrorMessage }
        case '25006':
            return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode, databaseErrorMessage }
        case '25007':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'unsupported operation' }
        case '25P02':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'aborted' }
        case '25P03':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'idle transaction' }
        case '25P04':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'transaction' }

        case '26000':
            return getObjectNotFound(error, 'prepared statement')

        case '27000':
            return getInvalidSqlStatement(error, 'invalid statement context')

        case '28000':
            return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode, databaseErrorMessage }
        case '28P01':
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }

        case '2B000':
        case '2BP01':
            return getObjectStateError(error, 'dependent objects still exist')

        case '2D000':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid state' }

        case '34000':
            return getObjectNotFound(error, 'cursor')

        case '3B000':
        case '3B001':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid savepoint' }

        case '3D000':
            return getObjectNotFound(error, 'database')
        case '3F000':
            return getObjectNotFound(error, 'schema')

        case '40000':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'transaction rolled back' }
        case '40001':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'serialization failure' }
        case '40002':
            return getConstraintViolation(error)
        case '40003':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'outcome unknown' }
        case '40P01':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'deadlock' }

        case '42000':
            return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage }
        case '42501':
            return { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode, databaseErrorMessage }
        case '42601':
            return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage }
        case '42602':
        case '42622':
        case '42939':
            return getInvalidSqlStatement(error, 'invalid identifier')
        case '42703':
            return getObjectNotFound(error, 'column')
        case '42883':
            return getObjectNotFound(error, 'routine')
        case '42P01':
            return getObjectNotFound(error, 'table or view')
        case '42P02':
            return getInvalidParameter(error, getPostgresInvalidParameterDetails(error.message || '', 'missing'))
        case '42704':
            return getObjectNotFound(error, getPostgresObjectTypeFromMessage(error.message || ''))
        case '42701':
            return getObjectAlreadyExists(error, 'column')
        case '42P03':
            return getObjectAlreadyExists(error, 'cursor')
        case '42P04':
            return getObjectAlreadyExists(error, 'database')
        case '42723':
            return getObjectAlreadyExists(error, 'routine')
        case '42P05':
            return getObjectAlreadyExists(error, 'prepared statement')
        case '42P06':
            return getObjectAlreadyExists(error, 'schema')
        case '42P07':
            return getObjectAlreadyExists(error, 'table or view')
        case '42702':
            return getAmbiguousIdentifier(error, 'column', 'ambiguous', databaseErrorCode, databaseErrorMessage)
        case '42725':
            return getAmbiguousIdentifier(error, 'routine', 'ambiguous', databaseErrorCode, databaseErrorMessage)
        case '42P08':
            return getAmbiguousIdentifier(error, 'parameter', 'ambiguous', databaseErrorCode, databaseErrorMessage)
        case '42P09':
            return getAmbiguousIdentifier(error, 'alias', 'ambiguous', databaseErrorCode, databaseErrorMessage)
        case '42712':
            return getAmbiguousIdentifier(error, 'alias', 'duplicate', databaseErrorCode, databaseErrorMessage)
        case '42710':
            return getObjectAlreadyExists(error, getPostgresObjectTypeFromMessage(error.message || ''))
        case '42P10':
            return getInvalidSqlStatement(error, 'invalid reference')
        case '42809':
            return getObjectStateError(error, 'wrong object type')
        case '42P11':
            return getInvalidSqlStatement(error, 'invalid definition')
        case '42P19':
            return getInvalidSqlStatement(error, 'invalid recursion')
        case '42803':
            return getInvalidSqlStatement(error, 'invalid grouping')
        case '42846':
        case '42804':
        case '42P18':
        case '42P21':
        case '42P22':
            return getInvalidSqlStatement(error, 'type mismatch')
        case '42830':
        case '42611':
        case '42P12':
        case '42P13':
        case '42P14':
        case '42P15':
        case '42P16':
        case '42P17':
        case '428C9':
            return getInvalidSqlStatement(error, 'invalid definition')
        case '42P20':
            return getInvalidSqlStatement(error, 'invalid windowing')

        case '44000':
            return getConstraintViolation(error, 'check')

        case '53000':
        case '53400':
        case '54000':
        case '54001':
        case '54011':
        case '54023':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage }
        case '53100':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'disk' }
        case '53200':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'memory' }
        case '53300':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'connections' }

        case '55000':
            return getObjectStateError(error, 'invalid state')
        case '55006':
            return getObjectStateError(error, 'object in use')
        case '55P02':
            return { reason: 'SQL_CONFIGURATION_ERROR', databaseErrorCode, databaseErrorMessage, configurationErrorType: 'runtime parameter' }
        case '55P03':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'lock' }
        case '55P04':
            return getObjectStateError(error, 'invalid state')

        case '57014':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: get57014TimeoutType(error.message || '') }
        case '57000':
        case '57P01':
        case '57P02':
        case '57P05':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
        case '57P03':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'temporarily unavailable' }
        case '57P04':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'invalid connection configuration' }

        case '58030':
            return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'unknown' }
        case '58P01':
            return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'file not found' }
        case '58P02':
            return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'unknown' }
        case '58P03':
            return getInvalidValue(error, 'too long')

        case 'F0000':
            return { reason: 'SQL_CONFIGURATION_ERROR', databaseErrorCode, databaseErrorMessage, configurationErrorType: 'configuration file' }
        case 'F0001':
            return { reason: 'SQL_CONFIGURATION_ERROR', databaseErrorCode, databaseErrorMessage, configurationErrorType: 'lock file' }

        case 'XX000':
            return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
        case 'XX001':
            return { reason: 'SQL_DATABASE_CORRUPTED', databaseErrorCode, databaseErrorMessage, corruptionType: 'database file' }
        case 'XX002':
            return { reason: 'SQL_DATABASE_CORRUPTED', databaseErrorCode, databaseErrorMessage, corruptionType: 'index' }
    }

    return undefined
}

function getPostgresErrorReasonFromClass(
    error: PostgresEngineError,
    code: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined
): TsSqlErrorReason {
    if (code.startsWith('01')) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
    }
    if (code.startsWith('02')) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
    }
    if (code.startsWith('03')) {
        return getInvalidSqlStatement(error, 'incomplete statement')
    }
    if (code.startsWith('08')) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (code.startsWith('09')) {
        return getInvalidSqlStatement(error, 'invalid statement context')
    }
    if (code.startsWith('0F')) {
        return getInvalidSqlStatement(error, 'invalid locator')
    }
    if (code.startsWith('0Z')) {
        return { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (code.startsWith('10')) {
        return getInvalidSqlStatement(error, 'invalid argument')
    }
    if (code.startsWith('20')) {
        return getInvalidSqlStatement(error, 'case not found')
    }
    if (code.startsWith('22')) {
        return getPostgresDataExceptionReason(error, code)
    }
    if (code.startsWith('25')) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid state' }
    }
    if (code.startsWith('2F')) {
        return { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (code.startsWith('38')) {
        return { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (code.startsWith('39')) {
        return getPostgresExternalRoutineInvocationReason(error, code, databaseErrorCode, databaseErrorMessage)
    }
    if (code.startsWith('3B')) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid savepoint' }
    }
    if (code.startsWith('40')) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'transaction rolled back' }
    }
    if (code.startsWith('42')) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage }
    }
    if (code.startsWith('53') || code.startsWith('54')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage }
    }
    if (code.startsWith('55')) {
        return getObjectStateError(error, 'invalid state')
    }
    if (code.startsWith('57')) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (code.startsWith('58')) {
        return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'unknown' }
    }
    if (code.startsWith('HV')) {
        return getPostgresForeignDataWrapperReason(error, code, databaseErrorCode, databaseErrorMessage)
    }
    if (code.startsWith('P0')) {
        return getPostgresPlPgSqlReason(code, databaseErrorCode, databaseErrorMessage)
    }

    return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
}

function getPostgresDataExceptionReason(error: PostgresEngineError, code: string): TsSqlErrorReason {
    switch (code) {
        case '22001':
        case '22026':
            return getInvalidValue(error, 'too long')
        case '22003':
        case '22008':
        case '22015':
        case '22022':
            return getInvalidValue(error, 'out of range')
        case '2200H':
            return getInvalidValue(error, 'sequence limit')
        case '22004':
        case '22002':
            return getInvalidValue(error, 'null not allowed')
        case '22007':
        case '22019':
        case '2200B':
        case '2200C':
        case '2200D':
        case '2200F':
        case '22010':
        case '22011':
        case '22013':
        case '22014':
        case '22016':
        case '2201E':
        case '2201F':
        case '2201G':
        case '2201W':
        case '2201X':
        case '22024':
        case '22025':
        case '22027':
        case '2202E':
        case '2202G':
        case '2202H':
        case '22P03':
        case '22P04':
        case '22P06':
            return getInvalidValue(error, 'invalid format')
        case '22021':
        case '22P05':
            return getInvalidValue(error, 'invalid encoding')
        case '2201B':
            return getInvalidValue(error, 'invalid regular expression')
        case '2200L':
        case '2200M':
        case '2200N':
        case '2200S':
        case '2200T':
            return getInvalidValue(error, 'invalid xml')
        case '22030':
        case '22031':
        case '22032':
        case '22033':
        case '22034':
        case '22035':
        case '22036':
        case '22037':
        case '22038':
        case '22039':
        case '2203A':
        case '2203B':
        case '2203C':
        case '2203D':
        case '2203E':
        case '2203F':
        case '2203G':
            return getInvalidValue(error, 'invalid json')
        default:
            return getInvalidValue(error, 'invalid value')
    }
}

function getPostgresExternalRoutineInvocationReason(
    error: PostgresEngineError,
    code: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined
): TsSqlErrorReason {
    switch (code) {
        case '39004':
            return getInvalidValue(error, 'null not allowed')
        case '39P01':
        case '39P02':
        case '39P03':
            return { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode, databaseErrorMessage }
        default:
            return { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode, databaseErrorMessage }
    }
}

function getPostgresForeignDataWrapperReason(
    error: PostgresEngineError,
    code: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined
): TsSqlErrorReason {
    switch (code) {
        case 'HV001':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'memory' }
        case 'HV00N':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'temporarily unavailable' }
        case 'HV005':
        case 'HV007':
            return getObjectNotFound(error, 'column')
        case 'HV00Q':
            return getObjectNotFound(error, 'schema')
        case 'HV00R':
            return getObjectNotFound(error, 'table or view')
        case 'HV002':
        case 'HV008':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage }
        case 'HV004':
        case 'HV006':
        case 'HV024':
        case 'HV090':
        case 'HV00A':
            return getInvalidValue(error, 'invalid value')
        case 'HV00D':
        case 'HV00J':
        case 'HV00C':
        case 'HV00B':
        case 'HV00K':
        case 'HV014':
        case 'HV021':
        case 'HV091':
        case 'HV00L':
        case 'HV00M':
        case 'HV009':
        default:
            return { reason: 'SQL_EXTERNAL_DATA_SOURCE_ERROR', databaseErrorCode, databaseErrorMessage }
    }
}

function getPostgresPlPgSqlReason(
    code: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined
): TsSqlErrorReason {
    switch (code) {
        case 'P0001':
            return { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'P0002':
            return { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'P0003':
            return { reason: 'SQL_CARDINALITY_VIOLATION', databaseErrorCode, databaseErrorMessage }
        case 'P0004':
            return { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode, databaseErrorMessage }
        default:
            return { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode, databaseErrorMessage }
    }
}

function getConstraintViolation(error: PostgresEngineError, constraintType?: ConstraintType): TsSqlErrorReason {
    return {
        reason: 'SQL_CONSTRAINT_VIOLATED',
        databaseErrorCode: error.databaseErrorCode ?? error.sqlState,
        databaseErrorMessage: error.message || undefined,
        constraintType,
        constraintName: stringValue(error.constraintName),
        tableName: stringValue(error.tableName),
        columnName: stringValue(error.columnName),
    }
}

function getInvalidValue(error: PostgresEngineError, errorType?: InvalidValueErrorType): TsSqlErrorReason {
    return {
        reason: 'SQL_INVALID_VALUE',
        databaseErrorCode: error.databaseErrorCode ?? error.sqlState,
        databaseErrorMessage: error.message || undefined,
        errorType,
        tableName: stringValue(error.tableName),
        columnName: stringValue(error.columnName),
        typeName: stringValue(error.typeName),
    }
}

function getInvalidSqlStatement(error: PostgresEngineError, statementErrorType?: StatementErrorType): TsSqlErrorReason {
    return {
        reason: 'SQL_INVALID_SQL_STATEMENT',
        databaseErrorCode: error.databaseErrorCode ?? error.sqlState,
        databaseErrorMessage: error.message || undefined,
        statementErrorType,
    }
}

function getInvalidParameter(
    error: PostgresEngineError,
    parameterDetails?: {
        parameterErrorType?: ParameterErrorType
        parameterName?: string
        parameterIndex?: number
        expectedParameterCount?: number
        actualParameterCount?: number
    }
): TsSqlErrorReason {
    return {
        reason: 'SQL_INVALID_PARAMETER',
        databaseErrorCode: error.databaseErrorCode ?? error.sqlState,
        databaseErrorMessage: error.message || undefined,
        ...parameterDetails,
    }
}

function getAmbiguousIdentifier(
    error: PostgresEngineError,
    identifierType: IdentifierType,
    identifierErrorType: IdentifierErrorType,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined
): TsSqlErrorReason {
    return {
        reason: 'SQL_AMBIGUOUS_IDENTIFIER',
        databaseErrorCode,
        databaseErrorMessage,
        identifier: stringValue(error.columnName) || extractQuotedName(error.message || ''),
        identifierType,
        identifierErrorType,
    }
}

function getObjectNotFound(error: PostgresEngineError, objectType?: ObjectType): TsSqlErrorReason {
    return {
        reason: 'SQL_OBJECT_NOT_FOUND',
        databaseErrorCode: error.databaseErrorCode ?? error.sqlState,
        databaseErrorMessage: error.message || undefined,
        objectType,
        schemaName: stringValue(error.schemaName),
        tableName: stringValue(error.tableName),
        columnName: stringValue(error.columnName),
        objectName: getObjectName(error, objectType),
    }
}

function getObjectAlreadyExists(error: PostgresEngineError, objectType?: Exclude<ObjectType, 'collation' | 'role'>): TsSqlErrorReason {
    return {
        reason: 'SQL_OBJECT_ALREADY_EXISTS',
        databaseErrorCode: error.databaseErrorCode ?? error.sqlState,
        databaseErrorMessage: error.message || undefined,
        objectType,
        schemaName: stringValue(error.schemaName),
        tableName: stringValue(error.tableName),
        columnName: stringValue(error.columnName),
        objectName: getObjectName(error, objectType),
    }
}

function getObjectStateError(
    error: PostgresEngineError,
    objectStateErrorType?: 'dependent objects still exist' | 'object in use' | 'invalid state' | 'wrong object type',
    objectType?: ObjectType
): TsSqlErrorReason {
    return {
        reason: 'SQL_OBJECT_STATE_ERROR',
        databaseErrorCode: error.databaseErrorCode ?? error.sqlState,
        databaseErrorMessage: error.message || undefined,
        objectStateErrorType,
        objectType,
        schemaName: stringValue(error.schemaName),
        tableName: stringValue(error.tableName),
        columnName: stringValue(error.columnName),
        objectName: getObjectName(error, objectType),
    }
}

function getObjectName(error: PostgresEngineError, objectType?: ObjectType): string | undefined {
    switch (objectType) {
        case 'schema':
            return stringValue(error.schemaName) || extractQuotedName(error.message || '')
        case 'table':
        case 'table or view':
            return stringValue(error.tableName) || extractQuotedName(error.message || '')
        case 'column':
            return stringValue(error.columnName) || extractQuotedName(error.message || '')
        case 'cursor':
        case 'prepared statement':
        case 'routine':
        case 'sequence':
        case 'database':
        case 'collation':
        case 'index':
        case 'trigger':
        case 'role':
            return extractQuotedName(error.message || '')
        default:
            return stringValue(error.tableName)
                || stringValue(error.columnName)
                || stringValue(error.constraintName)
                || extractQuotedName(error.message || '')
    }
}

function get57014TimeoutType(message: string): 'statement' | 'cancelled' {
    const lower = message.toLowerCase()
    if (lower.includes('statement timeout') || lower.includes('canceling statement due to statement timeout')) {
        return 'statement'
    }
    return 'cancelled'
}

function isPostgresInvalidParameterMessage(message: string): boolean {
    const lower = message.toLowerCase()
    return lower.includes('bind message supplies')
        || lower.includes('there is no parameter $')
}

function getPostgresInvalidParameterDetails(
    message: string,
    fallbackParameterErrorType: ParameterErrorType
): {
    parameterErrorType: ParameterErrorType
    parameterIndex?: number
    expectedParameterCount?: number
    actualParameterCount?: number
} {
    const missingIndex = /there is no parameter \$(\d+)/i.exec(message)
    if (missingIndex) {
        return { parameterErrorType: 'missing', parameterIndex: numberValue(missingIndex[1]) }
    }

    const wrongCount = /bind message supplies (\d+) parameters?, but prepared statement .+ requires (\d+)/i.exec(message)
    if (wrongCount) {
        return {
            parameterErrorType: 'wrong count',
            actualParameterCount: numberValue(wrongCount[1]),
            expectedParameterCount: numberValue(wrongCount[2]),
        }
    }

    if (message.toLowerCase().includes('bind message supplies')) {
        return { parameterErrorType: 'wrong count' }
    }

    return { parameterErrorType: fallbackParameterErrorType }
}

function getPostgresObjectTypeFromMessage(message: string): 'index' | 'trigger' | undefined {
    if (/^\s*index\s+"/i.test(message)) {
        return 'index'
    }
    if (/^\s*trigger\s+"/i.test(message)) {
        return 'trigger'
    }
    return undefined
}

function extractQuotedName(message: string): string | undefined {
    const quoted = /"([^"]+)"/.exec(message)
    if (quoted) {
        return quoted[1]
    }

    const singleQuoted = /'([^']+)'/.exec(message)
    if (singleQuoted) {
        return singleQuoted[1]
    }

    return undefined
}

function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
}

function numberValue(value: string | undefined): number | undefined {
    if (value === undefined) {
        return undefined
    }
    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}
