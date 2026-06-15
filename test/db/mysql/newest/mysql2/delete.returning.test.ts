// Coverage of `DELETE ... RETURNING` / `OUTPUT deleted.*` paths.
// Lights up `_buildDeleteReturning` (PostgreSQL/MariaDB/SQLite),
// `_buildDeleteOutput` (SqlServer) and Oracle's `RETURNING ... INTO`
// override. MySQL has no equivalent, so its cell keeps the test
// commented out for symmetry.
//
// Each mutation runs inside `ctx.withRollback(...)`. Snapshots can be
// refreshed with `bun run tests <cell> --use-vitest -u`.

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
    */

    // NOT-APPLICABLE: MySQL has no RETURNING on DELETE.
    /*
    test('delete-returning-many', async () => {})
    */
})
