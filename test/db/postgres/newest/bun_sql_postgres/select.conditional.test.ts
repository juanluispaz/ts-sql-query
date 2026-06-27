// Coverage of conditional / nullability helpers on value sources:
//   - `valueWhenNull(default)` — coalesce
//   - `asOptional()` / `asRequiredInOptionalObject()`
//   - `ignoreWhenAsNull(when)` — conditionally swap value with null
//   - the `*IfValue` family

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('valueWhenNull-coalesces', async () => {
        const expected = [
            { id: 1, body: '<empty>' },
            { id: 2, body: 'Use new tokens' },
            { id: 3, body: '<empty>' },
            { id: 4, body: 'See ADR-014' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                id:   tIssue.id,
                body: tIssue.body.valueWhenNull('<empty>'),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, coalesce(body, $1) as body from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "<empty>",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; body: string }>>>()
        expect(result).toEqual(expected)
    })

    test('asOptional-makes-required-column-optional', async () => {
        const expected = [{ id: 1, status: 'open' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:     tIssue.id,
                status: tIssue.status.asOptional(),
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, status as status from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        // asOptional flips required → optional in the result type.
        assertType<Exact<typeof result, Array<{
            id:     number
            status?: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('greaterThanIfValue/with-value', async () => {
        const expected = [{ id: 3 }]  // priority 3 > 2
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThanIfValue(2))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority > $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual([{ id: 3 }])
    })

    test('greaterThanIfValue/null-skips-the-predicate', async () => {
        // No filter applied → all 4 issues come back.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const nullValue: number | null = null
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThanIfValue(nullValue))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }])
    })

    test('dynamicWhere/single-and-equivalent-to-where', async () => {
        // `dynamicWhere()` opens an empty WHERE; the first `.and(...)` becomes
        // the initial predicate. Emits SQL + params identical to a direct
        // `.where(...)`.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .dynamicWhere()
            .and(tIssue.status.equals('open'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where status = $1 order by id"`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(ref)
    })

    test('dynamicWhere/and-and-chain-equivalent', async () => {
        // The `.and(...).and(...)` chain on the DynamicWhere expression: the
        // first `.and` is the empty-WHERE branch (initial predicate) and the
        // second conjoins to it. Equal to the static `.where(...).and(...)`.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .and(tIssue.priority.greaterThan(1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .dynamicWhere()
            .and(tIssue.projectId.equals(1))
            .and(tIssue.priority.greaterThan(1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where project_id = $1 and priority > $2 order by id"`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(ref)
    })

    test('dynamicWhere/or-or-chain-equivalent', async () => {
        // The `.or(...).or(...)` chain on the DynamicWhere expression — the
        // first `.or` is the empty-WHERE branch, the second extends it. Equal
        // to the static `.where(...).or(...)`.
        const expected = [{ id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const ref = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('closed'))
            .or(tIssue.assigneeId.isNull())
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        const refSql = ctx.lastSql
        const refParams = ctx.lastParams

        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .dynamicWhere()
            .or(tIssue.status.equals('closed'))
            .or(tIssue.assigneeId.isNull())
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toBe(refSql)
        expect(ctx.lastParams).toEqual(refParams)
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue where status = $1 or assignee_id is null order by id"`)
        expect(refParams).toMatchInlineSnapshot(`
          [
            "closed",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(ref)
    })

    test('dynamicWhere/no-condition-elides-where', async () => {
        // `dynamicWhere()` with no `.and()/.or()` carries no predicate, so the
        // WHERE clause is elided entirely — the query returns every row, the
        // same SQL a plain `selectFrom(...).select(...)` (no where) emits.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const ref = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        const refSql = ctx.lastSql

        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .dynamicWhere()
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(result).toEqual(ref)
        expect(ctx.lastSql).toBe(refSql)
        expect(refSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })
})
