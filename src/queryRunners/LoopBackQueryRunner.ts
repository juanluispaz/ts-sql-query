import type { DatabaseType, QueryRunner } from "./QueryRunner"
import type { DataSource, Transaction } from 'loopback-datasource-juggler'
import { PromiseBasedQueryRunner } from "./PromiseBasedQueryRunner"
import { processOutBinds } from "./OracleUtils"

export function createLoopBackQueryRunner(datasource: DataSource, transaction?: Transaction): LoopbackQueryRunner {
    const connector = datasource.connector
    if (!connector) {
        throw new Error('The provided datasource have no connector loaded')
    }
    switch (connector.name) {
        case 'mysql':
            return new LoopBackMySqlQueryRunner(datasource, transaction)
        case 'oracle':
            return new LoopBackOracleQueryRunner(datasource, transaction)
        case 'postgresql':
            return new LoopBackPostgreSqlQueryRunner(datasource, transaction)
        case 'mssql':
            return new LoopBackSqlServerQueryRunner(datasource, transaction)
        case 'sqlite3':
            return new LoopBackSqliteQueryRunner(datasource, transaction)
        default:
            throw new Error('Unsupported Loopback connector of name ' + connector.name)
    }
}

export interface LoopbackQueryRunner extends QueryRunner {
    readonly database: DatabaseType
    readonly datasource: DataSource
    readonly connectorName: string
    transaction?: Transaction
}

export abstract class LoopBackAbstractQueryRunner extends PromiseBasedQueryRunner implements LoopbackQueryRunner {
    // @ts-ignore
    readonly database: DatabaseType
    readonly datasource: DataSource
    readonly connectorName: string
    transaction?: Transaction

    constructor(database: DatabaseType, datasource: DataSource, transaction?: Transaction) {
        super()
        this.database = database
        this.datasource = datasource
        this.transaction = transaction
        const connector = datasource.connector
        if (!connector) {
            throw new Error('The provided datasource have no connector loaded')
        }
        this.connectorName = connector.name
    }

    useDatabase(database: DatabaseType): void {
        if (database !== this.database) {
            throw new Error('Unsupported database: ' + database + '. The current datasource used in LoopbackQueryRunner only supports ' + this.database + ' databases')
        }
    }
    getNativeRunner(): DataSource {
        return this.datasource
    }
    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.datasource, this.transaction)
    }

    executeBeginTransaction(): Promise<void> {
        return this.datasource.beginTransaction({}).then((transaction) => {
            this.transaction = transaction
        })
    }
    executeCommit(): Promise<void> {
        if (!this.transaction) {
            return Promise.reject(new Error('Not in an transaction, you cannot commit the transaction'))
        }
        return (this.transaction.commit() as Promise<any>).then(() => {
            // Transaction count only modified when commit successful, in case of error there is still an open transaction 
            this.transaction = undefined
        })
    }
    executeRollback(): Promise<void> {
        if (!this.transaction) {
            return Promise.reject(new Error('Not in an transaction, you cannot rollback the transaction'))
        }
        return (this.transaction.rollback() as Promise<any>).finally(() => {
            this.transaction = undefined
        })
    }
    isTransactionActive(): boolean {
        return !!this.transaction
    }
    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.query(query, params)
    }
    protected query(query: string, params?: any[]): Promise<any> {
        return this.datasource.execute(query, params, {transaction: this.transaction})
    }
}

export class LoopBackMySqlQueryRunner extends LoopBackAbstractQueryRunner {

    constructor(datasource: DataSource, transaction?: Transaction) {
        super('mySql', datasource, transaction)
        if (this.connectorName !== 'mysql') {
            throw new Error('Unsupported connector type: ' + this.connectorName + '. LoopBackMySqlQueryRunner only supports mysql connectors')
        }
    }

    useDatabase(database: DatabaseType): void {
        if (database !== this.database) {
            if (this.database === 'mySql' && database === 'mariaDB') {
                //@ts-ignore
                this.database = database
            } else if (this.database === 'mariaDB' && database === 'mySql') {
                //@ts-ignore
                this.database = database
            } else {
                throw new Error('Unsupported database: ' + database + '. The current datasource used in LoopbackQueryRunner only supports mySql or mariaDB databases')
            }
        }
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.query(query, params).then(result => result.affectedRows)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }
        return this.query(query, params).then(result => result.insertId)
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
}

export class LoopBackOracleQueryRunner extends LoopBackAbstractQueryRunner {

    constructor(datasource: DataSource, transaction?: Transaction) {
        super('oracle', datasource, transaction)
        if (this.connectorName !== 'oracle') {
            throw new Error('Unsupported connector type: ' + this.connectorName + '. LoopBackMySqlQueryRunner only supports oracle connectors')
        }
    }

    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.query(query, params).then(result => result.rowsAffected)
    }
    protected executeMutationReturning(query: string, params: any[] = []): Promise<any[]> {
        return this.query(query, params).then((result) => {
            return processOutBinds(params, result.outBinds)
        })
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return ':' + index
    }
    addOutParam(params: any[], name: string): string {
        const index = params.length
        if (name) {
            params.push({dir: 3003 /*oracledb.BIND_OUT*/, as: name}) // See https://github.com/oracle/node-oracledb/blob/master/lib/oracledb.js
        } else {
            params.push({dir: 3003 /*oracledb.BIND_OUT*/}) // See https://github.com/oracle/node-oracledb/blob/master/lib/oracledb.js
        }
        return ':' + index
    }
}

export class LoopBackPostgreSqlQueryRunner extends LoopBackAbstractQueryRunner {

    constructor(datasource: DataSource, transaction?: Transaction) {
        super('postgreSql', datasource, transaction)
        if (this.connectorName !== 'postgresql') {
            throw new Error('Unsupported connector type: ' + this.connectorName + '. LoopBackMySqlQueryRunner only supports postgresql connectors')
        }
    }

    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.query(query, params).then(result => result?.affectedRows || 0)
    }
    protected executeMutationReturning(query: string, params: any[]): Promise<any[]> {
        return this.query(query, params).then(result => {
            if (!result) {
                return result
            }
            if (Array.isArray(result)) {
                return result
            }
            return result.rows || []
        })
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        const rowsToInsert = this.guessInsertRowCount(query)
        if (!isNaN(rowsToInsert)) {
            return this.query(query, params).then(() => {
                return rowsToInsert
            })
        } else {
            query = 'with rows as (' + query + ' returning true) select count(*) from rows'
            return this.query(query, params).then((result) => {
                if (result.length > 1) {
                    throw new Error('Too many rows, expected only zero or one row')
                }
                const row = result[0]
                if (row) {
                    const columns = Object.getOwnPropertyNames(row)
                    if (columns.length > 1) {
                        throw new Error('Too many columns, expected only one column')
                    }
                    return +row[columns[0]!] // Value in the row of the first column without care about the name
                }
                throw new Error('Unable to find the the affected row count')
            })
        }
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }

    protected guessInsertRowCount(query: string): number {
        const insert = query.toLowerCase()
        if (/\)\s*values\s*\(/g.test(insert)) {
            const matches = /\)\s*,\s*\(/g.exec(insert)
            if (matches) {
                return matches.length + 1
            } else {
                return 1
            }
        } else if (/default\s*values/.test(insert)) {
            return 1
        }
        return NaN
    }
}

export class LoopBackSqlServerQueryRunner extends LoopBackAbstractQueryRunner {

    constructor(datasource: DataSource, transaction?: Transaction) {
        super('sqlServer', datasource, transaction)
        if (this.connectorName !== 'mssql') {
            throw new Error('Unsupported connector type: ' + this.connectorName + '. LoopBackMySqlQueryRunner only supports mssql connectors')
        }
    }

    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.query(query + '; select @@ROWCOUNT as count', params).then((result) => {
            if (result.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = result[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]!] // Value in the row of the first column without care about the name
            }
            throw new Error('Unable to find the affected row count')
        })
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        return this.query(query, params).then(() => undefined)
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        return this.query(query, params).then(() => undefined)
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '@param' + params.length
    }
}

class LoopBackSqliteQueryRunner extends LoopBackAbstractQueryRunner {

    constructor(datasource: DataSource, transaction?: Transaction) {
        super('sqlite', datasource, transaction)
        if (this.connectorName !== 'sqlite3') {
            throw new Error('Unsupported connector type: ' + this.connectorName + '. LoopBackMySqlQueryRunner only supports sqlite3 connectors')
        }
        // Fix invalid transaction type
        const connector: any =  datasource.connector!
        if (!connector.__tssqlquery_fixed) {
            const beginTransaction: Function = connector.beginTransaction
            connector.beginTransaction = function(isolationLevel: any, cb: any) {
                if (isolationLevel === 'READ COMMITTED' ||
                    isolationLevel === 'READ UNCOMMITTED' ||
                    isolationLevel === 'SERIALIZABLE' ||
                    isolationLevel === 'REPEATABLE READ'
                ) {
                    isolationLevel = ''
                }
                beginTransaction.call(this, isolationLevel, cb)
            }

            // Implements forceReturning option

            const executeSQL: Function = connector.executeSQL
            connector.executeSQL = function(sql: string, params: any, options: any, callback: any) {
                const connection = options?.transaction?.connection
                if (connection && !connection.__tssqlquery_fixed) {
                    const all: Function = connection.all
                    connection.all = function(this: any, sql: any, ...args: any) {
                        if (sql instanceof String) {
                            sql = sql.valueOf()
                        }
                        return all.apply(this, [sql, ...args])
                    }
                    connection.__tssqlquery_fixed = true
                }

                if (options?.forceReturning) {
                    const q = new String(sql)
                    q.trim = () => {
                        return 'select: ' + sql
                    }
                    executeSQL.call(this, q, params, options, callback)
                } else {
                    executeSQL.call(this, sql, params, options, callback)
                }
            }

            connector.connect((_err: any, connection: any) => {
                if (connection && !connection.__tssqlquery_fixed) {
                    const all: Function = connection.all
                    connection.all = function(this: any, sql: any, ...args: any) {
                        if (sql instanceof String) {
                            sql = sql.valueOf()
                        }
                        return all.apply(this, [sql, ...args])
                    }
                    connection.__tssqlquery_fixed = true
                }
            })

            connector.__tssqlquery_fixed = true
        }
    }

    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.queryNoSelect(query, params).then(result => result.count)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            super.executeInsertReturningLastInsertedId(query, params)
        }
        return this.queryNoSelect(query, params).then(result => result.lastID)
    }
    protected executeMutationReturning(query: string, params: any[]): Promise<any[]> {
        return this.datasource.execute(query, params, {transaction: this.transaction, forceReturning: true})
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    protected query(query: string, params?: any[]): Promise<any> {
        return this.datasource.execute(query, params, {transaction: this.transaction, forceReturning: query.startsWith('with ')})
    }
    protected queryNoSelect(query: string, params?: any[]): Promise<any> {
        return this.datasource.execute(query, params, {transaction: this.transaction})
    }
}
