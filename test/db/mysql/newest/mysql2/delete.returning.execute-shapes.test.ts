// Extra coverage for the RETURNING execute-shapes on `DELETE`. MySQL
// has no RETURNING clause on DELETE — the library does not expose
// `.returning(...)` / `.returningOneColumn(...)` on the MySQL delete
// surface. Every test in this file is commented out for symmetry; the
// canonical bodies live in the other cells.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: MySQL has no RETURNING on DELETE.
    /*
    test('delete-returning-none-or-one-row-shape', async () => {
        // ... see other cells for the full body.
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING on DELETE.
    /*
    test('delete-returning-one-column-with-execute-one-non-empty', async () => {
        // ... see other cells for the full body.
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING on DELETE.
    /*
    test('delete-returning-row-shape-throws-no-result-on-empty', async () => {
        // ... see other cells for the full body.
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING on DELETE.
    /*
    test('delete-returning-one-column-many-result', async () => {
        // ... see other cells for the full body.
    })
    */

    // NOT-APPLICABLE: MySQL has no RETURNING on DELETE.
    /*
    test('delete-cte-in-where-in-subquery-with-returning', async () => {
        // ... see other cells for the full body.
    })
    */
})
