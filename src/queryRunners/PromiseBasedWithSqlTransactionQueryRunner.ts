import { PromiseBasedQueryRunner } from "./PromiseBasedQueryRunner"

export abstract class PromiseBasedWithSqlTransactionQueryRunner extends PromiseBasedQueryRunner {
    executeBeginTransaction(): Promise<void> {
        return this.executeMutation('begin transaction', []).then(() => undefined)
    }
    executeCommit(): Promise<void> {
        return this.executeMutation('commit', []).then(() => undefined)
    }
    executeRollback(): Promise<void> {
        return this.executeMutation('rollback', []).then(() => undefined)
    }
}