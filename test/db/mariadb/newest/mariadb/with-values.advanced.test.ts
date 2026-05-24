// `Values` (`WITH name(...) AS (VALUES ...)`) is typed only on the
// postgreSql / sqlite / sqlServer / oracle / noopDB dialects. The
// library blocks it at compile time on mariadb / mysql. Block-commented
// stubs keep the symmetry audit's per-cell test-name count aligned;
// see the active implementation in any sqlite or postgres cell.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    /*
    test('values-aliased-via-as-keeps-original-with-name', async () => {
        // Not supported on this dialect: `Values` is not typed.
    })
    */

    /*
    test('values-for-use-in-left-join-as-emits-left-join', async () => {
        // Not supported on this dialect: `Values` is not typed.
    })
    */

    /*
    test('values-optional-column-allows-undefined-per-row', async () => {
        // Not supported on this dialect: `Values` is not typed.
    })
    */

    /*
    test('values-create-with-empty-list-throws-cannot-be-empty', () => {
        // Not supported on this dialect: `Values` is not typed.
    })
    */
})
