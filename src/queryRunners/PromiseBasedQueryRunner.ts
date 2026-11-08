import { UnwrapPromiseTuple } from "../utils/PromiseProvider"
import { ManagedTransactionQueryRunner } from "./ManagedTransactionQueryRunner"

/** @deprecated Extend ManagedTransactionQueryRunner instead, implementing createResolvedPromise yourself (e.g. return Promise.resolve(result)). This class will be removed in ts-sql-query v2. */
export abstract class PromiseBasedQueryRunner extends ManagedTransactionQueryRunner {
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
    }
    protected createAllPromise<P extends Promise<any>[]>(promises: [...P]): Promise<UnwrapPromiseTuple<P>> {
        return Promise.all(promises) as any
    }
}