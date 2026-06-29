// Shaped INSERT entry points — `shapedAs({...})` renames the source-object keys to
// real columns, then the insert is driven through one of the shaped entry methods:
// `values`, `setIfValue`, `dynamicSet` (no-arg + one-shot), `dynamicValues`, and
// `extendShape`. Dialect-independent (the emitted SQL is a plain INSERT under the
// real column names the shape maps back to).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('shaped-values-single-row', async () => {
        // `.shapedAs({...}).values({...})` — the single-row `values` entry on a
        // shaped insert. Each renamed key maps to its real column in the emitted
        // column list. New (org 1, slug) pair → a fresh row inserts.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .values({
                    orgId:       1,
                    projectName: 'Shaped via values',
                    projectSlug: 'shaped-values',
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, \`name\`, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped via values",
                "shaped-values",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-set-if-value-gates-optional-shaped-key', async () => {
        // `.shapedAs({...}).setIfValue({...})` — the shaped `setIfValue` entry.
        // The mandatory renamed keys are supplied; the optional renamed key
        // `archived` (→ archived_at) is `undefined`, so it is dropped before the
        // column list is built (the value-gate). New (org 1, slug) → inserts.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .setIfValue({
                    orgId:       1,
                    projectName: 'Shaped via setIfValue',
                    projectSlug: 'shaped-setifvalue',
                    archived:    undefined,
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, \`name\`, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped via setIfValue",
                "shaped-setifvalue",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-dynamic-set-one-shot', async () => {
        // `.shapedAs({...}).dynamicSet({...})` — the one-shot dynamic-set entry:
        // it seeds the insert set in a single call using the renamed keys.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .dynamicSet({
                    orgId:       1,
                    projectName: 'Shaped via dynamicSet one-shot',
                    projectSlug: 'shaped-dyn-cols',
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, \`name\`, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped via dynamicSet one-shot",
                "shaped-dyn-cols",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-dynamic-set-no-arg-then-incremental-set', async () => {
        // `.shapedAs({...}).dynamicSet()` (no-arg) opens an empty shaped set;
        // chained `.set(...)` calls accumulate the renamed columns until every
        // required key is present, then the insert becomes executable.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .dynamicSet()
                .set({ orgId: 1, projectName: 'Shaped via dynamicSet no-arg' })
                .set({ projectSlug: 'shaped-dyn-noarg' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, \`name\`, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped via dynamicSet no-arg",
                "shaped-dyn-noarg",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-dynamic-values-multi-row', async () => {
        // `.shapedAs({...}).dynamicValues([{...}, {...}])` — the multi-row shaped
        // entry: two rows under the renamed keys emit a single
        // `values (...), (...)` with the real columns. Two affected rows.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .dynamicValues([
                    { orgId: 1, projectName: 'Shaped DV A', projectSlug: 'shaped-dv-a' },
                    { orgId: 1, projectName: 'Shaped DV B', projectSlug: 'shaped-dv-b' },
                ])
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, \`name\`, slug) values (?, ?, ?), (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped DV A",
                "shaped-dv-a",
                1,
                "Shaped DV B",
                "shaped-dv-b",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-extend-shape-then-set', async () => {
        // `.shapedAs({partial}).extendShape({rest}).set({...})` — a partial shape
        // (orgId, projectName) leaves `slug` required-but-unmapped; `extendShape`
        // adds the `projectSlug` → slug mapping, after which `.set(...)` can
        // supply every required key under the renamed names.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                })
                .extendShape({ projectSlug: 'slug' })
                .set({
                    orgId:       1,
                    projectName: 'Shaped via extendShape',
                    projectSlug: 'shaped-extend',
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, \`name\`, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped via extendShape",
                "shaped-extend",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })
})
