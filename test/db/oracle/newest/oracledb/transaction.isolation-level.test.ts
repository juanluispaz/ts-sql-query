// Coverage of `connection.isolationLevel(...)` — the per-connection
// builder that turns an isolation level / access mode into the
// `TransactionIsolationLevel` opts passed to `transaction(...)` /
// `beginTransaction(...)`. The overload branches
// (OracleConnection.ts:50-56) were entirely uncovered: the only
// isolation test in the suite (docs.transaction `isolation-level`) is
// commented out because its canonical body uses a SQLite-incompatible
// form.
//
// Each test runs a read-only transaction with the built isolation and
// asserts:
//   - `ctx.lastTransactionOpts` — the array `isolationLevel(...)` built,
//     captured at the `CaptureInterceptor` layer BEFORE any per-runner
//     handling, so the assertion is mode-agnostic (the `oracledb`
//     runner's autocommit flip means no `beginTransaction` query type
//     reaches the interceptor, hence `ctx.history` is intentionally not
//     used).
//   - the transaction result.
//
// Oracle rejects an isolation level and an access mode in the same
// `SET TRANSACTION`, so OracleConnection exposes only the level-only
// and the access-mode-only overloads (no combined form). Docs:
// docs/queries/transaction.md (section "Transaction isolation").

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
        // (the level-only form).
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('serializable'))
        expect(ctx.lastTransactionOpts).toEqual(['serializable'])
        expect(result).toBe(1)
    })

    // Body kept verbatim (from the pg/mysql cells) for cross-cell diff parity.
    // NOT-APPLICABLE: Oracle takes an isolation level OR an access mode, not
    // both — `isolationLevel` has no level+accessMode overload.
    /*
    test('isolation-level-with-access-mode-builds-pair-opts', async () => {
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('repeatable read', 'read write'))
        expect(ctx.lastTransactionOpts).toEqual(['repeatable read', 'read write'])
        expect(result).toBe(1)
    })
    */

    test('isolation-access-mode-only-builds-access-mode-opts', async () => {
        // The single-arg access-mode form — opts `[undefined, 'read only']`,
        // emitting `set transaction read only` on real Oracle.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read only'))
        expect(ctx.lastTransactionOpts).toEqual([undefined, 'read only'])
        expect(result).toBe(1)
    })
})
