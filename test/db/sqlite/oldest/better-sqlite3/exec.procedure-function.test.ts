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

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-boolean', async () => {
        // ret_flag(1) returns a boolean → true.
        ctx.mockNext(true)
        const flag = await ctx.conn.callRetBoolean(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_flag($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof flag, boolean>>()
        expect(flag).toBe(true)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-boolean', async () => {
        // ret_flag with the 'optional' flag → `boolean | null`.
        ctx.mockNext(true)
        const flag = await ctx.conn.callRetBooleanOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_flag($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof flag, boolean | null>>()
        expect(flag).toBe(true)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-double', async () => {
        // estimated_total(1) read as the plain 'double' kind → 0.
        ctx.mockNext(0)
        const value = await ctx.conn.callRetDouble(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select estimated_total($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, number>>()
        expect(value).toBe(0)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-double', async () => {
        // estimated_total read as 'double' with the 'optional' flag → `number | null`.
        ctx.mockNext(0)
        const value = await ctx.conn.callRetDoubleOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select estimated_total($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, number | null>>()
        expect(value).toBe(0)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-uuid', async () => {
        // ret_uuid(1) returns a uuid string. The postgres uuid columns are
        // VARCHAR(36) (string strategy), so the value passes through unchanged.
        ctx.mockNext('0a8f9c1e-1111-4222-8333-444455556666')
        const value = await ctx.conn.callRetUuid(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_uuid($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, string>>()
        expect(value).toBe('0a8f9c1e-1111-4222-8333-444455556666')
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-uuid', async () => {
        // ret_uuid with the 'optional' flag → `string | null`.
        ctx.mockNext('0a8f9c1e-1111-4222-8333-444455556666')
        const value = await ctx.conn.callRetUuidOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_uuid($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, string | null>>()
        expect(value).toBe('0a8f9c1e-1111-4222-8333-444455556666')
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-local-date', async () => {
        // ret_day(1) returns a date. The marshalled Date is driver-dependent
        // (a bare function result isn't wrapped with the date extraction the
        // column read path applies), so the value is asserted structurally.
        ctx.mockNext(new Date(Date.UTC(2024, 1, 3)))
        const value = await ctx.conn.callRetLocalDate(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_day($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date>>()
        expect(value).toBeInstanceOf(Date)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-local-date', async () => {
        // ret_day with the 'optional' flag → `Date | null`.
        ctx.mockNext(new Date(Date.UTC(2024, 1, 3)))
        const value = await ctx.conn.callRetLocalDateOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_day($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date | null>>()
        expect(value).toBeInstanceOf(Date)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-local-time', async () => {
        // ret_clock(1) returns a time; the marshalled Date is driver-dependent,
        // so the value is asserted structurally (the type pins the marshaller).
        ctx.mockNext(new Date(Date.UTC(1970, 0, 1, 14, 25, 36)))
        const value = await ctx.conn.callRetLocalTime(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_clock($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date>>()
        expect(value).toBeInstanceOf(Date)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-local-time', async () => {
        // ret_clock with the 'optional' flag → `Date | null`.
        ctx.mockNext(new Date(Date.UTC(1970, 0, 1, 14, 25, 36)))
        const value = await ctx.conn.callRetLocalTimeOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_clock($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date | null>>()
        expect(value).toBeInstanceOf(Date)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-enum', async () => {
        // ret_activity(1) returns an enum value (WorklogActivity) → 'coding'.
        ctx.mockNext('coding')
        const value = await ctx.conn.callRetEnum(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_activity($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, WorklogActivity>>()
        expect(value).toBe('coding')
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-enum', async () => {
        // ret_activity with the 'optional' flag → `WorklogActivity | null`.
        ctx.mockNext('coding')
        const value = await ctx.conn.callRetEnumOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_activity($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, WorklogActivity | null>>()
        expect(value).toBe('coding')
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-custom', async () => {
        // ret_channel(1) returns an equality-only custom value (ReleaseChannel)
        // → 'stable'.
        ctx.mockNext('stable')
        const value = await ctx.conn.callRetCustom(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_channel($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, ReleaseChannel>>()
        expect(value).toBe('stable')
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-custom', async () => {
        // ret_channel with the 'optional' flag → `ReleaseChannel | null`.
        ctx.mockNext('stable')
        const value = await ctx.conn.callRetCustomOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_channel($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, ReleaseChannel | null>>()
        expect(value).toBe('stable')
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-custom-comparable', async () => {
        // ret_semver(1) returns an ordered custom value (Semver, a branded
        // string) → '1.0.0'.
        ctx.mockNext('1.0.0')
        const value = await ctx.conn.callRetCustomComparable(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_semver($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, string>>()
        expect(value).toBe('1.0.0')
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-custom-comparable', async () => {
        // ret_semver with the 'optional' flag → `string | null`.
        ctx.mockNext('1.0.0')
        const value = await ctx.conn.callRetCustomComparableOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_semver($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, string | null>>()
        expect(value).toBe('1.0.0')
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-custom-int', async () => {
        // count_open_issues(1) read as the branded customInt kind (Cents) → 1.
        ctx.mockNext(1)
        const value = await ctx.conn.callRetCustomInt(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count_open_issues($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, number>>()
        expect(value).toBe(1)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-custom-int', async () => {
        // count_open_issues read as customInt with the 'optional' flag → `number | null`.
        ctx.mockNext(1)
        const value = await ctx.conn.callRetCustomIntOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count_open_issues($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, number | null>>()
        expect(value).toBe(1)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-custom-uuid', async () => {
        // ret_uuid(1) read as the branded customUuid kind (SigningKey) → the
        // uuid string.
        ctx.mockNext('0a8f9c1e-1111-4222-8333-444455556666')
        const value = await ctx.conn.callRetCustomUuid(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_uuid($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, string>>()
        expect(value).toBe('0a8f9c1e-1111-4222-8333-444455556666')
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-custom-uuid', async () => {
        // ret_uuid read as customUuid with the 'optional' flag → `string | null`.
        ctx.mockNext('0a8f9c1e-1111-4222-8333-444455556666')
        const value = await ctx.conn.callRetCustomUuidOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_uuid($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, string | null>>()
        expect(value).toBe('0a8f9c1e-1111-4222-8333-444455556666')
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-custom-local-date', async () => {
        // ret_day(1) read as the branded customLocalDate kind (ReleaseDay); the
        // marshalled Date is driver-dependent, so it is asserted structurally.
        ctx.mockNext(new Date(Date.UTC(2024, 1, 3)))
        const value = await ctx.conn.callRetCustomLocalDate(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_day($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date>>()
        expect(value).toBeInstanceOf(Date)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-custom-local-date', async () => {
        // ret_day read as customLocalDate with the 'optional' flag → `Date | null`.
        ctx.mockNext(new Date(Date.UTC(2024, 1, 3)))
        const value = await ctx.conn.callRetCustomLocalDateOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_day($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date | null>>()
        expect(value).toBeInstanceOf(Date)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-custom-local-time', async () => {
        // ret_clock(1) read as the branded customLocalTime kind (CutoffClock);
        // the marshalled Date is driver-dependent, so it is asserted structurally.
        ctx.mockNext(new Date(Date.UTC(1970, 0, 1, 14, 25, 36)))
        const value = await ctx.conn.callRetCustomLocalTime(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_clock($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date>>()
        expect(value).toBeInstanceOf(Date)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-custom-local-time', async () => {
        // ret_clock read as customLocalTime with the 'optional' flag → `Date | null`.
        ctx.mockNext(new Date(Date.UTC(1970, 0, 1, 14, 25, 36)))
        const value = await ctx.conn.callRetCustomLocalTimeOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_clock($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date | null>>()
        expect(value).toBeInstanceOf(Date)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-custom-local-date-time', async () => {
        // latest_issue_at(1) read as the branded customLocalDateTime kind
        // (SignOffStamp). MAX(created_at) is a real seed-time timestamp
        // (non-deterministic); asserted structurally in both modes.
        ctx.mockNext(new Date('2024-01-01T00:00:00Z'))
        const value = await ctx.conn.callRetCustomLocalDateTime(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select latest_issue_at($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date>>()
        expect(value).toBeInstanceOf(Date)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — SQLite has no DDL for stored procedures or user-defined SQL functions; the seed schema cannot ship the bodies these tests would invoke against a real engine.
    /*
    test('execute-function-returning-optional-custom-local-date-time', async () => {
        // latest_issue_at read as customLocalDateTime with the 'optional' flag →
        // `Date | null`. MAX(created_at) is a real present timestamp.
        ctx.mockNext(new Date('2024-01-01T00:00:00Z'))
        const value = await ctx.conn.callRetCustomLocalDateTimeOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select latest_issue_at($1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date | null>>()
        expect(value).toBeInstanceOf(Date)
    })
    */

})
