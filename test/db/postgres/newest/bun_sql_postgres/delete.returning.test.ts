// Coverage of `DELETE ... RETURNING` / `OUTPUT deleted.*` paths.
// Lights up `_buildDeleteReturning` (PostgreSQL/MariaDB/SQLite),
// `_buildDeleteOutput` (SqlServer) and Oracle's `RETURNING ... INTO`
// override. MySQL has no equivalent, so its cell keeps the test
// commented out for symmetry.
//
// Each mutation runs inside `ctx.withRollback(...)`. Snapshots can be
// refreshed with `bun run tests:focus <cell> --use-vitest -u`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = $1 returning id as id, title as title, priority as priority"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
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
        // Delete every project on org 2; returns one row per project.
        const expectedMock = [{ id: 3, name: 'Beta Project' }]
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const removed = await ctx.conn.deleteFrom(tProject)
                .where(tProject.organizationId.equals(2))
                .returning({
                    id:   tProject.id,
                    name: tProject.name,
                })
                .executeDeleteMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from project where organization_id = $1 returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
              ]
            `)
            assertType<Exact<typeof removed, Array<{ id: number; name: string }>>>()

            if (!ctx.realDbEnabled) expect(removed).toEqual(expectedMock)
            else expect(Array.isArray(removed)).toBe(true)
        })
    })
})
