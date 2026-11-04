// Documentation snippets for the Insert on conflict page (docs/queries/insert-on-conflict.md).

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof insertReturningUserData, { id: number; email: string; fullName: string } | null>>()
            expect(insertReturningUserData).toBeNull()
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof insertedCount, number>>()
            expect(insertedCount).toBe(0)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof insertedId, number | null>>()
            expect(insertedId).toBeNull()
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof insertReturningUserData, { id: number; email: string; fullName: string }>>()
            expect(insertReturningUserData).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof insertReturningUserData, { id: number; email: string; fullName: string }>>()
            expect(insertReturningUserData).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof insertedCount, number>>()
            expect(insertedCount).toBe(0)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
        })

        if (ctx.realDbEnabled) {
            expect(raised).toBeInstanceOf(TsSqlError)
        } else {
            expect(raised).toBeUndefined()
        }
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof insertedCount, number>>()
            expect(insertedCount).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
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

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof affectedCount, number>>()
            expect(affectedCount).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('docs:insert-on-conflict/do-update-set-if-value', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            const connection = ctx.conn

            // doc-start
            const newArchivedAt: Date | null = null

            const affectedCount = await connection.insertInto(tProject).set({
                    organizationId: 1,
                    slug:           'mktg-site',
                    name:           'Marketing web',
                })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSetIfValue({
                    name:       'Marketing web',
                    archivedAt: newArchivedAt, // no value: not updated
                })
                .executeInsert()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof affectedCount, number>>()
            expect(affectedCount).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof affectedCount, number>>()
            expect(affectedCount).toBe(1)
        })
    })
    */
})
