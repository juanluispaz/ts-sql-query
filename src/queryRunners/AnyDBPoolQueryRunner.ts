import { AbstractPoolQueryRunner } from "./AbstractPoolQueryRunner"
import { DatabaseType, QueryRunner } from "./QueryRunner"
import { ConnectionPool, Connection } from 'any-db'
import { AnyDBQueryRunner } from "./AnyDBQueryRunner"

export abstract class AnyDBPoolQueryRunner extends AbstractPoolQueryRunner {
    // Supported databases
    readonly mariaDB: true = true
    readonly mySql: true = true
    readonly postgreSql: true = true
    readonly sqlite: true = true
    readonly sqlServer: true = true
    database: DatabaseType
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

    getNativeConnection(): unknown {
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
                result = '$' + index
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
    protected async createQueryRunner(): Promise<QueryRunner> {
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
        this.pool.release(queryRunner.getNativeConnection() as Connection)
    }

}