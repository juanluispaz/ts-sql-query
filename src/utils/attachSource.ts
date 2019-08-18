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