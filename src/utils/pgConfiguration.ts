import { TsSqlProcessingError } from '../TsSqlError.js'
import { postgreSqlOptionsTimeZone, requireSessionInDatabaseZone } from './processTimeZone.js'

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

/**
 * The session must be in the zone of the database (see requireSessionInDatabaseZone): pg sets the zone of the session
 * only through `options` (`-c TimeZone=…`), given in the configuration, in the `options` of the connection string or
 * in `PGOPTIONS`. A client has them together in `connectionParameters`; a pool keeps its configuration as given, and
 * the rest is seen in each client it gives. Thrown when the query runner is created.
 */
export function requirePgSessionInDatabaseZone(clientOrPool: unknown, queryRunner: string): void {
    const object = clientOrPool as { connectionParameters?: { options?: unknown }, options?: { options?: unknown } } | undefined
    const options = object?.connectionParameters ? object.connectionParameters.options : object?.options?.options
    requireSessionInDatabaseZone(queryRunner, postgreSqlOptionsTimeZone(options), 'options', options, "pg's options (-c TimeZone)")
}
