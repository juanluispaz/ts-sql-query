// Coverage of `DELETE ... RETURNING` / `OUTPUT deleted.*` paths.
// Lights up `_buildDeleteReturning` (PostgreSQL/MariaDB/SQLite),
// `_buildDeleteOutput` (SqlServer) and Oracle's `RETURNING ... INTO`
// override. MySQL has no equivalent, so its cell keeps the test
// commented out for symmetry.
//
// Each mutation runs inside `ctx.withRollback(...)`. Snapshots can be
// refreshed with `bun run tests <cell> --use-vitest -u`.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // mysql does not support the RETURNING clause; the library refuses
    // `.returning({...}).executeDeleteOne()` at compile time. Kept here
    // commented for symmetry.
    // NOT-APPLICABLE: MySQL has no RETURNING on DELETE.
    /*
    test('delete-returning-one-row', async () => {
        const expectedMock = { id: 1, title: 'Bug A', priority: 1 }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const removed = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(1))
                .returning({
                    id:       tIssue.id,
                    title:    tIssue.title,
                    priority: tIssue.priority,
                })
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof removed, {
                id:       number
                title:    string
                priority: number
            }>>()

            if (!ctx.realDbEnabled) expect(removed).toEqual(expectedMock)
            else expect(removed.id).toBe(1)
        })
    })
    */

    // mysql does not support the RETURNING clause; the library refuses
    // `.returning({...}).executeDeleteMany()` at compile time. Kept here
    // commented for symmetry.
    // NOT-APPLICABLE: MySQL has no RETURNING on DELETE.
    /*
    test('delete-returning-many', async () => {
        // Delete the two issues belonging to project 1; returns one row
        // per issue. Targeting `tIssue` (a leaf table — nothing FKs into
        // it) keeps the test FK-safe on engines that enforce referential
        // integrity at delete time.
        const expectedMock = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
        ]
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const removed = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .returning({
                    id:    tIssue.id,
                    title: tIssue.title,
                })
                .executeDeleteMany()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof removed, Array<{ id: number; title: string }>>>()

            // DELETE … RETURNING has no guaranteed order; sort by id.
            expect(removed.slice().sort((a, b) => a.id - b.id)).toEqual(expectedMock)
        })
    })
    */
})
