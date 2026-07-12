// Shaped INSERT entry points — `shapedAs({...})` renames the source-object keys to
// real columns, then the insert is driven through one of the shaped entry methods:
// `values`, `setIfValue`, `dynamicSet` (no-arg + one-shot), `dynamicValues`, and
// `extendShape`. Dialect-independent (the emitted SQL is a plain INSERT under the
// real column names the shape maps back to).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tIssue, tOrganization, tProject, tWebhookEvent } from '../../domain/connection.js'
import { ctx } from './setup.js'

// The disallow rules throw a `TsSqlProcessingError` (an `Error`) onto which
// the InsertQueryBuilder attaches the runtime-only `disallowedProperty` /
// `disallowedIndex` fields (set via direct assignment in src, not part of the
// public typed surface). This shape narrows the caught `unknown` so the
// assertions read those fields without an `any` local.
type DisallowError = Error & { disallowedProperty?: unknown; disallowedIndex?: unknown }

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

    test('shaped-set-if-value-gates-defaulted-non-nullable-shaped-key', async () => {
        // `.shapedAs({...}).setIfValue({...})` where the optional renamed key
        // `pub` maps to `published` — a defaulted, NON-nullable column. Passing
        // `null` skips it (the value-gate) so it takes its DB default, exactly
        // like the non-shaped `setIfValue` does. A defaulted, non-nullable shaped key
        // accepts both `null` and `undefined` at the value-gate and skips it either way
        // (the sibling defaulted null-skip tests below exercise `undefined`); this test
        // pins the `null` arm — what distinguishes it from the nullable case above.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    pub:         'published',
                })
                .setIfValue({
                    orgId:       1,
                    projectName: 'Shaped skip defaulted',
                    projectSlug: 'shaped-skip-defaulted',
                    pub:         null,
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped skip defaulted",
                "shaped-skip-defaulted",
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
                "2024-05-05 00:00:00",
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
                "2024-05-05 00:00:00",
                1,
                "Shaped FAHNV D",
                "shaped-fahnv-d",
                "2024-06-06 00:00:00",
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })
    test('shaped-dynamic-values-single-object', async () => {
        // The shaped single-object `.dynamicValues({...})` overload: the renamed keys
        // map to their real columns in the emitted column list.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .dynamicValues({
                    orgId:       1,
                    projectName: 'Shaped dyn single',
                    projectSlug: 'shaped-dyn-single',
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped dyn single",
                "shaped-dyn-single",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-set-if-set', async () => {
        // `.setIfSet({...})` overwrites only renamed keys already staged.
        // `projectName` (name) was staged → overwritten; `archived` (archived_at)
        // was not staged → skipped.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .set({ orgId: 1, projectName: 'Prior', projectSlug: 'shaped-set-if-set' })
                .setIfSet({ projectName: 'Overwritten', archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Overwritten",
                "shaped-set-if-set",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-set-if-set-if-value', async () => {
        // `.setIfSetIfValue({...})` needs BOTH prior-set AND a non-empty incoming.
        // `projectName` (name) was staged + real value → overwritten; `archived`
        // (archived_at) was staged but its incoming is `undefined` → value-gate
        // drops it, so the originally staged date stands.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .set({ orgId: 1, projectName: 'Prior', projectSlug: 'shaped-set-if-set-if-value', archived: new Date('2024-05-05T00:00:00Z') })
                .setIfSetIfValue({ projectName: 'Overwritten', archived: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Overwritten",
                "shaped-set-if-set-if-value",
                "2024-05-05 00:00:00",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-set-if-not-set', async () => {
        // `.setIfNotSet({...})` fills only renamed keys NOT already staged.
        // `projectName` (name) was staged → override dropped; `archived`
        // (archived_at) was not staged → filled.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .set({ orgId: 1, projectName: 'Kept', projectSlug: 'shaped-set-if-not-set' })
                .setIfNotSet({ projectName: 'dropped', archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Kept",
                "shaped-set-if-not-set",
                "2024-06-06 00:00:00",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-set-if-not-set-if-value', async () => {
        // `.setIfNotSetIfValue({...})` fills only renamed keys NOT already staged
        // whose incoming passes `_isValue`. `projectName` staged → dropped;
        // `archived` not staged but incoming `undefined` → value-gate skips; a
        // second call supplies a real `archived` → filled.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .set({ orgId: 1, projectName: 'Kept', projectSlug: 'shaped-set-if-not-set-if-value' })
                .setIfNotSetIfValue({ projectName: 'dropped', archived: undefined })
                .setIfNotSetIfValue({ archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Kept",
                "shaped-set-if-not-set-if-value",
                "2024-06-06 00:00:00",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-set-if-has-value', async () => {
        // `.setIfHasValue({...})` overwrites only renamed keys whose currently
        // staged value is non-null. `projectName` (name) has a value → overwritten;
        // `archived` (archived_at) is staged null → skipped (stays null).
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .set({ orgId: 1, projectName: 'Base', projectSlug: 'shaped-set-if-has-value', archived: null })
                .setIfHasValue({ projectName: 'Overwritten', archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Overwritten",
                "shaped-set-if-has-value",
                null,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-set-if-has-value-if-value', async () => {
        // `.setIfHasValueIfValue({...})` needs BOTH the staged value non-null AND
        // the incoming passing `_isValue`. `projectName` qualifies → overwritten;
        // `archived` is staged with a value but its incoming is `undefined`, so the
        // value-gate keeps the originally staged date.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .set({ orgId: 1, projectName: 'Base', projectSlug: 'shaped-set-if-has-value-if-value', archived: new Date('2024-05-05T00:00:00Z') })
                .setIfHasValueIfValue({ projectName: 'Overwritten', archived: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Overwritten",
                "shaped-set-if-has-value-if-value",
                "2024-05-05 00:00:00",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-set-if-has-no-value', async () => {
        // `.setIfHasNoValue({...})` sets only renamed keys whose currently staged
        // value IS null. `archived` (archived_at) is staged null → filled;
        // `projectName` (name) has a value → skipped.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .set({ orgId: 1, projectName: 'Base', projectSlug: 'shaped-set-if-has-no-value', archived: null })
                .setIfHasNoValue({ projectName: 'skip', archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Base",
                "shaped-set-if-has-no-value",
                "2024-06-06 00:00:00",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-set-if-has-no-value-if-value', async () => {
        // `.setIfHasNoValueIfValue({...})` needs BOTH the staged value null AND the
        // incoming passing `_isValue`. `archived` (archived_at) is staged null +
        // real incoming → filled; `projectName` (name) has a value so the
        // HasNoValue gate skips it.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .set({ orgId: 1, projectName: 'Base', projectSlug: 'shaped-set-if-has-no-value-if-value', archived: null })
                .setIfHasNoValueIfValue({ projectName: 'skip', archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Base",
                "shaped-set-if-has-no-value-if-value",
                "2024-06-06 00:00:00",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-ignore-if-set', async () => {
        // `.ignoreIfSet('archived')` removes the staged renamed `archived`
        // (archived_at) from the column list because it was set. Ignoring an
        // OPTIONAL key keeps every required key present, so the insert stays
        // executable.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .set({ orgId: 1, projectName: 'Base', projectSlug: 'shaped-ignore-if-set', archived: new Date('2024-05-05T00:00:00Z') })
                .ignoreIfSet('archived')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Base",
                "shaped-ignore-if-set",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-keep-only', async () => {
        // `.keepOnly('orgId','projectName','projectSlug')` drops any staged renamed
        // key not in the kept list — the staged `archived` (archived_at) is
        // removed. Keeping every required key leaves the insert executable.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .set({ orgId: 1, projectName: 'Base', projectSlug: 'shaped-keep-only', archived: new Date('2024-05-05T00:00:00Z') })
                .keepOnly('orgId', 'projectName', 'projectSlug')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Base",
                "shaped-keep-only",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-ignore-if-has-value', async () => {
        // `.ignoreIfHasValue('archived')` drops the renamed `archived`
        // (archived_at) from the column list because its staged value is non-null.
        // The argument type only admits OPTIONAL renamed keys.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .set({ orgId: 1, projectName: 'Base', projectSlug: 'shaped-ignore-if-has-value', archived: new Date('2024-05-05T00:00:00Z') })
                .ignoreIfHasValue('archived')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Base",
                "shaped-ignore-if-has-value",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-ignore-if-has-no-value', async () => {
        // `.ignoreIfHasNoValue('archived')` drops the renamed `archived`
        // (archived_at) because its staged value IS null.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .set({ orgId: 1, projectName: 'Base', projectSlug: 'shaped-ignore-if-has-no-value', archived: null })
                .ignoreIfHasNoValue('archived')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Base",
                "shaped-ignore-if-has-no-value",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-ignore-any-set-with-no-value', async () => {
        // `.ignoreAnySetWithNoValue()` sweeps every staged renamed key whose value
        // is null/undefined — the staged `archived` (archived_at) is null so it is
        // removed; the required renamed keys survive.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    archived:    'archivedAt',
                })
                .set({ orgId: 1, projectName: 'Base', projectSlug: 'shaped-ignore-any-set-with-no-value', archived: null })
                .ignoreAnySetWithNoValue()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Base",
                "shaped-ignore-any-set-with-no-value",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-disallow-if-set', async () => {
        // `.disallowIfSet(msg, 'archived')` throws synchronously because the
        // renamed `archived` (archived_at) is staged. The guard maps the renamed
        // key to its real column to decide, so the throw proves the remap. No SQL
        // is built.
        await ctx.withRollback(async () => {
            expect(() => {
                ctx.conn.insertInto(tProject)
                    .shapedAs({
                        orgId:       'organizationId',
                        projectName: 'name',
                        projectSlug: 'slug',
                        archived:    'archivedAt',
                    })
                    .set({ orgId: 1, projectName: 'Base', projectSlug: 'shaped-disallow-if-set', archived: new Date('2024-05-05T00:00:00Z') })
                    .disallowIfSet('archived is set by the workflow', 'archived')
            }).toThrow(/archived is set by the workflow/)
        })
    })

    test('shaped-disallow-if-not-set', async () => {
        // `.disallowIfNotSet(msg, 'archived')` throws synchronously because the
        // renamed `archived` (archived_at) is NOT staged. No SQL is built.
        await ctx.withRollback(async () => {
            expect(() => {
                ctx.conn.insertInto(tProject)
                    .shapedAs({
                        orgId:       'organizationId',
                        projectName: 'name',
                        projectSlug: 'slug',
                        archived:    'archivedAt',
                    })
                    .set({ orgId: 1, projectName: 'Base', projectSlug: 'shaped-disallow-if-not-set' })
                    .disallowIfNotSet('archived is required on this workflow', 'archived')
            }).toThrow(/archived is required on this workflow/)
        })
    })

    test('shaped-disallow-if-value', async () => {
        // `.disallowIfValue(msg, 'archived')` throws synchronously because the
        // renamed `archived` (archived_at) is staged with a value. No SQL is built.
        await ctx.withRollback(async () => {
            expect(() => {
                ctx.conn.insertInto(tProject)
                    .shapedAs({
                        orgId:       'organizationId',
                        projectName: 'name',
                        projectSlug: 'slug',
                        archived:    'archivedAt',
                    })
                    .set({ orgId: 1, projectName: 'Base', projectSlug: 'shaped-disallow-if-value', archived: new Date('2024-05-05T00:00:00Z') })
                    .disallowIfValue('archived must stay unset', 'archived')
            }).toThrow(/archived must stay unset/)
        })
    })

    test('shaped-disallow-if-no-value', async () => {
        // `.disallowIfNoValue(msg, 'archived')` throws synchronously because the
        // renamed `archived` (archived_at) is staged null (no value). No SQL is
        // built.
        await ctx.withRollback(async () => {
            expect(() => {
                ctx.conn.insertInto(tProject)
                    .shapedAs({
                        orgId:       'organizationId',
                        projectName: 'name',
                        projectSlug: 'slug',
                        archived:    'archivedAt',
                    })
                    .set({ orgId: 1, projectName: 'Base', projectSlug: 'shaped-disallow-if-no-value', archived: null })
                    .disallowIfNoValue('archived must have a value', 'archived')
            }).toThrow(/archived must have a value/)
        })
    })

    test('shaped-disallow-any-other-set', async () => {
        // `.disallowAnyOtherSet(msg, 'orgId','projectName','projectSlug')` throws
        // synchronously because the staged renamed `archived` (archived_at) falls
        // outside the allow-list. No SQL is built.
        await ctx.withRollback(async () => {
            expect(() => {
                ctx.conn.insertInto(tProject)
                    .shapedAs({
                        orgId:       'organizationId',
                        projectName: 'name',
                        projectSlug: 'slug',
                        archived:    'archivedAt',
                    })
                    .set({ orgId: 1, projectName: 'Base', projectSlug: 'shaped-disallow-any-other-set', archived: new Date('2024-05-05T00:00:00Z') })
                    .disallowAnyOtherSet('only core columns allowed', 'orgId', 'projectName', 'projectSlug')
            }).toThrow(/only core columns allowed/)
        })
    })

    test('shaped-multi-row-set-for-all-if-set', async () => {
        // `.setForAllIfSet({archived})` overrides `archived` on every row that
        // already staged it. Both rows staged it → both overwritten.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FA IfSet A', projectSlug: 'shaped-fa-ifset-a', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'FA IfSet B', projectSlug: 'shaped-fa-ifset-b', archived: new Date('2024-05-05T00:00:00Z') },
                ])
                .setForAllIfSet({ archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?), (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "FA IfSet A",
                "shaped-fa-ifset-a",
                "2024-06-06 00:00:00",
                1,
                "FA IfSet B",
                "shaped-fa-ifset-b",
                "2024-06-06 00:00:00",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-multi-row-set-for-all-if-not-set', async () => {
        // `.setForAllIfNotSet({archived})` fills `archived` only on rows that did
        // NOT stage it. Neither row staged it → both filled.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FA IfNotSet A', projectSlug: 'shaped-fa-ifnotset-a' },
                    { orgId: 1, projectName: 'FA IfNotSet B', projectSlug: 'shaped-fa-ifnotset-b' },
                ])
                .setForAllIfNotSet({ archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?), (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "FA IfNotSet A",
                "shaped-fa-ifnotset-a",
                "2024-06-06 00:00:00",
                1,
                "FA IfNotSet B",
                "shaped-fa-ifnotset-b",
                "2024-06-06 00:00:00",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-multi-row-set-for-all-if-has-value', async () => {
        // `.setForAllIfHasValue({archived})` overrides `archived` on rows whose
        // staged value is non-null. Both rows staged a date → both overwritten.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FA HasValue A', projectSlug: 'shaped-fa-ifhasvalue-a', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'FA HasValue B', projectSlug: 'shaped-fa-ifhasvalue-b', archived: new Date('2024-05-05T00:00:00Z') },
                ])
                .setForAllIfHasValue({ archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?), (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "FA HasValue A",
                "shaped-fa-ifhasvalue-a",
                "2024-06-06 00:00:00",
                1,
                "FA HasValue B",
                "shaped-fa-ifhasvalue-b",
                "2024-06-06 00:00:00",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-multi-row-set-for-all-if-has-no-value', async () => {
        // `.setForAllIfHasNoValue({archived})` backfills `archived` on rows whose
        // staged value IS null. Both rows staged null → both backfilled.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FA HasNoValue A', projectSlug: 'shaped-fa-ifhasnovalue-a', archived: null },
                    { orgId: 1, projectName: 'FA HasNoValue B', projectSlug: 'shaped-fa-ifhasnovalue-b', archived: null },
                ])
                .setForAllIfHasNoValue({ archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?), (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "FA HasNoValue A",
                "shaped-fa-ifhasnovalue-a",
                "2024-06-06 00:00:00",
                1,
                "FA HasNoValue B",
                "shaped-fa-ifhasnovalue-b",
                "2024-06-06 00:00:00",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-multi-row-set-for-all-if-set-if-value', async () => {
        // `.setForAllIfSetIfValue({archived})` — the IfSet gate plus an incoming
        // value-gate. Both rows staged `archived` and the incoming is real → both
        // overwritten.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FA IfSetIV A', projectSlug: 'shaped-fa-ifsetifvalue-a', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'FA IfSetIV B', projectSlug: 'shaped-fa-ifsetifvalue-b', archived: new Date('2024-05-05T00:00:00Z') },
                ])
                .setForAllIfSetIfValue({ archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?), (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "FA IfSetIV A",
                "shaped-fa-ifsetifvalue-a",
                "2024-06-06 00:00:00",
                1,
                "FA IfSetIV B",
                "shaped-fa-ifsetifvalue-b",
                "2024-06-06 00:00:00",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-multi-row-set-for-all-if-not-set-if-value', async () => {
        // `.setForAllIfNotSetIfValue({archived})` — the IfNotSet gate plus an
        // incoming value-gate. Neither row staged `archived` and the incoming is
        // real → both filled.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FA IfNotSetIV A', projectSlug: 'shaped-fa-ifnotsetifvalue-a' },
                    { orgId: 1, projectName: 'FA IfNotSetIV B', projectSlug: 'shaped-fa-ifnotsetifvalue-b' },
                ])
                .setForAllIfNotSetIfValue({ archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?), (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "FA IfNotSetIV A",
                "shaped-fa-ifnotsetifvalue-a",
                "2024-06-06 00:00:00",
                1,
                "FA IfNotSetIV B",
                "shaped-fa-ifnotsetifvalue-b",
                "2024-06-06 00:00:00",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-multi-row-set-for-all-if-has-value-if-value', async () => {
        // `.setForAllIfHasValueIfValue({archived})` — the HasValue gate plus an
        // incoming value-gate. Both rows staged a date and the incoming is real →
        // both overwritten.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FA HasValueIV A', projectSlug: 'shaped-fa-ifhasvalueifvalue-a', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'FA HasValueIV B', projectSlug: 'shaped-fa-ifhasvalueifvalue-b', archived: new Date('2024-05-05T00:00:00Z') },
                ])
                .setForAllIfHasValueIfValue({ archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?), (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "FA HasValueIV A",
                "shaped-fa-ifhasvalueifvalue-a",
                "2024-06-06 00:00:00",
                1,
                "FA HasValueIV B",
                "shaped-fa-ifhasvalueifvalue-b",
                "2024-06-06 00:00:00",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-multi-row-set-for-all-if-has-no-value-if-value', async () => {
        // `.setForAllIfHasNoValueIfValue({archived})` — the HasNoValue gate plus an
        // incoming value-gate. Both rows staged null and the incoming is real →
        // both backfilled.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FA HasNoValueIV A', projectSlug: 'shaped-fa-ifhasnovalueifvalue-a', archived: null },
                    { orgId: 1, projectName: 'FA HasNoValueIV B', projectSlug: 'shaped-fa-ifhasnovalueifvalue-b', archived: null },
                ])
                .setForAllIfHasNoValueIfValue({ archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?), (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "FA HasNoValueIV A",
                "shaped-fa-ifhasnovalueifvalue-a",
                "2024-06-06 00:00:00",
                1,
                "FA HasNoValueIV B",
                "shaped-fa-ifhasnovalueifvalue-b",
                "2024-06-06 00:00:00",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-multi-row-set-for-all-if-value-when', async () => {
        // `.setForAllIfValueWhen(when, {archived})` dispatches to `setForAllIfValue`
        // when true (sets `archived` on every row, gated only by the incoming
        // value), no-op when false.
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FAIVW A', projectSlug: 'shaped-faivw-a', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'FAIVW B', projectSlug: 'shaped-faivw-b', archived: new Date('2024-05-05T00:00:00Z') },
                ])
                .setForAllIfValueWhen(false, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FAIVW C', projectSlug: 'shaped-faivw-c', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'FAIVW D', projectSlug: 'shaped-faivw-d', archived: new Date('2024-05-05T00:00:00Z') },
                ])
                .setForAllIfValueWhen(true, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                "FAIVW A",
                "shaped-faivw-a",
                "2024-05-05 00:00:00",
                1,
                "FAIVW B",
                "shaped-faivw-b",
                "2024-05-05 00:00:00",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                "FAIVW C",
                "shaped-faivw-c",
                "2024-06-06 00:00:00",
                1,
                "FAIVW D",
                "shaped-faivw-d",
                "2024-06-06 00:00:00",
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })

    test('shaped-multi-row-set-for-all-if-set-when', async () => {
        // `.setForAllIfSetWhen(when, {archived})` dispatches to `setForAllIfSet`
        // when true (overrides `archived` on rows that staged it), no-op when
        // false. Both rows staged `archived`.
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FASW A', projectSlug: 'shaped-fasw-a', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'FASW B', projectSlug: 'shaped-fasw-b', archived: new Date('2024-05-05T00:00:00Z') },
                ])
                .setForAllIfSetWhen(false, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FASW C', projectSlug: 'shaped-fasw-c', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'FASW D', projectSlug: 'shaped-fasw-d', archived: new Date('2024-05-05T00:00:00Z') },
                ])
                .setForAllIfSetWhen(true, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                "FASW A",
                "shaped-fasw-a",
                "2024-05-05 00:00:00",
                1,
                "FASW B",
                "shaped-fasw-b",
                "2024-05-05 00:00:00",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                "FASW C",
                "shaped-fasw-c",
                "2024-06-06 00:00:00",
                1,
                "FASW D",
                "shaped-fasw-d",
                "2024-06-06 00:00:00",
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })

    test('shaped-multi-row-set-for-all-if-not-set-when', async () => {
        // `.setForAllIfNotSetWhen(when, {archived})` dispatches to
        // `setForAllIfNotSet` when true (fills `archived` on rows that did not
        // stage it), no-op when false. Neither row staged `archived`, so the true
        // arm adds the archived_at column.
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FANSW A', projectSlug: 'shaped-fansw-a' },
                    { orgId: 1, projectName: 'FANSW B', projectSlug: 'shaped-fansw-b' },
                ])
                .setForAllIfNotSetWhen(false, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FANSW C', projectSlug: 'shaped-fansw-c' },
                    { orgId: 1, projectName: 'FANSW D', projectSlug: 'shaped-fansw-d' },
                ])
                .setForAllIfNotSetWhen(true, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                "FANSW A",
                "shaped-fansw-a",
                1,
                "FANSW B",
                "shaped-fansw-b",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                "FANSW C",
                "shaped-fansw-c",
                "2024-06-06 00:00:00",
                1,
                "FANSW D",
                "shaped-fansw-d",
                "2024-06-06 00:00:00",
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })

    test('shaped-multi-row-set-for-all-if-has-value-when', async () => {
        // `.setForAllIfHasValueWhen(when, {archived})` dispatches to
        // `setForAllIfHasValue` when true (overrides `archived` on rows whose staged
        // value is non-null), no-op when false. Both rows staged a date.
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FAHVW A', projectSlug: 'shaped-fahvw-a', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'FAHVW B', projectSlug: 'shaped-fahvw-b', archived: new Date('2024-05-05T00:00:00Z') },
                ])
                .setForAllIfHasValueWhen(false, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FAHVW C', projectSlug: 'shaped-fahvw-c', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'FAHVW D', projectSlug: 'shaped-fahvw-d', archived: new Date('2024-05-05T00:00:00Z') },
                ])
                .setForAllIfHasValueWhen(true, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                "FAHVW A",
                "shaped-fahvw-a",
                "2024-05-05 00:00:00",
                1,
                "FAHVW B",
                "shaped-fahvw-b",
                "2024-05-05 00:00:00",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                "FAHVW C",
                "shaped-fahvw-c",
                "2024-06-06 00:00:00",
                1,
                "FAHVW D",
                "shaped-fahvw-d",
                "2024-06-06 00:00:00",
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })

    test('shaped-multi-row-set-for-all-if-set-if-value-when', async () => {
        // `.setForAllIfSetIfValueWhen(when, {archived})` dispatches to
        // `setForAllIfSetIfValue` when true (IfSet gate + incoming value-gate),
        // no-op when false. Both rows staged `archived`; the incoming is real.
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FASIVW A', projectSlug: 'shaped-fasivw-a', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'FASIVW B', projectSlug: 'shaped-fasivw-b', archived: new Date('2024-05-05T00:00:00Z') },
                ])
                .setForAllIfSetIfValueWhen(false, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FASIVW C', projectSlug: 'shaped-fasivw-c', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'FASIVW D', projectSlug: 'shaped-fasivw-d', archived: new Date('2024-05-05T00:00:00Z') },
                ])
                .setForAllIfSetIfValueWhen(true, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                "FASIVW A",
                "shaped-fasivw-a",
                "2024-05-05 00:00:00",
                1,
                "FASIVW B",
                "shaped-fasivw-b",
                "2024-05-05 00:00:00",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                "FASIVW C",
                "shaped-fasivw-c",
                "2024-06-06 00:00:00",
                1,
                "FASIVW D",
                "shaped-fasivw-d",
                "2024-06-06 00:00:00",
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })

    test('shaped-multi-row-set-for-all-if-not-set-if-value-when', async () => {
        // `.setForAllIfNotSetIfValueWhen(when, {archived})` dispatches to
        // `setForAllIfNotSetIfValue` when true (IfNotSet gate + incoming
        // value-gate), no-op when false. Neither row staged `archived`.
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FANSIVW A', projectSlug: 'shaped-fansivw-a' },
                    { orgId: 1, projectName: 'FANSIVW B', projectSlug: 'shaped-fansivw-b' },
                ])
                .setForAllIfNotSetIfValueWhen(false, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FANSIVW C', projectSlug: 'shaped-fansivw-c' },
                    { orgId: 1, projectName: 'FANSIVW D', projectSlug: 'shaped-fansivw-d' },
                ])
                .setForAllIfNotSetIfValueWhen(true, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                "FANSIVW A",
                "shaped-fansivw-a",
                1,
                "FANSIVW B",
                "shaped-fansivw-b",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                "FANSIVW C",
                "shaped-fansivw-c",
                "2024-06-06 00:00:00",
                1,
                "FANSIVW D",
                "shaped-fansivw-d",
                "2024-06-06 00:00:00",
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })

    test('shaped-multi-row-set-for-all-if-has-value-if-value-when', async () => {
        // `.setForAllIfHasValueIfValueWhen(when, {archived})` dispatches to
        // `setForAllIfHasValueIfValue` when true (HasValue gate + incoming
        // value-gate), no-op when false. Both rows staged a date.
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FAHVIVW A', projectSlug: 'shaped-fahvivw-a', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'FAHVIVW B', projectSlug: 'shaped-fahvivw-b', archived: new Date('2024-05-05T00:00:00Z') },
                ])
                .setForAllIfHasValueIfValueWhen(false, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FAHVIVW C', projectSlug: 'shaped-fahvivw-c', archived: new Date('2024-05-05T00:00:00Z') },
                    { orgId: 1, projectName: 'FAHVIVW D', projectSlug: 'shaped-fahvivw-d', archived: new Date('2024-05-05T00:00:00Z') },
                ])
                .setForAllIfHasValueIfValueWhen(true, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                "FAHVIVW A",
                "shaped-fahvivw-a",
                "2024-05-05 00:00:00",
                1,
                "FAHVIVW B",
                "shaped-fahvivw-b",
                "2024-05-05 00:00:00",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                "FAHVIVW C",
                "shaped-fahvivw-c",
                "2024-06-06 00:00:00",
                1,
                "FAHVIVW D",
                "shaped-fahvivw-d",
                "2024-06-06 00:00:00",
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })

    test('shaped-multi-row-set-for-all-if-has-no-value-if-value-when', async () => {
        // `.setForAllIfHasNoValueIfValueWhen(when, {archived})` dispatches to
        // `setForAllIfHasNoValueIfValue` when true (HasNoValue gate + incoming
        // value-gate), no-op when false. Both rows staged null, so the true arm
        // backfills the date.
        ctx.mockNext(2)
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FAHNVIVW A', projectSlug: 'shaped-fahnvivw-a', archived: null },
                    { orgId: 1, projectName: 'FAHNVIVW B', projectSlug: 'shaped-fahnvivw-b', archived: null },
                ])
                .setForAllIfHasNoValueIfValueWhen(false, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'FAHNVIVW C', projectSlug: 'shaped-fahnvivw-c', archived: null },
                    { orgId: 1, projectName: 'FAHNVIVW D', projectSlug: 'shaped-fahnvivw-d', archived: null },
                ])
                .setForAllIfHasNoValueIfValueWhen(true, { archived: new Date('2024-06-06T00:00:00Z') })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                "FAHNVIVW A",
                "shaped-fahnvivw-a",
                null,
                1,
                "FAHNVIVW B",
                "shaped-fahnvivw-b",
                null,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                "FAHNVIVW C",
                "shaped-fahnvivw-c",
                "2024-06-06 00:00:00",
                1,
                "FAHNVIVW D",
                "shaped-fahnvivw-d",
                "2024-06-06 00:00:00",
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })

    test('shaped-values-returning-object', async () => {
        // Shaped INSERT + object `.returning({...})`: each renamed shape key inserts
        // its real column and the object projection reads columns back. The
        // autogenerated id is non-deterministic on a real DB, the name is not.
        const expected = { id: 900, name: 'Shaped returning obj' }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .values({ orgId: 1, projectName: 'Shaped returning obj', projectSlug: 'shaped-returning-obj' })
                .returning({ id: tProject.id, name: tProject.name })
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) returning id as id, name as name"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped returning obj",
                "shaped-returning-obj",
              ]
            `)
            assertType<Exact<typeof row, { id: number, name: string }>>()
            expect(row.name).toBe('Shaped returning obj')
            if (!ctx.realDbEnabled) expect(row.id).toBe(900)
            else expect(typeof row.id).toBe('number')
        })
    })

    test('shaped-returning-projecting-optional-values-as-nullable', async () => {
        // `.projectingOptionalValuesAsNullable()` after a shaped object
        // `.returning({...})` turns the optional `archivedAt` into a present
        // `| null`. The inserted row leaves archived_at unset → null (present).
        const expected = { id: 900, archivedAt: null }
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .values({ orgId: 1, projectName: 'Shaped nullable', projectSlug: 'shaped-nullable' })
                .returning({ id: tProject.id, archivedAt: tProject.archivedAt })
                .projectingOptionalValuesAsNullable()
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) returning id as id, archived_at as archivedAt"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped nullable",
                "shaped-nullable",
              ]
            `)
            assertType<Exact<typeof row, { id: number, archivedAt: Date | null }>>()
            expect(row.archivedAt).toBeNull()
            if (!ctx.realDbEnabled) expect(row.id).toBe(900)
            else expect(typeof row.id).toBe('number')
        })
    })

    test('shaped-values-returning-last-inserted-id', async () => {
        // Shaped INSERT + `.returningLastInsertedId()`: the renamed shape inserts a
        // project and its autogenerated id comes back. The id is non-deterministic
        // on a real DB.
        ctx.mockNext(900)
        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .values({ orgId: 1, projectName: 'Shaped last id', projectSlug: 'shaped-last-id' })
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped last id",
                "shaped-last-id",
              ]
            `)
            assertType<Exact<typeof id, number>>()
            if (!ctx.realDbEnabled) expect(id).toBe(900)
            else expect(typeof id).toBe('number')
        })
    })

    test('shaped-on-conflict-do-update-set-where-then-and-or', async () => {
        // The shaped on-conflict DO UPDATE … WHERE chain with an `.or()`:
        // `onConflictOn(cols).doUpdateSet({shapedKey}).where(c1).and(c2).or(c3)` —
        // the compound partial-UPDATE predicate off a shaped upsert. The renamed
        // `projectName` maps back to `name`; the predicate is `c1 AND c2 OR c3`.
        // Seed (org 1, 'mktg-site') exists so the conflict fires; project 1 is not
        // archived and its name differs, so the first clause holds → the row is
        // updated.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ projectName: 'Marketing site v6' })
                .where(tProject.name.notEquals('Marketing site v6'))
                    .and(tProject.archivedAt.isNull())
                    .or(tProject.published.equals(false))
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ? where (project.name <> ? and project.archived_at is null) or (project.published = 't') = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Marketing site v6",
                "Marketing site v6",
                false,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) expect(typeof affected).toBe('number')
            else expect(affected).toBe(1)
        })
    })


    test('shaped-multi-row-ignore-if-set', async () => {
        // `.shapedAs({...}).values([...]).ignoreIfSet('archived')` — the shaped
        // multi-row `ignoreIfSet`. The renamed `archived` (→ archived_at) is
        // staged in both rows; ignoreIfSet drops it from the whole batch, so the
        // emitted column list omits archived_at entirely.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'Shaped II A', projectSlug: 'shaped-ii-a', archived: new Date('2024-01-02T00:00:00Z') },
                    { orgId: 1, projectName: 'Shaped II B', projectSlug: 'shaped-ii-b', archived: new Date('2024-01-03T00:00:00Z') },
                ])
                .ignoreIfSet('archived')
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?), (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped II A",
                "shaped-ii-a",
                1,
                "Shaped II B",
                "shaped-ii-b",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-multi-row-keep-only', async () => {
        // `.shapedAs({...}).values([...]).keepOnly(...)` — the shaped multi-row
        // `keepOnly` prunes every row down to the listed renamed keys. The
        // renamed `archived` staged in both rows is swept away, so the emitted
        // column list is just the three kept columns.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'Shaped KO A', projectSlug: 'shaped-ko-a', archived: new Date('2024-02-02T00:00:00Z') },
                    { orgId: 1, projectName: 'Shaped KO B', projectSlug: 'shaped-ko-b', archived: new Date('2024-02-03T00:00:00Z') },
                ])
                .keepOnly('orgId', 'projectName', 'projectSlug')
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?), (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped KO A",
                "shaped-ko-a",
                1,
                "Shaped KO B",
                "shaped-ko-b",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-multi-row-ignore-if-has-value', async () => {
        // `.ignoreIfHasValue('archived')` on the shaped multi-row chain: drops
        // the renamed `archived` from any row where it carries a value. Row 0
        // stages a date (dropped), row 1 stages null.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'Shaped IHV A', projectSlug: 'shaped-ihv-a', archived: new Date('2024-03-02T00:00:00Z') },
                    { orgId: 1, projectName: 'Shaped IHV B', projectSlug: 'shaped-ihv-b', archived: null },
                ])
                .ignoreIfHasValue('archived')
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?), (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped IHV A",
                "shaped-ihv-a",
                null,
                1,
                "Shaped IHV B",
                "shaped-ihv-b",
                null,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-multi-row-ignore-if-has-no-value', async () => {
        // `.ignoreIfHasNoValue('archived')` on the shaped multi-row chain: drops
        // the renamed `archived` from any row where it is null/absent. Row 0
        // stages a date (kept), row 1 stages null (dropped).
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'Shaped IHNV A', projectSlug: 'shaped-ihnv-a', archived: new Date('2024-04-02T00:00:00Z') },
                    { orgId: 1, projectName: 'Shaped IHNV B', projectSlug: 'shaped-ihnv-b', archived: null },
                ])
                .ignoreIfHasNoValue('archived')
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug, archived_at) values (?, ?, ?, ?), (?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped IHNV A",
                "shaped-ihnv-a",
                "2024-04-02 00:00:00",
                1,
                "Shaped IHNV B",
                "shaped-ihnv-b",
                null,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-multi-row-ignore-any-set-with-no-value', async () => {
        // `.ignoreAnySetWithNoValue()` on the shaped multi-row chain: sweeps any
        // renamed key staged as null out of each row. Both rows stage the
        // renamed `archived` as null, so archived_at drops from the batch.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'Shaped IASWNV A', projectSlug: 'shaped-iaswnv-a', archived: null },
                    { orgId: 1, projectName: 'Shaped IASWNV B', projectSlug: 'shaped-iaswnv-b', archived: null },
                ])
                .ignoreAnySetWithNoValue()
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?), (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "Shaped IASWNV A",
                "shaped-iaswnv-a",
                1,
                "Shaped IASWNV B",
                "shaped-iaswnv-b",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(2)
        })
    })

    test('shaped-multi-row-disallow-if-set', () => {
        // Multi-row branch of the shaped `disallowIfSet`. Row 0 omits the renamed
        // `archived` (its column is optional); row 1 stages it → throws with the
        // renamed key as `disallowedProperty` and the row index as
        // `disallowedIndex`.
        let thrown: unknown
        try {
            ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'A', projectSlug: 'a' },
                    { orgId: 1, projectName: 'B', projectSlug: 'b', archived: new Date('2024-05-02T00:00:00Z') },
                ])
                .disallowIfSet('archived must never be staged in bulk import', 'archived')
        } catch (e) { thrown = e }
        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as DisallowError
        expect(err.message).toContain('archived must never be staged in bulk import')
        expect(err.disallowedProperty).toBe('archived')
        expect(err.disallowedIndex).toBe(1)
        expect(thrown instanceof TsSqlError ? thrown.errorReason.reason : undefined).toBe('DISALLOWED_BY_QUERY_RULE')
    })

    test('shaped-multi-row-disallow-if-not-set', () => {
        // Multi-row branch of the shaped `disallowIfNotSet`. Row 1 omits the
        // required renamed `projectSlug`; the shaped row type forbids that, so
        // the row is cast to reach the runtime guard, which fires on the first
        // row missing the key.
        let thrown: unknown
        try {
            ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug' })
                .values([
                    { orgId: 1, projectName: 'A', projectSlug: 'a' },
                    // Cast bypasses the shaped-row type so the required renamed key
                    // `projectSlug` can be omitted, reaching the runtime guard.
                    { orgId: 1, projectName: 'B' } as any,
                ])
                .disallowIfNotSet('slug is mandatory in bulk import', 'projectSlug')
        } catch (e) { thrown = e }
        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as DisallowError
        expect(err.message).toContain('slug is mandatory in bulk import')
        expect(err.disallowedProperty).toBe('projectSlug')
        expect(err.disallowedIndex).toBe(1)
    })

    test('shaped-multi-row-disallow-if-value', () => {
        // Multi-row branch of the shaped `disallowIfValue`. Row 0 stages the
        // renamed `archived` as null (fails the value gate); row 1 stages a date
        // (passes) → the throw fires on row 1.
        let thrown: unknown
        try {
            ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'A', projectSlug: 'a', archived: null },
                    { orgId: 1, projectName: 'B', projectSlug: 'b', archived: new Date('2024-06-02T00:00:00Z') },
                ])
                .disallowIfValue('archived must be set by the workflow', 'archived')
        } catch (e) { thrown = e }
        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as DisallowError
        expect(err.message).toContain('archived must be set by the workflow')
        expect(err.disallowedProperty).toBe('archived')
        expect(err.disallowedIndex).toBe(1)
    })

    test('shaped-multi-row-disallow-if-no-value', () => {
        // Multi-row branch of the shaped `disallowIfNoValue`. Row 0 stages the
        // renamed `archived` with a date (passes); row 1 stages null (fails) →
        // the throw fires on row 1.
        let thrown: unknown
        try {
            ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'A', projectSlug: 'a', archived: new Date('2024-07-02T00:00:00Z') },
                    { orgId: 1, projectName: 'B', projectSlug: 'b', archived: null },
                ])
                .disallowIfNoValue('archived is required for every row', 'archived')
        } catch (e) { thrown = e }
        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as DisallowError
        expect(err.message).toContain('archived is required for every row')
        expect(err.disallowedProperty).toBe('archived')
        expect(err.disallowedIndex).toBe(1)
    })

    test('shaped-multi-row-disallow-any-other-set', () => {
        // Multi-row branch of the shaped `disallowAnyOtherSet`. Row 0 stages only
        // allowed renamed keys; row 1 stages the renamed `isPublished`, not in the
        // allow-list → throws with the renamed key as `disallowedProperty` and the
        // row index as `disallowedIndex`.
        let thrown: unknown
        try {
            ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', isPublished: 'published' })
                .values([
                    { orgId: 1, projectName: 'A', projectSlug: 'a' },
                    { orgId: 1, projectName: 'B', projectSlug: 'b', isPublished: true },
                ])
                .disallowAnyOtherSet('only org/name/slug may be bulk-imported', 'orgId', 'projectName', 'projectSlug')
        } catch (e) { thrown = e }
        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as DisallowError
        expect(err.message).toContain('only org/name/slug may be bulk-imported')
        expect(err.disallowedProperty).toBe('isPublished')
        expect(err.disallowedIndex).toBe(1)
    })

    test('shaped-multi-row-disallow-if-value-error-instance', () => {
        // The Error-INSTANCE overload of the disallow guards on the shaped
        // multi-row chain. Passing an `Error` object instead of a message throws
        // THAT SAME instance as-is — not wrapped in a TsSqlError — with the
        // tripped renamed key as `disallowedProperty` and the row index as
        // `disallowedIndex`. Row 1 stages the renamed `archived` with a value,
        // so the guard fires on row 1.
        const sentinel = new Error('archived must be set by the workflow')
        let caught: unknown
        try {
            ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .values([
                    { orgId: 1, projectName: 'A', projectSlug: 'a', archived: null },
                    { orgId: 1, projectName: 'B', projectSlug: 'b', archived: new Date('2024-08-02T00:00:00Z') },
                ])
                .disallowIfValue(sentinel, 'archived')
        } catch (e) { caught = e }
        expect(caught).toBe(sentinel)
        const err = caught as DisallowError
        expect(err.disallowedProperty).toBe('archived')
        expect(err.disallowedIndex).toBe(1)
    })
    // A shaped `.setIfValue({k: null})` where the renamed key maps a defaulted,
    // NON-nullable column: `null` skips it (the value-gate drops it), so the INSERT
    // column list omits it and the DB supplies its default. Per kind with a real DB
    // DEFAULT: enum (event_type DEFAULT 'created'), bigint (view_count DEFAULT 0), and
    // the Y/N boolean adapter (organization.verified DEFAULT 'N').

    test('shaped-set-if-value-null-skips-enum-defaulted-shaped-key', async () => {
        // `evt` → event_type (enum, DEFAULT 'created'): null skips it, so the INSERT
        // lists only issue_id and the DB fills event_type.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tWebhookEvent)
                .shapedAs({ iss: 'issueId', evt: 'eventType' })
                .setIfValue({ iss: 1, evt: null })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into webhook_event (issue_id) values (?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-set-if-value-null-skips-bigint-defaulted-shaped-key', async () => {
        // `vc` → view_count (bigint, DEFAULT 0): null skips it, so the INSERT lists the
        // required issue columns without view_count and the DB fills the default.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tIssue)
                .shapedAs({ pid: 'projectId', num: 'number', ttl: 'title', st: 'status', pr: 'priority', vc: 'viewCount' })
                .setIfValue({ pid: 1, num: 9001, ttl: 'Bigint default skip', st: 'open', pr: 2, vc: null })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                9001,
                "Bigint default skip",
                "open",
                2,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-set-if-value-null-skips-boolean-adapter-defaulted-shaped-key', async () => {
        // `v` → verified (boolean with the Y/N CustomBooleanTypeAdapter, DEFAULT 'N' —
        // a different mapping than the t/f published column): null skips it, so
        // the INSERT lists only name and plan.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .shapedAs({ n: 'name', p: 'plan', v: 'verified' })
                .setIfValue({ n: 'Skip Verified Inc', p: 'free', v: null })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Skip Verified Inc",
                "free",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

    test('shaped-set-if-value-undefined-skips-defaulted-shaped-key', async () => {
        // A defaulted-non-nullable shaped column accepts `undefined` too (not only null)
        // and skips identically — the enum event_type is dropped, leaving only issue_id.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tWebhookEvent)
                .shapedAs({ iss: 'issueId', evt: 'eventType' })
                .setIfValue({ iss: 1, evt: undefined })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into webhook_event (issue_id) values (?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            expect(inserted).toBe(1)
        })
    })

})
