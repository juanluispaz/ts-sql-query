// Documentation behaviour for the Synchronous query runners page
// (docs/advanced/synchronous-query-runners.md). Covers the `sync()` helper
// contract from `ts-sql-query/extras/sync`: it unwraps a promise that has
// resolved synchronously (the shape `synchronous-promise` produces with a
// synchronous query runner) in a blocking manner — and throws
// SYNCHRONOUS_PROMISE_EXPECTED when handed a real async promise whose `.then`
// defers. Pure helper behaviour: no connection, no database.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { SynchronousPromise } from 'synchronous-promise'
import { sync } from '../../../../../src/extras/sync.js'
import { TsSqlProcessingError } from '../../../../../src/TsSqlError.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { ConsoleLogNoopQueryRunner } from '../../../../../src/queryRunners/ConsoleLogNoopQueryRunner.js'
import { InterceptorQueryRunner } from '../../../../../src/queryRunners/InterceptorQueryRunner.js'
import { LoggingQueryRunner } from '../../../../../src/queryRunners/LoggingQueryRunner.js'
import { MockQueryRunner } from '../../../../../src/queryRunners/MockQueryRunner.js'
import { NoopQueryRunner } from '../../../../../src/queryRunners/NoopQueryRunner.js'
import { DBConnection, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

class NothingInterceptor extends InterceptorQueryRunner<boolean> {
    onQuery(): boolean {
        return true
    }
    onQueryResult(): void {
    }
    onQueryError(): void {
    }
}

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
        // SYNCHRONOUS_PROMISE_EXPECTED reason.
        let caught: unknown
        try {
            sync(Promise.resolve(1))
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(TsSqlProcessingError)
        expect(caught instanceof TsSqlProcessingError ? caught.errorReason.reason : undefined)
            .toBe('SYNCHRONOUS_PROMISE_EXPECTED')
    })

    // MOCK-ONLY: the synchronous promise comes from the option of the runner; a connector's own runner here may be asynchronous.
    test('docs:synchronous-query-runners/usage-example', () => {
        const runner = new MockQueryRunner(() => [{ id: 1, name: 'Acme Corp' }], { promise: SynchronousPromise })
        const connection = new DBConnection(runner, Number.POSITIVE_INFINITY)

        // doc-start
        const selectCompanies = sync(
            connection.selectFrom(tOrganization)
                .where(tOrganization.id.equals(1))
                .select({
                    id:   tOrganization.id,
                    name: tOrganization.name,
                })
                .executeSelectMany()
        )
        // doc-end

        assertType<Exact<typeof selectCompanies, Array<{ id: number; name: string }>>>()
        expect(selectCompanies).toEqual([{ id: 1, name: 'Acme Corp' }])
    })

    // MOCK-ONLY: the wrapped runner is the mock so that the synchronous promise reaches the wrapper in every cell.
    test('docs-extra:synchronous-query-runners/general-purpose-runners-honour-synchronous-promise', () => {
        const mock = () => new MockQueryRunner(() => [{ id: 1 }], { promise: SynchronousPromise })
        const select = (connection: DBConnection) => sync(
            connection.selectFrom(tOrganization)
                .where(tOrganization.id.equals(1))
                .select({ id: tOrganization.id })
                .executeSelectMany()
        )

        expect(select(new DBConnection(new NothingInterceptor(mock()), Number.POSITIVE_INFINITY))).toEqual([{ id: 1 }])
        expect(select(new DBConnection(new LoggingQueryRunner({}, mock()), Number.POSITIVE_INFINITY))).toEqual([{ id: 1 }])
        expect(select(new DBConnection(new ConsoleLogNoopQueryRunner({ promise: SynchronousPromise }), Number.POSITIVE_INFINITY))).toEqual([])
        expect(select(new DBConnection(new NoopQueryRunner({ promise: SynchronousPromise }), Number.POSITIVE_INFINITY))).toEqual([])
    })
})
