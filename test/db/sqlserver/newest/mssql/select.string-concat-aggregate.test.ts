// Coverage of `connection.stringConcat(...)` / `stringConcatDistinct(...)`,
// including the three separator branches (undefined, '', a real string).
// Each dialect emits its own concat-aggregate (pinned by the snapshot),
// defaulting to a ',' separator. The aggregate is unordered without an
// explicit ORDER BY, so value assertions split-and-sort rather than
// comparing the concatenated string directly.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tAppUser } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('string-concat-no-separator', async () => {
        // Three seeded users; no explicit separator → the default ','.
        ctx.mockNext('Ada Lovelace,Grace Hopper,Alan Turing')
        const row = await ctx.conn.selectFrom(tAppUser)
            .selectOneColumn(ctx.conn.stringConcat(tAppUser.fullName))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select string_agg(full_name, ',') as [result] from app_user"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(row).not.toBeNull()
        const parts = row!.split(',').sort()
        expect(parts).toEqual(['Ada Lovelace', 'Alan Turing', 'Grace Hopper'])
    })

    test('string-concat-empty-separator', async () => {
        ctx.mockNext('Ada LovelaceGrace HopperAlan Turing')
        const row = await ctx.conn.selectFrom(tAppUser)
            .selectOneColumn(ctx.conn.stringConcat(tAppUser.fullName, ''))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select string_agg(full_name, '') as [result] from app_user"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        if (ctx.realDbEnabled) {
            expect(typeof row).toBe('string')
        }
    })

    test('string-concat-string-separator', async () => {
        ctx.mockNext('Ada Lovelace | Grace Hopper | Alan Turing')
        const row = await ctx.conn.selectFrom(tAppUser)
            .selectOneColumn(ctx.conn.stringConcat(tAppUser.fullName, ' | '))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select string_agg(full_name, ' | ') as [result] from app_user"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(row).not.toBeNull()
        const parts = row!.split(' | ').sort()
        expect(parts).toEqual(['Ada Lovelace', 'Alan Turing', 'Grace Hopper'])
    })

    // NOT-APPLICABLE: SQL Server has no string_agg DISTINCT
    /*
    test('string-concat-distinct-no-separator', async () => {
        // Issue statuses in the seed: open, in_progress, open, closed —
        // three distinct values.
        ctx.mockNext('open,in_progress,closed')
        const row = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(ctx.conn.stringConcatDistinct(tIssue.status))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select group_concat(distinct status) as result from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(row).not.toBeNull()
        const parts = row!.split(',').sort()
        expect(parts).toEqual(['closed', 'in_progress', 'open'])
    })
    */

    // NOT-APPLICABLE: SQL Server has no string_agg DISTINCT
    /*
    test('string-concat-distinct-string-separator', async () => {
        ctx.mockNext('open|in_progress|closed')
        const row = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(ctx.conn.stringConcatDistinct(tIssue.status, '|'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select group_concat(distinct status separator ?) as result from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "|",
          ]
        `)
        expect(row).not.toBeNull()
        const parts = row!.split('|').sort()
        expect(parts).toEqual(['closed', 'in_progress', 'open'])
    })
    */

    // NOT-APPLICABLE: SQL Server has no string_agg DISTINCT
    /*
    test('string-concat-distinct-empty-separator', async () => {
        // Edge case: the empty-separator branch with distinct.
        ctx.mockNext('openin_progressclosed')
        const row = await ctx.conn.selectFrom(tIssue)
            .selectOneColumn(ctx.conn.stringConcatDistinct(tIssue.status, ''))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select group_concat(distinct status separator '') as result from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        if (ctx.realDbEnabled) {
            expect(typeof row).toBe('string')
        }
    })
    */

    // Not applicable on SQL Server: SQL Server's STRING_AGG does not accept
    // the DISTINCT quantifier (parser fails with `Msg 102: Incorrect syntax
    // near ','`). `stringConcatDistinct` is therefore not typed on
    // SqlServerConnection. The portable workaround is a pre-deduplicated
    // subquery: `subSelectUsing(...).distinct().select(...).forUseAsInlineQueryValue()`.
    // See test/db/sqlserver/types.negative/select.test.ts for the compile-time
    // negative that locks this contract.
})
