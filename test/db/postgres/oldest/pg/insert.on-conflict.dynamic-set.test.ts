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
//   - `.shapedAs({…})` before the conflict opener renames the update-set keys;
//     a chained `.set({…})` then maps each renamed key back to its real column.
//
// The static `.onConflictDoUpdateSet({...})` / `.doUpdateSet({...})` paths
// are already pinned by the static on-conflict coverage; this file only
// exercises the dynamic + value-gated variants.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tAppUser, tProject } from '../../domain/connection.js'
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4, slug = $5"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4, slug = $5"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
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

    // ── On-conflict update-set manipulation family ──────────────────────
    // Each helper below, when chained after `doUpdateDynamicSet({...})`,
    // routes into the ON CONFLICT update-set (`__onConflictUpdateSets`)
    // instead of the regular INSERT `__sets` — the distinct branch the
    // single-row / multi-row INSERT cases don't reach. The seed already
    // holds (org 1, 'mktg-site'), so the conflict fires and the existing
    // row is updated.

    test('set-if-set-updates-only-already-staged-columns-on-conflict', async () => {
        // `setIfSet(...)` overwrites a column only when its key is already
        // present in the staged update-set. `name` was staged so it is
        // overwritten; `slug` was never staged so it is skipped.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfSet({ name: 'Renamed', slug: 'mktg-site-v2' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Renamed",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('set-if-set-if-value-keeps-staged-slug-when-new-value-missing-on-conflict', async () => {
        // `setIfSetIfValue(...)` overwrites a staged column only when the
        // NEW value also passes `_isValue`. `name` gets a real new value so
        // it is overwritten; `slug` is staged but its new value is
        // `undefined`, so the staged 'mktg-site-keep' is kept untouched.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', slug: 'mktg-site-keep' })
                .setIfSetIfValue({ name: 'Renamed', slug: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4, slug = $5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Renamed",
                "mktg-site-keep",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('set-if-not-set-fills-only-unstaged-columns-on-conflict', async () => {
        // `setIfNotSet(...)` sets a column only when its key is NOT already
        // present. `name` was staged so it is left as 'Reactivated'; `slug`
        // was never staged so it is added.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfNotSet({ name: 'ignored', slug: 'mktg-site-v2' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4, slug = $5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Reactivated",
                "mktg-site-v2",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('set-if-not-set-if-value-adds-unstaged-column-only-with-a-value-on-conflict', async () => {
        // `setIfNotSetIfValue(...)` sets an unstaged column only when its
        // new value passes `_isValue`. `slug` is unstaged with a real value
        // so it is added; `archivedAt` is unstaged but `undefined` so it is
        // dropped before the SET clause.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfNotSetIfValue({ slug: 'mktg-site-v2', archivedAt: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4, slug = $5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Reactivated",
                "mktg-site-v2",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('ignore-if-set-drops-a-staged-column-on-conflict', async () => {
        // `ignoreIfSet(...)` removes a column from the update-set when its
        // key is present, regardless of value. The staged `slug` is dropped;
        // `name` survives.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', slug: 'mktg-site-v2' })
                .ignoreIfSet('slug')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
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

    test('keep-only-prunes-the-on-conflict-update-set-to-named-columns', async () => {
        // `keepOnly(...)` drops every staged column except the named ones.
        // Only `name` is kept; the staged `slug` is removed.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', slug: 'mktg-site-v2' })
                .keepOnly('name')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
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

    test('set-if-has-value-overwrites-only-columns-with-a-staged-value-on-conflict', async () => {
        // `setIfHasValue(...)` overwrites a column only when its CURRENT
        // staged value passes `_isValue`. `name` has a staged value so it is
        // overwritten; `slug` was never staged (no value) so it is skipped.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfHasValue({ name: 'Renamed', slug: 'mktg-site-v2' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Renamed",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('set-if-has-value-if-value-keeps-staged-slug-when-new-value-missing-on-conflict', async () => {
        // `setIfHasValueIfValue(...)` overwrites a column only when its
        // staged value AND the new value both pass `_isValue`. `name` is
        // overwritten; `slug` has a staged value but its new value is
        // `undefined`, so the staged 'mktg-site-keep' survives.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', slug: 'mktg-site-keep' })
                .setIfHasValueIfValue({ name: 'Renamed', slug: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4, slug = $5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Renamed",
                "mktg-site-keep",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('set-if-has-no-value-fills-only-columns-lacking-a-value-on-conflict', async () => {
        // `setIfHasNoValue(...)` sets a column only when its current staged
        // value has NO value. `name` has a staged value so it is left
        // unchanged; `slug` was never staged (no value) so it is filled.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfHasNoValue({ name: 'ignored', slug: 'mktg-site-v2' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4, slug = $5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Reactivated",
                "mktg-site-v2",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('set-if-has-no-value-if-value-fills-unvalued-column-only-with-a-value-on-conflict', async () => {
        // `setIfHasNoValueIfValue(...)` fills a no-value column only when the
        // new value passes `_isValue`. `slug` (no staged value) gets a real
        // value; `archivedAt` (no staged value) is offered `undefined`, which
        // fails the value gate and is dropped.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfHasNoValueIfValue({ slug: 'mktg-site-v2', archivedAt: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4, slug = $5"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
                "Reactivated",
                "mktg-site-v2",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('ignore-if-has-value-drops-a-column-with-a-staged-value-on-conflict', async () => {
        // `ignoreIfHasValue(...)` removes a column from the update-set when
        // its staged value passes `_isValue`. The staged `slug` is dropped;
        // `name` survives.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', slug: 'mktg-site-v2' })
                .ignoreIfHasValue('slug')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
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

    test('ignore-any-set-with-no-value-prunes-all-unvalued-entries-on-conflict', async () => {
        // `ignoreAnySetWithNoValue()` removes every staged entry whose value
        // has no value. The staged `archivedAt` is null (no value) so it is
        // pruned; the real-valued `name` survives. Distinct from
        // `ignoreIfHasNoValue('archivedAt')` above: it names no column and
        // sweeps the whole set.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', archivedAt: null })
                .ignoreAnySetWithNoValue()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
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

    test('ignore-any-set-emptying-the-on-conflict-update-set-degrades-to-conflict-noop', async () => {
        // Emptying the on-conflict update-set entirely: `ignoreAnySetWithNoValue()`
        // prunes the lone staged `archivedAt: null` (no value), leaving no column to
        // assign. Rather than dropping the whole clause — which would turn the upsert
        // back into a plain insert that throws on conflict — the builder degrades to
        // the conflict-ignoring no-op. Seed (org 1, 'mktg-site') exists, so the
        // conflict fires and nothing is inserted or updated → 0 affected.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ archivedAt: null })
                .ignoreAnySetWithNoValue()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(0)
        })
    })

    test('disallow-guards-allow-the-on-conflict-update-when-no-rule-is-violated', async () => {
        // The `disallow*` guards route into the ON CONFLICT update-set
        // (`__onConflictUpdateSets`) when chained after `doUpdateDynamicSet(...)`,
        // the same distinct branch the set-manipulation family above exercises.
        // Each guard's condition is unmet, so none throws and the upsert
        // proceeds: only `name` is in the conflict update-set, so
        // `disallowIfNotSet`/`disallowIfNoValue` pass (name is set with a
        // value), `disallowIfSet`/`disallowIfValue` pass (slug/archivedAt are
        // absent from the set), and `disallowAnyOtherSet` passes (name is the
        // sole entry). Seed (org 1, 'mktg-site') exists → the conflict fires
        // and the row is updated → 1 row.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .disallowIfValue('archivedAt must stay unset', 'archivedAt')
                .disallowIfNoValue('name is required', 'name')
                .disallowIfSet('slug is fixed on conflict', 'slug')
                .disallowIfNotSet('name is required', 'name')
                .disallowAnyOtherSet('only name may change on conflict', 'name')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do update set name = $4"`)
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

    test('shaped-do-update-dynamic-set-maps-renamed-key-to-real-column', async () => {
        // `shapedAs({...})` renames the source-object keys to real columns; the
        // insert `.set({...})` supplies every required column under those renamed
        // keys. After `onConflictOn(...).doUpdateDynamicSet()` opens the conflict
        // update-set, the chained `.set({ projectName: ... })` keeps using the
        // renamed `projectName` key, which maps back to the real `name` column.
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
                .doUpdateDynamicSet()
                .set({ projectName: 'Renamed via shape' })
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


    test('on-constraint-do-update-set-if-value-passes-real-valued-properties-through-the-gate', async () => {
        // `onConflictOnConstraint(rawFragment`name`).doUpdateSetIfValue({...})` --
        // the value-gated one-shot update-set reached through the CONSTRAINT-target
        // opener (the column-target opener reaches it elsewhere). Each property is
        // tested with `_isValue` before being added; both `fullName` and `verified`
        // carry real values, so both survive the gate. The unique constraint
        // `app_user_email_key` is PostgreSQL's default name for the inline
        // `email ... UNIQUE` declaration in domain/schema.sql; (email
        // 'ada@acme.test') collides with the seed so the conflict fires and the
        // row is updated.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ada@acme.test', fullName: 'ignored' })
                .onConflictOnConstraint(ctx.conn.rawFragment`app_user_email_key`)
                .doUpdateSetIfValue({
                    fullName: 'Ada Lovelace v2',
                    verified: true,
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values ($1, $2) on conflict on constraint app_user_email_key do update set full_name = $3, verified = case when $4::bool then 'Y' else 'N' end"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "ignored",
                "Ada Lovelace v2",
                true,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('on-constraint-do-update-dynamic-set-then-set-builds-incremental-update', async () => {
        // `onConflictOnConstraint(rawFragment`name`).doUpdateDynamicSet()` opens an
        // empty update-set reached through the CONSTRAINT-target opener; a chained
        // `.set({...})` dispatches into it. The unique constraint
        // `app_user_email_key` is PostgreSQL's default name for the inline
        // `email ... UNIQUE` declaration in domain/schema.sql; (email
        // 'ada@acme.test') collides with the seed so the conflict fires and the
        // row is updated.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tAppUser)
                .values({ email: 'ada@acme.test', fullName: 'ignored' })
                .onConflictOnConstraint(ctx.conn.rawFragment`app_user_email_key`)
                .doUpdateDynamicSet()
                .set({ fullName: 'Ada Lovelace v2' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into app_user (email, full_name) values ($1, $2) on conflict on constraint app_user_email_key do update set full_name = $3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "ada@acme.test",
                "ignored",
                "Ada Lovelace v2",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('one-shot-do-update-set-if-value-emptying-the-on-conflict-update-set-degrades-to-conflict-noop', async () => {
        // The one-shot `doUpdateSetIfValue({archivedAt: undefined})` form: its only property
        // fails the value gate and is dropped, leaving no column to assign. Rather than
        // dropping the whole clause — which would turn the upsert back into a plain
        // insert that throws on conflict — the builder degrades to the conflict-ignoring
        // no-op. Seed (org 1, 'mktg-site') exists, so the conflict fires and nothing is
        // inserted or updated → 0 affected.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSetIfValue({ archivedAt: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(0)
        })
    })
    // ── Empty-on-conflict degrade × RETURNING / constraint compositions ──────
    // When the on-conflict update-set empties, the builder degrades to the
    // conflict no-op (`… do nothing`) instead of dropping the whole clause; these
    // pin that the trailing RETURNING / returningLastInsertedId clause and the
    // CONSTRAINT-target opener survive the degrade.

    test('empty-on-conflict-update-set-degrades-to-conflict-noop-preserving-returning-id', async () => {
        // `doUpdateDynamicSet({archivedAt:null})` then `ignoreAnySetWithNoValue()`
        // prunes the lone no-value entry, emptying the update-set; the builder
        // degrades to `… do nothing` but the trailing `.returning({id})` SURVIVES
        // the degrade. Seed (org 1, 'mktg-site') exists, so the conflict fires,
        // nothing is inserted or updated, and the suppressed row makes
        // `executeInsertNoneOrOne()` resolve to null.
        ctx.mockNext(null)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ archivedAt: null })
                .ignoreAnySetWithNoValue()
                .returning({ id: tProject.id })
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do nothing returning id as id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
              ]
            `)
            assertType<Exact<typeof row, { id: number } | null>>()
            expect(row).toBeNull()
        })
    })

    test('empty-on-conflict-update-set-degrades-to-conflict-noop-preserving-returning-object-many', async () => {
        // The one-shot `doUpdateSetIfValue({archivedAt:undefined})` empties the
        // update-set (the sole property fails the value gate); the builder degrades
        // to `… do nothing` and the trailing multi-column `.returning({id, name,
        // slug})` still renders after the no-op. Seed (org 1, 'mktg-site') exists,
        // so the conflict fires, the row is suppressed, and `executeInsertMany()`
        // resolves to an empty array.
        const expected: Array<{ id: number, name: string, slug: string }> = []
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const rows = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSetIfValue({ archivedAt: undefined })
                .returning({ id: tProject.id, name: tProject.name, slug: tProject.slug })
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do nothing returning id as id, name as name, slug as slug"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
              ]
            `)
            assertType<Exact<typeof rows, Array<{ id: number, name: string, slug: string }>>>()
            expect(rows).toEqual(expected)
        })
    })

    test('empty-on-conflict-update-set-degrades-to-conflict-noop-preserving-returning-last-inserted-id', async () => {
        // Emptying the update-set degrades to `… do nothing`, and a trailing
        // `.returningLastInsertedId()` still emits `returning id`. This row does NOT
        // collide (fresh slug), so the insert proceeds and the new id comes back —
        // proving the RETURNING id survives the degrade on the inserted path.
        ctx.mockNext(1001)
        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'degrade-fresh-slug', name: 'Degrade fresh' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ archivedAt: null })
                .ignoreAnySetWithNoValue()
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do nothing returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "degrade-fresh-slug",
                "Degrade fresh",
              ]
            `)
            assertType<Exact<typeof id, number>>()
            expect(typeof id).toBe('number')
            if (!ctx.realDbEnabled) expect(id).toBe(1001)
            else expect(id).toBeGreaterThan(4) // seed reserves project ids 1-4
        })
    })

    test('empty-on-conflict-on-constraint-set-degrades-to-conflict-noop', async () => {
        // The CONSTRAINT-target opener also degrades when its update-set empties.
        // `onConflictOnConstraint(rawFragment).doUpdateSetIfValue({archivedAt:undefined})`
        // drops the sole undefined property, leaving no column to assign; the
        // builder degrades to `on conflict on constraint project_organization_id_slug_key
        // do nothing`. That constraint is PostgreSQL's default name for the inline
        // `UNIQUE (organization_id, slug)` declaration; (org 1, 'mktg-site') collides
        // with the seed, so the conflict fires and nothing is inserted or updated → 0.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOnConstraint(ctx.conn.rawFragment`project_organization_id_slug_key`)
                .doUpdateSetIfValue({ archivedAt: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict on constraint project_organization_id_slug_key do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(0)
        })
    })
    test('empty-on-conflict-update-set-degrade-on-colliding-row-throws-mandatory-value-not-received', async () => {
        // Emptying the update-set degrades the statement to `… do nothing`, and the row
        // COLLIDES (org 1, 'mktg-site' — the seed row) so it is suppressed. The degrade
        // still types the returningLastInsertedId result as a NON-null `number`, but the
        // suppressed row returns no id, so the guard throws
        // MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE. The control twin below (a plain
        // onConflictDoNothing, typed `number | null`) resolves null instead.
        ctx.mockNext(null)
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tProject)
                    .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                    .onConflictOn(tProject.organizationId, tProject.slug)
                    .doUpdateDynamicSet({ archivedAt: null })
                    .ignoreAnySetWithNoValue()
                    .returningLastInsertedId()
                    .executeInsert()
            } catch (e) { caught = e }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do nothing returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
              ]
            `)
            expect(caught instanceof TsSqlError ? caught.errorReason.reason : caught)
                .toBe('MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE')
        })
    })

    test('conflict-do-nothing-returning-last-inserted-id-on-colliding-row-resolves-null', async () => {
        // The control twin for the degrade throw above: a plain
        // `onConflictDoNothing().returningLastInsertedId()` on the SAME colliding row
        // types the result `number | null`, so the suppressed row resolves to null
        // rather than throwing.
        ctx.mockNext(null)
        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictDoNothing()
                .returningLastInsertedId()
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict do nothing returning id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
              ]
            `)
            assertType<Exact<typeof id, number | null>>()
            expect(id).toBeNull()
        })
    })

    test('empty-on-conflict-update-set-with-where-degrades-dropping-the-where', async () => {
        // `doUpdateSetIfValue({archivedAt:undefined})` empties the
        // update-set (sole property fails the value gate), THEN a `.where(cond)`. The
        // builder degrades to `… do nothing`, and the do-update `where` clause is DROPPED
        // — `do nothing` has no where slot, so the where is REPLACED (not mis-applied).
        // A legitimate NOT-APPLICABLE-shaped boundary that emits valid SQL. (org 1,
        // 'mktg-site') collides with the seed → nothing inserted → 0.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSetIfValue({ archivedAt: undefined })
                .where(tProject.name.equals('whatever'))
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(0)
        })
    })

    test('empty-on-conflict-update-set-degrades-preserving-conflict-target-where', async () => {
        // The conflict-TARGET where (the partial-index predicate emitted BEFORE the DO
        // clause) SURVIVES the empty-degrade — distinct from the DO-UPDATE where, which is
        // DROPPED by the degrade (see the `…-with-where-degrades-dropping-the-where` sibling).
        // `onConflictOn(cols).where(archived_at is null)` sets the arbiter predicate;
        // `doUpdateDynamicSet({archivedAt:null}).ignoreAnySetWithNoValue()` empties the
        // update-set, so the builder degrades to `… where archived_at is null do nothing` —
        // the target-where is emitted before `do nothing`, so it is preserved, not replaced.
        // (org 1, 'mktg-site') collides with the seed, so the conflict fires and nothing is
        // inserted or updated → 0 affected.
        ctx.mockNext(0)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .where(tProject.archivedAt.isNull())
                .doUpdateDynamicSet({ archivedAt: null })
                .ignoreAnySetWithNoValue()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) where archived_at is null do nothing"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(0)
        })
    })

    test('empty-on-conflict-update-set-degrades-preserving-returning-one-column-none-or-one', async () => {
        // The scalar `returningOneColumn(col)` sibling of the object-`returning` degrade
        // tests: `doUpdateDynamicSet({archivedAt:null}).ignoreAnySetWithNoValue()` empties
        // the update-set → degrades to `… do nothing`, and the trailing
        // `.returningOneColumn(id)` SURVIVES the degrade. (org 1, 'mktg-site') collides, so
        // the row is suppressed and `executeInsertNoneOrOne()` resolves null.
        ctx.mockNext(undefined)
        await ctx.withRollback(async () => {
            const id = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ archivedAt: null })
                .ignoreAnySetWithNoValue()
                .returningOneColumn(tProject.id)
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do nothing returning id as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
              ]
            `)
            assertType<Exact<typeof id, number | null>>()
            expect(id).toBeNull()
        })
    })

    test('empty-on-conflict-update-set-degrades-preserving-returning-one-column-many', async () => {
        // The `executeInsertMany()` shape of the same scalar-returning degrade: the
        // suppressed row makes the scalar-array result an empty array.
        const expected: number[] = []
        ctx.mockNext(expected)
        await ctx.withRollback(async () => {
            const ids = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ archivedAt: null })
                .ignoreAnySetWithNoValue()
                .returningOneColumn(tProject.id)
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do nothing returning id as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
              ]
            `)
            assertType<Exact<typeof ids, number[]>>()
            expect(ids).toEqual(expected)
        })
    })

    test('empty-on-conflict-update-set-degrades-preserving-returning-one-column-one-throws-no-result', async () => {
        // The `executeInsertOne()` shape: the degrade suppresses the colliding row, so the
        // scalar-returning statement produces zero rows and the exactly-one contract throws
        // NO_RESULT — output-coincident with the standalone execute-shapes coverage but
        // reached through the empty-degrade path.
        ctx.mockNext(undefined)
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tProject)
                    .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                    .onConflictOn(tProject.organizationId, tProject.slug)
                    .doUpdateDynamicSet({ archivedAt: null })
                    .ignoreAnySetWithNoValue()
                    .returningOneColumn(tProject.id)
                    .executeInsertOne()
            } catch (e) { caught = e }
            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict (organization_id, slug) do nothing returning id as result"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
              ]
            `)
            expect(caught instanceof TsSqlError ? caught.errorReason.reason : caught).toBe('NO_RESULT')
        })
    })

    test('empty-on-conflict-update-set-degrades-preserving-returning-under-shaped', async () => {
        // The SHAPED opener (`shapedAs({...}).set({...})` on renamed keys) composed with the
        // empty-degrade and a trailing RETURNING: `doUpdateSetIfValue({archivedAt:undefined})`
        // empties the update-set → degrades to `… do nothing`, and the `.returning({id})`
        // still renders after the shaped INSERT. (org 1, 'mktg-site') collides → suppressed →
        // executeInsertNoneOrOne resolves null.
        ctx.mockNext(null)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.insertInto(tProject)
                .shapedAs({
                    orgId:       'organizationId',
                    projectName: 'name',
                    projectSlug: 'slug',
                    arch:        'archivedAt',
                })
                .set({
                    orgId:       1,
                    projectName: 'ignored',
                    projectSlug: 'mktg-site',
                })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateSetIfValue({ arch: undefined })
                .returning({ id: tProject.id })
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values ($1, $2, $3) on conflict (organization_id, slug) do nothing returning id as id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
              ]
            `)
            assertType<Exact<typeof row, { id: number } | null>>()
            expect(row).toBeNull()
        })
    })

    test('empty-on-conflict-on-constraint-set-degrades-preserving-returning', async () => {
        // The CONSTRAINT-target degrade (the `…-on-constraint-set-degrades` sibling) with a
        // trailing RETURNING: `onConflictOnConstraint(rawFragment).doUpdateSetIfValue({archivedAt:undefined})`
        // empties the update-set → degrades to `on conflict on constraint … do nothing`, and the
        // trailing `.returning({id})` still renders after the no-op. That constraint is
        // PostgreSQL's default name for the inline `UNIQUE (organization_id, slug)`; (org 1,
        // 'mktg-site') collides → suppressed → executeInsertNoneOrOne resolves null.
        ctx.mockNext(null)
        await ctx.withRollback(async () => {
            const row = await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOnConstraint(ctx.conn.rawFragment`project_organization_id_slug_key`)
                .doUpdateSetIfValue({ archivedAt: undefined })
                .returning({ id: tProject.id })
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, slug, name) values ($1, $2, $3) on conflict on constraint project_organization_id_slug_key do nothing returning id as id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "mktg-site",
                "ignored",
              ]
            `)
            assertType<Exact<typeof row, { id: number } | null>>()
            expect(row).toBeNull()
        })
    })

})
