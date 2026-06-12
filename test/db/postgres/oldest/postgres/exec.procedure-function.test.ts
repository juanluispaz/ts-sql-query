// Coverage of `executeProcedure` / `executeFunction`, exposed through the
// domain wrappers on DBConnection (callRefreshStats, callArchiveProject,
// callCountOpenIssues, callProjectName, callProjectNameOrNull). PostgreSQL
// emits `call name(...)` for procedures and `select name(...)` for
// functions. The procedures/functions are defined in the domain schema, so
// these run against the real engine.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('execute-procedure-with-no-args', async () => {
        // Procedure call with no arguments (refresh_stats is a no-op).
        await ctx.conn.callRefreshStats()
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"call archive_project($1, $2)"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count_open_issues($1)"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_name($1)"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_name($1)"`)
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
})
