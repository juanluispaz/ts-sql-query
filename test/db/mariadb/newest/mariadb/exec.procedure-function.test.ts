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
// documented user-facing pattern. The procedures / functions don't
// exist in the seed schema, so the runtime is wrapped in `try/catch`
// for real-DB cells while the snapshot assertion stays authoritative.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('execute-procedure-with-no-args', async () => {
        // Procedure call with no arguments. Each dialect emits its
        // own paren / `exec` / `begin … end` wrapper.
        try {
            await ctx.conn.callRefreshStats()
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
        }
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
        // Function call returning an int. The default path emits
        // `select <name>(...)`; Oracle wraps with `from dual`.
        ctx.mockNext(1)
        let count: number | null = null
        try {
            count = await ctx.conn.callCountOpenIssues(1)
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count_open_issues(?)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        if (!ctx.realDbEnabled) expect(count).toBe(1)
    })

    test('execute-function-returning-string', async () => {
        // Function call returning a string.
        ctx.mockNext('Marketing site')
        let name: string | null = null
        try {
            name = await ctx.conn.callProjectName(1)
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_name(?)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        if (!ctx.realDbEnabled) expect(name).toBe('Marketing site')
    })

    test('execute-function-optional-accepts-null-result', async () => {
        // The `'optional'` overload allows a `null` driver result
        // without throwing `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE`
        // (which the `'required'` flavour would have raised). The
        // `undefined` branch is reserved for "the driver returned no
        // row at all" and always raises `NO_RESULT` regardless.
        ctx.mockNext(null)
        let name: string | null = 'sentinel'
        try {
            name = await ctx.conn.callProjectNameOrNull(999)
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
        }
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_name(?)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            999,
          ]
        `)
        if (!ctx.realDbEnabled) expect(name).toBeNull()
    })
})
