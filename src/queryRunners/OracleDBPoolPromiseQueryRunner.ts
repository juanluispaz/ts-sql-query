import { AbstractPoolQueryRunner } from "./AbstractPoolQueryRunner"
import { DatabaseType, QueryRunner } from "./QueryRunner"
import { Pool, Connection, BIND_OUT } from 'oracledb'
import { OracleDBQueryRunner } from "./OracleDBQueryRunner"

export class OracleDBPoolPromiseQueryRunner extends AbstractPoolQueryRunner {
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
    protected async createQueryRunner(): Promise<QueryRunner> {
        const connection = await (await this.promisePool).getConnection()
        return new OracleDBQueryRunner(connection)
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeRunner() as Connection).close()
    }

}