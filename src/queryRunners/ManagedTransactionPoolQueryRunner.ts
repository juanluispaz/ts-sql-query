import { AbstractPoolQueryRunner } from './AbstractPoolQueryRunner.js'
import type { BeginTransactionOpts, QueryRunner } from './QueryRunner.js'
import { TsSqlQueryExecutionError } from '../TsSqlError.js'

export abstract class ManagedTransactionPoolQueryRunner extends AbstractPoolQueryRunner {
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
                }, (innerError) => {
                    if (e instanceof TsSqlQueryExecutionError) {
                        e.attachRollbackError(innerError)
                    }
                    // Throw the innermost error
                    throw e
                })
            })
        })
    }
}