// Coverage of `executeProcedure` / `executeFunction` — the two
// protected entry points on every `AbstractConnection` subclass that
// land on `_buildCallProcedure` / `_buildCallFunction` in the
// dialect's SqlBuilder. Each dialect emits a distinct form:
//
//   - sqlite / postgres / mysql / mariadb (default):
//       procedure → `call name(...)`
//       function  → `select name(...)`
//   - sqlserver: procedure → `exec name ...` (positional, no parens)
//   - oracle:    procedure → `begin name(...); end;`
//                function  → `select name(...) from dual`
//
// The protected `executeProcedure` / `executeFunction` are exposed
// here through thin domain wrappers on `DBConnection`
// (`callRefreshStats`, `callArchiveProject`, `callCountOpenIssues`,
// `callProjectName`, `callProjectNameOrNull`) — that's the
// documented user-facing pattern.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('execute-procedure-with-no-args', async () => {
        // Procedure call with no arguments. SQL Server emits the
        // `exec <name>` wrapper.
        await ctx.conn.callRefreshStats()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"exec refresh_stats"`)
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
            expect(ctx.lastSql).toMatchInlineSnapshot(`"exec archive_project @0, @1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "manual",
              ]
            `)
        })
    })

    test('execute-function-returning-int', async () => {
        // Function call returning an int. The default path emits
        // `select <name>(...)`; Oracle wraps with `from dual`. SQL Server
        // scalar UDFs must be called with their two-part name, so the
        // domain wrapper passes `dbo.count_open_issues`.
        ctx.mockNext(1)
        const count = await ctx.conn.callCountOpenIssues(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dbo.count_open_issues(@0)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(count).toBe(1)
    })

    test('execute-function-returning-string', async () => {
        // Function call returning a string (two-part name, as above).
        ctx.mockNext('Marketing site')
        const name = await ctx.conn.callProjectName(1)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dbo.project_name(@0)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(name).toBe('Marketing site')
    })

    test('execute-function-optional-accepts-null-result', async () => {
        // The `'optional'` overload allows a `null` driver result
        // without throwing `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE`
        // (which the `'required'` flavour would have raised). The
        // `undefined` branch is reserved for "the driver returned no
        // row at all" and always raises `NO_RESULT` regardless.
        ctx.mockNext(null)
        const name = await ctx.conn.callProjectNameOrNull(999)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dbo.project_name(@0)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            999,
          ]
        `)
        expect(name).toBeNull()
    })
    test('execute-function-required-throws-mandatory-when-driver-returns-null', async () => {
        // Required-typed function call where the driver hands back
        // `null` — the lib throws `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE`
        // (`AbstractConnection.ts:685-687`). The 'optional' overload
        // above accepts null silently; this is the gating branch for
        // the 'required' flavour.
        //
        // §18 mock-only: justified — `count_open_issues` is declared
        // to return a non-null integer, so a real-DB call never returns
        // null. The branch only fires when a driver / function pair
        // misbehaves, which we simulate via the mock.
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
        // The `NO_RESULT` branch fires when the underlying driver hands
        // back raw `undefined` for a function call
        // (`AbstractConnection.ts:682-684`). A well-behaved driver
        // returns either a row's value or `null`, never `undefined`;
        // the guard exists for misbehaving drivers.
        //
        // §18 mock-only: justified — no real driver returns raw
        // `undefined` here. Asserting against a real-DB cell would
        // require breaking the driver intentionally.
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
