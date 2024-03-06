import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from "./QueryRunner"
import type { Connection } from 'oracledb'
import { OUT_FORMAT_OBJECT, BIND_OUT } from 'oracledb'
import { PromiseBasedQueryRunner } from "./PromiseBasedQueryRunner"

export class OracleDBQueryRunner extends PromiseBasedQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection
    private transactionLevel = 0

    constructor(connection: Connection) {
        super()
        this.connection = connection
        this.database = 'oracle'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'oracle') {
            throw new Error('Unsupported database: ' + database + '. OracleDBQueryRunner only supports oracle databases')
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
        return this.connection.execute(query, params, {outFormat: OUT_FORMAT_OBJECT}).then((result) => result.rows || [])
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.connection.execute(query, params).then((result) => result.rowsAffected || 0)
    }
    protected executeMutationReturning(query: string, params: any[] = []): Promise<any[]> {
        return this.connection.execute(query, params).then((result) => {
            return this.processOutBinds(params, result.outBinds)
        })
    }
    executeBeginTransaction(opts: BeginTransactionOpts): Promise<void> {
        const transactionLevel = this.transactionLevel
        if (!this.nestedTransactionsSupported() && transactionLevel >= 1) {
            return this.createRejectedPromise(new Error(this.database + " doesn't support nested transactions (using " + this.constructor.name + ")"))
        }

        // Oracle automatically begins the transaction, but the level must set in a query
        let sql
        try {
            sql = this.createSetTransactionQuery(opts)
        } catch (error) {
            return this.createRejectedPromise(error)
        }
        let result
        if (sql) {
            result = this.executeMutation(sql, [])
        } else {
            result = Promise.resolve()
        }
        return result.then(() => {
            this.transactionLevel++
            if (this.transactionLevel !== transactionLevel + 1) {
                throw new Error('Forbidden concurrent usage of the query runner was detected when it tried to start a transaction.')
            }
            return undefined
        })
    }
    executeCommit(_opts: CommitOpts): Promise<void> {
        // Do not validate if in transaction due automatic in transaction oracle's hehaviour
        return this.connection.commit().then(() => {
            // Transaction count only modified when commit successful, in case of error there is still an open transaction 
            this.transactionLevel--
            if (this.transactionLevel < 0) {
                this.transactionLevel = 0
            }
            return undefined
        })
    }
    executeRollback(_opts: RollbackOpts): Promise<void> {
        // Do not validate if in transaction due automatic in transaction oracle's hehaviour
        this.transactionLevel--
        return this.connection.rollback().then(() => {
            this.transactionLevel--
            if (this.transactionLevel < 0) {
                this.transactionLevel = 0
            }
            return undefined
        }, (error) => {
            this.transactionLevel--
            if (this.transactionLevel < 0) {
                this.transactionLevel = 0
            }
            throw error
        })
    }
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return ':' + index
    }
    addOutParam(params: any[], name: string): string {
        const index = params.length
        if (name) {
            params.push({dir: BIND_OUT, as: name})
        } else {
            params.push({dir: BIND_OUT})
        }
        return ':' + index
    }
    getTransactionLevel(opts: BeginTransactionOpts): string | undefined {
        const level = opts?.[0]
        if (!level || level === 'read uncommitted' || level === 'read committed' || level === 'repeatable read' || level === 'serializable') {
            return level
        }
        throw new Error(this.database + " doesn't support the transactions level: " + level)
    }
    getTransactionAccessMode(opts: BeginTransactionOpts): string | undefined {
        const acessMode = opts?.[1]
        if (!acessMode || acessMode === 'read write' || acessMode === 'read only') {
            return acessMode
        }
        throw new Error(this.database + " doesn't support the transactions access mode: " + acessMode)
    }
    createSetTransactionQuery(opts: BeginTransactionOpts): string | undefined {
        let sql
        let level = this.getTransactionLevel(opts)
        if (level) {
            sql = 'set transaction isolation level ' + level
        }
        const accessMode = this.getTransactionAccessMode(opts)
        if (accessMode) {
            throw new Error(this.database + " doesn't support the transactions level " + level + " and access mode " + accessMode + " at the same time")
        }
        if (accessMode) {
            sql = 'set transaction ' + accessMode
        }
        return sql
    }
    processOutBinds(params: any[], outBinds: any): any[] {
        if (!outBinds) {
            return []
        }
        if (!Array.isArray(outBinds)) {
            throw new Error('Invalid outBinds returned by the database')
        } 

        if (outBinds.length <= 0) {
            return []
        }

        const out = []
        for (let i = 0, length = params.length; i < length; i++) {
            const param = params[i]
            if (param && typeof param === 'object' && param.dir === BIND_OUT ) {
                out.push(param)
            }
        }

        const rows: any[][] = []
        let current: any[] = []
        rows.push(current)
        for (let i = 0, length = outBinds.length; i < length; i++) {
            const param: any = out[i]
            const name: string = param.as || ''
            const value = outBinds[i]

            if (current.length > 0 && name in current[0]) {
                current = []
                rows.push(current)
            }

            if (!Array.isArray(value)) {
                if (current.length <= 0) {
                    current.push({})
                }
                current[0][name] = value
                continue
            }

            for (let j = current.length, length2 = value.length; j < length2; j++) {
                current[j] = {}
            }

            for (let j = 0, length2 = value.length; j < length2; j++) {
                current[j][name] = value[j]
            }
        }

        const result: any[] = []
        rows.forEach(value => {
            result.push(...value)
        })
        return result
    }
}