import { ManagedTransactionPoolQueryRunner } from "./ManagedTransactionPoolQueryRunner"

export abstract class PromiseBasedPoolQueryRunner extends ManagedTransactionPoolQueryRunner {
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
    }
    createRejectedPromise<RESULT = any>(error: any): Promise<RESULT> {
        return Promise.reject(error)
    }
}