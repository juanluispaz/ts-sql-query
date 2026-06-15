// Coverage of the INSERT executor variants the other INSERT tests
// don't exercise:
//
//   - `executeInsert(min, max)` — min-/max-row guards
//     Plain inserts (no RETURNING) compare `min`/`max` against the
//     engine's reported rowCount; the `.returningLastInsertedId()` path
//     compares against `result.length` (multi-row) or 0/1 based on the
//     id being null/non-null (single-row).
//   - `.values([...]).returningLastInsertedId().executeInsert()` — the
//     multi-row last-inserted-id path
//     that dispatches through
//     `_queryRunner.executeInsertReturningMultipleLastInsertedId`.
//   - `executeInsertNoneOrOne()` + `returningOneColumn(...)` — the
//     `__oneColumn` branch
//     plus its `value === undefined → null` coercion path.
//   - `executeInsertOne()` + `returningOneColumn(...)` — same shape, but
//     throws `NO_RESULT` when the engine returns nothing
//   - `executeInsertMany(min, max)` with `returningOneColumn(...)` and
//     with `returning({...})` — covers both `__oneColumn` and row-shape
//     branches of the many-returning path.
//
// MySQL does not support `INSERT … RETURNING` in any released version,
// and the fluent surface narrows `returning` / `returningOneColumn` to
// `never` for `mysql`.
// Multi-row inserts with `.returningLastInsertedId()` are likewise
// narrowed because the driver cannot harvest per-row ids without
// engine-side RETURNING. The 10 tests that rely on those methods stay
// commented out here; the two single-row min/max-only tests run
// identically to every other dialect.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('execute-insert-with-min-max-passes-for-single-row', async () => {
        // Single-row plain insert: count = engine's reported rowCount
        // (1 here), in range for `executeInsert(1, 5)`.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const inserted = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Hooli', plan: 'free' })
                .executeInsert(1, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into \`organization\` (\`name\`, plan) values (?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Hooli",
                "free",
              ]
            `)
            assertType<Exact<typeof inserted, number>>()
            if (!ctx.realDbEnabled) expect(inserted).toBe(1)
        })
    })

    test('execute-insert-throws-when-fewer-than-min-on-single-row', async () => {
        // Single-row plain insert with `executeInsert(2)`: real DB
        // reports rowCount = 1, 1 < min = 2 -> throws
        // `MINIMUM_ROWS_NOT_REACHED`.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tOrganization)
                    .values({ name: 'Pied Piper', plan: 'pro' })
                    .executeInsert(2)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't insert the minimum/)
        })
    })

    // NOT-APPLICABLE: MySQL has no RETURNING — the library narrows
    // multi-row + .returningLastInsertedId() to `never`. Kept here
    // commented for symmetry.
    /*
    test('execute-insert-multi-row-returning-last-inserted-id-passes', async () => {
        // `.values([...]).returningLastInsertedId().executeInsert()`
        // dispatches through `executeInsertReturningMultipleLastInsertedId`
        // and returns `number[]`. The min/max guards count
        // `result.length` (the `Array.isArray(result)` branch). Real
        // DB returns engine-assigned ids; the value assertion is
        // length-based to avoid pinning specific id values.
        ctx.mockNext([101, 102])
        await ctx.withRollback(async () => {
            const ids = await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'Stark Industries', plan: 'pro' },
                    { name: 'Wayne Enterprises', plan: 'pro' },
                ])
                .returningLastInsertedId()
                .executeInsert(2, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof ids, number[]>>()
            expect(ids.length).toBe(2)
            if (!ctx.realDbEnabled) expect(ids).toEqual([101, 102])
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — multi-row .returningLastInsertedId() narrows to `never`.
    /*
    test('execute-insert-multi-row-throws-when-too-few-ids', async () => {
        // Same multi-row path; insert 3 rows but require min = 4 so
        // real DB returns 3 ids, 3 < 4 throws
        // `MINIMUM_ROWS_NOT_REACHED`.
        ctx.mockNext([101, 102, 103])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tOrganization)
                    .values([
                        { name: 'Wonka Industries', plan: 'free' },
                        { name: 'Cyberdyne Systems', plan: 'pro' },
                        { name: 'Tyrell Corporation', plan: 'free' },
                    ])
                    .returningLastInsertedId()
                    .executeInsert(4)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't insert the minimum/)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — multi-row .returningLastInsertedId() narrows to `never`.
    /*
    test('execute-insert-multi-row-throws-when-too-many-ids', async () => {
        // Same multi-row path; insert 3 rows with max = 1 so real DB
        // returns 3 ids, 3 > 1 throws `MAXIMUM_ROWS_EXCEEDED`.
        ctx.mockNext([101, 102, 103])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tOrganization)
                    .values([
                        { name: 'Vandelay Industries', plan: 'free' },
                        { name: 'Massive Dynamic', plan: 'pro' },
                        { name: 'Soylent Corp', plan: 'free' },
                    ])
                    .returningLastInsertedId()
                    .executeInsert(0, 1)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|insert more that the maximum/)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returningOneColumn(...) narrows to `never`. Kept commented
    // for symmetry.
    /*
    test('execute-insert-none-or-one-with-returning-one-column', async () => {
        // `executeInsertNoneOrOne()` + `returningOneColumn(col)` lands
        // on the `__oneColumn` branch and returns the single value.
        // The inserted row always exists, so the result is the
        // engine-assigned id (never null on the real DB).
        ctx.mockNext(500)
        await ctx.withRollback(async () => {
            const result = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Umbrella Corp', plan: 'pro' })
                .returningOneColumn(tOrganization.id)
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof result, number | null>>()
            if (ctx.realDbEnabled) expect(typeof result).toBe('number')
            else expect(result).toBe(500)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returningOneColumn(...) narrows to `never`.
    /*
    test('execute-insert-none-or-one-with-returning-one-column-empty-result', async () => {
        // A 0-row `INSERT ... SELECT` (the source select matches no row) inserts
        // nothing, so `RETURNING` yields no row and `executeInsertNoneOrOne()`'s
        // `__oneColumn` branch coerces the missing value to `null`. Driving it
        // through a never-matching select reaches that coercion on the REAL
        // engine, not only the mock.
        await ctx.withRollback(async () => {
            ctx.mockNext(undefined)
            // "Clone" the organizations matching a never-true filter: the source
            // select yields no row, so nothing is inserted and RETURNING is empty.
            const source = ctx.conn.selectFrom(tOrganization)
                .where(tOrganization.id.equals(-1))
                .select({ name: tOrganization.name, plan: tOrganization.plan })
            const result = await ctx.conn.insertInto(tOrganization)
                .from(source)
                .returningOneColumn(tOrganization.id)
                .executeInsertNoneOrOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            expect(result).toBeNull()
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returningOneColumn(...) narrows to `never`.
    /*
    test('execute-insert-one-with-returning-one-column', async () => {
        // `executeInsertOne()` + `returningOneColumn(col)` covers the
        // value branch of the `__oneColumn` shape. The inserted row
        // always exists, so the result is the engine-assigned id.
        ctx.mockNext(777)
        await ctx.withRollback(async () => {
            const result = await ctx.conn.insertInto(tOrganization)
                .values({ name: 'LexCorp', plan: 'pro' })
                .returningOneColumn(tOrganization.id)
                .executeInsertOne()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof result, number>>()
            if (ctx.realDbEnabled) expect(typeof result).toBe('number')
            else expect(result).toBe(777)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returning({...}) narrows to `never`. Kept commented for
    // symmetry.
    /*
    test('execute-insert-one-throws-no-result-when-row-missing', async () => {
        // `executeInsertOne()` raises `NO_RESULT` when the engine
        // returns no row
        // Mock-only: real INSERT always returns the inserted row.
        if (ctx.realDbEnabled) return
        ctx.mockNext(undefined)
        let caught: unknown
        try {
            await ctx.conn.insertInto(tProject)
                .values({ organizationId: 1, name: 'Customer portal', slug: 'customer-portal' })
                .returning({ id: tProject.id })
                .executeInsertOne()
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/NO_RESULT|No result returned/)
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returningOneColumn(...) narrows to `never`.
    /*
    test('execute-insert-many-with-returning-one-column', async () => {
        // `executeInsertMany()` + `returningOneColumn(col)` lands on
        // the `__oneColumn` branch of the many-returning path
        // and returns an array of the projected column. Real DB
        // returns engine-assigned ids; the value assertion is
        // length-based to avoid pinning specific id values.
        ctx.mockNext([201, 202])
        await ctx.withRollback(async () => {
            const ids = await ctx.conn.insertInto(tOrganization)
                .values([
                    { name: 'Initrode', plan: 'free' },
                    { name: 'Gringotts', plan: 'pro' },
                ])
                .returningOneColumn(tOrganization.id)
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof ids, number[]>>()
            expect(ids.length).toBe(2)
            if (!ctx.realDbEnabled) expect(ids).toEqual([201, 202])
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returning({...}) narrows to `never`.
    /*
    test('execute-insert-many-with-min-throws-when-empty', async () => {
        // `executeInsertMany(min, max)` checks `rows.length` after
        // the RETURNING result; insert 2 rows but require min = 3 so
        // real DB returns 2, 2 < 3 throws
        // `MINIMUM_ROWS_NOT_REACHED`.
        ctx.mockNext([{ id: 1 }, { id: 2 }])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tOrganization)
                    .values([
                        { name: 'Aperture Science', plan: 'free' },
                        { name: 'Black Mesa', plan: 'pro' },
                    ])
                    .returning({ id: tOrganization.id })
                    .executeInsertMany(3)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't insert the minimum/)
        })
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING — .returning({...}) narrows to `never`.
    /*
    test('execute-insert-many-with-max-throws-when-over-limit', async () => {
        // Same guard but on the max side: insert 3 rows with
        // max = 1, so real DB returns 3 rows, 3 > 1 throws
        // `MAXIMUM_ROWS_EXCEEDED`.
        ctx.mockNext([
            { id: 1 },
            { id: 2 },
            { id: 3 },
        ])
        await ctx.withRollback(async () => {
            let caught: unknown
            try {
                await ctx.conn.insertInto(tOrganization)
                    .values([
                        { name: 'Weyland-Yutani', plan: 'free' },
                        { name: 'Bluth Company', plan: 'pro' },
                        { name: 'Dunder Mifflin', plan: 'free' },
                    ])
                    .returning({ id: tOrganization.id })
                    .executeInsertMany(0, 1)
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|insert more that the maximum/)
        })
    })
    */
})
