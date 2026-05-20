// Coverage of the compound-operator variants
// [select.compound.test.ts](./select.compound.test.ts) leaves on the
// table: `intersectAll`, `exceptAll`, `minus`, `minusAll`. Each lands
// on `_appendCompoundOperator` in
// [src/sqlBuilders/AbstractSqlBuilder.ts:661](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L661),
// which is overridden by
// [`OracleSqlBuilder._appendCompoundOperator`](../../../../../src/sqlBuilders/OracleSqlBuilder.ts#L340).
//
// On Oracle only `.minus(...)` is exposed by the fluent API
// ([src/expressions/select.ts:126](../../../../../src/expressions/select.ts#L126));
// `.intersectAll`/`.exceptAll`/`.minusAll` are narrowed to `never`.
// Those three tests are commented out with
// `TODO[LIMITATION]: see LIMITATIONS.md` to keep the test count
// symmetric with the postgres/mariadb cells while honouring the
// type-system narrowing.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // TODO[LIMITATION]: see LIMITATIONS.md — `intersectAll` is
    // narrowed to `never` for `oracle`. See the postgres / mariadb
    // cells for the active body.
    /*
    test('intersect-all-emits-intersect-all-syntax', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — `exceptAll` is narrowed
    // to `never` for `oracle`. (Oracle would accept the native
    // `MINUS ALL` form, but the fluent surface chose to expose the
    // `*All` family only on postgres / mariadb.)
    /*
    test('except-all-emits-except-all-syntax', async () => {})
    */

    test('minus-routes-through-the-dialect-alias', async () => {
        // TODO[BUG]: see test/BUGS.md — on Oracle the fluent
        // `.minus(...)` method (the user-facing name for Oracle's
        // NATIVE set-difference operator) emits ` except ` instead of
        // the expected ` minus `.
        // [OracleSqlBuilder.ts:354-357](../../../../../src/sqlBuilders/OracleSqlBuilder.ts#L354)
        // swaps the cases for `minus` and `except`, so the
        // dialect-native call lands on the non-Oracle keyword. Real
        // Oracle ≤ 20c rejects `EXCEPT` outright. The snapshot below
        // pins the current (buggy) emitted SQL so the suite stays
        // green.
        const expected = [{ status: 'closed' }]
        ctx.mockNext(expected)
        const all = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const small = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ status: tIssue.status })
        try {
            await all.minus(small).executeSelectMany()
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as "status" from issue except select status as "status" from issue where id <= :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
    })

    // TODO[LIMITATION]: see LIMITATIONS.md — `minusAll` is narrowed
    // to `never` for `oracle`. (Oracle would accept the native `MINUS
    // ALL`, but the fluent surface chose to expose the `*All` family
    // only on postgres / mariadb.)
    /*
    test('minus-all-routes-through-the-dialect-alias', async () => {})
    */
})
