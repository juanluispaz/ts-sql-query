// `RawFragmentImpl`
// forwards `__addWiths`, `__registerTableOrView`,
// `__registerRequiredColumn`, `__getOldValues`,
// `__getValuesForInsert` and `__isAllowed` over every entry in its
// `__params` array. The forwarders are exercised when one of those
// params is a full sub-query (`IExecutableSelectQuery`) instead of
// a plain value source.
//
// All tests here drive `rawFragment` through `customizeQuery` hooks
// that land in non-comment SQL positions (`beforeColumns` as an
// extra projection, `beforeOrderByItems` / `afterOrderByItems` as
// an extra sort key) so the embedded sub-query's placeholder sits
// in real SQL and the real DB cell actually executes it.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('rawfragment-hook-embeds-select-in-before-columns-as-extra-projection', async () => {
        // `beforeColumns` splices the fragment right before the
        // explicit column list, so the embedded SELECT renders as
        // an extra projection. The snapshot pins the inlined
        // sub-query's shape AND param ordering: the inner WHERE
        // placeholder lands first (before the outer columns).
        ctx.mockNext([{ openCount: 3, id: 1 }, { openCount: 1, id: 2 }])
        const connection = ctx.conn
        const openCount = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .selectOneColumn(connection.count(tIssue.id))

        const result = await connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                beforeColumns: connection.rawFragment`(${openCount}) as "openCount", `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select count(id) as result from issue where \`status\` = ?) as "openCount",  id as id from project"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('rawfragment-hook-embeds-select-in-before-order-by-items', async () => {
        // `beforeOrderByItems` splices the fragment as an extra
        // ORDER BY item, comma-joined ahead of the explicit ones.
        // Embedded sub-queries work here because the placeholder
        // ends up inside a real SQL expression that the driver
        // counts.
        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const connection = ctx.conn
        const openCount = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .selectOneColumn(connection.count(tIssue.id))

        const result = await connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .orderBy('id')
            .customizeQuery({
                beforeOrderByItems: connection.rawFragment`(${openCount}) asc`,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project order by (select count(id) as result from issue where \`status\` = ?) asc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('rawfragment-hook-embeds-multiple-subqueries-in-single-fragment', async () => {
        // One fragment, two embedded sub-queries. The forwarder has
        // to visit both `__params` entries; the snapshot pins the
        // emitted param order (inner sub-query #1 first, then #2).
        ctx.mockNext([{ openCount: 3, closedCount: 1, id: 1 }])
        const connection = ctx.conn
        const openCount = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .selectOneColumn(connection.count(tIssue.id))
        const closedCount = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('closed'))
            .selectOneColumn(connection.count(tIssue.id))

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id })
            .customizeQuery({
                beforeColumns: connection.rawFragment`(${openCount}) as "openCount", (${closedCount}) as "closedCount", `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select count(id) as result from issue where \`status\` = ?) as "openCount", (select count(id) as result from issue where \`status\` = ?) as "closedCount",  id as id from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "closed",
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('rawfragment-hook-embeds-recursive-select-bubbles-with-recursive-to-outer', async () => {
        // The embedded `${...}` param is a recursive select consumed via
        // `forUseAsInlineQueryValue()`. Its generated `with recursive` CTE bubbles up
        // and prefixes the OUTER statement, even though the sub-query only appears
        // inside a customize-query `beforeColumns` fragment. Every seeded issue has a
        // NULL parent_id, so the traversal from a single anchor returns one row and
        // the scalar sub-query yields a single value. The extra raw `root` projection
        // is not part of the typed result — the result mapper picks only `id`.
        ctx.mockNext([{ root: 1, id: 1 }])
        const connection = ctx.conn
        const rootIssueId = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.id)
            .recursiveUnionAllOn((child) => tIssue.parentId.equals(child.result))
            .forUseAsInlineQueryValue()

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id })
            .customizeQuery({
                beforeColumns: connection.rawFragment`(${rootIssueId}) as root, `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive recursive_select_1 as (select id as result from issue where id = ? union all select issue.id as result from issue join recursive_select_1 on issue.parent_id = recursive_select_1.result) select ((select result as result from recursive_select_1)) as root,  id as id from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual([{ id: 1 }])
    })
})
