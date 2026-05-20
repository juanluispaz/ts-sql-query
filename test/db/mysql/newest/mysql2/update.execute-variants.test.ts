// Coverage of the UPDATE executor variants the other UPDATE tests
// don't exercise:
//
//   - `executeUpdate(min, max)` — min-/max-row guards in
//     [UpdateQueryBuilder.ts:50](../../../../../src/queryBuilders/UpdateQueryBuilder.ts#L50)
//     (throws `MINIMUM_ROWS_NOT_REACHED` / `MAXIMUM_ROWS_EXCEEDED`).
//   - `executeUpdateNoneOrOne()` with `returningOneColumn(...)` — the
//     `__oneColumn` branch in
//     [UpdateQueryBuilder.ts:93](../../../../../src/queryBuilders/UpdateQueryBuilder.ts#L93)
//     plus its `value === undefined → null` coercion path.
//   - `executeUpdateMany(min, max)` — the same min/max guards on the
//     RETURNING-many path.
//
// The two `min`/`max`-only tests don't need RETURNING and run on
// MySQL identically to every other dialect. The other four tests
// (every variant that uses `.returning(...)` or
// `.returningOneColumn(...)`) are commented out: MySQL does not
// support `UPDATE … RETURNING` in any released version, and the
// fluent surface in
// [src/expressions/update.ts:521-531](../../../../../src/expressions/update.ts#L521-L531)
// narrows those methods to `never` for `mysql` exactly to encode that
// limitation in the type system — so the test would not even
// type-check on this cell.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('execute-update-with-min-max-passes-when-count-in-range', async () => {
        ctx.mockNext(3)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .set({ status: 'reviewed' })
                .where(tIssue.priority.greaterOrEqual(1))
                .executeUpdate(2, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set \`status\` = ? where priority >= ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "reviewed",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(3)
        })
    })

    test('execute-update-throws-when-fewer-rows-than-min', async () => {
        ctx.mockNext(0)
        let caught: unknown
        try {
            await ctx.conn.update(tIssue)
                .set({ status: 'reviewed' })
                .where(tIssue.priority.equals(99))
                .executeUpdate(1)
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't update the minimum/)
    })

    test('execute-update-throws-when-more-rows-than-max', async () => {
        if (ctx.realDbEnabled) return
        ctx.mockNext(10)
        let caught: unknown
        try {
            await ctx.conn.update(tIssue)
                .set({ status: 'reviewed' })
                .where(tIssue.priority.greaterOrEqual(1))
                .executeUpdate(0, 1)
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|updated more/)
    })

    // TODO[LIMITATION]: see LIMITATIONS.md — MySQL has no UPDATE …
    // RETURNING in any released version (no WL has shipped yet). The
    // fluent API encodes this by narrowing `returningOneColumn` to
    // `never` for `mysql`, so the test body would not even type-check
    // here. Re-enable if/when MySQL adds the syntax.
    /*
    test('execute-update-none-or-one-with-returning-one-column', async () => {
        // See sqlite / postgres cells for the active body.
    })

    test('execute-update-none-or-one-with-returning-one-column-empty-result', async () => {
        // See sqlite / postgres cells for the active body.
    })

    test('execute-update-many-with-min-max-throws-when-out-of-range', async () => {
        // See sqlite / postgres cells for the active body.
    })

    test('execute-update-many-with-min-max-throws-when-over-max', async () => {
        // See sqlite / postgres cells for the active body.
    })
    */
})
