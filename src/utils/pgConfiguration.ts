import { TsSqlProcessingError } from '../TsSqlError.js'

/**
 * pg must receive the values as text: in its binary mode (`binary: true`, of the client or of the pool) a numeric is
 * read wrong (1.50 as 1.51) and the parsers of the text are not used. Thrown when the query runner is created.
 */
export function requirePgTextMode(clientOrPool: unknown, queryRunner: string): void {
    const binary = (clientOrPool as { binary?: unknown, options?: { binary?: unknown } } | undefined)
    if (binary?.binary === true || binary?.options?.binary === true) {
        throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'binary', value: true }, queryRunner + ' requires pg without the binary mode (binary: true): in it pg reads a numeric wrong and the values are not received as text')
    }
}
