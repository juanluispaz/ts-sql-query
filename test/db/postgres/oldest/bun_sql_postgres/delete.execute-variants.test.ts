// Mirror of [update.execute-variants.test.ts](./update.execute-variants.test.ts)
// for the DELETE side. Lights up:
//
//   - `executeDelete(min, max)` — min-/max-row guards in
//     [DeleteQueryBuilder.ts:45](../../../../../src/queryBuilders/DeleteQueryBuilder.ts#L45).
//   - `executeDeleteNoneOrOne()` with `returningOneColumn(...)` — the
//     `__oneColumn` branch in
//     [DeleteQueryBuilder.ts:76](../../../../../src/queryBuilders/DeleteQueryBuilder.ts#L76)
//     plus its `value === undefined → null` coercion path.
//   - `executeDeleteMany(min, max)` — the same min/max guards on the
//     RETURNING-many path.
//
// Mock-only for the min/max throw cases; the rest run inside
// `withRollback` so real-DB cells stay clean.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('execute-delete-with-min-max-passes-when-count-in-range', async () => {
        // `executeDelete(2, 5)` accepts any count in [2, 5]. The
        // WHERE matches every seeded issue (4 rows) so the assertion
        // passes against the real DB too. Wrapped in `withRollback`
        // to leave the seed intact.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.priority.greaterOrEqual(1))
                .executeDelete(2, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where priority >= $1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(4)
        })
    })

    test('execute-delete-throws-when-fewer-rows-than-min', async () => {
        // `executeDelete(min)` with count < min raises
        // `MINIMUM_ROWS_NOT_REACHED`.
        ctx.mockNext(0)
        let caught: unknown
        try {
            await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.priority.equals(99))
                .executeDelete(1)
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't delete the minimum/)
    })

    test('execute-delete-throws-when-more-rows-than-max', async () => {
        // `executeDelete(min, max)` with count > max raises
        // `MAXIMUM_ROWS_EXCEEDED`. WHERE matches all 4 seeded issues
        // (priority >= 1), so count = 4 > max = 1 fires on real DB
        // without any mock-shaping.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.deleteFrom(tIssue)
                    .where(tIssue.priority.greaterOrEqual(1))
                    .executeDelete(0, 1)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|deleted more/)
        })
    })

    test('execute-delete-none-or-one-with-returning-one-column', async () => {
        // `executeDeleteNoneOrOne()` + `returningOneColumn(col)` returns
        // the single value or null. Deletes issue 1 (status='open').
        ctx.mockNext('open')
        await ctx.withRollback(async () => {
            const result = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(1))
                .returningOneColumn(tIssue.status)
                .executeDeleteNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = $1 returning status as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            expect(result).toBe('open')
        })
    })

    test('execute-delete-none-or-one-with-returning-one-column-empty-result', async () => {
        // Same path but no row returned -> the `__oneColumn` branch
        // coerces missing to `null` (see
        // [DeleteQueryBuilder.ts:82](../../../../../src/queryBuilders/DeleteQueryBuilder.ts#L82)).
        // Filter on a non-existing id so real-DB also yields no row
        // from RETURNING.
        ctx.mockNext(undefined)
        await ctx.withRollback(async () => {
            const result = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(9999))
                .returningOneColumn(tIssue.status)
                .executeDeleteNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = $1 returning status as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9999,
              ]
            `)
            expect(result).toBeNull()
        })
    })

    test('execute-delete-many-with-min-throws-when-empty', async () => {
        // `executeDeleteMany(min, max)` checks `rows.length` after the
        // RETURNING result; filter on a non-existing priority so
        // real-DB returns 0 rows, then min = 2 raises
        // `MINIMUM_ROWS_NOT_REACHED`.
        ctx.mockNext([])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.deleteFrom(tIssue)
                    .where(tIssue.priority.equals(99))
                    .returning({ id: tIssue.id, status: tIssue.status })
                    .executeDeleteMany(2)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't delete the minimum/)
        })
    })

    test('execute-delete-many-with-max-throws-when-over-limit', async () => {
        // Same guard but on the max side: WHERE matches all 4 seeded
        // issues (priority >= 1), max = 1 -> `MAXIMUM_ROWS_EXCEEDED`
        // on real DB without mock-shaping.
        ctx.mockNext([
            { id: 1, status: 'open' },
            { id: 2, status: 'in_progress' },
            { id: 3, status: 'open' },
            { id: 4, status: 'closed' },
        ])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.deleteFrom(tIssue)
                    .where(tIssue.priority.greaterOrEqual(1))
                    .returning({ id: tIssue.id, status: tIssue.status })
                    .executeDeleteMany(0, 1)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|deleted more/)
        })
    })
})
