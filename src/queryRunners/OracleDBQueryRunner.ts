import { QueryRunner, DatabaseType } from "./QueryRunner"
import { Connection, OBJECT, ARRAY } from 'oracledb'

export class OracleDBQueryRunner implements QueryRunner {
    readonly oracle: true = true
    readonly database: DatabaseType
    readonly connection: Connection

    constructor(connection: Connection) {
        this.connection = connection
        this.database = 'oracle'
    }

    getNativeConnection(): Connection {
        return this.connection
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        return this.connection.execute(query, params, { outFormat: OBJECT }).then((result) => {
            if (result.rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            result.rows[0]
        })
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.connection.execute(query, params, {outFormat: OBJECT}).then((result) => result.rows)
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return this.connection.execute(query, params, { outFormat: ARRAY }).then((result) => {
            if (result.rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = result.rows[0] as Array<any>
            if (row) {
                if (row.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[0]
            } else {
                return undefined
            }
        })
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.connection.execute(query, params, { outFormat: ARRAY }).then((result) => result.rows.map((row) => {
            if ((row as Array<any>).length > 1) {
                throw new Error('Too many columns, expected only one column')
            }
            return (row as Array<any>)[0]
        }))
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        return this.connection.execute(query, params).then((result) => result.rowsAffected)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.connection.execute(query, params).then((result) => {
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
        return this.connection.execute(query, params).then((result) => {
            const outBinds = result.outBinds
            if (!outBinds) {
                throw new Error('Unable to find the last inserted id, no outBinds')
            } else if (Array.isArray(outBinds)) {
                const result = []
                for (var i = outBinds.length - 1; i >= 0; i--) {
                    result.push(getOnlyOneValue(outBinds[i]))
                }
                return result
            } else {
                throw new Error('Invalid outBinds returned by the database')
            }
        })
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        return this.connection.execute(query, params).then((result) => result.rowsAffected)
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return this.connection.execute(query, params).then((result) => result.rowsAffected)
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        return this.connection.execute(query, params).then(() => undefined)
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        return this.connection.execute(query, params).then((result) => {
            const outBinds = result.outBinds
            if (!outBinds) {
                throw new Error('Unable to find the function output')
            } else if (Array.isArray(outBinds)) {
                if (outBinds.length === 1) {
                    return outBinds[0]
                }
            } else {
                throw new Error('Invalid outBinds returned by the database')
            }
            throw new Error('Unable to find the function output')
        })
    }
    executeBeginTransaction(): Promise<void> {
        // Oracle automatically begins the transaction
        return Promise.resolve()
    }
    executeCommit(): Promise<void> {
        return this.connection.commit()
    }
    executeRollback(): Promise<void> {
        return this.connection.rollback()
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        return this.connection.execute(query, params).then(() => undefined)
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return ':' + index
    }
    addOutParam(params: any[], name: string): string {
        const index = params.length
        params.push({dir: 3003 /*oracledb.BIND_OUT*/, as: name}) // See https://github.com/oracle/node-oracledb/blob/master/lib/oracledb.js
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