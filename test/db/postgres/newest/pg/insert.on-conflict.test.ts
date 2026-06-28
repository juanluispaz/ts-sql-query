// Coverage of INSERT … ON CONFLICT DO NOTHING / DO UPDATE patterns.
// Runs where the dialect supports the ON CONFLICT / upsert syntax;
// commented out elsewhere for symmetry.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('on-conflict-do-nothing', async () => {
        ctx.mockNext(0)

        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Acme Corp', plan: 'free' })  // collides with seed
                .onConflictDoNothing()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) on conflict do nothing"`)
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

    // NOT-APPLICABLE: PostgreSQL rejects `ON CONFLICT DO UPDATE` without an inference target (`(col)` or `ON CONSTRAINT name`), so the connection blocks the bare form at compile time; PostgreSQL users go through the `on-conflict-on-columns-do-update` test below. The body is kept as commented documentation for cross-cell symmetry.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict do update set name = $4"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
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

    // NOT-APPLICABLE: the bare `.onConflictDoUpdateSet({...})` form is blocked at compile time on PostgreSQL (needs `.onConflictOn(col)` / `.onConflictOnConstraint(name)`); see this dialect's `types.negative` suite and the active `on-conflict-on-columns-do-update` test above.
    /*
    test('on-conflict-do-update-with-expression', async () => {
        // Not applicable on PostgreSQL: the bare `.onConflictDoUpdateSet({...})`
        // form is blocked at compile time on PG (needs `.onConflictOn(col)` /
        // `.onConflictOnConstraint(name)`). See this dialect's `types.negative` suite
        // and the active `on-conflict-on-columns-do-update` test above.
    })
    */

    // NOT-APPLICABLE: the bare `.onConflictDoUpdateSet({...})` form is blocked at compile time on PostgreSQL (needs `.onConflictOn(col)` / `.onConflictOnConstraint(name)`); see this dialect's `types.negative` suite and the active `on-conflict-on-columns-do-update` test above.
    /*
    test('on-conflict-do-update-with-inserted-row-ref', async () => {
        // Not applicable on PostgreSQL: the bare `.onConflictDoUpdateSet({...})`
        // form is blocked at compile time on PG (needs `.onConflictOn(col)` /
        // `.onConflictOnConstraint(name)`). See this dialect's `types.negative` suite
        // and the active `on-conflict-on-columns-do-update` test above.
    })
    */

    test('on-conflict-on-constraint-do-nothing', async () => {
        // `.onConflictOnConstraint(rawFragment\`name\`)` — PostgreSQL accepts
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) on conflict do nothing returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Conflict demo",
                "free",
              ]
            `)
            assertType<Exact<typeof id, number | null>>()

            if (!ctx.realDbEnabled) expect(id).toBe(100)
            else expect(id).toBeGreaterThan(2) // seed reserves org ids 1, 2
        })
    })

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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = project.name || excluded.name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "+v2",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) on conflict do nothing returning name as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Conflict demo",
                "free",
              ]
            `)
            assertType<Exact<typeof name, string | null>>()
            expect(name).toBe('Conflict demo')
        })
    })

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4 returning name as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "Updated mktg",
                "Updated mktg",
              ]
            `)
            assertType<Exact<typeof name, string>>()
            expect(name).toBe('Updated mktg')
        })
    })
})
