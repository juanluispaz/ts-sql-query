import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { ConnectionPool, ISqlType, ISqlTypeFactory, Request, Transaction } from 'mssql'
import mssql from 'mssql'
import { ManagedTransactionQueryRunner } from './ManagedTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from "../TsSqlError.js"
import { getMssqlErrorReason, isMssqlError } from './connectorErrorMappers/MssqlErrorMapper.js'
import { isProcessInUtc } from '../utils/processTimeZone.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'
import { isPlainTemporalValue, plainTemporalResultColumns } from '../utils/plainTemporalValues.js'
import { isInstantValue } from '../utils/instantValues.js'
import { sqlServerTemporalDate, sqlServerTemporalText } from '../utils/sqlServer/sqlServerParamTypes.js'
import { __temporalIfAvailable } from '../typeSystem/temporal.js'
import { __sqlDataTypeDescribes, __typeSqlDataTypeOf } from '../typeSystem/dataTypes.js'
import { existingParamContextOf, existingQueryContextOf } from '../internal/QueryContextImpl.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { DataTypeName } from '../typeSystem/dataTypeNames.js'
import type { QueryParamContext } from '../QueryContext.js'

const { TYPES, ISOLATION_LEVEL } = mssql

const isolationLevelWords: { [level: number]: string } = {
    [ISOLATION_LEVEL.READ_UNCOMMITTED]: 'read uncommitted',
    [ISOLATION_LEVEL.READ_COMMITTED]: 'read committed',
    [ISOLATION_LEVEL.REPEATABLE_READ]: 'repeatable read',
    [ISOLATION_LEVEL.SERIALIZABLE]: 'serializable',
    [ISOLATION_LEVEL.SNAPSHOT]: 'snapshot',
}

/** The options of MssqlPoolQueryRunner */
export interface MssqlPoolQueryRunnerConfig {
    /**
     * The type of mssql a parameter is bound with, for a type the library doesn't bind as you need, like `TYPES.Xml` or
     * `TYPES.Money`: a type factory, or a type with its arguments; undefined to bind it as the library does. It receives
     * what the library knows of the parameter (its type, its SQL data type, ...) and the value.
     */
    driverTypeOf?: ((param: QueryParamContext, value: unknown) => ISqlTypeFactory | ISqlType | undefined) | undefined
}

/**
 * The query runner of SQL Server through `mssql`, over a `ConnectionPool`, or over a `Transaction` begun with it that
 * something else commits or rolls back. Outside a transaction the queries run on the pool; a transaction runs on a
 * `Transaction` of mssql, which keeps a connection of the pool until it ends.
 */
export class MssqlPoolQueryRunner extends ManagedTransactionQueryRunner {
    readonly database: DatabaseType
    /** The `ConnectionPool` of mssql the query runner was created with, or the `Transaction` it was created with */
    readonly pool: ConnectionPool
    /** The `Transaction` of mssql of the current transaction, until it ends */
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
            const type = this.getInputType(params, i)
            req.input('' + i, type, driverValueOf(type, params[i]))
        }
        return req.query(query).then((result) => {
            if (!result.recordset) {
                return []
            }
            const plainTemporalColumns = plainTemporalResultColumns(params)
            if (plainTemporalColumns) {
                // A Temporal value without zone is read as its text, with the digits below the millisecond that
                // tedious keeps apart
                for (const row of result.recordset) {
                    for (const name of plainTemporalColumns) {
                        row[name] = sqlServerTemporalText(row[name])
                    }
                }
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
            const type = this.getInputType(params, i)
            req.input('' + i, type, driverValueOf(type, params[i]))
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
    protected doBeginTransaction(opts: BeginTransactionOpts): Promise<void> {
        if (typeof this.pool.transaction !== 'function') {
            return this.rejectBeginInsideAManagedTransaction()
        }
        const accessMode = opts[1]
        if (accessMode) {
            throw new TsSqlProcessingError({ reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode }, this.database + " doesn't support the transactions access mode: " + accessMode)
        }
        const level = this.getTransactionLevel(opts)

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
            throw new TsSqlProcessingError({ reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: level }, this.database + " doesn't support the transactions level: " + level)
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
    protected doCommit(_opts: CommitOpts): Promise<void> {
        const transaction = this.transaction!
        return this.restoreConnectionIsolationLevel(transaction).then(() => transaction.commit()).then(() => {
            this.transaction = undefined
        })
    }
    protected doRollback(_opts: RollbackOpts): Promise<void> {
        const transaction = this.transaction!
        return this.restoreConnectionIsolationLevel(transaction).then(() => transaction.rollback()).finally(() => {
            this.transaction = undefined
            this.transactionOutcome.transactionEnded()
        })
    }
    /** mssql already gave the connection back to the pool (flagged as broken when its isolation level had to be put back, see watchTransactionConnection) */
    protected override rollbackAlreadyDoneByTheDatabase(): void {
        this.transaction = undefined
        this.restoreIsolationLevel = false
        this.transactionConnection = undefined
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
    override isTransactionActive(): boolean {
        return !!this.transaction
    }
    addParam(params: any[], value: any, type: DataTypeName | DataTypeClass | undefined): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.MssqlPoolQueryRunner(params, value, type)
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

    /** A request of mssql for a statement: on the transaction when there is one, on the pool otherwise */
    protected request(): Request {
        const request = this.transaction ? this.transaction.request() : this.pool.request()
        // The rows as objects whatever the pool was configured with (arrayRowMode): the library reads each column by
        // its name
        request.arrayRowMode = false
        return request
    }

    // The type the parameter is bound with: the one driverTypeOf gives, or the one of its SQL data type or of getType
    private getInputType(params: any[], index: number): ISqlType {
        const driverTypeOf = this.config?.driverTypeOf
        const param = existingParamContextOf(params, index)
        const declared = driverTypeOf && param ? driverTypeOf(param, params[index]) : undefined
        if (declared) {
            if (typeof declared === 'function') {
                // A type factory, like TYPES.NVarChar
                return { type: declared }
            }
            // A type with its arguments, like TYPES.Decimal(18, 4)
            return declared as ISqlType
        }
        return this.getTypeOfSqlDataType(params, index) ?? { type: this.getType(params, index) }
    }

    /**
     * The type of the parameter from the SQL data type requested for it, when it describes the value
     * (`__sqlDataTypeDescribes`), where it gives a better query than the type of its data type; undefined otherwise:
     * - A text of a column that isn't national (a varchar or a char) goes as a varchar: compared as a nvarchar, SQL
     *   Server converts the column, and with a SQL collation it reads its whole index. Only for an ASCII text, the same in
     *   every code page: tedious writes a varchar in the code page of the database, and a character it lacks becomes
     *   `?`, also for a column of a UTF-8 collation (measured on SQL Server 2025: '中文' stored as '??'). Its length is
     *   the one of the column, or max when the text is longer.
     * - A date and time of a `datetime` or a `smalldatetime` column goes as one: compared with a datetime2, SQL Server
     *   converts the column with its exact fraction of 1/300 of a second, and an equality doesn't find a value with
     *   milliseconds (measured on SQL Server 2025: `.003` and `.123` not found as a datetime2, found as a datetime).
     */
    private getTypeOfSqlDataType(params: any[], index: number): ISqlType | undefined {
        const param = existingParamContextOf(params, index)
        const sqlDataType = param?.requestedSqlDataType
        if (sqlDataType === undefined || !__sqlDataTypeDescribes(sqlDataType, param!.requestedType)) {
            return undefined
        }
        const value: unknown = params[index]
        if (sqlDataType.family === 'character string') {
            if (sqlDataType.national !== false || typeof value !== 'string' || !/^[\x00-\x7f]*$/.test(value)) {
                return undefined
            }
            const length = sqlDataType.length
            return TYPES.VarChar(length !== undefined && !sqlDataType.largeObject && value.length <= length ? length : mssql.MAX)
        }
        if (sqlDataType.family === 'datetime' && sqlDataType.fields === 'timestamp' && (value instanceof Date || value === null || isPlainTemporalValue(value) || isInstantValue(value))) {
            const native = existingQueryContextOf(params)?.connectionConfiguration?.nativeSqlDataTypeOf(sqlDataType)
            if (native === 'datetime') {
                return { type: TYPES.DateTime }
            }
            if (native === 'smalldatetime') {
                return { type: TYPES.SmallDateTime }
            }
        }
        return undefined
    }

    /**
     * The type of mssql the parameter at the index is bound with, from the type requested for it and its SQL data type
     */
    protected getType(params: any[], index: number): ISqlTypeFactory {
        // The requested type of the parameter decides the type it is bound with, by the SQL data type of the type; a
        // parameter added without one, like one of a query written by hand, gets a type inferred from its value
        const param = existingParamContextOf(params, index)
        const requestedType = param?.requestedType
        if (!requestedType?.type) {
            return this.inferType(params[index])
        }
        const sqlDataType = __typeSqlDataTypeOf(requestedType)
        switch (sqlDataType?.family) {
            case 'boolean':
                return TYPES.Bit
            case 'exact numeric':
                if (sqlDataType.scale === 0 && sqlDataType.bytes !== undefined) {
                    return sqlDataType.bytes <= 4 ? TYPES.Int : TYPES.BigInt
                }
                // TYPES.Decimal converts the value to a JavaScript number before sending it, which loses digits
                return TYPES.NVarChar
            case 'approximate numeric':
                return TYPES.Float
            case 'character string':
                return TYPES.NVarChar
            case 'uuid':
                return TYPES.UniqueIdentifier
            case 'datetime':
                if (sqlDataType.fields === 'date') {
                    return TYPES.Date
                }
                if (sqlDataType.fields === 'time') {
                    return TYPES.Time
                }
                if (sqlDataType.fields === 'timestamp') {
                    return TYPES.DateTime2
                }
                break
            default:
        }
        // Any other type is one without a SQL data type (an enum, an EqualableType or a ComparableType of the user): what it holds is
        // only known by the user. A text goes as text, whatever it looks like: '1.2' on a text column can't be sent as
        // a number.
        return this.inferCustomType(params[index])
    }

    /**
     * The type of mssql of a value of a type of the user whose meaning only the user knows: a text as an NVarChar,
     * otherwise inferred from the value
     */
    protected inferCustomType(value: any): ISqlTypeFactory {
        if (typeof value === 'string' || (value instanceof Array && typeof value[0] === 'string')) {
            return TYPES.NVarChar
        }
        return this.inferType(value)
    }

    /**
     * The type of mssql for a value without a requested type, like a parameter of a query written by hand, inferred
     * from the value
     */
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
        } else if (isPlainTemporalValue(value)) {
            // A Temporal value without zone: a PlainDate, a PlainTime or a PlainDateTime
            const temporal = __temporalIfAvailable()!
            return value instanceof temporal.PlainDate ? TYPES.Date : value instanceof temporal.PlainTime ? TYPES.Time : TYPES.DateTime2
        } else if (isInstantValue(value)) {
            // An instant, as the wall clock of its instant in UTC (see sqlServerTemporalDate)
            return TYPES.DateTime2
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

/**
 * The value the driver receives for a parameter bound with that type: a number or a bigint bound as a text (an exact
 * number that isn't an integer of a fixed size, see getType) goes as its text, which the driver requires and which
 * keeps every digit. Made when the query is executed: the params of the query keep the value the connection handed
 */
function driverValueOf(type: ISqlType, value: unknown): unknown {
    if ((typeof value === 'bigint' || typeof value === 'number') && type.type === TYPES.NVarChar) {
        return String(value)
    }
    // A Temporal value without zone goes as the Date tedious binds with all its digits
    return sqlServerTemporalDate(value) ?? value
}
