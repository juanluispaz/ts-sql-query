// SQL Server does NOT support `INSERT … ON CONFLICT` syntax (its
// equivalent is the MERGE statement). The library excludes SQL Server
// from the on-conflict family at compile time. Kept here as commented
// bodies so the symmetry audit reports the same test names per cell.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-do-nothing', async () => {
        // Not supported by SQL Server.
    })
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-do-update', async () => {
        // Not supported by SQL Server.
    })
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-on-columns-do-update', async () => {
        // Not supported by SQL Server.
    })
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-do-update-with-expression', async () => {
        // Not supported by this dialect.
    })
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-do-update-with-inserted-row-ref', async () => {
        // Not supported by this dialect.
    })
    */

    // NOT-APPLICABLE: SQL Server has no ON CONFLICT ON CONSTRAINT
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

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-do-nothing-returning-last-inserted-id-is-nullable', async () => {
        // chaining returningLastInsertedId() after onConflictDoNothing()
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
    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('on-conflict-on-columns-do-update-set-value-source-with-values-for-insert', async () => {
        // `doUpdateSet` accepts a value-source RHS referencing both the
        // existing column and the attempted-insert row via `valuesForInsert()`
        // (PG renders the latter as `excluded.<col>`). On conflict, `name`
        // becomes the old name concatenated with the row that tried to insert.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: '+v2' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: tProject.name.concat(tProject.valuesForInsert().name) })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: SQL Server has no ON CONFLICT ON CONSTRAINT
    /*
    test('on-conflict-on-constraint-do-update', async () => {
        // `.onConflictOnConstraint(rawFragment`name`).doUpdateSet({...})` — the
        // DO UPDATE arm off a named-constraint conflict target. The do-nothing
        // arm off a constraint is covered by `on-conflict-on-constraint-do-nothing`
        // and the column-target do-update by `on-conflict-on-columns-do-update`;
        // this pins the constraint-target × do-update combination. The unique
        // constraint `app_user_email_key` is PostgreSQL's default name for the
        // inline `email ... UNIQUE` declaration in domain/schema.sql.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ada@acme.test', fullName: 'Ada Lovelace v2' })  // collides with seed
                .onConflictOnConstraint(ctx.conn.rawFragment`app_user_email_key`)
                .doUpdateSet({ fullName: 'Ada Lovelace v2' })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values ($1, $2) on conflict on constraint app_user_email_key do update set full_name = $3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "Ada Lovelace v2",
                "Ada Lovelace v2",
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

    // NOT-APPLICABLE: SQL Server uses MERGE for upserts and has no INSERT ... ON CONFLICT ... RETURNING form.
    /*
    test('on-conflict-do-nothing-returning-one-column', async () => {
        // `returningOneColumn(...)` after `onConflictDoNothing()` — the conflict
        // arm may suppress the insert, so the column is None-or-One (`string |
        // null`). No unique key actually collides here, so a real row inserts
        // and its `name` comes back.
        ctx.mockNext('Conflict demo')
        await ctx.withRollback(async () => {
            const name = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Conflict demo', plan: 'free' })
                .onConflictDoNothing()
                .returningOneColumn(tOrganization.name)
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof name, string | null>>()
            expect(name).toBe('Conflict demo')
        })
    })
    */

    // NOT-APPLICABLE: SQL Server uses MERGE for upserts and has no INSERT ... ON CONFLICT ... RETURNING form.
    /*
    test('on-conflict-on-columns-do-update-returning-one-column', async () => {
        // `returningOneColumn(...)` after `onConflictOn(...).doUpdateSet(...)` —
        // the upsert always produces a row (insert or update), so the column is
        // required (`string`). tProject has UNIQUE (organization_id, slug);
        // (1, 'mktg-site') collides with the seed, so the row is updated and the
        // new name is returned.
        ctx.mockNext('Updated mktg')
        await ctx.withRollback(async () => {
            const name = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Updated mktg' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Updated mktg' })
                .returningOneColumn(tProject.name)
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof name, string>>()
            expect(name).toBe('Updated mktg')
        })
    })
    */

// NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE); `onConflictOn` and the DO UPDATE `where` are narrowed away.
    /*
    test('on-conflict-on-columns-do-update-where-returning-object', async () => {
        // `onConflictOn(cols).doUpdateSet(...).where(cond).returning({obj})` --
        // the partial-UPDATE-WHERE node still carries the full RETURNING surface.
        // The WHERE can suppress the update, so RETURNING is None-or-One. tProject
        // has UNIQUE (organization_id, slug); (1, 'mktg-site') collides with the
        // seed and the WHERE (name differs from the new value) is satisfied, so
        // the row is updated and its {id, name} come back.
        const expected = { id: 1, name: 'Updated mktg where' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Updated mktg where' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Updated mktg where' })
                .where(tProject.name.notEquals('Updated mktg where'))
                .returning({ id: tProject.id, name: tProject.name })
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof row, { id: number, name: string } | null>>()
            expect(row).toEqual(expected)
        })
    })
    */

// NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE); `onConflictOn` is narrowed away.
    /*
    test('multi-row-on-conflict-on-columns-do-update-returning-object', async () => {
        // Multi-row VALUES + targeted on-conflict + `returning({obj})`
        // (executeInsertMany). `doUpdateSet` uses a `valuesForInsert()` RHS so
        // each conflicting row updates to its own attempted name. Both rows
        // collide on the existing projects 1 ('mktg-site') and 2 ('tools'), so
        // DO UPDATE produces a row for each and RETURNING yields their {id, name}.
        const expected = [
            { id: 1, name: 'Upd A' },
            { id: 2, name: 'Upd B' },
        ]
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const rows = await ctx.conn.insertInto(tProject)
                .values([
                    { organizationId: 1, slug: 'mktg-site', name: 'Upd A' },
                    { organizationId: 1, slug: 'tools', name: 'Upd B' },
                ])
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: tProject.valuesForInsert().name })
                .returning({ id: tProject.id, name: tProject.name })
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof rows, Array<{ id: number, name: string }>>>()
            expect([...rows].sort((a, b) => a.id - b.id)).toEqual(expected)
        })
    })
    */

// NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE); `onConflictOn` is narrowed away.
    /*
    test('multi-row-on-conflict-on-columns-do-update-returning-one-column', async () => {
        // Multi-row VALUES + targeted on-conflict + `returningOneColumn(...)`.
        // `doUpdateSet` uses a `valuesForInsert()` RHS so each conflicting row
        // updates to its own attempted name. Both rows collide on the existing
        // projects 1 ('mktg-site') and 2 ('tools'), so DO UPDATE produces a row
        // for each and RETURNING name yields their new names.
        const expected = ['Upd A', 'Upd B']
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const names = await ctx.conn.insertInto(tProject)
                .values([
                    { organizationId: 1, slug: 'mktg-site', name: 'Upd A' },
                    { organizationId: 1, slug: 'tools', name: 'Upd B' },
                ])
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: tProject.valuesForInsert().name })
                .returningOneColumn(tProject.name)
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof names, string[]>>()
            expect([...names].sort()).toEqual([...expected].sort())
        })
    })
    */
})
