// Coverage of `connection.isolationLevel(...)` — the per-connection
// builder that turns an isolation level / access mode into the
// `TransactionIsolationLevel` opts passed to `transaction(...)` /
// `beginTransaction(...)`. The three overload branches
// (MySqlConnection.ts:53-63) were entirely uncovered: the only
// isolation test in the suite (docs.transaction `isolation-level`) is
// commented out because its canonical body uses a SQLite-incompatible
// form.
//
// Each test runs a read-only transaction with the built isolation and
// asserts:
//   - `ctx.lastTransactionOpts` — the array `isolationLevel(...)` built,
//     captured at the `CaptureInterceptor` layer BEFORE any per-runner
//     handling, so the assertion is mode-agnostic and works for every
//     connector (including the ones whose real-DB runner manages the
//     transaction internally — Porsager's `postgres`, Bun's `sql`,
//     `oracledb`'s autocommit flip — which never fire the
//     `beginTransaction` query type the `ctx.history` entry depends on).
//   - the transaction result.
//
// Not applicable on SQLite (no `isolationLevel` on SqliteConnection).
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
        // (MySqlConnection.ts:62, the level-only branch).
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('serializable'))
        expect(ctx.lastTransactionOpts).toEqual(['serializable'])
        expect(result).toBe(1)
    })

    test('isolation-level-with-access-mode-builds-pair-opts', async () => {
        // `isolationLevel('repeatable read', 'read write')` → opts
        // `['repeatable read', 'read write']` (the level+accessMode
        // branch, MySqlConnection.ts:60).
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('repeatable read', 'read write'))
        expect(ctx.lastTransactionOpts).toEqual(['repeatable read', 'read write'])
        expect(result).toBe(1)
    })

    test('isolation-access-mode-only-builds-access-mode-opts', async () => {
        // The single-arg access-mode overload (MySqlConnection.ts:58)
        // — opts `[undefined, 'read only']`, matching Oracle's body.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read only'))
        expect(ctx.lastTransactionOpts).toEqual([undefined, 'read only'])
        expect(result).toBe(1)
    })

    // Per-level / per-access-mode coverage of the isolation table on
    // docs/queries/transaction.md. Each `<db>` cell runs the levels and
    // access modes its engine supports and comments out the rest as
    // NOT-APPLICABLE (kept verbatim per the symmetry rule). PostgreSQL
    // supports every level in the table except `snapshot` (SQL-Server only)
    // and both access modes.

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

    // NOT-APPLICABLE: `'snapshot'` is only typed on SqlServerConnection (off
    // SQL Server it does not type-check) and even there needs the DB-level
    // ALLOW_SNAPSHOT_ISOLATION option, so it cannot run in this matrix.
    /*
    test('isolation-level-snapshot-builds-level-opts', async () => {
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('snapshot'))
        expect(ctx.lastTransactionOpts).toEqual(['snapshot'])
        expect(result).toBe(1)
    })
    */

    test('access-mode-read-write-builds-access-mode-opts', async () => {
        // The single-arg access-mode overload with `'read write'` (the
        // engine default made explicit) — opts `[undefined, 'read write']`.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read write'))
        expect(ctx.lastTransactionOpts).toEqual([undefined, 'read write'])
        expect(result).toBe(1)
    })

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
