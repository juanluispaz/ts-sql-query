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