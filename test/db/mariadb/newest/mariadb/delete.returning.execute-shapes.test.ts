// Extra coverage for the RETURNING execute-shapes on `DELETE`. The
// existing `delete.execute-variants.test.ts` exercises `executeDelete`
// (count-only) and the `__oneColumn` branches of
// `executeDeleteNoneOrOne`; the existing `delete.returning.test.ts`
// covers `executeDeleteMany` returning a full row shape. The shapes
// still uncovered are walked here:
//
//   1. `returning({ ... }) + executeDeleteNoneOrOne()` — the row-shape
//      branch of `executeDeleteNoneOrOne` (current tests only cover
//      `returningOneColumn` + `executeDeleteNoneOrOne`).
//   2. `returningOneColumn(col) + executeDeleteOne()` — non-empty path
//      of `executeDeleteOne` on the `__oneColumn` branch.
//   3. `returning({ ... }) + executeDeleteOne()` on no-match — fires
//      `executeDeleteOne`'s NO_RESULT throw on the row branch.
//   4. `returningOneColumn(col) + executeDeleteMany()` — pins the
//      one-column-many path of `executeDeleteMany`.
//   5. `with(cte) ... deleteFrom(...).returning(...)` — pins the CTE
//      bubble-up walk through `_buildDeleteReturning` (distinct from
//      `delete.using.variants.test.ts` test 3 which puts the CTE in
//      USING; here the CTE lives in a WHERE-in-subquery).
//
// MySQL has no RETURNING; all five tests are commented out in its cell
// for symmetry.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('delete-returning-none-or-one-row-shape', async () => {
        // `returning({ ... })` + `executeDeleteNoneOrOne()` lands on
        // the row-shape branch of `executeDeleteNoneOrOne`. The mock
        // returns the row; the real DB only deletes when the seeded id
        // exists (we use a no-match id so the test is non-destructive
        // and the real-DB returns null).
        const expectedMock = { id: 99999, status: 'open' as string }
        ctx.mockNext(expectedMock)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(99999))
                .returning({
                    id:     tIssue.id,
                    status: tIssue.status,
                })
                .executeDeleteNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ? returning id as id, status as status"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
              ]
            `)
            assertType<Exact<typeof row, {
                id:     number
                status: string
            } | null>>()
            if (!ctx.realDbEnabled) expect(row).toEqual(expectedMock)
            else expect(row).toBeNull()
        })
    })

    test('delete-returning-one-column-with-execute-one-non-empty', async () => {
        // `returningOneColumn(col)` + `executeDeleteOne()` on the
        // non-empty path. Mock returns the single value directly. The
        // real DB hits the row id=1 (seeded) and gets back its status.
        // The mutation is wrapped in `withRollback` so the next test
        // starts from a clean seed.
        ctx.mockNext('open')
        await ctx.withRollback(async () => {
            const status = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(1))
                .returningOneColumn(tIssue.status)
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ? returning status as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof status, string>>()
            if (!ctx.realDbEnabled) expect(status).toBe('open')
            else expect(typeof status).toBe('string')
        })
    })

    test('delete-returning-row-shape-throws-no-result-on-empty', async () => {
        // `returning({ ... })` + `executeDeleteOne()` with no-match
        // filter. Lands on the NO_RESULT branch of `executeDeleteOne`.
        // Mock-only because the assertion is on the rejection path,
        // not on a returned row — the real DB hits the same throw, so
        // both modes assert on the error message.
        ctx.mockNext(undefined)
        let caught: unknown
        try {
            await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(99999))
                .returning({
                    id:     tIssue.id,
                    status: tIssue.status,
                })
                .executeDeleteOne()
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/NO_RESULT|No result/)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ? returning id as id, status as status"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            99999,
          ]
        `)
    })

    test('delete-returning-one-column-many-result', async () => {
        // `returningOneColumn(col)` + `executeDeleteMany()` — pins
        // the one-column-many path of `executeDeleteMany`. The mock
        // returns an array of values; the real DB returns [] because
        // the WHERE matches no rows.
        ctx.mockNext(['open', 'in_progress'])
        await ctx.withRollback(async () => {
            const statuses = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(99999))
                .returningOneColumn(tIssue.status)
                .executeDeleteMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = ? returning status as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
              ]
            `)
            assertType<Exact<typeof statuses, string[]>>()
            if (!ctx.realDbEnabled) expect(statuses).toEqual(['open', 'in_progress'])
            else expect(Array.isArray(statuses)).toBe(true)
        })
    })

    // Not applicable on MariaDB: the server rejects the
    // `WITH cte AS (...) DELETE FROM ... WHERE x IN (SELECT ... FROM
    // cte) ...` form — MariaDB accepts WITH as a prefix for a SELECT
    // but not for a DELETE statement. See other cells for the
    // canonical body.
    /*
    test('delete-cte-in-where-in-subquery-with-returning', async () => {
        // ... see other cells for the full body — pins
        // `with archived_projects as (...) delete from issue where ...
        // returning ...`.
    })
    */
})
