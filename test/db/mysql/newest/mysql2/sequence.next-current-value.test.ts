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

    /*
    import { test, expect, beforeEach } from '../../../../lib/testRunner.js'
    beforeEach(() => { ctx.reset() })

    // `issueIdSeq` and `auditTagSeq` are declared on the shared
    // DBConnection in the live dialects (postgres, mariadb, oracle,
    // sqlserver — see their `domain/connection.ts`).

    test('sequence-next-value-in-select', async () => {
        if (ctx.realDbEnabled) return
        ctx.mockNext(42)
        const next = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.issueIdSeq.nextValue())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        expect(next).toBe(42)
    })

    test('sequence-current-value-in-select', async () => {
        if (ctx.realDbEnabled) return
        ctx.mockNext(41)
        const curr = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.issueIdSeq.currentValue())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        expect(curr).toBe(41)
    })

    test('sequence-bigint-next-value-emission', async () => {
        if (ctx.realDbEnabled) return
        ctx.mockNext('9223372036854775000')
        const next = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.auditTagSeq.nextValue())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        expect(typeof next === 'bigint' || typeof next === 'string').toBe(true)
    })
    */
})
