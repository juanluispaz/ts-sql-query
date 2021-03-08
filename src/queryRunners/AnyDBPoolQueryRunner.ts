import type { DatabaseType, QueryRunner } from "./QueryRunner"
import type { ConnectionPool, Connection } from 'any-db'
import { AbstractPoolQueryRunner } from "./AbstractPoolQueryRunner"
import { AnyDBQueryRunner } from "./AnyDBQueryRunner"

export class AnyDBPoolQueryRunner extends AbstractPoolQueryRunner {
    readonly database: DatabaseType
    readonly pool: ConnectionPool

    constructor(pool: ConnectionPool) {
        super()
        this.pool = pool
        switch (this.pool.adapter.name) {
            case 'mssql':
                this.database = 'sqlServer'
                break
            case 'mysql':
                this.database = 'mySql'
                break
            case 'postgres':
                this.database = 'postgreSql'
                break
            case 'sqlite3':
                this.database = 'sqlite'
                break
            default:
                throw new Error('Unknown any-db adapter of name ' + this.pool.adapter.name)
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
                throw new Error('Unsupported database: ' + database + '. The current connection used in AnyDBQueryRunner only supports mySql or mariaDB databases')
            } else {
                throw new Error('Unsupported database: ' + database + '. The current connection used in AnyDBQueryRunner only supports ' + this.database + ' databases')
            }
        }
    }
    getNativeRunner(): unknown {
        return this.pool
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        let result
        switch (this.pool.adapter.name) {
            case 'mssql':
                result = '@' + index
                break
            case 'mysql':
                result = '?'
                break
            case 'postgres':
                result = '$' + (index + 1)
                break
            case 'sqlite3':
                result = '?'
                break
            default:
                throw new Error('Unknown any-db adapter of name ' + this.pool.adapter.name)
        }
        params.push(value)
        return result

    }
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        const adapterName = this.pool.adapter.name
        if (adapterName !== 'mssql' && adapterName !== 'postgres') {
            throw new Error('Unsupported executeInsertReturningMultipleLastInsertedId for this database')
        }
        return super.executeInsertReturningMultipleLastInsertedId(query, params)
    }
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return new Promise((resolve, reject) => {
            this.pool.acquire((error, anyDBConnection) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(new AnyDBQueryRunner(anyDBConnection))
                }
            })
        })
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        this.pool.release(queryRunner.getNativeRunner() as Connection)
    }

}