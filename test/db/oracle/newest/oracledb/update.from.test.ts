// Coverage of `UPDATE … FROM other-table`. Oracle: the library
// type-excludes `update(...).from(...)` even though the published
// docs show Oracle SQL for the pattern. TODO[BUG] oracle docs mention
// UPDATE … FROM support, but the type signature in
// src/expressions/update.ts does not include 'oracle'. Kept
// commented for symmetry.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    /*
    test('update-from-other-table', async () => {
        // See postgres/sqlite/sqlserver/mariadb/mysql cells for the body.
    })
    */
})
