// Documentation snippets for the Insert on conflict page (docs/queries/insert-on-conflict.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tProject } from '../../domain/connection.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:insert-on-conflict/do-nothing', async () => {
        // The email of the seeded user 1 collides, so no row is inserted.
        ctx.mockNext(null)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const insertReturningUserData = await connection.insertInto(tAppUser).set({
                    email:    'ada@acme.test',
                    fullName: 'Ada King',
                })
                .onConflictDoNothing()
                .returning({
                    id:       tAppUser.id,
                    email:    tAppUser.email,
                    fullName: tAppUser.fullName,
                })
                .executeInsertNoneOrOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values (?1, ?2) on conflict do nothing returning id as id, email as email, full_name as fullName"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada King",
              ]
            `)
            assertType<Exact<typeof insertReturningUserData, { id: number; email: string; fullName: string } | null>>()
            expect(insertReturningUserData).toBeNull()
        })
    })

    test('docs-extra:insert-on-conflict/do-nothing-count-zero', async () => {
        // The email of the seeded user 1 collides, so nothing is inserted.
        ctx.mockNext(0)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            const insertedCount = await connection.insertInto(tAppUser).set({
                    email:    'ada@acme.test',
                    fullName: 'Ada King',
                })
                .onConflictDoNothing()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values (?1, ?2) on conflict do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada King",
              ]
            `)
            assertType<Exact<typeof insertedCount, number>>()
            expect(insertedCount).toBe(0)
        })
    })

    test('docs:insert-on-conflict/do-nothing-returning-last-id', async () => {
        // The email of the seeded user 1 collides, so there is no id to return.
        ctx.mockNext(null)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const insertedId = await connection.insertInto(tAppUser).set({
                    email:    'ada@acme.test',
                    fullName: 'Ada King',
                })
                .onConflictDoNothing()
                .returningLastInsertedId()
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values (?1, ?2) on conflict do nothing returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada King",
              ]
            `)
            assertType<Exact<typeof insertedId, number | null>>()
            expect(insertedId).toBeNull()
        })
    })

    test('docs:insert-on-conflict/do-update', async () => {
        const expected = { id: 1, email: 'ada@acme.test', fullName: 'Ada King' }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const insertReturningUserData = await connection.insertInto(tAppUser).set({
                    email:    'ada@acme.test',
                    fullName: 'Ada Lovelace',
                })
                .onConflictOn(tAppUser.email)
                .doUpdateSet({
                    fullName: 'Ada King',
                })
                .returning({
                    id:       tAppUser.id,
                    email:    tAppUser.email,
                    fullName: tAppUser.fullName,
                })
                .executeInsertOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values (?1, ?2) on conflict (email) do update set full_name = ?3 returning id as id, email as email, full_name as fullName"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada Lovelace",
                "Ada King",
              ]
            `)
            assertType<Exact<typeof insertReturningUserData, { id: number; email: string; fullName: string }>>()
            expect(insertReturningUserData).toEqual(expected)
        })
    })

    test('docs:insert-on-conflict/do-update-values-for-insert', async () => {
        const expected = {
            id:       1,
            email:    'ada@acme.test - ada@acme.test',
            fullName: 'Ada Lovelace - Ada King',
        }
        ctx.mockNext(expected)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const tAppUserForInsert = tAppUser.valuesForInsert()
            const insertReturningUserData = await connection.insertInto(tAppUser).set({
                    email:    'ada@acme.test',
                    fullName: 'Ada King',
                })
                .onConflictOn(tAppUser.email)
                .doUpdateSet({
                    email:    tAppUser.email.concat(' - ').concat(tAppUserForInsert.email),
                    fullName: tAppUser.fullName.concat(' - ').concat(tAppUserForInsert.fullName),
                })
                .returning({
                    id:       tAppUser.id,
                    email:    tAppUser.email,
                    fullName: tAppUser.fullName,
                })
                .executeInsertOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values (?1, ?2) on conflict (email) do update set email = app_user.email || ?3 || excluded.email, full_name = app_user.full_name || ?4 || excluded.full_name returning id as id, email as email, full_name as fullName"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada King",
                " - ",
                " - ",
              ]
            `)
            assertType<Exact<typeof insertReturningUserData, { id: number; email: string; fullName: string }>>()
            expect(insertReturningUserData).toEqual(expected)
        })
    })

    test('docs:insert-on-conflict/conflict-columns-do-nothing', async () => {
        // Seeded project 1 is (organization 1, 'mktg-site'), so the unique key collides.
        ctx.mockNext(0)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const insertedCount = await connection.insertInto(tProject).set({
                    organizationId: 1,
                    slug:           'mktg-site',
                    name:           'Marketing web',
                })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doNothing()
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?1, ?2, ?3) on conflict (organization_id, slug) do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing web",
              ]
            `)
            assertType<Exact<typeof insertedCount, number>>()
            expect(insertedCount).toBe(0)
        })
    })

    test('docs-extra:insert-on-conflict/other-conflict-raises', async () => {
        // The clause handles the conflict on the id; the email of the seeded user 1
        // violates a different unique key, so a real engine raises the violation.
        ctx.mockNext(1)
        let raised: unknown

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            try {
                await connection.insertInto(tAppUser).set({
                        email:    'ada@acme.test',
                        fullName: 'Ada King',
                    })
                    .onConflictOn(tAppUser.id)
                    .doNothing()
                    .executeInsert()
            } catch (error) {
                raised = error
            }

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values (?1, ?2) on conflict (id) do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada King",
              ]
            `)
        })

        if (ctx.realDbEnabled) {
            expect(raised).toBeInstanceOf(TsSqlError)
        } else {
            expect(raised).toBeUndefined()
        }
    })

    test('docs:insert-on-conflict/conflict-partial-index', async () => {
        // The schema has no partial index; the engine can also pick the plain unique key
        // on (organization_id, slug) for this condition. Seeded project 1 collides.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const insertedCount = await connection.insertInto(tProject).set({
                    organizationId: 1,
                    slug:           'mktg-site',
                    name:           'Marketing web',
                })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .where(tProject.organizationId.equals(1))
                .doUpdateSet({
                    archivedAt: new Date('1990-01-01'),
                })
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?1, ?2, ?3) on conflict (organization_id, slug) where organization_id = ?4 do update set archived_at = ?5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing web",
                1,
                "1990-01-01 00:00:00.000",
              ]
            `)
            assertType<Exact<typeof insertedCount, number>>()
            expect(insertedCount).toBe(1)
        })
    })

    // NOT-APPLICABLE: SQLite has no conflict target by constraint name; onConflictOnConstraint is not typed on SqliteConnection
    /*
    test('docs:insert-on-conflict/conflict-named-constraint', async () => {
        // Seeded project 1 is (organization 1, 'mktg-site'), so the constraint collides.
        ctx.mockNext(0)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const insertedCount = await connection.insertInto(tProject).set({
                    organizationId: 1,
                    slug:           'mktg-site',
                    name:           'Marketing web',
                })
                .onConflictOnConstraint(connection.rawFragment`project_organization_id_slug_key`)
                .doNothing()
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof insertedCount, number>>()
            expect(insertedCount).toBe(0)
        })
    })
    */

    test('docs:insert-on-conflict/do-update-where', async () => {
        // The seeded project 1 has a different name, so the condition lets the update run.
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const tProjectForInsert = tProject.valuesForInsert()

            const affectedCount = await connection.insertInto(tProject).set({
                    organizationId: 1,
                    slug:           'mktg-site',
                    name:           'Marketing web',
                })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({
                    name: tProjectForInsert.name,
                })
                .where(tProject.name.notEquals(tProjectForInsert.name))
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?1, ?2, ?3) on conflict (organization_id, slug) do update set name = excluded.name where project.name <> excluded.name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing web",
              ]
            `)
            assertType<Exact<typeof affectedCount, number>>()
            expect(affectedCount).toBe(1)
        })
    })

    test('docs:insert-on-conflict/do-update-where-returning', async () => {
        // The seeded project 1 has a different name, so the condition lets the update run.
        ctx.mockNext({ id: 1, name: 'Marketing web' })

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const tProjectForInsert = tProject.valuesForInsert()

            const updatedProject = await connection.insertInto(tProject).set({
                    organizationId: 1,
                    slug:           'mktg-site',
                    name:           'Marketing web',
                })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({
                    name: tProjectForInsert.name,
                })
                .where(tProject.name.notEquals(tProjectForInsert.name))
                .returning({
                    id:   tProject.id,
                    name: tProject.name,
                })
                .executeInsertNoneOrOne()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?1, ?2, ?3) on conflict (organization_id, slug) do update set name = excluded.name where project.name <> excluded.name returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing web",
              ]
            `)
            assertType<Exact<typeof updatedProject, { id: number; name: string } | null>>()
            expect(updatedProject).toEqual({ id: 1, name: 'Marketing web' })
        })
    })

    test('docs:insert-on-conflict/do-update-set-if-value', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const newArchivedAt: Date | null = null
            const newSlug: string | null = null

            const affectedCount = await connection.insertInto(tProject).set({
                    organizationId: 1,
                    slug:           'mktg-site',
                    name:           'Marketing web',
                })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSetIfValue({
                    name:       'Marketing web',
                    archivedAt: newArchivedAt, // no value: not updated
                    slug:       newSlug,       // no value: not updated, even if the column is required
                })
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?1, ?2, ?3) on conflict (organization_id, slug) do update set name = ?4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing web",
                "Marketing web",
              ]
            `)
            assertType<Exact<typeof affectedCount, number>>()
            expect(affectedCount).toBe(1)
        })
    })

    test('docs:insert-on-conflict/do-update-dynamic-set', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const updateTheVerified = true

            const query = connection.insertInto(tAppUser).set({
                    email:    'ada@acme.test',
                    fullName: 'Ada Lovelace',
                })
                .onConflictOn(tAppUser.email)
                .doUpdateDynamicSet({
                    fullName: 'Ada King',
                })

            if (updateTheVerified) {
                query.set({ verified: true })
            }

            const affectedCount = await query.executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values (?1, ?2) on conflict (email) do update set full_name = ?3, verified = case when ?4 then 'Y' else 'N' end"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada Lovelace",
                "Ada King",
                1,
              ]
            `)
            assertType<Exact<typeof affectedCount, number>>()
            expect(affectedCount).toBe(1)
        })
    })
})
