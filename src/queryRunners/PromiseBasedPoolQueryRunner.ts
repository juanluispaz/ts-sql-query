import { UnwrapPromiseTuple } from "../utils/PromiseProvider"
import { ManagedTransactionPoolQueryRunner } from "./ManagedTransactionPoolQueryRunner"

export abstract class PromiseBasedPoolQueryRunner extends ManagedTransactionPoolQueryRunner {
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
    }
    createAllPromise<P extends Promise<any>[]>(promises: [...P]): Promise<UnwrapPromiseTuple<P>> {
        return Promise.all(promises) as any
    }
}