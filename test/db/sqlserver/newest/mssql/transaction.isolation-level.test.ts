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
import type { TransactionIsolationLevel } from '../../../../../src/Connection.js'
import { ctx } from './setup.js'

async function runReadOnlyTransaction(isolation: TransactionIsolationLevel): Promise<number | null> {
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
        // (SqlServerConnection.ts:37).
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('serializable'))
        expect(ctx.lastTransactionOpts).toEqual(['serializable'])
        expect(result).toBe(1)
    })

    // Bodies kept verbatim (from the pg/mysql cells) for cross-cell diff parity.
    // NOT-APPLICABLE: SQL Server's `isolationLevel` takes only a level, no access mode, so neither the level+accessMode form nor the access-mode-only form exists.
    /*
    test('isolation-level-with-access-mode-builds-pair-opts', async () => {
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('repeatable read', 'read write'))
        expect(ctx.lastTransactionOpts).toEqual(['repeatable read', 'read write'])
        expect(result).toBe(1)
    })
    */

    // Bodies kept verbatim (from the pg/mysql cells) for cross-cell diff parity.
    // NOT-APPLICABLE: SQL Server's `isolationLevel` takes only a level, no access mode, so neither the level+accessMode form nor the access-mode-only form exists.
    /*
    test('isolation-access-mode-only-builds-access-mode-opts', async () => {
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read only'))
        expect(ctx.lastTransactionOpts).toEqual([undefined, undefined])
        expect(result).toBe(1)
    })
    */

    // Per-level / per-access-mode coverage of the isolation table on
    // docs/queries/transaction.md. Each `<db>` cell runs the levels and
    // access modes its engine supports and comments out the rest as
    // NOT-APPLICABLE (kept verbatim per the symmetry rule). SQL Server
    // supports every isolation level (READ UNCOMMITTED, READ COMMITTED,
    // REPEATABLE READ, SNAPSHOT, SERIALIZABLE) but no access modes — its
    // `isolationLevel` overload takes only a level.

    test('isolation-level-read-uncommitted-builds-level-opts', async () => {
        // `isolationLevel('read uncommitted')` → opts `['read uncommitted']`.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read uncommitted'))
        expect(ctx.lastTransactionOpts).toEqual(['read uncommitted'])
        expect(result).toBe(1)
    })

    test('isolation-level-read-committed-builds-level-opts', async () => {
        // `isolationLevel('read committed')` → opts `['read committed']`
        // (the engine default made explicit).
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read committed'))
        expect(ctx.lastTransactionOpts).toEqual(['read committed'])
        expect(result).toBe(1)
    })

    test('isolation-level-repeatable-read-builds-level-opts', async () => {
        // `isolationLevel('repeatable read')` → opts `['repeatable read']`.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('repeatable read'))
        expect(ctx.lastTransactionOpts).toEqual(['repeatable read'])
        expect(result).toBe(1)
    })

    // NOT-APPLICABLE: `'snapshot'` type-checks on SQL Server but needs the
    // database-level ALLOW_SNAPSHOT_ISOLATION option, which the test database
    // does not enable — so the level cannot be exercised here.
    /*
    test('isolation-level-snapshot-builds-level-opts', async () => {
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('snapshot'))
        expect(ctx.lastTransactionOpts).toEqual(['snapshot'])
        expect(result).toBe(1)
    })
    */

    // NOT-APPLICABLE: SQL Server's `isolationLevel` takes only a level — no
    // access-mode overload — so `isolationLevel('read write')` does not
    // type-check. Body kept verbatim for cross-cell diff parity.
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
})
