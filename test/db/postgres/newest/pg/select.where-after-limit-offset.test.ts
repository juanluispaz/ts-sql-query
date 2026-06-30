// `where(...)` / `dynamicWhere()` reached AFTER `limit()` / `offset()` on the
// select-before-where chain. These are distinct overloads
// (`OffsetExecutableSelectExpressionWithoutWhere.where` after `.limit(...)`,
// `CompoundableCustomizableExpressionWithoutWhere.where` after `.offset(...)`,
// plus the `dynamicWhere()` siblings) that let the WHERE clause be appended
// last; the builder still emits it in the standard SQL position (before
// ORDER BY / LIMIT). They were compile-reachable but had zero positive tests.
//
// Seed: project 1 owns issues id 1 (priority 2) and id 2 (priority 1).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('where-after-limit', async () => {
        // `.limit(2).where(...)` — WHERE appended after LIMIT on the
        // select-before-where chain. Emits `where … order by … limit`; the
        // predicate keeps only project 1's issues (id 1, 2).
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .limit(2)
            .where(tIssue.projectId.equals(1))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where project_id = $1 order by id limit $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('where-after-offset', async () => {
        // `.limit(5).offset(1).where(...)` — WHERE appended after OFFSET.
        // Project 1's issues ordered by id are (1, 2); offset 1 drops id 1.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .limit(5).offset(1)
            .where(tIssue.projectId.equals(1))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where project_id = $1 order by id limit $2 offset $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            5,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('dynamic-where-after-limit', async () => {
        // `.limit(2).dynamicWhere().and(...)` — the dynamicWhere sibling
        // reached after LIMIT. The single `and(...)` arm filters to project 1.
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .limit(2)
            .dynamicWhere()
                .and(tIssue.projectId.equals(1))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where project_id = $1 order by id limit $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('dynamic-where-after-offset', async () => {
        // `.limit(5).offset(1).dynamicWhere().and(...)` — the dynamicWhere
        // sibling reached after OFFSET. Project 1's issues (1, 2), offset 1 → id 2.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy('id')
            .limit(5).offset(1)
            .dynamicWhere()
                .and(tIssue.projectId.equals(1))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where project_id = $1 order by id limit $2 offset $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            5,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })
})
