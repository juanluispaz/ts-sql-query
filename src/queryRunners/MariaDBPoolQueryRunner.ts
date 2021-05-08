import type { DatabaseType, QueryRunner } from "./QueryRunner"
import type { Pool, PoolConnection } from 'mariadb'
import { AbstractPoolQueryRunner } from "./AbstractPoolQueryRunner"
import { MariaDBQueryRunner } from "./MariaDBQueryRunner"
import { UnwrapPromiseTuple } from "../utils/PromiseProvider"

export class MariaDBPoolQueryRunner extends AbstractPoolQueryRunner {
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
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
    executeInsertReturningMultipleLastInsertedId(_query: string, _params: any[] = []): Promise<any> {
        throw new Error('Unsupported executeInsertReturningLastInsertedId for this database')
    }
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
    }
    createAllPromise<P extends Promise<any>[]>(promises: [...P]): Promise<UnwrapPromiseTuple<P>> {
        return Promise.all(promises) as any
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return this.pool.getConnection().then(mariaDBConnection => new MariaDBQueryRunner(mariaDBConnection, this.database as any))
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeRunner() as PoolConnection).release()
    }

}