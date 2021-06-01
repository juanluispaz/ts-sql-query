import type { DatabaseType, QueryRunner } from "./QueryRunner"
import type { Pool, Connection } from 'oracledb'
import { BIND_OUT } from 'oracledb'
import { PromiseBasedPoolQueryRunner } from "./PromiseBasedPoolQueryRunner"
import { OracleDBQueryRunner } from "./OracleDBQueryRunner"

export class OracleDBPoolPromiseQueryRunner extends PromiseBasedPoolQueryRunner {
    readonly database: DatabaseType
    readonly promisePool: Promise<Pool>

    constructor(promisePool: Promise<Pool>) {
        super()
        this.promisePool = promisePool
        this.database = 'oracle'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'oracle') {
            throw new Error('Unsupported database: ' + database + '. OracleDBPoolPromiseQueryRunner only supports oracle databases')
        }
    }
    getNativeRunner(): unknown {
        return this.promisePool
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
    protected createQueryRunner(): Promise<QueryRunner> {
        return this.promisePool.then(pool => pool.getConnection()).then(connection => new OracleDBQueryRunner(connection))
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeRunner() as Connection).close()
    }

}