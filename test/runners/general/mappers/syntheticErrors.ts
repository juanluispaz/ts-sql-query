// Error objects built in the shape a driver gives them, for the conditions a
// test can't provoke on a real engine and the engine can't raise on demand:
// a socket reset, a pool closed under the runner, a TLS or SASL failure, a
// protocol message the driver didn't expect, a corrupted SQLite file. Each
// case names where its shape comes from (the driver's source, the engine's
// documentation) and the reason its error must be reported as; the runner
// tests' `error.driver-error-shape` checks a real error of each driver still
// has the fields these cases fill.

import { describe, expect, test } from '../../../lib/testRunner.js'

export interface SyntheticErrorCase {
    readonly name: string
    /** Where the shape comes from: `pg/lib/client.js`, `SQLite result codes`, ... */
    readonly source: string
    readonly error: () => unknown
    readonly expected: { reason: string, [field: string]: unknown }
    /** An error the driver didn't raise: not recognised as a SQL error. */
    readonly notSqlError?: boolean
}

export interface SyntheticErrorMapper {
    getErrorReason(error: unknown): { reason: string }
    isError(error: unknown): boolean
}

/** An Error carrying the given properties, as drivers attach them (`code`, `errno`, ...). */
export function driverError(message: string, properties: Record<string, unknown> = {}, ErrorClass: new (message: string) => Error = Error): Error {
    return Object.assign(new ErrorClass(message), properties)
}

export function describeSyntheticErrors(label: string, mapper: () => Promise<SyntheticErrorMapper> | SyntheticErrorMapper, cases: readonly SyntheticErrorCase[], enabled = true): void {
    describe.skipIf(!enabled)(label + ' (synthetic driver errors)', () => {
        for (const c of cases) {
            test('synthetic.' + c.name, async () => {
                const m = await mapper()
                const error = c.error()
                expect(m.isError(error)).toBe(!c.notSqlError)
                expect(m.getErrorReason(error)).toMatchObject(c.expected)
            })
        }
    })
}
