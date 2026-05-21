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
        // Single-row plain insert with the engine reporting 0 rows and
        // `executeInsert(1)`: count = 0 < min → throws
        // MINIMUM_ROWS_NOT_REACHED. Mock-only because no real engine
        // returns 0 for a successful insert.
        if (ctx.realDbEnabled) return
        ctx.mockNext(0)
        let caught: unknown
        try {
            await ctx.conn.insertInto(tOrganization)
                .values({ name: 'Pied Piper', plan: 'free' })
                .executeInsert(1)
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't insert the minimum/)
    })

    // mysql does not support the RETURNING clause; the library narrows
    // multi-row + .returningLastInsertedId() to `never`. Kept here
    // commented for symmetry.
    /*
    test('execute-insert-multi-row-returning-last-inserted-id-passes', async () => {
        if (ctx.realDbEnabled) return
        ctx.mockNext([101, 102])
        const ids = await ctx.conn.insertInto(tOrganization)
            .values([
                { name: 'Stark Industries', plan: 'pro' },
                { name: 'Wayne Enterprises', plan: 'pro' },
            ])
            .returningLastInsertedId()
            .executeInsert(2, 5)
        // ... see other cells for the full body.
    })
    */

    /*
    test('execute-insert-multi-row-throws-when-too-few-ids', async () => {
        if (ctx.realDbEnabled) return
        ctx.mockNext([101])
        // ... see other cells for the full body.
    })
    */

    /*
    test('execute-insert-multi-row-throws-when-too-many-ids', async () => {
        if (ctx.realDbEnabled) return
        ctx.mockNext([101, 102, 103])
        // ... see other cells for the full body.
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
        if (ctx.realDbEnabled) return
        ctx.mockNext([201, 202])
        // ... see other cells for the full body.
    })
    */

    /*
    test('execute-insert-many-with-min-throws-when-empty', async () => {
        if (ctx.realDbEnabled) return
        ctx.mockNext([])
        // ... see other cells for the full body.
    })
    */

    /*
    test('execute-insert-many-with-max-throws-when-over-limit', async () => {
        if (ctx.realDbEnabled) return
        ctx.mockNext([{ id: 1 }, { id: 2 }, { id: 3 }])
        // ... see other cells for the full body.
    })
    */
})
