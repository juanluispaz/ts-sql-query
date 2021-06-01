import { UnwrapPromiseTuple } from "../utils/PromiseProvider"
import { AbstractQueryRunner } from "./AbstractQueryRunner"
import type { QueryRunner } from "./QueryRunner"

export abstract class ManagedTransactionQueryRunner extends AbstractQueryRunner {
    executeInTransaction<P extends Promise<any>[]>(fn: () => [...P], outermostQueryRunner: QueryRunner): Promise<UnwrapPromiseTuple<P>>
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner): Promise<T>
    executeInTransaction(fn: () => Promise<any>[] | Promise<any>, outermostQueryRunner: QueryRunner): Promise<any>
    executeInTransaction(fn: () => Promise<any>[] | Promise<any>, outermostQueryRunner: QueryRunner): Promise<any> {
        return outermostQueryRunner.executeBeginTransaction().then(() => {
            let result = fn()
            if (Array.isArray(result)) {
                result = this.createAllPromise(result)
            }
            return result.then((r) => {
                return outermostQueryRunner.executeCommit().then(() => {
                    return r
                })
            }, (e) => {
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