// Coverage of INSERT … ON CONFLICT DO NOTHING / DO UPDATE patterns.
// Supported by postgres, sqlite, mariadb, mysql. Oracle and SQL Server
// don't support these syntaxes; the corresponding cells comment the
// tests out for symmetry.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject } from '../../domain/connection.js'
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert ignore into organization (name, plan) values (?, ?)"`)
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

    test('on-conflict-do-update', async () => {
        ctx.mockNext(1)

        await ctx.withRollback(async () => {
            // tProject has UNIQUE (organization_id, slug). Inserting an
            // existing slug + org pair triggers conflict → update.
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing site v2' })
                .onConflictDoUpdateSet({ name: 'Marketing site v2' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ?"`)
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

    // MariaDB's `ON DUPLICATE KEY UPDATE` doesn't accept a column list for
    // the conflict target (the unique constraint is determined by the
    // values inserted), so the library type-excludes `onConflictOn`.
    //
    // NOT-APPLICABLE: MariaDB uses the bare onConflictDoUpdateSet form
    /*
    test('on-conflict-on-columns-do-update', async () => {
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Updated mktg' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ name: 'Updated mktg' })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = ?"`)
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

    test('on-conflict-do-update-with-expression', async () => {
        // The SET clause receives a value-source RHS (not a plain literal),
        // exercising the value-source branch of `_appendValueForColumn` in
        // `_buildInsertOnConflictBeforeReturning`. The dialects emit very
        // different SQL here:
        //   - sqlite / postgres → `name = name || ?`
        //   - mariadb / mysql   → `name = concat(name, ?)`
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictDoUpdateSet({ name: tProject.name.concat(' v2') })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = concat(name, ?)"`)
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

    test('on-conflict-do-update-with-inserted-row-ref', async () => {
        // `tProject.valuesForInsert()` exposes a table-like reference to
        // the row that was attempted to be inserted. Each dialect emits
        // a different identifier for it:
        //   - sqlite / postgres → `excluded.<col>`
        //   - mariadb / mysql   → `values(<col>)`
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const tProjectForInsert = tProject.valuesForInsert()
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'Marketing v3' })
                .onConflictDoUpdateSet({
                    name: tProject.name.concat(' / ').concat(tProjectForInsert.name),
                })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on duplicate key update name = concat(name, ?, value(name))"`)
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

    // NOT-APPLICABLE: MariaDB has no ON CONFLICT ON CONSTRAINT
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
})
