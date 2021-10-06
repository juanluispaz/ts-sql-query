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
        return this.executeMutation('commit', []).then(() => {
            // Transaction count only modified when commit successful, in case of error there is still an open transaction 
            this.transactionLevel--
            if (this.transactionLevel < 0) {
                this.transactionLevel = 0
            }
        })
    }
    executeRollback(): Promise<void> {
        return this.executeMutation('rollback', []).then(() => {
            this.transactionLevel--
            if (this.transactionLevel < 0) {
                this.transactionLevel = 0
            }
        }, (error) => {
            this.transactionLevel--
            if (this.transactionLevel < 0) {
                this.transactionLevel = 0
            }
            throw error
        })
    }
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
}