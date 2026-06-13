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
// MariaDB supports DELETE ... RETURNING; only the WITH-prefixed DELETE
// (test 5) is commented out — MariaDB rejects WITH as a prefix for a
// DELETE statement (see the marker on that block).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
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
        const expectedMock: { id: number; status: string } = { id: 99999, status: 'open' }
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
        // the one-column-many path of `executeDeleteMany`. The WHERE
        // matches no rows (id=99999), so both the mock and the real DB
        // yield an empty array — deterministic on both sides.
        ctx.mockNext([])
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
            expect(statuses).toEqual([])
        })
    })

    // MariaDB accepts the `WITH cte AS (...) DELETE FROM ... WHERE x IN
    // (SELECT ... FROM cte) ... RETURNING ...` form the library emits
    // (verified against the mariadb:latest image, 12.3.2 — MariaDB 12.3
    // added the WITH prefix for DELETE, and DELETE ... RETURNING has
    // shipped since 10.0.5; earlier 12.x rejected the WITH prefix).
    test('delete-cte-in-where-in-subquery-with-returning', async () => {
        // The DELETE consumes a `.forUseInQueryAs(...)` CTE inside a
        // WHERE-in-subquery (not in USING — that case is exercised by
        // `delete.using.variants.test.ts` test 3). The CTE must bubble
        // up through `__addWiths` on the subquery's source and emerge
        // as a top-level `with ... delete from ... returning ...`.
        ctx.mockNext([])
        await ctx.withRollback(async () => {
            const archivedProjects = ctx.conn.selectFrom(tProject)
                .where(tProject.archivedAt.isNotNull())
                .select({ id: tProject.id })
                .forUseInQueryAs('archived_projects')

            const removed = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.projectId.in(
                    ctx.conn.selectFrom(archivedProjects).selectOneColumn(archivedProjects.id),
                ))
                .and(tIssue.id.equals(99999))
                .returning({ id: tIssue.id })
                .executeDeleteMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"with archived_projects as (select id as id from project where archived_at is not null) delete from issue where project_id in (select id as result from archived_projects) and id = ? returning id as id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
              ]
            `)
            assertType<Exact<typeof removed, Array<{ id: number }>>>()
            if (!ctx.realDbEnabled) expect(removed).toEqual([])
            else expect(removed).toEqual([])
        })
    })
})
