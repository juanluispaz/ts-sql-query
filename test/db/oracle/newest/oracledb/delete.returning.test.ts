// Coverage of `DELETE ... RETURNING` / `OUTPUT deleted.*` paths.
// Lights up `_buildDeleteReturning` (PostgreSQL/MariaDB/SQLite),
// `_buildDeleteOutput` (SqlServer) and Oracle's `RETURNING ... INTO`
// override. MySQL has no equivalent, so its cell keeps the test
// commented out for symmetry.
//
// Each mutation runs inside `ctx.withRollback(...)`. Snapshots can be
// refreshed with `bun run tests <cell> --use-vitest -u`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = :0 returning id, title, priority into :1, :2, :3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "title",
                  "dir": 3003,
                },
                {
                  "as": "priority",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof removed, {
                id:       number
                title:    string
                priority: number
            }>>()

            if (!ctx.realDbEnabled) expect(removed).toEqual(expectedMock)
            else expect(removed.id).toBe(1)
        })
    })

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id = :0 returning id, title into :1, :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "title",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof removed, Array<{ id: number; title: string }>>>()

            if (!ctx.realDbEnabled) expect(removed).toEqual(expectedMock)
            else expect(removed.length).toBe(2)
        })
    })
})
