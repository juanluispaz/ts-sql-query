// Dynamic `ON CONFLICT … DO UPDATE` builders in
// [InsertQueryBuilder.ts:1662-1820](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L1662-L1820):
//
//   - `.onConflictOn(col).doUpdateDynamicSet({…?})` opens an empty (or
//     pre-populated) update-set; subsequent `.set(...)` / `.setIfValue(...)`
//     calls route into `__onConflictUpdateSets` instead of the regular
//     `__sets`.
//   - `.onConflictOn(col).doUpdateSetIfValue({...})` is the one-shot
//     value-gated variant — properties whose values fail `_isValue` are
//     dropped before the SET clause is emitted.
//   - The bare-form siblings (`.onConflictDoUpdateDynamicSet({…?})` and
//     `.onConflictDoUpdateSetIfValue({...})`) are mariadb/mysql/sqlite only
//     and are commented out for symmetry in the cells whose dialect does
//     not type them.
//
// The static `.onConflictDoUpdateSet({...})` / `.doUpdateSet({...})` paths
// are already pinned by `insert.on-conflict.test.ts`; this file only
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
        // chained `.set(...)` calls dispatch into the opened set via
        // [InsertQueryBuilder.ts:428-435](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L428-L435).
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
        // `undefined` fails `_isValue` ([InsertQueryBuilder.ts:454-476](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L454-L476)).
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
        // Initial-columns form: `doUpdateDynamicSet({...})` at
        // [InsertQueryBuilder.ts:1761-1773](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L1761-L1773)
        // seeds the on-conflict update-set in one shot (delegates to
        // `doUpdateSet`); the chained `setIfValue({slug: undefined})`
        // is dropped via `_isValue`
        // ([InsertQueryBuilder.ts:448-478](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L448-L478)).
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
        // One-shot `doUpdateSetIfValue({...})` at
        // [InsertQueryBuilder.ts:1806-1828](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L1806-L1828):
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

})
