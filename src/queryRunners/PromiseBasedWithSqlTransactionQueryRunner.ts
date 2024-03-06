import { SqlTransactionQueryRunner } from "./SqlTransactionQueryRunner"

export abstract class PromiseBasedWithSqlTransactionQueryRunner extends SqlTransactionQueryRunner {
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
    }
    createRejectedPromise<RESULT = any>(error: any): Promise<RESULT> {
        return Promise.reject(error)
    }
}