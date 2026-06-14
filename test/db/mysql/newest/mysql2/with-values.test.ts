// `Values` (`WITH name(...) AS (VALUES ...)`) is typed only on the
// postgreSql / sqlite / sqlServer / oracle / noopDB dialects. The
// library blocks it at compile time on mysql. Block-commented stubs
// keep the symmetry audit's per-cell test-name count aligned; see the
// active implementation in any sqlite or postgres cell.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // TODO[LIMITATION]: see LIMITATIONS.md — MySQL supports table value constructors (8.0.19+) but only via `VALUES ROW(...)`; the bare `VALUES (...)` the library emits is rejected, and Values is type-excluded on MySqlConnection. A library gap, not a dialect boundary.
    /*
    test('values in select-from', async () => {
        // Not supported by MySQL.
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — MySQL supports table value constructors (8.0.19+) but only via `VALUES ROW(...)`; the bare `VALUES (...)` the library emits is rejected, and Values is type-excluded on MySqlConnection. A library gap, not a dialect boundary.
    /*
    test('values in update-from', async () => {
        // Not supported by MySQL.
    })
    */
})
