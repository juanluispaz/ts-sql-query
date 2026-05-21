// Coverage of the UPDATE executor variants the other UPDATE tests
// don't exercise:
//
//   - `executeUpdate(min, max)` — min-/max-row guards in
//     [UpdateQueryBuilder.ts:50](../../../../../src/queryBuilders/UpdateQueryBuilder.ts#L50)
//     (throws `MINIMUM_ROWS_NOT_REACHED` / `MAXIMUM_ROWS_EXCEEDED`).
//   - `executeUpdateNoneOrOne()` with `returningOneColumn(...)` — the
//     `__oneColumn` branch in
//     [UpdateQueryBuilder.ts:93](../../../../../src/queryBuilders/UpdateQueryBuilder.ts#L93)
//     plus its `value === undefined → null` coercion path.
//   - `executeUpdateMany(min, max)` — the same min/max guards on the
//     RETURNING-many path.
//
// Mock-only for the min/max throw cases. The other tests use real-DB
// where possible; `withRollback` keeps cells clean.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('execute-update-with-min-max-passes-when-count-in-range', async () => {
        // `executeUpdate(2, 5)` accepts any row-count in [2, 5]. The
        // WHERE matches 4 seeded issues (all priorities ≥ 1).
        ctx.mockNext(3)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .set({ status: 'reviewed' })
                .where(tIssue.priority.greaterOrEqual(1))
                .executeUpdate(2, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = @0 where priority >= @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "reviewed",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(3)
        })
    })

    test('execute-update-throws-when-fewer-rows-than-min', async () => {
        // `executeUpdate(min)` with count < min raises
        // `MINIMUM_ROWS_NOT_REACHED`. Filter on a non-existing
        // priority so real-DB also yields 0 updates.
        ctx.mockNext(0)
        let caught: unknown
        try {
            await ctx.conn.update(tIssue)
                .set({ status: 'reviewed' })
                .where(tIssue.priority.equals(99))
                .executeUpdate(1)
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't update the minimum/)
    })

    test('execute-update-throws-when-more-rows-than-max', async () => {
        // `executeUpdate(min, max)` with count > max raises
        // `MAXIMUM_ROWS_EXCEEDED`. WHERE matches all 4 seeded issues
        // (priority >= 1), so count = 4 > max = 1 fires the throw on
        // real DB without any mock-shaping.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.update(tIssue)
                    .set({ status: 'reviewed' })
                    .where(tIssue.priority.greaterOrEqual(1))
                    .executeUpdate(0, 1)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|updated more/)
        })
    })

    test('execute-update-none-or-one-with-returning-one-column', async () => {
        // `executeUpdateNoneOrOne()` + `returningOneColumn(col)` lands
        // on the `__oneColumn` branch and returns the single value or
        // null. Engines that don't support UPDATE … RETURNING (MariaDB
        // ≤ 12) reject the SQL but the interceptor still captures the
        // dialect-specific emission; engines that don't support it at
        // all (MySQL) comment the test out in their cell.
        ctx.mockNext('reviewed')
        await ctx.withRollback(async () => {
            let result: string | null = null
            try {
                result = await ctx.conn.update(tIssue)
                    .set({ status: 'reviewed' })
                    .where(tIssue.id.equals(1))
                    .returningOneColumn(tIssue.status)
                    .executeUpdateNoneOrOne()
            } catch (e) {
                if (!ctx.realDbEnabled) throw e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = @0 output inserted.status as [result] where id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "reviewed",
                1,
              ]
            `)
            if (!ctx.realDbEnabled) expect(result).toBe('reviewed')
        })
    })

    test('execute-update-none-or-one-with-returning-one-column-empty-result', async () => {
        // Same path as the previous test but the engine returns no
        // row -> the `__oneColumn` branch coerces missing to `null`
        // (see [UpdateQueryBuilder.ts:140](../../../../../src/queryBuilders/UpdateQueryBuilder.ts#L140)).
        // Filter on a non-existing id so real-DB also yields no row
        // from RETURNING.
        ctx.mockNext(undefined)
        await ctx.withRollback(async () => {
            const result = await ctx.conn.update(tIssue)
                .set({ status: 'reviewed' })
                .where(tIssue.id.equals(9999))
                .returningOneColumn(tIssue.status)
                .executeUpdateNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = @0 output inserted.status as [result] where id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "reviewed",
                9999,
              ]
            `)
            expect(result).toBeNull()
        })
    })

    test('execute-update-many-with-min-max-throws-when-out-of-range', async () => {
        // `executeUpdateMany(min, max)` checks `rows.length` after the
        // RETURNING result; filter on a non-existing priority so
        // real-DB returns 0 rows, then min = 2 raises
        // `MINIMUM_ROWS_NOT_REACHED`.
        ctx.mockNext([])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.update(tIssue)
                    .set({ status: 'reviewed' })
                    .where(tIssue.priority.equals(99))
                    .returning({ id: tIssue.id, status: tIssue.status })
                    .executeUpdateMany(2)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't update the minimum/)
        })
    })

    test('execute-update-many-with-min-max-throws-when-over-max', async () => {
        // Same guard but on the max side: WHERE matches all 4 seeded
        // issues (priority >= 1), max = 1 -> `MAXIMUM_ROWS_EXCEEDED`
        // on real DB without mock-shaping.
        ctx.mockNext([
            { id: 1, status: 'reviewed' },
            { id: 2, status: 'reviewed' },
            { id: 3, status: 'reviewed' },
            { id: 4, status: 'reviewed' },
        ])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.update(tIssue)
                    .set({ status: 'reviewed' })
                    .where(tIssue.priority.greaterOrEqual(1))
                    .returning({ id: tIssue.id, status: tIssue.status })
                    .executeUpdateMany(0, 1)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|updated more/)
        })
    })
})
