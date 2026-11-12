// The values of the update of an insert on conflict are computed with the row as
// it was before, whatever the order of the assignments: a set that swaps two
// columns swaps them, and a value that reads a column another assignment writes
// gets the value it had before. The tests read the row back.
//
// Seed (project): 1 'Marketing site' / 'mktg-site' (organization 1). Each insert
// collides on the id 1.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE); `onConflictOn` is narrowed away.
    /*
    test('an-on-conflict-update-that-swaps-two-columns-swaps-them', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.insertInto(tProject)
                .set({ id: 1, organizationId: 1, name: 'New name', slug: 'new-slug' })
                .onConflictOn(tProject.id).doUpdateSet({ name: tProject.slug, slug: tProject.name })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (id, organization_id, name, slug) values (:0, :1, :2, :3) on conflict (id) do update set project.name = project.slug, project.slug = project.name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                1,
                "New name",
                "new-slug",
              ]
            `)

            const expected = { name: 'mktg-site', slug: 'Marketing site' }
            ctx.mockNext(expected)
            const row = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({ name: tProject.name, slug: tProject.slug })
                .executeSelectOne()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE); `onConflictOn` is narrowed away.
    /*
    test('an-on-conflict-update-value-that-reads-a-column-written-before-it-gets-the-value-before', async () => {
        // `name` is written first and `slug` reads it: slug gets the name of the
        // row before, 'Marketing site', and name gets it with a '!'.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.insertInto(tProject)
                .set({ id: 1, organizationId: 1, name: 'New name', slug: 'new-slug' })
                .onConflictOn(tProject.id).doUpdateSet({ name: tProject.name.concat('!'), slug: tProject.name })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (id, organization_id, name, slug) values (:0, :1, :2, :3) on conflict (id) do update set project.name = project.name || :4, project.slug = project.name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                1,
                "New name",
                "new-slug",
                "!",
              ]
            `)

            const expected = { name: 'Marketing site!', slug: 'Marketing site' }
            ctx.mockNext(expected)
            const row = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({ name: tProject.name, slug: tProject.slug })
                .executeSelectOne()
            expect(row).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE); `onConflictOn` is narrowed away.
    /*
    test('an-on-conflict-update-that-swaps-two-columns-returns-them-swapped', async () => {
        await ctx.withRollback(async () => {
            const expected = { name: 'mktg-site', slug: 'Marketing site' }
            ctx.mockNext(expected)
            const row = await ctx.conn.insertInto(tProject)
                .set({ id: 1, organizationId: 1, name: 'New name', slug: 'new-slug' })
                .onConflictOn(tProject.id).doUpdateSet({ name: tProject.slug, slug: tProject.name })
                .returning({ name: tProject.name, slug: tProject.slug })
                .executeInsertOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (id, organization_id, name, slug) values (:0, :1, :2, :3) on conflict (id) do update set project.name = project.slug, project.slug = project.name returning name, slug into :4, :5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                1,
                "New name",
                "new-slug",
                {
                  "as": "name",
                  "dir": 3003,
                },
                {
                  "as": "slug",
                  "dir": 3003,
                },
              ]
            `)
            assertType<Exact<typeof row, { name: string; slug: string }>>()
            expect(row).toEqual(expected)
        })
    })
    */
})
