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

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(1)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // ── On-conflict update-set manipulation family ──────────────────────
    // Each helper below, when chained after `doUpdateDynamicSet({...})`,
    // routes into the ON CONFLICT update-set (`__onConflictUpdateSets`)
    // instead of the regular INSERT `__sets` — the distinct branch the
    // single-row / multi-row INSERT cases don't reach. The seed already
    // holds (org 1, 'mktg-site'), so the conflict fires and the existing
    // row is updated.

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    */

})
