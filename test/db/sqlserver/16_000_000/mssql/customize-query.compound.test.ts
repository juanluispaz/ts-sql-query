// Coverage of `.customizeQuery({...})` on **compound** queries
// (UNION / UNION ALL / INTERSECT / EXCEPT). Compound queries land on a
// different code path in `AbstractSqlBuilder._buildSelectWithColumnsInfo`
// (the `query.__type === 'compound'` branch around
// than ordinary SELECTs, and accept a narrower
// — only `beforeQuery`, `afterQuery`, `beforeWithQuery`, `afterWithQuery`,
// plus `queryExecutionName` / `queryExecutionMetadata` (separately
// exercised in `docs.advanced.query-execution-metadata.test.ts`).
//
// The existing `select.compound*` tests pin the raw compound shape;
// `customize-query.select.test.ts` covers the SELECT-specific hooks.
// Nothing in the suite exercises the *compound* hooks, so the
// `customization.beforeQuery / afterQuery` branches are
// only reachable through this file. The WITH-wrapped branch is
// exercised by the second test below.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { getQueryExecutionName, getQueryExecutionMetadata } from '../../../../../src/queryRunners/QueryRunner.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('customize-compound-before-and-after-query-wrap-union', async () => {
        // `beforeQuery` + `afterQuery` wrap the whole compound. The
        // hooks emit comments around `select … union select …` so the
        // snapshot pins both attachment points in one shot.
        const expected = [
            { label: 'Internal tools' },
            { label: 'Marketing site' },
            { label: 'Public API' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const projectsQ = connection.selectFrom(tProject)
            .where(tProject.archivedAt.isNull())
            .select({ label: tProject.name })
        const issuesQ = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('done'))
            .select({ label: tIssue.title })
        const result = await projectsQ
            .union(issuesQ)
            .orderBy('label')
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* compound-head */ `,
                afterQuery:  connection.rawFragment` /* compound-tail */`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* compound-head */  select name as [label] from project where archived_at is null union select title as [label] from issue where status = @0 order by [label]  /* compound-tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "done",
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
    })

    test('customize-compound-with-query-hooks-wrap-cte', async () => {
        // A CTE feeds the left side of an INTERSECT; the compound
        // carries `beforeWithQuery` / `afterWithQuery` hooks. At the ROOT of a
        // compound the compound is NOT itself a with-view, so these hooks have no
        // attachment point and render NOTHING — the snapshot is unchanged (they DO
        // render when the compound is materialised as a CTE). Lands on
        // `_buildWith` → `customization.beforeWithQuery / afterWithQuery`
        // at AbstractSqlBuilder.
        const connection = ctx.conn
        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ id: tIssue.id })
            .forUseInQueryAs('openIssues')
        const left = connection.selectFrom(openIssues)
            .select({ id: openIssues.id })
        const right = connection.selectFrom(tIssue)
            .where(tIssue.id.lessOrEqual(2))
            .select({ id: tIssue.id })
        ctx.mockNext([{ id: 1 }])
        const result = await left
            .intersect(right)
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* with-head */ `,
                afterWithQuery:  connection.rawFragment` /* with-tail */`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with openIssues as (select id as id from issue where status = @0) select id as id from openIssues intersect select id as id from issue where id <= @1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('customize-compound-all-hooks-combined-on-except', async () => {
        // The four compound hooks at once on an EXCEPT. Documents
        // exactly where each one lands relative to the others — the
        // snapshot is the spec.
        const connection = ctx.conn
        const allIssueIds = connection.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .forUseInQueryAs('allIssueIds')
        const left = connection.selectFrom(allIssueIds)
            .select({ id: allIssueIds.id })
        const right = connection.selectFrom(tIssue)
            .where(tIssue.priority.equals(1))
            .select({ id: tIssue.id })
        ctx.mockNext([{ id: 1 }, { id: 3 }, { id: 4 }])
        const result = await left
            .except(right)
            .orderBy('id')
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* with-head */ `,
                afterWithQuery:  connection.rawFragment` /* with-tail */`,
                beforeQuery:     connection.rawFragment`/* head */ `,
                afterQuery:      connection.rawFragment` /* tail */`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"/* head */  with allIssueIds as (select id as id from issue) select id as id from allIssueIds except select id as id from issue where priority = @0 order by id  /* tail */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('customize-compound-carries-query-execution-name-and-metadata', async () => {
        // `queryExecutionName` / `queryExecutionMetadata` are accepted on the
        // customizeQuery of a compound query: they don't change the emitted SQL
        // (the union snapshot is unchanged) but the metadata is attached to the
        // execution and read back via the QueryRunner helpers.
        const expected = [{ label: 'Marketing site' }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tProject).where(tProject.id.equals(1)).select({ label: tProject.name })
            .union(connection.selectFrom(tIssue).where(tIssue.id.equals(99999)).select({ label: tIssue.title }))
            .orderBy('label')
            .customizeQuery({
                queryExecutionName:     'compound label query',
                queryExecutionMetadata: { team: 'platform' },
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as [label] from project where id = @0 union select title as [label] from issue where id = @1 order by [label]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            99999,
          ]
        `)
        expect(getQueryExecutionName(ctx.lastSql, ctx.lastParams)).toBe('compound label query')
        expect(getQueryExecutionMetadata(ctx.lastSql, ctx.lastParams)).toEqual({ team: 'platform' })
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('customize-compound-materialised-as-cte-via-for-use-in-query-as', async () => {
        // A CUSTOMIZED compound consumed as a CTE via `forUseInQueryAs`: the compound
        // `beforeQuery` / `afterQuery` hooks bracket the union INSIDE the CTE parens
        // and the outer query reads the CTE back.
        const expected = [
            { id: 1, label: 'Marketing site' },
            { id: 2, label: 'Internal tools' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const combined = connection.selectFrom(tProject).where(tProject.id.equals(1)).select({ id: tProject.id, label: tProject.name })
            .union(connection.selectFrom(tProject).where(tProject.id.equals(2)).select({ id: tProject.id, label: tProject.name }))
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* compound-head */ `,
                afterQuery:  connection.rawFragment` /* compound-tail */`,
            })
            .forUseInQueryAs('combined')
        const result = await connection.selectFrom(combined)
            .select({ id: combined.id, label: combined.label })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with combined as (/* compound-head */  select id as id, name as [label] from project where id = @0 union select id as id, name as [label] from project where id = @1  /* compound-tail */) select id as id, [label] as [label] from combined order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('customize-compound-inline-scalar-value-via-for-use-as-inline-query-value', async () => {
        // A CUSTOMIZED one-column compound consumed as an inline scalar subquery via
        // `forUseAsInlineQueryValue`: the compound hooks bracket the union INSIDE the
        // scalar subquery in the outer select list. Both branches select the same
        // project name, so the UNION dedups to a single row and the subquery stays
        // scalar.
        const expected = [{ id: 1, label: 'Marketing site' }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const label = connection.selectFrom(tProject).where(tProject.id.equals(1)).selectOneColumn(tProject.name)
            .union(connection.selectFrom(tProject).where(tProject.id.equals(1)).selectOneColumn(tProject.name))
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* compound-head */ `,
                afterQuery:  connection.rawFragment` /* compound-tail */`,
            })
            .forUseAsInlineQueryValue()
        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, label })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (/* compound-head */  select name as [result] from project where id = @0 union select name as [result] from project where id = @1  /* compound-tail */) as [label] from project where id = @2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; label?: string }>>>()
        expect(result).toEqual(expected)
    })

    test('customize-compound-order-by-limit-execute-select-page-places-hooks-in-count-wrap', async () => {
        // A CUSTOMIZED compound with `orderBy` + `limit` consumed via
        // `executeSelectPage`: the `beforeQuery` / `afterQuery` hooks render on BOTH
        // the data query and the count-wrap query. The count query wraps the compound
        // in `select count(*) from (...)`, so the snapshot pins where the compound
        // hooks land inside that wrap. Branches select ids {1,2} ∪ {3}; the page
        // returns the first 2 ordered rows and total count 3.
        const dataRows = [
            { id: 1, label: 'Marketing site' },
            { id: 2, label: 'Internal tools' },
        ]
        ctx.mockNext(dataRows)
        ctx.mockNext(3)
        const connection = ctx.conn
        const page = await connection.selectFrom(tProject).where(tProject.id.in([1, 2])).select({ id: tProject.id, label: tProject.name })
            .union(connection.selectFrom(tProject).where(tProject.id.equals(3)).select({ id: tProject.id, label: tProject.name }))
            .orderBy('id')
            .limit(2)
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* head */ `,
                afterQuery:  connection.rawFragment` /* tail */`,
            })
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"/* head */  select id as id, name as [label] from project where id in (@0, @1) union select id as id, name as [label] from project where id = @2 order by id offset 0 rows fetch next @3 rows only  /* tail */"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
            2,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (/* head */  select id as id, name as [label] from project where id in (@0, @1) union select id as id, name as [label] from project where id = @2  /* tail */) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof page, {
            data:  Array<{ id: number; label: string }>
            count: number
        }>>()
        expect(page.count).toBe(3)
        expect(page.data).toEqual(dataRows)
    })

    test('customize-compound-execute-select-page-without-limit-still-wraps-count-with-hooks', async () => {
        // Sibling of the paged compound page test above, WITHOUT a `limit` clause:
        // the page returns every row and the count still equals the total. The
        // compound count path is unconditional (it always wraps the compound in a
        // `result_for_count` CTE), so the `beforeQuery` / `afterQuery` hooks ride
        // on BOTH the data query and the count query even with no paging clause to
        // strip — the wrapped inner select carries the hooks regardless. Branches
        // select ids {1,2} ∪ {3}, ordered by id → 3 rows, count 3.
        const dataRows = [
            { id: 1, label: 'Marketing site' },
            { id: 2, label: 'Internal tools' },
            { id: 3, label: 'Public API' },
        ]
        ctx.mockNext(dataRows)
        ctx.mockNext(3)
        const connection = ctx.conn
        const page = await connection.selectFrom(tProject).where(tProject.id.in([1, 2])).select({ id: tProject.id, label: tProject.name })
            .union(connection.selectFrom(tProject).where(tProject.id.equals(3)).select({ id: tProject.id, label: tProject.name }))
            .orderBy('id')
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* head */ `,
                afterQuery:  connection.rawFragment` /* tail */`,
            })
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"/* head */  select id as id, name as [label] from project where id in (@0, @1) union select id as id, name as [label] from project where id = @2 order by id  /* tail */"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (/* head */  select id as id, name as [label] from project where id in (@0, @1) union select id as id, name as [label] from project where id = @2  /* tail */) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof page, {
            data:  Array<{ id: number; label: string }>
            count: number
        }>>()
        expect(page.count).toBe(3)
        expect(page.data).toEqual(dataRows)
    })


    test('customize-compound-as-cte-with-query-hooks-render-around-cte-parens', async () => {
        // A CUSTOMIZED compound consumed as a CTE via forUseInQueryAs, carrying ALL
        // FOUR hooks. When the compound is materialised as a with-view, `_buildWith`
        // reads the with-view's own __customization, so beforeWithQuery / afterWithQuery
        // DO render — bracketing the CTE definition (`with combined as /* with-head */
        // (...) /* with-tail */`); beforeQuery / afterQuery bracket the union INSIDE the
        // CTE parens. (At the root of a compound the with-hooks have no attachment point
        // and render nothing — see customize-compound-with-query-hooks-wrap-cte.)
        const expected = [
            { id: 1, label: 'Marketing site' },
            { id: 2, label: 'Internal tools' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const combined = connection.selectFrom(tProject).where(tProject.id.equals(1)).select({ id: tProject.id, label: tProject.name })
            .union(connection.selectFrom(tProject).where(tProject.id.equals(2)).select({ id: tProject.id, label: tProject.name }))
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* with-head */ `,
                afterWithQuery:  connection.rawFragment` /* with-tail */`,
                beforeQuery:     connection.rawFragment`/* compound-head */ `,
                afterQuery:      connection.rawFragment` /* compound-tail */`,
            })
            .forUseInQueryAs('combined')
        const result = await connection.selectFrom(combined)
            .select({ id: combined.id, label: combined.label })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with combined as /* with-head */  (/* compound-head */  select id as id, name as [label] from project where id = @0 union select id as id, name as [label] from project where id = @1  /* compound-tail */)  /* with-tail */ select id as id, [label] as [label] from combined order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('customize-compound-inline-aggregated-array-via-for-use-as-inline-aggregated-array-value', async () => {
        // A CUSTOMIZED one-column compound consumed as an inline aggregated-array
        // value via forUseAsInlineAggregatedArrayValue: the compound beforeQuery /
        // afterQuery hooks bracket the union INSIDE the aggregate's derived-table
        // subquery in the outer select list. Both branches select a project name;
        // the union dedups and the rows aggregate into the array (aggregate order is
        // engine-defined, so the array is JS-sorted before the exact comparison).
        const expected = [{ names: ['Internal tools', 'Marketing site'] }]
        ctx.mockNext([{ names: ['Marketing site', 'Internal tools'] }])
        const connection = ctx.conn
        const names = connection.selectFrom(tProject).where(tProject.id.equals(1)).selectOneColumn(tProject.name)
            .union(connection.selectFrom(tProject).where(tProject.id.equals(2)).selectOneColumn(tProject.name))
            .customizeQuery({
                beforeQuery: connection.rawFragment`/* compound-head */ `,
                afterQuery:  connection.rawFragment` /* compound-tail */`,
            })
            .forUseAsInlineAggregatedArrayValue()
        const rows = await connection.selectFromNoTable()
            .select({ names })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select concat('[', string_agg('"' + string_escape(convert(nvarchar(max), a_1_.[result]), 'json') + '"', ','), ']') from (/* compound-head */  select name as [result] from project where id = @0 union select name as [result] from project where id = @1  /* compound-tail */) as a_1_) as [names]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ names: string[] }>>>()
        const sorted = rows.map((r) => ({ ...r, names: [...r.names].sort() }))
        expect(sorted).toEqual(expected)
    })

    test('customize-compound-arm-custom-window-lands-on-un-parenthesized-first-arm', async () => {
        // A `customWindow` hook on a compound ARM: the first select is customized BEFORE
        // `.union()`, so its `window …` clause rides on the un-parenthesized first arm,
        // ahead of the set operator. `customizeQuery` on a plain select returns a
        // CompoundableExecutableSelectExpression, which still exposes `.union()`. The
        // named window is unreferenced (nothing selects over it).
        const expected = [{ label: 'Internal tools' }, { label: 'Marketing site' }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const arm1 = connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ label: tProject.name })
            .customizeQuery({ customWindow: connection.rawFragment`w1 as (partition by ${tProject.organizationId})` })
        const arm2 = connection.selectFrom(tProject)
            .where(tProject.id.equals(2))
            .select({ label: tProject.name })
        const result = await arm1.union(arm2).orderBy('label').executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as [label] from project where id = @0 window w1 as (partition by organization_id) union select name as [label] from project where id = @1 order by [label]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('customize-compound-arm-after-select-keyword-lands-on-first-arm', async () => {
        // `afterSelectKeyword` on a compound ARM: the fragment splices in right after
        // the first arm's `select` keyword (a comment fragment, valid on every
        // engine). The hook survives the arm's promotion into the compound.
        const expected = [{ label: 'Internal tools' }, { label: 'Marketing site' }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const arm1 = connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ label: tProject.name })
            .customizeQuery({ afterSelectKeyword: connection.rawFragment`/* hint */` })
        const arm2 = connection.selectFrom(tProject)
            .where(tProject.id.equals(2))
            .select({ label: tProject.name })
        const result = await arm1.union(arm2).orderBy('label').executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select /* hint */ name as [label] from project where id = @0 union select name as [label] from project where id = @1 order by [label]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('customize-compound-arm-before-columns-lands-on-first-arm', async () => {
        // `beforeColumns` on a compound ARM: the fragment splices in between the first
        // arm's `select` keyword (and its afterSelectKeyword slot) and the column list
        // (a comment fragment, valid on every engine). The hook survives the arm's
        // promotion into the compound.
        const expected = [{ label: 'Internal tools' }, { label: 'Marketing site' }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const arm1 = connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ label: tProject.name })
            .customizeQuery({ beforeColumns: connection.rawFragment`/* cols */ ` })
        const arm2 = connection.selectFrom(tProject)
            .where(tProject.id.equals(2))
            .select({ label: tProject.name })
        const result = await arm1.union(arm2).orderBy('label').executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select /* cols */  name as [label] from project where id = @0 union select name as [label] from project where id = @1 order by [label]"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })
    test('customize-compound-directly-executed-with-query-hooks-are-a-no-op-boundary', async () => {
        // the boundary pin on a directly-executed COMPOUND with no CTE in play.
        // `beforeWithQuery` / `afterWithQuery` render only from a WITH-view's OWN
        // customization (`_buildWith`); the compound root is not itself a with-view, so
        // the hooks have no attachment point and are silently dropped. Distinct from
        // `customize-compound-with-query-hooks-wrap-cte`, whose left arm reads a CTE (a
        // `with` clause exists there, yet the compound-root hooks still don't attach);
        // here there is no `with` clause at all. Projects {1,2} ∪ {3} → 3 rows.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const result = await connection.selectFrom(tProject).where(tProject.id.in([1, 2])).select({ id: tProject.id })
            .union(connection.selectFrom(tProject).where(tProject.id.equals(3)).select({ id: tProject.id }))
            .orderBy('id')
            .customizeQuery({
                beforeWithQuery: connection.rawFragment`/* wq-before */`,
                afterWithQuery:  connection.rawFragment`/* wq-after */`,
            })
            .executeSelectMany()

        // The exact snapshot below has NO `with` clause and no trace of the with-query
        // hooks (`/* wq-before */` / `/* wq-after */`) — a directly-executed compound is not
        // a CTE body, so the hooks have no attachment point (the no-op boundary, pinned by
        // the full SQL).
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where id in (@0, @1) union select id as id from project where id = @2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })
})
