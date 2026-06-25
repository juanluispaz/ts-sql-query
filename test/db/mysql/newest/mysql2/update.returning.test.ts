// Coverage of `UPDATE ... RETURNING` / `OUTPUT inserted.*` paths.
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
    // `.returning({...}).executeUpdateOne()` at compile time. Kept here
    // commented for symmetry.
    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, {
                id:       number
                title:    string
                priority: number
            }>>()

            if (ctx.realDbEnabled) {
                expect(row.id).toBe(1)
                expect(row.title).toBe('Patched')
                expect(row.priority).toBe(5)
            } else {
                expect(row).toEqual(expectedMock)
            }
        })
    })
    */

    // mysql does not support the RETURNING clause; the library refuses
    // `.returningOneColumn(...).executeUpdateOne()` at compile time. Kept
    // here commented for symmetry.
    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
    test('update-returning-one-column', async () => {
        ctx.mockNext('Renamed Acme')

        await ctx.withRollback(async () => {
            const newName = await ctx.conn.update(tOrganization)
                .set({ name: 'Renamed Acme' })
                .where(tOrganization.id.equals(1))
                .returningOneColumn(tOrganization.name)
                .executeUpdateOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof newName, string>>()

            expect(newName).toBe('Renamed Acme')
        })
    })
    */

    // mysql does not support the RETURNING clause; the library refuses
    // `.returning({...}).executeUpdateMany()` at compile time. Kept here
    // commented for symmetry.
    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof rows, Array<{ id: number; title: string }>>>()

            // UPDATE … RETURNING has no guaranteed order; sort by id.
            expect(rows.slice().sort((a, b) => a.id - b.id)).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING
    /*
    test('update-returning-projecting-optional-values-as-nullable', async () => {
        // D3: optional RETURNING columns become a present `| null` via
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof updated, { id: number; body: string | null }>>()
            expect(updated).toEqual({ id: 3, body: null })
        })
    })
    */
})
