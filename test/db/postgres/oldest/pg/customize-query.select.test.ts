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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select /*+ INDEX(project pk) */  id as id from project"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where project_id = $1 window priority_w as (partition by priority) order by id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by issue.priority, issue.id desc"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* route=analytics-replica */  select id as id from project"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with open_issues as /* warmup */ (select id as id, project_id as projectId from issue where status = $1) /* end-of-with */ select project.id as id, open_issues.id as "issueId" from project inner join open_issues on open_issues.projectId = project.id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive tree as /* warmup */ (/* head */  select id as id, parent_id as parentId from issue where id = $1 union all select issue.id as id, issue.parent_id as parentId from issue join tree on issue.id = tree.parentId  /* tail */) /* end-of-with */ select id as id from tree"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive tree as /* warmup */ (/* head */  select id as id, parent_id as parentId from issue where id = $1 union all select issue.id as id, issue.parent_id as parentId from issue join tree on issue.id = tree.parentId  /* tail */) /* end-of-with */ select id as id from tree"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where project_id = $1 order by issue.priority desc, id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  select /* hint */ /* cols */  id as id from project window w1 as (partition by organization_id) order by project.slug asc, project.organization_id, project.id asc  /* tail */"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with open_issues as (select /* hint */ /* cols */  id as id, project_id as projectId from issue where id in ($1, $2) window w1 as (partition by project_id) order by project_id asc, id, priority asc) select id as id, projectId as "projectId" from open_issues order by id"`)
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
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"/* head */  select id as id, name as name from project where id <= $1 order by id limit $2  /* tail */"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            3,
            2,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (/* head */  select id as id, name as name from project where id <= $1 order by id  /* tail */) select count(*) from result_for_count"`)
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
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select /* hint */ /* cols */  id as id, name as name from project where id <= $1 window w1 as (partition by organization_id) order by project.organization_id asc, id, project.name desc limit $2"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            3,
            2,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (select /* hint */ /* cols */  id as id, name as name from project where id <= $1 window w1 as (partition by organization_id) order by project.organization_id asc, id, project.name desc) select count(*) from result_for_count"`)
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
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"/* head */  select distinct id as id from project where id <= $1 order by id limit $2  /* tail */"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            3,
            2,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (/* head */  select distinct id as id from project where id <= $1 order by id  /* tail */) select count(*) from result_for_count"`)
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
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"/* head */  select status as status, count(id) as total from issue group by status order by status limit $1  /* tail */"`)
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
})
