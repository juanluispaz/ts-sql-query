// Coverage of value-source operators with a column (or other value
// source) on the right-hand side, complementing the column-vs-literal
// cases that the existing `select.{numeric,string,where.operators}*`
// tests cover. Every operator in
// [src/internal/ValueSourceImpl.ts](../../../../../src/internal/ValueSourceImpl.ts)
// has both overloads; the parameter-binding path is exercised by the
// existing tests, this file covers the no-parameter-binding (pure
// column-on-column) path.
//
// Why this matters: the SqlBuilder routes literals through
// `_appendValue` (which calls `_appendParam`) and value sources
// through `_appendSql`. The two paths emit different SQL shapes —
// `col + ?` vs `col + col` — and on dialects with column-type
// inference (postgres especially) the latter is the one that
// occasionally surfaces type-mismatch bugs.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tAppUser } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('add-column-to-column', async () => {
        // priority + id with no bound params.
        const expected = [{ id: 1, sum: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:  tIssue.id,
                sum: tIssue.priority.add(tIssue.id),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority + id as sum from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sum: number }>>>()
        expect(result).toEqual(expected)
    })

    test('multiply-column-by-column', async () => {
        // priority * id — same shape as add, different operator.
        const expected = [{ id: 2, p: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                id: tIssue.id,
                p:  tIssue.priority.multiply(tIssue.id),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority * id as \`p\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; p: number }>>>()
        expect(result).toEqual(expected)
    })

    test('equals-column-to-column', async () => {
        // Self-equality predicate `priority = id` — emitted with no
        // bound parameters.
        ctx.mockNext([{ id: 2 }])
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.equals(tIssue.id))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority = id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('greater-than-column', async () => {
        // priority > id — proves the `_greaterThan` operator binds the
        // RHS through `_appendSql`, not `_appendParam`.
        ctx.mockNext([{ id: 3 }])
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThan(tIssue.id))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority > id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('concat-column-to-column', async () => {
        // String concat with both sides as columns — `||` on sqlite/PG,
        // `concat(...)` on MySQL/MariaDB/MSSQL.
        const expected = [{ id: 1, slug: 'ada@acme.testAda Lovelace' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                id:   tAppUser.id,
                slug: tAppUser.email.concat(tAppUser.fullName),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, concat(email, full_name) as slug from app_user where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; slug: string }>>>()
        expect(result).toEqual(expected)
    })

    test('between-with-column-bounds', async () => {
        // `priority BETWEEN id AND id+1` — two value-source bounds.
        // The `_between` operator must `_appendSql` both bounds.
        ctx.mockNext([{ id: 2 }, { id: 3 }])
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.between(tIssue.id, tIssue.id.add(1)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority between id and (id + ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('valueWhenNull-with-column-default', async () => {
        // `body.valueWhenNull(title)` — both sides come from the same
        // table; the coalesce emits `ifnull(body, title)` (sqlite) or
        // the dialect's coalesce equivalent.
        const expected = [
            { id: 1, b: 'Update hero copy' },   // body null → title
            { id: 2, b: 'Use new tokens' },     // body present
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2]))
            .select({
                id: tIssue.id,
                b:  tIssue.body.valueWhenNull(tIssue.title),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(\`body\`, title) as \`b\` from issue where id in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; b: string }>>>()
        expect(result).toEqual(expected)
    })

    test('modulo-column-by-column', async () => {
        // priority % id — covers the `_modulo` operator's column-rhs
        // path. Each dialect picks `%` or `mod(...)`.
        const expected = [{ id: 2, m: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                id: tIssue.id,
                m:  tIssue.priority.modulo(tIssue.id),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority % id as \`m\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; m: number }>>>()
        expect(result).toEqual(expected)
    })
})
