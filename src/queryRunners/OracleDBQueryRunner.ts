import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from "./QueryRunner"
import type { Connection } from 'oracledb'
import { OUT_FORMAT_OBJECT, BIND_OUT } from 'oracledb'
import { DelegatedSetTransactionQueryRunner } from "./DelegatedSetTransactionQueryRunner"

export class OracleDBQueryRunner extends DelegatedSetTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection

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
    doBeginTransaction(_opts: BeginTransactionOpts): Promise<void> {
        // Oracle automatically begins the transaction, but the level must set in a query
        return  Promise.resolve()
    }
    doCommit(_opts: CommitOpts): Promise<void> {
        return this.connection.commit()
    }
    doRollback(_opts: RollbackOpts): Promise<void> {
        return this.connection.rollback()
    }
    validateIntransaction(): boolean {
        // Do not validate if in transaction due automatic in transaction oracle's hehaviour
        return false
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