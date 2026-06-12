// Coverage of `connection.isolationLevel(...)` — the per-connection
// builder that turns an isolation level / access mode into the
// opts passed to `transaction(...)` / `beginTransaction(...)`. The three
// overload branches (level-only, level+accessMode, accessMode-only).
//
// Each test runs a read-only transaction with the built isolation and
// asserts:
//   - `ctx.lastTransactionOpts` — the array `isolationLevel(...)` built,
//     captured BEFORE any per-runner handling, so the assertion works for
//     every connector (including the ones whose real-DB runner manages
//     the transaction internally and never fire a `beginTransaction`
//     query).
//   - the transaction result.
//
// Docs: docs/queries/transaction.md (section "Transaction isolation").

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

type IsolationOpts = ReturnType<typeof ctx.conn.isolationLevel>

async function runReadOnlyTransaction(isolation: IsolationOpts): Promise<number | null> {
    const connection = ctx.conn
    return await connection.transaction(async () => {
        return await connection.selectFromNoTable()
            .selectOneColumn(connection.const(1, 'int'))
            .executeSelectOne()
    }, isolation)
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('isolation-level-only-builds-level-opts', async () => {
        // `isolationLevel('serializable')` → opts `['serializable']`
        // (the level-only branch).
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('serializable'))
        expect(ctx.lastTransactionOpts).toEqual(['serializable'])
        expect(result).toBe(1)
    })

    test('isolation-level-with-access-mode-builds-pair-opts', async () => {
        // `isolationLevel('repeatable read', 'read write')` → opts
        // `['repeatable read', 'read write']` (the level+accessMode
        // branch).
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('repeatable read', 'read write'))
        expect(ctx.lastTransactionOpts).toEqual(['repeatable read', 'read write'])
        expect(result).toBe(1)
    })

    test('isolation-access-mode-only-builds-access-mode-opts', async () => {
        // The single-arg access-mode overload — opts
        // `[undefined, 'read only']`.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read only'))
        expect(ctx.lastTransactionOpts).toEqual([undefined, 'read only'])
        expect(result).toBe(1)
    })
})
