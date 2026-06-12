// Extra coverage for `DELETE ... USING other-table` on top of the lone
// scenario already pinned in `delete.using.test.ts`. The canonical body
// lives in the postgres/mariadb/mysql/oracle/sqlserver cells; SQLite
// has no DELETE...USING (the library type-excludes it for sqlite
// connections), so every test is commented out here for symmetry. See
// other cells for the full bodies.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: SQLite has no DELETE...USING; the library type-excludes it for sqlite connections.
    /*
    test('delete-using-with-extra-filter-on-using', async () => {
        // ... see other cells for the full body.
    })
    */

    // NOT-APPLICABLE: SQLite has no DELETE...USING; the library type-excludes it for sqlite connections.
    /*
    test('delete-using-multiple-source-tables', async () => {
        // ... see other cells for the full body.
    })
    */

    // NOT-APPLICABLE: SQLite has no DELETE...USING; the library type-excludes it for sqlite connections.
    /*
    test('delete-using-cte-source', async () => {
        // ... see other cells for the full body.
    })
    */

    // NOT-APPLICABLE: SQLite has no DELETE...USING; the library type-excludes it for sqlite connections.
    /*
    test('delete-using-with-returning-none-or-one-row', async () => {
        // ... see other cells for the full body.
    })
    */
})
