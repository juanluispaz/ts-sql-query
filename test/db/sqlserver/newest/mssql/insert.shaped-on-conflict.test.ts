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

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
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

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
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

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
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

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
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

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
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
    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
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

    // ── Shaped × BARE on-conflict forms ─────────────────────────────────
    // The bare `.onConflictDoUpdateSet(...)` / `.onConflictDoUpdateSetIfValue(...)`
    // / `.onConflictDoNothing()` forms (no inference target) driven off a shaped
    // insert: each renamed shape key maps back to its real column on the conflict
    // update-set. Seed (org 1, slug 'mktg-site' / 'tools') exists so every conflict
    // fires.

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE), so the bare `onConflictDoUpdateSet` / `onConflictDoNothing` form is not typed on SqlServerConnection.
    /*
    test('shaped-bare-on-conflict-do-update-set-maps-renamed-key-to-real-column', async () => {
        // Shaped insert + bare `onConflictDoUpdateSet({renamedKey})`: the renamed
        // `projectName` key maps back to the real `name` column on the conflict
        // update-set. The conflict fires (org 1, 'mktg-site' exists) → 1 affected.
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
                .onConflictDoUpdateSet({ projectName: 'Renamed via shape' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict do update set name = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Renamed via shape",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE), so the bare `onConflictDoUpdateSet` / `onConflictDoNothing` form is not typed on SqlServerConnection.
    /*
    test('shaped-bare-on-conflict-do-update-set-if-value-drops-undefined-shaped-key', async () => {
        // Shaped insert + bare `onConflictDoUpdateSetIfValue({...})`: the renamed
        // `archived` key (mapping to the OPTIONAL `archivedAt` column) carries
        // `undefined`, so it is dropped by `_isValue`; the renamed `projectName`
        // survives and maps back to `name`.
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
                .onConflictDoUpdateSetIfValue({
                    projectName: 'Renamed via shape',
                    archived:    undefined,
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict do update set name = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Renamed via shape",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE), so the bare `onConflictDoUpdateSet` / `onConflictDoNothing` form is not typed on SqlServerConnection.
    /*
    test('shaped-bare-on-conflict-do-update-set-value-source-with-inserted-row-under-renamed-key', async () => {
        // Shaped insert + bare `onConflictDoUpdateSet({renamedKey: <value-source>})`
        // whose RHS references both the existing column and the attempted-insert
        // pseudo-row via `valuesForInsert()`. The renamed `projectName` maps back to
        // `name`; on conflict `name` becomes the old name concatenated with the row
        // that tried to insert.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const tProjectForInsert = tProject.valuesForInsert()
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .set({
                    orgId:       1,
                    projectName: 'New name',
                    projectSlug: 'mktg-site',
                })
                .onConflictDoUpdateSet({
                    projectName: tProject.name.concat(' / ').concat(tProjectForInsert.name),
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict do update set name = project.name || ? || excluded.name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "New name",
                "mktg-site",
                " / ",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
                const name = await ctx.conn.selectFrom(tProject)
                    .where(tProject.id.equals(1))
                    .selectOneColumn(tProject.name)
                    .executeSelectOne()
                expect(name).toBe('Marketing site / New name')
            } else {
                expect(affected).toBe(1)
            }
        })
    })
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE), so the bare `onConflictDoNothing` form is not typed on SqlServerConnection.
    /*
    test('shaped-single-row-bare-on-conflict-do-nothing', async () => {
        // Shaped single-row `.set({...})` + bare `onConflictDoNothing()`: the shaped
        // keys supply the required columns, then the conflict suppresses the insert.
        // (org 1, 'mktg-site') already exists → 0 inserted. Bare `onConflictDoNothing()`
        // needs no conflict-inference target (only bare `onConflictDoUpdateSet` does).
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
                    projectName: 'Dup A',
                    projectSlug: 'mktg-site',
                })
                .onConflictDoNothing()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Dup A",
                "mktg-site",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(0)
        })
    })
    */

    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE), so the bare `onConflictDoUpdateSet` / `onConflictDoNothing` form is not typed on SqlServerConnection.
    /*
    test('shaped-multi-row-bare-on-conflict-do-nothing', async () => {
        // Shaped × multi-row `.values([...])` + bare `onConflictDoNothing()`: the
        // shaped sets supply the renamed required columns for every row, then the
        // conflict suppresses both inserts. Both (org 1, 'mktg-site') and (org 1,
        // 'tools') already exist → 0 inserted.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .values([
                    { orgId: 1, projectName: 'Dup A', projectSlug: 'mktg-site' },
                    { orgId: 1, projectName: 'Dup B', projectSlug: 'tools' },
                ])
                .onConflictDoNothing()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?), (?, ?, ?) on conflict do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Dup A",
                "mktg-site",
                1,
                "Dup B",
                "tools",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(0)
        })
    })
    */

    // Shaped × MULTI-ROW × on-conflict: `.shapedAs({...}).dynamicValues([...])`
    // reaches `ShapedExecutableMultipleInsertExpression`, then `.onConflictOn(...)`
    // routes into the multi-row conflict node with the renamed keys mapping back to
    // real columns. The single shaped on-conflict tests above are all single-row;
    // this crosses shaped × multi-row × targeted-conflict in one chain.
    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE); `onConflictOn` is narrowed away.
    /*
    test('shaped-multi-row-on-conflict-on-columns-do-update-maps-renamed-keys', async () => {
        // Two shaped rows under renamed keys, both colliding on the seeded
        // UNIQUE (organization_id, slug) of projects 1 ('mktg-site') and 2
        // ('tools'). `doUpdateSet({ projectName: valuesForInsert().name })` updates
        // each conflicting row to its own attempted name; RETURNING id yields the
        // existing ids [1, 2].
        await ctx.withRollback(async () => {
            ctx.mockNext([1, 2])
            const ids = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .dynamicValues([
                    { orgId: 1, projectName: 'Upd A', projectSlug: 'mktg-site' },
                    { orgId: 1, projectName: 'Upd B', projectSlug: 'tools' },
                ])
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ projectName: tProject.valuesForInsert().name })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3), ($4, $5, $6) on conflict (organization_id, slug) do update set name = excluded.name returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Upd A",
                "mktg-site",
                1,
                "Upd B",
                "tools",
              ]
            `)
            assertType<Exact<typeof ids, number[]>>()
            expect([...ids].sort((a, b) => a - b)).toEqual([1, 2])
        })
    })
    */


    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('shaped-on-conflict-do-update-set-skips-payload-keys-outside-the-shape', async () => {
        // Targeted `onConflictOn(cols).doUpdateSet({...})` fed a payload wider than
        // the shape. Only the declared `projectName` reaches the clause, so the
        // emitted `do update set` names exactly one column. `archivedAt` is a REAL
        // column left out of the shape — without the filter it would silently be
        // added. Seed (org 1, 'mktg-site') exists, so the conflict fires.
        const conflictPayload = {
            projectName: 'Renamed via shape',
            archivedAt: new Date(Date.UTC(2024, 5, 15, 8, 30, 0)),
            notInShape: 'csrf-token-from-the-request-body',
        }
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet(conflictPayload)
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    */


    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('shaped-on-conflict-do-update-set-if-value-skips-payload-keys-outside-the-shape', async () => {
        // The value-gated twin. `doUpdateSetIfValue` tests the shape BEFORE it tests
        // whether a value is present, so both surplus keys carry real values and are
        // dropped by the shape, not the value gate. `projectName` survives both.
        const conflictPayload = {
            projectName: 'Renamed via shape',
            archivedAt: new Date(Date.UTC(2024, 5, 15, 8, 30, 0)),
            notInShape: 'csrf-token-from-the-request-body',
        }
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSetIfValue(conflictPayload)
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    */


    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('shaped-on-conflict-do-update-set-declaring-the-key-in-the-shape-widens-the-update-list', async () => {
        // The control: the SAME payload, but the shape now DECLARES `archivedAt`, so
        // the emitted `do update set` gains a second assignment. The only difference
        // from the first test is the shape declaration, which is what makes the
        // shrink there an observation rather than a snapshot of whatever the builder
        // happens to do. `notInShape` is still not a column, so it stays out.
        const conflictPayload = {
            projectName: 'Renamed via shape',
            archivedAt: new Date(Date.UTC(2024, 5, 15, 8, 30, 0)),
            notInShape: 'csrf-token-from-the-request-body',
        }
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archivedAt: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet(conflictPayload)
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    */


    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE), so the bare `onConflictDoUpdateSet` / `onConflictDoNothing` form is not typed on SqlServerConnection.
    /*
    test('shaped-bare-on-conflict-do-update-set-skips-payload-keys-outside-the-shape', async () => {
        // The BARE (no-target) entry point — a distinct method with its own copy of
        // the shape filter. A FRESH slug means no conflict fires: the update-set
        // clause is still emitted (the observable), and the affected count is a
        // deterministic 1 on every engine.
        const conflictPayload = {
            projectName: 'Renamed via shape',
            archivedAt: new Date(Date.UTC(2024, 5, 15, 8, 30, 0)),
            notInShape: 'csrf-token-from-the-request-body',
        }
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug' })
                .set({ orgId: 1, projectName: 'Shape filter fresh', projectSlug: 'shape-filter-fresh' })
                .onConflictDoUpdateSet(conflictPayload)
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    */


    // NOT-APPLICABLE: SQL Server has no INSERT…ON CONFLICT (uses MERGE), so the bare `onConflictDoUpdateSet` / `onConflictDoNothing` form is not typed on SqlServerConnection.
    /*
    test('shaped-bare-on-conflict-do-update-set-if-value-skips-payload-keys-outside-the-shape', async () => {
        // The bare value-gated entry — the fourth copy of the shape filter. Both
        // surplus keys carry real values, so the shape test (first) is the only
        // thing that can drop them. Fresh slug again for the deterministic count.
        const conflictPayload = {
            projectName: 'Renamed via shape',
            archivedAt: new Date(Date.UTC(2024, 5, 15, 8, 30, 0)),
            notInShape: 'csrf-token-from-the-request-body',
        }
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug' })
                .set({ orgId: 1, projectName: 'Shape filter fresh', projectSlug: 'shape-filter-fresh-if-value' })
                .onConflictDoUpdateSetIfValue(conflictPayload)
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    */
})
