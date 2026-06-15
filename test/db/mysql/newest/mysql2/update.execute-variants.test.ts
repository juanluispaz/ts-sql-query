// Coverage of the UPDATE executor variants the other UPDATE tests
// don't exercise:
//
//   - `executeUpdate(min, max)` — min-/max-row guards (throw
//     `MINIMUM_ROWS_NOT_REACHED` / `MAXIMUM_ROWS_EXCEEDED`).
//   - `executeUpdateNoneOrOne()` with `returningOneColumn(...)` — the
//     single-column branch plus its `value === undefined → null`
//     coercion path.
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

    // MySQL has no UPDATE … RETURNING in any released version, so the
    // fluent API narrows `returningOneColumn`/`returning` to `never` for
    // `mysql` and these bodies would not even type-check here.
    // NOT-APPLICABLE: MySQL has no UPDATE ... RETURNING; `returning`/`returningOneColumn` are typed `never` on the mysql dialect (a permanent compile-time frontier, asserted in test/db/mysql/types.negative/update.test.ts). The body runs in the dialects that support RETURNING (postgres, sqlite, mariadb, sqlserver, oracle).
    /*
    test('execute-update-none-or-one-with-returning-one-column', async () => {
        // See sqlite / postgres cells for the active body.
    })
    */

    // MySQL has no UPDATE … RETURNING in any released version, so the
    // fluent API narrows `returningOneColumn`/`returning` to `never` for
    // `mysql` and these bodies would not even type-check here.
    // NOT-APPLICABLE: MySQL has no UPDATE ... RETURNING; `returning`/`returningOneColumn` are typed `never` on the mysql dialect (a permanent compile-time frontier, asserted in test/db/mysql/types.negative/update.test.ts). The body runs in the dialects that support RETURNING (postgres, sqlite, mariadb, sqlserver, oracle).
    /*
    test('execute-update-none-or-one-with-returning-one-column-empty-result', async () => {
        // Same path as the previous test but the engine returns no row →
        // the single-column result coerces missing to `null`. Filter on a
        // non-existing id so real-DB also yields no row from RETURNING.
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
    */

    // MySQL has no UPDATE … RETURNING in any released version, so the
    // fluent API narrows `returningOneColumn`/`returning` to `never` for
    // `mysql` and these bodies would not even type-check here.
    // NOT-APPLICABLE: MySQL has no UPDATE ... RETURNING; `returning`/`returningOneColumn` are typed `never` on the mysql dialect (a permanent compile-time frontier, asserted in test/db/mysql/types.negative/update.test.ts). The body runs in the dialects that support RETURNING (postgres, sqlite, mariadb, sqlserver, oracle).
    /*
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
    */

    // MySQL has no UPDATE … RETURNING in any released version, so the
    // fluent API narrows `returningOneColumn`/`returning` to `never` for
    // `mysql` and these bodies would not even type-check here.
    // NOT-APPLICABLE: MySQL has no UPDATE ... RETURNING; `returning`/`returningOneColumn` are typed `never` on the mysql dialect (a permanent compile-time frontier, asserted in test/db/mysql/types.negative/update.test.ts). The body runs in the dialects that support RETURNING (postgres, sqlite, mariadb, sqlserver, oracle).
    /*
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
        // `dynamicSet()` with no columns set leaves the SET list empty, so
        // every executor short-circuits before touching the database.
        // `executeUpdate()` resolves 0 and emits no query.
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
        // columns set, the executor resolves null and emits no query. By
        // design `executeUpdateNoneOrOne` is a RETURNING executor (it returns
        // the projected value), so it is reached through `returningOneColumn`;
        // the empty-set short-circuit fires before the projection matters, so
        // null still comes back without touching the database. (A bare
        // dynamicSet, no returning, only exposes the count-only `executeUpdate`
        // — locked in the dialect's `types.negative/update.test.ts`.)
        const result = await ctx.conn.update(tIssue)
            .dynamicSet()
            .where(tIssue.id.equals(1))
            .returningOneColumn(tIssue.status)
            .executeUpdateNoneOrOne()
        assertType<Exact<typeof result, string | null>>()
        expect(result).toBeNull()
    })
    */

    // NOT-APPLICABLE: `executeUpdateOne` is a RETURNING executor reached through `returningOneColumn`, which narrows to `never` on MySQL (no UPDATE … RETURNING); the shared empty-set short-circuit (→ NO_COLUMN_SETS on the one-row path) is covered in the postgres/sqlite/mariadb cells.
    /*
    test('execute-update-one-with-no-sets-throws-no-column-sets', async () => {
        // The one-row path cannot resolve "no row" as success, so the
        // empty-set short-circuit throws NO_COLUMN_SETS instead — again
        // reached through the RETURNING path (`executeUpdateOne` is a
        // returning executor), with the short-circuit firing first.
        let caught: unknown
        try {
            await ctx.conn.update(tIssue)
                .dynamicSet()
                .where(tIssue.id.equals(1))
                .returningOneColumn(tIssue.status)
                .executeUpdateOne()
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/NO_COLUMN_SETS|No values to update/)
    })
    */


    // MySQL has no UPDATE … RETURNING, so `.returning(...)` narrows to
    // `never` and the body would not type-check. The short-circuit it
    // exercises is dialect-independent and covered by the other cells.
    // NOT-APPLICABLE: MySQL has no UPDATE ... RETURNING; `returning`/`returningOneColumn` are typed `never` on the mysql dialect (a permanent compile-time frontier, asserted in test/db/mysql/types.negative/update.test.ts). The body runs in the dialects that support RETURNING (postgres, sqlite, mariadb, sqlserver, oracle).
    /*
    test('execute-update-many-with-no-sets-resolves-empty-array', async () => {
        // Empty-set short-circuit on the returning-many path: resolves [],
        // no query emitted.
        const rows = await ctx.conn.update(tIssue)
            .dynamicSet()
            .where(tIssue.id.equals(1))
            .returning({ id: tIssue.id, status: tIssue.status })
            .executeUpdateMany()
        expect(rows).toEqual([])
    })
    */
})
