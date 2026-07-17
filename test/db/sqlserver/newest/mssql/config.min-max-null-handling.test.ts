// Per-connection coverage of SqlServerConnection's minValue/maxValue NULL-handling
// options — SQL-Server-only.
//
// SQL Server's native `least` / `greatest` (2022+) and the `iif` emulation IGNORE a NULL
// operand and return the present value, which contradicts the optional type the library
// declares (a NULL operand should propagate to a NULL result). By default the builder wraps
// them in a poison `CASE` (see select.value-source.greatest-least.test.ts). This file pins
// the two escape hatches:
//   - `ignoreNullInMinAndMaxValue = true` — keep the bare native form (ignores NULL).
//   - `minValueFunction` / `maxValueFunction` — a user null-propagating function, emitted
//     as `func(a, b)` (no operand repetition). `dbo.greatest_strict` / `dbo.least_strict`
//     are created by the schema (domain/schema.sql) — the same helpers the docs tell users
//     to create. Scalar UDFs must be called two-part-named on SQL Server, hence `dbo.`.
//
// A subclass of `DBConnection` sets the options while sharing `ctx.conn`'s
// CaptureInterceptor, so the emitted SQL is captured and runs against the real engine.
// assignee_id is NULL only for issue 3.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { DBConnection, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

class IgnoreNullConnection extends DBConnection {
    protected override ignoreNullInMinAndMaxValue = true
}
class MinMaxFunctionConnection extends DBConnection {
    protected override minValueFunction = 'dbo.greatest_strict'
    protected override maxValueFunction = 'dbo.least_strict'
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('ignoreNullInMinAndMaxValue: keeps bare native least/greatest (ignores NULL)', async () => {
        // With the opt-out, the NULL row (issue 3) returns the present operand 5 instead
        // of NULL — SQL Server's native ignore-NULL behaviour, no poison CASE.
        const conn = new IgnoreNullConnection(ctx.conn.queryRunner)
        const expected = [
            { id: 1, floored: 5, capped: 1 },
            { id: 2, floored: 5, capped: 2 },
            { id: 3, floored: 5, capped: 5 },
            { id: 4, floored: 5, capped: 3 },
        ]
        ctx.mockNext(expected)
        const rows = await conn.selectFrom(tIssue)
            .select({ id: tIssue.id, floored: tIssue.assigneeId.minValue(5), capped: tIssue.assigneeId.maxValue(5) })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, greatest(assignee_id, @0) as floored, least(assignee_id, @1) as capped from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
            5,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; floored?: number; capped?: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('minValueFunction/maxValueFunction: emits func(a, b) and propagates NULL', async () => {
        // With the opt-in, the emitted SQL calls the user function once per operand (no
        // repetition), and a NULL row (issue 3) poisons to NULL — matching the default
        // CASE, without repeating the operand.
        const conn = new MinMaxFunctionConnection(ctx.conn.queryRunner)
        const expected = [
            { id: 1, floored: 5,         capped: 1 },
            { id: 2, floored: 5,         capped: 2 },
            { id: 3, floored: undefined, capped: undefined },
            { id: 4, floored: 5,         capped: 3 },
        ]
        ctx.mockNext(expected)
        const rows = await conn.selectFrom(tIssue)
            .select({ id: tIssue.id, floored: tIssue.assigneeId.minValue(5), capped: tIssue.assigneeId.maxValue(5) })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, dbo.greatest_strict(assignee_id, @0) as floored, dbo.least_strict(assignee_id, @1) as capped from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
            5,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; floored?: number; capped?: number }>>>()
        expect(rows).toEqual(expected)
    })
})
