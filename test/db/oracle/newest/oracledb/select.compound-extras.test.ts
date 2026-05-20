// Coverage of the compound-operator variants
// [select.compound.test.ts](./select.compound.test.ts) leaves on the
// table: `intersectAll`, `exceptAll`, `minus`, `minusAll`. Each lands
// on `_appendCompoundOperator` in
// [src/sqlBuilders/AbstractSqlBuilder.ts:661](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L661),
// which is overridden by
// [`OracleSqlBuilder._appendCompoundOperator`](../../../../../src/sqlBuilders/OracleSqlBuilder.ts#L340)
// (maps both `except` and `minus` to Oracle's native ` minus `).
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
        // On Oracle the fluent `.minus(...)` method routes through the
        // dialect override and emits ` minus ` (Oracle's native
        // set-difference operator). Oracle does not accept `EXCEPT`.
        const expected = [{ status: 'closed' }]
        ctx.mockNext(expected)
        const all = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const small = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ status: tIssue.status })
        await all.minus(small).executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as "status" from issue minus select status as "status" from issue where id <= :0"`)
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
