// Shaped INSERT … ON CONFLICT routes
//
//   - `.shapedAs({…}).set({…})` renames the source-object keys to real
//     columns and supplies every required column under those renamed keys.
//   - The shaped on-conflict opener `.onConflictOn(cols)` /
//     `.onConflictOnConstraint(rawFragment)` then routes into the STATIC
//     `doUpdateSet({…}) / doUpdateSetIfValue({…}) / doNothing()` arms while
//     keeping the renamed shape keys: each renamed key in the conflict
//     update-set maps back to its real column.
//   - The shaped on-conflict DO UPDATE … WHERE chain
//     (`doUpdateSet({…}).where(c1).and(c2)`) is the partial-UPDATE predicate
//     off a shaped upsert.
//
// Shape used throughout: { orgId: 'organizationId', projectName: 'name',
// projectSlug: 'slug' }. Seed (org 1, slug 'mktg-site') already exists, so
// every conflict fires and the existing row is updated → 1 affected.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// Every test in this cell is NOT-APPLICABLE (see each block below); the
// imports are kept identical to the live cells for cross-cell symmetry, and
// these sentinels satisfy noUnusedLocals while the tests stay commented out.
void expect; void test; void assertType; void tProject
export type { Exact }

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('shaped-on-conflict-on-columns-do-update-set-maps-renamed-key-to-real-column', async () => {
        // `shapedAs({...})` renames the source-object keys to real columns; the
        // insert `.set({...})` supplies every required column under those renamed
        // keys. After `onConflictOn(...).doUpdateSet({...})` (the STATIC one-shot
        // arm), the renamed `projectName` key maps back to the real `name` column.
        // Seed (org 1, 'mktg-site') exists, so the conflict fires and the existing
        // row is updated → 1 affected.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .set({
                    orgId:       1,
                    projectName: 'ignored',
                    projectSlug: 'mktg-site',
                })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ projectName: 'Renamed via shape' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Renamed via shape",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('shaped-on-conflict-on-columns-do-update-set-if-value-drops-undefined-shaped-key', async () => {
        // STATIC value-gated `doUpdateSetIfValue({...})` after the shaped
        // `onConflictOn(...)` opener: each property is tested with `_isValue`
        // before being added to the conflict update-set. The renamed `archived`
        // key (mapping to the OPTIONAL `archivedAt` column) carries `undefined`,
        // so it is dropped; the renamed `projectName` survives and maps back to
        // the real `name` column. A renamed key may carry `undefined` only when
        // it maps to an optional column — the typer keeps required columns
        // value-bearing.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .set({
                    orgId:       1,
                    projectName: 'ignored',
                    projectSlug: 'mktg-site',
                })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSetIfValue({
                    projectName: 'Renamed via shape',
                    archived:    undefined,
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Renamed via shape",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('shaped-on-conflict-on-columns-do-nothing', async () => {
        // The shaped `onConflictOn(...).doNothing()` arm: the shaped insert
        // sets supply the renamed required columns, then the conflict suppresses
        // the insert. Seed (org 1, 'mktg-site') exists so the conflict fires and
        // nothing is written → 0 affected.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .set({
                    orgId:       1,
                    projectName: 'ignored',
                    projectSlug: 'mktg-site',
                })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doNothing()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(0)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('shaped-on-conflict-on-constraint-do-update-set-maps-renamed-key', async () => {
        // `.onConflictOnConstraint(rawFragment`name`)` — the named-constraint
        // conflict target off a shaped insert. PostgreSQL accepts both `(cols)`
        // and `ON CONSTRAINT name` as conflict targets. The constraint name is a
        // raw SQL fragment (a SQL identifier, must come from DB introspection).
        // `project_organization_id_slug_key` is PostgreSQL's default name for the
        // inline `UNIQUE (organization_id, slug)` declaration in domain/schema.sql.
        // The renamed `projectName` key maps back to the real `name` column.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .set({
                    orgId:       1,
                    projectName: 'ignored',
                    projectSlug: 'mktg-site',
                })
                .onConflictOnConstraint(ctx.conn.rawFragment`project_organization_id_slug_key`)
                .doUpdateSet({ projectName: 'Renamed via constraint' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict on constraint project_organization_id_slug_key do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Renamed via constraint",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('shaped-on-conflict-do-update-set-where-then-and-builds-partial-update-predicate', async () => {
        // The shaped on-conflict DO UPDATE … WHERE chain:
        // `onConflictOn(cols).doUpdateSet({shapedKey}).where(c1).and(c2)` — pins
        // the partial-UPDATE predicate (between the DO UPDATE clause and the
        // WHERE) off a shaped upsert. The renamed `projectName` maps back to
        // `name`; the WHERE predicate is `c1 AND c2`.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .set({
                    orgId:       1,
                    projectName: 'ignored',
                    projectSlug: 'mktg-site',
                })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ projectName: 'Renamed via shape' })
                .where(tProject.name.notEquals('Renamed via shape'))
                    .and(tProject.archivedAt.isNull())
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4 where project.name <> $5 and project.archived_at is null"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Renamed via shape",
                "Renamed via shape",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    */
    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('shaped-on-conflict-do-update-chained-set-and-set-when-keep-shape', async () => {
        // After the STATIC one-shot `doUpdateSet({projectName})`, the returned node
        // stays shaped: a chained `.set({projectName})` overwrites the staged `name`,
        // and `setWhen(true, {projectName})` overwrites it again — every renamed
        // `projectName` maps back to the real `name` column (last write wins). The
        // chained-set and on-conflict `*When` arms reject the real column key (see
        // this dialect's `types.negative` suite).
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .set({
                    orgId:       1,
                    projectName: 'ignored',
                    projectSlug: 'mktg-site',
                })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ projectName: 'one-shot' })
                .set({ projectName: 'chained' })
                .setWhen(true, { projectName: 'via-set-when' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "via-set-when",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    */

})
