// The values of the update of an insert on conflict are computed with the row as
// it was before, whatever the order of the assignments: a set that swaps two
// columns swaps them, and a value that reads a column another assignment writes
// gets the value it had before. The tests read the row back.
//
// Seed (project): 1 'Marketing site' / 'mktg-site' (organization 1). Each insert
// collides on the id 1.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('an-on-conflict-update-that-swaps-two-columns-swaps-them', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            sync(ctx.conn.insertInto(tProject)
                .set({ id: 1, organizationId: 1, name: 'New name', slug: 'new-slug' })
                .onConflictOn(tProject.id).doUpdateSet({ name: tProject.slug, slug: tProject.name })
                .executeInsert())
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (id, organization_id, name, slug) values (?1, ?2, ?3, ?4) on conflict (id) do update set name = project.slug, slug = project.name"`)
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
            const row = sync(ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({ name: tProject.name, slug: tProject.slug })
                .executeSelectOne())
            expect(row).toEqual(expected)
        })
    })

    test('an-on-conflict-update-value-that-reads-a-column-written-before-it-gets-the-value-before', async () => {
        // `name` is written first and `slug` reads it: slug gets the name of the
        // row before, 'Marketing site', and name gets it with a '!'.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            sync(ctx.conn.insertInto(tProject)
                .set({ id: 1, organizationId: 1, name: 'New name', slug: 'new-slug' })
                .onConflictOn(tProject.id).doUpdateSet({ name: tProject.name.concat('!'), slug: tProject.name })
                .executeInsert())
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (id, organization_id, name, slug) values (?1, ?2, ?3, ?4) on conflict (id) do update set name = project.name || ?5, slug = project.name"`)
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
            const row = sync(ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({ name: tProject.name, slug: tProject.slug })
                .executeSelectOne())
            expect(row).toEqual(expected)
        })
    })

    test('an-on-conflict-update-that-swaps-two-columns-returns-them-swapped', async () => {
        await ctx.withRollback(async () => {
            const expected = { name: 'mktg-site', slug: 'Marketing site' }
            ctx.mockNext(expected)
            const row = sync(ctx.conn.insertInto(tProject)
                .set({ id: 1, organizationId: 1, name: 'New name', slug: 'new-slug' })
                .onConflictOn(tProject.id).doUpdateSet({ name: tProject.slug, slug: tProject.name })
                .returning({ name: tProject.name, slug: tProject.slug })
                .executeInsertOne())
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (id, organization_id, name, slug) values (?1, ?2, ?3, ?4) on conflict (id) do update set name = project.slug, slug = project.name returning name as name, slug as slug"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                1,
                "New name",
                "new-slug",
              ]
            `)
            assertType<Exact<typeof row, { name: string; slug: string }>>()
            expect(row).toEqual(expected)
        })
    })
})
