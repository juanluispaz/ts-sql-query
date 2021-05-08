import type { DatabaseType, QueryRunner } from "./QueryRunner"
import type { Pool, PoolConnection } from "mysql"
import { AbstractPoolQueryRunner } from "./AbstractPoolQueryRunner"
import { MySqlQueryRunner } from "./MySqlQueryRunner"
import { UnwrapPromiseTuple } from "../utils/PromiseProvider"

export class MySqlPoolQueryRunner extends AbstractPoolQueryRunner {
    readonly database: DatabaseType
    readonly pool: Pool

    constructor(pool: Pool, database: 'mariaDB' | 'mySql' = 'mySql') {
        super()
        this.pool = pool
        this.database = database
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new Error('Unsupported database: ' + database + '. MySqlPoolQueryRunner only supports mySql or mariaDB databases')
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
        return new Promise((resolve, reject) => {
            this.pool.getConnection((error, mysqlConnection) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(new MySqlQueryRunner(mysqlConnection, this.database as any))
                }
            })
        })
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeRunner() as PoolConnection).release()
    }

}