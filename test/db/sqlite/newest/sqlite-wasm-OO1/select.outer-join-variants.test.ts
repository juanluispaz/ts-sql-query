// Outer-join variants on
// [SelectQueryBuilder.ts](../../../../../src/queryBuilders/SelectQueryBuilder.ts)
// that the existing `select.join.test.ts` does not exercise:
//
//   - `.leftOuterJoin(...)`       — emits `LEFT OUTER JOIN` (the
//     SQL-standard spelling) instead of the abbreviated `LEFT JOIN`
//     that `.leftJoin(...)` produces. [L786](../../../../../src/queryBuilders/SelectQueryBuilder.ts#L786).
//   - `.optionalLeftJoin(...)`    — only renders the join when at
//     least one column from the joined source is referenced in the
//     final SELECT / WHERE / ORDER BY. [L829](../../../../../src/queryBuilders/SelectQueryBuilder.ts#L829).
//   - `.optionalLeftOuterJoin(...)` — same dependency-elimination
//     logic with `LEFT OUTER JOIN` keyword. [L844](../../../../../src/queryBuilders/SelectQueryBuilder.ts#L844).
//
// `.optionalInnerJoin(...)` is already covered by
// `docs.extreme-dynamic-queries.test.ts`.
//
// The "elided" snapshots (where the optional join produces no FROM
// fragment at all) are the main signal — they pin the eliminator
// path through `_buildSelectFromAndJoins` and confirm the join
// drops cleanly when nothing references it.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('left-outer-join-emits-left-outer-join-keyword', async () => {
        // `.leftOuterJoin(...)` should emit the verbose
        // `LEFT OUTER JOIN` spelling. Issue id=3 has assigneeId NULL
        // and stays in the result with the joined columns elided.
        const expected = [
            { id: 1, assigneeName: 'Ada Lovelace' },
            { id: 2, assigneeName: 'Grace Hopper' },
            { id: 3 },
            { id: 4, assigneeName: 'Alan Turing' },
        ]
        ctx.mockNext([
            { id: 1, assigneeName: 'Ada Lovelace' },
            { id: 2, assigneeName: 'Grace Hopper' },
            { id: 3, assigneeName: null },
            { id: 4, assigneeName: 'Alan Turing' },
        ])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .leftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:           tIssue.id,
                assigneeName: assignee.fullName,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, app_user.full_name as assigneeName from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:            number
            assigneeName?: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-join-is-elided-when-unused', async () => {
        // No projection / where / orderBy references `assignee`, so
        // the eliminator drops the `LEFT JOIN` entirely. The emitted
        // SQL should be a plain `SELECT id FROM issue ORDER BY id`.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id: tIssue.id,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-join-is-emitted-when-referenced', async () => {
        // The same builder, but `assignee.fullName` is referenced in
        // the projection — the eliminator now keeps the join.
        const expected = [
            { id: 1, assigneeName: 'Ada Lovelace' },
            { id: 2, assigneeName: 'Grace Hopper' },
            { id: 3 },
            { id: 4, assigneeName: 'Alan Turing' },
        ]
        ctx.mockNext([
            { id: 1, assigneeName: 'Ada Lovelace' },
            { id: 2, assigneeName: 'Grace Hopper' },
            { id: 3, assigneeName: null },
            { id: 4, assigneeName: 'Alan Turing' },
        ])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:           tIssue.id,
                assigneeName: assignee.fullName,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, app_user.full_name as assigneeName from issue left join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:            number
            assigneeName?: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('optional-left-outer-join-emits-verbose-keyword-when-referenced', async () => {
        // `.optionalLeftOuterJoin(...)` keeps the verbose
        // `LEFT OUTER JOIN` spelling when the eliminator decides to
        // include it.
        const expected = [
            { id: 1, assigneeName: 'Ada Lovelace' },
            { id: 2, assigneeName: 'Grace Hopper' },
            { id: 3 },
            { id: 4, assigneeName: 'Alan Turing' },
        ]
        ctx.mockNext([
            { id: 1, assigneeName: 'Ada Lovelace' },
            { id: 2, assigneeName: 'Grace Hopper' },
            { id: 3, assigneeName: null },
            { id: 4, assigneeName: 'Alan Turing' },
        ])
        const assignee = tAppUser.forUseInLeftJoin()
        const result = await ctx.conn.selectFrom(tIssue)
            .optionalLeftOuterJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:           tIssue.id,
                assigneeName: assignee.fullName,
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, app_user.full_name as assigneeName from issue left outer join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:            number
            assigneeName?: string
        }>>>()
        expect(result).toEqual(expected)
    })
})
