// Recursive CTE variants beyond the ones the docs page exercises:
//
//   - `.recursiveUnion(...)` (the dedup variant) on dialects that
//     accept `UNION` in the recursive arm; where the dialect rejects it
//     `recursiveUnion` is typed as `never`.
//   - `.recursiveUnionOn(...)` (the shortcut paired with
//     `.recursiveUnion`) - same dialect narrowing.
//   - `.recursiveUnionAll(...)` with an extra column on the inner
//     arm (alias preservation through the JOIN).
//
// Hits the `_buildRecursiveSelect` branch
// that switches between `union` and `union all`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('recursive-union-on-dedup-variant', async () => {
        // `.recursiveUnionOn(...)` emits the `UNION` (deduplicating)
        // operator between the anchor and recursive members. The
        // shortcut accepts a join-on predicate; the recursive arm is
        // synthesised against the anchor table.
        const expected = [
            { id: 1, title: 'Root', parentId: undefined },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:       tIssue.id,
                title:    tIssue.title,
                parentId: tIssue.parentId,
            })
            .recursiveUnionOn((parent) =>
                tIssue.id.equals(parent.parentId),
            )
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive recursive_select_1 as (select id as id, title as title, parent_id as parentId from issue where id = $1 union select issue.id as id, issue.title as title, issue.parent_id as parentId from issue join recursive_select_1 on issue.id = recursive_select_1.parentId) select id as id, title as title, parentId as "parentId" from recursive_select_1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:        number
            title:     string
            parentId?: number
        }>>>()
    })

    test('recursive-union-fn-variant-with-explicit-join', async () => {
        // `.recursiveUnion(fn)` (full-form) lets the caller write the
        // recursive arm as `connection.selectFrom(tIssue).join(view).on(...).select({...})`
        // instead of the shortcut. Same UNION operator as the
        // shortcut, just with the join made explicit.
        const expected = [{ id: 2, title: 'Redesign navbar', parentId: undefined }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                id:       tIssue.id,
                title:    tIssue.title,
                parentId: tIssue.parentId,
            })
            .recursiveUnion((child) => {
                return connection.selectFrom(tIssue)
                    .join(child).on(child.parentId.equals(tIssue.id))
                    .select({
                        id:       tIssue.id,
                        title:    tIssue.title,
                        parentId: tIssue.parentId,
                    })
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive recursive_select_1 as (select id as id, title as title, parent_id as parentId from issue where id = $1 union select issue.id as id, issue.title as title, issue.parent_id as parentId from issue join recursive_select_1 on recursive_select_1.parentId = issue.id) select id as id, title as title, parentId as "parentId" from recursive_select_1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:        number
            title:     string
            parentId?: number
        }>>>()
    })

    test('recursive-union-all-fn-with-extra-derived-column', async () => {
        // The recursive arm projects an extra computed column
        // (`depth`) derived from the view it joins. The recursive
        // CTE definition has to keep the column shape in sync
        // between the anchor and the recursive arm - the snapshot
        // pins the alias preservation.
        const expected = [
            { id: 1, title: 'Update hero copy', depth: 0 },
            { id: 2, title: 'Redesign navbar',  depth: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
                depth: connection.const(0, 'int'),
            })
            .recursiveUnionAll((parent) => {
                return connection.selectFrom(tIssue)
                    .join(parent).on(tIssue.parentId.equals(parent.id))
                    .select({
                        id:    tIssue.id,
                        title: tIssue.title,
                        depth: parent.depth.add(1),
                    })
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive recursive_select_1 as (select id as id, title as title, $1::int4 as depth from issue where id = $2 union all select issue.id as id, issue.title as title, recursive_select_1.depth + $3 as depth from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as id, title as title, depth as depth from recursive_select_1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:    number
            title: string
            depth: number
        }>>>()
    })
})
