// The `disallow*` guard family on a SHAPE-carrying UPDATE builder. Under an
// active shape, the whole set-manipulation surface — `set`/`setIfValue`/…, the
// `ignore*`/`keepOnly` family AND the `disallow*` guards — operates on the
// RENAMED shape keys (`projectName` → name, `projectSlug` → slug,
// `archived` → archivedAt), because `__sets` is keyed by the renamed key. Each
// test stages renamed keys, then references those same renamed keys in the
// guard. Two arcs per guard: the rule passes (the UPDATE runs untouched) and the
// rule is violated (the guard throws before any SQL runs). Dialect-independent
// (a plain UPDATE under the real column names).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('shaped-disallow-guards-all-pass-update-runs', async () => {
        // Only the renamed `projectName` (→ name) is staged. Every guard
        // references the renamed shape keys and its condition is not met, so the
        // chain returns the builder unchanged and the UPDATE proceeds:
        // `disallowIfValue('projectSlug')` passes (slug absent),
        // `disallowIfNoValue('projectName')` passes (name has a value),
        // `disallowIfSet('projectSlug')` passes (slug absent),
        // `disallowIfNotSet('projectName')` passes (name is set),
        // `disallowAnyOtherSet('projectName')` passes (name is the sole staged
        // column). The guards leave no trace.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Renamed via shaped set' })
                .disallowIfValue('slug must stay unset', 'projectSlug')
                .disallowIfNoValue('name is required', 'projectName')
                .disallowIfSet('slug cannot change here', 'projectSlug')
                .disallowIfNotSet('name is required', 'projectName')
                .disallowAnyOtherSet('only name may change', 'projectName')
                .where(tProject.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set \`name\` = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Renamed via shaped set",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('shaped-disallow-if-set-throws-on-staged-renamed-key', () => {
        // The renamed `projectSlug` (→ slug) is staged; `disallowIfSet(...,'projectSlug')`
        // names the renamed shape key and throws synchronously because it IS staged.
        expect(() => {
            ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Stays', projectSlug: 'dropped-slug' })
                .disallowIfSet('slug is read-only on this endpoint', 'projectSlug')
                .where(tProject.id.equals(1))
        }).toThrow(/slug is read-only on this endpoint/)
    })

    test('shaped-disallow-if-not-set-throws-on-absent-renamed-key', () => {
        // Only `projectName` is staged; `disallowIfNotSet(...,'projectSlug')` names
        // the renamed key projectSlug, which is NOT staged, so the guard throws.
        expect(() => {
            ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Renamed' })
                .disallowIfNotSet('slug must be provided on this endpoint', 'projectSlug')
                .where(tProject.id.equals(1))
        }).toThrow(/slug must be provided on this endpoint/)
    })

    test('shaped-disallow-if-value-throws-when-renamed-key-has-value', () => {
        // The renamed `projectName` (→ name) is staged with a value;
        // `disallowIfValue(...,'projectName')` names the renamed key and throws
        // because its staged value passes the value gate.
        expect(() => {
            ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name' })
                .set({ projectName: 'New name' })
                .disallowIfValue('name changes go through the rename endpoint', 'projectName')
                .where(tProject.id.equals(1))
        }).toThrow(/name changes go through the rename endpoint/)
    })

    test('shaped-disallow-if-no-value-throws-when-renamed-key-is-empty', () => {
        // The renamed optional `archived` (→ archivedAt) is staged as null;
        // `disallowIfNoValue(...,'archived')` names the renamed key and throws
        // because the staged value fails the value gate.
        expect(() => {
            ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', archived: 'archivedAt' })
                .set({ projectName: 'Renamed', archived: null })
                .disallowIfNoValue('archivedAt cannot be cleared via this path', 'archived')
                .where(tProject.id.equals(1))
        }).toThrow(/archivedAt cannot be cleared via this path/)
    })

    test('shaped-disallow-any-other-set-throws-on-unexpected-renamed-key', () => {
        // Both `projectName` (→ name) and `projectSlug` (→ slug) are staged;
        // `disallowAnyOtherSet(...,'projectName')` allows only the renamed key
        // projectName, so the staged projectSlug trips the guard.
        expect(() => {
            ctx.conn.update(tProject)
                .shapedAs({ projectName: 'name', projectSlug: 'slug' })
                .set({ projectName: 'Stays', projectSlug: 'unexpected-slug' })
                .disallowAnyOtherSet('this endpoint only updates name', 'projectName')
                .where(tProject.id.equals(1))
        }).toThrow(/this endpoint only updates name/)
    })
})
