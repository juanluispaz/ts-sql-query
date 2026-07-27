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

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = ? where id = ? returning id as id, status as status"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                5,
                99999,
              ]
            `)
            assertType<Exact<typeof row, {
                id:     number
                status: string
            } | null>>()
            expect(row).toBeNull()
        })
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = ? where id = ? returning id as id, status as status"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
            99999,
          ]
        `)
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = ? where id = ? returning status as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
            99999,
          ]
        `)
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = $1 where id = $2 returning id as id, status as status"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                5,
                1,
              ]
            `)
            assertType<Exact<typeof row, {
                id:     number
                status: string
            } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-one-column-throws-invalid-value-on-wrong-typed-value', async () => {
        // The one-column value is PRESENT but of a shape the required-`int`
        // column can't accept (a non-integer `1.5`), so `transformValueFromDB`
        // rejects it with INVALID_VALUE_RECEIVED_FROM_DATABASE (distinct from
        // the NO_RESULT / MANDATORY_VALUE gates). The mock hands the scalar back
        // directly on the one-column path.
        // MOCK-ONLY: a real driver never hands back a non-integer for the projected int column of a
        // row it actually updated, so only the mock reaches this gate.
        ctx.mockOnlyConnection()
        ctx.mockNext(1.5)
        let caught: unknown
        try {
            await ctx.conn.update(tIssue)
                .set({ priority: 5 })
                .where(tIssue.id.equals(1))
                .returningOneColumn(tIssue.priority)
                .executeUpdateOne()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — UPDATE ... RETURNING is only supported on MariaDB 13.0.1+ (MDEV-5092); the mariadb:latest docker image still ships MariaDB 12.x. Uncomment when mariadb:latest catches up to 13.0.1+.
    /*
    test('update-returning-one-column-throws-mandatory-value-on-present-null', async () => {
        // The one-column value is PRESENT but null on a required column
        // (`status`). `transformValueFromDB` coerces null→null and the
        // required-column result-gate then rejects it with
        // MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE. A `null` scalar is
        // distinct from the `undefined` "no row" sentinel that fires NO_RESULT, so
        // the mock reaches the value-gate.
        // MOCK-ONLY: a real driver never hands back null for the projected NOT NULL column of a row
        // it actually updated, so only the mock reaches this gate.
        ctx.mockOnlyConnection()
        ctx.mockNext(null)
        let caught: unknown
        try {
            await ctx.conn.update(tIssue)
                .set({ priority: 5 })
                .where(tIssue.id.equals(1))
                .returningOneColumn(tIssue.status)
                .executeUpdateOne()
        } catch (e) {
            caught = e
        }
        expect(reasonOf(caught)).toBe('MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE')
    })
    */
})
