// Exhaustive coverage of `customizeQuery({...})` hooks on SELECT.
// The docs page ([docs/queries/sql-fragments.md]) covers
// `afterSelectKeyword` + `afterQuery` only; this file fills in the
// rest of the `SelectCustomization` surface defined
// `beforeColumns`, `customWindow`, `beforeOrderByItems`,
// `afterOrderByItems`, `beforeQuery`, `beforeWithQuery`, and
// `afterWithQuery`. Each hook routes through `_appendRawFragment`
// at the corresponding branch
// (see lines 779, 800, 872, 880, 960, 1010, 1014, 1035, 1074, 977
// for the SELECT/COMPOUND-SELECT paths).
//
// Hooks also accept fragments that interpolate columns and bound
// values, which exercises the `__registerRequiredColumn`/`__addWiths`
// forwarding through the SELECT builder

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('customize-select-before-columns-with-hint', async () => {
        // `beforeColumns` splices a fragment between the SELECT
        // keyword (and its `afterSelectKeyword` slot) and the column
        // list. Used here for an optimiser hint that has to land
        // immediately before the projections.
        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                beforeColumns: connection.rawFragment`/*+ INDEX(project pk) */ `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select /*+ INDEX(project pk) */  id as "id" from project"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('customize-select-custom-window-emits-named-window', async () => {
        // `customWindow` is the slot for a `WINDOW name AS (...)` clause
        // - the builder always prefixes with the `window ` keyword
        // so the fragment supplies just the window definition.
        ctx.mockNext([{ id: 1 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .customizeQuery({
                customWindow: connection.rawFragment`priority_w as (partition by ${tIssue.priority})`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where project_id = :0 window priority_w as (partition by priority) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('customize-select-after-order-by-items-trailing-tiebreaker', async () => {
        // `afterOrderByItems` appends a fragment as an additional
        // ORDER BY entry, comma-joined after the explicit items. The
        // canonical use case is a deterministic tie-breaker by the
        // unique row id when the primary sort key (here `priority`)
        // can have ties.
        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy(tIssue.priority)
            .customizeQuery({
                afterOrderByItems: connection.rawFragment`${tIssue.id} desc`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue order by issue.priority, issue.id desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('customize-select-before-query-emits-leading-comment', async () => {
        // `beforeQuery` lands its fragment before any other SQL — the
        // canonical use case is a pgbouncer-style routing comment or
        // a query-id marker the proxy logs verbatim.
        ctx.mockNext([{ id: 1 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* route=analytics-replica */ `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* route=analytics-replica */  select id as "id" from project"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('customize-select-before-with-query-and-after-with-query-wrap-cte', async () => {
        // `beforeWithQuery` / `afterWithQuery` live on the INNER
        // SELECT customization (not the outer), and only render once
        // that SELECT is materialised as a CTE via
        // `.forUseInQueryAs(...)`. The builder splices the fragments
        // around the `(...)` parens, between the CTE name and body,
        // see.
        ctx.mockNext([{ id: 1, issueId: 1 }])
        const connection = ctx.conn
        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ id: tIssue.id, projectId: tIssue.projectId })
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* warmup */`,
                afterWithQuery:  connection.rawFragment`/* end-of-with */`,
            })
            .forUseInQueryAs('open_issues')

        const result = await connection.selectFrom(tProject)
            .innerJoin(openIssues).on(openIssues.projectId.equals(tProject.id))
            .select({ id: tProject.id, issueId: openIssues.id })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with open_issues as /* warmup */ (select id as id, project_id as projectId from issue where status = :0) /* end-of-with */ select project.id as "id", open_issues.id as "issueId" from project inner join open_issues on open_issues.projectId = project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; issueId: number }>>>()
    })

    test('customize-recursive-select-before-and-after-query-render-inside-cte-body', async () => {
        // A recursive select materialised as a CTE via `.forUseInQueryAs(...)`
        // keeps ALL four `customizeQuery` hooks. `beforeQuery` / `afterQuery`
        // render INSIDE the recursive CTE body (around the anchor∪recursive
        // union), exactly as they do for the non-recursive CTE above; the
        // `beforeWithQuery` / `afterWithQuery` pair wraps the `(...)` parens.
        ctx.mockNext([{ id: 2 }])
        const connection = ctx.conn
        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, parentId: tIssue.parentId })
            .recursiveUnionAllOn((parent) => tIssue.id.equals(parent.parentId))
            .customizeQuery({
                beforeQuery:     connection.rawFragment`/* head */ `,
                afterQuery:      connection.rawFragment` /* tail */`,
                beforeWithQuery: connection.rawFragment`/* warmup */`,
                afterWithQuery:  connection.rawFragment`/* end-of-with */`,
            })
            .forUseInQueryAs('tree')

        const result = await connection.selectFrom(tree)
            .select({ id: tree.id })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with tree(id, parentId) as /* warmup */ (/* head */  select id as id, parent_id as parentId from issue where id = :0 union all select issue.id as id, issue.parent_id as parentId from issue join tree on issue.id = tree.parentId  /* tail */) /* end-of-with */ select id as "id" from tree"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual([{ id: 2 }])
    })

    test('customize-recursive-select-projection-only-hooks-not-applicable-as-cte', async () => {
        // Same recursive select consumed as a CTE via `.forUseInQueryAs(...)`,
        // now ALSO carrying the projection-only hooks `afterSelectKeyword` /
        // `beforeColumns` / `customWindow`. Those three customize a plain SELECT
        // clause that the compound anchor∪recursive CTE body does not have — the
        // outer `select ... from <cte>` they would target is replaced by the
        // consuming query — so they are legitimately not applicable here and leave
        // no trace. Only the hooks that fit the compound body survive: `beforeQuery`
        // / `afterQuery` bracket the union and `beforeWithQuery` / `afterWithQuery`
        // wrap the `(...)` parens, so the emitted SQL is identical to the previous
        // test. The three projection-only hooks DO render when the same recursive
        // select is executed directly instead of consumed as a CTE.
        ctx.mockNext([{ id: 2 }])
        const connection = ctx.conn
        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, parentId: tIssue.parentId })
            .recursiveUnionAllOn((parent) => tIssue.id.equals(parent.parentId))
            .customizeQuery({
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterQuery:         connection.rawFragment` /* tail */`,
                beforeWithQuery:    connection.rawFragment`/* warmup */`,
                afterWithQuery:     connection.rawFragment`/* end-of-with */`,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                customWindow:       connection.rawFragment`w1 as (partition by parent_id)`,
            })
            .forUseInQueryAs('tree')

        const result = await connection.selectFrom(tree)
            .select({ id: tree.id })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with tree(id, parentId) as /* warmup */ (/* head */  select id as id, parent_id as parentId from issue where id = :0 union all select issue.id as id, issue.parent_id as parentId from issue join tree on issue.id = tree.parentId  /* tail */) /* end-of-with */ select id as "id" from tree"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual([{ id: 2 }])
    })

    test('customize-recursive-select-projection-only-hooks-render-in-wrapping-cte-with-ordering', async () => {
        // The same recursive select consumed as a CTE via `.forUseInQueryAs(...)`, but
        // now ALSO carrying `orderBy`. The ordering cannot fold into the recursive term
        // (`... union all ... order by ...` is rejected by every engine), so the result
        // is exposed through a WRAPPING `tree as (select ... from <recursive-member>
        // order by ...)`. That wrapping select IS a plain SELECT that keeps the
        // projection, so the projection-only hooks `afterSelectKeyword` / `beforeColumns`
        // / `customWindow` — legitimately dropped on the no-ordering path in the test
        // above — DO render here, each at its own site, alongside `beforeOrderByItems`.
        // `beforeQuery` / `afterQuery` still bracket the recursive union inside the CTE
        // body (they belong to the compound anchor∪recursive body, not the wrapper).
        ctx.mockNext([{ id: 2 }])
        const connection = ctx.conn
        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, parentId: tIssue.parentId })
            .recursiveUnionAllOn((parent) => tIssue.id.equals(parent.parentId))
            .orderBy('id')
            .customizeQuery({
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterQuery:         connection.rawFragment` /* tail */`,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                customWindow:       connection.rawFragment`w1 as (partition by id)`,
                beforeOrderByItems: connection.rawFragment`parentId asc`,
            })
            .forUseInQueryAs('tree')

        const result = await connection.selectFrom(tree)
            .select({ id: tree.id })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, parentId) as (/* head */  select id as id, parent_id as parentId from issue where id = :0 union all select issue.id as id, issue.parent_id as parentId from issue join recursive_select_1 on issue.id = recursive_select_1.parentId  /* tail */), tree as (select /* hint */ /* cols */  id as id, parentId as parentId from recursive_select_1 window w1 as (partition by id) order by parentId asc, id) select id as "id" from tree"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual([{ id: 2 }])
    })

    test('customize-recursive-select-projection-only-hooks-render-in-wrapping-cte-with-limit', async () => {
        // A recursive select carrying `limit` (paging), consumed as a CTE via
        // `.forUseInQueryAs(...)`. The limit cannot fold into the recursive term, so
        // the result is exposed through a WRAPPING
        // `tree as (select ... from <recursive-member> limit N)`. That wrapping
        // select is a plain SELECT that keeps the projection, so the projection-only
        // hooks `afterSelectKeyword` / `beforeColumns` / `customWindow` render here,
        // each at its own site. `beforeQuery` / `afterQuery` bracket the recursive
        // union inside the CTE body.
        ctx.mockNext([{ id: 2 }])
        const connection = ctx.conn
        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, parentId: tIssue.parentId })
            .recursiveUnionAllOn((parent) => tIssue.id.equals(parent.parentId))
            .limit(10)
            .customizeQuery({
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterQuery:         connection.rawFragment` /* tail */`,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                customWindow:       connection.rawFragment`w1 as (partition by id)`,
            })
            .forUseInQueryAs('tree')

        const result = await connection.selectFrom(tree)
            .select({ id: tree.id })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, parentId) as (/* head */  select id as id, parent_id as parentId from issue where id = :0 union all select issue.id as id, issue.parent_id as parentId from issue join recursive_select_1 on issue.id = recursive_select_1.parentId  /* tail */), tree as (select /* hint */ /* cols */  id as id, parentId as parentId from recursive_select_1 window w1 as (partition by id) fetch next :1 rows only) select id as "id" from tree"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            10,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual([{ id: 2 }])
    })

    test('customize-recursive-select-projection-only-hooks-render-in-wrapping-cte-with-limit-and-offset', async () => {
        // A recursive select carrying `limit` + `offset` paging (the fluent API
        // reaches OFFSET only after a LIMIT), consumed as a CTE. Neither can fold
        // into the recursive term, so both are exposed through the WRAPPING
        // `tree as (select ... from <recursive-member> limit N offset M)`, and the
        // projection-only hooks `afterSelectKeyword` / `beforeColumns` / `customWindow`
        // render in the wrapper.
        ctx.mockNext([{ id: 2 }])
        const connection = ctx.conn
        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, parentId: tIssue.parentId })
            .recursiveUnionAllOn((parent) => tIssue.id.equals(parent.parentId))
            .limit(10)
            .offset(5)
            .customizeQuery({
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterQuery:         connection.rawFragment` /* tail */`,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                customWindow:       connection.rawFragment`w1 as (partition by id)`,
            })
            .forUseInQueryAs('tree')

        const result = await connection.selectFrom(tree)
            .select({ id: tree.id })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, parentId) as (/* head */  select id as id, parent_id as parentId from issue where id = :0 union all select issue.id as id, issue.parent_id as parentId from issue join recursive_select_1 on issue.id = recursive_select_1.parentId  /* tail */), tree as (select /* hint */ /* cols */  id as id, parentId as parentId from recursive_select_1 window w1 as (partition by id) offset :1 rows fetch next :2 rows only) select id as "id" from tree"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            5,
            10,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        // limit/offset page the recursive result: offset 5 skips the single-row
        // traversal on a real engine, while the mock returns its primed row.
        if (ctx.realDbEnabled) expect(result).toEqual([])
        else expect(result).toEqual([{ id: 2 }])
    })

    test('customize-recursive-select-projection-only-hooks-render-in-wrapping-cte-with-order-by-and-limit', async () => {
        // A recursive select carrying `orderBy` + `limit`, consumed as a CTE. Both
        // the ordering and the limit are exposed in the WRAPPING
        // `tree as (select ... from <recursive-member> ... order by ... limit N)`, and
        // the projection-only hooks `afterSelectKeyword` / `beforeColumns` /
        // `customWindow` plus `beforeOrderByItems` render in the wrapper.
        ctx.mockNext([{ id: 2 }])
        const connection = ctx.conn
        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({ id: tIssue.id, parentId: tIssue.parentId })
            .recursiveUnionAllOn((parent) => tIssue.id.equals(parent.parentId))
            .orderBy('id')
            .limit(10)
            .customizeQuery({
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterQuery:         connection.rawFragment` /* tail */`,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                customWindow:       connection.rawFragment`w1 as (partition by id)`,
                beforeOrderByItems: connection.rawFragment`parentId asc`,
            })
            .forUseInQueryAs('tree')

        const result = await connection.selectFrom(tree)
            .select({ id: tree.id })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, parentId) as (/* head */  select id as id, parent_id as parentId from issue where id = :0 union all select issue.id as id, issue.parent_id as parentId from issue join recursive_select_1 on issue.id = recursive_select_1.parentId  /* tail */), tree as (select /* hint */ /* cols */  id as id, parentId as parentId from recursive_select_1 window w1 as (partition by id) order by parentId asc, id fetch next :1 rows only) select id as "id" from tree"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            10,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual([{ id: 2 }])
    })

    test('customize-select-hook-fragment-with-column-reference', async () => {
        // A fragment that references a column drives
        // `__registerRequiredColumn` on the customization
        // Inline column reference rendered as `issue.priority`.
        ctx.mockNext([{ id: 1 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({ id: tIssue.id })
            .orderBy('id')
            .customizeQuery({
                beforeOrderByItems: connection.rawFragment`${tIssue.priority} desc`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where project_id = :0 order by issue.priority desc, "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('customize-select-all-rawfragment-hooks-kitchen-sink', async () => {
        // All seven RawFragment-typed hooks on SELECT applied at once
        // - the snapshot is the documentation of exactly where each
        // one lands relative to the rest of the SELECT. The three
        // ORDER BY positions use different columns
        // (`organizationId` / `slug` / `id`) so SQL Server doesn't
        // trip on its "column specified more than once in the order
        // by list" check (error 169).
        ctx.mockNext([{ id: 1 }])
        const connection = ctx.conn
        const result = await connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .orderBy(tProject.organizationId)
            .customizeQuery({
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                customWindow:       connection.rawFragment`w1 as (partition by ${tProject.organizationId})`,
                beforeOrderByItems: connection.rawFragment`${tProject.slug} asc`,
                afterOrderByItems:  connection.rawFragment`${tProject.id} asc`,
                afterQuery:         connection.rawFragment` /* tail */`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select /* hint */ /* cols */  id as "id" from project window w1 as (partition by organization_id) order by project.slug asc, project.organization_id, project.id asc  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })
    test('customize-select-projection-only-hooks-survive-as-cte', async () => {
        // A NON-recursive select consumed as a CTE via `.forUseInQueryAs(...)` renders
        // ALL FIVE projection/order-by hooks (`afterSelectKeyword` / `beforeColumns` /
        // `customWindow` / `beforeOrderByItems` / `afterOrderByItems`) inside the CTE
        // body's `select ... from ...`, each at its own render site. Issues 1, 2 (both
        // project 1); order by project_id asc, id, priority asc → 1, 2.
        ctx.mockNext([{ id: 1, projectId: 1 }, { id: 2, projectId: 1 }])
        const connection = ctx.conn
        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2]))
            .select({ id: tIssue.id, projectId: tIssue.projectId })
            .orderBy('id')
            .customizeQuery({
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                customWindow:       connection.rawFragment`w1 as (partition by project_id)`,
                beforeOrderByItems: connection.rawFragment`project_id asc`,
                afterOrderByItems:  connection.rawFragment`priority asc`,
            })
            .forUseInQueryAs('open_issues')

        const result = await connection.selectFrom(openIssues)
            .select({ id: openIssues.id, projectId: openIssues.projectId })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with open_issues as (select /* hint */ /* cols */  id as id, project_id as projectId from issue where id in (:0, :1) window w1 as (partition by project_id) order by project_id asc, id, priority asc) select id as "id", projectId as "projectId" from open_issues order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; projectId: number }>>>()
        expect(result).toEqual([{ id: 1, projectId: 1 }, { id: 2, projectId: 1 }])
    })

    test('customize-select-plain-order-by-limit-execute-select-page-places-hooks-in-count-wrap', async () => {
        // A CUSTOMIZED PLAIN (non-distinct, non-grouped) select with `orderBy` +
        // `limit` consumed via `executeSelectPage`: the `beforeQuery` /
        // `afterQuery` hooks must render on BOTH the data query AND the
        // auto-generated count query. The count query has no user SELECT list to
        // carry the hooks inline (it rewrites to `count(*)`), so the plain path
        // wraps the customized query in a `result_for_count` CTE — the same shape
        // the grouped / compound page paths already use — and the hooks ride on
        // that wrapped inner query. The page returns the first 2 ordered projects
        // and total count 3.
        const dataRows = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
        ]
        ctx.mockNext(dataRows)
        ctx.mockNext(3)
        const connection = ctx.conn
        const page = await connection.selectFrom(tProject)
            .where(tProject.id.lessOrEqual(3))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .limit(2)
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* head */ `,
                afterQuery:  connection.rawFragment` /* tail */`,
            })
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"/* head */  select id as "id", name as "name" from project where id <= :0 order by "id" fetch next :1 rows only  /* tail */"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            3,
            2,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (/* head */  select id as id, name as name from project where id <= :0 order by id  /* tail */) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof page, {
            data:  Array<{ id: number; name: string }>
            count: number
        }>>()
        expect(page.count).toBe(3)
        expect(page.data).toEqual(dataRows)
    })


    test('customize-select-plain-page-projection-hooks-render-in-count-wrap', async () => {
        // The count-wrap now fires for ANY customizeQuery hook
        // (`|| this.__customization`), so a plain (non-distinct, non-grouped)
        // executeSelectPage carrying the clause-internal hooks (afterSelectKeyword /
        // beforeColumns / customWindow / beforeOrderByItems / afterOrderByItems)
        // renders every one of them inside the `result_for_count` CTE's inner query,
        // exactly where they land on the data query (minus the LIMIT). The sibling
        // beforeQuery/afterQuery page test above pins the bracketing pair; this pins
        // the clause-internal five. The three ORDER BY positions use distinct
        // columns (organizationId / id / name) so SQL Server's "column specified
        // more than once in the order by list" check (error 169) stays satisfied.
        const dataRows = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
        ]
        ctx.mockNext(dataRows)
        ctx.mockNext(3)
        const connection = ctx.conn
        const page = await connection.selectFrom(tProject)
            .where(tProject.id.lessOrEqual(3))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .limit(2)
            .customizeQuery({
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                customWindow:       connection.rawFragment`w1 as (partition by ${tProject.organizationId})`,
                beforeOrderByItems: connection.rawFragment`${tProject.organizationId} asc`,
                afterOrderByItems:  connection.rawFragment`${tProject.name} desc`,
            })
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select /* hint */ /* cols */  id as "id", name as "name" from project where id <= :0 window w1 as (partition by organization_id) order by project.organization_id asc, "id", project.name desc fetch next :1 rows only"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            3,
            2,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (select /* hint */ /* cols */  id as id, name as name from project where id <= :0 window w1 as (partition by organization_id) order by project.organization_id asc, id, project.name desc) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof page, {
            data:  Array<{ id: number; name: string }>
            count: number
        }>>()
        expect(page.count).toBe(3)
        expect(page.data).toEqual(dataRows)
    })

    test('customize-select-distinct-page-hooks-ride-count-wrap', async () => {
        // Crossing __distinct with __customization on executeSelectPage. A
        // DISTINCT select already forces the count-wrap even without customization;
        // adding customizeQuery makes the beforeQuery/afterQuery hooks ride the
        // wrapped inner count query too. Distinct ids of projects 1..3 → 3 rows.
        const dataRows = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(dataRows)
        ctx.mockNext(3)
        const connection = ctx.conn
        const page = await connection.selectDistinctFrom(tProject)
            .where(tProject.id.lessOrEqual(3))
            .select({ id: tProject.id })
            .orderBy('id')
            .limit(2)
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* head */ `,
                afterQuery:  connection.rawFragment` /* tail */`,
            })
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"/* head */  select distinct id as "id" from project where id <= :0 order by "id" fetch next :1 rows only  /* tail */"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            3,
            2,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (/* head */  select distinct id as id from project where id <= :0 order by id  /* tail */) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof page, {
            data:  Array<{ id: number }>
            count: number
        }>>()
        expect(page.count).toBe(3)
        expect(page.data).toEqual(dataRows)
    })

    test('customize-select-group-by-page-hooks-ride-count-wrap', async () => {
        // Crossing __groupBy with __customization on executeSelectPage. GROUP
        // BY already forces the count-wrap (the outer count totals the groups);
        // adding customizeQuery makes the beforeQuery/afterQuery hooks ride the
        // wrapped inner count query. Issues grouped by status: closed(1),
        // in_progress(1), open(2) → 3 groups; page returns the first two by status.
        const dataRows = [
            { status: 'closed',      total: 1 },
            { status: 'in_progress', total: 1 },
        ]
        ctx.mockNext(dataRows)
        ctx.mockNext(3)
        const connection = ctx.conn
        const page = await connection.selectFrom(tIssue)
            .select({
                status: tIssue.status,
                total:  connection.count(tIssue.id),
            })
            .groupBy('status')
            .orderBy('status')
            .limit(2)
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* head */ `,
                afterQuery:  connection.rawFragment` /* tail */`,
            })
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"/* head */  select status as "status", count(id) as "total" from issue group by status order by "status" fetch next :0 rows only  /* tail */"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (/* head */  select status as status, count(id) as total from issue group by status order by status  /* tail */) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof page, {
            data:  Array<{ status: string; total: number }>
            count: number
        }>>()
        expect(page.count).toBe(3)
        expect(page.data).toEqual(dataRows)
    })

    test('customize-recursive-select-hooks-render-in-inline-scalar-value', async () => {
        // A recursive select carrying its own `customizeQuery` used as an inline SCALAR
        // subquery via `.forUseAsInlineQueryValue()`. All six hooks render: `beforeQuery`
        // / `afterQuery` bracket the subquery, `afterSelectKeyword` / `beforeColumns` sit
        // inside its SELECT, and `beforeWithQuery` / `afterWithQuery` wrap the hoisted
        // `with recursive` parens. Every seeded issue leaves `parent_id` NULL, so the
        // traversal from a single anchor yields one row (id 1).
        const expected = [{ id: 1, root: 1 }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const rootIssueId = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.id)
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.result))
            .customizeQuery({
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterQuery:         connection.rawFragment` /* tail */`,
                beforeWithQuery:    connection.rawFragment`/* warmup */`,
                afterWithQuery:     connection.rawFragment`/* end-of-with */`,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
            })
            .forUseAsInlineQueryValue()

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, root: rootIssueId })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(result) as /* warmup */ (select id as result from issue where id = :0 union all select issue.id as result from issue join recursive_select_1 on issue.parent_id = recursive_select_1.result) /* end-of-with */ select id as "id", (/* head */  select /* hint */ /* cols */  result as "result" from recursive_select_1  /* tail */) as "root" from project where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; root?: number }>>>()
        expect(result).toEqual(expected)
    })

    test('customize-recursive-select-hooks-render-in-inline-aggregated-array-value', async () => {
        // A recursive select carrying its own `customizeQuery` used as an inline
        // AGGREGATED-ARRAY value via `.forUseAsInlineAggregatedArrayValue()`. The six
        // hooks render around the hoisted `with recursive` and the `json_agg(...)`
        // subquery. The traversal from a single anchor yields a one-element array.
        const expected = [{ id: 1, tree: [1] }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.id)
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.result))
            .customizeQuery({
                beforeQuery:        connection.rawFragment`/* head */ `,
                afterQuery:         connection.rawFragment` /* tail */`,
                beforeWithQuery:    connection.rawFragment`/* warmup */`,
                afterWithQuery:     connection.rawFragment`/* end-of-with */`,
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
            })
            .forUseAsInlineAggregatedArrayValue()

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, tree })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(result) as /* warmup */ (select id as result from issue where id = :0 union all select issue.id as result from issue join recursive_select_1 on issue.parent_id = recursive_select_1.result) /* end-of-with */ select id as "id", (/* head */  select /* hint */ /* cols */  json_arrayagg(result) from recursive_select_1  /* tail */) as "tree" from project where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; tree: number[] }>>>()
        expect(result).toEqual(expected)
    })
    test('customize-recursive-select-custom-window-renders-in-inline-scalar-value', async () => {
        // A recursive select consumed as an inline SCALAR value via
        // `.forUseAsInlineQueryValue()`, carrying `customWindow` alongside the
        // `afterSelectKeyword` / `beforeColumns` hooks: the `window <name> as (...)`
        // clause renders inside the scalar subquery's SELECT. Every seeded issue
        // leaves `parent_id` NULL, so the traversal from a single
        // anchor yields one row (id 1).
        const expected = [{ id: 1, root: 1 }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const rootIssueId = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.id)
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.result))
            .customizeQuery({
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                customWindow:       connection.rawFragment`w1 as (partition by result)`,
            })
            .forUseAsInlineQueryValue()

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, root: rootIssueId })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(result) as (select id as result from issue where id = :0 union all select issue.id as result from issue join recursive_select_1 on issue.parent_id = recursive_select_1.result) select id as "id", (select /* hint */ /* cols */  result as "result" from recursive_select_1 window w1 as (partition by result)) as "root" from project where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; root?: number }>>>()
        expect(result).toEqual(expected)
    })

    test('customize-recursive-one-column-custom-window-and-ordering-in-inline-scalar-value', async () => {
        // A one-column recursive select consumed as an inline SCALAR value via
        // `.forUseAsInlineQueryValue()`, carrying BOTH `orderBy` and `customWindow`
        // alongside the projection hooks. Ordering forces a wrapping subquery, and the
        // `afterSelectKeyword` / `beforeColumns` / `customWindow` hooks render inside
        // that wrapped select. Every seeded issue leaves `parent_id` NULL, so the
        // traversal from a single anchor yields exactly one row and the scalar subquery
        // resolves to a single value.
        const expected = [{ id: 1, root: 1 }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const rootIssueId = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.id)
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.result))
            .orderBy('result')
            .customizeQuery({
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                customWindow:       connection.rawFragment`w1 as (partition by result)`,
            })
            .forUseAsInlineQueryValue()

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, root: rootIssueId })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(result) as (select id as result from issue where id = :0 union all select issue.id as result from issue join recursive_select_1 on issue.parent_id = recursive_select_1.result) select id as "id", (select /* hint */ /* cols */  result as "result" from recursive_select_1 window w1 as (partition by result) order by "result") as "root" from project where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; root?: number }>>>()
        expect(result).toEqual(expected)
    })

    test('customize-recursive-one-column-custom-window-and-ordering-in-inline-aggregated-array-value', async () => {
        // A one-column recursive select consumed as an inline AGGREGATED-ARRAY value
        // via `.forUseAsInlineAggregatedArrayValue()`, carrying BOTH `orderBy` and
        // `customWindow`. Ordering forces the wrapping subquery that `json_agg(...)`
        // reads from; the projection hooks + `customWindow` render inside that wrapped
        // select. Single-anchor traversal yields a one-element array.
        const expected = [{ id: 1, tree: [1] }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.id)
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.result))
            .orderBy('result')
            .customizeQuery({
                afterSelectKeyword: connection.rawFragment`/* hint */`,
                beforeColumns:      connection.rawFragment`/* cols */ `,
                customWindow:       connection.rawFragment`w1 as (partition by result)`,
            })
            .forUseAsInlineAggregatedArrayValue()

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, tree })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(result) as (select id as result from issue where id = :0 union all select issue.id as result from issue join recursive_select_1 on issue.parent_id = recursive_select_1.result) select id as "id", (select json_arrayagg(a_2_.result) from (select /* hint */ /* cols */  result as result from recursive_select_1 window w1 as (partition by result) order by result offset 0 rows) a_2_) as "tree" from project where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; tree: number[] }>>>()
        expect(result).toEqual(expected)
    })

    test('customize-recursive-one-column-ordering-in-inline-aggregated-array-value', async () => {
        // A one-column recursive select carrying `orderBy` and consumed as an inline
        // AGGREGATED-ARRAY value via `.forUseAsInlineAggregatedArrayValue()`. Ordering
        // a recursive result forces the wrapping-CTE mechanism, and the
        // aggregated-array consumer reads from that wrapped CTE. Every seeded issue
        // leaves `parent_id` NULL, so the traversal from a single anchor
        // yields a one-element array.
        const expected = [{ id: 1, tree: [1] }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const tree = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.id)
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.result))
            .orderBy('result')
            .forUseAsInlineAggregatedArrayValue()

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, tree })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(result) as (select id as result from issue where id = :0 union all select issue.id as result from issue join recursive_select_1 on issue.parent_id = recursive_select_1.result) select id as "id", (select json_arrayagg(a_2_.result) from (select result as result from recursive_select_1 order by result offset 0 rows) a_2_) as "tree" from project where id = :1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; tree: number[] }>>>()
        expect(result).toEqual(expected)
    })

})
