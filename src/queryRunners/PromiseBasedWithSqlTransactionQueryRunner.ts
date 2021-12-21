import { UnwrapPromiseTuple } from "../utils/PromiseProvider"
import { SqlTransactionQueryRunner } from "./SqlTransactionQueryRunner"

export abstract class PromiseBasedWithSqlTransactionQueryRunner extends SqlTransactionQueryRunner {
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
    }
    protected createAllPromise<P extends Promise<any>[]>(promises: [...P]): Promise<UnwrapPromiseTuple<P>> {
        return Promise.all(promises) as any
    }
}