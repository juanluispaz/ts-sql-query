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
// The two `min`/`max`-only tests don't need RETURNING and run on
// MySQL identically to every other dialect. The other four tests
// (every variant that uses `.returning(...)` or
// `.returningOneColumn(...)`) are commented out: MySQL does not
// support `UPDATE … RETURNING` in any released version, and the
// fluent surface in
// [src/expressions/update.ts:521-531](../../../../../src/expressions/update.ts#L521-L531)
// narrows those methods to `never` for `mysql` exactly to encode that
// limitation in the type system — so the test would not even
// type-check on this cell.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('execute-update-with-min-max-passes-when-count-in-range', async () => {
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .set({ status: 'reviewed' })
                .where(tIssue.priority.greaterOrEqual(1))
                .executeUpdate(2, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set \`status\` = ? where priority >= ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "reviewed",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(4)
        })
    })

    test('execute-update-throws-when-fewer-rows-than-min', async () => {
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

    // MySQL has no UPDATE … RETURNING in any released version, so the
    // fluent API narrows `returningOneColumn`/`returning` to `never` for
    // `mysql` and these bodies would not even type-check here.
    // TODO[LIMITATION]: see LIMITATIONS.md — re-enable if/when MySQL adds UPDATE … RETURNING.
    /*
    test('execute-update-none-or-one-with-returning-one-column', async () => {
        // See sqlite / postgres cells for the active body.
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
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
    */

    test('execute-update-with-no-sets-resolves-zero', async () => {
        // `dynamicSet()` with no columns set leaves `__sets` empty, so
        // every executor short-circuits before touching the database
        // (UpdateQueryBuilder.ts:55). `executeUpdate()` resolves 0 and
        // emits no query — no SQL snapshot, identical on every dialect.
        const affected = await ctx.conn.update(tIssue)
            .dynamicSet()
            .where(tIssue.id.equals(1))
            .executeUpdate()
        assertType<Exact<typeof affected, number>>()
        expect(affected).toBe(0)
    })

    // NOT-APPLICABLE: `executeUpdateNoneOrOne` is a RETURNING executor reached through `returningOneColumn`, which narrows to `never` on MySQL (no UPDATE … RETURNING); the shared empty-set short-circuit (→ null) is covered in the postgres/sqlite/mariadb cells.
    /*
    test('execute-update-none-or-one-with-no-sets-resolves-null', async () => {
        // Same empty-set short-circuit on the none-or-one path: with no
        // columns set, the executor resolves null and emits no query.
        // `executeUpdateNoneOrOne` is a RETURNING executor reached through
        // `returningOneColumn`; the short-circuit fires before the projection
        // matters, so null still comes back without touching the database.
        const result = await ctx.conn.update(tIssue)
            .dynamicSet()
            .where(tIssue.id.equals(1))
            .returningOneColumn(tIssue.status)
            .executeUpdateNoneOrOne()
        assertType<Exact<typeof result, string | null>>()
        expect(result).toBeNull()
    })
    */

    test('execute-update-one-with-no-sets-throws-no-column-sets', async () => {
        // The one-row path cannot resolve "no row" as success, so the
        // empty-`__sets` short-circuit throws NO_COLUMN_SETS instead
        // (UpdateQueryBuilder.ts:126-130).
        let caught: unknown
        try {
            // Cast as above: `executeUpdateOne` is not on the dynamicSet
            // type; the runtime guard is what we are exercising.
            const builder = ctx.conn.update(tIssue)
                .dynamicSet()
                .where(tIssue.id.equals(1)) as any
            await builder.executeUpdateOne()
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/NO_COLUMN_SETS|No values to update/)
    })


    // MySQL has no UPDATE … RETURNING, so `.returning(...)` narrows to
    // `never` and the body would not type-check. The short-circuit it
    // exercises is dialect-independent and covered by the other cells.
    // TODO[LIMITATION]: see LIMITATIONS.md — re-enable if/when MySQL adds UPDATE … RETURNING.
    /*
    test('execute-update-many-with-no-sets-resolves-empty-array', async () => {
        // See sqlite / postgres cells for the active body.
        const rows = await ctx.conn.update(tIssue)
            .dynamicSet()
            .where(tIssue.id.equals(1))
            .returning({ id: tIssue.id, status: tIssue.status })
            .executeUpdateMany()
        expect(rows).toEqual([])
    })
    */
})
