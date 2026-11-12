// Every value of the set of an update is computed with the row as it was before
// the update, whatever the order of the assignments: `set({ name: slug, slug:
// name })` swaps the two columns, and a value that reads a column another
// assignment writes gets the value it had before. The tests read the rows back.
//
// Seed (project): 1 'Marketing site' / 'mktg-site' (organization 1, Acme Corp),
// 2 'Internal tools' / 'tools' (organization 1).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { DBConnection, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// The project table declared without its primary key
const tProjectWithoutKey = new class TProjectWithoutKey extends Table<DBConnection, 'TProjectWithoutKey'> {
    id   = this.column('id', 'int')
    name = this.column('name', 'string')
    slug = this.column('slug', 'string')
    constructor() {
        super('project')
    }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('a-set-that-swaps-two-columns-swaps-them', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const count = await ctx.conn.update(tProject)
                .set({ name: tProject.slug, slug: tProject.name })
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = slug, slug = name where id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof count, number>>()
            expect(count).toBe(1)

            const expected = { name: 'mktg-site', slug: 'Marketing site' }
            ctx.mockNext(expected)
            const row = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({ name: tProject.name, slug: tProject.slug })
                .executeSelectOne()
            expect(row).toEqual(expected)
        })
    })

    test('a-set-that-swaps-two-columns-swaps-them-in-every-row', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(2)
            const count = await ctx.conn.update(tProject)
                .set({ name: tProject.slug, slug: tProject.name })
                .where(tProject.id.in([1, 2]))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = slug, slug = name where id in (:0, :1)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                2,
              ]
            `)
            expect(count).toBe(2)

            const expected = [
                { id: 1, name: 'mktg-site', slug: 'Marketing site' },
                { id: 2, name: 'tools', slug: 'Internal tools' },
            ]
            ctx.mockNext(expected)
            const rows = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.in([1, 2]))
                .select({ id: tProject.id, name: tProject.name, slug: tProject.slug })
                .orderBy('id')
                .executeSelectMany()
            expect(rows).toEqual(expected)
        })
    })

    test('a-value-that-reads-a-column-written-before-it-gets-the-value-before-the-update', async () => {
        // `name` is written first and `slug` reads it: slug gets the name before
        // the update, 'Marketing site', and name gets it with a '!'.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tProject)
                .set({ name: tProject.name.concat('!'), slug: tProject.name })
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = name || :0, slug = name where id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "!",
                1,
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

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — Oracle multi-table UPDATE…FROM / DELETE…USING requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword (ORA-00933).
    /*
    test('an-update-from-another-table-reads-the-row-before-the-update', async () => {
        // With a second table, `name` takes the name of the organization and
        // `slug` the name of the project before the update.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tProject)
                .from(tOrganization)
                .set({ name: tOrganization.name, slug: tProject.name })
                .where(tProject.organizationId.equals(tOrganization.id))
                .and(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set project.name = "organization".name, project.slug = project.name from "organization" where project.organization_id = "organization".id and project.id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)

            const expected = { name: 'Acme Corp', slug: 'Marketing site' }
            ctx.mockNext(expected)
            const row = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({ name: tProject.name, slug: tProject.slug })
                .executeSelectOne()
            expect(row).toEqual(expected)
        })
    })
    */

    test('a-set-that-swaps-two-columns-returns-them-swapped', async () => {
        await ctx.withRollback(async () => {
            const expected = { name: 'mktg-site', slug: 'Marketing site' }
            ctx.mockNext(expected)
            const row = await ctx.conn.update(tProject)
                .set({ name: tProject.slug, slug: tProject.name })
                .where(tProject.id.equals(1))
                .returning({ name: tProject.name, slug: tProject.slug })
                .executeUpdateOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = slug, slug = name where id = :0 returning name, slug into :1, :2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
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

    test('a-set-that-swaps-two-columns-of-a-table-without-primary-key', async () => {
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tProjectWithoutKey)
                .set({ name: tProjectWithoutKey.slug, slug: tProjectWithoutKey.name })
                .where(tProjectWithoutKey.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = slug, slug = name where id = :0"`)

            const expected = { name: 'mktg-site', slug: 'Marketing site' }
            ctx.mockNext(expected)
            const row = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({ name: tProject.name, slug: tProject.slug })
                .executeSelectOne()
            expect(row).toEqual(expected)
        })
    })
})
