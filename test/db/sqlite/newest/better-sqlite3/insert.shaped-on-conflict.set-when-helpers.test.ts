// Coverage of every `*When(when: boolean, …)` conditional helper on the
// SHAPED ON CONFLICT update-set node, reached after a shaped insert opener:
// `.shapedAs({…}).set({…}).onConflictOn(...).doUpdateDynamicSet({…})` then
// the `*When` call. Each helper is a thin dispatcher that routes to its
// non-`When` sibling on the opened conflict update-set when the boolean is
// true, or returns `this` unchanged when false. The renamed shape keys
// (`projectName`, `projectSlug`, `archived`) flow through the dispatcher and
// map back to their real columns (`name`, `slug`, `archived_at`).
//
// The behaviour of the underlying non-`When` shaped methods is exercised by
// [insert.shaped-on-conflict.test.ts](./insert.shaped-on-conflict.test.ts);
// this file pins **the dispatch itself**. Each test pairs `*When(false, …)`
// against `*When(true, …)` so the snapshot delta shows the dispatch fired.
//
// Shape used throughout: { orgId: 'organizationId', projectName: 'name',
// projectSlug: 'slug', archived: 'archivedAt' }. Seed (org 1, slug
// 'mktg-site') already exists, so every conflict fires and the existing row
// is updated; `ctx.withRollback` reverts the row between tests.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('set-if-value-when-false-is-noop-true-overrides', async () => {
        // setIfValueWhen(false) returns `this` so the staged `projectName`
        // stays. setIfValueWhen(true) → setIfValue: the new value passes
        // `_isValue` so it overwrites `name`. Same column list, param differs.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfValueWhen(false, { projectName: 'Overridden via when' })
                .executeInsert()
            const falseSql = ctx.lastSql
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfValueWhen(true, { projectName: 'Overridden via when' })
                .executeInsert()
            const trueSql = ctx.lastSql
            const trueParams = ctx.lastParams

            expect(falseSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(falseSql).toBe(trueSql) // same column list — only the param value differs
            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Overridden via when",
              ]
            `)
        })
    })

    test('set-if-set-when-dispatches-on-true', async () => {
        // setIfSetWhen(true) → setIfSet: overwrites only renamed keys already
        // staged. `projectName` was staged so it is overwritten; the false arm
        // leaves the staged 'Reactivated' intact.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfSetWhen(false, { projectName: 'Renamed via when' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfSetWhen(true, { projectName: 'Renamed via when' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Renamed via when",
              ]
            `)
        })
    })

    test('set-if-set-if-value-when-dispatches-on-true', async () => {
        // setIfSetIfValueWhen(true) → setIfSetIfValue: overwrites a staged
        // renamed key only when the NEW value also passes `_isValue`.
        // `projectName` is staged with a real new value → overwritten true arm.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfSetIfValueWhen(false, { projectName: 'Renamed via when' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfSetIfValueWhen(true, { projectName: 'Renamed via when' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Renamed via when",
              ]
            `)
        })
    })

    test('set-if-not-set-when-dispatches-on-true', async () => {
        // setIfNotSetWhen(true) → setIfNotSet: adds only renamed keys NOT
        // already staged. `projectSlug` is unstaged → added in the true arm
        // (extra column in the SET list); the false arm leaves the set as-is.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfNotSetWhen(false, { projectSlug: 'mktg-site-v2' })
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfNotSetWhen(true, { projectSlug: 'mktg-site-v2' })
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?, slug = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('set-if-not-set-if-value-when-dispatches-on-true', async () => {
        // setIfNotSetIfValueWhen(true) → setIfNotSetIfValue: adds an unstaged
        // renamed key only when its new value passes `_isValue`. `projectSlug`
        // is unstaged with a real value → added in the true arm.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfNotSetIfValueWhen(false, { projectSlug: 'mktg-site-v2' })
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfNotSetIfValueWhen(true, { projectSlug: 'mktg-site-v2' })
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?, slug = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('ignore-if-set-when-dispatches-on-true', async () => {
        // ignoreIfSetWhen(true, 'projectSlug') → ignoreIfSet: drops `slug`
        // because the renamed key is present. The false arm keeps the staged
        // `slug` (extra column in the SET list).
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-v2' })
                .ignoreIfSetWhen(false, 'projectSlug')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-v2' })
                .ignoreIfSetWhen(true, 'projectSlug')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?, slug = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('keep-only-when-dispatches-on-true', async () => {
        // keepOnlyWhen(true, 'projectName') → keepOnly: drops every staged
        // renamed key except `projectName`; the staged `slug` is removed. The
        // false arm keeps both staged columns.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-v2' })
                .keepOnlyWhen(false, 'projectName')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-v2' })
                .keepOnlyWhen(true, 'projectName')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?, slug = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('set-if-has-value-when-dispatches-on-true', async () => {
        // setIfHasValueWhen(true) → setIfHasValue: overwrites a renamed key
        // only when its CURRENT staged value passes `_isValue`. `projectName`
        // has a staged value → overwritten in the true arm.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfHasValueWhen(false, { projectName: 'Renamed via when' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfHasValueWhen(true, { projectName: 'Renamed via when' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Renamed via when",
              ]
            `)
        })
    })

    test('set-if-has-value-if-value-when-dispatches-on-true', async () => {
        // setIfHasValueIfValueWhen(true) → setIfHasValueIfValue: staged value
        // AND new value must both pass `_isValue`. `projectName` is overwritten
        // in the true arm.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfHasValueIfValueWhen(false, { projectName: 'Renamed via when' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfHasValueIfValueWhen(true, { projectName: 'Renamed via when' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Reactivated",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                "ignored",
                "mktg-site",
                "Renamed via when",
              ]
            `)
        })
    })

    test('set-if-has-no-value-when-dispatches-on-true', async () => {
        // setIfHasNoValueWhen(true) → setIfHasNoValue: fills a renamed key only
        // when its current staged value has NO value. `projectSlug` was never
        // staged (no value) → filled in the true arm (extra column).
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfHasNoValueWhen(false, { projectSlug: 'mktg-site-v2' })
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfHasNoValueWhen(true, { projectSlug: 'mktg-site-v2' })
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?, slug = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('set-if-has-no-value-if-value-when-dispatches-on-true', async () => {
        // setIfHasNoValueIfValueWhen(true) → setIfHasNoValueIfValue: fills a
        // no-value renamed key only when the new value passes `_isValue`.
        // `projectSlug` (no staged value) gets a real value → added true arm.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfHasNoValueIfValueWhen(false, { projectSlug: 'mktg-site-v2' })
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .setIfHasNoValueIfValueWhen(true, { projectSlug: 'mktg-site-v2' })
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?, slug = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('ignore-if-has-value-when-dispatches-on-true', async () => {
        // ignoreIfHasValueWhen(true, 'projectSlug') → ignoreIfHasValue: drops
        // `slug` because its staged value passes `_isValue`. The false arm
        // keeps the staged `slug` (extra column in the SET list).
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-v2' })
                .ignoreIfHasValueWhen(false, 'projectSlug')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-v2' })
                .ignoreIfHasValueWhen(true, 'projectSlug')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?, slug = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('ignore-if-has-no-value-when-dispatches-on-true', async () => {
        // ignoreIfHasNoValueWhen(true, 'archived') → ignoreIfHasNoValue: drops
        // `archived_at` because its staged value is null (no value). The false
        // arm keeps the staged `archived_at` (extra column in the SET list).
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', archived: null })
                .ignoreIfHasNoValueWhen(false, 'archived')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', archived: null })
                .ignoreIfHasNoValueWhen(true, 'archived')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?, archived_at = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('ignore-any-set-with-no-value-when-dispatches-on-true', async () => {
        // ignoreAnySetWithNoValueWhen(true) → ignoreAnySetWithNoValue: sweeps
        // every staged entry whose value has no value. The staged `archived`
        // (→ archived_at) is null → pruned in the true arm; the false arm keeps
        // it.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', archived: null })
                .ignoreAnySetWithNoValueWhen(false)
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', archived: null })
                .ignoreAnySetWithNoValueWhen(true)
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?, archived_at = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into project (organization_id, name, slug) values (?, ?, ?) on conflict (organization_id, slug) do update set name = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('disallow-if-set-when-dispatches-on-true', async () => {
        // disallowIfSetWhen(true, error, 'projectSlug') → disallowIfSet: throws
        // because the renamed `projectSlug` is staged. The false arm is silent.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-v2' })
                .disallowIfSetWhen(false, 'slug is fixed on conflict', 'projectSlug')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tProject)
                    .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                    .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                    .onConflictOn(tProject.organizationId, tProject.slug)
                    .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-v2' })
                    .disallowIfSetWhen(true, 'slug is fixed on conflict', 'projectSlug')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/slug is fixed on conflict|disallow/i)
        })
    })

    test('disallow-if-not-set-when-dispatches-on-true', async () => {
        // disallowIfNotSetWhen(true, error, 'projectSlug') → disallowIfNotSet:
        // throws because the renamed `projectSlug` is NOT staged. The false arm
        // is silent.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .disallowIfNotSetWhen(false, 'slug must be set on conflict', 'projectSlug')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tProject)
                    .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                    .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                    .onConflictOn(tProject.organizationId, tProject.slug)
                    .doUpdateDynamicSet({ projectName: 'Reactivated' })
                    .disallowIfNotSetWhen(true, 'slug must be set on conflict', 'projectSlug')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/slug must be set on conflict|disallow/i)
        })
    })

    test('disallow-if-value-when-dispatches-on-true', async () => {
        // disallowIfValueWhen(true, error, 'projectName') → disallowIfValue:
        // throws because the staged `projectName` passes `_isValue`. The false
        // arm is silent.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated' })
                .disallowIfValueWhen(false, 'name is reserved on conflict', 'projectName')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tProject)
                    .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                    .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                    .onConflictOn(tProject.organizationId, tProject.slug)
                    .doUpdateDynamicSet({ projectName: 'Reactivated' })
                    .disallowIfValueWhen(true, 'name is reserved on conflict', 'projectName')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/name is reserved on conflict|disallow/i)
        })
    })

    test('disallow-if-no-value-when-dispatches-on-true', async () => {
        // disallowIfNoValueWhen(true, error, 'archived') → disallowIfNoValue:
        // throws because the staged `archived` (→ archived_at) is null (no
        // value). The false arm is silent.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', archived: null })
                .disallowIfNoValueWhen(false, 'archived must carry a value', 'archived')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tProject)
                    .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                    .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                    .onConflictOn(tProject.organizationId, tProject.slug)
                    .doUpdateDynamicSet({ projectName: 'Reactivated', archived: null })
                    .disallowIfNoValueWhen(true, 'archived must carry a value', 'archived')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/archived must carry a value|disallow/i)
        })
    })

    test('disallow-any-other-set-when-dispatches-on-true', async () => {
        // disallowAnyOtherSetWhen(true, error, 'projectName') →
        // disallowAnyOtherSet: throws because a staged renamed key
        // (`projectSlug`) is outside the allow-list. The false arm is silent.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                .onConflictOn(tProject.organizationId, tProject.slug)
                .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-v2' })
                .disallowAnyOtherSetWhen(false, 'only name may change on conflict', 'projectName')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tProject)
                    .shapedAs({ orgId: 'organizationId', projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                    .set({ orgId: 1, projectName: 'ignored', projectSlug: 'mktg-site' })
                    .onConflictOn(tProject.organizationId, tProject.slug)
                    .doUpdateDynamicSet({ projectName: 'Reactivated', projectSlug: 'mktg-site-v2' })
                    .disallowAnyOtherSetWhen(true, 'only name may change on conflict', 'projectName')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/only name may change on conflict|disallow/i)
        })
    })
})
