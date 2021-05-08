import { DatabaseType, QueryRunner } from "./QueryRunner"

interface RawPrismaClient {
    $executeRaw<_T = any>(query: string, ...values: any[]): Promise<number>
    $queryRaw<T = any>(query: string, ...values: any[]): Promise<T>;
    $transaction(arg: any[]): Promise<any[]>
}

export class PrismaQueryRunner implements QueryRunner {
    readonly database: DatabaseType;
    readonly connection: RawPrismaClient

    constructor(connection: RawPrismaClient) {
        this.connection = connection
        switch ((connection as any)._activeProvider) {
            case 'postgresql':
                this.database = 'postgreSql';
                break
            case 'mysql':
                this.database = 'mySql'
                break
            case 'sqlite':
                this.database = 'sqlite'
                break
            case 'sqlserver':
                this.database = 'sqlServer'
                break
            default:
                throw new Error('Unknown Prisma provider of name ' + (connection as any)._activeProvider)
        }
    }
    useDatabase(database: DatabaseType): void {
        if (database !== this.database) {
            if (this.database === 'mySql' && database === 'mariaDB') {
                // @ts-ignore
                this.database = database
            } else if (this.database === 'mariaDB' && database === 'mySql') {
                // @ts-ignore
                this.database = database
            } else if (this.database === 'mySql' || this.database === 'mariaDB') {
                throw new Error('Unsupported database: ' + database + '. The current connection used in PrismaQueryRunner only supports mySql or mariaDB databases')
            } else {
                throw new Error('Unsupported database: ' + database + '. The current connection used in PrismaQueryRunner only supports ' + this.database + ' databases')
            }
        }
    }
    getNativeRunner(): unknown {
        return this.connection
    }
    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }
    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        return this.queryRaw(query, params).then((rows) => {
            if (rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            return rows[0]
        })
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.queryRaw(query, params)
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return this.queryRaw(query, params).then((rows) => {
            if (rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = rows[0]
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
        return this.queryRaw(query, params).then((rows) => rows.map((row) => {
            const columns = Object.getOwnPropertyNames(row)
            if (columns.length > 1) {
                throw new Error('Too many columns, expected only one column')
            }
            return row[columns[0]!] // Value in the row of the first column without care about the name
        }))
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        return this.executeRaw(query, params)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.database === 'mySql' || this.database === 'mariaDB') {
            return this.combineOperation(
                this.executeRaw(query, params),
                this.queryRaw('select last_insert_id()', [])
            ).then(([_count, rows]) => {
                return this.findLastInsertedId(rows)
            })
        }
        if (this.database === 'sqlite') {
            return this.combineOperation(
                this.executeRaw(query, params),
                this.queryRaw('select last_insert_rowid()', [])
            ).then(([_count, rows]) => {
                return this.findLastInsertedId(rows)
            })
        }
        return this.queryRaw(query, params).then((rows) => {
            return this.findLastInsertedId(rows)
        })
    }
    private findLastInsertedId(rows: any[]): any {
        if (rows.length > 1) {
            throw new Error('Too many rows, expected only zero or one row')
        }
        const row = rows[0]
        if (row) {
            const columns = Object.getOwnPropertyNames(row)
            if (columns.length > 1) {
                throw new Error('Too many columns, expected only one column')
            }
            return row[columns[0]!] // Value in the row of the first column without care about the name
        }
        throw new Error('Unable to find the last inserted id')
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.queryRaw(query, params).then((rows) => rows.map((row) => {
            const columns = Object.getOwnPropertyNames(row)
            if (columns.length > 1) {
                throw new Error('Too many columns, expected only one column')
            }
            return row[columns[0]!] // Value in the row of the first column without care about the name
        }))
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        return this.executeRaw(query, params)
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return this.executeRaw(query, params)
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        return this.executeRaw(query, params).then(() => undefined)
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        return this.queryRaw(query, params).then((rows) => {
            if (rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = rows[0]
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
        return Promise.reject(new Error('Long running transactions are not supported by Prisma. See https://github.com/prisma/prisma/issues/1844'))
    }
    executeCommit(): Promise<void> {
        return Promise.reject(new Error('Long running transactions are not supported by Prisma. See https://github.com/prisma/prisma/issues/1844'))
    }
    executeRollback(): Promise<void> {
        return Promise.reject(new Error('Long running transactions are not supported by Prisma. See https://github.com/prisma/prisma/issues/1844'))
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        return this.executeRaw(query, params).then(() => undefined)
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        let result
        switch (this.database) {
            case 'mariaDB':
                result = '?'
                break
            case 'mySql':
                result = '?'
                break
            case 'noopDB':
                result = '$' + index
                break
            case 'oracle':
                result = ':' + index
                break
            case 'postgreSql':
                result = '$' + (index + 1)
                break
            case 'sqlite':
                result = '?'
                break
            case 'sqlServer':
                result = '@P' + (index  + 1)
                break
            default:
                throw new Error('Unknown database ' + this.database)
        }
        params.push(value)
        return result
    }
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result)
    }
    combineOperation<R1, R2>(p1: Promise<R1>, p2: Promise<R2>): Promise<[R1, R2]> {
        return this.connection.$transaction([
            p1,
            p2
        ]) as any
    }
    protected executeRaw(query: string, params: any[]): Promise<number> {
        return this.connection.$executeRaw(query, ...params)
    }
    protected queryRaw(query: string, params: any[]): Promise<any[]> {
        return this.connection.$queryRaw<any[]>(query, ...params)
    }
}
