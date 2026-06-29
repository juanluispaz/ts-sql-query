// Shaped UPDATE set surface. `shapedAs({...})` renames the source-object keys to
// real columns; the set-manipulation family (`setIfValue`, `setIfSet`, `setIfNotSet`,
// `ignoreIfSet`, `keepOnly`, `setIfHasValue`/`setIfHasNoValue`, `ignoreAnySetWithNoValue`,
// the `dynamicSet()` opener) and the allowing-no-where entry all operate on the renamed
// keys. Dialect-independent (a plain UPDATE under the real column names).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = :0 where id = :1"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = :0 where id = :1"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = :0, slug = :1 where id = :2"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = :0 where id = :1"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = :0 where id = :1"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = :0, slug = :1 where id = :2"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = :0 where id = :1"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = :0, slug = :1 where id = :2"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Bulk renamed",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })
})
