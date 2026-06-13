// Coverage of the compound-operator variants
// [select.compound.test.ts](./select.compound.test.ts) leaves on the
// table: `intersectAll`, `exceptAll`, `minus`, `minusAll`. Each lands
// on `_appendCompoundOperator` in
// [src/sqlBuilders/AbstractSqlBuilder.ts:661](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L661).
//
// MySQL exposes NONE of these four operators on the fluent API
// ([src/expressions/select.ts:122-127](../../../../../src/expressions/select.ts#L122-L127)
// narrows `intersectAll`/`exceptAll`/`minus`/`minusAll` to `never`
// for `mysql`), so every test body would fail to type-check here.
// All four are commented out with `NOT-APPLICABLE`: the type-system
// narrowing is a permanent dialect frontier (the bodies can never
// type-check here), kept for symmetry with the postgres/mariadb cells.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: the mysql dialect narrows `intersectAll`, `exceptAll`,
    // `minus` and `minusAll` to `never` (compile-time frontier, paired with
    // test/db/mysql/types.negative/select.test.ts). Runs in postgres/mariadb.
    /*
    test('intersect-all-emits-intersect-all-syntax', async () => {})
    */

    // NOT-APPLICABLE: the mysql dialect narrows `intersectAll`, `exceptAll`,
    // `minus` and `minusAll` to `never` (compile-time frontier, paired with
    // test/db/mysql/types.negative/select.test.ts). Runs in postgres/mariadb.
    /*
    test('except-all-emits-except-all-syntax', async () => {})
    */

    // NOT-APPLICABLE: the mysql dialect narrows `intersectAll`, `exceptAll`,
    // `minus` and `minusAll` to `never` (compile-time frontier, paired with
    // test/db/mysql/types.negative/select.test.ts). Runs in postgres/mariadb.
    /*
    test('minus-routes-through-the-dialect-alias', async () => {})
    */

    // NOT-APPLICABLE: the mysql dialect narrows `intersectAll`, `exceptAll`,
    // `minus` and `minusAll` to `never` (compile-time frontier, paired with
    // test/db/mysql/types.negative/select.test.ts). Runs in postgres/mariadb.
    /*
    test('minus-all-routes-through-the-dialect-alias', async () => {})
    */
})
