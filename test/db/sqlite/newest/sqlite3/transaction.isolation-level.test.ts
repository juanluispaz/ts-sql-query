// Coverage of `connection.isolationLevel(...)` on the other dialects —
// see the pg / mysql / mariadb / oracle / sqlserver cells for the
// active bodies.
//
// Not applicable on SQLite: `SqliteConnection` does not define
// `isolationLevel(...)`. SQLite has a single, implicit "serializable"
// transaction mode and no `SET TRANSACTION` access-mode support
// (`SqlTransactionQueryRunner.getTransactionAccessMode` throws
// `TRANSACTION_ACCESS_MODE_NOT_SUPPORTED` for sqlite). The bodies below
// are kept verbatim (from the pg cell) for cross-cell diff parity per
// the symmetry rule.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    /*
    test('isolation-level-only-builds-level-opts', async () => {
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('serializable'))
        expect(ctx.lastTransactionOpts).toEqual(['serializable'])
        expect(result).toBe(1)
    })

    test('isolation-level-with-access-mode-builds-pair-opts', async () => {
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('repeatable read', 'read write'))
        expect(ctx.lastTransactionOpts).toEqual(['repeatable read', 'read write'])
        expect(result).toBe(1)
    })

    test('isolation-access-mode-only-builds-access-mode-opts', async () => {
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read only'))
        expect(ctx.lastTransactionOpts).toEqual([undefined, undefined])
        expect(result).toBe(1)
    })
    */
})
