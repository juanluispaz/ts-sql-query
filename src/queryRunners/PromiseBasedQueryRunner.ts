import { ManagedTransactionQueryRunner } from "./ManagedTransactionQueryRunner"

export abstract class PromiseBasedQueryRunner extends ManagedTransactionQueryRunner {
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
    }
}