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
// All four are commented out with `TODO[LIMITATION]`: the type-system
// narrowing means the bodies can't type-check here today, but MySQL
// 8.0.31+ (verified on mysql:9) supports these operators — a library
// gap, not a permanent dialect frontier. Kept for symmetry with the
// postgres/mariadb cells (where they run live).

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // TODO[LIMITATION]: see LIMITATIONS.md — mysql narrows intersectAll/exceptAll/minus/minusAll to never, but MySQL 8.0.31+ (verified on mysql:9) supports them; a library gap (paired with the never assertion in test/db/mysql/types.negative/select.test.ts). Runs in postgres/mariadb.
    /*
    test('intersect-all-emits-intersect-all-syntax', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — mysql narrows intersectAll/exceptAll/minus/minusAll to never, but MySQL 8.0.31+ (verified on mysql:9) supports them; a library gap (paired with the never assertion in test/db/mysql/types.negative/select.test.ts). Runs in postgres/mariadb.
    /*
    test('except-all-emits-except-all-syntax', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — mysql narrows intersectAll/exceptAll/minus/minusAll to never, but MySQL 8.0.31+ (verified on mysql:9) supports them; a library gap (paired with the never assertion in test/db/mysql/types.negative/select.test.ts). Runs in postgres/mariadb.
    /*
    test('minus-routes-through-the-dialect-alias', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — mysql narrows intersectAll/exceptAll/minus/minusAll to never, but MySQL 8.0.31+ (verified on mysql:9) supports them; a library gap (paired with the never assertion in test/db/mysql/types.negative/select.test.ts). Runs in postgres/mariadb.
    /*
    test('minus-all-routes-through-the-dialect-alias', async () => {})
    */
})
