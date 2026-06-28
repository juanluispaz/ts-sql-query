// Coverage of `DELETE ... RETURNING` / `OUTPUT deleted.*` paths.
//
// Each mutation runs inside `ctx.withRollback(...)`. Snapshots can be
// refreshed with `bun run tests <cell> --use-vitest -u`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProjectRelease } from '../../domain/connection.js'
import type { ReleaseChannel } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('delete-returning-one-row', async () => {
        // Seed issue id=1 is { title: 'Update hero copy', priority: 2 };
        // the mock primes that same row so one toEqual holds in both modes.
        const expected = { id: 1, title: 'Update hero copy', priority: 2 }
        ctx.mockNext(expected)

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

            expect(removed).toEqual(expected)
        })
    })

    test('delete-returning-many', async () => {
        // Delete the two issues belonging to project 1; returns one row
        // per issue. Targeting `tIssue` (a leaf table — nothing FKs into
        // it) keeps the test FK-safe on engines that enforce referential
        // integrity at delete time.
        // Project 1 owns seed issues 1 and 2; the mock primes those same
        // rows so one toEqual holds in both modes (sorted by id, since
        // RETURNING order is not guaranteed).
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)

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

            expect(removed.slice().sort((a, b) => a.id - b.id)).toEqual(expected)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = :0 returning id, "body" into :1, :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                3,
                {
                  "as": "id",
                  "dir": 3003,
                },
                {
                  "as": "body",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof removed, { id: number; body: string | null }>>()
            expect(removed).toEqual({ id: 3, body: null })
        })
    })

    test('delete-project-release-returning-branded-custom-column', async () => {
        // `returningOneColumn(...)` on a DELETE preserves the column's branded
        // value type: reading `channel` back through RETURNING yields
        // `ReleaseChannel`, not a widened `string`. Release 1's channel is
        // 'stable'; nothing FKs into project_release, so the delete is
        // referential-integrity-safe.
        await ctx.withRollback(async () => {
            ctx.mockNext('stable')
            const channel = await ctx.conn.deleteFrom(tProjectRelease)
                .where(tProjectRelease.id.equals(1))
                .returningOneColumn(tProjectRelease.channel)
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from project_release where id = :0 returning channel into :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                {
                  "as": "result",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof channel, ReleaseChannel>>()
            expect(channel).toBe('stable')
        })
    })
})
