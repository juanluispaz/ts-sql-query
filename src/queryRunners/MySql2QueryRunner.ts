import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { Connection, QueryError, ResultSetHeader, RowDataPacket } from 'mysql2'
import { DelegatedSetTransactionQueryRunner } from './DelegatedSetTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'

export class MySql2QueryRunner extends DelegatedSetTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection

    constructor(connection: Connection, database: 'mariaDB' | 'mySql' = 'mySql') {
        super()
        this.connection = connection
        this.database = database
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. MySql2QueryRunner only supports mySql or mariaDB databases')
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
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error: QueryError | null, results: RowDataPacket[]) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results)
                }
            })
        })
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error: QueryError | null, results: ResultSetHeader) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results.affectedRows)
                }
            })
        })
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }
        
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error: QueryError | null, results: ResultSetHeader) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results.insertId)
                }
            })
        })
    }
    doBeginTransaction(_opts: BeginTransactionOpts): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.beginTransaction((error: QueryError | null) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(undefined)
                }
            })
        })
    }
    doCommit(_opts: CommitOpts): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.commit((error: QueryError | null) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(undefined)
                }
            })
        })
    }
    doRollback(_opts: RollbackOpts): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.rollback((error: QueryError | null) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(undefined)
                }
            })
        })
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return MySql2QueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return MySql2QueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isMySql2Error(error)) {
            return { reason: 'UNKNOWN' }
        }
        return getMySql2ErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isMySql2Error(error)
    }
}

function getMySql2ErrorReason(error: QueryError): TsSqlErrorReason {
    const errno = error.errno
    const code = error.code || ''
    const sqlState = error.sqlState || ''
    const message = error.message || ''

    if (message === 'Pool is closed.') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: getMySql2DatabaseErrorCode(error), databaseErrorMessage: message, errorType: 'pool error' }
    }
    if (message === 'No connections available.' || message === 'Queue limit reached.') {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: getMySql2DatabaseErrorCode(error), databaseErrorMessage: message, resourceType: 'pool' }
    }
    if (message === "Can't add new command when connection is in closed state" || message === "Can't write in closed state") {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: getMySql2DatabaseErrorCode(error), databaseErrorMessage: message, errorType: 'connection lost' }
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
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode: errno, databaseErrorMessage: message, constraintType: 'foreign key', constraintName: extractKeyName(message), tableName: extractMySqlConstraintTableName(message), columnName: extractMySqlForeignKeyColumnName(message) }
        case 3819:
        case 4025:
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode: errno, databaseErrorMessage: message, constraintType: 'check', constraintName: extractKeyName(message), tableName: extractMySqlCheckTableName(message) }
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
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: errno, databaseErrorMessage: message }
        case 1792:
            return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode: errno, databaseErrorMessage: message }
        case 1235:
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: errno, databaseErrorMessage: message }
        default:
            if (sqlState.startsWith('08')) {
                return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: getMySql2DatabaseErrorCode(error), databaseErrorMessage: message, errorType: 'connection lost' }
            }
            if (sqlState.startsWith('28')) {
                return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: getMySql2DatabaseErrorCode(error), databaseErrorMessage: message }
            }
            if (sqlState === '70100') {
                return { reason: 'SQL_TIMEOUT', databaseErrorCode: getMySql2DatabaseErrorCode(error), databaseErrorMessage: message, timeoutType: 'cancelled' }
            }
            if (code === 'POOL_CLOSED') {
                return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: getMySql2DatabaseErrorCode(error), databaseErrorMessage: message, errorType: 'pool error' }
            }
            if (code === 'POOL_ENQUEUELIMIT') {
                return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: getMySql2DatabaseErrorCode(error), databaseErrorMessage: message, resourceType: 'pool' }
            }
            if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EPIPE' || code === 'PROTOCOL_CONNECTION_LOST') {
                return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: getMySql2DatabaseErrorCode(error), databaseErrorMessage: message, errorType: 'connection lost' }
            }
            if (code === 'ETIMEDOUT' || code === 'PROTOCOL_SEQUENCE_TIMEOUT') {
                return { reason: 'SQL_TIMEOUT', databaseErrorCode: getMySql2DatabaseErrorCode(error), databaseErrorMessage: message, timeoutType: 'connection' }
            }
            if (isMySql2InvalidParameterMessage(message)) {
                return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: getMySql2DatabaseErrorCode(error), databaseErrorMessage: message }
            }
            return { reason: 'SQL_UNKNOWN', databaseErrorCode: getMySql2DatabaseErrorCode(error), databaseErrorMessage: message }
    }
}

function isMySql2Error(error: unknown): error is QueryError {
    return !!error && error instanceof Error && (
        typeof (error as QueryError).code === 'string'
        || typeof (error as any).errno === 'number'
        || typeof (error as QueryError).sqlState === 'string'
        || isMySql2DriverMessage((error as Error).message || '')
        || isMySql2InvalidParameterMessage((error as Error).message || '')
    )
}

function isMySql2InvalidParameterMessage(message: string): boolean {
    return message === 'Bind parameters must be array if namedPlaceholders parameter is not enabled'
        || message === 'Bind parameters must not contain undefined'
        || message === 'Bind parameters must not contain undefined. To pass SQL NULL specify JS null'
        || message === 'Bind parameters must not contain function(s). To pass the body of a function as a string call .toString() first'
}

function isMySql2DriverMessage(message: string): boolean {
    return message === 'Pool is closed.'
        || message === 'No connections available.'
        || message === 'Queue limit reached.'
        || message === "Can't add new command when connection is in closed state"
        || message === "Can't write in closed state"
}

function getMySql2DatabaseErrorCode(error: QueryError): string | number | undefined {
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

function extractMySqlConstraintTableName(message: string): string | undefined {
    return extractMessageTableName(message)
}

function extractMySqlCheckTableName(message: string): string | undefined {
    const match = /failed for [`'"][^`'"]+[`'"]\.[`'"]([^`'"]+)[`'"]/i.exec(message)
    if (match) {
        return match[1]
    }
    return extractMessageTableName(message)
}

function extractMySqlForeignKeyColumnName(message: string): string | undefined {
    const match = /foreign key\s*\([`'"]([^`'"]+)[`'"]\)/i.exec(message)
    if (match) {
        return match[1]
    }
    return undefined
}
