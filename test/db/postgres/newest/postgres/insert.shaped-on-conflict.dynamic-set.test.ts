// SHAPED ON CONFLICT update-set manipulation family — the SHAPED analogue of
// `insert.on-conflict.dynamic-set.test.ts`. After a shaped insert opener
// (`.shapedAs({…}).set({…}).onConflictOn(...).doUpdateDynamicSet({renamedKeys})`)
// the returned node is a `ShapedInsertOnConflictSetsExpression`, whose set
// family (`setIfSet`/`setIfNotSet`/`ignoreIf*`/`keepOnly`/`setIfHas*`/the
// composed-gate `*IfValue` setters) keys on the RENAMED shape keys
// (`projectName`/`projectSlug`/`archived`) while the `disallow*` guards also
// take the renamed key (the shaped twin's `ColumnsForSetOfWithShape`). The
// `*When` dispatch family of this same node is pinned by
// [insert.shaped-on-conflict.set-when-helpers.test.ts](./insert.shaped-on-conflict.set-when-helpers.test.ts);
// this file covers the NON-`When` family plus `extendShape` and `dynamicWhere`
// on the shaped conflict node.
//
// Shape used throughout: { orgId: 'organizationId', projectName: 'name',
// projectSlug: 'slug', archived: 'archivedAt' }. Seed (org 1, slug
// 'mktg-site') already exists, so every conflict fires and the existing row is
// updated; `ctx.withRollback` reverts the row between tests.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('shaped-set-if-set-updates-only-already-staged-renamed-keys-on-conflict', async () => {
        // `setIfSet(...)` overwrites a renamed key only when it is already
        // present in the staged update-set. `projectName` was staged so it is
        // overwritten; `projectSlug` was never staged so it is skipped.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfSet({ projectName: 'Renamed', projectSlug: 'mktg-site-v2' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Renamed",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-set-if-set-if-value-keeps-staged-slug-when-new-value-missing-on-conflict', async () => {
        // `setIfSetIfValue(...)` overwrites a staged renamed key only when the
        // NEW value also passes `_isValue`. `projectName` gets a real new value
        // so it is overwritten; `projectSlug` is staged but its new value is
        // `undefined`, so the staged 'mktg-site-keep' is kept untouched.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-keep' })
                .setIfSetIfValue({ projectName: 'Renamed', projectSlug: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4, slug = $5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Renamed",
                "mktg-site-keep",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-set-if-not-set-fills-only-unstaged-renamed-keys-on-conflict', async () => {
        // `setIfNotSet(...)` sets a renamed key only when it is NOT already
        // present. `projectName` was staged so it is left as 'Reactivated';
        // `projectSlug` was never staged so it is added.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfNotSet({ projectName: 'ignored', projectSlug: 'mktg-site-v2' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4, slug = $5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
                "mktg-site-v2",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-set-if-not-set-if-value-adds-unstaged-renamed-key-only-with-a-value-on-conflict', async () => {
        // `setIfNotSetIfValue(...)` sets an unstaged renamed key only when its
        // new value passes `_isValue`. `projectSlug` is unstaged with a real
        // value so it is added; `archived` is unstaged but `undefined` so it is
        // dropped before the SET clause.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfNotSetIfValue({ projectSlug: 'mktg-site-v2', archived: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4, slug = $5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
                "mktg-site-v2",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-ignore-if-set-drops-a-staged-renamed-key-on-conflict', async () => {
        // `ignoreIfSet(...)` removes a renamed key from the update-set when it
        // is present, regardless of value. The staged `projectSlug` is dropped;
        // `projectName` survives.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-v2' })
                .ignoreIfSet('projectSlug')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-keep-only-prunes-the-on-conflict-update-set-to-named-renamed-keys', async () => {
        // `keepOnly(...)` drops every staged renamed key except the named ones.
        // Only `projectName` is kept; the staged `projectSlug` is removed.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-v2' })
                .keepOnly('projectName')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-set-if-has-value-overwrites-only-renamed-keys-with-a-staged-value-on-conflict', async () => {
        // `setIfHasValue(...)` overwrites a renamed key only when its CURRENT
        // staged value passes `_isValue`. `projectName` has a staged value so it
        // is overwritten; `projectSlug` was never staged (no value) so it is
        // skipped.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfHasValue({ projectName: 'Renamed', projectSlug: 'mktg-site-v2' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Renamed",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-set-if-has-value-if-value-keeps-staged-slug-when-new-value-missing-on-conflict', async () => {
        // `setIfHasValueIfValue(...)` overwrites a renamed key only when its
        // staged value AND the new value both pass `_isValue`. `projectName` is
        // overwritten; `projectSlug` has a staged value but its new value is
        // `undefined`, so the staged 'mktg-site-keep' survives.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-keep' })
                .setIfHasValueIfValue({ projectName: 'Renamed', projectSlug: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4, slug = $5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Renamed",
                "mktg-site-keep",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-set-if-has-no-value-fills-only-renamed-keys-lacking-a-value-on-conflict', async () => {
        // `setIfHasNoValue(...)` sets a renamed key only when its current staged
        // value has NO value. `projectName` has a staged value so it is left
        // unchanged; `projectSlug` was never staged (no value) so it is filled.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfHasNoValue({ projectName: 'ignored', projectSlug: 'mktg-site-v2' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4, slug = $5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
                "mktg-site-v2",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-set-if-has-no-value-if-value-fills-unvalued-renamed-key-only-with-a-value-on-conflict', async () => {
        // `setIfHasNoValueIfValue(...)` fills a no-value renamed key only when
        // the new value passes `_isValue`. `projectSlug` (no staged value) gets
        // a real value; `archived` (no staged value) is offered `undefined`,
        // which fails the value gate and is dropped.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfHasNoValueIfValue({ projectSlug: 'mktg-site-v2', archived: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4, slug = $5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
                "mktg-site-v2",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-ignore-if-has-value-drops-a-renamed-key-with-a-staged-value-on-conflict', async () => {
        // `ignoreIfHasValue(...)` removes a renamed key from the update-set when
        // its staged value passes `_isValue`. The staged `projectSlug` is
        // dropped; `projectName` survives.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-v2' })
                .ignoreIfHasValue('projectSlug')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-ignore-if-has-no-value-prunes-a-null-renamed-key-on-conflict', async () => {
        // `ignoreIfHasNoValue(...)` removes a renamed key whose staged value has
        // NO value. The staged `archived` (→ archived_at) is null so it is
        // pruned; the real-valued `projectName` survives.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', archived: null })
                .ignoreIfHasNoValue('archived')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-ignore-any-set-with-no-value-prunes-all-unvalued-renamed-entries-on-conflict', async () => {
        // `ignoreAnySetWithNoValue()` removes every staged renamed entry whose
        // value has no value. The staged `archived` is null (no value) so it is
        // pruned; the real-valued `projectName` survives.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', archived: null })
                .ignoreAnySetWithNoValue()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-disallow-guards-allow-the-on-conflict-update-when-no-renamed-rule-is-violated', async () => {
        // The `disallow*` guards take the RENAMED shape key on the shaped twin
        // (`ColumnsForSetOfWithShape`). Each guard's condition is unmet, so none
        // throws and the upsert proceeds: only `projectName` is in the conflict
        // update-set, so `disallowIfNotSet`/`disallowIfNoValue` pass (projectName
        // is set with a value), `disallowIfSet`/`disallowIfValue` pass
        // (projectSlug/archived are absent), and `disallowAnyOtherSet` passes
        // (projectName is the sole entry).
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .disallowIfValue('archived must stay unset', 'archived')
                .disallowIfNoValue('projectName is required', 'projectName')
                .disallowIfSet('projectSlug is fixed on conflict', 'projectSlug')
                .disallowIfNotSet('projectName is required', 'projectName')
                .disallowAnyOtherSet('only projectName may change on conflict', 'projectName')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-disallow-if-set-throws-on-a-staged-renamed-key-on-conflict', async () => {
        // `disallowIfSet(...)` throws because the renamed `projectSlug` is staged
        // in the conflict update-set. The error message is the one supplied.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tProject)
                    .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                    .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                    .onConflictOn(tProject.organizationId, tProject.slug)
                    .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-v2' })
                    .disallowIfSet('projectSlug is fixed on conflict', 'projectSlug')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/projectSlug is fixed on conflict|disallow/i)
        })
    })

    test('shaped-extend-shape-then-set-adds-a-renamed-key-on-conflict', async () => {
        // `extendShape({...})` on the shaped conflict node adds a NEW renamed
        // mapping (`archived` → archived_at) to the shape, after which a chained
        // `.set({ archived })` can stage the newly-mapped column. The opener
        // shape omits `archived`; `extendShape` introduces it, then `.set(...)`
        // stages both `projectName` and the freshly-mapped `archived`.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .extendShape({ archived: 'archivedAt' })
                .set({ archived: null })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4, archived_at = $5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
                null,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-do-update-set-dynamic-where-matches-the-direct-where', async () => {
        // `dynamicWhere()` after the shaped `.doUpdateSet({renamedKey})` starts
        // an empty DO UPDATE predicate; the first `.and(...)` seeds it, so the
        // chain builds the same `c1 and c2` partial-UPDATE predicate as the
        // direct `.where(c1).and(c2)` form, which is built (not executed) and
        // compared. The renamed `projectName` maps back to `name`.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ projectName: 'Renamed via shape' })
                .dynamicWhere()
                    .and(tProject.name.notEquals('Renamed via shape'))
                    .and(tProject.archivedAt.isNull())
                .executeInsert()
            const dynamicSql = ctx.lastSql
            const dynamicParams = ctx.lastParams

            const viaWhere = ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSet({ projectName: 'Renamed via shape' })
                .where(tProject.name.notEquals('Renamed via shape'))
                    .and(tProject.archivedAt.isNull())
            expect(viaWhere.query()).toBe(dynamicSql)
            expect(viaWhere.params()).toEqual(dynamicParams)

            expect(dynamicSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4 where project.name <> $5 and project.archived_at is null"`)
            expect(dynamicParams).toMatchInlineSnapshot(`
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

})
