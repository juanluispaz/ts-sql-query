import { PrismaClientInitializationError, PrismaClientKnownRequestError, PrismaClientRustPanicError, PrismaClientUnknownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/client'
import type { TsSqlDatabaseErrorCode, TsSqlErrorReason } from '../../TsSqlError.js'

export function getPrismaErrorReason(error: unknown): TsSqlErrorReason {
    if (error instanceof PrismaClientKnownRequestError) {
        return getPrismaKnownRequestErrorReason(error)
    }
    if (error instanceof PrismaClientInitializationError) {
        return getPrismaInitializationErrorReason(error)
    }
    if (error instanceof PrismaClientValidationError) {
        return getPrismaValidationErrorReason(error)
    }
    if (error instanceof PrismaClientUnknownRequestError) {
        return getPrismaUnknownRequestErrorReason(error)
    }
    if (error instanceof PrismaClientRustPanicError) {
        return getPrismaRustPanicErrorReason(error)
    }
    return { reason: 'UNKNOWN' }
}

export function isPrismaError(error: unknown): boolean {
    return error instanceof PrismaClientKnownRequestError
        || error instanceof PrismaClientInitializationError
        || error instanceof PrismaClientValidationError
        || error instanceof PrismaClientUnknownRequestError
        || error instanceof PrismaClientRustPanicError
}

function getPrismaKnownRequestErrorReason(error: PrismaClientKnownRequestError): TsSqlErrorReason {
    const databaseErrorCode = getPrismaKnownRequestDatabaseErrorCode(error)
    const databaseErrorMessage = error.message || undefined
    const meta = error.meta
    const message = error.message || ''

    switch (error.code) {
        case 'P1000':
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'P1001':
            return { reason: 'SQL_CONNECTION_ERROR', errorType: 'temporarily unavailable', databaseErrorCode, databaseErrorMessage }
        case 'P1002':
        case 'P1008':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage }
        case 'P1003':
            return { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'database', objectName: getPrismaMetaString(meta, 'db'), databaseErrorCode, databaseErrorMessage }
        case 'P1009':
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'database', objectName: getPrismaMetaString(meta, 'db'), databaseErrorCode, databaseErrorMessage }
        case 'P1010':
            return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'P1011':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'P1017':
            return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode, databaseErrorMessage }
        case 'P2000':
            return {
                reason: 'SQL_INVALID_VALUE',
                errorType: 'too long',
                columnName: getPrismaMetaString(meta, 'column_name') || getPrismaMetaString(meta, 'column'),
                databaseErrorCode,
                databaseErrorMessage,
            }
        case 'P2002': {
            const target = getPrismaMetaStringArray(meta, 'target')
            const singleTarget = getPrismaMetaString(meta, 'target')
            return {
                reason: 'SQL_CONSTRAINT_VIOLATED',
                constraintType: 'unique',
                constraintName: singleTarget && target.length === 0 ? singleTarget : undefined,
                columnName: target.length === 1 ? target[0] : undefined,
                databaseErrorCode,
                databaseErrorMessage,
            }
        }
        case 'P2003':
            return {
                reason: 'SQL_CONSTRAINT_VIOLATED',
                constraintType: 'foreign key',
                columnName: getPrismaMetaString(meta, 'field_name'),
                databaseErrorCode,
                databaseErrorMessage,
            }
        case 'P2004':
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
        case 'P2010':
            return getPrismaRawQueryErrorReason(error, databaseErrorCode, databaseErrorMessage)
        case 'P2011':
            return {
                reason: 'SQL_CONSTRAINT_VIOLATED',
                constraintType: 'not null',
                constraintName: getPrismaMetaString(meta, 'constraint'),
                databaseErrorCode,
                databaseErrorMessage,
            }
        case 'P2012':
        case 'P2013':
        case 'P2019':
        case 'P2029':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage }
        case 'P2014':
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
        case 'P2020':
        case 'P2033':
            return { reason: 'SQL_INVALID_VALUE', errorType: 'out of range', databaseErrorCode, databaseErrorMessage }
        case 'P2021': {
            const tableName = getPrismaMetaString(meta, 'table')
            return {
                reason: 'SQL_OBJECT_NOT_FOUND',
                objectType: 'table or view',
                objectName: tableName,
                tableName,
                databaseErrorCode,
                databaseErrorMessage,
            }
        }
        case 'P2022': {
            const columnName = getPrismaMetaString(meta, 'column')
            return {
                reason: 'SQL_OBJECT_NOT_FOUND',
                objectType: 'column',
                objectName: columnName,
                columnName,
                databaseErrorCode,
                databaseErrorMessage,
            }
        }
        case 'P2023':
            return { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value', databaseErrorCode, databaseErrorMessage }
        case 'P2024':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'pool', databaseErrorCode, databaseErrorMessage }
        case 'P2028':
            return getPrismaTransactionApiErrorReason(databaseErrorCode, databaseErrorMessage, message)
        case 'P2030':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
        case 'P2034':
            if (message.toLowerCase().includes('deadlock')) {
                return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'deadlock' }
            }
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'serialization failure' }
        case 'P2036':
            return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
        case 'P2037':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'connections', databaseErrorCode, databaseErrorMessage }
        default:
            return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
    }
}

function getPrismaInitializationErrorReason(error: PrismaClientInitializationError): TsSqlErrorReason {
    const databaseErrorCode = error.errorCode
    const databaseErrorMessage = error.message || undefined

    switch (error.errorCode) {
        case 'P1000':
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'P1001':
            return { reason: 'SQL_CONNECTION_ERROR', errorType: 'temporarily unavailable', databaseErrorCode, databaseErrorMessage }
        case 'P1002':
        case 'P1008':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage }
        case 'P1003':
            return { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'database', databaseErrorCode, databaseErrorMessage }
        case 'P1009':
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'database', databaseErrorCode, databaseErrorMessage }
        case 'P1010':
            return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'P1011':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'P1017':
            return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode, databaseErrorMessage }
        default:
            return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
    }
}

function getPrismaValidationErrorReason(error: PrismaClientValidationError): TsSqlErrorReason {
    return {
        reason: 'SQL_INVALID_PARAMETER',
        databaseErrorMessage: error.message || undefined,
    }
}

function getPrismaUnknownRequestErrorReason(error: PrismaClientUnknownRequestError): TsSqlErrorReason {
    return {
        reason: 'SQL_UNKNOWN',
        databaseErrorMessage: error.message || undefined,
    }
}

function getPrismaRustPanicErrorReason(error: PrismaClientRustPanicError): TsSqlErrorReason {
    return {
        reason: 'SQL_UNKNOWN',
        databaseErrorMessage: error.message || undefined,
    }
}

function getPrismaRawQueryErrorReason(error: PrismaClientKnownRequestError, databaseErrorCode: TsSqlDatabaseErrorCode | undefined, databaseErrorMessage: string | undefined): TsSqlErrorReason {
    const rawCode = getPrismaMetaString(error.meta, 'code')
    const rawMessage = getPrismaMetaString(error.meta, 'message') || databaseErrorMessage
    const lower = (rawMessage || '').toLowerCase()

    if (lower.includes('unique constraint') || lower.includes('duplicate key') || lower.includes('duplicate entry')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'unique', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('foreign key constraint')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('not null constraint') || lower.includes('cannot be null') || lower.includes('null value in column')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'not null', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('check constraint')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'check', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('bind message supplies') || lower.includes('there is no parameter $') || lower.includes('wrong number of arguments to function') || lower.includes('bind or column index out of range') || lower.includes('parameter')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('value too long') || lower.includes('data too long')) {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'too long', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('out of range')) {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'out of range', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('syntax error')) {
        return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('no such table') || lower.includes('does not exist')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('already exists')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('ambiguous')) {
        return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifier: extractQuotedIdentifier(rawMessage), databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('deadlock')) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage, transactionErrorType: 'deadlock' }
    }
    if (lower.includes('read-only') || lower.includes('read only')) {
        if (lower.includes('transaction')) {
            return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
        }
        return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('permission denied')) {
        return { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('access denied')) {
        return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('timeout')) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    return { reason: 'SQL_UNKNOWN', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
}

function getPrismaTransactionApiErrorReason(databaseErrorCode: TsSqlDatabaseErrorCode | undefined, databaseErrorMessage: string | undefined, message: string): TsSqlErrorReason {
    const lower = message.toLowerCase()
    if (lower.includes('expired transaction') || lower.includes('timeout for this transaction') || lower.includes('unable to start a transaction in the given time')) {
        return { reason: 'SQL_TIMEOUT', timeoutType: 'transaction', databaseErrorCode, databaseErrorMessage }
    }
    if (lower.includes('transaction already closed')) {
        return { reason: 'NOT_IN_TRANSACTION', databaseErrorCode, databaseErrorMessage }
    }
    return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
}

function getPrismaKnownRequestDatabaseErrorCode(error: PrismaClientKnownRequestError): TsSqlDatabaseErrorCode | undefined {
    return getPrismaMetaString(error.meta, 'code') || error.code
}

function getPrismaMetaString(meta: Record<string, unknown> | undefined, key: string): string | undefined {
    if (!meta) {
        return undefined
    }
    const value = meta[key]
    return typeof value === 'string' ? value : undefined
}

function getPrismaMetaStringArray(meta: Record<string, unknown> | undefined, key: string): string[] {
    if (!meta) {
        return []
    }
    const value = meta[key]
    if (!Array.isArray(value)) {
        return []
    }
    return value.filter((item): item is string => typeof item === 'string')
}

function extractQuotedIdentifier(message: string | undefined): string {
    if (!message) {
        return ''
    }
    const match = message.match(/["`](.*?)["`]/)
    return match?.[1] || ''
}
