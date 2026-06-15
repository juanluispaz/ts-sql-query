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

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: SqliteConnection does not define `isolationLevel(...)`
    // (single implicit serializable mode, no SET TRANSACTION access-mode
    // support), so these bodies cannot run.
    /*
    test('isolation-level-only-builds-level-opts', async () => {
        // `isolationLevel('serializable')` → opts `['serializable']`
        // (the level-only branch).
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('serializable'))
        expect(ctx.lastTransactionOpts).toEqual(['serializable'])
        expect(result).toBe(1)
    })
    */

    // NOT-APPLICABLE: SqliteConnection does not define `isolationLevel(...)`
    // (single implicit serializable mode, no SET TRANSACTION access-mode
    // support), so these bodies cannot run.
    /*
    test('isolation-level-with-access-mode-builds-pair-opts', async () => {
        // `isolationLevel('repeatable read', 'read write')` → opts
        // `['repeatable read', 'read write']` (the level+accessMode
        // branch).
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('repeatable read', 'read write'))
        expect(ctx.lastTransactionOpts).toEqual(['repeatable read', 'read write'])
        expect(result).toBe(1)
    })
    */

    // NOT-APPLICABLE: SqliteConnection does not define `isolationLevel(...)`
    // (single implicit serializable mode, no SET TRANSACTION access-mode
    // support), so these bodies cannot run.
    /*
    test('isolation-access-mode-only-builds-access-mode-opts', async () => {
        // The single-arg access-mode overload — opts
        // `[undefined, 'read only']`.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read only'))
        expect(ctx.lastTransactionOpts).toEqual([undefined, undefined])
        expect(result).toBe(1)
    })
    */

    // NOT-APPLICABLE: SqliteConnection has no `isolationLevel(...)` (single
    // implicit serializable mode, no access-mode support), so none of these
    // per-level / per-access-mode bodies can run. Kept verbatim for parity.
    /*
    test('isolation-level-read-uncommitted-builds-level-opts', async () => {
        // `isolationLevel('read uncommitted')` → opts `['read uncommitted']`.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read uncommitted'))
        expect(ctx.lastTransactionOpts).toEqual(['read uncommitted'])
        expect(result).toBe(1)
    })
    */

    // NOT-APPLICABLE: SqliteConnection has no `isolationLevel(...)` (single
    // implicit serializable mode, no access-mode support), so none of these
    // per-level / per-access-mode bodies can run. Kept verbatim for parity.
    /*
    test('isolation-level-read-committed-builds-level-opts', async () => {
        // `isolationLevel('read committed')` → opts `['read committed']`
        // (the engine default made explicit).
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read committed'))
        expect(ctx.lastTransactionOpts).toEqual(['read committed'])
        expect(result).toBe(1)
    })
    */

    // NOT-APPLICABLE: SqliteConnection has no `isolationLevel(...)` (single
    // implicit serializable mode, no access-mode support), so none of these
    // per-level / per-access-mode bodies can run. Kept verbatim for parity.
    /*
    test('isolation-level-repeatable-read-builds-level-opts', async () => {
        // `isolationLevel('repeatable read')` → opts `['repeatable read']`.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('repeatable read'))
        expect(ctx.lastTransactionOpts).toEqual(['repeatable read'])
        expect(result).toBe(1)
    })
    */

    // NOT-APPLICABLE: SqliteConnection has no `isolationLevel(...)` (single
    // implicit serializable mode, no access-mode support), so none of these
    // per-level / per-access-mode bodies can run. Kept verbatim for parity.
    /*
    test('isolation-level-snapshot-builds-level-opts', async () => {
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('snapshot'))
        expect(ctx.lastTransactionOpts).toEqual(['snapshot'])
        expect(result).toBe(1)
    })
    */

    // NOT-APPLICABLE: SqliteConnection has no `isolationLevel(...)` (single
    // implicit serializable mode, no access-mode support), so none of these
    // per-level / per-access-mode bodies can run. Kept verbatim for parity.
    /*
    test('access-mode-read-write-builds-access-mode-opts', async () => {
        // The single-arg access-mode overload with `'read write'` (the
        // engine default made explicit) — opts `[undefined, 'read write']`.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read write'))
        expect(ctx.lastTransactionOpts).toEqual([undefined, 'read write'])
        expect(result).toBe(1)
    })
    */

    // NOT-APPLICABLE: SqliteConnection has no `isolationLevel(...)` (single
    // implicit serializable mode, no access-mode support), so none of these
    // per-level / per-access-mode bodies can run. Kept verbatim for parity.
    /*
    test('begin-transaction-with-isolation-level-builds-opts', async () => {
        // The docs show the isolation argument on BOTH `transaction(fn, iso)`
        // (the tests above) and the low-level `beginTransaction(iso)`. This
        // pins the low-level form. `serializable` is the one level every
        // dialect in the table supports, so the real-DB begin succeeds.
        ctx.mockNext(1)
        const connection = ctx.conn
        let result: number | null = null

        await connection.beginTransaction(connection.isolationLevel('serializable'))
        try {
            result = await connection.selectFromNoTable()
                .selectOneColumn(connection.const(1, 'int'))
                .executeSelectOne()
            await connection.commit()
        } catch (e) {
            await connection.rollback()
            throw e
        }

        expect(ctx.lastTransactionOpts).toEqual(['serializable'])
        expect(result).toBe(1)
    })
    */
})
