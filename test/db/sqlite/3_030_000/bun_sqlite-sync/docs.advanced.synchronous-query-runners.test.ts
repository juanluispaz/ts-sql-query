// Documentation behaviour for the Synchronous query runners page
// (docs/advanced/synchronous-query-runners.md). Covers the `sync()` helper
// contract from `ts-sql-query/extras/sync`: it unwraps a promise that has
// resolved synchronously (the shape `synchronous-promise` produces with a
// synchronous query runner) in a blocking manner — and throws
// SYNCHRONOUS_PROSIME_EXPECTED when handed a real async promise whose `.then`
// defers. Pure helper behaviour: no connection, no database.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { SynchronousPromise } from 'synchronous-promise'
import { sync } from '../../../../../src/extras/sync.js'
import { TsSqlProcessingError } from '../../../../../src/TsSqlError.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs-extra:synchronous-query-runners/sync-unwraps-a-synchronously-resolved-promise', () => {
        // SynchronousPromise resolves without deferring `.then`, so `sync`
        // unwraps the value in a blocking manner, just like `await` would.
        const value = sync(SynchronousPromise.resolve(42))
        expect(value).toBe(42)
    })

    test('docs-extra:synchronous-query-runners/sync-propagates-a-synchronous-rejection', () => {
        // A synchronous rejection is re-thrown by `sync` unchanged (not
        // wrapped in a TsSqlProcessingError — that is reserved for the
        // not-resolved-synchronously case below).
        const boom = new Error('boom')
        expect(() => sync(SynchronousPromise.reject(boom))).toThrow(boom)
    })

    test('docs-extra:synchronous-query-runners/sync-throws-on-a-real-async-promise', () => {
        // A native Promise defers `.then`, so neither result nor error is set
        // by the time `.then(...)` returns — the guard fires with the
        // SYNCHRONOUS_PROSIME_EXPECTED reason.
        let caught: unknown
        try {
            sync(Promise.resolve(1))
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(TsSqlProcessingError)
        expect(caught instanceof TsSqlProcessingError ? caught.errorReason.reason : undefined)
            .toBe('SYNCHRONOUS_PROSIME_EXPECTED')
    })
})
