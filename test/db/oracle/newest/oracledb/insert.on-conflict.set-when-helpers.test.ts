// Coverage of every `*When(when: boolean, …)` conditional helper on the
// ON CONFLICT update-set node reached via
// `.onConflictOn(...).doUpdateDynamicSet({…})`. Each helper is a thin
// dispatcher that routes to its non-`When` sibling on the opened conflict
// update-set (`__onConflictUpdateSets`) when the boolean is true, or
// returns `this` unchanged when false.
//
// The behaviour of the underlying non-`When` methods (`setIfSet`,
// `ignoreIfHasValue`, `disallowIfSet`, …) is exercised by
// [insert.on-conflict.dynamic-set.test.ts](./insert.on-conflict.dynamic-set.test.ts);
// this file pins **the dispatch itself**. Each test pairs `*When(false, …)`
// against `*When(true, …)` so the snapshot delta shows the dispatch fired.
//
// Every insert opens with the seeded conflict target (org 1, slug
// 'mktg-site' already exists), so the `(organization_id, slug)` UNIQUE
// constraint fires the conflict and the DO UPDATE arm runs. The two arms
// of each test target the same existing row; `ctx.withRollback` reverts
// the row between tests.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('set-if-value-when-false-is-noop-true-overrides', async () => {
        // setIfValueWhen(false) returns `this` so the staged `name` stays.
        // setIfValueWhen(true) → setIfValue: the new value passes `_isValue`
        // so it overwrites `name`. Same column list, only the param differs.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfValueWhen(false, { name: 'Overridden via when' })
                .executeInsert()
            const falseSql = ctx.lastSql
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfValueWhen(true, { name: 'Overridden via when' })
                .executeInsert()
            const trueSql = ctx.lastSql
            const trueParams = ctx.lastParams

            expect(falseSql).toMatchInlineSnapshot()
            expect(trueSql).toMatchInlineSnapshot()
            expect(falseSql).toBe(trueSql) // same column list — only the param value differs
            expect(falseParams).toMatchInlineSnapshot()
            expect(trueParams).toMatchInlineSnapshot()
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('set-if-set-when-dispatches-on-true', async () => {
        // setIfSetWhen(true) → setIfSet: overwrites only columns already
        // staged. `name` was staged so it is overwritten; the false arm
        // leaves the staged 'Reactivated' intact.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfSetWhen(false, { name: 'Renamed via when' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfSetWhen(true, { name: 'Renamed via when' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot()
            expect(trueParams).toMatchInlineSnapshot()
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('set-if-set-if-value-when-dispatches-on-true', async () => {
        // setIfSetIfValueWhen(true) → setIfSetIfValue: overwrites a staged
        // column only when the NEW value also passes `_isValue`. `name` is
        // staged and the new value is real → overwritten in the true arm.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfSetIfValueWhen(false, { name: 'Renamed via when' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfSetIfValueWhen(true, { name: 'Renamed via when' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot()
            expect(trueParams).toMatchInlineSnapshot()
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('set-if-not-set-when-dispatches-on-true', async () => {
        // setIfNotSetWhen(true) → setIfNotSet: adds only columns NOT already
        // staged. `slug` is unstaged → added in the true arm (extra column
        // in the SET list); the false arm leaves the set untouched.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfNotSetWhen(false, { slug: 'mktg-site-v2' })
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfNotSetWhen(true, { slug: 'mktg-site-v2' })
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot()
            expect(trueSql).toMatchInlineSnapshot()
            expect(trueSql).not.toBe(falseSql)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('set-if-not-set-if-value-when-dispatches-on-true', async () => {
        // setIfNotSetIfValueWhen(true) → setIfNotSetIfValue: adds an unstaged
        // column only when its new value passes `_isValue`. `slug` is unstaged
        // with a real value → added in the true arm.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfNotSetIfValueWhen(false, { slug: 'mktg-site-v2' })
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfNotSetIfValueWhen(true, { slug: 'mktg-site-v2' })
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot()
            expect(trueSql).toMatchInlineSnapshot()
            expect(trueSql).not.toBe(falseSql)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('ignore-if-set-when-dispatches-on-true', async () => {
        // ignoreIfSetWhen(true, 'slug') → ignoreIfSet: drops `slug` from the
        // conflict update-set because its key is present. The false arm keeps
        // the staged `slug` (extra column in the SET list).
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', slug: 'mktg-site-v2' })
                .ignoreIfSetWhen(false, 'slug')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', slug: 'mktg-site-v2' })
                .ignoreIfSetWhen(true, 'slug')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot()
            expect(trueSql).toMatchInlineSnapshot()
            expect(trueSql).not.toBe(falseSql)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('keep-only-when-dispatches-on-true', async () => {
        // keepOnlyWhen(true, 'name') → keepOnly: drops every staged column
        // except `name`; the staged `slug` is removed. The false arm keeps
        // both staged columns.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', slug: 'mktg-site-v2' })
                .keepOnlyWhen(false, 'name')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', slug: 'mktg-site-v2' })
                .keepOnlyWhen(true, 'name')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot()
            expect(trueSql).toMatchInlineSnapshot()
            expect(trueSql).not.toBe(falseSql)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('set-if-has-value-when-dispatches-on-true', async () => {
        // setIfHasValueWhen(true) → setIfHasValue: overwrites a column only
        // when its CURRENT staged value passes `_isValue`. `name` has a staged
        // value → overwritten in the true arm.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfHasValueWhen(false, { name: 'Renamed via when' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfHasValueWhen(true, { name: 'Renamed via when' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot()
            expect(trueParams).toMatchInlineSnapshot()
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('set-if-has-value-if-value-when-dispatches-on-true', async () => {
        // setIfHasValueIfValueWhen(true) → setIfHasValueIfValue: the staged
        // value AND the new value must both pass `_isValue`. `name` is
        // overwritten in the true arm.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfHasValueIfValueWhen(false, { name: 'Renamed via when' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfHasValueIfValueWhen(true, { name: 'Renamed via when' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot()
            expect(trueParams).toMatchInlineSnapshot()
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('set-if-has-no-value-when-dispatches-on-true', async () => {
        // setIfHasNoValueWhen(true) → setIfHasNoValue: fills a column only
        // when its current staged value has NO value. `slug` was never staged
        // (no value) → filled in the true arm (extra column in the SET list).
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfHasNoValueWhen(false, { slug: 'mktg-site-v2' })
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfHasNoValueWhen(true, { slug: 'mktg-site-v2' })
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot()
            expect(trueSql).toMatchInlineSnapshot()
            expect(trueSql).not.toBe(falseSql)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('set-if-has-no-value-if-value-when-dispatches-on-true', async () => {
        // setIfHasNoValueIfValueWhen(true) → setIfHasNoValueIfValue: fills a
        // no-value column only when the new value passes `_isValue`. `slug`
        // (no staged value) gets a real value → added in the true arm.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfHasNoValueIfValueWhen(false, { slug: 'mktg-site-v2' })
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .setIfHasNoValueIfValueWhen(true, { slug: 'mktg-site-v2' })
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot()
            expect(trueSql).toMatchInlineSnapshot()
            expect(trueSql).not.toBe(falseSql)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('ignore-if-has-value-when-dispatches-on-true', async () => {
        // ignoreIfHasValueWhen(true, 'slug') → ignoreIfHasValue: drops `slug`
        // because its staged value passes `_isValue`. The false arm keeps the
        // staged `slug` (extra column in the SET list).
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', slug: 'mktg-site-v2' })
                .ignoreIfHasValueWhen(false, 'slug')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', slug: 'mktg-site-v2' })
                .ignoreIfHasValueWhen(true, 'slug')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot()
            expect(trueSql).toMatchInlineSnapshot()
            expect(trueSql).not.toBe(falseSql)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('ignore-if-has-no-value-when-dispatches-on-true', async () => {
        // ignoreIfHasNoValueWhen(true, 'archivedAt') → ignoreIfHasNoValue:
        // drops `archivedAt` because its staged value is null (no value). The
        // false arm keeps the staged `archivedAt` (extra column in the SET
        // list).
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', archivedAt: null })
                .ignoreIfHasNoValueWhen(false, 'archivedAt')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', archivedAt: null })
                .ignoreIfHasNoValueWhen(true, 'archivedAt')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot()
            expect(trueSql).toMatchInlineSnapshot()
            expect(trueSql).not.toBe(falseSql)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('ignore-any-set-with-no-value-when-dispatches-on-true', async () => {
        // ignoreAnySetWithNoValueWhen(true) → ignoreAnySetWithNoValue: sweeps
        // every staged entry whose value has no value. The staged `archivedAt`
        // is null → pruned in the true arm; the false arm keeps it.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', archivedAt: null })
                .ignoreAnySetWithNoValueWhen(false)
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', archivedAt: null })
                .ignoreAnySetWithNoValueWhen(true)
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot()
            expect(trueSql).toMatchInlineSnapshot()
            expect(trueSql).not.toBe(falseSql)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('disallow-if-set-when-dispatches-on-true', async () => {
        // disallowIfSetWhen(true, error, 'slug') → disallowIfSet: throws
        // because `slug` is staged in the conflict update-set. The false arm
        // is silent and the upsert proceeds.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', slug: 'mktg-site-v2' })
                .disallowIfSetWhen(false, 'slug is fixed on conflict', 'slug')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tProject)
                    .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                    .onConflictOn(tProject.organizationId, tProject.slug)
                    .doUpdateDynamicSet({ name: 'Reactivated', slug: 'mktg-site-v2' })
                    .disallowIfSetWhen(true, 'slug is fixed on conflict', 'slug')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/slug is fixed on conflict|disallow/i)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('disallow-if-not-set-when-dispatches-on-true', async () => {
        // disallowIfNotSetWhen(true, error, 'slug') → disallowIfNotSet: throws
        // because `slug` is NOT staged. The false arm is silent.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .disallowIfNotSetWhen(false, 'slug must be set on conflict', 'slug')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tProject)
                    .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                    .onConflictOn(tProject.organizationId, tProject.slug)
                    .doUpdateDynamicSet({ name: 'Reactivated' })
                    .disallowIfNotSetWhen(true, 'slug must be set on conflict', 'slug')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/slug must be set on conflict|disallow/i)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('disallow-if-value-when-dispatches-on-true', async () => {
        // disallowIfValueWhen(true, error, 'name') → disallowIfValue: throws
        // because the staged `name` passes `_isValue`. The false arm is silent.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated' })
                .disallowIfValueWhen(false, 'name is reserved on conflict', 'name')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tProject)
                    .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                    .onConflictOn(tProject.organizationId, tProject.slug)
                    .doUpdateDynamicSet({ name: 'Reactivated' })
                    .disallowIfValueWhen(true, 'name is reserved on conflict', 'name')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/name is reserved on conflict|disallow/i)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('disallow-if-no-value-when-dispatches-on-true', async () => {
        // disallowIfNoValueWhen(true, error, 'archivedAt') → disallowIfNoValue:
        // throws because the staged `archivedAt` is null (no value). The false
        // arm is silent.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', archivedAt: null })
                .disallowIfNoValueWhen(false, 'archivedAt must carry a value', 'archivedAt')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tProject)
                    .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                    .onConflictOn(tProject.organizationId, tProject.slug)
                    .doUpdateDynamicSet({ name: 'Reactivated', archivedAt: null })
                    .disallowIfNoValueWhen(true, 'archivedAt must carry a value', 'archivedAt')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/archivedAt must carry a value|disallow/i)
        })
    })
    */

    // NOT-APPLICABLE: Oracle has no INSERT…ON CONFLICT (uses MERGE)
    /*
    test('disallow-any-other-set-when-dispatches-on-true', async () => {
        // disallowAnyOtherSetWhen(true, error, 'name') → disallowAnyOtherSet:
        // throws because a staged column (`slug`) is outside the allow-list.
        // The false arm is silent.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ name: 'Reactivated', slug: 'mktg-site-v2' })
                .disallowAnyOtherSetWhen(false, 'only name may change on conflict', 'name')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tProject)
                    .values({ organizationId: 1, slug: 'mktg-site', name: 'ignored' })
                    .onConflictOn(tProject.organizationId, tProject.slug)
                    .doUpdateDynamicSet({ name: 'Reactivated', slug: 'mktg-site-v2' })
                    .disallowAnyOtherSetWhen(true, 'only name may change on conflict', 'name')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/only name may change on conflict|disallow/i)
        })
    })
    */
})
