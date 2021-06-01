import type { DatabaseType, QueryRunner } from "./QueryRunner"
import type { Pool, PoolConnection } from 'mariadb'
import { PromiseBasedPoolQueryRunner } from "./PromiseBasedPoolQueryRunner"
import { MariaDBQueryRunner } from "./MariaDBQueryRunner"

export class MariaDBPoolQueryRunner extends PromiseBasedPoolQueryRunner {
    readonly database: DatabaseType
    readonly pool: Pool

    constructor(pool: Pool, database: 'mariaDB' | 'mySql' = 'mariaDB') {
        super()
        this.pool = pool
        this.database = database
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new Error('Unsupported database: ' + database + '. MariaDBQueryRunner only supports mariaDB or mySql databases')
        } else {
            // @ts-ignore
            this.database = database
        }
    }
    getNativeRunner(): unknown {
        return this.pool
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    executeInsertReturningMultipleLastInsertedId(_query: string, _params: any[] = []): Promise<any> {
        throw new Error('Unsupported executeInsertReturningMultipleLastInsertedId for this database')
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return this.pool.getConnection().then(mariaDBConnection => new MariaDBQueryRunner(mariaDBConnection, this.database as any))
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeRunner() as PoolConnection).release()
    }

}