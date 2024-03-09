import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from "./QueryRunner"
import type { ConnectionPool, ISqlTypeFactory, Transaction, Request } from 'mssql'
import { TYPES, ISOLATION_LEVEL } from 'mssql'
import { PromiseBasedQueryRunner } from "./PromiseBasedQueryRunner"
import type { NativeValueType } from "../expressions/values"

export class MssqlPoolQueryRunner extends PromiseBasedQueryRunner {
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
            throw new Error('Unsupported database: ' + database + '. MssqlPoolQueryRunner only supports sqlServer databases')
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
            return Promise.reject(new Error(this.database + " doesn't support nested transactions (using " + this.constructor.name + ")"))
        }
        const level = opts[0]
        const accessMode = opts[1]
        if (accessMode) {
            return Promise.reject(new Error(this.database + " doesn't support the transactions access mode: " + accessMode))
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
            return Promise.reject(new Error(this.database + " doesn't support the transactions level: " + level))
        }
    }
    executeCommit(_opts: CommitOpts = []): Promise<void> {
        if (!this.transaction) {
            return Promise.reject(new Error('Not in an transaction, you cannot commit the transaction'))
        }
        return this.transaction.commit().then(() => {
            // Transaction count only modified when commit successful, in case of error there is still an open transaction 
            this.transaction = undefined
        })
    }
    executeRollback(_opts: RollbackOpts = []): Promise<void> {
        if (!this.transaction) {
            return Promise.reject(new Error('Not in an transaction, you cannot rollback the transaction'))
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
