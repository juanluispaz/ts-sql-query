import type { QueryRunner, DatabaseType } from "./QueryRunner"
import type { Connection } from 'oracledb'
import { OUT_FORMAT_OBJECT, OUT_FORMAT_ARRAY, BIND_OUT } from 'oracledb'

export class OracleDBQueryRunner implements QueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection

    constructor(connection: Connection) {
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

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        return this.connection.execute(query, params, { outFormat: OUT_FORMAT_OBJECT }).then((result) => {
            if (!result.rows) {
                return undefined
            } else if (result.rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            return result.rows[0]
        })
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.connection.execute(query, params, {outFormat: OUT_FORMAT_OBJECT}).then((result) => result.rows || [])
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return this.connection.execute(query, params, { outFormat: OUT_FORMAT_ARRAY }).then((result) => {
            if (!result.rows) {
                return undefined
            } else if (result.rows.length > 1) {
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
        return this.connection.execute(query, params, { outFormat: OUT_FORMAT_ARRAY }).then((result) => (result.rows || []).map((row) => {
            if ((row as Array<any>).length > 1) {
                throw new Error('Too many columns, expected only one column')
            }
            return (row as Array<any>)[0]
        }))
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        return this.connection.execute(query, params).then((result) => result.rowsAffected || 0)
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
        return this.connection.execute(query, params).then((result) => result.rowsAffected || 0)
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return this.connection.execute(query, params).then((result) => result.rowsAffected || 0)
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        return this.connection.execute(query, params).then(() => undefined)
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        return this.connection.execute(query, params, { outFormat: OUT_FORMAT_ARRAY }).then((result) => {
            if (!result.rows) {
                throw new Error('No row found')
            } else if (result.rows.length !== 1) {
                throw new Error('Invalid number of rows, expected only one row')
            }
            const row = result.rows[0] as Array<any>
            if (row) {
                if (row.length !== 1) {
                    throw new Error('Invalid number of columns, expected only one column')
                }
                return row[0]
            } else {
                throw new Error('No row found')
            }
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
        if (name) {
            params.push({dir: BIND_OUT, as: name})
        } else {
            params.push({dir: BIND_OUT})
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