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
        // The single-arg access-mode overload (MySqlConnection.ts:58).
        // TODO[BUG]: see test/BUGS.md — on pg/mysql/mariadb this branch
        // returns `[undefined, accessMode]` reading the (undefined)
        // second parameter, so the access mode is dropped and the opts
        // come back `[undefined, undefined]` instead of
        // `[undefined, 'read only']`. Pinned as-is to document current
        // behaviour; Oracle's cell pins the correct value.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read only'))
        expect(ctx.lastTransactionOpts).toEqual([undefined, undefined])
        expect(result).toBe(1)
    })
})
