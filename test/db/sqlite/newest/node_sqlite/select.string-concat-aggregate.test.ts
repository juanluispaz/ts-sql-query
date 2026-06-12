// Coverage of the `connection.stringConcat(...)` and
// `connection.stringConcatDistinct(...)` aggregate operators, including
// the three separator branches of the SQL emitter (undefined, '', and a
// real string). Aggregates run inside a single-row select so the test
// remains deterministic without grouping.
//
// Dialect emission:
//   - sqlite                          → group_concat(v[, sep])
//   - mariadb / mysql                 → group_concat(v[ separator sep])
//   - postgres                        → string_agg(v, sep | ',')
//   - sqlserver                       → string_agg(v, sep | ',')
//   - oracle                          → listagg(v[, sep]) within group (order by v)
//
// The set returned by the aggregate is unordered without an explicit
// ORDER BY inside it (covered by select.aggregate-as-array.ordered),
// so real-DB assertions split-and-sort rather than comparing strings.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tAppUser, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('string-concat-no-separator', async () => {
        // Three seeded users: Ada Lovelace, Grace Hopper, Alan Turing.
        // No explicit separator: postgres/sqlserver fall back to ',',
        // sqlite/mysql/mariadb emit no separator argument at all.
        ctx.mockNext('Ada Lovelace,Grace Hopper,Alan Turing')
        const row = await ctx.conn.selectFrom(tAppUser)
            .selectOneColumn(ctx.conn.stringConcat(tAppUser.fullName))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select group_concat(full_name) as result from app_user"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select group_concat(full_name, '') as result from app_user"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select group_concat(full_name, ?) as result from app_user"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            " | ",
          ]
        `)
        expect(row).not.toBeNull()
        const parts = row!.split(' | ').sort()
        expect(parts).toEqual(['Ada Lovelace', 'Alan Turing', 'Grace Hopper'])
    })

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

    // NOT-APPLICABLE: SQLite has no string_agg DISTINCT with separator
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

    // NOT-APPLICABLE: SQLite has no string_agg DISTINCT with separator
    /*
    test('string-concat-distinct-empty-separator', async () => {
        // Edge case for the third separator branch of _stringConcatDistinct.
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

    // Note: `stringConcatDistinct(col, separator)` is NOT exposed on
    // SqliteConnection because SQLite always rejects
    // `group_concat(distinct X, sep)` with `DISTINCT aggregates must have
    // exactly one argument`. The compile-time rejection is locked by
    // `test/db/sqlite/types.negative/select.test.ts`.
})
