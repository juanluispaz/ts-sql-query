import { AbstractQueryRunner } from "./AbstractQueryRunner"
import type { QueryRunner } from "./QueryRunner"

export abstract class ManagedTransactionQueryRunner extends AbstractQueryRunner {
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner): Promise<T> {
        return outermostQueryRunner.executeBeginTransaction().then(() => {
            let result = fn()
            return result.then((r) => {
                return outermostQueryRunner.executeCommit().then(() => {
                    return r
                })
            }).catch((e) => {
                return outermostQueryRunner.executeRollback().then(() => {
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