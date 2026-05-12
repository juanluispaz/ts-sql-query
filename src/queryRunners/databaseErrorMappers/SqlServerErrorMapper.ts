import type { TsSqlDatabaseErrorCode, TsSqlDatabaseErrorNumber, TsSqlErrorReason } from '../../TsSqlError.js'

export interface SqlServerEngineError {
    number?: number
    code?: string
    databaseErrorCode?: TsSqlDatabaseErrorCode
    databaseErrorNumber?: TsSqlDatabaseErrorNumber
    message?: string
}

interface SqlServerErrorContext {
    number?: number
    databaseErrorCode?: TsSqlDatabaseErrorCode
    databaseErrorNumber?: TsSqlDatabaseErrorNumber
    databaseErrorMessage?: string
    message: string
}

type SqlServerMetadata = Pick<SqlServerErrorContext, 'databaseErrorCode' | 'databaseErrorNumber' | 'databaseErrorMessage'>

export function getSqlServerEngineErrorReason(error: SqlServerEngineError): TsSqlErrorReason {
    const context = getSqlServerErrorContext(error)

    switch (context.number) {
        case 137:
        case 201:
        case 8144:
        case 8146:
        case 8178:
            return { reason: 'SQL_INVALID_PARAMETER', ...getMetadata(context) }
        case 2601:
        case 2627:
            return {
                reason: 'SQL_CONSTRAINT_VIOLATED',
                ...getMetadata(context),
                constraintType: 'unique',
                constraintName: extractUniqueConstraintName(context.message),
                tableName: extractObjectTableName(context.message),
            }
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
        case 8115:
            return { reason: 'SQL_INVALID_VALUE', ...getMetadata(context), errorType: 'out of range', columnName: extractColumnName(context.message) }
        case 8152:
        case 2628:
            return { reason: 'SQL_INVALID_VALUE', ...getMetadata(context), errorType: 'too long', columnName: extractColumnName(context.message) }
        case 241:
        case 242:
        case 245:
        case 248:
        case 249:
        case 295:
        case 296:
        case 8169:
            return { reason: 'SQL_INVALID_VALUE', ...getMetadata(context), errorType: 'invalid value', columnName: extractColumnName(context.message) }
        case 911:
            return { reason: 'SQL_OBJECT_NOT_FOUND', ...getMetadata(context), objectType: 'database', objectName: extractQuotedName(context.message) }
        case 208:
            return { reason: 'SQL_OBJECT_NOT_FOUND', ...getMetadata(context), objectType: 'table or view', objectName: extractQuotedName(context.message) }
        case 207:
            return {
                reason: 'SQL_OBJECT_NOT_FOUND',
                ...getMetadata(context),
                objectType: 'column',
                columnName: extractQuotedName(context.message),
                objectName: extractQuotedName(context.message),
            }
        case 2812:
            return { reason: 'SQL_OBJECT_NOT_FOUND', ...getMetadata(context), objectType: 'routine', objectName: extractQuotedName(context.message) }
        case 2714:
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', ...getMetadata(context), objectName: extractQuotedName(context.message) }
        case 209:
            return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', ...getMetadata(context), identifier: extractQuotedName(context.message) }
        case 102:
        case 105:
        case 156:
        case 319:
            return { reason: 'SQL_SYNTAX_ERROR', ...getMetadata(context) }
        case 8134:
            return { reason: 'SQL_DIVISION_BY_ZERO', ...getMetadata(context) }
        case 512:
            return { reason: 'SQL_CARDINALITY_VIOLATION', ...getMetadata(context) }
        case 1205:
            return { reason: 'TRANSACTION_ERROR', ...getMetadata(context), transactionErrorType: 'deadlock' }
        case 1222:
            return { reason: 'SQL_TIMEOUT', ...getMetadata(context), timeoutType: 'lock' }
        case 3960:
            return { reason: 'TRANSACTION_ERROR', ...getMetadata(context), transactionErrorType: 'serialization failure' }
        case 3902:
        case 3903:
            return { reason: 'NOT_IN_TRANSACTION', ...getMetadata(context) }
        case 3930:
            return { reason: 'TRANSACTION_ERROR', ...getMetadata(context), transactionErrorType: 'aborted' }
        case 3906:
            return { reason: 'SQL_READ_ONLY_VIOLATION', ...getMetadata(context) }
        case 229:
            return { reason: 'SQL_PERMISSION_DENIED', ...getMetadata(context) }
        case 916:
            return { reason: 'SQL_AUTHORIZATION_ERROR', ...getMetadata(context) }
        case 4060:
            return { reason: 'SQL_AUTHORIZATION_ERROR', ...getMetadata(context) }
        case 18456:
            return { reason: 'SQL_AUTHENTICATION_ERROR', ...getMetadata(context) }
        case 701:
        case 802:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', ...getMetadata(context), resourceType: 'memory' }
        case 1101:
        case 1105:
        case 9002:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', ...getMetadata(context), resourceType: 'disk' }
        case 10928:
        case 10929:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', ...getMetadata(context) }
        case 40544:
        case 40551:
        case 40553:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', ...getMetadata(context), resourceType: 'disk' }
        case 40549:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', ...getMetadata(context), resourceType: 'temp space' }
        case 40552:
        case 40557:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', ...getMetadata(context), resourceType: 'memory' }
        case 40554:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', ...getMetadata(context), resourceType: 'cpu' }
        case 40550:
        case 40555:
        case 40556:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', ...getMetadata(context) }
        case 40558:
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', ...getMetadata(context) }
        default:
            return { reason: 'SQL_UNKNOWN', ...getMetadata(context) }
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
    return undefined
}

function extractColumnName(message: string): string | undefined {
    const match = /column ['"]([^'"]+)['"]/i.exec(message)
    if (match) {
        return match[1]
    }
    return extractQuotedName(message)
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
    return extractTableName(message)
}
