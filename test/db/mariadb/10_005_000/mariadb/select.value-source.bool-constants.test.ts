// Coverage of `connection.true()` / `connection.false()`. Each has a
// value form (projected as a column) and a condition form (used inside
// WHERE); the exact boolean literal each dialect emits is pinned by the
// SQL snapshots.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('connection.true-in-projection', async () => {
        // The boolean constant projected as a column value.
        ctx.mockNext(true)
        const conn = ctx.conn
        const row = await conn.selectFromNoTable()
            .selectOneColumn(conn.true())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select true as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(row).toBe(true)
    })

    test('connection.false-in-projection', async () => {
        ctx.mockNext(false)
        const conn = ctx.conn
        const row = await conn.selectFromNoTable()
            .selectOneColumn(conn.false())
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select false as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(row).toBe(false)
    })

    test('connection.true-in-where', async () => {
        // The constant used in WHERE (predicate context).
        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const conn = ctx.conn
        const rows = await conn.selectFrom(tOrganization)
            .where(conn.true())
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where true order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual([{ id: 1 }, { id: 2 }])
    })

    test('connection.false-in-where', async () => {
        // `where false` returns an empty set.
        ctx.mockNext([])
        const conn = ctx.conn
        const rows = await conn.selectFrom(tOrganization)
            .where(conn.false())
            .select({ id: tOrganization.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where false"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual([])
    })
    test('negate-of-boolean-constants-in-projection', async () => {
        // `.negate()` on a boolean CONSTANT hits the constant-swap branch of
        // `_negate`: instead of wrapping the constant in `not(...)`, the builder
        // emits the opposite constant directly. `true().negate()` -> the false
        // literal, `false().negate()` -> the true literal (the exact per-dialect
        // spelling is pinned by the snapshot).
        ctx.mockNext({ notTrue: false, notFalse: true })
        const conn = ctx.conn
        const row = await conn.selectFromNoTable()
            .select({
                notTrue:  conn.true().negate(),
                notFalse: conn.false().negate(),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select false as notTrue, true as notFalse"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(row).toEqual({ notTrue: false, notFalse: true })
    })

    test('negate-of-boolean-constants-in-where', async () => {
        // The same constant-swap in a WHERE (predicate) context.
        // `where true().negate()` -> `where false` -> empty set;
        // `where false().negate()` -> `where true` -> every row.
        const conn = ctx.conn
        ctx.mockNext([])
        const none = await conn.selectFrom(tOrganization)
            .where(conn.true().negate())
            .select({ id: tOrganization.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where false"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(none).toEqual([])

        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const all = await conn.selectFrom(tOrganization)
            .where(conn.false().negate())
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where true order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(all).toEqual([{ id: 1 }, { id: 2 }])
    })


    test('and-with-true-constant-reduces-away-the-neutral-operand', async () => {
        // `conn.true()` is the neutral element of AND, so it is dropped from the
        // combined predicate: an operand that renders as the dialect’s true literal
        // (`true` on PostgreSQL, `(1=1)` on Oracle/SqlServer) is reduced away. Both
        // the right-operand form (`x.and(true())`) and the left-operand form
        // (`true().and(x)`) reduce to just `x`, so no `and true` survives in the
        // emitted WHERE. Both queries filter to organization 1.
        const conn = ctx.conn
        // Right operand: `id = 1` AND true → `id = 1`.
        ctx.mockNext([{ id: 1 }])
        const right = await conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1).and(conn.true()))
            .select({ id: tOrganization.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(right).toEqual([{ id: 1 }])

        // Left operand: true AND `id = 1` → `id = 1`.
        ctx.mockNext([{ id: 1 }])
        const left = await conn.selectFrom(tOrganization)
            .where(conn.true().and(tOrganization.id.equals(1)))
            .select({ id: tOrganization.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(left).toEqual([{ id: 1 }])
    })

    test('or-with-false-constant-reduces-away-the-neutral-operand', async () => {
        // `conn.false()` is the neutral element of OR, so it is dropped from the
        // combined predicate: an operand that renders as the dialect’s false literal
        // (`false` on PostgreSQL, `(0=1)` on Oracle/SqlServer) is reduced away. Both
        // the right-operand form (`x.or(false())`) and the left-operand form
        // (`false().or(x)`) reduce to just `x`, so no `or false` survives in the
        // emitted WHERE. Both queries filter to organization 1.
        const conn = ctx.conn
        // Right operand: `id = 1` OR false → `id = 1`.
        ctx.mockNext([{ id: 1 }])
        const right = await conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1).or(conn.false()))
            .select({ id: tOrganization.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(right).toEqual([{ id: 1 }])

        // Left operand: false OR `id = 1` → `id = 1`.
        ctx.mockNext([{ id: 1 }])
        const left = await conn.selectFrom(tOrganization)
            .where(conn.false().or(tOrganization.id.equals(1)))
            .select({ id: tOrganization.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        expect(left).toEqual([{ id: 1 }])
    })
})
