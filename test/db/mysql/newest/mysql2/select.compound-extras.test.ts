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
// All four are commented out with `TODO[LIMITATION]` (see LIMITATIONS.md)
// to keep the test count symmetric with the postgres/mariadb cells
// while honouring the type-system narrowing.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // TODO[LIMITATION]: see LIMITATIONS.md — MySQL's pre-8.0.31
    // versions do not support set-difference operators, and the
    // fluent API encodes that by narrowing `intersectAll`,
    // `exceptAll`, `minus` and `minusAll` to `never` for `mysql`. See
    // the postgres / mariadb cells for the active bodies.
    // NOT-APPLICABLE: MySQL has no INTERSECT/EXCEPT
    /*
    test('intersect-all-emits-intersect-all-syntax', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — MySQL's pre-8.0.31
    // versions do not support set-difference operators, and the
    // fluent API encodes that by narrowing `intersectAll`,
    // `exceptAll`, `minus` and `minusAll` to `never` for `mysql`. See
    // the postgres / mariadb cells for the active bodies.
    // NOT-APPLICABLE: MySQL has no INTERSECT/EXCEPT
    /*
    test('except-all-emits-except-all-syntax', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — MySQL's pre-8.0.31
    // versions do not support set-difference operators, and the
    // fluent API encodes that by narrowing `intersectAll`,
    // `exceptAll`, `minus` and `minusAll` to `never` for `mysql`. See
    // the postgres / mariadb cells for the active bodies.
    // NOT-APPLICABLE: MySQL has no INTERSECT/EXCEPT
    /*
    test('minus-routes-through-the-dialect-alias', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — MySQL's pre-8.0.31
    // versions do not support set-difference operators, and the
    // fluent API encodes that by narrowing `intersectAll`,
    // `exceptAll`, `minus` and `minusAll` to `never` for `mysql`. See
    // the postgres / mariadb cells for the active bodies.
    // NOT-APPLICABLE: MySQL has no INTERSECT/EXCEPT
    /*
    test('minus-all-routes-through-the-dialect-alias', async () => {})
    */
})
