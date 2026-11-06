// A function of after next commit that fails in the commit of a nested transaction: the
// inner transaction has ended, so the outer one goes on with its functions and its metadata.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlQueryExecutionError } from '../../../../../src/TsSqlError.js'
import { sync } from '../../../../../src/extras/sync.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('the-outer-transaction-goes-on', () => {
        // MOCK-ONLY: nested transactions depend on the query runner, and the mock offers them on every connector.
        ctx.mockOnlyConnection()
        const { conn } = ctx.withFaultInjection()
        const events: string[] = []

        sync(conn.beginTransaction())
        conn.executeAfterNextCommit(() => { events.push('outer') })
        conn.getTransactionMetadata().set('level', 'outer')

        sync(conn.beginTransaction())
        conn.executeAfterNextCommit(() => { throw new Error('inner failure') })
        let caught: unknown
        try {
            sync(conn.commit())
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)

        expect(conn.getTransactionMetadata().get('level')).toBe('outer')
        conn.executeAfterNextCommit(() => { events.push('outer 2') })
        sync(conn.commit())
        expect(events).toEqual(['outer', 'outer 2'])
        expect(conn.isTransactionActive()).toBe(false)
    })
})
