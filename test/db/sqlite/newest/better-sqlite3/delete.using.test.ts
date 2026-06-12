// Coverage of `DELETE … USING other-table` (PostgreSQL/SQL Server/
// MariaDB/MySQL syntax). SQLite and Oracle don't support it; their
// cells comment the test out for symmetry.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: SQLite does not support DELETE … USING; the library type-excludes it for sqlite connections.
    /*
    test('delete-using-other-table', async () => {
        // See postgres/mariadb/mysql/sqlserver cells for the active body.
    })
    */
})
