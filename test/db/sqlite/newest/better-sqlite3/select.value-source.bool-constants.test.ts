// Coverage of `connection.true()` / `connection.false()` — the
// `_true` / `_false` operators in
// [src/sqlBuilders/AbstractSqlBuilder.ts:L2576-L2589](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L2576).
// Each one comes in two flavours:
//
//   - the "value" form (`_true` / `_false`) emits the dialect's literal
//     boolean shape (`true` / `false` on postgres, `1` / `0` on sqlite,
//     `convert(bit, 1)` / `convert(bit, 0)` on sqlserver, …) when the
//     constant is projected as a column value.
//   - the "for condition" form (`_trueForCondition` / `_falseForCondition`)
//     emits the predicate-context shape used inside `WHERE` / `ON` /
//     `HAVING`, which on some dialects (sqlserver, sqlite) differs from
//     the value-context literal.
//
// No other test in the suite calls `connection.true()` or
// `connection.false()`, so all four emitters are dead code at runtime
// outside this file.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('connection.true-in-projection', async () => {
        // Projecting the constant exercises `_true` (the value form).
        // Mock primes the raw boolean — `transformValueFromDB` coerces
        // it against the dialect's actual return shape.
        ctx.mockNext(true)
        const conn = ctx.conn
        const row = await conn.selectFromNoTable()
            .selectOneColumn(conn.true())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select 1 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(row).toBe(true)
    })

    test('connection.false-in-projection', async () => {
        // Mirror — exercises `_false` (the value form).
        ctx.mockNext(false)
        const conn = ctx.conn
        const row = await conn.selectFromNoTable()
            .selectOneColumn(conn.false())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select 0 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(row).toBe(false)
    })

    test('connection.true-in-where', async () => {
        // Constant used in WHERE exercises `_trueForCondition` — the
        // predicate-context shape. On sqlite/sqlserver this differs
        // from the projection form (`_trueValue`).
        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const conn = ctx.conn
        const rows = await conn.selectFrom(tOrganization)
            .where(conn.true())
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where 1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows.map(r => r.id)).toEqual([1, 2])
    })

    test('connection.false-in-where', async () => {
        // Mirror — exercises `_falseForCondition`. The result is
        // always an empty set; the SQL is what we pin.
        ctx.mockNext([])
        const conn = ctx.conn
        const rows = await conn.selectFrom(tOrganization)
            .where(conn.false())
            .select({ id: tOrganization.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where 0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual([])
    })
})
