import { BeginTransactionOpts, CommitOpts, DatabaseType, QueryRunner, RollbackOpts } from "./QueryRunner"

export abstract class AbstractPoolQueryRunner implements QueryRunner {
    abstract readonly database: DatabaseType
    private currentQueryRunner?: QueryRunner
    private transactionLevel = 0
    private transactionOpts?: BeginTransactionOpts

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
    executeInsertReturningOneRow(query: string, params: any[] = []): Promise<any> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeInsertReturningOneRow(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeInsertReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeInsertReturningManyRows(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeInsertReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeInsertReturningOneColumnOneRow(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeInsertReturningOneColumnManyRows(query: string, params: any[] =[]): Promise<any[]> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeInsertReturningOneColumnManyRows(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeUpdate(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeUpdateReturningOneRow(query: string, params: any[] = []): Promise<any> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeUpdateReturningOneRow(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeUpdateReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeUpdateReturningManyRows(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeUpdateReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeUpdateReturningOneColumnOneRow(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeUpdateReturningOneColumnManyRows(query: string, params: any[] =[]): Promise<any[]> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeUpdateReturningOneColumnManyRows(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeDelete(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeDeleteReturningOneRow(query: string, params: any[] = []): Promise<any> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeDeleteReturningOneRow(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeDeleteReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeDeleteReturningManyRows(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeDeleteReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeDeleteReturningOneColumnOneRow(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeDeleteReturningOneColumnManyRows(query: string, params: any[] =[]): Promise<any[]> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeDeleteReturningOneColumnManyRows(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeProcedure(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeFunction(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeBeginTransaction(opts: BeginTransactionOpts): Promise<void> {
        if (!this.nestedTransactionsSupported() && this.transactionLevel >= 1) {
            return this.createRejectedPromise(new Error(this.database + " doesn't support nested transactions (using " + this.constructor.name + ")"))
        }
        if (this.transactionLevel <= 0) {
            this.transactionLevel = 1
            this.transactionOpts = opts
            return this.createResolvedPromise(undefined)
        } else {
            return this.getQueryRunner().then(queryRunner => queryRunner.executeBeginTransaction(opts)).then(() => {
                this.transactionLevel++
            })
        }
    }
    executeCommit(opts: CommitOpts): Promise<void> {
        if (this.transactionLevel <= 0) {
            return this.createRejectedPromise(new Error('You are not in a transaction'))
        }
        
        if (this.currentQueryRunner) {
            return this.currentQueryRunner.executeCommit(opts).then(() => {
                // Transaction count and release only modified when commit successful, in case of error there is still an open transaction 
                this.transactionLevel--
                if (this.transactionLevel <= 0) {
                    this.transactionLevel = 0
                    this.transactionOpts = undefined
                }
                this.releaseIfNeeded()
            })
        }

        this.transactionLevel--
        if (this.transactionLevel <= 0) {
            this.transactionLevel = 0
            this.transactionOpts = undefined
        }
        return this.createResolvedPromise(undefined)
    }
    executeRollback(opts: RollbackOpts): Promise<void> {
        if (this.transactionLevel <= 0) {
            return this.createRejectedPromise(new Error('You are not in a transaction'))
        }

        if (this.currentQueryRunner) {
            return this.currentQueryRunner.executeRollback(opts).finally(() => {
                this.transactionLevel--
                if (this.transactionLevel <= 0) {
                    this.transactionLevel = 0
                    this.transactionOpts = undefined
                }
                this.releaseIfNeeded()
            })
        }

        this.transactionLevel--
        if (this.transactionLevel <= 0) {
            this.transactionLevel = 0
            this.transactionOpts = undefined
        }
        return this.createResolvedPromise(undefined)
    }
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        return this.getQueryRunner().then(queryRunner => queryRunner.executeDatabaseSchemaModification(query, params)).finally(() => this.releaseIfNeeded())
    }
    executeConnectionConfiguration(query: string, params: any[] = []): Promise<void> {
        if (!this.isTransactionActive()) {
            this.createRejectedPromise(new Error("You are trying to configure a connection when you didn't request a dedicated connection. Begin a transaction to get a dedicated connection"))
        }
        return this.getQueryRunner().then(queryRunner => queryRunner.executeConnectionConfiguration(query, params)).finally(() => this.releaseIfNeeded())
    }

    abstract executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts): Promise<T>
    abstract executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]>

    abstract useDatabase(database: DatabaseType): void
    abstract getNativeRunner(): unknown
    getCurrentNativeTransaction(): unknown {
        if (!this.currentQueryRunner) {
            return undefined
        }
        return this.currentQueryRunner.getCurrentNativeTransaction()
    }
    abstract addParam(params: any[], value: any): string
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
    abstract createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT>
    abstract createRejectedPromise<RESULT = any>(error: any): Promise<RESULT>

    private getQueryRunner(): Promise<QueryRunner> {
        if (!this.currentQueryRunner) {
            return this.createQueryRunner().then(queryRunner => {
                if (this.currentQueryRunner) {
                    this.releaseQueryRunner(queryRunner)
                    throw new Error('Forbidden concurrent usage of the query runner was detected when it tried to get a database connection from the pool')
                }
                this.currentQueryRunner = queryRunner
                if (this.transactionLevel > 0) {
                    return this.currentQueryRunner.executeBeginTransaction(this.transactionOpts!).then(() => {
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

    isMocked(): boolean {
        return false
    }
    lowLevelTransactionManagementSupported(): boolean {
        return true
    }
    nestedTransactionsSupported(): boolean {
        return false
    }
}