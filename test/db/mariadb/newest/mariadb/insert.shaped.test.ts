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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?)"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?)"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?)"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?)"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?), (?, ?, ?)"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?)"`)
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
    test('shaped-values-returning-one-column', async () => {
        // Shaped INSERT + `returningOneColumn(...)`: the renamed shape inserts a
        // project and returningOneColumn reads its autogenerated id back.
        // Commented out where INSERT RETURNING is absent.
        ctx.mockNext(900)
        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .values({
                    orgId:       1,
                    projectName: 'Shaped returning',
                    projectSlug: 'shaped-returning-one',
                })
                .returningOneColumn(tProject.id)
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) returning id as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped returning",
                "shaped-returning-one",
              ]
            `)
            assertType<Exact<typeof id, number>>()
            if (!ctx.realDbEnabled) expect(id).toBe(900)
            else expect(typeof id).toBe('number')
        })
    })


    test('shaped-multi-row-set-for-all', async () => {
        // `.shapedAs({...}).values([r1, r2]).setForAll({...})` — the shaped
        // multi-row chain. `values([...])` over the renamed keys reaches the
        // shaped executable multi-row builder; `setForAll` applies a renamed-key
        // value (`isPublished` → published) to EVERY row in the batch. Two fresh
        // (org 1, slug) pairs insert.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    isPublished: 'published',
                })
                .values([
                    { orgId: 1, projectName: 'Shaped FA A', projectSlug: 'shaped-fa-a', isPublished: false },
                    { orgId: 1, projectName: 'Shaped FA B', projectSlug: 'shaped-fa-b', isPublished: false },
                ])
                .setForAll({ isPublished: true })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, published) values (?, ?, ?, case when ? then 't' else 'f' end), (?, ?, ?, case when ? then 't' else 'f' end)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped FA A",
                "shaped-fa-a",
                true,
                1,
                "Shaped FA B",
                "shaped-fa-b",
                true,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-multi-row-set-for-all-if-value-gates-undefined', async () => {
        // `.setForAllIfValue({...})` on the shaped multi-row chain: the value-gate
        // drops an `undefined` renamed value, leaving each row's own staged value.
        // Here the renamed `isPublished` (→ published) is `undefined`, so the
        // setForAll is a no-op and the per-row published values stand.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    isPublished: 'published',
                })
                .values([
                    { orgId: 1, projectName: 'Shaped FAIV A', projectSlug: 'shaped-faiv-a', isPublished: true },
                    { orgId: 1, projectName: 'Shaped FAIV B', projectSlug: 'shaped-faiv-b', isPublished: false },
                ])
                .setForAllIfValue({ isPublished: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, published) values (?, ?, ?, case when ? then 't' else 'f' end), (?, ?, ?, case when ? then 't' else 'f' end)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped FAIV A",
                "shaped-faiv-a",
                true,
                1,
                "Shaped FAIV B",
                "shaped-faiv-b",
                false,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-multi-row-set-for-all-when-dispatches-on-true', async () => {
        // `.setForAllWhen(when, {...})` on the shaped multi-row chain dispatches to
        // `setForAll` when true (override `isPublished` → published for every row),
        // and is a no-op when false (the per-row values stand). The false/true
        // params diverge on the published column for both rows.
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    isPublished: 'published',
                })
                .values([
                    { orgId: 1, projectName: 'Shaped FAW A', projectSlug: 'shaped-faw-a', isPublished: false },
                    { orgId: 1, projectName: 'Shaped FAW B', projectSlug: 'shaped-faw-b', isPublished: false },
                ])
                .setForAllWhen(false, { isPublished: true })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    isPublished: 'published',
                })
                .values([
                    { orgId: 1, projectName: 'Shaped FAW C', projectSlug: 'shaped-faw-c', isPublished: false },
                    { orgId: 1, projectName: 'Shaped FAW D', projectSlug: 'shaped-faw-d', isPublished: false },
                ])
                .setForAllWhen(true, { isPublished: true })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped FAW A",
                "shaped-faw-a",
                false,
                1,
                "Shaped FAW B",
                "shaped-faw-b",
                false,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped FAW C",
                "shaped-faw-c",
                true,
                1,
                "Shaped FAW D",
                "shaped-faw-d",
                true,
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })

    test('shaped-multi-row-set-for-all-if-has-no-value-when-dispatches-on-true', async () => {
        // `.setForAllIfHasNoValueWhen(when, {...})` on the shaped multi-row chain
        // dispatches to `setForAllIfHasNoValue` when true: it backfills the renamed
        // optional `archived` (→ archivedAt) only on rows whose staged value fails
        // the gate. Row A staged `archived` with a value (kept); row B left it null
        // (backfilled by the true arm). The false arm leaves B null. The renamed
        // Date is bound as explicit-UTC so the param snapshot is TZ-stable.
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .values([
                    { orgId: 1, projectName: 'Shaped FAHNV A', projectSlug: 'shaped-fahnv-a', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'Shaped FAHNV B', projectSlug: 'shaped-fahnv-b', archived: null },
                ])
                .setForAllIfHasNoValueWhen(false, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .values([
                    { orgId: 1, projectName: 'Shaped FAHNV C', projectSlug: 'shaped-fahnv-c', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'Shaped FAHNV D', projectSlug: 'shaped-fahnv-d', archived: null },
                ])
                .setForAllIfHasNoValueWhen(true, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped FAHNV A",
                "shaped-fahnv-a",
                2024-05-05T00:00:00.000Z,
                1,
                "Shaped FAHNV B",
                "shaped-fahnv-b",
                null,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped FAHNV C",
                "shaped-fahnv-c",
                2024-05-05T00:00:00.000Z,
                1,
                "Shaped FAHNV D",
                "shaped-fahnv-d",
                2024-06-06T00:00:00.000Z,
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })
})
