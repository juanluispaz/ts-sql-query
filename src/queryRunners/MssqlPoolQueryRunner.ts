import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { ConnectionPool, ISqlTypeFactory, Request, Transaction } from 'mssql'
import mssql from 'mssql'
import type { NativeValueType } from '../expressions/values.js'
import { ManagedTransactionQueryRunner } from './ManagedTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from "../TsSqlError.js"
import { getMssqlErrorReason, isMssqlError } from './connectorErrorMappers/MssqlErrorMapper.js'
import { databaseIsolationLevel } from '../utils/transactionIsolationLevel.js'
import { getParamType } from '../utils/queryParamsMetadata.js'

const { TYPES, ISOLATION_LEVEL } = mssql

const isolationLevelWords: { [level: number]: string } = {
    [ISOLATION_LEVEL.READ_UNCOMMITTED]: 'read uncommitted',
    [ISOLATION_LEVEL.READ_COMMITTED]: 'read committed',
    [ISOLATION_LEVEL.REPEATABLE_READ]: 'repeatable read',
    [ISOLATION_LEVEL.SERIALIZABLE]: 'serializable',
    [ISOLATION_LEVEL.SNAPSHOT]: 'snapshot',
}

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
        const accessMode = opts[1]
        if (accessMode) {
            return Promise.reject(new TsSqlProcessingError({ reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode }, this.database + " doesn't support the transactions access mode: " + accessMode))
        }
        let level
        try {
            level = databaseIsolationLevel(this.database, opts[0])
        } catch (error) {
            return Promise.reject(error)
        }

        let isolationLevel: number | undefined
        if (!level) {
            isolationLevel = undefined
        } else if (level === 'read uncommitted') {
            isolationLevel = ISOLATION_LEVEL.READ_UNCOMMITTED
        } else if (level === 'read committed') {
            isolationLevel = ISOLATION_LEVEL.READ_COMMITTED
        } else if (level === 'repeatable read') {
            isolationLevel = ISOLATION_LEVEL.REPEATABLE_READ
        } else if (level === 'snapshot') {
            isolationLevel = ISOLATION_LEVEL.SNAPSHOT
        } else if (level === 'serializable') {
            isolationLevel = ISOLATION_LEVEL.SERIALIZABLE
        } else {
            return Promise.reject(new TsSqlProcessingError({ reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: level }, this.database + " doesn't support the transactions level: " + level))
        }

        const transaction = this.pool.transaction()
        this.transaction = transaction
        // SQL Server keeps a transaction's isolation level on the session after the transaction ends, so the pooled
        // connection would run every later query outside a transaction at that level; it is put back before the
        // transaction ends (see restoreConnectionIsolationLevel).
        this.restoreIsolationLevel = isolationLevel !== undefined && isolationLevel !== this.connectionIsolationLevel()
        return (isolationLevel === undefined ? transaction.begin() : transaction.begin(isolationLevel)).then(() => {
            if (this.restoreIsolationLevel) {
                this.watchTransactionConnection(transaction)
            }
        }, (error) => {
            if (this.transaction === transaction) {
                this.transaction = undefined
                this.restoreIsolationLevel = false
                this.transactionConnection = undefined
            }
            throw error
        })
    }
    executeCommit(_opts: CommitOpts = []): Promise<void> {
        const transaction = this.transaction
        if (!transaction) {
            return Promise.reject(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in an transaction, you cannot commit the transaction'))
        }
        return this.restoreConnectionIsolationLevel(transaction).then(() => transaction.commit()).then(() => {
            // Transaction count only modified when commit successful, in case of error there is still an open transaction
            this.transaction = undefined
        })
    }
    executeRollback(_opts: RollbackOpts = []): Promise<void> {
        const transaction = this.transaction
        if (!transaction) {
            return Promise.reject(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in an transaction, you cannot rollback the transaction'))
        }
        return this.restoreConnectionIsolationLevel(transaction).then(() => transaction.rollback()).finally(() => {
            this.transaction = undefined
        })
    }
    private restoreIsolationLevel = false
    /** The tedious connection of the current transaction, when its isolation level has to be put back. */
    private transactionConnection: any
    /**
     * The isolation level a connection of the pool runs at outside a transaction: tedious' connectionIsolationLevel
     * option, READ COMMITTED by default.
     */
    protected connectionIsolationLevel(): number {
        return (this.pool as any).config?.options?.connectionIsolationLevel ?? ISOLATION_LEVEL.READ_COMMITTED
    }
    /**
     * When the level can't be put back — the server rolled the transaction back by itself (a deadlock victim, or an
     * error that dooms it), and mssql handed the connection back to the pool right away; or the SET failed — the
     * connection would serve later queries at the transaction's level. It is flagged as broken instead, the same flag
     * mssql sets on a failed socket, so the pool closes it rather than lending it out again. Relies on mssql internals
     * (`_acquiredConnection` / `hasError`, watched by a test in test/runners/sqlserver); when they are missing nothing
     * is flagged.
     */
    private watchTransactionConnection(transaction: Transaction): void {
        const nativeConnection = (transaction as any)._acquiredConnection
        this.transactionConnection = nativeConnection
        if (!nativeConnection) {
            return
        }
        transaction.on('rollback', (aborted: boolean) => {
            if (aborted) {
                nativeConnection.hasError = true
            }
        })
    }
    /** Never rejects: when the level can't be put back the connection is discarded, and the transaction still ends. */
    private restoreConnectionIsolationLevel(transaction: Transaction): Promise<void> {
        if (!this.restoreIsolationLevel) {
            return Promise.resolve()
        }
        this.restoreIsolationLevel = false
        const nativeConnection = this.transactionConnection
        this.transactionConnection = undefined
        const words = isolationLevelWords[this.connectionIsolationLevel()] ?? 'read committed'
        // As a batch: run through sp_executesql (what query() does) a SET only lasts until the call returns
        return transaction.request().batch('set transaction isolation level ' + words).then(() => undefined, () => {
            if (nativeConnection) {
                nativeConnection.hasError = true
            }
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
        const definedType = getParamType(params, '@' + index)
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
            // A typed NULL: mssql has no TYPES.Null, and tedious can't send a Variant
            return TYPES.NVarChar
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
            return (value.length > 0 ? this.inferType(value[0]) : TYPES.NVarChar)
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
                // tedious binds only a Date as TIME; SQL Server converts the text where a time is expected
                return TYPES.NVarChar
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
