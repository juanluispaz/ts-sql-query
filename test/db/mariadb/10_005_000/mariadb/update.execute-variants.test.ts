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
import { TsSqlError } from '../../../../../src/TsSqlError.js'
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = ? where priority >= ?"`)
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
        expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined).toBe('MINIMUM_ROWS_NOT_REACHED')
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
            expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined).toBe('MAXIMUM_ROWS_EXCEEDED')
        })
    })

    test('execute-update-none-or-one-with-returning-one-column', async () => {
        // `executeUpdateNoneOrOne()` + `returningOneColumn(col)` returns
        // the single updated value. Sets issue 1's status to 'reviewed'.
        ctx.mockNext('reviewed')
        await ctx.withRollback(async () => {
            let result: string | null = null
            let caught: unknown
            try {
                result = await ctx.conn.update(tIssue)
                    .set({ status: 'reviewed' })
                    .where(tIssue.id.equals(1))
                    .returningOneColumn(tIssue.status)
                    .executeUpdateNoneOrOne()
            } catch (e) {
                caught = e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = ? where id = ? returning status as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "reviewed",
                1,
              ]
            `)
            if (ctx.realDbEnabled) {
                // The mariadb:latest docker image still ships MariaDB 12.x,
                // which rejects UPDATE ... RETURNING (only on 13.0.1+).
                expect(caught).toBeInstanceOf(Error)
            } else {
                expect(caught).toBeUndefined()
                expect(result).toBe('reviewed')
            }
        })
    })

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = ? where id = ? returning status as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "reviewed",
                9999,
              ]
            `)
            assertType<Exact<typeof result, string | null>>()
            expect(result).toBeNull()
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
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

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
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

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('execute-update-one-column-many-result', async () => {
        // `returningOneColumn(col)` + `executeUpdateMany()` returns
        // `Array<scalar>` — the one-column-many RETURNING path. WHERE id=99999
        // matches no rows, so the RETURNING result is empty.
        ctx.mockNext([])
        await ctx.withRollback(async () => {
            const statuses = await ctx.conn.update(tIssue)
                .set({ status: 'reviewed' })
                .where(tIssue.id.equals(99999))
                .returningOneColumn(tIssue.status)
                .executeUpdateMany()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof statuses, string[]>>()
            expect(statuses).toEqual([])
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

    test('execute-update-empty-set-with-min-throws-minimum-rows', async () => {
        // The empty `dynamicSet()` short-circuit still runs the min/max guard
        // against the resulting count of 0: `executeUpdate(1)` with no columns set
        // reaches its guard with count 0 < min 1, so it rejects with
        // MINIMUM_ROWS_NOT_REACHED instead of resolving 0. No query is dispatched.
        let caught: unknown
        try {
            await ctx.conn.update(tIssue)
                .dynamicSet()
                .where(tIssue.id.equals(1))
                .executeUpdate(1)
        } catch (e) { caught = e }
        expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't update the minimum/)
        expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined).toBe('MINIMUM_ROWS_NOT_REACHED')
    })

    test('execute-update-many-empty-set-with-min-throws-minimum-rows', async () => {
        // Same empty-set short-circuit on the RETURNING-many path: `.returning({...})
        // .executeUpdateMany(1)` with no columns set reaches its guard with count 0 <
        // min 1, so it rejects with MINIMUM_ROWS_NOT_REACHED instead of resolving [].
        // No query is dispatched.
        let caught: unknown
        try {
            await ctx.conn.update(tIssue)
                .dynamicSet()
                .where(tIssue.id.equals(1))
                .returning({ id: tIssue.id, status: tIssue.status })
                .executeUpdateMany(1)
        } catch (e) { caught = e }
        expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't update the minimum/)
        expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined).toBe('MINIMUM_ROWS_NOT_REACHED')
    })

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
        expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined).toBe('NO_COLUMN_SETS')
    })

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
    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('execute-update-many-with-min-max-in-range-passes', async () => {
        // `executeUpdateMany(min, max)` with an in-range count and a
        // `.returning({...})` row-shape: WHERE matches project 1's two issues
        // (ids 1, 2), count 2 is in [1, 5], and the RETURNING row-shape array
        // comes back. Sorted by id for a deterministic comparison in both modes.
        const expected = [
            { id: 1, status: 'reviewed' },
            { id: 2, status: 'reviewed' },
        ]
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const rows = await ctx.conn.update(tIssue)
                .set({ status: 'reviewed' })
                .where(tIssue.projectId.equals(1))
                .returning({ id: tIssue.id, status: tIssue.status })
                .executeUpdateMany(1, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = ? where project_id = ? returning id as id, status as status"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "reviewed",
                1,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ id: number, status: string }>>>()
            const sorted = rows.slice().sort((a, b) => a.id - b.id)
            expect(sorted).toEqual(expected)
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('execute-update-one-column-many-non-empty-result', async () => {
        // `returningOneColumn(col)` + `executeUpdateMany()` returns a NON-EMPTY
        // scalar array — the one-column-many RETURNING path with matches. WHERE
        // matches project 1's two issues (ids 1, 2); both get status 'reviewed'.
        const expected = ['reviewed', 'reviewed']
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const statuses = await ctx.conn.update(tIssue)
                .set({ status: 'reviewed' })
                .where(tIssue.projectId.equals(1))
                .returningOneColumn(tIssue.status)
                .executeUpdateMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = ? where project_id = ? returning status as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "reviewed",
                1,
              ]
            `)
            assertType<Exact<typeof statuses, string[]>>()
            expect(statuses).toEqual(expected)
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('execute-update-one-column-many-in-range-passes', async () => {
        // The one-column arity of the many-in-range PASS: `executeUpdateMany(min,
        // max)` with `returningOneColumn(col)`. WHERE matches project 1's two
        // issues (ids 1, 2), count 2 is in [1, 5], and the status array comes back
        // (both 'reviewed').
        const expected = ['reviewed', 'reviewed']
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const statuses = await ctx.conn.update(tIssue)
                .set({ status: 'reviewed' })
                .where(tIssue.projectId.equals(1))
                .returningOneColumn(tIssue.status)
                .executeUpdateMany(1, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = ? where project_id = ? returning status as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "reviewed",
                1,
              ]
            `)
            assertType<Exact<typeof statuses, string[]>>()
            expect(statuses).toEqual(expected)
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('execute-update-one-column-many-with-max-throws-when-over-max', async () => {
        // The one-column arity of the many max-throw arm: `executeUpdateMany(min,
        // max)` with `returningOneColumn(col)`. WHERE matches all 4 seeded issues
        // (priority >= 1), max = 1, so the one-column-many result length 4 > 1
        // throws `MAXIMUM_ROWS_EXCEEDED` in both modes.
        ctx.mockNext(['reviewed', 'reviewed', 'reviewed', 'reviewed'])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.update(tIssue)
                    .set({ status: 'reviewed' })
                    .where(tIssue.priority.greaterOrEqual(1))
                    .returningOneColumn(tIssue.status)
                    .executeUpdateMany(0, 1)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|updated more/)
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('execute-update-returning-row-shape-execute-one-multiple-rows-throws-more-than-one-row', async () => {
        // `.returning({...}).executeUpdateOne()` over a WHERE matching MORE THAN
        // ONE row (project 1 has issues 1, 2) routes the RETURNING rows through
        // the `executeUpdateReturningOneRow` runner guard, which throws
        // MORE_THAN_ONE_ROW on a real engine. The mock returns a single queued
        // object and cannot produce two rows, so on mock it returns without a
        // throw. The SQL is captured (before the throw fires) in both modes.
        ctx.mockNext({ id: 1, status: 'reviewed' })
        await ctx.withRollback(async () => {
            let caught: unknown
            let result: { id: number; status: string } | undefined
            try {
                result = await ctx.conn.update(tIssue)
                    .set({ status: 'reviewed' })
                    .where(tIssue.projectId.equals(1))
                    .returning({ id: tIssue.id, status: tIssue.status })
                    .executeUpdateOne()
            } catch (e) {
                caught = e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = ? where project_id = ? returning id as id, status as status"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "reviewed",
                1,
              ]
            `)
            if (ctx.realDbEnabled) {
                expect(String(caught)).toMatch(/MORE_THAN_ONE_ROW|Too many rows/)
                expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined).toBe('MORE_THAN_ONE_ROW')
            } else {
                expect(caught).toBeUndefined()
                expect(result).toEqual({ id: 1, status: 'reviewed' })
            }
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('execute-update-returning-row-shape-execute-none-or-one-multiple-rows-throws-more-than-one-row', async () => {
        // Same MORE_THAN_ONE_ROW guard on the none-or-one row-shape path:
        // `.returning({...}).executeUpdateNoneOrOne()` widens the None arm to
        // null, but >1 RETURNING rows is still a hard error through the same
        // `executeUpdateReturningOneRow` runner. The mock returns a single queued
        // object, so on mock it returns without a throw.
        ctx.mockNext({ id: 1, status: 'reviewed' })
        await ctx.withRollback(async () => {
            let caught: unknown
            let result: { id: number; status: string } | null | undefined
            try {
                result = await ctx.conn.update(tIssue)
                    .set({ status: 'reviewed' })
                    .where(tIssue.projectId.equals(1))
                    .returning({ id: tIssue.id, status: tIssue.status })
                    .executeUpdateNoneOrOne()
            } catch (e) {
                caught = e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = ? where project_id = ? returning id as id, status as status"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "reviewed",
                1,
              ]
            `)
            if (ctx.realDbEnabled) {
                expect(String(caught)).toMatch(/MORE_THAN_ONE_ROW|Too many rows/)
                expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined).toBe('MORE_THAN_ONE_ROW')
            } else {
                expect(caught).toBeUndefined()
                expect(result).toEqual({ id: 1, status: 'reviewed' })
            }
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('execute-update-returning-one-column-execute-one-multiple-rows-throws-more-than-one-row', async () => {
        // The one-column arity of the MORE_THAN_ONE_ROW guard on update:
        // `.returningOneColumn(col).executeUpdateOne()` over a WHERE matching two
        // rows (project 1) throws MORE_THAN_ONE_ROW on a real engine. The mock
        // returns a single queued value, so on mock it returns without a throw.
        ctx.mockNext('reviewed')
        await ctx.withRollback(async () => {
            let caught: unknown
            let result: string | undefined
            try {
                result = await ctx.conn.update(tIssue)
                    .set({ status: 'reviewed' })
                    .where(tIssue.projectId.equals(1))
                    .returningOneColumn(tIssue.status)
                    .executeUpdateOne()
            } catch (e) {
                caught = e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = ? where project_id = ? returning status as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "reviewed",
                1,
              ]
            `)
            if (ctx.realDbEnabled) {
                expect(String(caught)).toMatch(/MORE_THAN_ONE_ROW|Too many rows/)
                expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined).toBe('MORE_THAN_ONE_ROW')
            } else {
                expect(caught).toBeUndefined()
                expect(result).toBe('reviewed')
            }
        })
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('execute-update-returning-one-column-execute-none-or-one-multiple-rows-throws-more-than-one-row', async () => {
        // Same MORE_THAN_ONE_ROW guard on the one-column none-or-one path:
        // `.returningOneColumn(col).executeUpdateNoneOrOne()` widens None to null
        // but >1 RETURNING rows still throws. The mock returns a single queued
        // value, so on mock it returns without a throw.
        ctx.mockNext('reviewed')
        await ctx.withRollback(async () => {
            let caught: unknown
            let result: string | null | undefined
            try {
                result = await ctx.conn.update(tIssue)
                    .set({ status: 'reviewed' })
                    .where(tIssue.projectId.equals(1))
                    .returningOneColumn(tIssue.status)
                    .executeUpdateNoneOrOne()
            } catch (e) {
                caught = e
            }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = ? where project_id = ? returning status as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "reviewed",
                1,
              ]
            `)
            if (ctx.realDbEnabled) {
                expect(String(caught)).toMatch(/MORE_THAN_ONE_ROW|Too many rows/)
                expect(caught instanceof TsSqlError ? caught.errorReason.reason : undefined).toBe('MORE_THAN_ONE_ROW')
            } else {
                expect(caught).toBeUndefined()
                expect(result).toBe('reviewed')
            }
        })
    })
    */

    test('update-query-called-twice-returns-the-cached-sql-without-re-binding-params', () => {
        // The non-executing entry points into the UPDATE emitter. Other tests do call
        // `query()` and `params()` on a built update, but always once each and always
        // in that order, so the second-call early return never runs. It matters
        // because the builder appends into ONE params array: a lost cache would bind
        // the two values a second time and renumber the placeholders of the second
        // rendering.
        //
        // Nothing is executed, so no row is touched and no rollback is needed.
        const built = ctx.conn.update(tIssue)
            .set({ title: 'Cached title', status: 'open' })
            .where(tIssue.id.equals(1))

        const first = built.query()
        const second = built.query()
        expect(second).toBe(first)

        expect(first).toMatchInlineSnapshot(`"update issue set title = ?, status = ? where id = ?"`)
        assertType<Exact<typeof first, string>>()
        expect(built.params()).toMatchInlineSnapshot(`
          [
            "Cached title",
            "open",
            1,
          ]
        `)
    })

    test('update-params-before-query-builds-on-demand', () => {
        // `params()` is legal as the FIRST call on an update builder: with nothing
        // built yet it triggers the build itself rather than handing back the empty
        // array the builder starts life with. A later `query()` then finds the cache
        // warm and renders the statement those params belong to. Build-only, so the
        // seed is untouched.
        const built = ctx.conn.update(tIssue)
            .set({ title: 'Params first', status: 'open' })
            .where(tIssue.id.equals(2))

        expect(built.params()).toMatchInlineSnapshot(`
          [
            "Params first",
            "open",
            2,
          ]
        `)

        const sql = built.query()
        expect(sql).toMatchInlineSnapshot(`"update issue set title = ?, status = ? where id = ?"`)
        assertType<Exact<typeof sql, string>>()
    })
})
