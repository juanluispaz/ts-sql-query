import ChainedError from "chained-error"
import { attachAdditionalError, attachTransactionError, attachTransactionSource } from "./attachSource"

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

    let promise: Promise<void> | undefined
    // A containner is required to allow other functions to modify the value
    const errorContainer: ErrorContainer = { 
        error: throwError,
        name,
        source,
        transactionError
    }
    for (let i = 0, length = fns.length; i < length; i++) {
        if (!promise) {
            try {
                const fnResult = fns[i]!()
                if (isPromise(fnResult)) {
                    promise = fnResult
                }
            } catch (e) {
                if (errorContainer.error) {
                    attachAdditionalError(errorContainer.error, e, name)
                } else {
                    errorContainer.error = attachTransactionSource(new ChainedError('Error executing ' + name + ' functions', e), source)
                    if (transactionError) {
                        attachTransactionError(errorContainer.error, transactionError)
                    }
                }
            }
        } else {
            const fn = fns[i]!
            promise = promise.then(callDeferredFunctionAsThen.bind(undefined, fn, errorContainer, true), callDeferredFunctionAsThen.bind(undefined, fn, errorContainer, false))
        }
    }
    if (promise) {
        return promise.then(() => {
            if (errorContainer.error) {
                throw errorContainer.error
            }
            return result
        }, (e) => {
            if (errorContainer.error) {
                attachAdditionalError(errorContainer.error, e, errorContainer.name)
            } else {
                errorContainer.error = attachTransactionSource(new ChainedError('Error executing ' + errorContainer.name + ' functions', e), errorContainer.source)
                if (errorContainer.transactionError) {
                    attachTransactionError(errorContainer.error, errorContainer.transactionError)
                }
            }
            throw errorContainer.error
        })
    }
    if (errorContainer.error) {
        throw errorContainer.error
    }
    return result
}

function callDeferredFunctionAsThen(fn: () => void | Promise<void>, errorContainer: ErrorContainer, isThen: boolean, executionError: void | Error): void | Promise<void> {
    if (!isThen && executionError) {
        if (errorContainer.error) {
            attachAdditionalError(errorContainer.error, executionError, errorContainer.name)
        } else {
            errorContainer.error = attachTransactionSource(new ChainedError('Error executing ' + errorContainer.name + ' functions', executionError), errorContainer.source)
            if (errorContainer.transactionError) {
                attachTransactionError(errorContainer.error, errorContainer.transactionError)
            }
        }
    }
    try {
        const fnResult = fn()
        if (isPromise(fnResult)) {
            return fnResult
        }
    } catch (e) {
        if (errorContainer.error) {
            attachAdditionalError(errorContainer.error, e, errorContainer.name)
        } else {
            errorContainer.error = attachTransactionSource(new ChainedError('Error executing ' + errorContainer.name + ' functions', e), errorContainer.source)
            if (errorContainer.transactionError) {
                attachTransactionError(errorContainer.error, errorContainer.transactionError)
            }
        }
    }
}

interface ErrorContainer {
    error: Error | undefined
    readonly name: string
    readonly source: Error
    readonly transactionError?: Error
}