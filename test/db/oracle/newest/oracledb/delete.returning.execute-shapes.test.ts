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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = :0 returning id, status into :1, :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
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
            // No-match id: the real DB deletes nothing and RETURNING is
            // empty (null); the mock primes a synthetic row.
            expect(row).toEqual(ctx.realDbEnabled ? null : expectedMock)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = :0 returning status into :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                {
                  "as": "result",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof status, string>>()
            // Seed issue id=1 has status 'open'; both modes return it.
            expect(status).toBe('open')
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = :0 returning id, status into :1, :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = :0 returning status into :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                99999,
                {
                  "as": "result",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof statuses, string[]>>()
            // No-match id: the real DB deletes nothing and returns [];
            // the mock primes a synthetic two-value array.
            expect(statuses).toEqual(ctx.realDbEnabled ? [] : ['open', 'in_progress'])
        })
    })

    // Oracle rejects the `WITH cte AS (...) DELETE FROM ... WHERE x IN
    // (SELECT ... FROM cte) ...` form with ORA-00928 "SELECT keyword
    // missing": Oracle accepts WITH only as a prefix to SELECT; the
    // library emits the WITH-prefix form here. Body kept verbatim for
    // cross-cell diff parity.
    // NOT-APPLICABLE: Oracle accepts WITH only as a prefix to SELECT, so WITH … DELETE (ORA-00928) is not emittable
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"with archived_projects as (select id as id from project where archived_at is not null) delete from issue where project_id in (select id as result from archived_projects) and id = $1 returning id as id"`)
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
    */
})
