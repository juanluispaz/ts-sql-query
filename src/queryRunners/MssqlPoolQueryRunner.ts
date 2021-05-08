import type { DatabaseType } from "./QueryRunner"
import type { ConnectionPool, ISqlTypeFactory, Transaction, Request } from 'mssql'
import { TYPES } from 'mssql'
import { UnwrapPromiseTuple } from "../utils/PromiseProvider"
import { AbstractQueryRunner } from "./AbstractQueryRunner"

export class MssqlPoolQueryRunner extends AbstractQueryRunner {
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

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.pool, this.transaction)
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        const req = this.request()
        for (var i = 0, length = params.length; i < length; i++) {
            req.input('' + i, { type: this.getType(params, i) }, params[i])
        }
        return req.query(query).then((result) => {
            if (!result.recordset) {
                return undefined
            }
            if (result.recordset.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            return result.recordset[0]
        })
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
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
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        const req = this.request()
        for (var i = 0, length = params.length; i < length; i++) {
            req.input('' + i, { type: this.getType(params, i) }, params[i])
        }
        return req.query(query).then((result) => {
            if (!result.recordset) {
                return undefined
            }
            if (result.recordset.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = result.recordset[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]!] // Value in the row of the first column without care about the name
            }
            return undefined
        })
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        const req = this.request()
        for (var i = 0, length = params.length; i < length; i++) {
            req.input('' + i, { type: this.getType(params, i) }, params[i])
        }
        return req.query(query).then((result) => {
            if (!result.recordset) {
                return []
            }
            return result.recordset.map((row: any) => {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]!] // Value in the row of the first column without care about the name
            })
        })
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        const req = this.request()
        for (var i = 0, length = params.length; i < length; i++) {
            req.input('' + i, { type: this.getType(params, i) }, params[i])
        }
        return req.query(query).then((result) => {
            return result.rowsAffected[0]!
        })
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        const req = this.request()
        for (var i = 0, length = params.length; i < length; i++) {
            req.input('' + i, { type: this.getType(params, i) }, params[i])
        }
        return req.query(query).then((result) => {
            if (!result.recordset) {
                throw new Error('Unable to find the last inserted id')
            }
            if (result.recordset.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = result.recordset[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]!] // Value in the row of the first column without care about the name
            }
            throw new Error('Unable to find the last inserted id')
        })
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        const req = this.request()
        for (var i = 0, length = params.length; i < length; i++) {
            req.input('' + i, { type: this.getType(params, i) }, params[i])
        }
        return req.query(query).then((result) => {
            if (!result.recordset) {
                throw new Error('Unable to find the last inserted id')
            }
            return result.recordset.map((row) => {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]!] // Value in the row of the first column without care about the name
            })
        })
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        const req = this.request()
        for (var i = 0, length = params.length; i < length; i++) {
            req.input('' + i, { type: this.getType(params, i) }, params[i])
        }
        return req.query(query).then((result) => {
            return result.rowsAffected[0]!
        })
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        const req = this.request()
        for (var i = 0, length = params.length; i < length; i++) {
            req.input('' + i, { type: this.getType(params, i) }, params[i])
        }
        return req.query(query).then((result) => {
            return result.rowsAffected[0]!
        })
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        const req = this.request()
        for (var i = 0, length = params.length; i < length; i++) {
            req.input('' + i, { type: this.getType(params, i) }, params[i])
        }
        return req.query(query).then(() => undefined)
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        const req = this.request()
        for (var i = 0, length = params.length; i < length; i++) {
            req.input('' + i, { type: this.getType(params, i) }, params[i])
        }
        return req.query(query).then((result) => {
            if (!result.recordset) {
                return undefined
            }
            if (result.recordset.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = result.recordset[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]!] // Value in the row of the first column without care about the name
            }
            return undefined
        })
    }
    executeBeginTransaction(): Promise<void> {
        if (this.transaction) {
            return Promise.reject(new Error('Already in an transaction, you can only use one transaction'))
        }
        this.transaction = this.pool.transaction()
        return this.transaction.begin().then(() => undefined)
    }
    executeCommit(): Promise<void> {
        if (!this.transaction) {
            return Promise.reject(new Error('Not in an transaction, you cannot commit the transaction'))
        }
        return this.transaction.commit().finally(() => {
            this.transaction = undefined
        })
    }
    executeRollback(): Promise<void> {
        if (!this.transaction) {
            return Promise.reject(new Error('Not in an transaction, you cannot rollback the transaction'))
        }
        return this.transaction.rollback().finally(() => {
            this.transaction = undefined
        })
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        const req = this.request()
        for (var i = 0, length = params.length; i < length; i++) {
            req.input('' + i, { type: this.getType(params, i) }, params[i])
        }
        return req.batch(query).then(() => undefined)
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return '@' + index
    }
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
    }
    createAllPromise<P extends Promise<any>[]>(promises: [...P]): Promise<UnwrapPromiseTuple<P>> {
        return Promise.all(promises) as any
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
        double: TYPES.Real,
        string: TYPES.NVarChar,
        localDate: TYPES.Date,
        localTime: TYPES.Time,
        localDateTime: TYPES.DateTime2
    }

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
                return TYPES.Real
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
                return TYPES.Real
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
            } else {
                return TYPES.NVarChar
            }
        }
        return TYPES.VarBinary
    }
}

