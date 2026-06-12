// Coverage of `executeProcedure` / `executeFunction` — the two
// protected entry points on every `AbstractConnection` subclass that
// land on `_buildCallProcedure` / `_buildCallFunction` in the
// dialect's SqlBuilder.
//
// On SQLite the entire wave is a no-op: the engine has no concept of
// SQL-side stored procedures, and user-defined functions are
// registered through the driver C API rather than declared with
// `CREATE FUNCTION`. The library exposes `executeProcedure` /
// `executeFunction` on `SqliteConnection` for symmetry (a wrapper app
// can still call into a driver-registered function via
// `select my_fn(?)`), but exercising the full round-trip needs DDL
// the seed schema cannot ship. The five tests are kept commented for
// symmetry with the other dialect cells; see e.g.
// `postgres/newest/pg/exec.procedure-function.test.ts` for the
// active bodies.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // See the postgres / mariadb / mysql / oracle / sqlserver cells for
    // the active bodies.
    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-procedure-with-no-args', async () => {})
    test('execute-procedure-with-args', async () => {})
    test('execute-function-returning-int', async () => {})
    test('execute-function-returning-string', async () => {})
    test('execute-function-optional-accepts-null-result', async () => {})
    test('execute-function-required-throws-mandatory-when-driver-returns-null', async () => {})
    test('execute-function-throws-no-result-when-driver-returns-undefined', async () => {})
    */
})
