import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { Connection, SqlError, UpsertResult } from 'mariadb'
import { DelegatedSetTransactionQueryRunner } from './DelegatedSetTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'

export class MariaDBQueryRunner extends DelegatedSetTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection

    constructor(connection: Connection, database: 'mariaDB' | 'mySql' = 'mariaDB') {
        super()
        this.connection = connection
        this.database = database
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. MariaDBQueryRunner only supports mariaDB or mySql databases')
        } else {
            // @ts-ignore
            this.database = database
        }
    }

    getNativeRunner(): Connection {
        return this.connection
    }

    getCurrentNativeTransaction(): undefined {
        return undefined
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.connection.query({ sql: query, bigNumberStrings: true }, params)
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.connection.query({ sql: query, bigNumberStrings: true }, params).then((result: UpsertResult) => result.affectedRows)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }
        
        return this.connection.query({ sql: query, bigNumberStrings: true }, params).then((result: UpsertResult) => result.insertId)
    }
    doBeginTransaction(_opts: BeginTransactionOpts): Promise<void> {
        return this.connection.beginTransaction()
    }
    doCommit(_opts: CommitOpts): Promise<void> {
        return this.connection.commit()
    }
    doRollback(_opts: RollbackOpts): Promise<void> {
        return this.connection.rollback()
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return MariaDBQueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return MariaDBQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isMariaDbError(error)) {
            return { reason: 'UNKNOWN' }
        }
        return getMariaDbErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isMariaDbError(error)
    }
}

function getMariaDbErrorReason(error: SqlError): TsSqlErrorReason {
    const errno = error.errno
    const code = error.code || ''
    const sqlState = error.sqlState || ''
    const message = error.sqlMessage || error.message || ''

    if (code === 'ER_POOL_ALREADY_CLOSED' || message === 'pool is closed' || message === 'pool is already closed' || message === 'Cannot add request to pool, pool is closed') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: getMariaDbDatabaseErrorCode(error), databaseErrorMessage: message, errorType: 'pool error' }
    }
    if (message === 'pool is ending, connection request aborted') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: getMariaDbDatabaseErrorCode(error), databaseErrorMessage: message, errorType: 'pool error' }
    }

    switch (errno) {
        case 1062:
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode: errno, databaseErrorMessage: message, constraintType: 'unique', constraintName: extractKeyName(message), tableName: extractMessageTableName(message) }
        case 1048:
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode: errno, databaseErrorMessage: message, constraintType: 'not null', columnName: extractQuotedName(message), tableName: extractMessageTableName(message) }
        case 1451:
        case 1452:
        case 1216:
        case 1217:
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode: errno, databaseErrorMessage: message, constraintType: 'foreign key', constraintName: extractKeyName(message), tableName: extractMariaDbConstraintTableName(message), columnName: extractMariaDbForeignKeyColumnName(message) }
        case 4025:
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode: errno, databaseErrorMessage: message, constraintType: 'check', constraintName: extractKeyName(message), tableName: extractMariaDbCheckTableName(message) }
        case 1406:
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', databaseErrorCode: errno, databaseErrorMessage: message, errorType: 'too long', columnName: extractQuotedName(message) }
        case 1264:
        case 1690:
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', databaseErrorCode: errno, databaseErrorMessage: message, errorType: 'out of range' }
        case 1292:
        case 1366:
        case 1411:
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', databaseErrorCode: errno, databaseErrorMessage: message, errorType: 'invalid value' }
        case 1049:
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: errno, databaseErrorMessage: message, objectType: 'database', objectName: extractQuotedName(message) }
        case 1146:
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: errno, databaseErrorMessage: message, objectType: 'table or view', objectName: extractQuotedName(message) }
        case 1054:
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: errno, databaseErrorMessage: message, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
        case 1305:
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: errno, databaseErrorMessage: message, objectType: 'routine', objectName: extractQuotedName(message) }
        case 1007:
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode: errno, databaseErrorMessage: message, objectType: 'database', objectName: extractQuotedName(message) }
        case 1050:
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode: errno, databaseErrorMessage: message, objectType: 'table or view', objectName: extractQuotedName(message) }
        case 1060:
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode: errno, databaseErrorMessage: message, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
        case 1304:
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode: errno, databaseErrorMessage: message, objectType: 'routine', objectName: extractQuotedName(message) }
        case 1052:
            return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode: errno, databaseErrorMessage: message, identifier: extractQuotedName(message) }
        case 1064:
        case 1149:
            return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode: errno, databaseErrorMessage: message }
        case 1365:
            return { reason: 'SQL_DIVISION_BY_ZERO', databaseErrorCode: errno, databaseErrorMessage: message }
        case 1242:
            return { reason: 'SQL_CARDINALITY_VIOLATION', databaseErrorCode: errno, databaseErrorMessage: message }
        case 1213:
            return { reason: 'SQL_DEADLOCK_DETECTED', databaseErrorCode: errno, databaseErrorMessage: message }
        case 1205:
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: errno, databaseErrorMessage: message, timeoutType: 'lock' }
        case 1206:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: errno, databaseErrorMessage: message, resourceType: 'memory' }
        case 1114:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: errno, databaseErrorMessage: message, resourceType: 'disk' }
        case 1044:
            return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode: errno, databaseErrorMessage: message }
        case 1142:
        case 1143:
        case 1144:
        case 1227:
        case 1370:
            return { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode: errno, databaseErrorMessage: message }
        case 1045:
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: errno, databaseErrorMessage: message }
        case 1040:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: errno, databaseErrorMessage: message, resourceType: 'connections' }
        case 1041:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: errno, databaseErrorMessage: message, resourceType: 'memory' }
        case 1046:
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: errno, databaseErrorMessage: message, objectType: 'database' }
        case 1158:
        case 1159:
        case 1160:
        case 1161:
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: errno, databaseErrorMessage: message, errorType: 'connection lost' }
        case 1317:
        case 1319:
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: errno, databaseErrorMessage: message, timeoutType: 'cancelled' }
        case 1210:
        case 1318:
        case 45016:
        case 45017:
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: errno, databaseErrorMessage: message }
        case 1792:
            return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode: errno, databaseErrorMessage: message }
        case 1235:
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: errno, databaseErrorMessage: message }
        default:
            if (sqlState.startsWith('08')) {
                return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: getMariaDbDatabaseErrorCode(error), databaseErrorMessage: message, errorType: 'connection lost' }
            }
            if (sqlState.startsWith('28')) {
                return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: getMariaDbDatabaseErrorCode(error), databaseErrorMessage: message }
            }
            if (sqlState === '70100') {
                return { reason: 'SQL_TIMEOUT', databaseErrorCode: getMariaDbDatabaseErrorCode(error), databaseErrorMessage: message, timeoutType: 'cancelled' }
            }
            if (code === 'ER_GET_CONNECTION_TIMEOUT') {
                return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: getMariaDbDatabaseErrorCode(error), databaseErrorMessage: message, resourceType: 'pool' }
            }
            if (code === 'ER_CANT_GET_CONNECTION') {
                return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: getMariaDbDatabaseErrorCode(error), databaseErrorMessage: message, resourceType: 'pool' }
            }
            if (code === 'POOL_CLOSED') {
                return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: getMariaDbDatabaseErrorCode(error), databaseErrorMessage: message, errorType: 'pool error' }
            }
            if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EPIPE' || code === 'PROTOCOL_CONNECTION_LOST') {
                return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: getMariaDbDatabaseErrorCode(error), databaseErrorMessage: message, errorType: 'connection lost' }
            }
            if (code === 'ER_SOCKET_TIMEOUT' || code === 'PROTOCOL_SEQUENCE_TIMEOUT') {
                return { reason: 'SQL_TIMEOUT', databaseErrorCode: getMariaDbDatabaseErrorCode(error), databaseErrorMessage: message, timeoutType: 'connection' }
            }
            return { reason: 'SQL_UNKNOWN', databaseErrorCode: getMariaDbDatabaseErrorCode(error), databaseErrorMessage: message }
    }
}

function isMariaDbError(error: unknown): error is SqlError {
    return !!error && error instanceof Error && (
        typeof (error as SqlError).errno === 'number'
        || typeof (error as SqlError).code === 'string'
        || typeof (error as SqlError).sqlState === 'string'
        || isMariaDbDriverMessage((error as Error).message || '', (error as SqlError).code || '')
    )
}

function isMariaDbDriverMessage(message: string, code: string): boolean {
    return code === 'ER_POOL_ALREADY_CLOSED'
        || message === 'pool is closed'
        || message === 'pool is already closed'
        || message === 'Cannot add request to pool, pool is closed'
        || message === 'pool is ending, connection request aborted'
}

function getMariaDbDatabaseErrorCode(error: SqlError): string | number | undefined {
    return error.errno ?? error.code
}

function extractQuotedName(message: string): string | undefined {
    const backtick = /`([^`]+)`/.exec(message)
    if (backtick) {
        return backtick[1]
    }
    const singleQuoted = /'([^']+)'/.exec(message)
    if (singleQuoted) {
        return singleQuoted[1]
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

function extractMariaDbConstraintTableName(message: string): string | undefined {
    return extractMessageTableName(message)
}

function extractMariaDbCheckTableName(message: string): string | undefined {
    const match = /failed for [`'"][^`'"]+[`'"]\.[`'"]([^`'"]+)[`'"]/i.exec(message)
    if (match) {
        return match[1]
    }
    return extractMessageTableName(message)
}

function extractMariaDbForeignKeyColumnName(message: string): string | undefined {
    const match = /foreign key\s*\([`'"]([^`'"]+)[`'"]\)/i.exec(message)
    if (match) {
        return match[1]
    }
    return undefined
}
