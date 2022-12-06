import type { UnwrapPromiseTuple } from "../utils/PromiseProvider"
import { AbstractQueryRunner } from "./AbstractQueryRunner"

export abstract class PromiseBasedAbstractQueryRunner extends AbstractQueryRunner {
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
    }
    protected createAllPromise<P extends Promise<any>[]>(promises: [...P]): Promise<UnwrapPromiseTuple<P>> {
        return Promise.all(promises) as any
    }
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]> {
        return fn1().then((r1) => {
            return fn2().then((r2) => {
                return [r1, r2]
            })
        })
    }
}