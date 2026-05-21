// Coverage of the INSERT executor variants the other INSERT tests
// don't exercise:
//
//   - `executeInsert(min, max)` — min-/max-row guards in
//     [InsertQueryBuilder.ts:164](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L164).
//     Plain inserts (no RETURNING) compare `min`/`max` against the
//     engine's reported rowCount.
//
// MySQL does not support `INSERT … RETURNING` in any released version,
// and the fluent surface narrows `returning` / `returningOneColumn` to
// `never` for `mysql` (see [src/expressions/insert.ts](../../../../../src/expressions/insert.ts)).
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

    // mysql does not support the RETURNING clause; the library narrows
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

    // mysql narrows .returningOneColumn(...) to never. Kept commented
    // for symmetry.
    /*
    test('execute-insert-none-or-one-with-returning-one-column', async () => {
        ctx.mockNext(500)
        // ... see other cells for the full body.
    })
    */

    /*
    test('execute-insert-none-or-one-with-returning-one-column-empty-result', async () => {
        if (ctx.realDbEnabled) return
        ctx.mockNext(undefined)
        // ... see other cells for the full body.
    })
    */

    /*
    test('execute-insert-one-with-returning-one-column', async () => {
        ctx.mockNext(777)
        // ... see other cells for the full body.
    })
    */

    // mysql narrows .returning({...}) to never. Kept commented for
    // symmetry.
    /*
    test('execute-insert-one-throws-no-result-when-row-missing', async () => {
        if (ctx.realDbEnabled) return
        ctx.mockNext(undefined)
        // ... see other cells for the full body.
    })
    */

    /*
    test('execute-insert-many-with-returning-one-column', async () => {
        // `executeInsertMany()` + `returningOneColumn(col)` lands on
        // the `__oneColumn` branch of the many-returning path
        // ([InsertQueryBuilder.ts:272](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L272))
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
