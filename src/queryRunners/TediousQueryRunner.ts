import type { DatabaseType } from "./QueryRunner"
import type { Connection, TediousType } from 'tedious'
import { Request, TYPES } from 'tedious'
import { PromiseBasedQueryRunner } from "./PromiseBasedQueryRunner"

export class TediousQueryRunner extends PromiseBasedQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection
    private transactionLevel = 0

    constructor(connection: Connection) {
        super()
        this.connection = connection
        this.database = 'sqlServer'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlServer') {
            throw new Error('Unsupported database: ' + database + '. TediousQueryRunner only supports sqlServer databases')
        }
    }

    getNativeRunner(): Connection {
        return this.connection
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return new Promise((resolve, reject) => {
            let result: any[] = []
            const req = new Request(query, (error) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(result)
                }
            })
            for (var i = 0, length = params.length; i < length; i++) {
                req.addParameter('' + i, this.getType(params, i), params[i])
            }
            req.on('row', function (columns) {
                const obj: any = {}
                for (var i = 0, length = columns.length; i < length; i++) {
                    const column = columns[i]!
                    obj[column.metadata.colName] = column.value
                }
                result.push(obj)
            })
            this.connection.execSql(req)
        })
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return new Promise((resolve, reject) => {
            const req = new Request(query, (error, rowCount) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(rowCount)
                }
            })
            for (var i = 0, length = params.length; i < length; i++) {
                req.addParameter('' + i, this.getType(params, i), params[i])
            }
            this.connection.execSql(req)
        })
    }
    executeBeginTransaction(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.beginTransaction((error) => {
                if (error) {
                    reject(error)
                } else {
                    this.transactionLevel++
                    resolve()
                }
            })
        })
    }
    executeCommit(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.commitTransaction((error) => {
                if (error) {
                    // Transaction count only modified when commit successful, in case of error there is still an open transaction 
                    reject(error)
                } else {
                    this.transactionLevel--
                    if (this.transactionLevel < 0) {
                        this.transactionLevel = 0
                    }
                    resolve()
                }
            })
        })
    }
    executeRollback(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.rollbackTransaction((error) => {
                this.transactionLevel--
                if (this.transactionLevel < 0) {
                    this.transactionLevel = 0
                }
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
    }
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return '@' + index
    }

    protected predefinedTypes: {[type: string]: TediousType | undefined} = {
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

    protected getType(params: any[], index: number): TediousType {
        const definedType: string | undefined = (params as any)['@' + index]
        if (definedType) {
            const type = this.predefinedTypes[definedType]
            if (type) {
                return type
            }
        }
        return this.inferType(params[index])
    }

    protected inferType(value: any): TediousType {
        // Inspired by: https://github.com/Hypermediaisobar-admin/node-any-db-mssql/blob/master/index.js
        if (value === null || value === undefined) {
            return TYPES.Null
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
            return (value.length > 0 ? this.inferType(value[0]) : TYPES.Null)
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
