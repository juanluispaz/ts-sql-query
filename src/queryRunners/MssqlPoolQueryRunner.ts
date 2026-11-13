import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { ConnectionPool, ISqlType, ISqlTypeFactory, Request, Transaction } from 'mssql'
import mssql from 'mssql'
import type { NativeValueType } from '../expressions/values.js'
import { ManagedTransactionQueryRunner } from './ManagedTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from "../TsSqlError.js"
import { getMssqlErrorReason, isMssqlError } from './connectorErrorMappers/MssqlErrorMapper.js'
import { databaseIsolationLevel } from '../utils/transactionIsolationLevel.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { isProcessInUtc } from '../utils/processTimeZone.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'
import { existingParamContextOf } from '../internal/QueryContextImpl.js'

const { TYPES, ISOLATION_LEVEL } = mssql

const isolationLevelWords: { [level: number]: string } = {
    [ISOLATION_LEVEL.READ_UNCOMMITTED]: 'read uncommitted',
    [ISOLATION_LEVEL.READ_COMMITTED]: 'read committed',
    [ISOLATION_LEVEL.REPEATABLE_READ]: 'repeatable read',
    [ISOLATION_LEVEL.SERIALIZABLE]: 'serializable',
    [ISOLATION_LEVEL.SNAPSHOT]: 'snapshot',
}

export interface MssqlPoolQueryRunnerConfig {
    /**
     * The type of mssql each parameter of a type name (the name given to a custom type, or a built-in one) is bound
     * with, instead of the one of its category: `TYPES.NVarChar` for an exact decimal kept as text, or
     * `TYPES.Decimal(18, 4)`
     */
    typesByName?: { readonly [typeName: string]: ISqlTypeFactory | ISqlType } | undefined
}

export class MssqlPoolQueryRunner extends ManagedTransactionQueryRunner {
    readonly database: DatabaseType
    readonly pool: ConnectionPool
    transaction?: Transaction | undefined
    private config?: MssqlPoolQueryRunnerConfig | undefined

    /** pool: the pool, or a transaction begun with it, which something else commits or rolls back */
    constructor(pool: ConnectionPool | Transaction, config?: MssqlPoolQueryRunnerConfig) {
        super()
        if (!isProcessInUtc() && (pool as any).config?.options?.useUTC === false) {
            // With useUTC false, tedious writes and reads a date and time with the local getters, and the date and
            // time values are in UTC (a Transaction gives the configuration of its pool)
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'useUTC', value: false }, 'MssqlPoolQueryRunner requires a pool without useUTC: false (true is the default of tedious) when the process does not run in UTC: the date and time values are in UTC')
        }
        const options = (pool as { config?: { options?: { camelCaseColumns?: unknown, columnNameReplacer?: unknown, textsize?: unknown } } }).config?.options
        if (typeof options?.textsize === 'number' && options.textsize < 2147483647) {
            // tedious sets the TEXTSIZE of each connection: a text of a max type beyond it is cut without an error
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'textsize', value: options.textsize }, 'MssqlPoolQueryRunner requires a pool without a textsize below the default of tedious (2147483647): a longer text of a varchar(max), nvarchar(max) or varbinary(max) value would be cut without an error')
        }
        if (options?.camelCaseColumns === true || options?.columnNameReplacer) {
            // tedious renames the columns of the results, which the library reads by their name
            const name = options.camelCaseColumns === true ? 'camelCaseColumns' : 'columnNameReplacer'
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name, value: options[name] }, 'MssqlPoolQueryRunner requires a pool without ' + name + ': tedious renames with it the columns of the results, and the library reads each column by its name')
        }
        // A transaction gives its requests like the pool, and only a pool is asked to begin (see executeBeginTransaction)
        this.pool = pool as ConnectionPool
        this.database = 'sqlServer'
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlServer') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. MssqlPoolQueryRunner only supports sqlServer databases')
        }
    }

    getNativeRunner(): ConnectionPool {
        return this.pool
    }

    getCurrentNativeConnection(): Transaction | undefined {
        return this.transaction
    }

    execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT> {
        // Outside a transaction, the pool: mssql doesn't reserve one of its connections but for a transaction
        return fn(this.transaction || this.pool)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        const rejected = this.rejectWhenRolledBackByTheDatabase()
        if (rejected) {
            return rejected
        }
        const req = this.request()
        for (var i = 0, length = params.length; i < length; i++) {
            req.input('' + i, this.getInputType(params, i), params[i])
        }
        return req.query(query).then((result) => {
            if (!result.recordset) {
                return []
            }
            return result.recordset
        }, (error) => this.statementFailed(error))
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        const rejected = this.rejectWhenRolledBackByTheDatabase()
        if (rejected) {
            return rejected
        }
        const req = this.request()
        for (var i = 0, length = params.length; i < length; i++) {
            req.input('' + i, this.getInputType(params, i), params[i])
        }
        return req.query(query).then((result) => {
            return result.rowsAffected[0]!
        }, (error) => this.statementFailed(error))
    }
    private statementFailed(error: unknown): never {
        if (this.transaction) {
            this.transactionOutcome.statementFailed(error, true)
            if (this.transactionOutcome.isRolledBackByTheDatabase()) {
                // The server rolled the transaction back when this statement failed
                this.transactionOutcome.rolledBackByTheDatabase(error)
            }
        }
        throw error
    }
    executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        if (this.transaction) {
            return Promise.reject(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, this.database + " doesn't support nested transactions (using " + this.constructor.name + ")"))
        }
        if (typeof this.pool.transaction !== 'function') {
            return this.rejectBeginInsideAManagedTransaction()
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
            // A deadlock victim, or an error that dooms the transaction (a failed conversion, any error with
            // XACT_ABORT ON): the server rolls the transaction back by itself, and mssql tells it with an aborted
            // rollback
            transaction.on('rollback', (aborted: boolean) => {
                if (aborted && this.transaction === transaction) {
                    this.transactionOutcome.rolledBackByTheDatabase()
                }
            })
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
        if (this.transactionOutcome.isRolledBackByTheDatabase()) {
            return Promise.reject(this.transactionOutcome.rolledBackError())
        }
        return this.restoreConnectionIsolationLevel(transaction).then(() => transaction.commit()).then(() => {
            // Transaction count only modified when commit successful, in case of error there is still an open transaction
            this.transaction = undefined
            this.transactionOutcome.transactionEnded()
        })
    }
    executeRollback(_opts: RollbackOpts = []): Promise<void> {
        const transaction = this.transaction
        if (!transaction) {
            return Promise.reject(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in an transaction, you cannot rollback the transaction'))
        }
        if (this.transactionOutcome.rollbackAlreadyDone()) {
            // mssql already gave the connection back to the pool (flagged as broken when its isolation level had to be
            // put back, see watchTransactionConnection)
            this.transaction = undefined
            this.restoreIsolationLevel = false
            this.transactionConnection = undefined
            return Promise.resolve()
        }
        return this.restoreConnectionIsolationLevel(transaction).then(() => transaction.rollback()).finally(() => {
            this.transaction = undefined
            this.transactionOutcome.transactionEnded()
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
    addParam(params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.MssqlPoolQueryRunner(params, value, type, typeCategory, forceTypeCast)
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
        const request = this.transaction ? this.transaction.request() : this.pool.request()
        // The rows as objects whatever the pool was configured with (arrayRowMode): the library reads each column by
        // its name
        request.arrayRowMode = false
        return request
    }

    protected predefinedTypes: {[type: string]: ISqlTypeFactory | undefined} = {
        boolean: TYPES.Bit,
        int: TYPES.Int,
        bigint: TYPES.BigInt,
        double: TYPES.Float,
        string: TYPES.NVarChar,
        uuid: TYPES.UniqueIdentifier,
        localDate: TYPES.Date,
        localTime: TYPES.Time,
        localDateTime: TYPES.DateTime2,
        customInt: TYPES.Int,
        customBigint: TYPES.BigInt,
        customDouble: TYPES.Float,
        // TYPES.Decimal converts the value to a JavaScript number before sending it, which loses digits
        stringDecimal: TYPES.NVarChar,
        customDecimal: TYPES.NVarChar,
        customUuid: TYPES.UniqueIdentifier,
        customLocalDate: TYPES.Date,
        customLocalTime: TYPES.Time,
        customLocalDateTime: TYPES.DateTime2
    } satisfies {[type in NativeValueType]: ISqlTypeFactory | undefined}

    // The type the parameter is bound with: the one declared in typesByName for its type name, or the one getType gives
    private getInputType(params: any[], index: number): ISqlType {
        const typesByName = this.config?.typesByName
        const type = existingParamContextOf(params, index)?.type
        const declared = typesByName && type !== undefined && Object.hasOwn(typesByName, type) ? typesByName[type] : undefined
        if (declared) {
            if (typeof declared === 'function') {
                // A type factory, like TYPES.NVarChar
                return { type: declared }
            }
            // A type with its arguments, like TYPES.Decimal(18, 4)
            return declared as ISqlType
        }
        return { type: this.getType(params, index) }
    }

    protected getType(params: any[], index: number): ISqlTypeFactory {
        // The category of the type decides the type of the parameter, then its name; a parameter added without them,
        // like one of a query written by hand, gets a type inferred from its value
        const typeCategory = existingParamContextOf(params, index)?.typeCategory
        const type = existingParamContextOf(params, index)?.type
        if (typeCategory || type) {
            const byCategory = typeCategory && Object.hasOwn(this.predefinedTypes, typeCategory) ? this.predefinedTypes[typeCategory] : undefined
            if (byCategory) {
                return byCategory
            }
            const byName = type && Object.hasOwn(this.predefinedTypes, type) ? this.predefinedTypes[type] : undefined
            if (byName) {
                return byName
            }
            // Any other type is a custom one (an enum, a custom or a customComparable): what it holds is only known by
            // the user. A text goes as text, whatever it looks like: '1.2' on a text column can't be sent as a number.
            return this.inferCustomType(params[index])
        }
        return this.inferType(params[index])
    }

    protected inferCustomType(value: any): ISqlTypeFactory {
        if (typeof value === 'string' || (value instanceof Array && typeof value[0] === 'string')) {
            return TYPES.NVarChar
        }
        return this.inferType(value)
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
                case 'localDateTime':
                    return TYPES.DateTime2
                case 'localDate':
                    return TYPES.Date
                case 'localTime':
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
