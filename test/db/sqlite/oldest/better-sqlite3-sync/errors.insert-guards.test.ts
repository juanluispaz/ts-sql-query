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
//   - The single-row `returningLastInsertedId()` null-id guard: a plain
//     (non-`onConflictDoNothing`) chain is typed non-null, so a driver that
//     returns no id must throw MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE
//     rather than resolve `null` — mock-forced, since a real INSERT always
//     produces an id.
//   - The multi-row `returningLastInsertedId()` per-row null-element guard:
//     each returned id is validated individually, so a null element in the
//     id array throws MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE decorated
//     with the offending `rowIndex` — also mock-forced.
//
// No SQL snapshots: the guards throw before execution and the empty-values
// case emits no query.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tLedgerEntry, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

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
        const r = sync(ctx.conn.insertInto(tProject).values([]).executeInsert())
        expect(r).toBe(0)
    })

    test('insert-guards/empty-values-returning-last-id-resolves-empty-array', async () => {
        const r = sync(ctx.conn.insertInto(tProject)
            .values([]).returningLastInsertedId().executeInsert())
        expect(r).toEqual([])
    })

    test('insert-guards/empty-values-returning-many-resolves-empty-array', async () => {
        // The empty `values([])` short-circuit also covers the RETURNING
        // execute-shapes: no row to insert, so `executeInsertMany` resolves `[]`
        // without dispatching the empty SQL string the driver would reject.
        const r = sync(ctx.conn.insertInto(tProject)
            .values([]).returning({ id: tProject.id }).executeInsertMany())
        expect(r).toEqual([])
    })

    test('insert-guards/empty-values-returning-none-or-one-resolves-null', async () => {
        // Same short-circuit for `executeInsertNoneOrOne`: zero inserted rows is
        // the "none" case, so it resolves `null`.
        const r = sync(ctx.conn.insertInto(tProject)
            .values([]).returning({ id: tProject.id }).executeInsertNoneOrOne())
        expect(r).toBeNull()
    })

    test('insert-guards/empty-values-returning-one-throws-no-result', async () => {
        // `executeInsertOne` requires exactly one row; an empty batch has none, so
        // it rejects with NO_RESULT (as its no-row branch does) instead of
        // dispatching the empty SQL string.
        let caught: unknown
        try {
            sync(ctx.conn.insertInto(tProject)
                .values([]).returning({ id: tProject.id }).executeInsertOne())
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('NO_RESULT')
    })



    test('insert-guards/empty-values-returning-one-column-none-or-one-resolves-null', async () => {
        // `values([])` with `returningOneColumn(...)`: the empty batch short-circuits,
        // so `executeInsertNoneOrOne()` resolves `null` without dispatching SQL.
        const r = sync(ctx.conn.insertInto(tProject)
            .values([]).returningOneColumn(tProject.id).executeInsertNoneOrOne())
        assertType<Exact<typeof r, number | null>>()
        expect(r).toBeNull()
    })

    test('insert-guards/empty-values-returning-one-column-one-throws-no-result', async () => {
        // `values([])` with `returningOneColumn(...)`: `executeInsertOne()` needs
        // exactly one row, so the empty batch rejects with NO_RESULT (no SQL dispatched).
        let caught: unknown
        try {
            sync(ctx.conn.insertInto(tProject)
                .values([]).returningOneColumn(tProject.id).executeInsertOne())
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('NO_RESULT')
    })

    test('insert-guards/empty-values-returning-one-column-many-resolves-empty-array', async () => {
        // `values([])` with `returningOneColumn(...)`: the empty batch short-circuits,
        // so `executeInsertMany()` resolves `[]` without dispatching SQL.
        const r = sync(ctx.conn.insertInto(tProject)
            .values([]).returningOneColumn(tProject.id).executeInsertMany())
        assertType<Exact<typeof r, number[]>>()
        expect(r).toEqual([])
    })

    test('insert-guards/empty-values-with-min-throws-minimum-rows', async () => {
        // The empty `values([])` short-circuit runs the min/max guard against the
        // resulting count of 0: `executeInsert(1)` on an empty batch reaches its
        // guard with count 0 < min 1, so it rejects with MINIMUM_ROWS_NOT_REACHED
        // instead of resolving 0. No SQL is dispatched.
        let caught: unknown
        try {
            sync(ctx.conn.insertInto(tProject).values([]).executeInsert(1))
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('MINIMUM_ROWS_NOT_REACHED')
    })

    test('insert-guards/empty-values-returning-last-id-with-min-throws-minimum-rows', async () => {
        // Same for the returning-last-id shape: `executeInsert(1)` after
        // `returningLastInsertedId()` on an empty batch reaches its guard with count 0 <
        // min 1, so it rejects with MINIMUM_ROWS_NOT_REACHED instead of resolving `[]`.
        // No SQL is dispatched.
        let caught: unknown
        try {
            sync(ctx.conn.insertInto(tProject)
                .values([]).returningLastInsertedId().executeInsert(1))
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('MINIMUM_ROWS_NOT_REACHED')
    })

    test('insert-guards/empty-values-returning-many-with-min-throws-minimum-rows', async () => {
        // The empty `values([])` short-circuit still runs the min/max guard against
        // the resulting count of 0: `executeInsertMany(1)` on an empty batch reaches
        // its guard with count 0 < min 1, so it rejects with MINIMUM_ROWS_NOT_REACHED
        // instead of resolving `[]`. No SQL is dispatched.
        let caught: unknown
        try {
            sync(ctx.conn.insertInto(tProject)
                .values([]).returning({ id: tProject.id }).executeInsertMany(1))
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('MINIMUM_ROWS_NOT_REACHED')
    })
    test('insert-guards/returning-last-id-throws-when-id-is-null', async () => {
        // A plain single-row `returningLastInsertedId()` (no `onConflictDoNothing()`)
        // is typed non-null, so a driver returning no id violates that contract: the
        // guard must throw MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE rather than
        // resolve `null`.
        // MOCK-ONLY: a real INSERT always produces the generated id, so the missing id can only be
        // forced through the mock.
        ctx.mockOnlyConnection()
        ctx.mockNext(null)
        let caught: unknown
        try {
            sync(ctx.conn.insertInto(tOrganization)
                .values({ name: 'Ghost', plan: 'free' })
                .returningLastInsertedId()
                .executeInsert())
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE')
    })

    test('insert-guards/multi-row-returning-last-id-throws-when-an-id-is-null', async () => {
        // A multi-row `returningLastInsertedId()` validates each returned id
        // INDIVIDUALLY, so a null element in the id array violates the non-null
        // contract: the per-row guard throws
        // MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE decorated with the offending
        // `rowIndex` (here 1, the second row).
        // MOCK-ONLY: a real INSERT always produces an id for every row, so a null element can only
        // be forced through the mock.
        ctx.mockOnlyConnection()
        ctx.mockNext([1, null])
        let caught: unknown
        try {
            sync(ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'Ghost A', plan: 'free' },
                    { name: 'Ghost B', plan: 'pro' },
                ])
                .returningLastInsertedId()
                .executeInsert())
        } catch (e) { caught = e }
        const reason = caught instanceof TsSqlError ? caught.errorReason : undefined
        expect(reason?.reason).toBe('MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE')
        expect(reason && reason.reason === 'MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE' ? reason.rowIndex : undefined).toBe(1)
    })

    test('insert-guards/multi-row-returning-last-id-throws-when-an-id-is-null-with-adapter', async () => {
        // `tLedgerEntry.entryNo` is an autogeneratedPrimaryKey carrying a
        // TypeAdapter (plusOffsetAdapter), so a multi-row
        // `returningLastInsertedId()` runs each returned id through the
        // adapter-applied per-row guard. A null element in the id array still
        // violates the non-null contract: the guard throws
        // MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE decorated with the offending
        // `rowIndex` (here 1, the second row).
        // MOCK-ONLY: a real INSERT always produces an id for every row, so a null element can only
        // be forced through the mock.
        ctx.mockOnlyConnection()
        ctx.mockNext([1, null])
        let caught: unknown
        try {
            sync(ctx.conn.insertInto(tLedgerEntry)
                .values([
                    { amount: 10 },
                    { amount: 20 },
                ])
                .returningLastInsertedId()
                .executeInsert())
        } catch (e) { caught = e }
        const reason = caught instanceof TsSqlError ? caught.errorReason : undefined
        expect(reason?.reason).toBe('MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE')
        expect(reason && reason.reason === 'MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE' ? reason.rowIndex : undefined).toBe(1)
    })

    test('insert-guards/returning-last-id-throws-invalid-value-when-id-is-not-an-integer', async () => {
        // The INVALID_VALUE twin of the null-id guard above: a plain single-row
        // `returningLastInsertedId()` is typed non-null `number`, so a driver
        // handing back a non-integer id (1.5) violates the int contract:
        // `transformValueFromDB` rejects it with INVALID_VALUE_RECEIVED_FROM_DATABASE
        // (distinct from the MANDATORY_VALUE null-id gate) rather than resolve it.
        // MOCK-ONLY: a real INSERT always produces a valid generated id, so the wrong-typed id can
        // only be forced through the mock.
        ctx.mockOnlyConnection()
        ctx.mockNext(1.5)
        let caught: unknown
        try {
            sync(ctx.conn.insertInto(tOrganization)
                .values({ name: 'Ghost', plan: 'free' })
                .returningLastInsertedId()
                .executeInsert())
        } catch (e) { caught = e }
        expect(reasonOf(caught)).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    test('insert-guards/multi-row-returning-last-id-throws-invalid-value-when-an-id-is-not-an-integer', async () => {
        // The INVALID_VALUE twin of the multi-row null-id guard: each returned id
        // is validated INDIVIDUALLY, so a non-integer element (1.5) violates the
        // int contract — the per-row guard throws INVALID_VALUE_RECEIVED_FROM_DATABASE
        // decorated with the offending `rowIndex` (here 1, the second row).
        // MOCK-ONLY: a real INSERT always produces a valid id for every row, so the wrong-typed id
        // can only be forced through the mock.
        ctx.mockOnlyConnection()
        ctx.mockNext([1, 1.5])
        let caught: unknown
        try {
            sync(ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'Ghost A', plan: 'free' },
                    { name: 'Ghost B', plan: 'pro' },
                ])
                .returningLastInsertedId()
                .executeInsert())
        } catch (e) { caught = e }
        const reason = caught instanceof TsSqlError ? caught.errorReason : undefined
        expect(reason?.reason).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(reason && reason.reason === 'INVALID_VALUE_RECEIVED_FROM_DATABASE' ? reason.rowIndex : undefined).toBe(1)
    })

    test('insert-guards/multi-row-returning-last-id-throws-invalid-value-when-an-id-is-not-an-integer-with-adapter', async () => {
        // The INVALID_VALUE twin of the adapter multi-row null-id guard:
        // `tLedgerEntry.entryNo` is an autogeneratedPrimaryKey carrying a
        // TypeAdapter (plusOffsetAdapter), so each returned id runs through the
        // adapter-applied per-row guard. A non-integer element (1.5) still violates
        // the int contract — the guard throws INVALID_VALUE_RECEIVED_FROM_DATABASE
        // decorated with the offending `rowIndex` (here 1, the second row).
        // MOCK-ONLY: a real INSERT always produces a valid id for every row, so the wrong-typed id
        // can only be forced through the mock.
        ctx.mockOnlyConnection()
        ctx.mockNext([1, 1.5])
        let caught: unknown
        try {
            sync(ctx.conn.insertInto(tLedgerEntry)
                .values([
                    { amount: 10 },
                    { amount: 20 },
                ])
                .returningLastInsertedId()
                .executeInsert())
        } catch (e) { caught = e }
        const reason = caught instanceof TsSqlError ? caught.errorReason : undefined
        expect(reason?.reason).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(reason && reason.reason === 'INVALID_VALUE_RECEIVED_FROM_DATABASE' ? reason.rowIndex : undefined).toBe(1)
    })
})
