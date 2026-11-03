// Coverage of `connection.isolationLevel(...)` — the per-connection
// builder that turns an isolation level / access mode into the opts passed
// to `transaction(...)` / `beginTransaction(...)` — and of the level each
// one becomes on the database.
//
// ts-sql-query names the levels with the SQL standard's words, plus
// `snapshot` for every read seeing the database as of one moment, and
// translates each one to the words this database uses; a level the
// database does not deliver is not offered. Two families of tests:
//   - `*-builds-*-opts`: the opts `isolationLevel(...)` built —
//     `ctx.lastTransactionOpts`, captured BEFORE any per-runner handling,
//     so the assertion works for every connector — and the transaction
//     result.
//   - `*-is-active-on-the-database`: inside the transaction, the database's
//     own report of the isolation level the running transaction has, which
//     proves the translation reached the database.
//
// Docs: docs/queries/transaction.md (section "Transaction isolation").

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

// The isolation level the connection of this cell builds
type IsolationLevel = ReturnType<typeof ctx.conn.isolationLevel>

async function runReadOnlyTransaction(isolation: IsolationLevel): Promise<number | null> {
    const connection = ctx.conn
    return await connection.transaction(async () => {
        return await connection.selectFromNoTable()
            .selectOneColumn(connection.const(1, 'int'))
            .executeSelectOne()
    }, isolation)
}

// The isolation level the database reports for the transaction this runs in.
async function activeIsolationLevel(isolation: IsolationLevel): Promise<string> {
    const connection = ctx.conn
    return await connection.transaction(async () => {
        return await connection.selectFromNoTable()
            .selectOneColumn(connection.fragmentWithType('string', 'required').sql`(select isolation_level from performance_schema.events_transactions_current where thread_id = (select thread_id from performance_schema.threads where processlist_id = connection_id()))`)
            .executeSelectOne()
    }, isolation)
}

void activeIsolationLevel

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('isolation-level-only-builds-level-opts', async () => {
        // `isolationLevel('read committed')` → opts `['read committed']`
        // (the level-only branch).
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read committed'))
        expect(ctx.lastTransactionOpts).toEqual(['read committed'])
        expect(result).toBe(1)
    })

    test('isolation-level-with-access-mode-builds-pair-opts', async () => {
        // `isolationLevel('snapshot', 'read write')` → opts
        // `['snapshot', 'read write']` (the level+accessMode branch).
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('snapshot', 'read write'))
        expect(ctx.lastTransactionOpts).toEqual(['snapshot', 'read write'])
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

    // One test per level of the isolation table on
    // docs/queries/transaction.md: the opts it builds, and the level the
    // running transaction has on the database.

    test('isolation-level-read-uncommitted-builds-level-opts', async () => {
        // `isolationLevel('read uncommitted')` → opts `['read uncommitted']`.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read uncommitted'))
        expect(ctx.lastTransactionOpts).toEqual(['read uncommitted'])
        expect(result).toBe(1)
    })

    // Body kept verbatim for cross-cell diff parity.
    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — MariaDB has no SQL that reports the running transaction's isolation level: `@@transaction_isolation` is the session's, which `SET TRANSACTION` does not change, INFORMATION_SCHEMA.INNODB_TRX is a cache refreshed every 0.1 s, and performance_schema is disabled by default.
    /*
    test('isolation-level-read-uncommitted-is-active-on-the-database', async () => {
        // The running transaction reports the level `'read uncommitted'` became on
        // this database.
        ctx.mockNext('READ UNCOMMITTED')
        const level = await activeIsolationLevel(ctx.conn.isolationLevel('read uncommitted'))
        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"select (select isolation_level from performance_schema.events_transactions_current where thread_id = (select thread_id from performance_schema.threads where processlist_id = connection_id())) as result"`)
        expect(level).toBe('READ UNCOMMITTED')
    })
    */

    test('isolation-level-read-committed-builds-level-opts', async () => {
        // `isolationLevel('read committed')` → opts `['read committed']`.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read committed'))
        expect(ctx.lastTransactionOpts).toEqual(['read committed'])
        expect(result).toBe(1)
    })

    // Body kept verbatim for cross-cell diff parity.
    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — MariaDB has no SQL that reports the running transaction's isolation level: `@@transaction_isolation` is the session's, which `SET TRANSACTION` does not change, INFORMATION_SCHEMA.INNODB_TRX is a cache refreshed every 0.1 s, and performance_schema is disabled by default.
    /*
    test('isolation-level-read-committed-is-active-on-the-database', async () => {
        // The running transaction reports the level `'read committed'` became on
        // this database.
        ctx.mockNext('READ COMMITTED')
        const level = await activeIsolationLevel(ctx.conn.isolationLevel('read committed'))
        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"select (select isolation_level from performance_schema.events_transactions_current where thread_id = (select thread_id from performance_schema.threads where processlist_id = connection_id())) as result"`)
        expect(level).toBe('READ COMMITTED')
    })
    */

    // Body kept verbatim for cross-cell diff parity.
    // NOT-APPLICABLE: this database's `REPEATABLE READ` is a snapshot, more than the standard's `repeatable read` promises, so it is offered as `snapshot` and `isolationLevel('repeatable read')` does not type-check here.
    /*
    test('isolation-level-repeatable-read-builds-level-opts', async () => {
        // `isolationLevel('repeatable read')` → opts `['repeatable read']`.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('repeatable read'))
        expect(ctx.lastTransactionOpts).toEqual(['repeatable read'])
        expect(result).toBe(1)
    })
    */

    // Body kept verbatim for cross-cell diff parity.
    // NOT-APPLICABLE: this database's `REPEATABLE READ` is a snapshot, more than the standard's `repeatable read` promises, so it is offered as `snapshot` and `isolationLevel('repeatable read')` does not type-check here.
    /*
    test('isolation-level-repeatable-read-is-active-on-the-database', async () => {
        // The running transaction reports the level `'repeatable read'` became on
        // this database.
        ctx.mockNext('REPEATABLE READ')
        const level = await activeIsolationLevel(ctx.conn.isolationLevel('repeatable read'))
        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"select (select isolation_level from performance_schema.events_transactions_current where thread_id = (select thread_id from performance_schema.threads where processlist_id = connection_id())) as result"`)
        expect(level).toBe('REPEATABLE READ')
    })
    */

    test('isolation-level-snapshot-builds-level-opts', async () => {
        // `isolationLevel('snapshot')` → opts `['snapshot']`.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('snapshot'))
        expect(ctx.lastTransactionOpts).toEqual(['snapshot'])
        expect(result).toBe(1)
    })

    // Body kept verbatim for cross-cell diff parity.
    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — MariaDB has no SQL that reports the running transaction's isolation level: `@@transaction_isolation` is the session's, which `SET TRANSACTION` does not change, INFORMATION_SCHEMA.INNODB_TRX is a cache refreshed every 0.1 s, and performance_schema is disabled by default.
    /*
    test('isolation-level-snapshot-is-active-on-the-database', async () => {
        // The running transaction reports the level `'snapshot'` became on
        // this database.
        ctx.mockNext('REPEATABLE READ')
        const level = await activeIsolationLevel(ctx.conn.isolationLevel('snapshot'))
        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"select (select isolation_level from performance_schema.events_transactions_current where thread_id = (select thread_id from performance_schema.threads where processlist_id = connection_id())) as result"`)
        expect(level).toBe('REPEATABLE READ')
    })
    */

    test('isolation-level-serializable-builds-level-opts', async () => {
        // `isolationLevel('serializable')` → opts `['serializable']`.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('serializable'))
        expect(ctx.lastTransactionOpts).toEqual(['serializable'])
        expect(result).toBe(1)
    })

    // Body kept verbatim for cross-cell diff parity.
    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — MariaDB has no SQL that reports the running transaction's isolation level: `@@transaction_isolation` is the session's, which `SET TRANSACTION` does not change, INFORMATION_SCHEMA.INNODB_TRX is a cache refreshed every 0.1 s, and performance_schema is disabled by default.
    /*
    test('isolation-level-serializable-is-active-on-the-database', async () => {
        // The running transaction reports the level `'serializable'` became on
        // this database.
        ctx.mockNext('SERIALIZABLE')
        const level = await activeIsolationLevel(ctx.conn.isolationLevel('serializable'))
        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"select (select isolation_level from performance_schema.events_transactions_current where thread_id = (select thread_id from performance_schema.threads where processlist_id = connection_id())) as result"`)
        expect(level).toBe('SERIALIZABLE')
    })
    */

    test('access-mode-read-write-builds-access-mode-opts', async () => {
        // The single-arg access-mode overload with `'read write'` (the
        // default made explicit) — opts `[undefined, 'read write']`.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('read write'))
        expect(ctx.lastTransactionOpts).toEqual([undefined, 'read write'])
        expect(result).toBe(1)
    })

    test('begin-transaction-with-isolation-level-builds-opts', async () => {
        // The docs show the isolation argument on BOTH `transaction(fn, iso)`
        // (the tests above) and the low-level `beginTransaction(iso)`. This
        // pins the low-level form.
        ctx.mockNext(1)
        const connection = ctx.conn
        let result: number | null = null

        await connection.beginTransaction(connection.isolationLevel('read committed'))
        try {
            result = await connection.selectFromNoTable()
                .selectOneColumn(connection.const(1, 'int'))
                .executeSelectOne()
            await connection.commit()
        } catch (e) {
            await connection.rollback()
            throw e
        }

        expect(ctx.lastTransactionOpts).toEqual(['read committed'])
        expect(result).toBe(1)
    })

    test('isolation-level-with-read-only-access-mode-builds-pair-opts', async () => {
        // The level+accessMode branch with the `'read only'` access mode:
        // `isolationLevel('snapshot', 'read only')` → opts
        // `['snapshot', 'read only']`; the transaction body is a plain SELECT,
        // so the read-only mode is accepted.
        ctx.mockNext(1)
        const result = await runReadOnlyTransaction(ctx.conn.isolationLevel('snapshot', 'read only'))
        expect(ctx.lastTransactionOpts).toEqual(['snapshot', 'read only'])
        expect(result).toBe(1)
    })
})
