import ChainedError from "chained-error"
import { attachTransactionError, attachTransactionSource } from "./attachSource"

export type PromiseProvider = PromiseConstructorLike & {
    resolve: typeof Promise.resolve,
    reject: typeof Promise.reject,
    /* Not all providers have compatible interface, by example:
     * synchronous-promise doesn't provide an definition so detailed like the ones included in the standar library
     */
    // all: typeof Promise.all, 
    all(values: any[]): Promise<any[]>, 
    /* Not all providers support it, by example: 
     * synchronous-promise doesn't provide an implementation of it
     */
    // race: typeof Promise.race, 
    /* So new, introduced in ES2020. Not all providers have compatible interface, by example:
     * synchronous-promise doesn't provide an definition compatible with the ones included in the standar library
     */
    // allSettled: typeof Promise.allSettled
}

export type UnwrapPromise<P extends any> = P extends Promise<infer R> ? R : P
export type UnwrapPromiseTuple<Tuple extends any[]> = {
    [K in keyof Tuple]: UnwrapPromise<Tuple[K]>
}

export function isPromise(value: any): value is Promise<unknown> {
    return value && (typeof value === 'object') && (typeof value.then === 'function')
}

export function callDeferredFunctions<T>(name: string, fns: Array<() => void | Promise<void>> | undefined, result: T, source: Error, transactionError?: Error, throwError?: Error) : T | Promise<T> {
    if (!fns) {
        if (throwError) {
            throw throwError
        }
        return result
    }
    try {
        let promise: Promise<void> | undefined
        for (let i = 0, length = fns.length; i < length; i++) {
            if (!promise) {
                const fnResult = fns[i]!()
                if (isPromise(fnResult)) {
                    promise = fnResult
                }
            } else {
                const fn = fns[i]!
                promise = promise.then(callDeferredFunctionAsThen.bind(undefined, fn))
            }
        }
        if (promise) {
            return promise.then(() => {
                if (throwError) {
                    throw throwError
                }
                return result
            }, (e) => {
                const newError = attachTransactionSource(new ChainedError('Error executing ' + name + ' functions', e), source)
                if (transactionError) {
                    attachTransactionError(newError, transactionError)
                }
                throw newError
            })
        }
        if (throwError) {
            throw throwError
        }
        return result
    } catch (e) {
        const newError = attachTransactionSource(new ChainedError('Error executing ' + name + ' functions', e), source)
        if (transactionError) {
            attachTransactionError(newError, transactionError)
        }
        throw newError
    }
}

function callDeferredFunctionAsThen(fn: () => void | Promise<void>): void | Promise<void> {
    const fnResult = fn()
    if (isPromise(fnResult)) {
        return fnResult
    }
}