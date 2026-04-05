import { TsSqlQueryExecutionError, QueryExecutionSource } from '../TsSqlError.js'

export function isPromise(value: any): value is Promise<unknown> {
    return value && (typeof value === 'object') && (typeof value.then === 'function')
}

export function callDeferredFunctions<T>(name: 'before next commit' | 'after next commit' | 'after next rollback', fns: Array<() => void | Promise<void>> | null | undefined, result: T, source: QueryExecutionSource, transactionError?: Error, throwError?: TsSqlQueryExecutionError) : T | Promise<T> {
    return internalCallDeferredFunctions(false, name, fns, result, source, transactionError, throwError)
}

export function callDeferredFunctionsStoppingOnError<T>(name: 'before next commit' | 'after next commit' | 'after next rollback', fns: Array<() => void | Promise<void>> | null | undefined, result: T, source: QueryExecutionSource, transactionError?: Error, throwError?: TsSqlQueryExecutionError) : T | Promise<T> {
    return internalCallDeferredFunctions(true, name, fns, result, source, transactionError, throwError)
}

function internalCallDeferredFunctions<T>(stopOnFistError: boolean, name: 'before next commit' | 'after next commit' | 'after next rollback', fns: Array<() => void | Promise<void>> | null | undefined, result: T, source: QueryExecutionSource, transactionError?: Error, throwError?: TsSqlQueryExecutionError) : T | Promise<T> {
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
        const fn = fns[i]!
        if (!promise) {
            try {
                const fnResult = fn()
                if (isPromise(fnResult)) {
                    promise = fnResult
                    promise.catch( (e) => {
                        if (e instanceof TsSqlQueryExecutionError && e.errorReason.reason === 'ERROR_EXECUTING_DEFERRED_IN_TRANSACTION') {
                            throw e
                        } else {
                            const err = new TsSqlQueryExecutionError(source, { reason: 'ERROR_EXECUTING_DEFERRED_IN_TRANSACTION', fn: fn, index: i, deferredType: name }, e).attachTransactionSource(source)
                            if (transactionError) {
                                err.attachTransactionError(transactionError)
                            }
                            throw err
                        }
                    })
                }
            } catch (e) {
                const err = new TsSqlQueryExecutionError(source, { reason: 'ERROR_EXECUTING_DEFERRED_IN_TRANSACTION', fn: fns[i]!, index: i, deferredType: name }, e).attachTransactionSource(source)
                if (transactionError) {
                    err.attachTransactionError(transactionError)
                }
                if (errorContainer.error) {
                    errorContainer.error.attachAdditionalError(err, name)
                } else {
                    errorContainer.error = err
                }
            }
        } else {
            const fn = fns[i]!
            promise = promise.then(callDeferredFunctionAsThen.bind(undefined, fn, i, errorContainer, true), stopOnFistError ? undefined : callDeferredFunctionAsThen.bind(undefined, fn, i, errorContainer, false))
        }
    }
    if (promise) {
        return promise.then(() => {
            if (errorContainer.error) {
                throw errorContainer.error
            }
            return result
        }, (e) => {
            if (!(e instanceof TsSqlQueryExecutionError && e.errorReason.reason === 'ERROR_EXECUTING_DEFERRED_IN_TRANSACTION')) {
                // This should not happen, the promise already transformed the error
                const err = new TsSqlQueryExecutionError(source, { reason: 'ERROR_EXECUTING_DEFERRED_IN_TRANSACTION', fn: () => undefined, index: -1, deferredType: errorContainer.name }, e).attachTransactionSource(source)
                if (transactionError) {
                    err.attachTransactionError(transactionError)
                }
                e = err
            }

            if (errorContainer.error) {
                errorContainer.error.attachAdditionalError(e, name)
            } else {
                errorContainer.error = e
            }
            throw errorContainer.error
        })
    }
    if (errorContainer.error) {
        throw errorContainer.error
    }
    return result
}

function callDeferredFunctionAsThen(fn: () => void | Promise<void>, index: number, errorContainer: ErrorContainer, isThen: boolean, executionError: void | Error): void | Promise<void> {
    if (!isThen && executionError) {
        let err: TsSqlQueryExecutionError
        if (!(executionError instanceof TsSqlQueryExecutionError && executionError.errorReason.reason === 'ERROR_EXECUTING_DEFERRED_IN_TRANSACTION')) {
            // This should not happen, the promise already transformed the error
            err = new TsSqlQueryExecutionError(errorContainer.source, { reason: 'ERROR_EXECUTING_DEFERRED_IN_TRANSACTION', fn: () => undefined, index: -1, deferredType: errorContainer.name }, executionError).attachTransactionSource(errorContainer.source)
            if (errorContainer.transactionError) {
                err.attachTransactionError(errorContainer.transactionError)
            }
        } else {
            err = executionError
        }

        if (errorContainer.error) {
            errorContainer.error.attachAdditionalError(err, errorContainer.name)
        } else {
            errorContainer.error = err
        }
    }
    
    try {
        const fnResult = fn()
        if (isPromise(fnResult)) {
            fnResult.catch( (e) => {
                if (e instanceof TsSqlQueryExecutionError && e.errorReason.reason === 'ERROR_EXECUTING_DEFERRED_IN_TRANSACTION') {
                    throw e
                } else {
                    const err = new TsSqlQueryExecutionError(errorContainer.source, { reason: 'ERROR_EXECUTING_DEFERRED_IN_TRANSACTION', fn, index, deferredType: errorContainer.name }, e).attachTransactionSource(errorContainer.source)
                    if (errorContainer.transactionError) {
                        err.attachTransactionError(errorContainer.transactionError)
                    }
                    throw err
                }
            })
        }
    } catch (e) {
        const err = new TsSqlQueryExecutionError(errorContainer.source, { reason: 'ERROR_EXECUTING_DEFERRED_IN_TRANSACTION', fn, index, deferredType: errorContainer.name }, e).attachTransactionSource(errorContainer.source)
        if (errorContainer.transactionError) {
            err.attachTransactionError(errorContainer.transactionError)
        }
        if (errorContainer.error) {
            errorContainer.error.attachAdditionalError(err, errorContainer.name)
        } else {
            errorContainer.error = err
        }
    }
}

interface ErrorContainer {
    error: TsSqlQueryExecutionError | undefined
    readonly name: 'before next commit' | 'after next commit' | 'after next rollback'
    readonly source: QueryExecutionSource
    readonly transactionError?: Error
}