export function attachSource(error: Error, source: Error): Error {
    Object.defineProperty(error, 'source', {
        value: source,
        writable: true,
        enumerable: false,
        configurable: true
    })
    error.stack = error.stack + '\nSource: ' + source.stack
    return error
}

export function attachTransactionSource(error: Error, source: Error): Error {
    Object.defineProperty(error, 'transactionSource', {
        value: source,
        writable: true,
        enumerable: false,
        configurable: true
    })
    error.stack = error.stack + '\nTransaction source: ' + source.stack
    return error
}

export function attachRollbackError(error: Error, source: unknown): Error {
    Object.defineProperty(error, 'rollbackError', {
        value: source,
        writable: true,
        enumerable: false,
        configurable: true
    })
    if (source instanceof Error) {
        error.stack = error.stack + '\nRollback error: ' + source.stack
    } else {
        error.stack = error.stack + '\nRollback error: ' + source
    }
    return error
}

export function attachTransactionError(error: Error, source: unknown): Error {
    Object.defineProperty(error, 'transactionError', {
        value: source,
        writable: true,
        enumerable: false,
        configurable: true
    })
    if (source instanceof Error) {
        error.stack = error.stack + '\nTransaction error: ' + source.stack
    } else {
        error.stack = error.stack + '\nTransaction error: ' + source
    }
    return error
}

export function attachAdditionalError(error: Error, additional: unknown, name: string): Error {
    let additionalErrors: Array<unknown> | undefined = (error as any).additionalErrors
    if (!additionalErrors) {
        additionalErrors = []
        Object.defineProperty(error, 'additionalErrors', {
            value: additionalErrors,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    additionalErrors.push(additional)
    if (additional instanceof Error) {
        error.stack = error.stack + '\n-------------------------------------------------------------\n'
            + 'An additional error happens during the ' + name +  ' processing in another handler.\n'
            + 'Additional error: ' + additional.stack
    } else {
        error.stack = error.stack + '\n-------------------------------------------------------------\n'
            + 'An additional error happens during the ' + name +  ' processing in another handler.\n'
            + 'Additional error: ' + additional
    }
    return error
}