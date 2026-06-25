// Coverage of `executeProcedure` / `executeFunction`, exposed through the
// domain wrappers on DBConnection (callRefreshStats, callArchiveProject,
// callCountOpenIssues, callProjectName, callProjectNameOrNull). Each dialect
// emits its own procedure/function call form (pinned by the snapshot). The
// procedures/functions are defined in the domain schema, so these run
// against the real engine.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { Money } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('execute-procedure-with-no-args', async () => {
        // Procedure call with no arguments (refresh_stats is a no-op).
        // G3: executeProcedure resolves to Promise<void> — distinct from
        // executeFunction's Promise<T>. Pin the void return type.
        const refreshResult = await ctx.conn.callRefreshStats()
        assertType<Exact<typeof refreshResult, void>>()
        expect(refreshResult).toBeUndefined()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"call refresh_stats()"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"call archive_project(?, ?)"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count_open_issues(?)"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_name(?)"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_name(?)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            999,
          ]
        `)
        expect(name).toBeNull()
    })

    test('execute-function-required-throws-mandatory-when-driver-returns-null', async () => {
        // A required-typed function call whose driver returns null throws
        // MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE. A real
        // count_open_issues never returns null, so this misbehaviour is
        // simulated via the mock (mock-only by design).
        if (ctx.realDbEnabled) return
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
        // NO_RESULT. No real driver returns undefined here, so it's
        // simulated via the mock (mock-only by design).
        if (ctx.realDbEnabled) return
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
        // G1: executeFunction return-type fan-out — the `bigint` arm.
        // total_view_count(1) sums project 1's issue view_count (all default
        // 0) → 0n.
        ctx.mockNext(0n)
        const total = await ctx.conn.callTotalViewCount(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select total_view_count(?)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof total, bigint>>()
        expect(total).toBe(0n)
    })

    test('execute-function-returning-optional-local-date-time', async () => {
        // G1: the `localDateTime` arm crossed with `optional` → Promise<Date |
        // null>. latest_issue_at(1) = MAX(created_at) of project 1's issues (a
        // real timestamp). created_at is seeded at insert time, so the exact
        // value is non-deterministic — asserted via the mock, and structurally
        // on the real DB.
        ctx.mockNext(new Date('2024-01-01T00:00:00Z'))
        const at = await ctx.conn.callLatestIssueAt(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select latest_issue_at(?)"`)
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
        // G1: the `customDouble` arm carrying a branded type name (`Money`) →
        // Promise<Money>. estimated_total(1) = COALESCE(SUM(estimated_hours),0)
        // → 0 (the seed leaves estimated_hours null for project 1's issues).
        ctx.mockNext(0)
        const total = await ctx.conn.callEstimatedTotal(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select estimated_total(?)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof total, Money>>()
        expect(total).toBe(0 as Money)
    })
})
