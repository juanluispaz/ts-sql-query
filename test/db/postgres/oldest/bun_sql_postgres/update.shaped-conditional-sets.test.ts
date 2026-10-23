// Shaped UPDATE conditional-set families that the sibling shaped-update file
// (update.shaped.test.ts) leaves unexercised — the composed `*IfValue` gates,
// the value-gated `ignore*` deletes, the `*When` ignore / value-gate arms, the
// shaped allowing-no-where `*When` opener, and `extendShape`. All operate on the
// RENAMED shape keys (`projectName` → name, `projectSlug` → slug, `archived` →
// archivedAt): each `*When` arm dispatches to its non-`When` sibling, so the
// renamed key maps back to its real column. Dialect-independent (a plain UPDATE
// under the real column names; the gating resolves entirely in the builder).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('shaped-set-if-set-if-value-requires-both-gates', async () => {
        // `setIfSetIfValue({...})` writes a renamed key only when (a) it was
        // already staged AND (b) the incoming value passes the value gate. The
        // renamed `projectName` (→ name) is already staged so it is overwritten;
        // the renamed `projectSlug` (→ slug) is not staged so it is skipped.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'First name' })
                .setIfSetIfValue({ projectName: 'Overwritten name', projectSlug: 'never-staged-slug' })
                .where(tProject.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Overwritten name",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-set-if-not-set-if-value-skips-empty-and-already-set', async () => {
        // `setIfNotSetIfValue({...})` writes a renamed key only when it was NOT
        // staged before AND the incoming value passes the value gate. The renamed
        // `projectName` (→ name) is already staged so its override is dropped; the
        // renamed optional `archived` (→ archivedAt) carries `undefined`, which the
        // value gate drops; the renamed `projectSlug` (→ slug) is new and non-empty,
        // so it sticks.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug', archived: 'archivedAt' })
                .set({ projectName: 'Kept name' })
                .setIfNotSetIfValue({ projectName: 'ignored', projectSlug: 'mktg-site-shaped', archived: undefined })
                .where(tProject.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1, slug = $2 where id = $3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Kept name",
                "mktg-site-shaped",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-set-if-has-value-if-value-requires-current-and-incoming', async () => {
        // `setIfHasValueIfValue({...})` OVERWRITES an already-staged renamed key
        // only when BOTH its current staged value and the incoming value pass the
        // value gate; it never removes a staged column. The renamed `projectName`
        // (→ name) is staged with a value and the incoming value is valid, so it is
        // overwritten; the renamed optional `archived` (→ archivedAt) was staged as
        // null, so the override is skipped (the incoming Date never reaches the
        // params) but the original `archived_at = null` stays in the SET clause.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Initial name', archived: null })
                .setIfHasValueIfValue({ projectName: 'Overwritten name', archived: new Date('2024-01-01T00:00:00Z') })
                .where(tProject.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1, archived_at = $2 where id = $3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Overwritten name",
                null,
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-set-if-has-no-value-if-value-fills-only-empty-with-real-value', async () => {
        // Mirror of the above: `setIfHasNoValueIfValue({...})` writes a renamed key
        // only when the staged value fails the gate AND the incoming value passes it.
        // The renamed optional `archived` (→ archivedAt) is staged as null and the
        // incoming Date is valid, so it fills (bound as an explicit-UTC Date so the
        // param snapshot is TZ-stable); the renamed `projectName` (→ name) is staged
        // with a value, so the override is rejected.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Stays', archived: null })
                .setIfHasNoValueIfValue({ projectName: 'override-ignored', archived: new Date('2024-02-02T00:00:00Z') })
                .where(tProject.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1, archived_at = $2 where id = $3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Stays",
                2024-02-02T00:00:00.000Z,
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-ignore-if-has-value-drops-only-populated-renamed-columns', async () => {
        // `ignoreIfHasValue(...renamedKeys)` deletes a staged renamed entry only if
        // its value passes the value gate. The renamed `archived` (→ archivedAt) is
        // staged as null, so it survives the sweep; the renamed `projectName`
        // (→ name) has a value, so it is dropped.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Dropped', archived: null })
                .ignoreIfHasValue('projectName', 'archived')
                .where(tProject.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set archived_at = $1 where id = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                null,
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-ignore-if-has-no-value-drops-only-empty-renamed-columns', async () => {
        // Mirror of the above: `ignoreIfHasNoValue(...renamedKeys)` deletes only the
        // staged renamed entries whose value fails the value gate. The renamed
        // `archived` (→ archivedAt) is null, so it is dropped; the renamed
        // `projectName` (→ name) survives.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Survives', archived: null })
                .ignoreIfHasNoValue('projectName', 'archived')
                .where(tProject.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Survives",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-set-if-set-when-dispatches-on-true', async () => {
        // `setIfSetWhen(when, {...})` dispatches to `setIfSet` when true (overwrites
        // only already-staged renamed keys), or no-ops when false. The renamed
        // `projectName` (→ name) is staged first; the true arm overwrites it, the
        // false arm leaves it untouched.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Base name' })
                .setIfSetWhen(false, { projectName: 'only-when-true' })
                .where(tProject.id.equals(1))
                .executeUpdate()
            const falseParams = ctx.lastParams

            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Base name' })
                .setIfSetWhen(true, { projectName: 'only-when-true' })
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
        })
    })

    test('shaped-ignore-if-has-value-when-dispatches-on-true', async () => {
        // `ignoreIfHasValueWhen(when, renamedKey)` dispatches to `ignoreIfHasValue`
        // when true. The renamed `projectSlug` (→ slug) is staged with a value; the
        // true arm drops it, the false arm keeps it.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Kept', projectSlug: 'maybe-dropped' })
                .ignoreIfHasValueWhen(false, 'projectSlug')
                .where(tProject.id.equals(1))
                .executeUpdate()
            const falseSql = ctx.lastSql

            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Kept', projectSlug: 'maybe-dropped' })
                .ignoreIfHasValueWhen(true, 'projectSlug')
                .where(tProject.id.equals(2))
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update project set name = $1, slug = $2 where id = $3"`)
            expect(trueSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('shaped-ignore-if-has-no-value-when-dispatches-on-true', async () => {
        // `ignoreIfHasNoValueWhen(when, renamedKey)` dispatches to
        // `ignoreIfHasNoValue` when true. The renamed `archived` (→ archivedAt) is
        // staged as null; the true arm drops it, the false arm keeps it.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Kept', archived: null })
                .ignoreIfHasNoValueWhen(false, 'archived')
                .where(tProject.id.equals(1))
                .executeUpdate()
            const falseSql = ctx.lastSql

            await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Kept', archived: null })
                .ignoreIfHasNoValueWhen(true, 'archived')
                .where(tProject.id.equals(2))
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update project set name = $1, archived_at = $2 where id = $3"`)
            expect(trueSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('shaped-allowing-no-where-set-when-touches-all-rows', async () => {
        // The shaped allowing-no-where opener threads its `*When` arm too:
        // `updateAllowingNoWhere(...).shapedAs({...}).set({...}).setWhen(true, {...})`
        // executes with no WHERE. `setWhen(false, …)` is a no-op (only the base
        // `projectName` → name lands); `setWhen(true, …)` stages the renamed
        // `isPublished` (→ published) as well. Every seeded project (4) is updated.
        // `published` (not slug) is the toggled column because slug carries a
        // UNIQUE(organization_id, slug) constraint that a bulk same-value write
        // would violate on a real DB.
        ctx.mockNext(4)
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', isPublished: 'published' })
                .set({ projectName: 'Bulk renamed' })
                .setWhen(false, { isPublished: true })
                .executeUpdate()
            const falseSql = ctx.lastSql

            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', isPublished: 'published' })
                .set({ projectName: 'Bulk renamed' })
                .setWhen(true, { isPublished: true })
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update project set name = $1"`)
            expect(trueSql).toMatchInlineSnapshot(`"update project set name = $1, published = case when $2::bool then 't' else 'f' end"`)
            expect(trueSql).not.toBe(falseSql)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })

    test('shaped-extend-shape-on-allowing-no-where-adds-renamed-keys', async () => {
        // `updateAllowingNoWhere(...).shapedAs({...}).extendShape({...})` widens the
        // active shape with more renamed keys while preserving the executable
        // (allowing-no-where) state — the chained `set(...)` then accepts keys from
        // BOTH the original shape (`projectName` → name) and the extension
        // (`isPublished` → published). Every seeded project (4) is updated.
        // `published` (not slug) is the extended column because slug carries a
        // UNIQUE(organization_id, slug) constraint that a bulk same-value write
        // would violate on a real DB.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name' })
                .extendShape({ isPublished: 'published' })
                .set({ projectName: 'Extended rename', isPublished: false })
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1, published = case when $2::bool then 't' else 'f' end"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Extended rename",
                false,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })

    test('shaped-extend-shape-on-where-update-adds-renamed-keys', async () => {
        // `update(...).shapedAs({...}).extendShape({...})` widens the active shape
        // on the regular (where-required) update opener. The chained `set(...)`
        // accepts keys from the original shape and the extension, and a WHERE is
        // still required before execute.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name' })
                .extendShape({ projectSlug: 'slug' })
                .set({ projectName: 'Extended rename', projectSlug: 'extended-slug' })
                .where(tProject.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1, slug = $2 where id = $3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Extended rename",
                "extended-slug",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-allowing-no-where-set-if-value-when-dispatches-on-true', async () => {
        // setIfValueWhen on the shaped executable (allowing-no-where) arm: the true
        // arm dispatches to setIfValue and overwrites the renamed `projectName`
        // (→ name); the false arm is a no-op. Every seeded project is updated.
        ctx.mockNext(4)
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Base name' })
                .setIfValueWhen(false, { projectName: 'Via when' })
                .executeUpdate()
            const falseParams = ctx.lastParams

            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Base name' })
                .setIfValueWhen(true, { projectName: 'Via when' })
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "Base name",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "Via when",
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
            expect(affected).toBe(4)
        })
    })

    test('shaped-allowing-no-where-set-if-set-when-dispatches-on-true', async () => {
        // setIfSetWhen → setIfSet: overwrites a renamed key already staged. The
        // renamed `projectName` (→ name) is staged, so the true arm overwrites it.
        ctx.mockNext(4)
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Base name' })
                .setIfSetWhen(false, { projectName: 'Via when' })
                .executeUpdate()
            const falseParams = ctx.lastParams

            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Base name' })
                .setIfSetWhen(true, { projectName: 'Via when' })
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "Base name",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "Via when",
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
            expect(affected).toBe(4)
        })
    })

    test('shaped-allowing-no-where-set-if-set-if-value-when-dispatches-on-true', async () => {
        // setIfSetIfValueWhen → setIfSetIfValue: overwrites a renamed key when it is
        // both already staged AND the incoming value passes the gate.
        ctx.mockNext(4)
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Base name' })
                .setIfSetIfValueWhen(false, { projectName: 'Via when' })
                .executeUpdate()
            const falseParams = ctx.lastParams

            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Base name' })
                .setIfSetIfValueWhen(true, { projectName: 'Via when' })
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "Base name",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "Via when",
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
            expect(affected).toBe(4)
        })
    })

    test('shaped-allowing-no-where-set-if-not-set-when-dispatches-on-true', async () => {
        // setIfNotSetWhen → setIfNotSet: assigns only renamed keys NOT already
        // staged. The renamed `isPublished` (→ published) is unstaged, so the true
        // arm adds it; the false arm leaves the SET clause name-only.
        ctx.mockNext(4)
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', isPublished: 'published' })
                .set({ projectName: 'Base name' })
                .setIfNotSetWhen(false, { isPublished: true })
                .executeUpdate()
            const falseSql = ctx.lastSql

            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', isPublished: 'published' })
                .set({ projectName: 'Base name' })
                .setIfNotSetWhen(true, { isPublished: true })
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update project set name = $1"`)
            expect(trueSql).toMatchInlineSnapshot(`"update project set name = $1, published = case when $2::bool then 't' else 'f' end"`)
            expect(trueSql).not.toBe(falseSql)
            expect(affected).toBe(4)
        })
    })

    test('shaped-allowing-no-where-set-if-not-set-if-value-when-dispatches-on-true', async () => {
        // setIfNotSetIfValueWhen → setIfNotSetIfValue: assigns only renamed keys NOT
        // already staged AND whose incoming value passes the gate. `isPublished`
        // (→ published) is unstaged with a real value, so the true arm adds it.
        ctx.mockNext(4)
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', isPublished: 'published' })
                .set({ projectName: 'Base name' })
                .setIfNotSetIfValueWhen(false, { isPublished: true })
                .executeUpdate()
            const falseSql = ctx.lastSql

            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', isPublished: 'published' })
                .set({ projectName: 'Base name' })
                .setIfNotSetIfValueWhen(true, { isPublished: true })
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update project set name = $1"`)
            expect(trueSql).toMatchInlineSnapshot(`"update project set name = $1, published = case when $2::bool then 't' else 'f' end"`)
            expect(trueSql).not.toBe(falseSql)
            expect(affected).toBe(4)
        })
    })

    test('shaped-allowing-no-where-ignore-if-set-when-dispatches-on-true', async () => {
        // ignoreIfSetWhen → ignoreIfSet: removes a staged renamed entry. The renamed
        // `isPublished` (→ published) is staged; the true arm drops it.
        ctx.mockNext(4)
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', isPublished: 'published' })
                .set({ projectName: 'Base name', isPublished: true })
                .ignoreIfSetWhen(false, 'isPublished')
                .executeUpdate()
            const falseSql = ctx.lastSql

            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', isPublished: 'published' })
                .set({ projectName: 'Base name', isPublished: true })
                .ignoreIfSetWhen(true, 'isPublished')
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update project set name = $1, published = case when $2::bool then 't' else 'f' end"`)
            expect(trueSql).toMatchInlineSnapshot(`"update project set name = $1"`)
            expect(trueSql).not.toBe(falseSql)
            expect(affected).toBe(4)
        })
    })

    test('shaped-allowing-no-where-keep-only-when-dispatches-on-true', async () => {
        // keepOnlyWhen → keepOnly: drops any staged renamed entry not in the kept
        // list. The staged `isPublished` (→ published) is dropped; `projectName`
        // (→ name) is kept.
        ctx.mockNext(4)
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', isPublished: 'published' })
                .set({ projectName: 'Base name', isPublished: true })
                .keepOnlyWhen(false, 'projectName')
                .executeUpdate()
            const falseSql = ctx.lastSql

            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', isPublished: 'published' })
                .set({ projectName: 'Base name', isPublished: true })
                .keepOnlyWhen(true, 'projectName')
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update project set name = $1, published = case when $2::bool then 't' else 'f' end"`)
            expect(trueSql).toMatchInlineSnapshot(`"update project set name = $1"`)
            expect(trueSql).not.toBe(falseSql)
            expect(affected).toBe(4)
        })
    })

    test('shaped-allowing-no-where-set-if-has-value-when-dispatches-on-true', async () => {
        // setIfHasValueWhen → setIfHasValue: overwrites a renamed key only when its
        // staged value passes the gate. The renamed optional `archived`
        // (→ archivedAt) is staged as null so it stays out; `projectName` (→ name)
        // has a value, so the true arm re-assigns it.
        ctx.mockNext(4)
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .setIfHasValueWhen(false, { projectName: 'Overwritten name' })
                .executeUpdate()
            const falseParams = ctx.lastParams

            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .setIfHasValueWhen(true, { projectName: 'Overwritten name' })
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "Base name",
                null,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "Overwritten name",
                null,
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
            expect(affected).toBe(4)
        })
    })

    test('shaped-allowing-no-where-set-if-has-value-if-value-when-dispatches-on-true', async () => {
        // setIfHasValueIfValueWhen → setIfHasValueIfValue: overwrites a renamed key
        // only when BOTH the staged value AND the incoming value pass the gate.
        ctx.mockNext(4)
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Base name' })
                .setIfHasValueIfValueWhen(false, { projectName: 'Overwritten name' })
                .executeUpdate()
            const falseParams = ctx.lastParams

            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Base name' })
                .setIfHasValueIfValueWhen(true, { projectName: 'Overwritten name' })
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "Base name",
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "Overwritten name",
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
            expect(affected).toBe(4)
        })
    })

    test('shaped-allowing-no-where-set-if-has-no-value-when-dispatches-on-true', async () => {
        // setIfHasNoValueWhen → setIfHasNoValue: assigns a renamed key only when its
        // staged value FAILS the gate. The renamed optional `archived` (→ archivedAt)
        // is staged as null, so the true arm fills it with an explicit-UTC Date.
        ctx.mockNext(4)
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .setIfHasNoValueWhen(false, { archived: new Date('2024-03-03T00:00:00Z') })
                .executeUpdate()
            const falseParams = ctx.lastParams

            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .setIfHasNoValueWhen(true, { archived: new Date('2024-03-03T00:00:00Z') })
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "Base name",
                null,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "Base name",
                2024-03-03T00:00:00.000Z,
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
            expect(affected).toBe(4)
        })
    })

    test('shaped-allowing-no-where-set-if-has-no-value-if-value-when-dispatches-on-true', async () => {
        // setIfHasNoValueIfValueWhen → setIfHasNoValueIfValue: assigns a renamed key
        // when the staged value FAILS the gate AND the incoming value passes it.
        ctx.mockNext(4)
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .setIfHasNoValueIfValueWhen(false, { archived: new Date('2024-04-04T00:00:00Z') })
                .executeUpdate()
            const falseParams = ctx.lastParams

            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .setIfHasNoValueIfValueWhen(true, { archived: new Date('2024-04-04T00:00:00Z') })
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "Base name",
                null,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "Base name",
                2024-04-04T00:00:00.000Z,
              ]
            `)
            expect(trueParams).not.toEqual(falseParams)
            expect(affected).toBe(4)
        })
    })

    test('shaped-allowing-no-where-ignore-if-has-value-when-dispatches-on-true', async () => {
        // ignoreIfHasValueWhen → ignoreIfHasValue: drops a staged renamed entry when
        // its value passes the gate. The renamed `archived` (→ archivedAt) is staged
        // with a value; the true arm drops it.
        ctx.mockNext(4)
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: new Date('2024-05-05T00:00:00Z') })
                .ignoreIfHasValueWhen(false, 'archived')
                .executeUpdate()
            const falseSql = ctx.lastSql

            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: new Date('2024-05-05T00:00:00Z') })
                .ignoreIfHasValueWhen(true, 'archived')
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update project set name = $1, archived_at = $2"`)
            expect(trueSql).toMatchInlineSnapshot(`"update project set name = $1"`)
            expect(trueSql).not.toBe(falseSql)
            expect(affected).toBe(4)
        })
    })

    test('shaped-allowing-no-where-ignore-if-has-no-value-when-dispatches-on-true', async () => {
        // ignoreIfHasNoValueWhen → ignoreIfHasNoValue: drops a staged renamed entry
        // when its value fails the gate. The renamed `archived` (→ archivedAt) is
        // staged as null; the true arm drops it.
        ctx.mockNext(4)
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .ignoreIfHasNoValueWhen(false, 'archived')
                .executeUpdate()
            const falseSql = ctx.lastSql

            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .ignoreIfHasNoValueWhen(true, 'archived')
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update project set name = $1, archived_at = $2"`)
            expect(trueSql).toMatchInlineSnapshot(`"update project set name = $1"`)
            expect(trueSql).not.toBe(falseSql)
            expect(affected).toBe(4)
        })
    })

    test('shaped-allowing-no-where-ignore-any-set-with-no-value-when-dispatches-on-true', async () => {
        // ignoreAnySetWithNoValueWhen → ignoreAnySetWithNoValue: sweeps every staged
        // renamed entry whose value fails the gate. The renamed `archived`
        // (→ archivedAt) is staged as null; the true arm sweeps it out.
        ctx.mockNext(4)
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Survives', archived: null })
                .ignoreAnySetWithNoValueWhen(false)
                .executeUpdate()
            const falseSql = ctx.lastSql

            const affected = await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Survives', archived: null })
                .ignoreAnySetWithNoValueWhen(true)
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update project set name = $1, archived_at = $2"`)
            expect(trueSql).toMatchInlineSnapshot(`"update project set name = $1"`)
            expect(trueSql).not.toBe(falseSql)
            expect(affected).toBe(4)
        })
    })

    test('shaped-allowing-no-where-disallow-if-set-when-dispatches-on-true', async () => {
        // disallowIfSetWhen → disallowIfSet: throws when the renamed `archived`
        // (→ archivedAt) is staged. The false arm is silent and updates all rows.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: new Date('2024-06-06T00:00:00Z') })
                .disallowIfSetWhen(false, 'archivedAt is managed by the archival job', 'archived')
                .executeUpdate()

            let caught: unknown
            try {
                await ctx.conn.updateAllowingNoWhere(tProject)
                    .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                    .set({ projectName: 'Base name', archived: new Date('2024-06-06T00:00:00Z') })
                    .disallowIfSetWhen(true, 'archivedAt is managed by the archival job', 'archived')
                    .executeUpdate()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/archivedAt is managed by the archival job|disallow/i)
        })
    })

    test('shaped-allowing-no-where-disallow-if-not-set-when-dispatches-on-true', async () => {
        // disallowIfNotSetWhen → disallowIfNotSet: throws when the renamed `archived`
        // (→ archivedAt) is NOT staged. The false arm is silent.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name' })
                .disallowIfNotSetWhen(false, 'archivedAt must be provided on this workflow', 'archived')
                .executeUpdate()

            let caught: unknown
            try {
                await ctx.conn.updateAllowingNoWhere(tProject)
                    .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                    .set({ projectName: 'Base name' })
                    .disallowIfNotSetWhen(true, 'archivedAt must be provided on this workflow', 'archived')
                    .executeUpdate()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/archivedAt must be provided on this workflow|disallow/i)
        })
    })

    test('shaped-allowing-no-where-disallow-if-value-when-dispatches-on-true', async () => {
        // disallowIfValueWhen → disallowIfValue: throws when the renamed `projectName`
        // (→ name) is staged with a value passing the gate. The false arm is silent.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'Base name' })
                .disallowIfValueWhen(false, 'name is reserved for the rename workflow', 'projectName')
                .executeUpdate()

            let caught: unknown
            try {
                await ctx.conn.updateAllowingNoWhere(tProject)
                    .shapedAs({ projectName: 'name' })
                    .set({ projectName: 'Base name' })
                    .disallowIfValueWhen(true, 'name is reserved for the rename workflow', 'projectName')
                    .executeUpdate()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/name is reserved for the rename workflow|disallow/i)
        })
    })

    test('shaped-allowing-no-where-disallow-if-no-value-when-dispatches-on-true', async () => {
        // disallowIfNoValueWhen → disallowIfNoValue: throws when the renamed
        // `archived` (→ archivedAt) is staged with a null value. The false arm is
        // silent.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .disallowIfNoValueWhen(false, 'archivedAt must carry a timestamp', 'archived')
                .executeUpdate()

            let caught: unknown
            try {
                await ctx.conn.updateAllowingNoWhere(tProject)
                    .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                    .set({ projectName: 'Base name', archived: null })
                    .disallowIfNoValueWhen(true, 'archivedAt must carry a timestamp', 'archived')
                    .executeUpdate()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/archivedAt must carry a timestamp|disallow/i)
        })
    })

    test('shaped-allowing-no-where-disallow-any-other-set-when-dispatches-on-true', async () => {
        // disallowAnyOtherSetWhen → disallowAnyOtherSet: throws when any staged
        // renamed key falls outside the allow-list. `archived` is staged beyond the
        // allowed `projectName`, so the true arm throws. The false arm is silent.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await ctx.conn.updateAllowingNoWhere(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Base name', archived: null })
                .disallowAnyOtherSetWhen(false, 'this workflow only renames', 'projectName')
                .executeUpdate()

            let caught: unknown
            try {
                await ctx.conn.updateAllowingNoWhere(tProject)
                    .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                    .set({ projectName: 'Base name', archived: null })
                    .disallowAnyOtherSetWhen(true, 'this workflow only renames', 'projectName')
                    .executeUpdate()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/this workflow only renames|disallow/i)
        })
    })
})
