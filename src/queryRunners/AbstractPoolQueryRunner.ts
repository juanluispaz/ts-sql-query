import type { QueryRunner, DatabaseType } from "./QueryRunner"

export abstract class AbstractPoolQueryRunner implements QueryRunner {
    private currentQueryRunner?: QueryRunner
    private transactionLevel = 0
    abstract readonly database: DatabaseType

    abstract useDatabase(database: DatabaseType): void
    abstract getNativeRunner(): unknown

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return this.getQueryRunner().then(queryRunner => queryRunner.execute(fn)).finally(() => this.releaseIfNeeded())
    }
    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeSelectOneRow(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeSelectManyRows(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeSelectOneColumnOneRow(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeSelectOneColumnManyRows(query: string, params: any[] =[]): Promise<any[]> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeSelectOneColumnManyRows(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeInsert(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeInsertReturningLastInsertedId(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any[]> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeInsertReturningMultipleLastInsertedId(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeUpdate(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeDelete(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeProcedure(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeFunction(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeBeginTransaction(): Promise<void> {
        if (this.transactionLevel <= 0) {
            this.transactionLevel = 1
            return this.createResolvedPromise(undefined)
        } else {
            return this.getQueryRunner().then(queryRunner => queryRunner.executeBeginTransaction()).then(() => {
                this.transactionLevel++
            })
        }
    }
    executeCommit(): Promise<void> {
        if (this.transactionLevel <= 0) {
            throw new Error('You are not in a transaction')
        } else if (this.currentQueryRunner) {
            this.transactionLevel--
            return this.currentQueryRunner.executeCommit().finally(() => this.releaseIfNeeded())
        }
        return this.createResolvedPromise(undefined)
    }
    executeRollback(): Promise<void> {
        if (this.transactionLevel <= 0) {
            throw new Error('You are not in a transaction')
        } else if (this.currentQueryRunner) {
            this.transactionLevel--
            return this.currentQueryRunner.executeRollback().finally(() => this.releaseIfNeeded())
        }
        return this.createResolvedPromise(undefined)
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeDatabaseSchemaModification(query, params)).finally(() => this.releaseIfNeeded())
    }
    abstract addParam(params: any[], value: any): string
    abstract addOutParam(params: any[], name: string): string
    abstract createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT>

    private getQueryRunner(): Promise<QueryRunner> {
        if (!this.currentQueryRunner) {
            return this.createQueryRunner().then(queryRunner => {
                this.currentQueryRunner = queryRunner
                if (this.transactionLevel > 0) {
                    return this.currentQueryRunner.executeBeginTransaction().then(() => {
                        return queryRunner
                    })
                }
                return queryRunner
            })
        }
        return this.createResolvedPromise(this.currentQueryRunner)
    }
    private releaseIfNeeded() {
        if (this.transactionLevel <= 0 && this.currentQueryRunner) {
            this.releaseQueryRunner(this.currentQueryRunner)
            this.currentQueryRunner = undefined
        }
    }

    protected abstract createQueryRunner(): Promise<QueryRunner>
    protected abstract releaseQueryRunner(queryRunner: QueryRunner): void
}