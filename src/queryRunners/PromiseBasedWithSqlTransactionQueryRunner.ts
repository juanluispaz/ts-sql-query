import { PromiseBasedQueryRunner } from "./PromiseBasedQueryRunner"

export abstract class PromiseBasedWithSqlTransactionQueryRunner extends PromiseBasedQueryRunner {
    private transactionLevel = 0
    executeBeginTransaction(): Promise<void> {
        return this.executeMutation('begin transaction', []).then(() => {
            this.transactionLevel++
            return undefined
        })
    }
    executeCommit(): Promise<void> {
        this.transactionLevel--
        return this.executeMutation('commit', []).then(() => undefined)
    }
    executeRollback(): Promise<void> {
        this.transactionLevel--
        return this.executeMutation('rollback', []).then(() => undefined)
    }
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
}