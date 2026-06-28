// Coverage of `UPDATE ... RETURNING` / `OUTPUT inserted.*` paths.
//
// Each mutation runs inside `ctx.withRollback(...)`. Snapshots can be
// refreshed with `bun run tests <cell> --use-vitest -u`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('update-returning-one-row', async () => {
        const expectedMock = { id: 1, title: 'Patched', priority: 5 }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tIssue)
                .set({ title: 'Patched', priority: 5 })
                .where(tIssue.id.equals(1))
                .returning({
                    id:       tIssue.id,
                    title:    tIssue.title,
                    priority: tIssue.priority,
                })
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = :0, priority = :1 where id = :2 returning id, title, priority into :3, :4, :5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Patched",
                5,
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
            assertType<Exact<typeof row, {
                id:       number
                title:    string
                priority: number
            }>>()

            // The update sets title/priority deterministically and
            // RETURNING gives the row back, so both modes match the mock.
            expect(row).toEqual(expectedMock)
        })
    })

    test('update-returning-one-column', async () => {
        ctx.mockNext('Renamed Acme')

        await ctx.withRollback(async () => {
            const newName = await ctx.conn.update(tOrganization)
                .set({ name: 'Renamed Acme' })
                .where(tOrganization.id.equals(1))
                .returningOneColumn(tOrganization.name)
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update "organization" set name = :0 where id = :1 returning name into :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Renamed Acme",
                1,
                {
                  "as": "result",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof newName, string>>()

            expect(newName).toBe('Renamed Acme')
        })
    })

    test('update-returning-many', async () => {
        // Update every issue with priority 1 and return one row per
        // touched record. Only issue 2 ('Redesign navbar') has priority 1.
        const expected = [
            { id: 2, title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const rows = await ctx.conn.update(tIssue)
                .set({ priority: 9 })
                .where(tIssue.priority.equals(1))
                .returning({
                    id:    tIssue.id,
                    title: tIssue.title,
                })
                .executeUpdateMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set priority = :0 where priority = :1 returning id, title into :2, :3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                9,
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
            assertType<Exact<typeof rows, Array<{ id: number; title: string }>>>()

            // UPDATE … RETURNING has no guaranteed order; sort by id.
            expect(rows.slice().sort((a, b) => a.id - b.id)).toEqual(expected)
        })
    })

    test('update-returning-projecting-optional-values-as-nullable', async () => {
        // optional RETURNING columns become a present `| null` via
        // `projectingOptionalValuesAsNullable()` on an UPDATE builder. issue 3
        // has body = NULL, so the returned value is null (present), not absent.
        const expectedMock = { id: 3, body: null }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const updated = await ctx.conn.update(tIssue)
                .set({ status: 'in_progress' })
                .where(tIssue.id.equals(3))
                .returning({ id: tIssue.id, body: tIssue.body })
                .projectingOptionalValuesAsNullable()
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = :0 where id = :1 returning id, "body" into :2, :3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "in_progress",
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
            assertType<Exact<typeof updated, { id: number; body: string | null }>>()
            expect(updated).toEqual({ id: 3, body: null })
        })
    })

    test('update-returning-object-none-or-one', async () => {
        // `executeUpdateNoneOrOne()` with an OBJECT-shape returning yields
        // `{...} | null`. Only the single-column branch (returningOneColumn) was
        // asserted for UPDATE noneOrOne; INSERT and DELETE both cover their
        // object noneOrOne — this pins the UPDATE object noneOrOne arm. Issue 1
        // exists, so the update matches exactly one row and returns it (the
        // `| null` arm is the type promise the None case would take).
        const expectedMock = { id: 1, title: 'Reordered' }
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tIssue)
                .set({ title: 'Reordered' })
                .where(tIssue.id.equals(1))
                .returning({ id: tIssue.id, title: tIssue.title })
                .executeUpdateNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = :0 where id = :1 returning id, title into :2, :3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Reordered",
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
            assertType<Exact<typeof row, { id: number; title: string } | null>>()
            expect(row).toEqual(expectedMock)
        })
    })
})
