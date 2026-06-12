// MySQL does not support `DELETE ... RETURNING`; the library
// type-excludes it for MySQL connections. The active body lives in the
// SQLite / PostgreSQL / MariaDB / SqlServer / Oracle cells. Kept here
// for symmetry with the other dialects.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: MySQL has no RETURNING on DELETE.
    /*
    test('delete-returning-one-row', async () => {
        // See sqlite/postgres/mariadb/sqlserver/oracle cells for the active body.
    })
    test('delete-returning-many', async () => {})
    */
})
