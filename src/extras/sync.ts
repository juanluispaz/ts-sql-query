import { TsSqlProcessingError } from '../TsSqlError.js'

/**
 * Unwraps the result of a synchronous promise in a blocking manner, similar to
 * how `await` unwraps regular promises.
 *
 * When used with a promise implementation that resolves synchronously (and does
 * not defer `.then` execution) — typically [`synchronous-promise`](https://www.npmjs.com/package/synchronous-promise)
 * combined with a synchronous database query runner such as `BetterSqlite3QueryRunner`,
 * `NodeSqliteQueryRunner`, `BunSqliteQueryRunner`, `Sqlite3WasmOO1QueryRunner` or
 * `PgLiteQueryRunner` — this allows interacting with `ts-sql-query` in a fully
 * synchronous style.
 *
 * The promise passed to `sync()` must be truly synchronous; if it has not
 * resolved (or rejected) by the time `.then(...)` returns, this function throws
 * a `TsSqlProcessingError` with the `SYNCHRONOUS_PROSIME_EXPECTED` reason,
 * preventing accidental misuse from any real async operation slipping in.
 */
export function sync<T>(promise: Promise<T>): T {
    const UNSET = Symbol('unset')

    let result: T | typeof UNSET = UNSET
    let error: unknown | typeof UNSET = UNSET

    promise.then(
        (r) => (result = r),
        (e) => (error = e),
    )

    // Propagate error, if available
    if (error !== UNSET) {
        throw error
    }

    // Propagate result, if available
    if (result !== UNSET) {
        return result
    }

    // Note: This wrapper is to be used in combination with the `SynchronousPromise` type,
    // which is not strictly Promise-spec-compliant because it does not defer when calling
    // `.then`. See https://www.npmjs.com/package/synchronous-promise for more details.
    // To ensure that we're indeed using a synchronous promise, ensure that the promise resolved
    // immediately.
    throw new TsSqlProcessingError(
        { reason: 'SYNCHRONOUS_PROSIME_EXPECTED' },
        'You performed a real async operation (not a synchronous database call) ' +
            'inside a function meant to execute synchronous database queries.',
    )
}
