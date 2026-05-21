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
// The tests are mock-only: a real DB query would require
// `CREATE SEQUENCE` DDL that isn't part of the seed. The SQL emission
// is what we pin.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('sequence-next-value-in-select', async () => {
        // `seq.nextValue()` returns a SequenceValueSource tagged
        // `_nextSequenceValue`; SelectQueryBuilder dispatches it
        // through the dialect's `_nextSequenceValue(...)` override.
        ctx.mockNext(42)
        const next = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.issueIdSeq.nextValue())
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select next value for issue_id_seq as [result]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        if (!ctx.realDbEnabled) expect(next).toBe(42)
        else expect(typeof next).toBe('number')
    })

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select current_value from sys.sequences where name = 'issue_id_seq') as [result]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        if (!ctx.realDbEnabled) expect(curr).toBe(41)
        else expect(typeof curr).toBe('number')
    })

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select next value for audit_tag_seq as [result]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(typeof next === 'bigint' || typeof next === 'string' || typeof next === 'number').toBe(true)
    })
})
