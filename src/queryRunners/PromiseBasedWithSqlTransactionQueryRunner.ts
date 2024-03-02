import { SqlTransactionQueryRunner } from "./SqlTransactionQueryRunner"

export abstract class PromiseBasedWithSqlTransactionQueryRunner extends SqlTransactionQueryRunner {
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
    }
}