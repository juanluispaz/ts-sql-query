import { AbstractQueryRunner } from "./AbstractQueryRunner"
import type { BeginTransactionOpts, QueryRunner } from "./QueryRunner"

export abstract class ManagedTransactionQueryRunner extends AbstractQueryRunner {
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        return outermostQueryRunner.executeBeginTransaction(opts).then(() => {
            let result = fn()
            return result.then((r) => {
                return outermostQueryRunner.executeCommit(opts as any).then(() => {
                    return r
                })
            }).catch((e) => {
                return outermostQueryRunner.executeRollback(opts as any).then(() => {
                    throw e
                }, () => {
                    // Throw the innermost error
                    throw e
                })
            })
        })
    }
}