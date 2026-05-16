import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type {
    ConnectionPool,
    ConnectionError as MssqlConnectionError,
    ISqlTypeFactory,
    MSSQLError as MssqlBaseError,
    PreparedStatementError as MssqlPreparedStatementError,
    Request,
    RequestError as MssqlRequestError,
    Transaction,
    TransactionError as MssqlTransactionError,
} from 'mssql'
import mssql from 'mssql'
import { TimeoutError } from 'tarn'
import type { NativeValueType } from '../expressions/values.js'
import { ManagedTransactionQueryRunner } from './ManagedTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from "../TsSqlError.js"
import { getSqlServerEngineErrorReason } from './databaseErrorMappers/SqlServerErrorMapper.js'

const { TYPES, ISOLATION_LEVEL, ConnectionError, MSSQLError, PreparedStatementError, RequestError, TransactionError } = mssql

export class MssqlPoolQueryRunner extends ManagedTransactionQueryRunner {
    readonly database: DatabaseType
    readonly pool: ConnectionPool
    transaction?: Transaction | undefined

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
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return MssqlPoolQueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
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

type MssqlError = MssqlBaseError | MssqlConnectionError | MssqlPreparedStatementError | MssqlRequestError | MssqlTransactionError | TimeoutError | PlainMssqlDriverError

type PlainMssqlDriverError = Error & {
    code?: unknown | undefined
    number?: unknown | undefined
    originalError?: unknown | undefined
}

type ErrorMetadata = {
    databaseErrorCode?: string | undefined
    databaseErrorMessage?: string | undefined
}

function getMssqlErrorReason(error: MssqlError): TsSqlErrorReason {
    if (error instanceof TimeoutError) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: 'TimeoutError', databaseErrorMessage: error.message, resourceType: 'pool' }
    }
    if (error instanceof PreparedStatementError) {
        return getMssqlPreparedStatementErrorReason(error)
    }
    if (error instanceof TransactionError) {
        return getMssqlTransactionErrorReason(error)
    }
    if (error instanceof ConnectionError) {
        return getMssqlConnectionErrorReason(error)
    }
    if (error instanceof RequestError) {
        return getMssqlRequestErrorReason(error)
    }
    if (error instanceof MSSQLError) {
        return getMssqlBaseErrorReason(error)
    }
    return getPlainMssqlDriverErrorReason(error)
}

function getMssqlTransactionErrorReason(error: MssqlTransactionError): TsSqlErrorReason {
    const engineReason = getSqlServerEngineReasonFromMssqlError(error)
    if (engineReason) {
        return engineReason
    }

    const metadata = getErrorMetadata(error)
    switch (getMssqlErrorCode(error)) {
        case 'ENOTBEGUN':
            return { reason: 'NOT_IN_TRANSACTION', ...metadata }
        case 'EABORT':
            return { reason: 'TRANSACTION_ERROR', ...metadata, transactionErrorType: 'aborted' }
        case 'EALREADYBEGUN':
            return { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED', ...metadata }
        case 'EREQINPROG':
        case 'EINVALIDSTATE':
            return { reason: 'FORBIDDEN_CONCURRENT_USAGE', ...metadata }
        case 'ECANCEL':
            return { reason: 'SQL_TIMEOUT', ...metadata, timeoutType: 'cancelled' }
        case 'ETIMEOUT':
            return { reason: 'SQL_TIMEOUT', ...metadata, timeoutType: 'transaction' }
        case 'ENOTOPEN':
        case 'ECONNCLOSED':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'pool error' }
        case 'ECLOSE':
        case 'ESOCKET':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'connection lost' }
        case 'ELOGIN':
        case 'EFEDAUTH':
            return { reason: 'SQL_AUTHENTICATION_ERROR', ...metadata }
        case 'EINSTLOOKUP':
        case 'EDRIVER':
        case 'EENCRYPT':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'invalid connection configuration' }
        case 'ETDS':
        case 'EINTERFACENOTSUPP':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', ...metadata }
        default:
            if (isInvalidIsolationLevelMessage(error.message)) {
                return { reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', ...metadata, transactionLevel: undefined }
            }
            return { reason: 'TRANSACTION_ERROR', ...metadata, transactionErrorType: 'invalid state' }
    }
}

function getMssqlConnectionErrorReason(error: MssqlConnectionError): TsSqlErrorReason {
    const metadata = getErrorMetadata(error)
    switch (getMssqlErrorCode(error)) {
        case 'ELOGIN':
        case 'EFEDAUTH':
            return { reason: 'SQL_AUTHENTICATION_ERROR', ...metadata }
        case 'ETIMEOUT':
            return { reason: 'SQL_TIMEOUT', ...metadata, timeoutType: 'connection' }
        case 'EINSTLOOKUP':
        case 'EDRIVER':
        case 'EENCRYPT':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'invalid connection configuration' }
        case 'ENOTOPEN':
        case 'ECONNCLOSED':
        case 'EALREADYCONNECTED':
        case 'EALREADYCONNECTING':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'pool error' }
        case 'ESOCKET':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'connection lost' }
        case 'ETDS':
        case 'EINTERFACENOTSUPP':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', ...metadata }
        default:
            if (isMssqlAuthenticationMessage(error.message)) {
                return { reason: 'SQL_AUTHENTICATION_ERROR', ...metadata }
            }
            if (isMssqlFeatureNotSupportedMessage(error.message)) {
                return { reason: 'SQL_FEATURE_NOT_SUPPORTED', ...metadata }
            }
            if (isMssqlConnectionLostMessage(error.message)) {
                return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'connection lost' }
            }
            if (isMssqlPoolErrorMessage(error.message)) {
                return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'pool error' }
            }
            if (isMssqlInvalidConnectionConfigurationMessage(error.message)) {
                return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'invalid connection configuration' }
            }
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata }
    }
}

function getMssqlRequestErrorReason(error: MssqlRequestError): TsSqlErrorReason {
    const number = error.number

    if (typeof number === 'number') {
        return getSqlServerEngineErrorReason({
            number,
            databaseErrorCode: getMssqlErrorCode(error),
            databaseErrorNumber: number,
            message: error.message || '',
        })
    }

    const metadata = getErrorMetadata(error)
    switch (getMssqlErrorCode(error)) {
        case 'ECANCEL':
            return { reason: 'SQL_TIMEOUT', ...metadata, timeoutType: 'cancelled' }
        case 'ETIMEOUT':
            return { reason: 'SQL_TIMEOUT', ...metadata, timeoutType: 'statement' }
        case 'ECLOSE':
        case 'ESOCKET':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'connection lost' }
        case 'ENOCONN':
        case 'ENOTOPEN':
        case 'ECONNCLOSED':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'pool error' }
        case 'EREQINPROG':
        case 'EINVALIDSTATE':
            return { reason: 'FORBIDDEN_CONCURRENT_USAGE', ...metadata }
        case 'EARGS':
            return getMssqlInvalidArgumentRequestErrorReason(error, metadata)
        case 'EDUPEPARAM':
            return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'already bound', parameterName: extractMssqlParameterName(error.message) }
        case 'EPARAM':
            return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'invalid value', parameterName: extractMssqlParameterName(error.message) }
        case 'EINJECT':
            return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'invalid name', parameterName: extractMssqlParameterName(error.message) }
        case 'EDEPRECATED':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', ...metadata }
        case 'EJSON':
            return { reason: 'INVALID_JSON_RECEIVED_FROM_DATABASE', value: undefined, typeName: 'json' }
        case 'ENAME':
            return getMssqlNameRequestErrorReason(error, metadata)
        case 'UNKNOWN':
            return { reason: 'SQL_UNKNOWN', ...metadata }
        default:
            return { reason: 'SQL_UNKNOWN', ...metadata }
    }
}

function isMssqlError(error: unknown): error is MssqlError {
    if (error instanceof TimeoutError) {
        return true
    }
    if (error instanceof MSSQLError || error instanceof ConnectionError || error instanceof PreparedStatementError || error instanceof TransactionError) {
        return true
    }
    return isPlainMssqlDriverError(error)
}

function getMssqlPreparedStatementErrorReason(error: MssqlPreparedStatementError): TsSqlErrorReason {
    const metadata = getErrorMetadata(error)
    switch (getMssqlErrorCode(error)) {
        case 'EALREADYPREPARED':
        case 'ENOTPREPARED':
            return { reason: 'SQL_OBJECT_STATE_ERROR', ...metadata, objectType: 'prepared statement', objectStateErrorType: 'invalid state' }
        case 'EARGS':
            return getMssqlInvalidArgumentRequestErrorReason(error, metadata)
        case 'EDUPEPARAM':
            return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'already bound', parameterName: extractMssqlParameterName(error.message) }
        case 'EINJECT':
            return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'invalid name', parameterName: extractMssqlParameterName(error.message) }
        default:
            return { reason: 'SQL_UNKNOWN', ...metadata }
    }
}

function getMssqlBaseErrorReason(error: MssqlBaseError): TsSqlErrorReason {
    const metadata = getErrorMetadata(error)
    if (isMssqlInvalidConnectionConfigurationMessage(error.message)) {
        return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'invalid connection configuration' }
    }
    return { reason: 'SQL_UNKNOWN', ...metadata }
}

function getPlainMssqlDriverErrorReason(error: PlainMssqlDriverError): TsSqlErrorReason {
    const metadata = getErrorMetadata(error)
    if (isTediousInvalidConnectionConfigurationMessage(error.message)) {
        return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'invalid connection configuration' }
    }
    if (isTarnPoolConfigurationMessage(error.message)) {
        return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'pool error' }
    }
    if (isMssqlConnectionLostMessage(error.message)) {
        return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'connection lost' }
    }
    return { reason: 'UNKNOWN' }
}

function getSqlServerEngineReasonFromMssqlError(error: PlainMssqlDriverError): TsSqlErrorReason | undefined {
    const number = getMssqlErrorNumber(error)
        ?? getMssqlErrorNumber(getOriginalError(error))
    if (typeof number !== 'number') {
        return undefined
    }
    return getSqlServerEngineErrorReason({
        number,
        databaseErrorCode: getMssqlErrorCode(error),
        databaseErrorNumber: number,
        message: error.message || '',
    })
}

function getMssqlInvalidArgumentRequestErrorReason(error: PlainMssqlDriverError, metadata = getErrorMetadata(error)): TsSqlErrorReason {
    if (isMssqlUnsupportedTvpTypeMessage(error.message)) {
        return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'invalid type', parameterName: extractMssqlColumnName(error.message) }
    }
    if (isMssqlInvalidNumberOfArgumentsMessage(error.message)) {
        return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'wrong count' }
    }
    return { reason: 'SQL_INVALID_PARAMETER', ...metadata }
}

function getMssqlNameRequestErrorReason(error: PlainMssqlDriverError, metadata = getErrorMetadata(error)): TsSqlErrorReason {
    if (error.message === 'Table name must be specified for bulk insert.') {
        return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'missing', parameterName: 'tableName' }
    }
    if (error.message === "You can't use table variables for bulk insert.") {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', ...metadata }
    }
    if (error.message === 'Table was not found on the server.') {
        return { reason: 'SQL_OBJECT_NOT_FOUND', ...metadata, objectType: 'table' }
    }
    return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'invalid value', parameterName: 'tableName' }
}

function getErrorMetadata(error: PlainMssqlDriverError): ErrorMetadata {
    return {
        databaseErrorCode: getMssqlErrorCode(error),
        databaseErrorMessage: error.message || undefined,
    }
}

function getMssqlErrorCode(error: PlainMssqlDriverError | undefined): string | undefined {
    return typeof error?.code === 'string' && error.code ? error.code : undefined
}

function getMssqlErrorNumber(error: PlainMssqlDriverError | undefined): number | undefined {
    return typeof error?.number === 'number' ? error.number : undefined
}

function getOriginalError(error: PlainMssqlDriverError): PlainMssqlDriverError | undefined {
    return error.originalError instanceof Error ? error.originalError as PlainMssqlDriverError : undefined
}

function extractMssqlParameterName(message: string): string | undefined {
    return /^SQL injection warning for param '([^']+)'$/.exec(message)?.[1]
        ?? /^The parameter name ([^\s]+) has already been declared\./.exec(message)?.[1]
        ?? /^Validation failed for parameter '([^']+)'\./.exec(message)?.[1]
}

function extractMssqlColumnName(message: string): string | undefined {
    return /^Column '([^']+)' in TVP /.exec(message)?.[1]
}

function isPlainMssqlDriverError(error: unknown): error is PlainMssqlDriverError {
    if (!(error instanceof Error)) {
        return false
    }
    return isTediousInvalidConnectionConfigurationMessage(error.message)
        || isTarnPoolConfigurationMessage(error.message)
        || isMssqlConnectionLostMessage(error.message)
}

function isInvalidIsolationLevelMessage(message: string): boolean {
    return message === 'Invalid isolation level.'
}

function isMssqlInvalidNumberOfArgumentsMessage(message: string): boolean {
    return message.startsWith('Invalid number of arguments.')
}

function isMssqlUnsupportedTvpTypeMessage(message: string): boolean {
    return message.includes(' uses sql_variant which is not supported by the tedious driver for TVP column types.')
}

function isMssqlAuthenticationMessage(message: string): boolean {
    return message.includes('Active Directory authentication')
        || message === 'Did not request Active Directory authentication, but received the acknowledgment'
}

function isMssqlFeatureNotSupportedMessage(message: string): boolean {
    return message === 'Received acknowledgement for unknown feature'
        || message === 'Server responded with unknown TDS version.'
        || message === 'Server responded with unsupported interface.'
}

function isMssqlConnectionLostMessage(message: string): boolean {
    return message === 'The connection ended without ever completing the connection'
        || message.startsWith('Connection lost - ')
        || message === 'Connection closed before request completed.'
}

function isMssqlPoolErrorMessage(message: string): boolean {
    return message === 'Cannot close a pool while it is connecting'
        || message === 'Connection not yet open.'
        || message === 'Connection is closing'
        || message === 'Connection is closed.'
}

function isMssqlInvalidConnectionConfigurationMessage(message: string): boolean {
    return message === 'Invalid options `useColumnNames`, use `arrayRowMode` instead'
        || message.startsWith('Server requires encryption, ')
}

function isTediousInvalidConnectionConfigurationMessage(message: string): boolean {
    return message === 'The "config" argument is required and must be of type Object.'
        || message === 'The "config.server" property is required and must be of type string.'
        || message.startsWith('The "config.authentication')
        || message.startsWith('The "config.options.')
        || message.startsWith('The "encrypt" property must be ')
        || message.startsWith('The "type" property must one of ')
        || message.startsWith('Port and instanceName are mutually exclusive, ')
}

function isTarnPoolConfigurationMessage(message: string): boolean {
    return message.startsWith('Tarn: invalid opt.')
        || message.startsWith('Tarn: unsupported option opt.')
        || message === 'Tarn: opt.create function most be provided'
        || message === 'Tarn: opt.destroy function most be provided'
        || message === 'Tarn: opt.min must be an integer >= 0'
        || message === 'Tarn: opt.max must be an integer > 0'
        || message === 'Tarn: opt.max is smaller than opt.min'
}
