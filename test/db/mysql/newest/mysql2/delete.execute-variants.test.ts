// Mirror of [update.execute-variants.test.ts](./update.execute-variants.test.ts)
// for the DELETE side. Lights up:
//
//   - `executeDelete(min, max)` — min-/max-row guards in
//     [DeleteQueryBuilder.ts:45](../../../../../src/queryBuilders/DeleteQueryBuilder.ts#L45).
//   - `executeDeleteNoneOrOne()` with `returningOneColumn(...)` — the
//     `__oneColumn` branch in
//     [DeleteQueryBuilder.ts:76](../../../../../src/queryBuilders/DeleteQueryBuilder.ts#L76)
//     plus its `value === undefined → null` coercion path.
//   - `executeDeleteMany(min, max)` — the same min/max guards on the
//     RETURNING-many path.
//
// MySQL does not support `DELETE … RETURNING` in any released
// version, and the fluent surface in
// [src/expressions/delete.ts:177-188](../../../../../src/expressions/delete.ts#L177-L188)
// narrows `returning` / `returningOneColumn` to `never` for `mysql`
// to encode that limitation in the type system. The four tests that
// rely on those methods stay commented out here; the two `min`/`max`-
// only tests run identically to every other dialect.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('execute-delete-with-min-max-passes-when-count-in-range', async () => {
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.priority.greaterOrEqual(1))
                .executeDelete(2, 5)

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where priority >= ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(4)
        })
    })

    test('execute-delete-throws-when-fewer-rows-than-min', async () => {
        ctx.mockNext(0)
        let caught: unknown
        try {
            await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.priority.equals(99))
                .executeDelete(1)
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/MINIMUM_ROWS_NOT_REACHED|didn't delete the minimum/)
    })

    test('execute-delete-throws-when-more-rows-than-max', async () => {
        if (ctx.realDbEnabled) return
        ctx.mockNext(10)
        let caught: unknown
        try {
            await ctx.conn.deleteFrom(tIssue)
                .where(tIssue.priority.greaterOrEqual(1))
                .executeDelete(0, 1)
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/MAXIMUM_ROWS_EXCEEDED|deleted more/)
    })

    // TODO[LIMITATION]: see LIMITATIONS.md — MySQL has no DELETE …
    // RETURNING in any released version. The fluent API encodes this
    // by narrowing `returningOneColumn` / `returning` to `never` for
    // `mysql`, so the test body would not even type-check here.
    /*
    test('execute-delete-none-or-one-with-returning-one-column', async () => {
        // See sqlite / postgres cells for the active body.
    })

    test('execute-delete-none-or-one-with-returning-one-column-empty-result', async () => {
        // See sqlite / postgres cells for the active body.
    })

    test('execute-delete-many-with-min-throws-when-empty', async () => {
        // See sqlite / postgres cells for the active body.
    })

    test('execute-delete-many-with-max-throws-when-over-limit', async () => {
        // See sqlite / postgres cells for the active body.
    })
    */
})
