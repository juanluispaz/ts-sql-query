// Shaped UPDATE set surface. `shapedAs({...})` renames the source-object keys to
// real columns; the set-manipulation family (`setIfValue`, `setIfSet`, `setIfNotSet`,
// `ignoreIfSet`, `keepOnly`, `setIfHasValue`/`setIfHasNoValue`, `ignoreAnySetWithNoValue`,
// the `dynamicSet()` opener) and the allowing-no-where entry all operate on the renamed
// keys. The conditional `*When` arms (`setWhen`, `setIfValueWhen`, `keepOnlyWhen`, …)
// thread the same shape: each dispatches to its non-`When` sibling, so the renamed key
// maps back to its real column. Dialect-independent (a plain UPDATE under the real
// column names).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('shaped-set-if-value-gates-undefined-optional', async () => {
        // `.shapedAs({...}).setIfValue({...})` — the optional renamed key
        // `archived` is `undefined`, so it is dropped by the value-gate; only
        // the renamed `projectName` (→ name) reaches the SET clause.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .setIfValue({ projectName: 'Renamed via shaped setIfValue', archived: undefined })
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 where id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Renamed via shaped setIfValue",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-set-if-set-overwrites-only-already-staged', async () => {
        // `.set({projectName})` stages `name`; `.setIfSet({projectName, projectSlug})`
        // overwrites `name` (already staged) but skips `slug` (never staged).
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'First name' })
                .setIfSet({ projectName: 'Overwritten name', projectSlug: 'should-be-skipped' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 where id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Overwritten name",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-set-if-not-set-fills-only-unstaged', async () => {
        // `.set({projectName})` stages `name`; `.setIfNotSet({projectName, projectSlug})`
        // leaves `name` (already staged) and adds `slug` (not staged).
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Kept name' })
                .setIfNotSet({ projectName: 'ignored', projectSlug: 'mktg-site-shaped' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0, slug = @1 where id = @2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Kept name",
                "mktg-site-shaped",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-ignore-if-set-drops-a-staged-renamed-column', async () => {
        // `.set({projectName, projectSlug})` stages both; `.ignoreIfSet('projectSlug')`
        // removes the renamed `slug` entry, leaving only `name` in the SET clause.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Stays', projectSlug: 'dropped-slug' })
                .ignoreIfSet('projectSlug')
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 where id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Stays",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-keep-only-prunes-to-named-renamed-column', async () => {
        // `.keepOnly('projectName')` drops every staged entry except the renamed
        // `name`; the staged `slug` is removed.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Only name kept', projectSlug: 'removed-slug' })
                .keepOnly('projectName')
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 where id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Only name kept",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-set-if-has-value-and-has-no-value', async () => {
        // `.set({projectName})` stages `name` with a value. `.setIfHasValue({projectName})`
        // overwrites it (its current staged value passes the value-gate);
        // `.setIfHasNoValue({projectSlug})` then fills `slug` (no value staged).
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Initial name' })
                .setIfHasValue({ projectName: 'Overwritten because had value' })
                .setIfHasNoValue({ projectSlug: 'filled-slug' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0, slug = @1 where id = @2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Overwritten because had value",
                "filled-slug",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-ignore-any-set-with-no-value', async () => {
        // `.set({projectName, archived: null})` stages a real `name` and a
        // no-value `archived` (null); `.ignoreAnySetWithNoValue()` sweeps the
        // null entry out, leaving only `name` in the SET clause.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Survives', archived: null })
                .ignoreAnySetWithNoValue()
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 where id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Survives",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-dynamic-set-no-arg-then-incremental-set', async () => {
        // `.shapedAs({...}).dynamicSet()` opens an empty shaped set; chained
        // `.set(...)` accumulates the renamed columns before the WHERE.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .dynamicSet()
                .set({ projectName: 'Via dynamicSet' })
                .set({ projectSlug: 'via-dynamic-slug' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0, slug = @1 where id = @2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Via dynamicSet",
                "via-dynamic-slug",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-allowing-no-where-updates-whole-table', async () => {
        // `updateAllowingNoWhere(...).shapedAs({...}).set({...})` executes with no
        // WHERE — the shaped allowing-no-where entry. Every seeded project (4) is
        // renamed.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Bulk renamed' })
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Bulk renamed",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })

    test('shaped-set-when-maps-renamed-key-on-true', async () => {
        // `.set({projectName})` stages the renamed `name`. `setWhen(true, {projectSlug})`
        // dispatches to `set`, staging the renamed `slug`; `setWhen(false, …)` is a noop.
        // The renamed keys are what the shaped `*When` arm accepts (the real columns are
        // rejected — see this dialect's `types.negative` suite).
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Base name' })
                .setWhen(false, { projectSlug: 'only-when-true' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            const falseSql = ctx.lastSql

            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Base name' })
                .setWhen(true, { projectSlug: 'only-when-true' })
                .where(tProject.id.equals(2))
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update project set name = @0 where id = @1"`)
            expect(trueSql).toMatchInlineSnapshot(`"update project set name = @0, slug = @1 where id = @2"`)
            expect(trueSql).not.toBe(falseSql)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-set-if-value-when-maps-and-gates-undefined', async () => {
        // `setIfValueWhen(true, {...})` dispatches to `setIfValue`: the renamed
        // `projectName` (→ name) survives; the renamed optional `archived`
        // (→ archivedAt) carries `undefined`, so the value-gate drops it.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .dynamicSet()
                .setIfValueWhen(true, { projectName: 'Renamed via setIfValueWhen', archived: undefined })
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 where id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Renamed via setIfValueWhen",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-keep-only-when-prunes-to-renamed-column', async () => {
        // `.set({projectName, projectSlug})` stages both renamed columns;
        // `keepOnlyWhen(true, 'projectName')` dispatches to `keepOnly`, keeping only
        // the renamed `name` — the keep-list takes the renamed key, not the real column.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Only name kept', projectSlug: 'removed-slug' })
                .keepOnlyWhen(true, 'projectName')
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0 where id = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Only name kept",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-dynamic-set-one-arg-then-where', async () => {
        // `.shapedAs({...}).dynamicSet({...})` — the ONE-ARG dynamicSet opener on a
        // where-required shaped update. It seeds the set in a single call using the
        // renamed keys, then still requires a WHERE before execute (the no-arg
        // form is exercised by `shaped-dynamic-set-no-arg-then-incremental-set`).
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .dynamicSet({ projectName: 'Via dynamicSet one-arg', projectSlug: 'via-dynamic-one-arg' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0, slug = @1 where id = @2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Via dynamicSet one-arg",
                "via-dynamic-one-arg",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-allowing-no-where-dynamic-set-no-arg-then-incremental-set', async () => {
        // `updateAllowingNoWhere(...).shapedAs({...}).dynamicSet()` — the NO-ARG
        // dynamicSet opener on the allowing-no-where shaped update. It opens an
        // executable (no WHERE required) empty shaped set; chained `.set(...)`
        // accumulates the renamed columns. Every seeded project (4) is renamed.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name' })
                .dynamicSet()
                .set({ projectName: 'Bulk renamed via dynamicSet no-arg' })
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Bulk renamed via dynamicSet no-arg",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })

    test('shaped-allowing-no-where-dynamic-set-one-arg', async () => {
        // `updateAllowingNoWhere(...).shapedAs({...}).dynamicSet({...})` — the
        // ONE-ARG dynamicSet opener on the allowing-no-where shaped update. It
        // seeds the renamed set in a single call and is immediately executable
        // (no WHERE required). Every seeded project (4) is renamed.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name' })
                .dynamicSet({ projectName: 'Bulk renamed via dynamicSet one-arg' })
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Bulk renamed via dynamicSet one-arg",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })

    test('shaped-from-references-from-table-column', async () => {
        // The shaped × `from` seam: `update(tProject).from(tOrganization)` joins in
        // the organization, then `.shapedAs({...})` renames the SET keys and the
        // shaped `set({...})` value references a FROM-table column
        // (`tOrganization.name`). `shapedAs` is reachable after `from` because
        // `UpdateFromExpression` still carries it. Acme Corp (the only `pro` org)
        // owns projects 1 and 2. SQL is dialect-divergent (the FROM rendering and
        // operators differ per dialect), so each cell records its own snapshot.
        const updatedProjects = [
            { id: 1, name: 'Marketing site / Acme Corp' },
            { id: 2, name: 'Internal tools / Acme Corp' },
        ]
        ctx.mockNext(2)
        ctx.mockNext(updatedProjects)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .from(tOrganization)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: tProject.name.concat(' / ').concat(tOrganization.name) })
                .where(tProject.organizationId.equals(tOrganization.id))
                .and(tOrganization.plan.equals('pro'))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = project.name + @0 + organization.name from organization where project.organization_id = organization.id and organization.[plan] = @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " / ",
                "pro",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)

            const projects = await ctx.conn.selectFrom(tProject)
                .where(tProject.organizationId.equals(1))
                .select({ id: tProject.id, name: tProject.name })
                .orderBy('id')
                .executeSelectMany()
            expect(projects).toEqual(updatedProjects)
        })
    })

    test('shaped-set-when-returning-one-row', async () => {
        // shaped-set-`*When` × returning: a shaped `setWhen(true, {...})` followed by
        // `.returning({...})` on the renamed keys. The renamed `projectName` (→ name)
        // is staged, `setWhen(true, {projectSlug})` stages the renamed slug, and the
        // UPDATE returns the renamed columns. RETURNING is dialect-gated, so the
        // snapshot diverges and the test is NOT-APPLICABLE where RETURNING is absent.
        const expectedMock = { id: 1, name: 'Renamed via shaped setWhen', slug: 'shaped-when-returning' }
        ctx.mockNext(expectedMock)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Renamed via shaped setWhen' })
                .setWhen(true, { projectSlug: 'shaped-when-returning' })
                .where(tProject.id.equals(1))
                .returning({ id: tProject.id, name: tProject.name, slug: tProject.slug })
                .executeUpdateOne()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = @0, slug = @1 output inserted.id as id, inserted.name as name, inserted.slug as slug where id = @2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Renamed via shaped setWhen",
                "shaped-when-returning",
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number, name: string, slug: string }>>()
            expect(row).toEqual(expectedMock)
        })
    })
})
