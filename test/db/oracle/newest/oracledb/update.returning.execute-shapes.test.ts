// Extra coverage for the RETURNING execute-shapes on `UPDATE`. The
// existing `update.execute-variants.test.ts` exercises `executeUpdate`
// (count-only) and the one-column branch of `executeUpdateNoneOrOne`;
// `update.returning.test.ts` covers `executeUpdateOne` / `executeUpdateMany`
// returning a full row shape on a matching row. The distinguishing
// inhabitants of the remaining shapes — the `| null` (None) arm and the
// NO_RESULT throw when the RETURNING yields no row — are walked here
// (structural twin of `delete.returning.execute-shapes.test.ts`):
//
//   1. `returning({ ... }) + executeUpdateNoneOrOne()` on no-match — the
//      `| null` (None) arm of the row-shape branch of
//      `executeUpdateNoneOrOne` (existing tests only key a matching row,
//      so the null value is never realized).
//   2. `returning({ ... }) + executeUpdateOne()` on no-match — fires
//      `executeUpdateOne`'s NO_RESULT throw on the row-shape branch
//      (`executeUpdateOne` has no `| null` precisely because it throws).
//   3. `returningOneColumn(col) + executeUpdateOne()` on no-match — fires
//      `executeUpdateOne`'s NO_RESULT throw on the one-column branch.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('update-returning-none-or-one-row-shape-null-on-no-match', async () => {
        // `returning({ ... })` + `executeUpdateNoneOrOne()` lands on the
        // row-shape branch of `executeUpdateNoneOrOne`. WHERE id=99999
        // matches no row, so the UPDATE affects nothing and RETURNING
        // yields no row — the None arm resolves `null` (not a throw). The
        // mock returns the same "no row" sentinel, so both modes realize
        // the `| null` inhabitant.
        ctx.mockNext(undefined)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tIssue)
                .set({ priority: 5 })
                .where(tIssue.id.equals(99999))
                .returning({
                    id:     tIssue.id,
                    status: tIssue.status,
                })
                .executeUpdateNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = :0 where id = :1 returning id, status into :2, :3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                5,
                99999,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "status",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, {
                id:     number
                status: string
            } | null>>()
            expect(row).toBeNull()
        })
    })

    test('update-returning-row-shape-throws-no-result-on-empty', async () => {
        // `returning({ ... })` + `executeUpdateOne()` with a no-match
        // filter. Lands on the NO_RESULT branch of `executeUpdateOne`.
        // Both modes hit the same throw — the real DB updates no row and
        // gets no RETURNING row, the mock returns the "no row" sentinel —
        // so both assert on the rejection.
        ctx.mockNext(undefined)
        let caught: unknown
        try {
            await ctx.conn.update(tIssue)
                .set({ priority: 5 })
                .where(tIssue.id.equals(99999))
                .returning({
                    id:     tIssue.id,
                    status: tIssue.status,
                })
                .executeUpdateOne()
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/NO_RESULT|No result/)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = :0 where id = :1 returning id, status into :2, :3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
            99999,
            {
              "as": "id",
              "dir": 3003,
            },
            {
              "as": "status",
              "dir": 3003,
            },
          ]
        `)
    })

    test('update-returning-one-column-throws-no-result-on-empty', async () => {
        // `returningOneColumn(col)` + `executeUpdateOne()` with a no-match
        // filter fires the NO_RESULT throw on the one-column branch of
        // `executeUpdateOne` (distinct executor from the row-shape branch
        // above). Same rejection contract in both modes.
        ctx.mockNext(undefined)
        let caught: unknown
        try {
            await ctx.conn.update(tIssue)
                .set({ priority: 5 })
                .where(tIssue.id.equals(99999))
                .returningOneColumn(tIssue.status)
                .executeUpdateOne()
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/NO_RESULT|No result/)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = :0 where id = :1 returning status into :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
            99999,
            {
              "as": "result",
              "dir": 3003,
            },
          ]
        `)
    })
    test('update-returning-none-or-one-row-shape-present-on-match', async () => {
        // The PRESENT arm of `executeUpdateNoneOrOne()` on the row-shape branch: WHERE
        // id=1 matches exactly one row, so RETURNING yields a single object and the
        // None-or-One executor resolves it (the null-on-no-match sibling above covers the
        // None arm). status is unchanged by the set, so it comes back as the seed value
        // ('open').
        const expected = { id: 1, status: 'open' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tIssue)
                .set({ priority: 5 })
                .where(tIssue.id.equals(1))
                .returning({
                    id:     tIssue.id,
                    status: tIssue.status,
                })
                .executeUpdateNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = :0 where id = :1 returning id, status into :2, :3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                5,
                1,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "status",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, {
                id:     number
                status: string
            } | null>>()
            expect(row).toEqual(expected)
        })
    })
})
