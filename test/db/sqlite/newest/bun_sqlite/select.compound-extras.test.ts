// Coverage of the compound-operator variants
// [select.compound.test.ts](./select.compound.test.ts) leaves on the
// table: `intersectAll`, `exceptAll`, `minus`, `minusAll`. Each lands
// on `_appendCompoundOperator` in
// [src/sqlBuilders/AbstractSqlBuilder.ts:661](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L661).
//
// On SQLite only `.minus(...)` is exposed by the fluent API
// ([src/expressions/select.ts:126](../../../../../src/expressions/select.ts#L126));
// `.intersectAll`/`.exceptAll`/`.minusAll` are narrowed to `never`
// because the engine doesn't accept the `ALL` flavour of these
// operators. Those three tests are commented out with
// `TODO[LIMITATION]` (see LIMITATIONS.md) to keep the test count
// symmetric with the postgres/mariadb cells while honouring the
// type-system narrowing.
//
// Note: `_appendCompoundOperator` rewrites `.minus(...)` to ` except `
// for SQLite (SQLite supports `EXCEPT` natively but not `MINUS`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite does not accept
    // `INTERSECT ALL`; `intersectAll` is narrowed to `never` for `sqlite`.
    // See the postgres / mariadb cells for the active body.
    /*
    test('intersect-all-emits-intersect-all-syntax', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite does not accept
    // `EXCEPT ALL`; `exceptAll` is narrowed to `never` for `sqlite`.
    /*
    test('except-all-emits-except-all-syntax', async () => {})
    */

    test('minus-routes-through-the-dialect-alias', async () => {
        // `.minus(...)` is typed on `sqlite`; the default
        // `_appendCompoundOperator` rewrites it to ` except ` so the
        // engine accepts the emitted SQL. id<=2 → {open, in_progress};
        // all → {open, in_progress, open, closed}; minus → {closed}.
        const expected = [{ status: 'closed' }]
        ctx.mockNext(expected)
        const all = ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status })
        const small = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ status: tIssue.status })
        const result = await all.minus(small).executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status from issue except select status as status from issue where id <= ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(result.map(r => r.status).sort()).toEqual(['closed'])
    })

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite does not accept
    // `MINUS ALL` (nor its `EXCEPT ALL` rewrite); `minusAll` is
    // narrowed to `never` for `sqlite`.
    /*
    test('minus-all-routes-through-the-dialect-alias', async () => {})
    */
})
