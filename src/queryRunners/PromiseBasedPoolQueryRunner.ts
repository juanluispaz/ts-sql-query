import { ManagedTransactionPoolQueryRunner } from "./ManagedTransactionPoolQueryRunner"

export abstract class PromiseBasedPoolQueryRunner extends ManagedTransactionPoolQueryRunner {
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
    }
}