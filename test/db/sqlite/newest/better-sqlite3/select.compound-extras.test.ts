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
// `NOT-APPLICABLE`: the type-system narrowing is a permanent dialect
// frontier (the bodies can never type-check here), kept for symmetry
// with the postgres/mariadb cells.
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

    // NOT-APPLICABLE: SQLite has no `INTERSECT ALL` — `intersectAll` is
    // `never` for sqlite (compile-time frontier, paired with
    // test/db/sqlite/types.negative/select.test.ts). Runs in postgres/mariadb.
    /*
    test('intersect-all-emits-intersect-all-syntax', async () => {})
    */

    // NOT-APPLICABLE: SQLite has no `EXCEPT ALL` — `exceptAll` is `never`
    // for sqlite (compile-time frontier, paired with
    // test/db/sqlite/types.negative/select.test.ts). Runs in postgres/mariadb.
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

    // NOT-APPLICABLE: SQLite has no `MINUS ALL` (nor its `EXCEPT ALL`
    // rewrite) — `minusAll` is `never` for sqlite (frontier, paired with
    // test/db/sqlite/types.negative/select.test.ts). Runs in postgres/mariadb.
    /*
    test('minus-all-routes-through-the-dialect-alias', async () => {})
    */
})
