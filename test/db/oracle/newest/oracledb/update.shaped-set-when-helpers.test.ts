// The shaped × `*When` cross for the UPDATE set-manipulation family. Each
// `*When(when, …)` helper is a thin dispatcher that routes to its non-`When`
// sibling when the boolean is true, or returns `this` unchanged when false.
// Under an active `shapedAs({...})` shape the renamed keys (`projectName` → name,
// `projectSlug` → slug, `archived` → archivedAt) are what the arm accepts — each
// dispatches to its non-`When` sibling, so the renamed key maps back to its real
// column. The non-`When` shaped siblings are exercised by
// [update.shaped.test.ts](./update.shaped.test.ts) and
// [update.shaped-conditional-sets.test.ts](./update.shaped-conditional-sets.test.ts);
// the unshaped `*When` dispatchers by
// [update.set-when-helpers.test.ts](./update.set-when-helpers.test.ts). This file
// pins the shaped×When cross for the eight arms those leave uncrossed:
// `setIfSetIfValueWhen`, `setIfNotSetWhen`, `setIfHasValueWhen`,
// `setIfHasValueIfValueWhen`, `setIfHasNoValueWhen`, `setIfHasNoValueIfValueWhen`,
// `ignoreIfSetWhen`, `ignoreAnySetWithNoValueWhen`. Each test pairs
// `*When(false, …)` against `*When(true, …)` so the snapshot delta shows the
// dispatch fired. Dialect-independent (a plain UPDATE under the real column
// names; the gating resolves entirely in the builder).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('shaped-set-if-set-if-value-when-dispatches-on-true', async () => {
        // setIfSetIfValueWhen(true) → setIfSetIfValue: overwrites a renamed key
        // only when it was already staged AND the incoming value passes the gate.
        // The renamed `projectName` (→ name) is staged first; the true arm
        // overwrites it, the false arm leaves it untouched.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Base name' })
                .setIfSetIfValueWhen(false, { projectName: 'only-when-true' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            const falseParams = ctx.lastParams

            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Base name' })
                .setIfSetIfValueWhen(true, { projectName: 'only-when-true' })
                .where(tProject.id.equals(2))
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "Base name",
                1,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "only-when-true",
                2,
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })

    test('shaped-set-if-not-set-when-dispatches-on-true', async () => {
        // setIfNotSetWhen(true) → setIfNotSet: assigns only renamed keys NOT
        // already staged. The renamed `projectSlug` (→ slug) is unstaged → the
        // true arm fills it; the false arm leaves the SET clause as name-only.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Base name' })
                .setIfNotSetWhen(false, { projectSlug: 'mktg-site-shaped' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            const falseSql = ctx.lastSql

            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Base name' })
                .setIfNotSetWhen(true, { projectSlug: 'mktg-site-shaped' })
                .where(tProject.id.equals(2))
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update project set name = :0 where id = :1"`)
            expect(trueSql).toMatchInlineSnapshot(`"update project set name = :0, slug = :1 where id = :2"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('shaped-set-if-has-value-when-dispatches-on-true', async () => {
        // setIfHasValueWhen(true) → setIfHasValue: overwrites a renamed key only
        // when its currently-staged value passes the value gate. The renamed
        // optional `archived` (→ archivedAt) is staged as null so it stays out of
        // the override; the renamed `projectName` (→ name) has a value, so the true
        // arm re-assigns it.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .setIfHasValueWhen(false, { projectName: 'Overwritten name' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            const falseParams = ctx.lastParams

            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .setIfHasValueWhen(true, { projectName: 'Overwritten name' })
                .where(tProject.id.equals(2))
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "Base name",
                null,
                1,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "Overwritten name",
                null,
                2,
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })

    test('shaped-set-if-has-value-if-value-when-dispatches-on-true', async () => {
        // setIfHasValueIfValueWhen(true) → setIfHasValueIfValue: overwrites a
        // renamed key only when BOTH its current staged value AND the incoming
        // value pass the gate. The renamed `projectName` (→ name) is staged with a
        // value and the incoming value is valid, so the true arm overwrites it.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Base name' })
                .setIfHasValueIfValueWhen(false, { projectName: 'Overwritten name' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            const falseParams = ctx.lastParams

            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Base name' })
                .setIfHasValueIfValueWhen(true, { projectName: 'Overwritten name' })
                .where(tProject.id.equals(2))
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "Base name",
                1,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "Overwritten name",
                2,
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })

    test('shaped-set-if-has-no-value-when-dispatches-on-true', async () => {
        // setIfHasNoValueWhen(true) → setIfHasNoValue: assigns a renamed key only
        // when its currently-staged value FAILS the value gate. The renamed
        // optional `archived` (→ archivedAt) is staged as null, so the true arm
        // fills it with an explicit-UTC Date (TZ-stable param snapshot); the false
        // arm leaves it null.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .setIfHasNoValueWhen(false, { archived: new Date('2024-03-03T00:00:00Z') })
                .where(tProject.id.equals(1))
                .executeUpdate()
            const falseParams = ctx.lastParams

            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .setIfHasNoValueWhen(true, { archived: new Date('2024-03-03T00:00:00Z') })
                .where(tProject.id.equals(2))
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "Base name",
                null,
                1,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "Base name",
                2024-03-03T00:00:00.000Z,
                2,
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })

    test('shaped-set-if-has-no-value-if-value-when-dispatches-on-true', async () => {
        // setIfHasNoValueIfValueWhen(true) → setIfHasNoValueIfValue: assigns a
        // renamed key only when the staged value FAILS the gate AND the incoming
        // value passes it. The renamed optional `archived` (→ archivedAt) is staged
        // as null and the incoming Date is valid, so the true arm fills it.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .setIfHasNoValueIfValueWhen(false, { archived: new Date('2024-04-04T00:00:00Z') })
                .where(tProject.id.equals(1))
                .executeUpdate()
            const falseParams = ctx.lastParams

            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .setIfHasNoValueIfValueWhen(true, { archived: new Date('2024-04-04T00:00:00Z') })
                .where(tProject.id.equals(2))
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "Base name",
                null,
                1,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "Base name",
                2024-04-04T00:00:00.000Z,
                2,
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
        })
    })

    test('shaped-ignore-if-set-when-dispatches-on-true', async () => {
        // ignoreIfSetWhen(true, 'projectSlug') → ignoreIfSet: removes a staged
        // renamed entry from the SET clause. The renamed `projectSlug` (→ slug) is
        // staged; the true arm drops it, the false arm keeps it.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Kept', projectSlug: 'maybe-dropped' })
                .ignoreIfSetWhen(false, 'projectSlug')
                .where(tProject.id.equals(1))
                .executeUpdate()
            const falseSql = ctx.lastSql

            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Kept', projectSlug: 'maybe-dropped' })
                .ignoreIfSetWhen(true, 'projectSlug')
                .where(tProject.id.equals(2))
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update project set name = :0, slug = :1 where id = :2"`)
            expect(trueSql).toMatchInlineSnapshot(`"update project set name = :0 where id = :1"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('shaped-ignore-any-set-with-no-value-when-dispatches-on-true', async () => {
        // ignoreAnySetWithNoValueWhen(true) → ignoreAnySetWithNoValue: sweeps every
        // staged renamed entry whose value fails the gate. The renamed optional
        // `archived` (→ archivedAt) is staged as null; the true arm sweeps it out,
        // leaving only `name`; the false arm keeps both.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Survives', archived: null })
                .ignoreAnySetWithNoValueWhen(false)
                .where(tProject.id.equals(1))
                .executeUpdate()
            const falseSql = ctx.lastSql

            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Survives', archived: null })
                .ignoreAnySetWithNoValueWhen(true)
                .where(tProject.id.equals(2))
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update project set name = :0, archived_at = :1 where id = :2"`)
            expect(trueSql).toMatchInlineSnapshot(`"update project set name = :0 where id = :1"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })
})
