// Coverage of `executeProcedure` / `executeFunction`, exposed through the
// domain wrappers on DBConnection (callRefreshStats, callArchiveProject,
// callCountOpenIssues, callProjectName, callProjectNameOrNull). Each dialect
// emits its own procedure/function call form (pinned by the snapshot). The
// procedures/functions are defined in the domain schema, so these run
// against the real engine.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { Money, WorklogActivity, ReleaseChannel } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('execute-procedure-with-no-args', async () => {
        // Procedure call with no arguments (refresh_stats is a no-op).
        // executeProcedure resolves to Promise<void> — distinct from
        // executeFunction's Promise<T>. Pin the void return type.
        const refreshResult = await ctx.conn.callRefreshStats()
        assertType<Exact<typeof refreshResult, void>>()
        expect(refreshResult).toBeUndefined()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"begin refresh_stats(); end;"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('execute-procedure-with-args', async () => {
        // Procedure call with two bound parameters: an int and a
        // string. The parameter placeholders follow the dialect's
        // bind-marker convention (`?`, `$n`, `:n`, `@n`).
        //
        // `archive_project(id, reason)` is a real `UPDATE` against
        // `project` (stamps `archived_at` and annotates `name`), so
        // the call is wrapped in `withRollback` to keep the seed
        // intact for the following tests.
        await ctx.withRollback(async () => {
            await ctx.conn.callArchiveProject(1, 'manual')
            expect(ctx.lastSql).toMatchInlineSnapshot(`"begin archive_project(:0, :1); end;"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "manual",
              ]
            `)
        })
    })

    test('execute-function-returning-int', async () => {
        // Function call returning an int. count_open_issues(1) counts the
        // open issues of project 1 → 1 (issue 1; issue 2 is in_progress).
        ctx.mockNext(1)
        const count = await ctx.conn.callCountOpenIssues(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count_open_issues(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(count).toBe(1)
    })

    test('execute-function-returning-string', async () => {
        // Function call returning a string. project_name(1) → 'Marketing site'.
        ctx.mockNext('Marketing site')
        const name = await ctx.conn.callProjectName(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_name(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(name).toBe('Marketing site')
    })

    test('execute-function-optional-accepts-null-result', async () => {
        // The 'optional' overload allows a null result without throwing.
        // project_name(999) finds no project → null.
        ctx.mockNext(null)
        const name = await ctx.conn.callProjectNameOrNull(999)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_name(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            999,
          ]
        `)
        expect(name).toBeNull()
    })

    test('execute-function-required-throws-mandatory-when-driver-returns-null', async () => {
        // A required-typed function call whose driver returns null throws
        // MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE.
        // MOCK-ONLY: a real count_open_issues never returns null, so only the mock can hand back the
        // null that trips the required-value gate.
        ctx.mockOnlyConnection()
        ctx.mockNext(null)
        let thrown: unknown
        try {
            await ctx.conn.callCountOpenIssues(1)
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toMatch(/count_open_issues/)
        expect((thrown as Error).message).toMatch(/null or undefined/)
    })

    test('execute-function-throws-no-result-when-driver-returns-undefined', async () => {
        // A driver returning raw undefined for a function call throws
        // NO_RESULT.
        // MOCK-ONLY: no real driver returns raw undefined for a function call, so only the mock can
        // drive the NO_RESULT gate.
        ctx.mockOnlyConnection()
        ctx.mockNext(undefined)
        let thrown: unknown
        try {
            await ctx.conn.callCountOpenIssues(1)
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toMatch(/No result returned/)
    })

    test('execute-function-returning-bigint', async () => {
        // total_view_count(1) returns a bigint: the sum of project 1's issue
        // view_count (all default 0) → 0n.
        ctx.mockNext(0n)
        const total = await ctx.conn.callTotalViewCount(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select total_view_count(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof total, bigint>>()
        expect(total).toBe(0n)
    })

    test('execute-function-returning-optional-local-date-time', async () => {
        // latest_issue_at(1) returns an optional localDateTime: MAX(created_at)
        // of project 1's issues → Promise<Date | null>. created_at is seeded at
        // insert time, so the exact value is non-deterministic — asserted via
        // the mock, and structurally on the real DB.
        ctx.mockNext(new Date('2024-01-01T00:00:00Z'))
        const at = await ctx.conn.callLatestIssueAt(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select latest_issue_at(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof at, Date | null>>()
        // MAX(created_at) is a real, seed-time timestamp — assert it is a
        // present Date identically in both modes (the exact value is
        // non-deterministic).
        expect(at).toBeInstanceOf(Date)
    })

    test('execute-function-returning-custom-double', async () => {
        // estimated_total(1) returns a branded customDouble (`Money`):
        // COALESCE(SUM(estimated_hours),0) → 0 (the seed leaves estimated_hours
        // null for project 1's issues).
        ctx.mockNext(0)
        const total = await ctx.conn.callEstimatedTotal(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select estimated_total(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof total, Money>>()
        expect(total).toBe(0 as Money)
    })

    test('execute-function-returning-optional-int', async () => {
        // count_open_issues with the 'optional' flag -> `number | null`.
        // Project 1 has 1 open issue.
        ctx.mockNext(1)
        const count = await ctx.conn.callCountOpenIssuesOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count_open_issues(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof count, number | null>>()
        expect(count).toBe(1)
    })

    test('execute-function-returning-optional-bigint', async () => {
        // total_view_count with the 'optional' flag -> `bigint | null`.
        // Project 1's view_count sums to 0n.
        ctx.mockNext(0n)
        const total = await ctx.conn.callTotalViewCountOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select total_view_count(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof total, bigint | null>>()
        expect(total).toBe(0n)
    })

    test('execute-function-returning-required-local-date-time', async () => {
        // latest_issue_at with the 'required' flag -> `Date`. MAX(created_at) of
        // project 1's issues is a real seed-time timestamp (non-deterministic);
        // asserted structurally in both modes.
        ctx.mockNext(new Date('2024-01-01T00:00:00Z'))
        const at = await ctx.conn.callLatestIssueAtRequired(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select latest_issue_at(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof at, Date>>()
        expect(at).toBeInstanceOf(Date)
    })

    test('execute-function-returning-optional-custom-double', async () => {
        // estimated_total with the 'optional' flag -> `Money | null` (branded).
        // estimated_total(1) is COALESCE(SUM(...),0) = 0.
        ctx.mockNext(0 as Money)
        const total = await ctx.conn.callEstimatedTotalOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select estimated_total(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof total, Money | null>>()
        expect(total).toBe(0 as Money)
    })

    test('execute-function-with-trailing-type-adapter-brackets-result', async () => {
        // executeFunction's trailing TypeAdapter OBJECT arg (the plain-type
        // overload's optional `adapter`) routes the read through that adapter
        // instead of the default one. bracketAdapter wraps the string result in
        // [...], so project_name(1) ('Marketing site') comes back bracketed.
        ctx.mockNext('Marketing site')
        const name = await ctx.conn.callProjectNameBracketed(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_name(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof name, string>>()
        expect(name).toBe('[Marketing site]')
    })

    test('execute-function-custom-double-with-trailing-adapter-shift-branch', async () => {
        // The custom-kind executeFunction overload threads a trailing TypeAdapter
        // through the read: plusOffsetAdapter shifts the numeric Money result by
        // +1000. The mock is primed with the RAW value 0, so estimated_total(1)
        // (= 0) comes back as 1000.
        ctx.mockNext(0)
        const total = await ctx.conn.callEstimatedTotalOffset(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select estimated_total(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof total, Money>>()
        expect(total).toBe(1000 as Money)
    })

    test('execute-function-returning-boolean', async () => {
        // ret_flag(1) returns a boolean → true.
        ctx.mockNext(true)
        const flag = await ctx.conn.callRetBoolean(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_flag(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof flag, boolean>>()
        expect(flag).toBe(true)
    })

    test('execute-function-returning-optional-boolean', async () => {
        // ret_flag with the 'optional' flag → `boolean | null`.
        ctx.mockNext(true)
        const flag = await ctx.conn.callRetBooleanOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_flag(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof flag, boolean | null>>()
        expect(flag).toBe(true)
    })

    test('execute-function-returning-double', async () => {
        // estimated_total(1) read as the plain 'double' kind → 0.
        ctx.mockNext(0)
        const value = await ctx.conn.callRetDouble(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select estimated_total(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, number>>()
        expect(value).toBe(0)
    })

    test('execute-function-returning-optional-double', async () => {
        // estimated_total read as 'double' with the 'optional' flag → `number | null`.
        ctx.mockNext(0)
        const value = await ctx.conn.callRetDoubleOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select estimated_total(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, number | null>>()
        expect(value).toBe(0)
    })

    test('execute-function-returning-uuid', async () => {
        // ret_uuid(1) returns a uuid string. The postgres uuid columns are
        // VARCHAR(36) (string strategy), so the value passes through unchanged.
        ctx.mockNext('0a8f9c1e-1111-4222-8333-444455556666')
        const value = await ctx.conn.callRetUuid(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_uuid(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, string>>()
        expect(value).toBe('0a8f9c1e-1111-4222-8333-444455556666')
    })

    test('execute-function-returning-optional-uuid', async () => {
        // ret_uuid with the 'optional' flag → `string | null`.
        ctx.mockNext('0a8f9c1e-1111-4222-8333-444455556666')
        const value = await ctx.conn.callRetUuidOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_uuid(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, string | null>>()
        expect(value).toBe('0a8f9c1e-1111-4222-8333-444455556666')
    })

    test('execute-function-returning-local-date', async () => {
        // ret_day(1) returns a date. The marshalled Date is driver-dependent
        // (a bare function result isn't wrapped with the date extraction the
        // column read path applies), so the value is asserted structurally.
        ctx.mockNext(new Date(Date.UTC(2024, 1, 3)))
        const value = await ctx.conn.callRetLocalDate(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_day(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date>>()
        expect(value).toBeInstanceOf(Date)
    })

    test('execute-function-returning-optional-local-date', async () => {
        // ret_day with the 'optional' flag → `Date | null`.
        ctx.mockNext(new Date(Date.UTC(2024, 1, 3)))
        const value = await ctx.conn.callRetLocalDateOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_day(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date | null>>()
        expect(value).toBeInstanceOf(Date)
    })

    test('execute-function-returning-local-time', async () => {
        // ret_clock(1) returns a time; the marshalled Date is driver-dependent,
        // so the value is asserted structurally (the type pins the marshaller).
        ctx.mockNext(new Date(Date.UTC(1970, 0, 1, 14, 25, 36)))
        const value = await ctx.conn.callRetLocalTime(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_clock(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date>>()
        expect(value).toBeInstanceOf(Date)
    })

    test('execute-function-returning-optional-local-time', async () => {
        // ret_clock with the 'optional' flag → `Date | null`.
        ctx.mockNext(new Date(Date.UTC(1970, 0, 1, 14, 25, 36)))
        const value = await ctx.conn.callRetLocalTimeOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_clock(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date | null>>()
        expect(value).toBeInstanceOf(Date)
    })

    test('execute-function-returning-enum', async () => {
        // ret_activity(1) returns an enum value (WorklogActivity) → 'coding'.
        ctx.mockNext('coding')
        const value = await ctx.conn.callRetEnum(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_activity(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, WorklogActivity>>()
        expect(value).toBe('coding')
    })

    test('execute-function-returning-optional-enum', async () => {
        // ret_activity with the 'optional' flag → `WorklogActivity | null`.
        ctx.mockNext('coding')
        const value = await ctx.conn.callRetEnumOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_activity(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, WorklogActivity | null>>()
        expect(value).toBe('coding')
    })

    test('execute-function-returning-custom', async () => {
        // ret_channel(1) returns an equality-only custom value (ReleaseChannel)
        // → 'stable'.
        ctx.mockNext('stable')
        const value = await ctx.conn.callRetCustom(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_channel(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, ReleaseChannel>>()
        expect(value).toBe('stable')
    })

    test('execute-function-returning-optional-custom', async () => {
        // ret_channel with the 'optional' flag → `ReleaseChannel | null`.
        ctx.mockNext('stable')
        const value = await ctx.conn.callRetCustomOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_channel(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, ReleaseChannel | null>>()
        expect(value).toBe('stable')
    })

    test('execute-function-returning-custom-comparable', async () => {
        // ret_semver(1) returns an ordered custom value (Semver, a branded
        // string) → '1.0.0'.
        ctx.mockNext('1.0.0')
        const value = await ctx.conn.callRetCustomComparable(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_semver(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, string>>()
        expect(value).toBe('1.0.0')
    })

    test('execute-function-returning-optional-custom-comparable', async () => {
        // ret_semver with the 'optional' flag → `string | null`.
        ctx.mockNext('1.0.0')
        const value = await ctx.conn.callRetCustomComparableOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_semver(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, string | null>>()
        expect(value).toBe('1.0.0')
    })

    test('execute-function-returning-custom-int', async () => {
        // count_open_issues(1) read as the branded customInt kind (Cents) → 1.
        ctx.mockNext(1)
        const value = await ctx.conn.callRetCustomInt(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count_open_issues(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, number>>()
        expect(value).toBe(1)
    })

    test('execute-function-returning-optional-custom-int', async () => {
        // count_open_issues read as customInt with the 'optional' flag → `number | null`.
        ctx.mockNext(1)
        const value = await ctx.conn.callRetCustomIntOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count_open_issues(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, number | null>>()
        expect(value).toBe(1)
    })

    test('execute-function-returning-custom-uuid', async () => {
        // ret_uuid(1) read as the branded customUuid kind (SigningKey) → the
        // uuid string.
        ctx.mockNext('0a8f9c1e-1111-4222-8333-444455556666')
        const value = await ctx.conn.callRetCustomUuid(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_uuid(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, string>>()
        expect(value).toBe('0a8f9c1e-1111-4222-8333-444455556666')
    })

    test('execute-function-returning-optional-custom-uuid', async () => {
        // ret_uuid read as customUuid with the 'optional' flag → `string | null`.
        ctx.mockNext('0a8f9c1e-1111-4222-8333-444455556666')
        const value = await ctx.conn.callRetCustomUuidOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_uuid(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, string | null>>()
        expect(value).toBe('0a8f9c1e-1111-4222-8333-444455556666')
    })

    test('execute-function-returning-custom-local-date', async () => {
        // ret_day(1) read as the branded customLocalDate kind (ReleaseDay); the
        // marshalled Date is driver-dependent, so it is asserted structurally.
        ctx.mockNext(new Date(Date.UTC(2024, 1, 3)))
        const value = await ctx.conn.callRetCustomLocalDate(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_day(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date>>()
        expect(value).toBeInstanceOf(Date)
    })

    test('execute-function-returning-optional-custom-local-date', async () => {
        // ret_day read as customLocalDate with the 'optional' flag → `Date | null`.
        ctx.mockNext(new Date(Date.UTC(2024, 1, 3)))
        const value = await ctx.conn.callRetCustomLocalDateOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_day(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date | null>>()
        expect(value).toBeInstanceOf(Date)
    })

    test('execute-function-returning-custom-local-time', async () => {
        // ret_clock(1) read as the branded customLocalTime kind (CutoffClock);
        // the marshalled Date is driver-dependent, so it is asserted structurally.
        ctx.mockNext(new Date(Date.UTC(1970, 0, 1, 14, 25, 36)))
        const value = await ctx.conn.callRetCustomLocalTime(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_clock(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date>>()
        expect(value).toBeInstanceOf(Date)
    })

    test('execute-function-returning-optional-custom-local-time', async () => {
        // ret_clock read as customLocalTime with the 'optional' flag → `Date | null`.
        ctx.mockNext(new Date(Date.UTC(1970, 0, 1, 14, 25, 36)))
        const value = await ctx.conn.callRetCustomLocalTimeOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ret_clock(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date | null>>()
        expect(value).toBeInstanceOf(Date)
    })

    test('execute-function-returning-custom-local-date-time', async () => {
        // latest_issue_at(1) read as the branded customLocalDateTime kind
        // (SignOffStamp). MAX(created_at) is a real seed-time timestamp
        // (non-deterministic); asserted structurally in both modes.
        ctx.mockNext(new Date('2024-01-01T00:00:00Z'))
        const value = await ctx.conn.callRetCustomLocalDateTime(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select latest_issue_at(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date>>()
        expect(value).toBeInstanceOf(Date)
    })

    test('execute-function-returning-optional-custom-local-date-time', async () => {
        // latest_issue_at read as customLocalDateTime with the 'optional' flag →
        // `Date | null`. MAX(created_at) is a real present timestamp.
        ctx.mockNext(new Date('2024-01-01T00:00:00Z'))
        const value = await ctx.conn.callRetCustomLocalDateTimeOptional(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select latest_issue_at(:0) from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof value, Date | null>>()
        expect(value).toBeInstanceOf(Date)
    })

})
