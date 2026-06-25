// Coverage of `DELETE ... RETURNING` / `OUTPUT deleted.*` paths.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue output deleted.id as id, deleted.title as title, deleted.priority as priority where id = @0"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue output deleted.id as id, deleted.title as title where project_id = @0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof removed, Array<{ id: number; title: string }>>>()

            // OUTPUT has no ORDER BY, so sort by id before comparing.
            const sorted = [...removed].sort((a, b) => a.id - b.id)
            expect(sorted).toEqual(expectedMock)
        })
    })

    test('delete-returning-projecting-optional-values-as-nullable', async () => {
        // optional RETURNING columns become a present `| null` via
        // `projectingOptionalValuesAsNullable()` on a DELETE builder. issue 3
        // has body = NULL (and is not referenced as a parent by any other
        // issue), so the returned value is null (present), not absent.
        const expectedMock = { id: 3, body: null }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const removed = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(3))
                .returning({ id: tIssue.id, body: tIssue.body })
                .projectingOptionalValuesAsNullable()
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue output deleted.id as id, deleted.body as body where id = @0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                3,
              ]
            `)
            assertType<Exact<typeof removed, { id: number; body: string | null }>>()
            expect(removed).toEqual({ id: 3, body: null })
        })
    })
})
