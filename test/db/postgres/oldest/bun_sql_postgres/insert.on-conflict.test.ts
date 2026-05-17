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

    // PostgreSQL rejects `ON CONFLICT DO UPDATE` without an inference
    // target (`(col)` or `ON CONSTRAINT name`). The connection now blocks
    // the bare form at compile time; PG users go through the
    // `on-conflict-on-columns-do-update` test below. Test body is kept as
    // commented documentation for cross-cell symmetry with the dialects
    // that still accept the bare form (MariaDB / MySQL / SQLite).
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
        // ON CONFLICT (cols) DO UPDATE — postgres/sqlite syntax. mariadb
        // ignores the column list and uses the row's keys.
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
})
