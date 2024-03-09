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
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]> {
        return fn1().then((r1) => {
            return fn2().then((r2) => {
                return [r1, r2]
            })
        })
    }
}