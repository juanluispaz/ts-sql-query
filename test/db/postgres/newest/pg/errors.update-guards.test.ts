// Negative-path coverage of UpdateQueryBuilder shape guards, the
// counterpart to errors.insert-guards.test.ts (which exercises the
// InsertQueryBuilder copy of the same machinery).
//
//   - `INVALID_SHAPE_OVERRIDE` when `extendShape` re-declares a key the
//     shape already maps. The existing update docs/tests only ADD new
//     keys via `extendShape`, never collide with an existing one, so
// the guard at is otherwise unverified.
//
// The reason is surfaced by `UpdateQueryBuilder` (not
// the dialect SqlBuilder), so the behaviour is identical on every
// dialect and this file is byte-identical across every cell. No SQL
// snapshots: the guard throws while configuring the builder, before any
// query is emitted.

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

    test('update-guards/extend-shape-override-throws-invalid-shape-override', () => {
        let caught: unknown
        try {
            // `as any`: after `set(...)` the builder narrows `extendShape`
            // away on some dialects; the runtime override guard is what
            // we are exercising, so reach it dynamically — mirrors the
            // insert twin in errors.insert-guards.test.ts.
            const builder = ctx.conn.update(tProject)
                .shapedAs({ name: 'name' }).set({ name: 'x' }) as any
            builder.extendShape({ name: 'slug' })
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('INVALID_SHAPE_OVERRIDE')
    })

    test('update-guards/no-sets-with-min-throws-minimum-rows', async () => {
        // The empty-`dynamicSet()` short-circuit runs the min/max guard against the
        // resulting count of 0: `executeUpdate(1)` with no columns set reaches its
        // guard with count 0 < min 1, so it rejects with MINIMUM_ROWS_NOT_REACHED
        // instead of resolving 0. No SQL is dispatched.
        let caught: unknown
        try {
            await ctx.conn.update(tProject).dynamicSet()
                .where(tProject.id.equals(1)).executeUpdate(1)
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('MINIMUM_ROWS_NOT_REACHED')
    })

    test('update-guards/no-sets-returning-many-with-min-throws-minimum-rows', async () => {
        // Same for the returning-many shape: `executeUpdateMany(1)` on an empty
        // `dynamicSet()` reaches its guard with count 0 < min 1, so it rejects with
        // MINIMUM_ROWS_NOT_REACHED instead of resolving `[]`. No SQL is dispatched.
        let caught: unknown
        try {
            await ctx.conn.update(tProject).dynamicSet()
                .where(tProject.id.equals(1))
                .returning({ id: tProject.id }).executeUpdateMany(1)
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('MINIMUM_ROWS_NOT_REACHED')
    })


    test('where-called-twice-throws-illegal-state', () => {
        // Holding a reference to the pre-WHERE stage and calling `.where(...)`
        // twice reaches the `if (this.__where)` re-entry guard. Well-typed without
        // `as any`: `q` keeps its pre-where type, and `where()` returns a narrowed
        // interface rather than mutating `q`, so both calls type-check on `q`.
        const q = ctx.conn.update(tProject).dynamicSet().set({ name: 'x' })
        q.where(tProject.id.equals(1))
        let caught: unknown
        try {
            q.where(tProject.id.equals(2))
        } catch (e) { caught = e }
        expect(caught).toBeInstanceOf(TsSqlError)
        const r = caught instanceof TsSqlError ? caught.errorReason : undefined
        expect(r?.reason).toBe('INTERNAL')
        expect(r && r.reason === 'INTERNAL' ? r.internalErrorType : undefined).toBe('illegal state')
    })
})
