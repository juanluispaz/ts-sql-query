// Dynamic `ON CONFLICT … DO UPDATE` builders
//
//   - `.onConflictOn(col).doUpdateDynamicSet({…?})` opens an empty (or
//     pre-populated) update-set; subsequent `.set(...)` / `.setIfValue(...)`
//     calls route into `__onConflictUpdateSets` instead of the regular
//     `__sets`.
//   - `.onConflictOn(col).doUpdateSetIfValue({...})` is the one-shot
//     value-gated variant — properties whose values fail `_isValue` are
//     dropped before the SET clause is emitted.
//   - The bare-form siblings (`.onConflictDoUpdateDynamicSet({…?})` and
//     `.onConflictDoUpdateSetIfValue({...})`) are commented out for
//     symmetry in the cells whose dialect does not type them.
//
// The static `.onConflictDoUpdateSet({...})` / `.doUpdateSet({...})` paths
// are already pinned by the static on-conflict coverage; this file only
// exercises the dynamic + value-gated variants.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('do-update-dynamic-set-then-set-builds-incremental-update', async () => {
        // `doUpdateDynamicSet()` opens an empty update-set, then two
        // chained `.set(...)` calls dispatch into the opened set
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet()
                .set({ name: 'Stage 1 name' })
                .set({ slug: 'mktg-site-v2' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?, slug = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Stage 1 name",
                "mktg-site-v2",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(1)
        })
    })

    test('do-update-dynamic-set-then-set-if-value-skips-undefined-incremental', async () => {
        // `doUpdateDynamicSet()` (no-arg form) opens an empty update-set;
        // a chained `.set({name})` adds the only surviving entry; the
        // following `.setIfValue({slug: undefined})` is dropped because
        // `undefined` fails `_isValue`.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet()
                .set({ name: 'Initial dynamic' })
                .setIfValue({ slug: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Initial dynamic",
              ]
            `)
        })
    })

    test('do-update-dynamic-set-with-initial-columns-then-set-if-value', async () => {
        // Initial-columns form: `doUpdateDynamicSet({...})`
        // seeds the on-conflict update-set in one shot (delegates to
        // `doUpdateSet`); the chained `setIfValue({slug: undefined})`
        // is dropped via `_isValue`
        // Same emitted SQL as the no-arg variant above; the difference
        // is purely the entry point.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Initial dynamic' })
                .setIfValue({ slug: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Initial dynamic",
              ]
            `)
        })
    })

    test('do-update-set-if-value-keeps-only-properties-passing-value-gate', async () => {
        // One-shot `doUpdateSetIfValue({...})`
        // each property is tested with `_isValue` before being added to
        // the update-set. `archivedAt: undefined` is filtered out, the
        // two real values survive.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSetIfValue({
                    name:       'kept-1',
                    slug:       'kept-2',
                    archivedAt: undefined,
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?, slug = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "kept-1",
                "kept-2",
              ]
            `)
        })
    })

    test('ignore-if-has-no-value-prunes-the-on-conflict-update-set', async () => {
        // `ignoreIfHasNoValue(...)` chained after `doUpdateDynamicSet({...})`
        // operates on the ON CONFLICT update-set (`__onConflictUpdateSets`),
        // not the INSERT sets — the distinct routing branch that the
        // single-row / multi-row INSERT cases don't reach. The staged
        // `archivedAt` is null so it is pruned from the SET clause; the
        // real-valued `name` survives. Seed: (org 1, 'mktg-site') already
        // exists, so the conflict fires and the row is updated -> 1 affected.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', archivedAt: null })
                .ignoreIfHasNoValue('archivedAt')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Reactivated",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
})
