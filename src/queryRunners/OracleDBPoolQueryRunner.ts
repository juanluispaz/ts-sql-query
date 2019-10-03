import { AbstractPoolQueryRunner } from "./AbstractPoolQueryRunner"
import { DatabaseType, QueryRunner } from "./QueryRunner"
import { Pool, Connection } from 'oracledb'
import { OracleDBQueryRunner } from "./OracleDBQueryRunner"

export class OracleDBPoolQueryRunner extends AbstractPoolQueryRunner {
    readonly oracle: true = true
    database: DatabaseType
    readonly pool: Pool

    constructor(pool: Pool) {
        super()
        this.pool = pool
        this.database = 'oracle'
    }

    getNativeConnection(): unknown {
        return this.pool
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return ':' + index
    }
    addOutParam(params: any[], name: string): string {
        const index = params.length
        params.push({dir: 3003 /*oracledb.BIND_OUT*/, as: name}) // See https://github.com/oracle/node-oracledb/blob/master/lib/oracledb.js
        return ':' + index
    }
    protected async createQueryRunner(): Promise<QueryRunner> {
        const connection = await this.pool.getConnection()
        return new OracleDBQueryRunner(connection)
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeConnection() as Connection).close()
    }

}