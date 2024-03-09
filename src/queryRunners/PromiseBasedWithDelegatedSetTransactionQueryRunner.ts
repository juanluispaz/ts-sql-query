import { DelegatedSetTransactionQueryRunner } from "./DelegatedSetTransactionQueryRunner"

export abstract class PromiseBasedWithDelegatedSetTransactionQueryRunner extends DelegatedSetTransactionQueryRunner {
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
    }
    createRejectedPromise<RESULT = any>(error: any): Promise<RESULT> {
        return Promise.reject(error)
    }
}