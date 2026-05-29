// Coverage of `connection.isolationLevel(...)` — the per-connection
// builder that turns an isolation level into the
// `TransactionIsolationLevel` opts passed to `transaction(...)` /
// `beginTransaction(...)`. It was entirely uncovered: the only
// isolation test in the suite (docs.transaction `isolation-level`) is
// commented out because its canonical body uses a SQLite-incompatible
// form.
//
// The test runs a read-only transaction with the built isolation and
// asserts `ctx.lastTransactionOpts` — the array `isolationLevel(...)`
// built, captured at the `CaptureInterceptor` layer BEFORE any
// per-runner handling, so the assertion is mode-agnostic.
//
// SqlServerConnection.isolationLevel (SqlServerConnection.ts:36-38) takes
// only an isolation level — no access mode — and its body is a single
// `return [level]`, so the level-only test fully covers it (a
// `'snapshot'` variant would hit the same line and additionally needs
// the database-level ALLOW_SNAPSHOT_ISOLATION option, so it is not run).
// Docs: docs/queries/transaction.md (section "Transaction isolation").

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

async function runReadOnlyTransaction(isolation: unknown): Promise<number | null> {
    const connection = ctx.conn
    return await connection.transaction(async () => {
        return await connection.selectFromNoTable()
            .selectOneColumn(connection.const(1, 'int'))
            .executeSelectOne()
    }, isolation as any)
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('isolation-level-only-builds-level-opts', async () => {
        // `isolationLevel('serializable')` → opts `['serializable']`
        // (SqlServerConnection.ts:37).
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('serializable'))
        expect(ctx.lastTransactionOpts).toEqual(['serializable'])
        expect(result).toBe(1)
    })

    // Not applicable on SQL Server: `isolationLevel` takes no access
    // mode, so neither the level+accessMode form nor the access-mode-only
    // form exists. Bodies kept verbatim (from the pg/mysql cells) for
    // cross-cell diff parity.
    /*
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
