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
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { DBConnection, tOrganization, tProject } from '../../domain/connection.js'
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = (select _old_.slug from (select id, slug from project) as _old_ where _old_.id = project.id), slug = (select _old_.name from (select id, name from project) as _old_ where _old_.id = project.id) where id = ?"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = (select _old_.slug from (select id, slug from project) as _old_ where _old_.id = project.id), slug = (select _old_.name from (select id, name from project) as _old_ where _old_.id = project.id) where id in (?, ?)"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set slug = name, name = concat(name, ?) where id = ?"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project, organization set project.name = organization.name, project.slug = (select _old_.name from (select id, name from project) as _old_ where _old_.id = project.id) where project.organization_id = organization.id and project.id = ?"`)
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

    test('a-set-that-swaps-two-columns-returns-them-swapped', async () => {
        // MariaDB gives a value of the set the value an earlier assignment wrote,
        // and the library reads the swapped columns with their value before the
        // update from a derived table of the same table; MariaDB answers such an
        // update without the rows of its returning, so it is refused before
        // anything is sent (with SIMULTANEOUS_ASSIGNMENT in the sql_mode of the
        // session, useSimultaneousAssignment writes it as it is). The row stays as it was.
        let caught: unknown
        try {
            await ctx.conn.update(tProject)
                .set({ name: tProject.slug, slug: tProject.name })
                .where(tProject.id.equals(1))
                .returning({ name: tProject.name, slug: tProject.slug })
                .executeUpdateOne()
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

    test('a-set-that-swaps-two-columns-of-a-table-without-primary-key', async () => {
        // MariaDB gives a value of the set the value an earlier assignment wrote, so
        // the library reads the swapped columns with their value before the update,
        // through the primary key. Without one there is no way to read it: the
        // update is refused before anything is sent, and the row stays as it was.
        let caught: unknown
        try {
            await ctx.conn.update(tProjectWithoutKey)
                .set({ name: tProjectWithoutKey.slug, slug: tProjectWithoutKey.name })
                .where(tProjectWithoutKey.id.equals(1))
                .executeUpdate()
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
})
