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

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-procedure-with-no-args', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-procedure-with-args', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-int', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-string', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-optional-accepts-null-result', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-required-throws-mandatory-when-driver-returns-null', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-throws-no-result-when-driver-returns-undefined', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-bigint', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-local-date-time', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-custom-double', async () => {})
    */


    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-int', async () => {
        // count_open_issues with the 'optional' flag -> `number | null`.
        // Project 1 has 1 open issue.
        ctx.mockNext(1)
        const count = await ctx.conn.callCountOpenIssuesOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof count, number | null>>()
        expect(count).toBe(1)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-bigint', async () => {
        // total_view_count with the 'optional' flag -> `bigint | null`.
        // Project 1's view_count sums to 0n.
        ctx.mockNext(0n)
        const total = await ctx.conn.callTotalViewCountOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof total, bigint | null>>()
        expect(total).toBe(0n)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-required-local-date-time', async () => {
        // latest_issue_at with the 'required' flag -> `Date`. MAX(created_at) of
        // project 1's issues is a real seed-time timestamp (non-deterministic);
        // asserted structurally in both modes.
        ctx.mockNext(new Date('2024-01-01T00:00:00Z'))
        const at = await ctx.conn.callLatestIssueAtRequired(1)
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof at, Date>>()
        expect(at).toBeInstanceOf(Date)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-custom-double', async () => {
        // estimated_total with the 'optional' flag -> `Money | null` (branded).
        // estimated_total(1) is COALESCE(SUM(...),0) = 0.
        ctx.mockNext(0 as Money)
        const total = await ctx.conn.callEstimatedTotalOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof total, Money | null>>()
        expect(total).toBe(0 as Money)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-with-trailing-type-adapter-brackets-result', async () => {})
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-custom-double-with-trailing-adapter-shift-branch', async () => {})
    */

})
