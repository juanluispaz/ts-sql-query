// Coverage of `executeProcedure` / `executeFunction`, exposed through the
// domain wrappers on DBConnection (callRefreshStats, callArchiveProject,
// callCountOpenIssues, callProjectName, callProjectNameOrNull). Each dialect
// emits its own procedure/function call form (pinned by the snapshot). The
// procedures/functions are defined in the domain schema, so these run
// against the real engine.

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
    */

    // See the postgres / mariadb / mysql / oracle / sqlserver cells for
    // the active bodies.
    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-procedure-with-args', async () => {})
    */

    // See the postgres / mariadb / mysql / oracle / sqlserver cells for
    // the active bodies.
    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-int', async () => {})
    */

    // See the postgres / mariadb / mysql / oracle / sqlserver cells for
    // the active bodies.
    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-string', async () => {})
    */

    // See the postgres / mariadb / mysql / oracle / sqlserver cells for
    // the active bodies.
    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-optional-accepts-null-result', async () => {})
    */

    // See the postgres / mariadb / mysql / oracle / sqlserver cells for
    // the active bodies.
    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-required-throws-mandatory-when-driver-returns-null', async () => {})
    */

    // See the postgres / mariadb / mysql / oracle / sqlserver cells for
    // the active bodies.
    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-throws-no-result-when-driver-returns-undefined', async () => {})
    */
})
