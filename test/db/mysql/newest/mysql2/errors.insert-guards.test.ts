// Negative-path coverage of insert-builder guards the rest of the
// insert.* suite never trips:
//
//   - The `INTERNAL` / "illegal state" guards on `.where()` / `.and()` /
//     `.or()` when there is no on-conflict clause to attach the condition
//     to, and on a second on-conflict clause of the same kind (a
//     defensive invariant reached only by misusing the builder past its
//     type guard — hence the `as any` casts).
//   - `INVALID_SHAPE_OVERRIDE` when `extendShape` re-declares a key the
//     shape already maps.
//   - The empty `values([])` short-circuit: it resolves without touching
//     the database (0, or [] when returning the last inserted id).
//
// No SQL snapshots: the guards throw before execution and the empty-values
// case emits no query.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

function reasonOf(e: unknown): string | undefined {
    if (e instanceof TsSqlError) return e.errorReason.reason
    return undefined
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    const baseSet = { organizationId: 1, name: 'Ops', slug: 'ops' }

    test('insert-guards/where-without-on-conflict-throws-internal', () => {
        let caught: unknown
        try {
            (ctx.conn.insertInto(tProject).set(baseSet) as any).where(tProject.id.equals(1))
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('INTERNAL')
    })

    test('insert-guards/and-without-on-conflict-throws-internal', () => {
        let caught: unknown
        try {
            (ctx.conn.insertInto(tProject).set(baseSet) as any).and(tProject.id.equals(1))
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('INTERNAL')
    })

    test('insert-guards/or-without-on-conflict-throws-internal', () => {
        let caught: unknown
        try {
            (ctx.conn.insertInto(tProject).set(baseSet) as any).or(tProject.id.equals(1))
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('INTERNAL')
    })

    test('insert-guards/double-on-conflict-do-update-set-throws-internal', () => {
        // Reaching the duplicate-clause guard requires misusing the
        // builder past its type guard, hence the `as any`.
        let caught: unknown
        try {
            const b = ctx.conn.insertInto(tProject).set(baseSet) as any
            b.onConflictDoUpdateSet({ name: 'a' }).onConflictDoUpdateSet({ name: 'b' })
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('INTERNAL')
    })

    test('insert-guards/double-on-conflict-on-throws-internal', () => {
        let caught: unknown
        try {
            const b = ctx.conn.insertInto(tProject).set(baseSet) as any
            b.onConflictOn(tProject.id).onConflictOn(tProject.slug)
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('INTERNAL')
    })

    test('insert-guards/extend-shape-override-throws-invalid-shape-override', () => {
        let caught: unknown
        try {
            // `as any`: the override guard is reached by misusing the
            // post-`set` builder past its type guard.
            const builder = ctx.conn.insertInto(tProject)
                .shapedAs({ name: 'name' }).set({ name: 'x' }) as any
            builder.extendShape({ name: 'slug' })
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('INVALID_SHAPE_OVERRIDE')
    })

    test('insert-guards/empty-values-resolves-zero', async () => {
        // values([]) short-circuits: no row to insert, resolves 0 and
        // emits no query to the database.
        const r = await ctx.conn.insertInto(tProject).values([]).executeInsert()
        expect(r).toBe(0)
    })

    // NOT-APPLICABLE: MySQL has no RETURNING, so multi-row `returningLastInsertedId()` is not on its typed surface; the shared empty-values short-circuit (→ []) is covered in the postgres/sqlite/mariadb cells.
    /*
    test('insert-guards/empty-values-returning-last-id-resolves-empty-array', async () => {
        const r = await ctx.conn.insertInto(tProject)
            .values([]).returningLastInsertedId().executeInsert()
        expect(r).toEqual([])
    })
    */
})
