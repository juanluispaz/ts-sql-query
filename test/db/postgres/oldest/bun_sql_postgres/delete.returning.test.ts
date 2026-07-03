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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where project_id = $1 returning id as id, title as title"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof removed, Array<{ id: number; title: string }>>>()

            // DELETE … RETURNING has no guaranteed order; sort by id.
            expect(removed.slice().sort((a, b) => a.id - b.id)).toEqual(expectedMock)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = $1 returning id as id, body as body"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                3,
              ]
            `)
            assertType<Exact<typeof removed, { id: number; body: string | null }>>()
            expect(removed).toEqual({ id: 3, body: null })
        })
    })

    test('delete-returning-one-column-computed-expression', async () => {
        // `returningOneColumn(<computed>)` on a DELETE projecting a COMPUTED
        // expression (a column combined with a const) rather than a bare
        // column. RETURNING on DELETE sees the row as it was, so deleting issue
        // 3 (priority 3) returns priority + 100 = 103. Issue 3 is a leaf
        // (nothing FKs into it), so the delete is referential-integrity-safe.
        ctx.mockNext(103)

        await ctx.withRollback(async () => {
            const bumped = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.id.equals(3))
                .returningOneColumn(tIssue.priority.add(100))
                .executeDeleteOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where id = $1 returning priority + $2 as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                3,
                100,
              ]
            `)
            assertType<Exact<typeof bumped, number>>()
            expect(bumped).toBe(103)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from project_release where id = $1 returning channel as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof channel, ReleaseChannel>>()
            expect(channel).toBe('stable')
        })
    })
})
