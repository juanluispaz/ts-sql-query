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
})
