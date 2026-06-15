// Coverage of the scalar (two-argument) min/max forms:
//   - .minValue(other) — clamp this so its value is AT LEAST other (the
//     greater value is returned).
//   - .maxValue(other) — clamp this so its value is AT MOST other (the
//     lesser value is returned).
//
// These are distinct from the column aggregates `conn.min(col)` /
// `conn.max(col)`.
//
// The exact SQL function this dialect renders is pinned by the snapshot
// below.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('min-value-clamps-priority-up', async () => {
        // priority values in the seed are [2, 1, 3, 2]. minValue(2) means
        // "the result must be at least 2", so the row with priority=1 is
        // lifted to 2.
        const expected = [
            { id: 1, clamped: 2 },
            { id: 2, clamped: 2 },
            { id: 3, clamped: 3 },
            { id: 4, clamped: 2 },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({
                id:      tIssue.id,
                clamped: tIssue.priority.minValue(2),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, greatest(priority, ?) as clamped from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('max-value-clamps-priority-down', async () => {
        // maxValue(2) means "the result must be at most 2", so the row
        // with priority=3 is capped to 2.
        const expected = [
            { id: 1, clamped: 2 },
            { id: 2, clamped: 1 },
            { id: 3, clamped: 2 },
            { id: 4, clamped: 2 },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({
                id:      tIssue.id,
                clamped: tIssue.priority.maxValue(2),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, least(priority, ?) as clamped from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(rows).toEqual(expected)
    })

    test('min-value-with-column-rhs', async () => {
        // RHS as a column reference (not a literal) — exercises the
        // value-source path of the operator, no parameter binding.
        const expected = [
            { id: 1, n: 2 },
            { id: 2, n: 2 },
            { id: 3, n: 3 },
            { id: 4, n: 2 },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({
                id: tIssue.id,
                n:  tIssue.priority.minValue(tIssue.number),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, greatest(priority, number) as \`n\` from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('max-value-then-add-keeps-precedence', async () => {
        // .maxValue(...).add(1) — confirms the operator nests as the
        // inner expression inside a wider arithmetic context.
        const expected = [
            { id: 1, score: 3 },
            { id: 2, score: 2 },
            { id: 3, score: 3 },
            { id: 4, score: 3 },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({
                id:    tIssue.id,
                score: tIssue.priority.maxValue(2).add(1),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, least(priority, ?) + ? as score from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
        expect(rows).toEqual(expected)
    })
})
