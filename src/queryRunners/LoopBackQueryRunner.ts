import { DatabaseType, QueryRunner } from "./QueryRunner"
import { DataSource, Transaction } from 'loopback-datasource-juggler'

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

export abstract class LoopBackAbstractQueryRunner implements LoopbackQueryRunner {
    // @ts-ignore
    readonly database: DatabaseType
    readonly datasource: DataSource
    readonly connectorName: string
    transaction?: Transaction

    constructor(database: DatabaseType, datasource: DataSource, transaction?: Transaction) {
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
    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        return this.query(query, params).then((rows) => {
            if (rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            return rows[0]
        })
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.query(query, params)
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return this.query(query, params).then((rows) => {
            if (rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = rows[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]]
            }
            return undefined
        })
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.query(query, params).then((rows) => rows.map((row: any) => {
            const columns = Object.getOwnPropertyNames(row)
            if (columns.length > 1) {
                throw new Error('Too many columns, expected only one column')
            }
            return row[columns[0]]
        }))
    }
    abstract executeInsert(query: string, params?: any[]): Promise<number>
    abstract executeInsertReturningLastInsertedId(query: string, params?: any[]): Promise<any>
    abstract executeInsertReturningMultipleLastInsertedId(query: string, params?: any[]): Promise<any>
    abstract executeUpdate(query: string, params?: any[]): Promise<number>
    abstract executeDelete(query: string, params?: any[]): Promise<number>
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        return this.query(query, params).then(() => undefined)
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        return this.query(query, params).then((rows) => {
            if (rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = rows[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]]
            }
            return undefined
        })
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
            this.transaction = undefined
        })
    }
    executeRollback(): Promise<void> {
        if (!this.transaction) {
            return Promise.reject(new Error('Not in an transaction, you cannot rollback the transaction'))
        }
        return (this.transaction.rollback() as Promise<any>).then(() => {
            this.transaction = undefined
        })
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        return this.query(query, params).then(() => undefined)
    }
    abstract addParam(params: any[], value: any): string
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
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
    executeInsert(query: string, params: any[] = []): Promise<number> {
        return this.query(query, params).then((result) => {
            return result.affectedRows
        })
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.query(query, params).then((result) => {
            return result.insertId
        })
    }
    executeInsertReturningMultipleLastInsertedId(_query: string, _params: any[] = []): Promise<any> {
        throw new Error('Unsupported executeInsertReturningMultipleLastInsertedId for this database')
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        return this.query(query, params).then((result) => {
            return result.affectedRows
        })
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return this.query(query, params).then((result) => {
            return result.affectedRows
        })
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

    executeInsert(query: string, params: any[] = []): Promise<number> {
        return this.query(query, params).then((result) => {
            return result.rowsAffected
        })
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.query(query, params).then((result) => {
            const outBinds = result.outBinds
            if (!outBinds) {
                throw new Error('Unable to find the last inserted id, no outBinds')
            } else if (Array.isArray(outBinds)) {
                if (outBinds.length === 1) {
                    return getOnlyOneValue(outBinds[0])
                }
            } else {
                throw new Error('Invalid outBinds returned by the database')
            }
            throw new Error('Unable to find the last inserted id')
        })
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.query(query, params).then((result) => {
            const outBinds = result.outBinds
            if (!outBinds) {
                throw new Error('Unable to find the last inserted id, no outBinds')
            } else if (Array.isArray(outBinds)) {
                const result = []
                for (let i = 0, length = outBinds.length; i < length; i++) {
                    result.push(getOnlyOneValue(outBinds[i]))
                }
                return result
            } else {
                throw new Error('Invalid outBinds returned by the database')
            }
        })
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        return this.query(query, params).then((result) => {
            return result.rowsAffected
        })
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return this.query(query, params).then((result) => {
            return result.rowsAffected
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

function getOnlyOneValue(values: any): any {
    if (Array.isArray(values)) {
        if (values.length != 1) {
            throw new Error('Unable to find the output value in the output')
        }
        return values[0]
    } else {
        return values
    }
}

export class LoopBackPostgreSqlQueryRunner extends LoopBackAbstractQueryRunner {

    constructor(datasource: DataSource, transaction?: Transaction) {
        super('postgreSql', datasource, transaction)
        if (this.connectorName !== 'postgresql') {
            throw new Error('Unsupported connector type: ' + this.connectorName + '. LoopBackMySqlQueryRunner only supports postgresql connectors')
        }
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
                    return +row[columns[0]]
                }
                throw new Error('Unable to find the the affected row count')
            })
        }
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
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
                return row[columns[0]]
            }
            throw new Error('Unable to find the last inserted id')
        })
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.query(query, params).then((result) => {
            return result.map((row: any) => {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]]
            })
        })
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        return this.query(query, params).then((result) => {
            return result.affectedRows
        })
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return this.query(query, params).then((result) => {
            return result.affectedRows
        })
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

    executeInsert(query: string, params: any[] = []): Promise<number> {
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
                return row[columns[0]]
            }
            throw new Error('Unable to find the affected row count')
        })
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
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
                return row[columns[0]]
            }
            throw new Error('Unable to find the last inserted id')
        })
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.query(query, params).then((result) => {
            return result.map((row: any) => {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]]
            })
        })
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
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
                return row[columns[0]]
            }
            throw new Error('Unable to find the affected row count')
        })
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
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
                return row[columns[0]]
            }
            throw new Error('Unable to find the affected row count')
        })
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
        if (!connector.__tssqlquery_transactiontypefixed) {
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
            connector.__tssqlquery_transactiontypefixed = true
        }
    }

    executeInsert(query: string, params: any[] = []): Promise<number> {
        return this.query(query, params).then((result) => {
            return result.count
        })
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.query(query, params).then((result) => {
            return result.lastID
        })
    }
    executeInsertReturningMultipleLastInsertedId(_query: string, _params: any[] = []): Promise<any> {
        throw new Error('Unsupported executeInsertReturningMultipleLastInsertedId for this database')
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        return this.query(query, params).then((result) => {
            return result.count
        })
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return this.query(query, params).then((result) => {
            return result.count
        })
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
}
