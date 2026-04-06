import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { ConnectionPool, ISqlTypeFactory, Transaction, Request } from 'mssql'
import { TYPES, ISOLATION_LEVEL, ConnectionError, RequestError, TransactionError } from 'mssql'
import { TimeoutError } from 'tarn'
import type { NativeValueType } from '../expressions/values.js'
import { ManagedTransactionQueryRunner } from './ManagedTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from "../TsSqlError.js"

export class MssqlPoolQueryRunner extends ManagedTransactionQueryRunner {
    readonly database: DatabaseType
    readonly pool: ConnectionPool
    transaction?: Transaction

    constructor(pool: ConnectionPool) {
        super()
        this.pool = pool
        this.database = 'sqlServer'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlServer') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. MssqlPoolQueryRunner only supports sqlServer databases')
        }
    }

    getNativeRunner(): ConnectionPool {
        return this.pool
    }

    getCurrentNativeTransaction(): Transaction | undefined {
        return this.transaction
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.pool, this.transaction)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        const req = this.request()
        for (var i = 0, length = params.length; i < length; i++) {
            req.input('' + i, { type: this.getType(params, i) }, params[i])
        }
        return req.query(query).then((result) => {
            if (!result.recordset) {
                return []
            }
            return result.recordset
        })
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        const req = this.request()
        for (var i = 0, length = params.length; i < length; i++) {
            req.input('' + i, { type: this.getType(params, i) }, params[i])
        }
        return req.query(query).then((result) => {
            return result.rowsAffected[0]!
        })
    }
    executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        if (this.transaction) {
            return Promise.reject(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, this.database + " doesn't support nested transactions (using " + this.constructor.name + ")"))
        }
        const level = opts[0]
        const accessMode = opts[1]
        if (accessMode) {
            return Promise.reject(new TsSqlProcessingError({ reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode }, this.database + " doesn't support the transactions access mode: " + accessMode))
        }
         
        if (!level) {
            this.transaction = this.pool.transaction()
            return this.transaction.begin().then(() => undefined)
        } else if (level === 'read uncommitted') {
            this.transaction = this.pool.transaction()
            return this.transaction.begin(ISOLATION_LEVEL.READ_UNCOMMITTED).then(() => undefined)
        } else if (level === 'read committed') {
            this.transaction = this.pool.transaction()
            return this.transaction.begin(ISOLATION_LEVEL.READ_COMMITTED).then(() => undefined)
        } else if (level === 'repeatable read') {
            this.transaction = this.pool.transaction()
            return this.transaction.begin(ISOLATION_LEVEL.REPEATABLE_READ).then(() => undefined)
        } else if (level === 'snapshot') {
            this.transaction = this.pool.transaction()
            return this.transaction.begin(ISOLATION_LEVEL.SNAPSHOT).then(() => undefined)
        } else if (level === 'serializable') {
            this.transaction = this.pool.transaction()
            return this.transaction.begin(ISOLATION_LEVEL.SERIALIZABLE).then(() => undefined)
        } else {
            return Promise.reject(new TsSqlProcessingError({ reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: level }, this.database + " doesn't support the transactions level: " + level))
        }
    }
    executeCommit(_opts: CommitOpts = []): Promise<void> {
        if (!this.transaction) {
            return Promise.reject(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in an transaction, you cannot commit the transaction'))
        }
        return this.transaction.commit().then(() => {
            // Transaction count only modified when commit successful, in case of error there is still an open transaction 
            this.transaction = undefined
        })
    }
    executeRollback(_opts: RollbackOpts = []): Promise<void> {
        if (!this.transaction) {
            return Promise.reject(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in an transaction, you cannot rollback the transaction'))
        }
        return this.transaction.rollback().finally(() => {
            this.transaction = undefined
        })
    }
    isTransactionActive(): boolean {
        return !!this.transaction
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return '@' + index
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return MssqlPoolQueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return MssqlPoolQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isMssqlError(error)) {
            return { reason: 'UNKNOWN' }
        }
        return getMssqlErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isMssqlError(error)
    }

    protected request(): Request {
        if (this.transaction) {
            return this.transaction.request()
        } else {
            return this.pool.request()
        }
    }

    protected predefinedTypes: {[type: string]: ISqlTypeFactory | undefined} = {
        boolean: TYPES.Bit,
        stringInt: TYPES.BigInt,
        int: TYPES.Int,
        bigint: TYPES.BigInt,
        stringDouble: TYPES.Float,
        double: TYPES.Float,
        string: TYPES.NVarChar,
        uuid: TYPES.UniqueIdentifier,
        localDate: TYPES.Date,
        localTime: TYPES.Time,
        localDateTime: TYPES.DateTime2,
        customInt: TYPES.BigInt,
        customDouble: TYPES.Float,
        customUuid: TYPES.UniqueIdentifier,
        customLocalDate: TYPES.Date,
        customLocalTime: TYPES.Time,
        customLocalDateTime: TYPES.DateTime2
    } satisfies {[type in NativeValueType | 'stringInt' | 'stringDouble']: ISqlTypeFactory | undefined}

    protected getType(params: any[], index: number): ISqlTypeFactory {
        const definedType: string | undefined = (params as any)['@' + index]
        if (definedType) {
            const type = this.predefinedTypes[definedType]
            if (type) {
                return type
            }
        }
        return this.inferType(params[index])
    }

    protected inferType(value: any): ISqlTypeFactory {
        // Inspired by: https://github.com/Hypermediaisobar-admin/node-any-db-mssql/blob/master/index.js
        if (value === null || value === undefined) {
            return TYPES.Variant; // TYPES.Null not included in mssql
        } else if (typeof value === 'number') {
            if (Number.isSafeInteger(value)) {
                return TYPES.Int
            } else {
                return TYPES.Float
            }
        } else if (typeof value === 'bigint') {
            return TYPES.BigInt
        } else if (typeof value === 'boolean') {
            return TYPES.Bit
        } else if (value instanceof Array) {
            return (value.length > 0 ? this.inferType(value[0]) : TYPES.Variant); // TYPES.Null not included in mssql
        } else if (value instanceof Date) {
            switch ((value as any).___type___) {
                case 'LocalDateTime':
                    return TYPES.DateTime2
                case 'LocalDate':
                    return TYPES.Date
                case 'LocalTime':
                    return TYPES.Time
                default:
                    return TYPES.DateTime2; // Maybe: TYPES.DateTimeOffset
            }
        } else if (typeof value === 'string') {
            if (/^-?\d+$/.test(value)) {
                if (value.length > 9) {
                    return TYPES.BigInt
                } else {
                    return TYPES.Int
                }
            } else if (/^-?\d+\.\d+$/.test(value)) {
                return TYPES.Float
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                return TYPES.Date
            } else if (/^\d{2}\:\d{2}(?:\:\d{2})?(?:\+\d{4})?$/.test(value)) {
                return TYPES.Time
            } else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}\:\d{2}(?:\:\d{2}(?:\.\d+)?)?$/.test(value)) {
                return TYPES.DateTime2
            } else if (/^\d{4}-\d{2}-\d{2}T\d{2}\:\d{2}\:\d{2}(?:\.\d+)?$/.test(value)) {
                return TYPES.DateTime2
            } else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}\:\d{2}(?:\:\d{2}(?:\.\d+)?)?(?:[\+\-]\d{2}\:\d{2}|Z)?$/.test(value)) {
                return TYPES.DateTimeOffset
            } else if (/^\d{4}-\d{2}-\d{2}T\d{2}\:\d{2}\:\d{2}(?:\.\d+)?(?:[\+\-]\d{2}\:\d{2}|Z)?$/.test(value)) {
                return TYPES.DateTimeOffset
            } else if (/^([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}|00000000-0000-0000-0000-000000000000)$/i.test(value)) {
                return TYPES.UniqueIdentifier
            } else {
                return TYPES.NVarChar
            }
        }
        return TYPES.VarBinary
    }
}

type MssqlError = ConnectionError | RequestError | TransactionError | TimeoutError

function getMssqlErrorReason(error: MssqlError): TsSqlErrorReason {
    if (error instanceof TimeoutError) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: 'TimeoutError', databaseErrorMessage: error.message, resourceType: 'pool' }
    }
    if (error instanceof TransactionError) {
        return getMssqlTransactionErrorReason(error)
    }
    if (error instanceof ConnectionError) {
        return getMssqlConnectionErrorReason(error)
    }
    return getMssqlRequestErrorReason(error)
}

function getMssqlTransactionErrorReason(error: TransactionError): TsSqlErrorReason {
    switch (error.code) {
        case 'ENOTBEGUN':
            return { reason: 'NOT_IN_TRANSACTION', databaseErrorCode: error.code, databaseErrorMessage: error.message }
        case 'EABORT':
            return { reason: 'SQL_TRANSACTION_ABORTED', databaseErrorCode: error.code, databaseErrorMessage: error.message }
        case 'EALREADYBEGUN':
            return { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED', databaseErrorCode: error.code, databaseErrorMessage: error.message }
        case 'EREQINPROG':
            return { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode: error.code, databaseErrorMessage: error.message }
        default:
            return { reason: 'SQL_UNKNOWN', databaseErrorCode: error.code, databaseErrorMessage: error.message }
    }
}

function getMssqlConnectionErrorReason(error: ConnectionError): TsSqlErrorReason {
    const code = error.code as string
    switch (error.code) {
        case 'ELOGIN':
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message }
        case 'ETIMEOUT':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: error.message, timeoutType: 'connection' }
        case 'EINSTLOOKUP':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'invalid connection configuration' }
        case 'ENOTOPEN':
        case 'ECONNCLOSED':
        case 'ESOCKET':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
        default:
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message }
    }
}

function getMssqlRequestErrorReason(error: RequestError): TsSqlErrorReason {
    const number = error.number
    const code: string = error.code || ''
    const message = error.message || ''

    switch (number) {
        case 137:
        case 201:
        case 8144:
        case 8146:
        case 8178:
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: number, databaseErrorMessage: message }
        case 2601:
        case 2627:
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode: number, databaseErrorMessage: message, constraintType: 'unique', constraintName: extractUniqueConstraintName(message), tableName: extractObjectTableName(message) }
        case 515:
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode: number, databaseErrorMessage: message, constraintType: 'not null', tableName: extractTableName(message), columnName: extractColumnName(message) }
        case 547:
            return getConstraintViolationFrom547(message, number)
        case 8115:
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', databaseErrorCode: number, databaseErrorMessage: message, errorType: 'out of range', columnName: extractColumnName(message) }
        case 8152:
        case 2628:
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', databaseErrorCode: number, databaseErrorMessage: message, errorType: 'too long', columnName: extractColumnName(message) }
        case 241:
        case 242:
        case 245:
        case 248:
        case 249:
        case 295:
        case 296:
        case 8169:
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', databaseErrorCode: number, databaseErrorMessage: message, errorType: 'invalid value', columnName: extractColumnName(message) }
        case 911:
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: number, databaseErrorMessage: message, objectType: 'database', objectName: extractQuotedName(message) }
        case 208:
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: number, databaseErrorMessage: message, objectType: 'table or view', objectName: extractQuotedName(message) }
        case 207:
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: number, databaseErrorMessage: message, objectType: 'column', columnName: extractQuotedName(message), objectName: extractQuotedName(message) }
        case 2812:
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: number, databaseErrorMessage: message, objectType: 'routine', objectName: extractQuotedName(message) }
        case 2714:
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode: number, databaseErrorMessage: message, objectName: extractQuotedName(message) }
        case 209:
            return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode: number, databaseErrorMessage: message, identifier: extractQuotedName(message) }
        case 102:
        case 105:
        case 156:
        case 319:
            return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode: number, databaseErrorMessage: message }
        case 8134:
            return { reason: 'SQL_DIVISION_BY_ZERO', databaseErrorCode: number, databaseErrorMessage: message }
        case 512:
            return { reason: 'SQL_CARDINALITY_VIOLATION', databaseErrorCode: number, databaseErrorMessage: message }
        case 1205:
            return { reason: 'SQL_DEADLOCK_DETECTED', databaseErrorCode: number, databaseErrorMessage: message }
        case 1222:
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: number, databaseErrorMessage: message, timeoutType: 'lock' }
        case 3960:
            return { reason: 'SQL_SERIALIZATION_FAILURE', databaseErrorCode: number, databaseErrorMessage: message }
        case 3902:
        case 3903:
            return { reason: 'NOT_IN_TRANSACTION', databaseErrorCode: number, databaseErrorMessage: message }
        case 3930:
            return { reason: 'SQL_TRANSACTION_ABORTED', databaseErrorCode: number, databaseErrorMessage: message }
        case 3906:
            return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode: number, databaseErrorMessage: message }
        case 229:
            return { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode: number, databaseErrorMessage: message }
        case 916:
            return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode: number, databaseErrorMessage: message }
        case 4060:
            return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode: number, databaseErrorMessage: message }
        case 18456:
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: number, databaseErrorMessage: message }
        case 701:
        case 802:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: number, databaseErrorMessage: message, resourceType: 'memory' }
        case 1101:
        case 1105:
        case 9002:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: number, databaseErrorMessage: message, resourceType: 'disk' }
        case 10928:
        case 10929:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: number, databaseErrorMessage: message }
        case 40544:
        case 40551:
        case 40553:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: number, databaseErrorMessage: message, resourceType: 'disk' }
        case 40549:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: number, databaseErrorMessage: message, resourceType: 'temp space' }
        case 40552:
        case 40557:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: number, databaseErrorMessage: message, resourceType: 'memory' }
        case 40554:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: number, databaseErrorMessage: message, resourceType: 'cpu' }
        case 40550:
        case 40555:
        case 40556:
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: number, databaseErrorMessage: message }
        case 40558:
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: number, databaseErrorMessage: message }
    }

    switch (code) {
        case 'ECANCEL':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: message, timeoutType: 'cancelled' }
        case 'ETIMEOUT':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: message, timeoutType: 'statement' }
        case 'ENOCONN':
        case 'ECONNCLOSED':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: message, errorType: 'connection lost' }
        case 'EREQINPROG':
            return { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode: code, databaseErrorMessage: message }
        case 'EARGS':
        case 'EDUPEPARAM':
        case 'EPARAM':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage: message }
        case 'EINJECT':
            return { reason: 'SQL_UNKNOWN', databaseErrorCode: code, databaseErrorMessage: message }
        default:
            return { reason: 'SQL_UNKNOWN', databaseErrorCode: code || number, databaseErrorMessage: message }
    }
}

function getConstraintViolationFrom547(message: string, databaseErrorCode: number): TsSqlErrorReason {
    const upper = message.toUpperCase()
    if (upper.includes('FOREIGN KEY CONSTRAINT')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage: message, constraintType: 'foreign key', constraintName: extractConstraintName(message), tableName: extractTableName(message) }
    }
    if (upper.includes('CHECK CONSTRAINT')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage: message, constraintType: 'check', constraintName: extractConstraintName(message), tableName: extractTableName(message) }
    }
    return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage: message, constraintName: extractConstraintName(message), tableName: extractTableName(message) }
}

function isMssqlError(error: unknown): error is MssqlError {
    if (error instanceof TimeoutError) {
        return true
    }
    if (error instanceof ConnectionError || error instanceof TransactionError) {
        return true
    }
    if (!(error instanceof RequestError)) {
        return false
    }
    const code = error.code as string
    switch (code) {
        case 'EARGS':
        case 'EDUPEPARAM':
        case 'EPARAM':
            return true
        case 'EINJECT':
        case 'EDEPRECATED':
        case 'EJSON':
        case 'ENAME':
            return false
        default:
            return true
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
