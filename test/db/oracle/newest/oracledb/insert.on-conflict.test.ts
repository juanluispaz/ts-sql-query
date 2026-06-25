// Oracle does NOT support `INSERT … ON CONFLICT` syntax. The library
// excludes Oracle from the on-conflict family at compile time. Kept
// here as commented bodies so the symmetry audit reports the same
// test names per cell.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-do-nothing', async () => {
        ctx.mockNext(0)

        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Acme Corp', plan: 'free' })  // collides with seed
                .onConflictDoNothing()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) on conflict do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Acme Corp",
                "free",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            // 0 inserted rows because of the conflict.
            if (ctx.realDbEnabled) {
                // No conflict actually happens here since (name, plan) is
                // not a unique key; but the SQL still includes ON CONFLICT.
                // We just assert the call returns a number.
                expect(typeof inserted).toBe('number')
            } else {
                expect(inserted).toBe(0)
            }
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-do-update', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            // tProject has UNIQUE (organization_id, slug). Inserting an
            // existing slug + org pair triggers conflict → update.
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictDoUpdateSet({ name: 'Marketing site v2' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on conflict do update set name = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing site v2",
                "Marketing site v2",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
                // Confirm the row was updated, not inserted.
                const project = await ctx.conn.selectFrom(tProject)
                    .where(tProject.id.equals(1))
                    .selectOneColumn(tProject.name)
                    .executeSelectOne()
                expect(project).toBe('Marketing site v2')
            } else {
                expect(affected).toBe(1)
            }
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-on-columns-do-update', async () => {
        // ON CONFLICT (cols) DO UPDATE. The emitted form is pinned by the
        // snapshot below.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Updated mktg' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Updated mktg' })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Updated mktg",
                "Updated mktg",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
            } else {
                expect(affected).toBe(1)
            }
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-do-update-with-expression', async () => {
        // The SET clause receives a value-source RHS (not a plain
        // literal), exercising the value-source branch of the upsert SET
        // rendering; the emitted form is pinned by the snapshot below.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictDoUpdateSet({ name: tProject.name.concat(' v2') })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on conflict do update set name = project.name || ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                " v2",
              ]
            `)
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
                const project = await ctx.conn.selectFrom(tProject)
                    .where(tProject.id.equals(1))
                    .selectOneColumn(tProject.name)
                    .executeSelectOne()
                expect(project).toBe('Marketing site v2')
            } else {
                expect(affected).toBe(1)
            }
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-do-update-with-inserted-row-ref', async () => {
        // `tProject.valuesForInsert()` exposes a table-like reference to
        // the row that was attempted to be inserted. The identifier this
        // dialect emits for it is pinned by the snapshot below.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const tProjectForInsert = tProject.valuesForInsert()
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing v3' })
                .onConflictDoUpdateSet({
                    name: tProject.name.concat(' / ').concat(tProjectForInsert.name),
                })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on conflict do update set name = project.name || ? || excluded.name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Marketing v3",
                " / ",
              ]
            `)
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
                const project = await ctx.conn.selectFrom(tProject)
                    .where(tProject.id.equals(1))
                    .selectOneColumn(tProject.name)
                    .executeSelectOne()
                expect(project).toBe('Marketing site / Marketing v3')
            } else {
                expect(affected).toBe(1)
            }
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no ON CONFLICT ON CONSTRAINT
    /*
    test('on-conflict-on-constraint-do-nothing', async () => {
        // `.onConflictOnConstraint(rawFragment`name`)` — PostgreSQL accepts
        // both `(cols)` and `ON CONSTRAINT name` as conflict targets. The
        // constraint name is supplied as a raw SQL fragment because it is a
        // SQL identifier (must come from DB introspection, not from runtime
        // values). The unique constraint `app_user_email_key` is the
        // PostgreSQL default name for the inline `email VARCHAR(255) NOT
        // NULL UNIQUE` declaration in domain/schema.sql.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ada@acme.test', fullName: 'Ada Lovelace v2' })  // collides with seed
                .onConflictOnConstraint(ctx.conn.rawFragment`app_user_email_key`)
                .doNothing()
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values ($1, $2) on conflict on constraint app_user_email_key do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada Lovelace v2",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof inserted).toBe('number')
            } else {
                expect(inserted).toBe(0)
            }
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-do-nothing-returning-last-inserted-id-is-nullable', async () => {
        // D2: chaining returningLastInsertedId() after onConflictDoNothing()
        // makes the last id optional (`number | null`) — a conflict may
        // suppress the insert, so there may be no id to return. (No unique key
        // actually collides here, so the insert succeeds and a real id comes
        // back; the `| null` arm is the type promise this pins.)
        const expectedMock = 100
        ctx.mockNext(expectedMock)

        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Conflict demo', plan: 'free' })
                .onConflictDoNothing()
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof id, number | null>>()

            if (!ctx.realDbEnabled) expect(id).toBe(100)
            else expect(id).toBeGreaterThan(2) // seed reserves org ids 1, 2
        })
    })
    */
})
