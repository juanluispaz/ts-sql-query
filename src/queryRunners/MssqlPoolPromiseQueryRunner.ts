import type { DatabaseType, QueryRunner } from "./QueryRunner"
import type { ConnectionPool, Transaction } from 'mssql'
import { MssqlPoolQueryRunner } from "./MssqlPoolQueryRunner"
import { ManagedTransactionPoolQueryRunner } from "./ManagedTransactionPoolQueryRunner"

export class MssqlPoolPromiseQueryRunner extends ManagedTransactionPoolQueryRunner {
    readonly database: DatabaseType
    readonly promisePool: Promise<ConnectionPool>

    constructor(promisePool: Promise<ConnectionPool>) {
        super()
        this.promisePool = promisePool
        this.database = 'sqlServer'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlServer') {
            throw new Error('Unsupported database: ' + database + '. MssqlPoolPromiseQueryRunner only supports sqlServer databases')
        }
    }
    getNativeRunner(): Promise<ConnectionPool> {
        return this.promisePool
    }
    getCurrentNativeTransaction(): Transaction | undefined {
        return super.getCurrentNativeTransaction() as any
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return '@' + index
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return this.promisePool.then(pool => new MssqlPoolQueryRunner(pool))
    }
    protected releaseQueryRunner(_queryRunner: QueryRunner): void {
        // Do nothing
    }

}