// Coverage of `connection.sequence(name, type).nextValue()` and
// `.currentValue()` — the [SequenceQueryBuilder](../../../../../src/queryBuilders/SequenceQueryBuilder.ts)
// is otherwise dead code (no other test wave instantiates it). The
// dispatcher just constructs a `SequenceValueSource` tagged with
// `_nextSequenceValue` / `_currentSequenceValue`, which each dialect's
// SqlBuilder renders via its overridable
// [`_nextSequenceValue`](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L1907)
// / `_currentSequenceValue` pair:
//
//   - PostgreSQL: `nextval('seq')` / `currval('seq')`
//     ([AbstractSqlBuilder defaults](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L1907))
//   - Oracle: `"seq".nextval` / `"seq".currval`
//   - SQL Server: `next value for seq` / `(select current_value from sys.sequences …)`
//   - MariaDB ≥ 10.3: `nextval(seq)` / `lastval(seq)`
//
// MySQL and SQLite have no `CREATE SEQUENCE` and the `sequence()` API
// isn't exposed at the type level (`SqliteConnection` / `MySqlConnection`
// don't inherit from `AbstractAdvancedConnection`; see
// [docs/api/connection.md](../../../../../docs/api/connection.md)).
// Their mirror files keep the suite in `/* */` blocks for cross-cell
// symmetry per DESIGN §4.
//
// The two sequence references the tests use (`issueIdSeq`,
// `auditTagSeq`) are declared on the shared
// [`DBConnection`](../../domain/connection.ts) — the per-dialect
// connection class that already extends `AbstractAdvancedConnection`
// for these four dialects.
//
// Each test wraps its body in `ctx.withCommit(...)` for two reasons:
//   1. The transaction `withCommit` opens pins one backend session,
//      so the `currval` / `lastval` call sees the prior `nextval`
//      (those functions are session-scoped on PG / Oracle / MariaDB).
//   2. The trailing reseed resets the sequence counters that
//      `nextval()` bumps. Sequences are non-transactional on every
//      supported engine, so a `withRollback` would leave the bump
//      behind — and the implicit sequence behind `issue.id` would
//      then shift every subsequent insert id.

import { afterAll, beforeAll, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)

    // NOT-APPLICABLE: SQLite has no CREATE SEQUENCE DDL and SqliteConnection
    // does not expose `connection.sequence(...)`, so these bodies cannot run.
    /*
    import { test, expect, beforeEach } from '../../../../lib/testRunner.js'
    beforeEach(() => { ctx.reset() })

    test('sequence-next-value-in-select', async () => {
        // `seq.nextValue()` returns a SequenceValueSource tagged
        // `_nextSequenceValue`; SelectQueryBuilder dispatches it
        // through the dialect's `_nextSequenceValue(...)` override.
        ctx.mockNext(42)
        const next = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.issueIdSeq.nextValue())
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        if (!ctx.realDbEnabled) expect(next).toBe(42)
        else expect(typeof next).toBe('number')
    })
    */

    // NOT-APPLICABLE: SQLite has no CREATE SEQUENCE DDL and SqliteConnection
    // does not expose `connection.sequence(...)`, so these bodies cannot run.
    /*
    test('sequence-current-value-in-select', async () => {
        // `seq.currentValue()` mirrors nextValue but dispatches to
        // `_currentSequenceValue` - SQL Server emits an embedded
        // sys.sequences subquery; the other dialects emit the
        // engine's dedicated function. On PG/Oracle/MariaDB,
        // currval/lastval requires nextval to have been called in
        // the same session, so we call nextValue first when running
        // real-DB.
        if (ctx.realDbEnabled) {
            await ctx.conn.selectFromNoTable()
                .selectOneColumn(ctx.conn.issueIdSeq.nextValue())
                .executeSelectOne()
        }
        ctx.mockNext(41)
        const curr = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.issueIdSeq.currentValue())
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        if (!ctx.realDbEnabled) expect(curr).toBe(41)
        else expect(typeof curr).toBe('number')
    })
    */

    // NOT-APPLICABLE: SQLite has no CREATE SEQUENCE DDL and SqliteConnection
    // does not expose `connection.sequence(...)`, so these bodies cannot run.
    /*
    test('sequence-bigint-next-value-emission', async () => {
        // Sequences over `bigint` round-trip through the same
        // dispatcher; the value type only changes how the result is
        // type-adapted, not the emitted SQL keyword. Real-DB returns
        // an engine-assigned bigint (sometimes serialized as string
        // or number depending on the driver), so the type assertion
        // accepts all three shapes.
        ctx.mockNext('9223372036854775000')
        const next = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.auditTagSeq.nextValue())
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        expect(typeof next === 'bigint' || typeof next === 'string' || typeof next === 'number').toBe(true)
    })
    */
})
