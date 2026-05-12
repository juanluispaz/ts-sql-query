import type { TsSqlDatabaseErrorCode, TsSqlDatabaseErrorNumber, TsSqlErrorReason } from '../../TsSqlError.js'

export interface OracleEngineError {
    errorNum?: number
    code?: string
    databaseErrorCode?: TsSqlDatabaseErrorCode
    databaseErrorNumber?: TsSqlDatabaseErrorNumber
    message?: string
}

export function getOracleEngineErrorReason(error: OracleEngineError): TsSqlErrorReason {
    const errorNum = error.errorNum
    const code = error.code || ''
    const databaseErrorCode = error.databaseErrorCode ?? (code || undefined)
    const databaseErrorNumber = error.databaseErrorNumber ?? (typeof errorNum === 'number' ? errorNum : undefined)
    const databaseErrorMessage = error.message || undefined
    const message = error.message || ''

    switch (errorNum) {
        case 1:
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, constraintType: 'unique', constraintName: extractOracleConstraintName(message) }
        case 1400:
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, constraintType: 'not null', tableName: extractOracleTableName(message), columnName: extractOracleColumnName(message) }
        case 2291:
        case 2292:
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, constraintType: 'foreign key', constraintName: extractOracleConstraintName(message) }
        case 2290:
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, constraintType: 'check', constraintName: extractOracleConstraintName(message) }
        case 12899:
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, errorType: 'too long', columnName: extractOracleColumnName(message) }
        case 1438:
        case 1455:
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, errorType: 'out of range' }
        case 1722:
        case 1830:
        case 1840:
        case 1841:
        case 1843:
        case 1847:
        case 1858:
        case 1861:
        case 1882:
        case 1888:
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, errorType: 'invalid value' }
        case 942:
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, objectType: 'table or view', objectName: extractOracleObjectName(message) }
        case 904:
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, objectType: 'column', columnName: extractOracleColumnName(message), objectName: extractOracleObjectName(message) }
        case 1006:
        case 1008:
        case 1036:
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
        case 4043:
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, objectName: extractOracleObjectName(message) }
        case 6550:
            return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
        case 955:
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, objectName: extractOracleObjectName(message) }
        case 933:
        case 907:
        case 936:
        case 923:
        case 1756:
            return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
        case 918:
            return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, identifier: extractQuotedName(message) }
        case 1427:
            return { reason: 'SQL_CARDINALITY_VIOLATION', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
        case 1476:
            return { reason: 'SQL_DIVISION_BY_ZERO', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
        case 8177:
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, transactionErrorType: 'serialization failure' }
        case 54:
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, timeoutType: 'lock' }
        case 60:
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, transactionErrorType: 'deadlock' }
        case 1013:
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, timeoutType: 'cancelled' }
        case 2049:
        case 30006:
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, timeoutType: 'lock' }
        case 30036:
        case 1652:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, resourceType: 'temp space' }
        case 4030:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, resourceType: 'memory' }
        case 1017:
        case 28000:
        case 28001:
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
        case 1031:
            return { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
        case 1012:
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, errorType: 'connection lost' }
        case 1041:
        case 12516:
        case 12519:
        case 12520:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, resourceType: 'connections' }
        case 12514:
        case 12505:
        case 12154:
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, errorType: 'invalid connection configuration' }
        case 12541:
        case 12543:
        case 12545:
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, errorType: 'connection lost' }
        case 12170:
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, timeoutType: 'connection' }
        case 20:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, resourceType: 'connections' }
        case 4021:
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorNumber, databaseErrorMessage, timeoutType: 'lock' }
        case 16000:
            return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
        case 3001:
        case 439:
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
        default:
            return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }
}

function extractOracleConstraintName(message: string): string | undefined {
    const match = /\(([^)]+)\)/.exec(message)
    return match?.[1]
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
    return extractQuotedName(message)
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
