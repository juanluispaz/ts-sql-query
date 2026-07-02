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
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // Kept commented for symmetry; the recursive-children variant uses
    // `.recursiveUnionAllOn` from the docs page.
    // NOT-APPLICABLE: SQL Server rejects `UNION` (only `UNION ALL`) in the
    // recursive arm of a `WITH` ("Incorrect syntax near UNION"), so
    // `.recursiveUnionOn` is typed as `never`.
    /*
    test('recursive-union-on-dedup-variant', async () => {
        // ... see canonical body in sqlite/newest/bun_sqlite for the full block.
    })
    */

    // NOT-APPLICABLE: SQL Server rejects `UNION` in the recursive arm (same
    // reason as above), so `.recursiveUnion` is typed as `never`. Kept
    // commented for symmetry; use `.recursiveUnionAll`.
    /*
    test('recursive-union-fn-variant-with-explicit-join', async () => {
        // ... see canonical body in sqlite/newest/bun_sqlite for the full block.
    })
    */

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1 as (select id as id, title as title, @0 as [depth] from issue where id = @1 union all select issue.id as id, issue.title as title, recursive_select_1.[depth] + @2 as [depth] from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as id, title as title, [depth] as [depth] from recursive_select_1"`)
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

    test('recursive-union-all-customize-query-after-wraps-whole-recursive-query', async () => {
        // `customizeQuery(...)` chained AFTER `.recursiveUnionAll(...)`
        // customizes the whole recursive statement, not the anchor
        // member: `beforeQuery`/`afterQuery` bracket the entire
        // `with recursive ...` query, and `beforeWithQuery`/`afterWithQuery`
        // wrap the generated recursive CTE body - the same placement a
        // plain `.forUseInQueryAs(...)` CTE gets.
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
            .customizeQuery({
                beforeQuery:     connection.rawFragment`/* head */ `,
                afterQuery:      connection.rawFragment` /* tail */`,
                beforeWithQuery: connection.rawFragment`/* warmup */`,
                afterWithQuery:  connection.rawFragment`/* end-of-with */`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  with recursive_select_1 as /* warmup */ (select id as id, title as title, @0 as [depth] from issue where id = @1 union all select issue.id as id, issue.title as title, recursive_select_1.[depth] + @2 as [depth] from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) /* end-of-with */ select id as id, title as title, [depth] as [depth] from recursive_select_1  /* tail */"`)
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

    test('recursive-union-all-customize-query-before-wraps-cte', async () => {
        // `customizeQuery(...)` chained BEFORE `.recursiveUnionAll(...)`
        // still targets the generated recursive query rather than the
        // anchor member: `beforeWithQuery`/`afterWithQuery` wrap the
        // recursive CTE body instead of being silently dropped.
        const expected = [
            { id: 1, title: 'Update hero copy', depth: 0 },
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
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* warmup */`,
                afterWithQuery:  connection.rawFragment`/* end-of-with */`,
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1 as /* warmup */ (select id as id, title as title, @0 as [depth] from issue where id = @1 union all select issue.id as id, issue.title as title, recursive_select_1.[depth] + @2 as [depth] from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) /* end-of-with */ select id as id, title as title, [depth] as [depth] from recursive_select_1"`)
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

    test('recursive-union-all-customize-query-outer-select-hooks', async () => {
        // The customizeQuery hooks that DON'T bracket the whole statement or
        // the CTE body (beforeQuery/afterQuery/beforeWithQuery/afterWithQuery,
        // covered by the two tests above) instead route to the OUTER
        // `select ... from recursive_select_1`: afterSelectKeyword,
        // beforeColumns, customWindow, beforeOrderByItems and afterOrderByItems
        // land on the outer query, around its own column list and ORDER BY.
        // Three distinct columns across the three ORDER BY slots
        // (title / depth / id) so no dialect trips its "column specified more
        // than once in the order by list" check. Every seeded issue has a NULL
        // parent_id, so the traversal from issue 1 returns exactly that one row.
        const expected = [{ id: 1, title: 'Update hero copy', depth: 0 }]
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
            .customizeQuery({
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                customWindow:       connection.rawFragment`w1 as (partition by depth)`,
                beforeOrderByItems: connection.rawFragment`title asc`,
                afterOrderByItems:  connection.rawFragment`id asc`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1 as (select id as id, title as title, @0 as [depth] from issue where id = @1 union all select issue.id as id, issue.title as title, recursive_select_1.[depth] + @2 as [depth] from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select /* hint */ /* cols */  id as id, title as title, [depth] as [depth] from recursive_select_1 window w1 as (partition by depth) order by title asc, id asc"`)
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
        expect(result).toEqual(expected)
    })

    test('recursive-one-column-inline-scalar-value', async () => {
        // A one-column recursive select used as an inline scalar subquery
        // via `forUseAsInlineQueryValue()`. The generated recursive CTE is
        // hoisted to the top-level `with recursive` and referenced by the
        // scalar subquery in the outer select list. Every seeded issue
        // leaves `parent_id` NULL, so the traversal from a single anchor
        // returns exactly that one row and the scalar subquery yields a
        // single value.
        const expected = [{ id: 1, root: 1 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const rootIssueId = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.id)
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.result))
            .forUseAsInlineQueryValue()

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, root: rootIssueId })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1 as (select id as [result] from issue where id = @0 union all select issue.id as [result] from issue join recursive_select_1 on issue.parent_id = recursive_select_1.[result]) select id as id, (select [result] as [result] from recursive_select_1) as root from project where id = @1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:    number
            root?: number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-one-column-inline-aggregated-array-value', async () => {
        // Sibling of the scalar case: the one-column recursive select used
        // as an inline aggregated-array value via
        // `forUseAsInlineAggregatedArrayValue()`. The single column is
        // aggregated as a scalar array (one element per row), NOT wrapped
        // in a per-element object -- matching the non-recursive one-column
        // aggregated-array shape. The traversal from a single anchor over
        // the NULL-`parent_id` seed yields a one-element array.
        const expected = [{ id: 1, tree: [1] }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.id)
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.result))
            .forUseAsInlineAggregatedArrayValue()

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, tree })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1 as (select id as [result] from issue where id = @0 union all select issue.id as [result] from issue join recursive_select_1 on issue.parent_id = recursive_select_1.[result]) select id as id, (select json_arrayagg([result] null on null) from recursive_select_1) as tree from project where id = @1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:   number
            tree: number[]
        }>>>()
        expect(result).toEqual(expected)
    })
})
