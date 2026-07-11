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

    // `.recursiveUnionOn` is typed as `never` on Oracle; the recursive-
    // children variant uses `.recursiveUnionAllOn` from the docs page.
    // Body kept verbatim for cross-cell diff parity.
    // NOT-APPLICABLE: Oracle rejects UNION in the recursive arm of WITH RECURSIVE (ORA-32040), so .recursiveUnionOn is typed never
    /*
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive recursive_select_1 as (select id as id, title as title, parent_id as parentId from issue where id = ? union select issue.id as id, issue.title as title, issue.parent_id as parentId from issue join recursive_select_1 on issue.id = recursive_select_1.parentId) select id as id, title as title, parentId as parentId from recursive_select_1"`)
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
    */

    // `.recursiveUnion` is typed as `never` on Oracle - same reason as
    // above; use `.recursiveUnionAll`. Body kept verbatim for cross-cell
    // diff parity.
    // NOT-APPLICABLE: Oracle rejects UNION in the recursive arm of WITH RECURSIVE (ORA-32040), so .recursiveUnion is typed never
    /*
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive recursive_select_1 as (select id as id, title as title, parent_id as parentId from issue where id = ? union select issue.id as id, issue.title as title, issue.parent_id as parentId from issue join recursive_select_1 on recursive_select_1.parentId = issue.id) select id as id, title as title, parentId as parentId from recursive_select_1"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title, depth) as (select id as id, title as title, :0 as depth from issue where id = :1 union all select issue.id as id, issue.title as title, recursive_select_1.depth + :2 as depth from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title", depth as "depth" from recursive_select_1"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  with recursive_select_1(id, title, depth) as /* warmup */ (select id as id, title as title, :0 as depth from issue where id = :1 union all select issue.id as id, issue.title as title, recursive_select_1.depth + :2 as depth from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) /* end-of-with */ select id as "id", title as "title", depth as "depth" from recursive_select_1  /* tail */"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title, depth) as /* warmup */ (select id as id, title as title, :0 as depth from issue where id = :1 union all select issue.id as id, issue.title as title, recursive_select_1.depth + :2 as depth from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) /* end-of-with */ select id as "id", title as "title", depth as "depth" from recursive_select_1"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title, depth) as (select id as id, title as title, :0 as depth from issue where id = :1 union all select issue.id as id, issue.title as title, recursive_select_1.depth + :2 as depth from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select /* hint */ /* cols */  id as "id", title as "title", depth as "depth" from recursive_select_1 window w1 as (partition by depth) order by title asc, id asc"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(result) as (select id as result from issue where id = :0 union all select issue.id as result from issue join recursive_select_1 on issue.parent_id = recursive_select_1.result) select id as "id", (select result as "result" from recursive_select_1) as "root" from project where id = :1"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(result) as (select id as result from issue where id = :0 union all select issue.id as result from issue join recursive_select_1 on issue.parent_id = recursive_select_1.result) select id as "id", (select json_arrayagg(result) from recursive_select_1) as "tree" from project where id = :1"`)
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

    // Terminals on the recursive select result. orderBy / limit / offset apply
    // to the outer `select ... from <cte>`, so they order and page the final
    // recursive result rather than the CTE anchor member.

    test('recursive-result-order-by-limit-offset', async () => {
        // `.orderBy('id').limit(2).offset(1)` on the recursive result. Anchor
        // selects issues 1, 2, 3; the recursion adds nothing; the outer paging
        // should keep issues 2 and 3.
        const expected = [
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .orderBy('id')
            .limit(2)
            .offset(1)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1 order by "id" offset :3 rows fetch next :4 rows only"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-result-execute-select-one', async () => {
        // `.executeSelectOne()` on the recursive result. Anchor selects issue 2;
        // the recursion adds nothing, so exactly one row comes back.
        const expected = { id: 2, title: 'Redesign navbar' }
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id = :0 union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, { id: number, title: string }>>()
        expect(result).toEqual(expected)
    })

    test('recursive-result-execute-select-none-or-one', async () => {
        // `.executeSelectNoneOrOne()` on the recursive result. Anchor selects an
        // impossible id, so no row comes back and the terminal returns null.
        ctx.mockNext(null)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(999))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .executeSelectNoneOrOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id = :0 union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            999,
          ]
        `)
        assertType<Exact<typeof result, { id: number, title: string } | null>>()
        expect(result).toBeNull()
    })

    test('recursive-result-projecting-optionals-as-nullable', async () => {
        // `.projectingOptionalValuesAsNullable()` sits immediately after
        // `.select(...)` and before `.recursiveUnionAllOn(...)` — the position
        // where it is valid on a recursive select: the projection shape is fixed
        // at select time and the recursion carries it through unchanged, so the
        // flag set on the anchor drives the final result shape. It only reshapes
        // the TypeScript type (the emitted SQL is identical to the plain
        // projection): the optional `parentId` becomes a required, nullable
        // property. Issue 1 has a NULL parent_id, so the value comes back as
        // `null` rather than an absent property.
        const expected = [{ id: 1, title: 'Update hero copy', parentId: null }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, title: tIssue.title, parentId: tIssue.parentId })
            .projectingOptionalValuesAsNullable()
            .recursiveUnionAllOn((parent) => tIssue.id.equals(parent.parentId))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title, parentId) as (select id as id, title as title, parent_id as parentId from issue where id = :0 union all select issue.id as id, issue.title as title, issue.parent_id as parentId from issue join recursive_select_1 on issue.id = recursive_select_1.parentId) select id as "id", title as "title", parentId as "parentId" from recursive_select_1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string, parentId: number | null }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-result-execute-select-page', async () => {
        // `.orderBy('id').limit(2).executeSelectPage()` on the recursive result.
        // Anchor selects issues 1, 2, 3; the recursion adds nothing. The page
        // should return the first 2 ordered rows and the total count (3) from the
        // wrapped count query.
        const dataRows = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
        ]
        ctx.mockNext(dataRows)
        ctx.mockNext(3)
        const connection = ctx.conn
        const page = await connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .orderBy('id')
            .limit(2)
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1 order by "id" fetch next :3 rows only"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
            2,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select count(*) from recursive_select_1"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof page, {
            data:  Array<{ id: number, title: string }>
            count: number
        }>>()
        expect(page.count).toBe(3)
        expect(page.data).toEqual(dataRows)
    })

    test('recursive-result-order-by-column-mode', async () => {
        // `.orderBy('id', 'desc')` on the recursive result: the string+mode
        // overload orders the outer `select ... from <cte>`, i.e. the final result
        // (not the anchor seed). Anchor selects issues 1, 2, 3; the recursion adds
        // nothing; the outer `order by id desc` returns them 3, 2, 1.
        const expected = [
            { id: 3, title: 'Migrate to ESM' },
            { id: 2, title: 'Redesign navbar' },
            { id: 1, title: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .orderBy('id', 'desc')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1 order by "id" desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-result-order-by-from-string', async () => {
        // `.orderByFromString('title asc, id asc')` on the recursive result. The
        // comma-split clause resolves each column name against the SELECT clause
        // (validated on the anchor builder) and adds the ORDER BY terms onto the
        // outer select (order-on-outer split). Titles are unique, so the id tie
        // break is a no-op; the alphabetical title order returns issues 3, 2, 1.
        const expected = [
            { id: 3, title: 'Migrate to ESM' },
            { id: 2, title: 'Redesign navbar' },
            { id: 1, title: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .orderByFromString('title asc, id asc')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1 order by "title" asc, "id" asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-result-order-by-from-string-if-value', async () => {
        // `.orderByFromStringIfValue('id desc')` — the value-present arm behaves
        // like `orderByFromString`, adding the ORDER BY onto the outer select.
        const expected = [
            { id: 3, title: 'Migrate to ESM' },
            { id: 2, title: 'Redesign navbar' },
            { id: 1, title: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .orderByFromStringIfValue('id desc')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1 order by "id" desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-result-order-by-from-string-if-value-absent', async () => {
        // `.orderByFromStringIfValue(null)` — the no-value arm skips the ORDER BY
        // entirely (no clause reaches the outer select). Anchored on a single
        // issue whose recursion adds nothing, so exactly one row comes back and
        // the value assertion stays deterministic without an ORDER BY.
        const expected = [{ id: 2, title: 'Redesign navbar' }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .orderByFromStringIfValue(null)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id = :0 union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-result-order-by-from-string-array', async () => {
        // `.orderByFromStringArray(['title asc', 'id asc'])` — the array form adds
        // one ORDER BY term per element onto the outer select. Same result order
        // as the comma-string form.
        const expected = [
            { id: 3, title: 'Migrate to ESM' },
            { id: 2, title: 'Redesign navbar' },
            { id: 1, title: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .orderByFromStringArray(['title asc', 'id asc'])
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1 order by "title" asc, "id" asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-result-order-by-from-string-array-if-value', async () => {
        // `.orderByFromStringArrayIfValue(['title asc', null, 'id asc'])` — the
        // null element is filtered out; the surviving terms are added onto the
        // outer select. Same result order as the plain array form.
        const expected = [
            { id: 3, title: 'Migrate to ESM' },
            { id: 2, title: 'Redesign navbar' },
            { id: 1, title: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .orderByFromStringArrayIfValue(['title asc', null, 'id asc'])
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1 order by "title" asc, "id" asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-result-limit-if-value-offset-if-value', async () => {
        // `.orderBy('id').limitIfValue(2).offsetIfValue(1)` — the value-present
        // arms of limit/offset page the outer select, i.e. the final recursive
        // result. Anchor selects issues 1, 2, 3; the recursion adds nothing; the
        // page keeps issues 2, 3.
        const expected = [
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .orderBy('id')
            .limitIfValue(2)
            .offsetIfValue(1)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1 order by "id" offset :3 rows fetch next :4 rows only"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-result-execute-select-page-no-ordering', async () => {
        // Bare `.executeSelectPage()` with NO ordering/paging on the recursive
        // result. The data query is the plain outer `select ... from <cte>` and
        // the count query wraps that same CTE with `select count(*) from <cte>`
        // (count-wraps-CTE path) — it must count the final recursive result, not
        // an already-limited seed. Anchor selects issues 1, 2, 3; recursion adds
        // nothing; page returns all 3 rows and count 3.
        const dataRows = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(dataRows)
        ctx.mockNext(3)
        const connection = ctx.conn
        const page = await connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select count(*) from recursive_select_1"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof page, {
            data:  Array<{ id: number, title: string }>
            count: number
        }>>()
        expect(page.count).toBe(3)
        expect(page.data).toEqual(dataRows)
    })

    test('recursive-result-order-by-value-source-secondary', async () => {
        // `orderBy(<no-table valueSource>)` on a recursive result orders the outer
        // `select ... from <cte>`. A benign constant (`const(1)`) is used as a
        // secondary key after `orderBy('id')`, so the result stays ordered by id
        // while the constant ORDER BY term is exercised. The anchor selects issues
        // 1, 2, 3 and the recursion adds no rows, so the order is deterministic.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .orderBy('id')
            .orderBy(connection.const(1, 'int'))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1 order by "id", :3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-result-order-by-raw-fragment', async () => {
        // `orderBy(rawFragment, 'desc')` on a recursive result orders the final
        // result by the fragment `title` (the outer select’s output column)
        // descending. Titles are unique, so the order is deterministic:
        // 'Update hero copy' > 'Redesign navbar' > 'Migrate to ESM' → issues 1, 2, 3.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .orderBy(connection.rawFragment`title`, 'desc')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1 order by title desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-multi-column-inline-aggregated-array-value', async () => {
        // A recursive select projecting more than one column, consumed via
        // `forUseAsInlineAggregatedArrayValue()`: the multi-column shape aggregates
        // each row into a per-element object. Every seeded issue has a NULL
        // parent_id, so the traversal from a single anchor yields a one-element array.
        const expected = [{ id: 1, tree: [{ id: 1, title: 'Update hero copy' }] }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.id))
            .forUseAsInlineAggregatedArrayValue()

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, tree })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id = :0 union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", (select json_arrayagg(json_object('id' value id, 'title' value title)) from recursive_select_1) as "tree" from project where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:   number
            tree: Array<{ id: number, title: string }>
        }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-select-consumed-via-for-use-in-query-as', async () => {
        // A recursive select consumed as a plain CTE via `forUseInQueryAs('tree')`
        // and then selected from in an outer query. The generated `with recursive`
        // block is hoisted to the top-level WITH; the outer query reads the CTE's
        // columns back and orders them. Anchor selects issues 1, 2, 3; the recursion
        // adds nothing.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.id))
            .forUseInQueryAs('tree')

        const result = await connection.selectFrom(tree)
            .select({ id: tree.id, title: tree.title })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with tree(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join tree on issue.parent_id = tree.id) select id as "id", title as "title" from tree order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-result-order-by-limit-offset-then-for-use-in-query-as', async () => {
        // A recursive select given `.orderBy('id').limit(2).offset(1)` and THEN
        // consumed as a CTE via `forUseInQueryAs('tree')`. The ordering and paging
        // belong to the recursive RESULT, not the consuming query, so they are
        // preserved on a wrapping CTE `tree as (select ... from <recursive-member>
        // order by id limit 2 offset 1)` instead of being folded into the recursive
        // term (`... union all ... order by ... limit ...`, which every engine
        // rejects). Anchor selects issues 1, 2, 3; the recursion adds nothing; the
        // wrapping CTE's `order by id limit 2 offset 1` keeps issues 2 and 3.
        const expected = [
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.id))
            .orderBy('id').limit(2).offset(1)
            .forUseInQueryAs('tree')

        const result = await connection.selectFrom(tree)
            .select({ id: tree.id, title: tree.title })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id), tree as (select id as id, title as title from recursive_select_1 order by id offset :3 rows fetch next :4 rows only) select id as "id", title as "title" from tree order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-customize-order-by-hooks-then-for-use-in-query-as', async () => {
        // The order-by customize hooks (`beforeOrderByItems` / `afterOrderByItems`)
        // set on a recursive result and THEN consumed as a CTE via
        // `forUseInQueryAs('tree')`. Like the ordering/paging above they order the
        // recursive RESULT, so they render on the wrapping CTE's ORDER BY (`tree as
        // (select ... from <recursive-member> order by title asc, id asc)`), NOT
        // inside the recursive term (`... union all ... order by ...`, which every
        // engine rejects). Anchor selects issues 1, 2, 3; the recursion adds nothing;
        // the consuming query orders by id, so the three rows come back 1, 2, 3.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.id))
            .customizeQuery({
                beforeOrderByItems: connection.rawFragment`title asc`,
                afterOrderByItems:  connection.rawFragment`id asc`,
            })
            .forUseInQueryAs('tree')

        const result = await connection.selectFrom(tree)
            .select({ id: tree.id, title: tree.title })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id), tree as (select id as id, title as title from recursive_select_1 order by title asc, id asc) select id as "id", title as "title" from tree order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })
    test('recursive-result-limit-offset-then-for-use-in-query-as', async () => {
        // A recursive result given `.limit(2).offset(0)` with NO `orderBy`, THEN
        // consumed as a CTE via `forUseInQueryAs('tree')`. The paging belongs to
        // the recursive RESULT, so it renders on an ORDER-LESS wrapping CTE
        // `tree as (select ... from <recursive-member> limit 2 offset 0)` — the
        // limit/offset arms of the wrapping predicate fire with no ORDER BY inside
        // the CTE. Anchor selects issues 2, 3; the recursion
        // adds nothing. `limit 2` keeps both rows and `offset 0` skips none, so the
        // value stays deterministic without ordering the CTE; the consuming query's
        // `orderBy('id')` fixes the final order.
        const expected = [
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.in([2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.id))
            .limit(2).offset(0)
            .forUseInQueryAs('tree')

        const result = await connection.selectFrom(tree)
            .select({ id: tree.id, title: tree.title })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id), tree as (select id as id, title as title from recursive_select_1 offset :2 rows fetch next :3 rows only) select id as "id", title as "title" from tree order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
            0,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-customize-dual-rehoming-then-for-use-in-query-as', async () => {
        // Dual re-homing when a customized recursive result with ordering+paging is
        // consumed via `forUseInQueryAs('tree')`: `beforeQuery`/`afterQuery` bracket
        // the inner recursive body (the `recursive_select_1` member), while
        // `beforeOrderByItems`, `orderBy('id')` and `.limit(2)` all belong to the
        // recursive RESULT and render on the WRAPPING CTE's select. The two ends of
        // one customize call re-home to different render sites. Anchor selects
        // issues 1, 2, 3; the recursion adds nothing; the wrapping `order by title
        // asc, id limit 2` keeps the two lowest-titled rows (issues 3, 2), and the
        // consuming query's `orderBy('id')` returns them 2, 3.
        const expected = [
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.id))
            .orderBy('id')
            .limit(2)
            .customizeQuery({
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterQuery:         connection.rawFragment` /* tail */`,
                beforeOrderByItems: connection.rawFragment`title asc`,
            })
            .forUseInQueryAs('tree')

        const result = await connection.selectFrom(tree)
            .select({ id: tree.id, title: tree.title })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (/* head */  select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id  /* tail */), tree as (select id as id, title as title from recursive_select_1 order by title asc, id fetch next :3 rows only) select id as "id", title as "title" from tree order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-result-order-by-limit-inline-scalar-value', async () => {
        // A recursive one-column result given ordering + paging and consumed as an
        // inline scalar subquery via `forUseAsInlineQueryValue()`. Unlike the CTE
        // consumer above, the ordering renders INSIDE the scalar subquery
        // (`(select result from recursive_select_1 order by result limit 1)`), not on
        // a wrapping CTE. `limit 1` keeps the subquery scalar. Every seeded issue has
        // a NULL parent_id, so the traversal from issue 1 returns exactly that row.
        const expected = [{ id: 1, root: 1 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const rootIssueId = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.id)
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.result))
            .orderBy(connection.rawFragment`result`)
            .limit(1)
            .forUseAsInlineQueryValue()

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, root: rootIssueId })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(result) as (select id as result from issue where id = :0 union all select issue.id as result from issue join recursive_select_1 on issue.parent_id = recursive_select_1.result) select id as "id", (select result as "result" from recursive_select_1 order by result fetch next :1 rows only) as "root" from project where id = :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
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

    test('recursive-result-order-by-inline-aggregated-array-value', async () => {
        // A recursive result given `.orderBy('id')` and consumed as an inline
        // aggregated-array value via `forUseAsInlineAggregatedArrayValue()`. The
        // ordering is relocated into a wrapping derived table so `json_agg`
        // aggregates the ordered rows
        // (`(select json_agg(...) from (select ... from recursive_select_1 order by id) as ...)`)
        // — a valid shape (ORDER BY beside json_agg would be rejected). Every seeded
        // issue has a NULL parent_id, so the traversal from issue 1 yields a
        // one-element array.
        const expected = [{ id: 1, tree: [{ id: 1, title: 'Update hero copy' }] }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.id))
            .orderBy('id')
            .forUseAsInlineAggregatedArrayValue()

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, tree })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id = :0 union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", (select json_arrayagg(json_object('id' value a_2_.id, 'title' value a_2_.title)) from (select id as id, title as title from recursive_select_1 order by id offset 0 rows) a_2_) as "tree" from project where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:   number
            tree: Array<{ id: number, title: string }>
        }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-result-unioned-with-plain-select-compound', async () => {
        // The recursive × compound cross: `recursiveUnionAll(...).union(other)`. The
        // recursive member is hoisted into the top-level `with recursive`, and the
        // OUTER query becomes a compound `select ... from recursive_select_1 union
        // select ... from issue`. Anchor issue 1 (recursion adds nothing) ∪ issue 2 →
        // {1, 2}; the outer `order by id` returns them 1, 2.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .union(connection.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ id: tIssue.id, title: tIssue.title }))
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id = :0 union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1 union select id as "id", title as "title" from issue where id = :1 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-result-order-by-alone-then-for-use-in-query-as', async () => {
        // A recursive result given `.orderBy('id')` ALONE (no limit/offset) and THEN
        // consumed as a CTE via `forUseInQueryAs('tree')`. The ordering belongs to the
        // recursive RESULT, so it renders on a wrapping CTE `tree as (select ... from
        // <recursive-member> order by id)` rather than being folded into the recursive
        // term. Anchor selects issues 1, 2, 3; the recursion adds nothing; the
        // consuming query orders by id, so the three rows come back 1, 2, 3.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.id))
            .orderBy('id')
            .forUseInQueryAs('tree')

        const result = await connection.selectFrom(tree)
            .select({ id: tree.id, title: tree.title })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id), tree as (select id as id, title as title from recursive_select_1 order by id) select id as "id", title as "title" from tree order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, title: string }>>>()
        expect(result).toEqual(expected)
    })


    test('recursive-result-execute-select-page-with-whole-statement-customize', async () => {
        // `customizeQuery({ beforeQuery, afterQuery })` on a recursive
        // `executeSelectPage`. The data query brackets the whole `with recursive ...`
        // statement; the count query wraps the recursive result in a nested
        // `result_for_count as (...)` CTE, so the hooks still bracket its inner select.
        // Anchor selects issues 1, 2, 3; the recursion adds nothing → page returns the
        // first 2 ordered rows and total count 3.
        const dataRows = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
        ]
        ctx.mockNext(dataRows)
        ctx.mockNext(3)
        const connection = ctx.conn
        const page = await connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .orderBy('id')
            .limit(2)
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* head */ `,
                afterQuery:  connection.rawFragment` /* tail */`,
            })
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"/* head */  with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title" from recursive_select_1 order by "id" fetch next :3 rows only  /* tail */"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
            2,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id), result_for_count as (/* head */  select id as id, title as title from recursive_select_1 order by id  /* tail */) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof page, {
            data:  Array<{ id: number, title: string }>
            count: number
        }>>()
        expect(page.count).toBe(3)
        expect(page.data).toEqual(dataRows)
    })

    test('recursive-result-execute-select-page-with-outer-projection-customize', async () => {
        // `customizeQuery({ afterSelectKeyword, beforeColumns })` on a recursive
        // `executeSelectPage`. These hooks render around the column list of the outer
        // select in the data query, and around the inner select of the `result_for_count`
        // wrap in the count query. Anchor selects issues 1, 2, 3; the recursion adds
        // nothing → page returns the first 2 ordered rows and total count 3.
        const dataRows = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
        ]
        ctx.mockNext(dataRows)
        ctx.mockNext(3)
        const connection = ctx.conn
        const page = await connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({ id: tIssue.id, title: tIssue.title })
            .recursiveUnionAll((parent) => connection.selectFrom(tIssue)
                .join(parent).on(tIssue.parentId.equals(parent.id))
                .select({ id: tIssue.id, title: tIssue.title }))
            .orderBy('id')
            .limit(2)
            .customizeQuery({
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
            })
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select /* hint */ /* cols */  id as "id", title as "title" from recursive_select_1 order by "id" fetch next :3 rows only"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
            2,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with recursive_select_1(id, title) as (select id as id, title as title from issue where id in (:0, :1, :2) union all select issue.id as id, issue.title as title from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id), result_for_count as (select /* hint */ /* cols */  id as id, title as title from recursive_select_1 order by id) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof page, {
            data:  Array<{ id: number, title: string }>
            count: number
        }>>()
        expect(page.count).toBe(3)
        expect(page.data).toEqual(dataRows)
    })

    // NOT-APPLICABLE: This dialect does not accept UNION (deduplicating) in the recursive member of a recursive CTE, so recursiveUnion / recursiveUnionOn are typed never here.
    /*
    test('recursive-union-dedup-projecting-optionals-as-nullable-exec', async () => {
        // The dedup `.recursiveUnion(fn)` (full-form, emitting `union` between the
        // anchor and recursive members) combined with
        // `.projectingOptionalValuesAsNullable()`. The flag sits immediately after
        // `.select(...)` and before `.recursiveUnion(...)` — its only valid position
        // on a recursive select. It reshapes only the TypeScript type (the emitted
        // SQL is identical to the plain projection): the optional `parentId` becomes
        // a required, nullable property. Every seeded issue has a NULL parent_id, so
        // the traversal from issue 1 yields exactly issue 1, whose parent_id comes
        // back as a present `null` rather than an absent property.
        const expected = [{ id: 1, title: 'Update hero copy', parentId: null }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, title: tIssue.title, parentId: tIssue.parentId })
            .projectingOptionalValuesAsNullable()
            .recursiveUnion((child) => connection.selectFrom(tIssue)
                .join(child).on(child.parentId.equals(tIssue.id))
                .select({ id: tIssue.id, title: tIssue.title, parentId: tIssue.parentId })
                .projectingOptionalValuesAsNullable())
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof result, Array<{ id: number, title: string, parentId: number | null }>>>()
        expect(result).toEqual(expected)
        expect('parentId' in result[0]!).toBe(true)
        expect(result[0]!.parentId).toBe(null)
    })
    */

    // NOT-APPLICABLE: This dialect does not accept UNION (deduplicating) in the recursive member of a recursive CTE, so recursiveUnion / recursiveUnionOn are typed never here.
    /*
    test('recursive-union-dedup-projecting-optionals-as-nullable-inline', async () => {
        // The dedup `.recursiveUnion(fn)` carrying `.projectingOptionalValuesAsNullable()`,
        // consumed as an inline aggregated array via `forUseAsInlineAggregatedArrayValue()`.
        // The nullable projection propagates through the recursive build into each
        // aggregated element: the optional `parentId` becomes a required, nullable
        // property on the tree element. Every seeded issue has a NULL parent_id, so the
        // traversal from issue 1 yields a one-element array whose single element carries
        // `parentId: null` as a present property.
        const expected = [{ id: 1, tree: [{ id: 1, title: 'Update hero copy', parentId: null }] }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, title: tIssue.title, parentId: tIssue.parentId })
            .projectingOptionalValuesAsNullable()
            .recursiveUnion((child) => connection.selectFrom(tIssue)
                .join(child).on(child.parentId.equals(tIssue.id))
                .select({ id: tIssue.id, title: tIssue.title, parentId: tIssue.parentId })
                .projectingOptionalValuesAsNullable())
            .forUseAsInlineAggregatedArrayValue()

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, tree })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof result, Array<{
            id:   number
            tree: Array<{ id: number, title: string, parentId: number | null }>
        }>>>()
        expect(result).toEqual(expected)
        expect('parentId' in result[0]!.tree[0]!).toBe(true)
        expect(result[0]!.tree[0]!.parentId).toBe(null)
    })
    */

    // NOT-APPLICABLE: This dialect does not accept UNION (deduplicating) in the recursive member of a recursive CTE, so recursiveUnion / recursiveUnionOn are typed never here.
    /*
    test('recursive-union-on-dedup-projecting-optionals-as-nullable-exec', async () => {
        // The `.recursiveUnionOn(fn)` shortcut (dedup `union` variant) combined with
        // `.projectingOptionalValuesAsNullable()`. The shortcut synthesises the
        // recursive arm against the anchor table from the join-on predicate; the
        // nullable-projection flag set on the anchor drives the final result shape.
        // Only the TypeScript type changes (emitted SQL matches the plain projection):
        // the optional `parentId` becomes a required, nullable property. Every seeded
        // issue has a NULL parent_id, so the traversal from issue 1 yields exactly
        // issue 1, whose parent_id comes back as a present `null`.
        const expected = [{ id: 1, title: 'Update hero copy', parentId: null }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, title: tIssue.title, parentId: tIssue.parentId })
            .projectingOptionalValuesAsNullable()
            .recursiveUnionOn((parent) => tIssue.id.equals(parent.parentId))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof result, Array<{ id: number, title: string, parentId: number | null }>>>()
        expect(result).toEqual(expected)
        expect('parentId' in result[0]!).toBe(true)
        expect(result[0]!.parentId).toBe(null)
    })
    */

    // NOT-APPLICABLE: This dialect does not accept UNION (deduplicating) in the recursive member of a recursive CTE, so recursiveUnion / recursiveUnionOn are typed never here.
    /*
    test('recursive-union-on-dedup-projecting-optionals-as-nullable-inline', async () => {
        // The `.recursiveUnionOn(fn)` shortcut (dedup `union` variant) carrying
        // `.projectingOptionalValuesAsNullable()`, consumed as an inline aggregated
        // array via `forUseAsInlineAggregatedArrayValue()`. The nullable projection
        // propagates through the recursive build into each aggregated element: the
        // optional `parentId` becomes a required, nullable property on the tree
        // element. Every seeded issue has a NULL parent_id, so the traversal from
        // issue 1 yields a one-element array whose single element carries
        // `parentId: null` as a present property.
        const expected = [{ id: 1, tree: [{ id: 1, title: 'Update hero copy', parentId: null }] }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, title: tIssue.title, parentId: tIssue.parentId })
            .projectingOptionalValuesAsNullable()
            .recursiveUnionOn((parent) => tIssue.id.equals(parent.parentId))
            .forUseAsInlineAggregatedArrayValue()

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, tree })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof result, Array<{
            id:   number
            tree: Array<{ id: number, title: string, parentId: number | null }>
        }>>>()
        expect(result).toEqual(expected)
        expect('parentId' in result[0]!.tree[0]!).toBe(true)
        expect(result[0]!.tree[0]!.parentId).toBe(null)
    })
    */
})
