// The values of the update of an insert on conflict are computed with the row as
// it was before, whatever the order of the assignments: a set that swaps two
// columns swaps them, and a value that reads a column another assignment writes
// gets the value it had before. The tests read the row back.
//
// Seed (project): 1 'Marketing site' / 'mktg-site' (organization 1). Each insert
// collides on the id 1.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('an-on-conflict-update-that-swaps-two-columns-swaps-them', async () => {
        // MySQL gives a value of the on duplicate key update the value an earlier
        // assignment wrote, and it can't read there the value the row had (a
        // subquery over the table is refused): assignments that read each other
        // can't give the rows of the other databases, so the insert is refused
        // before anything is sent, and the row stays as it was.
        let caught: unknown
        try {
            await ctx.conn.insertInto(tProject)
                .set({ id: 1, organizationId: 1, name: 'New name', slug: 'new-slug' })
                .onConflictDoUpdateSet({ name: tProject.slug, slug: tProject.name })
                .executeInsert()
        } catch (e) {
            caught = e
        }
        expect(caught instanceof TsSqlError ? caught.errorReason.reason : caught).toBe('UNSUPPORTED_QUERY')

        const expected = { name: 'Marketing site', slug: 'mktg-site' }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ name: tProject.name, slug: tProject.slug })
            .executeSelectOne()
        expect(row).toEqual(expected)
    })

    test('an-on-conflict-update-value-that-reads-a-column-written-before-it-gets-the-value-before', async () => {
        // `name` is written first and `slug` reads it: slug gets the name of the
        // row before, 'Marketing site', and name gets it with a '!'.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.insertInto(tProject)
                .set({ id: 1, organizationId: 1, name: 'New name', slug: 'new-slug' })
                .onConflictDoUpdateSet({ name: tProject.name.concat('!'), slug: tProject.name })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (id, organization_id, name, slug) values (?, ?, ?, ?) on duplicate key update slug = name, name = concat(name, ?)"`)
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

    // NOT-APPLICABLE: MySQL has no RETURNING, so returning is not typed on an insert of MySqlConnection.
    /*
    test('an-on-conflict-update-that-swaps-two-columns-returns-them-swapped', async () => {
        await ctx.withRollback(async () => {
            const expected = { name: 'mktg-site', slug: 'Marketing site' }
            ctx.mockNext(expected)
            const row = await ctx.conn.insertInto(tProject)
                .set({ id: 1, organizationId: 1, name: 'New name', slug: 'new-slug' })
                .onConflictDoUpdateSet({ name: tProject.slug, slug: tProject.name })
                .returning({ name: tProject.name, slug: tProject.slug })
                .executeInsertOne()
            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, { name: string; slug: string }>>()
            expect(row).toEqual(expected)
        })
    })
    */
})
