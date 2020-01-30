import { AbstractPoolQueryRunner } from "./AbstractPoolQueryRunner"
import { DatabaseType, QueryRunner } from "./QueryRunner"
import { Pool, PoolConnection } from 'mariadb'
import { MariaDBQueryRunner } from "./MariaDBQueryRunner"

export class MariaDBPoolQueryRunner extends AbstractPoolQueryRunner {
    readonly mySql: true = true
    readonly mariaDB: true = true
    database: DatabaseType
    readonly pool: Pool

    constructor(pool: Pool, database: 'mariaDB' | 'mySql' = 'mariaDB') {
        super()
        this.pool = pool
        this.database = database
    }

    getNativeConnection(): unknown {
        return this.pool
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
    executeInsertReturningMultipleLastInsertedId(_query: string, _params: any[]): Promise<any> {
        throw new Error('Unsupported executeInsertReturningLastInsertedId for this database')
    }
    protected async createQueryRunner(): Promise<QueryRunner> {
        const mariaDBConnection = await this.pool.getConnection()
        return new MariaDBQueryRunner(mariaDBConnection, this.database as any)
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeConnection() as PoolConnection).release()
    }

}