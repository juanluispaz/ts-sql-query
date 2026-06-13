// Coverage of `connection.sequence(name, type).nextValue()` and
// `.currentValue()` — see
// [SequenceQueryBuilder](../../../../../src/queryBuilders/SequenceQueryBuilder.ts)
// and the per-dialect `_nextSequenceValue` / `_currentSequenceValue`
// overrides.
//
// Not applicable on MySQL: the engine has no `CREATE SEQUENCE`
// (MariaDB >= 10.3 added it; MySQL has not), and `MySqlConnection`
// doesn't inherit from `AbstractAdvancedConnection`, so
// `connection.sequence(...)` isn't exposed at the type level. This
// file is kept only for cross-cell symmetry per DESIGN section 4 —
// every test is wrapped in `/* … */`.

import { afterAll, beforeAll, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)

    // NOT-APPLICABLE: MySQL has no sequences; `connection.sequence(...)` is not typed on MySqlConnection.
    /*
    import { test, expect, beforeEach } from '../../../../lib/testRunner.js'
    beforeEach(() => { ctx.reset() })

    // `issueIdSeq` and `auditTagSeq` are declared on the shared
    // DBConnection in the live dialects (postgres, mariadb, oracle,
    // sqlserver — see their `domain/connection.ts`).

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

    // NOT-APPLICABLE: MySQL has no sequences; `connection.sequence(...)` is not typed on MySqlConnection.
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

    // NOT-APPLICABLE: MySQL has no sequences; `connection.sequence(...)` is not typed on MySqlConnection.
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
