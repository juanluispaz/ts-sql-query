// SQL Server does NOT support `INSERT … ON CONFLICT` syntax (its
// equivalent is the MERGE statement). The library excludes SQL Server
// from the on-conflict family at compile time. Kept here as commented
// stubs so the symmetry audit reports the same test names per cell;
// see the postgres/sqlite cells for the active implementation.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    /*
    test('on-conflict-do-nothing', async () => {
        // Not supported by SQL Server.
    })
    */

    /*
    test('on-conflict-do-update', async () => {
        // Not supported by SQL Server.
    })
    */

    /*
    test('on-conflict-on-columns-do-update', async () => {
        // Not supported by SQL Server.
    })
    */
    /*
    test('on-conflict-do-update-with-expression', async () => {
        // Not supported by this dialect: see active variant in sqlite / mariadb / mysql cells.
    })
    */

    /*
    test('on-conflict-do-update-with-inserted-row-ref', async () => {
        // Not supported by this dialect: see active variant in sqlite / mariadb / mysql cells.
    })
    */
})
