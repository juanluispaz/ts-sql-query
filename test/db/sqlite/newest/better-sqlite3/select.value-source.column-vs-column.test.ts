// Coverage of value-source operators with a column (or other value
// source) on the right-hand side, complementing the column-vs-literal
// cases that the existing `select.{numeric,string,where.operators}*`
// tests cover. Every operator
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority * id as "p" from issue where id = ?"`)
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
        // String concat with both sides as columns; the emitted form is
        // pinned by the snapshot below.
        const expected = [{ id: 1, slug: 'ada@acme.testAda Lovelace' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tAppUser)
            .where(tAppUser.id.equals(1))
            .select({
                id:   tAppUser.id,
                slug: tAppUser.email.concat(tAppUser.fullName),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, email || full_name as slug from app_user where id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(body, title) as "b" from issue where id in (?, ?) order by id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority % id as "m" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; m: number }>>>()
        expect(result).toEqual(expected)
    })
    test('merge-optional-from-value-source-argument-projected', async () => {
        // the optional flag of a binary op can arrive from the VALUE-SOURCE
        // argument, not only the receiver. `assignee_id` is an optionalColumn;
        // mixing it (either side) with the required `priority` yields an
        // optional projected leaf — distinct from receiver-optional and
        // opt×opt cases covered elsewhere. SQL is param-free.
        const expected = [{ x: 3, y: false, z: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                x: tIssue.priority.add(tIssue.assigneeId),     // required + optional → optional
                y: tIssue.priority.equals(tIssue.assigneeId),  // required = optional → optional
                z: tIssue.assigneeId.add(tIssue.priority),     // optional + required → optional
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select priority + assignee_id as "x", priority = assignee_id as "y", assignee_id + priority as "z" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ x?: number | undefined; y?: boolean | undefined; z?: number | undefined }>>>()
        expect(result).toEqual(expected)
    })

    test('numeric-operators-column-rhs', async () => {
        // the value-source (column) RHS overload of the numeric operators
        // the existing tests only exercised with literals. add/multiply/modulo/
        // Row id=2 has priority=1, id=2, number=2, so the results are clean.
        // `divide` upcasts to double (1/2 → 0.5); `atan2` is irrational.
        ctx.mockNext([{ sub: -1, div: 0.5, pw: 1, ln: 0, rnd: 1, at2: Math.atan2(1, 2), mx: 1 }])
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                sub: tIssue.priority.subtract(tIssue.id),
                div: tIssue.priority.divide(tIssue.id),
                pw:  tIssue.priority.power(tIssue.id),
                ln:  tIssue.priority.logn(tIssue.id),
                rnd: tIssue.priority.roundn(tIssue.id),
                at2: tIssue.priority.atan2(tIssue.id),
                mx:  tIssue.priority.maxValue(tIssue.number),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select priority - id as sub, cast(priority as real) / cast(id as real) as div, power(priority, id) as pw, log(id, priority) as ln, round(priority, id) as rnd, atan2(priority, id) as at2, min(priority, number) as mx from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            sub: number; div: number; pw: number; ln: number; rnd: number; at2: number; mx: number
        }>>>()
        const row = result[0]!
        expect(row.sub).toBe(-1)
        expect(row.div).toBe(0.5)
        expect(row.pw).toBe(1)
        expect(row.ln).toBe(0)
        expect(row.rnd).toBe(1)
        expect(row.at2).toBe(Math.atan2(1, 2))
        expect(row.mx).toBe(1)
    })

    test('nullIfValue-with-column-argument', async () => {
        // the IValueSource (column) overload of `nullIfValue` → nullif(col,
        // col2); the result stays optional. Sibling `valueWhenNull` already has
        // a column-arg test. Row id=2: body 'Use new tokens' ≠ title 'Redesign
        // navbar', so nullif returns the body.
        const expected = [{ id: 2, b: 'Use new tokens' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                id: tIssue.id,
                b:  tIssue.body.nullIfValue(tIssue.title),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, nullif(body, title) as "b" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; b?: string }>>>()
        expect(result).toEqual(expected)
    })

    test('in-single-value-source', async () => {
        // the single-value-source `in` overload (not an array, not a
        // subquery) → `priority in (id)`. Only row id=3 has priority = id (3).
        const expected = [{ id: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.in(tIssue.id))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority in (id) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('inN-mixing-literal-and-value-source', async () => {
        // the `inN` value-source-element overload, mixing a literal and a
        // column → `priority in (?, id)`. Rows where priority ∈ {1, id}:
        // id=2 (priority 1) and id=3 (priority 3 = id).
        const expected = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.inN(1, tIssue.id))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority in (?, id) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('notEquals-and-greaterOrEqual-column-vs-column', async () => {
        // Column-on-column (ValueSource RHS) `notEquals` / `greaterOrEqual`,
        // both param-free (`… <> …` / `… >= …`). Of the four issues only id=3
        // has priority = id (3), so it alone is both ≥ id and not ≠ id.
        const expected = [{ id: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.notEquals(tIssue.id).negate()
                .and(tIssue.priority.greaterOrEqual(tIssue.id)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where not (priority <> id) and priority >= id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('greaterOrEqual-column-vs-column-optional-propagation', async () => {
        // optionality of the binary op propagates from the VALUE-SOURCE
        // argument: `assignee_id` is an optionalColumn, so the required
        // `priority` compared against it yields an optional projected leaf.
        // SQL is param-free `priority >= assignee_id`. Issue id=1 has
        // priority=2 and assignee_id=1, so the comparison is true.
        const expected = [{ x: true }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                x: tIssue.priority.greaterOrEqual(tIssue.assigneeId),  // required >= optional → optional
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select priority >= assignee_id as "x" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ x?: boolean | undefined }>>>()
        expect(result).toEqual(expected)
    })
})
