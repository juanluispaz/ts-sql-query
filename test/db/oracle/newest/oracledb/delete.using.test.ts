// Coverage of `DELETE … USING other-table`. Oracle doesn't support
// this syntax (use MERGE or a correlated subquery instead). The
// library type-excludes Oracle. Kept commented for symmetry.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    /*
    test('delete-using-other-table', async () => {
        // See postgres/mariadb/mysql/sqlserver cells for the active body.
    })
    */
})
